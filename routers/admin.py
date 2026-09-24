from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from Schemas.problem import ProblemOverview
from Schemas.moderation import (
    ModerationActionIn,
    ModerationLogResponse,
    QueueItem,
    SuspendUserIn,
)
from Schemas.user import AdminUserList, AdminUserRow
from Models.database import get_db
from Models.report import Report
from Models.moderation_log import ModerationLog
from Security.utils import get_current_admin
from Models import problem, user, solution
from Services.moderation import remove_content, restore_content, suspend_user, unsuspend_user
from Services.reputation import is_currently_suspended, get_tier

router = APIRouter()


def _count_per_user(db: Session, column, user_ids: list[int], *filters) -> dict[int, int]:
    if not user_ids:
        return {}
    rows = (
        db.query(column, func.count())
        .filter(column.in_(user_ids), *filters)
        .group_by(column)
        .all()
    )
    return dict(rows)


@router.get("/admin/users", response_model=AdminUserList)
def list_users(
    search: str = Query("", max_length=100),
    show: Literal["all", "suspended", "unverified", "admins"] = "all",
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: user.User = Depends(get_current_admin),
):
    query = db.query(user.User)

    term = search.strip().lower()
    if term:
        # autoescape: a search for "50%" means the text "50%", not a wildcard.
        query = query.filter(or_(
            func.lower(user.User.name).contains(term, autoescape=True),
            func.lower(user.User.email).contains(term, autoescape=True),
        ))

    if show == "suspended":
        query = query.filter(
            user.User.is_suspended.is_(True),
            or_(user.User.suspended_until.is_(None),
                user.User.suspended_until > datetime.now(timezone.utc)),
        )
    elif show == "unverified":
        query = query.filter(user.User.is_verified.is_(False))
    elif show == "admins":
        query = query.filter(user.User.role == "admin")

    total = query.count()
    rows = (
        query.order_by(user.User.created_at.desc(), user.User.id.desc())
        .offset(offset).limit(limit).all()
    )

    ids = [u.id for u in rows]
    problem_counts = _count_per_user(db, problem.Problem.user_id, ids)
    solution_counts = _count_per_user(db, solution.Solution.user_id, ids)
    removal_counts = _count_per_user(db, ModerationLog.target_user_id, ids,
                                     ModerationLog.action == "removed")

    return AdminUserList(total=total, users=[
        AdminUserRow(
            id=u.id,
            name=u.name,
            email=u.email,
            role=u.role,
            points=u.points,
            tier=get_tier(u.points),
            is_verified=u.is_verified,
            is_active=u.is_active,
            is_suspended=is_currently_suspended(u),
            suspended_until=u.suspended_until,
            suspension_reason=u.suspension_reason,
            created_at=u.created_at,
            problem_count=problem_counts.get(u.id, 0),
            solution_count=solution_counts.get(u.id, 0),
            removal_count=removal_counts.get(u.id, 0),
        )
        for u in rows
    ])


@router.get("/admin/overview", response_model=ProblemOverview)
def get_problem_overview(db: Session = Depends(get_db), current_user: user.User = Depends(get_current_admin)):
    total_users = db.query(user.User).count()
    total_problems = db.query(problem.Problem).count()
    total_solutions = db.query(solution.Solution).count()
    pending_reports = db.query(Report).filter(Report.status == "pending").count()
    flagged_content = (
        db.query(problem.Problem).filter(problem.Problem.moderation_status == "flagged").count()
        + db.query(solution.Solution).filter(solution.Solution.moderation_status == "flagged").count()
    )

    return {
        "total_users": total_users,
        "total_problems": total_problems,
        "total_solutions": total_solutions,
        "pending_reports": pending_reports,
        "flagged_content": flagged_content,
    }


@router.get("/admin/queue", response_model=list[QueueItem])
def get_moderation_queue(db: Session = Depends(get_db), current_user: user.User = Depends(get_current_admin)):
    pending = db.query(Report).filter(Report.status == "pending").all()

    problem_reports: dict[int, list[str]] = {}
    solution_reports: dict[int, list[str]] = {}
    for r in pending:
        bucket = problem_reports if r.problem_id is not None else solution_reports
        key = r.problem_id if r.problem_id is not None else r.solution_id
        bucket.setdefault(key, []).append(r.reason)

    items: list[QueueItem] = []

    problems = (
        db.query(problem.Problem)
        .filter(problem.Problem.moderation_status != "removed")
        .filter(
            (problem.Problem.moderation_status == "flagged")
            | (problem.Problem.id.in_(problem_reports.keys() or [-1]))
        )
        .all()
    )
    for p in problems:
        reasons = problem_reports.get(p.id, [])
        items.append(QueueItem(
            target_type="problem",
            id=p.id,
            title=p.title,
            excerpt=(p.description or "")[:300],
            author_id=p.user_id,
            author_name=p.author.name if p.author else "(unknown)",
            ai_status=p.ai_status,
            moderation_status=p.moderation_status,
            report_count=len(reasons),
            report_reasons=sorted(set(reasons)),
            created_at=p.created_at,
        ))

    solutions = (
        db.query(solution.Solution)
        .filter(solution.Solution.moderation_status != "removed")
        .filter(
            (solution.Solution.moderation_status == "flagged")
            | (solution.Solution.id.in_(solution_reports.keys() or [-1]))
        )
        .all()
    )
    for s in solutions:
        reasons = solution_reports.get(s.id, [])
        items.append(QueueItem(
            target_type="solution",
            id=s.id,
            title=None,
            excerpt=(s.solution_text or "")[:300],
            author_id=s.user_id,
            author_name=s.author.name if s.author else "(unknown)",
            ai_status=s.ai_status,
            moderation_status=s.moderation_status,
            report_count=len(reasons),
            report_reasons=sorted(set(reasons)),
            created_at=s.created_at,
        ))

    items.sort(key=lambda i: (i.report_count, i.created_at), reverse=True)
    return items


def _load_target(db: Session, target_type: str, target_id: int):
    if target_type == "problem":
        target = db.query(problem.Problem).filter(problem.Problem.id == target_id).first()
    else:
        target = db.query(solution.Solution).filter(solution.Solution.id == target_id).first()

    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail=f"{target_type.title()} not found")

    author = db.query(user.User).filter(user.User.id == target.user_id).first()
    if not author:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Author not found")
    return target, author


def _close_reports(db: Session, target_type: str, target_id: int, new_status: str) -> int:
    column = Report.problem_id if target_type == "problem" else Report.solution_id
    reports = db.query(Report).filter(column == target_id, Report.status == "pending").all()
    for r in reports:
        r.status = new_status
    return len(reports)


def _moderate(db: Session, admin, target_type: str, target_id: int, body: ModerationActionIn):
    target, author = _load_target(db, target_type, target_id)
    outcome: dict = {"action": body.action, "target_type": target_type, "id": target_id}

    try:
        if body.action == "removed":
            if target.moderation_status == "removed":
                raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Already removed")
            outcome.update(remove_content(db, admin.id, target, target_type, author, body.reason))
            outcome["reports_closed"] = _close_reports(db, target_type, target_id, "actioned")

        elif body.action == "restored":
            if target.moderation_status != "removed":
                raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="This is not removed")
            restore_content(db, admin.id, target, target_type, author, body.reason)
            outcome["points_after"] = author.points

        elif body.action == "approved":
            target.moderation_status = "visible"
            outcome["reports_closed"] = _close_reports(db, target_type, target_id, "dismissed")

        else:
            outcome["reports_closed"] = _close_reports(db, target_type, target_id, "dismissed")

        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception:
        db.rollback()
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to apply moderation action",
        )

    return outcome


@router.patch("/admin/problems/{problem_id}/moderate")
def moderate_problem(
    problem_id: int,
    body: ModerationActionIn,
    db: Session = Depends(get_db),
    current_user: user.User = Depends(get_current_admin),
):
    return _moderate(db, current_user, "problem", problem_id, body)


@router.patch("/admin/solutions/{solution_id}/moderate")
def moderate_solution(
    solution_id: int,
    body: ModerationActionIn,
    db: Session = Depends(get_db),
    current_user: user.User = Depends(get_current_admin),
):
    return _moderate(db, current_user, "solution", solution_id, body)


@router.patch("/admin/users/{user_id}/suspension")
def set_user_suspension(
    user_id: int,
    body: SuspendUserIn,
    db: Session = Depends(get_db),
    current_user: user.User = Depends(get_current_admin),
):
    target = db.query(user.User).filter(user.User.id == user_id).first()
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")

    if target.id == current_user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="You cannot suspend yourself")

    if target.role == "admin":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="Admins cannot be suspended")

    # Each suspension moves the user one step up the ladder (1, 3, 7 days,
    # then permanent), so suspending someone twice by accident must not count.
    currently_suspended = is_currently_suspended(target)
    if body.suspend and currently_suspended:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="This user is already suspended")
    if not body.suspend and not currently_suspended:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="This user is not suspended")

    try:
        if body.suspend:
            days = suspend_user(db, current_user.id, target, body.reason)
        else:
            unsuspend_user(db, current_user.id, target, body.reason)
            days = None
        db.commit()
        db.refresh(target)
    except Exception:
        db.rollback()
        raise HTTPException(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update suspension",
        )

    return {
        "user_id": target.id,
        "suspended": is_currently_suspended(target),
        "suspended_until": target.suspended_until,
        "days": days,
        "reason": target.suspension_reason,
    }


@router.get("/admin/logs", response_model=list[ModerationLogResponse])
def get_moderation_logs(
    limit: int = Query(100, ge=1, le=500),
    target_user_id: Optional[int] = None,
    action: Optional[Literal["removed", "restored", "suspended", "unsuspended"]] = None,
    db: Session = Depends(get_db),
    current_user: user.User = Depends(get_current_admin),
):
    query = db.query(ModerationLog)
    if target_user_id:
        query = query.filter(ModerationLog.target_user_id == target_user_id)
    if action:
        query = query.filter(ModerationLog.action == action)
    logs = query.order_by(ModerationLog.created_at.desc()).limit(limit).all()

    # Names instead of bare ids, and each post's CURRENT status, so the page
    # only offers "Restore" for content that is still removed.
    people = {l.admin_id for l in logs} | {l.target_user_id for l in logs}
    people.discard(None)
    names = dict(db.query(user.User.id, user.User.name).filter(user.User.id.in_(people)).all()) if people else {}

    problem_ids = {l.problem_id for l in logs if l.problem_id}
    solution_ids = {l.solution_id for l in logs if l.solution_id}
    problem_status = dict(
        db.query(problem.Problem.id, problem.Problem.moderation_status)
        .filter(problem.Problem.id.in_(problem_ids)).all()
    ) if problem_ids else {}
    solution_status = dict(
        db.query(solution.Solution.id, solution.Solution.moderation_status)
        .filter(solution.Solution.id.in_(solution_ids)).all()
    ) if solution_ids else {}

    return [
        ModerationLogResponse.model_validate(l).model_copy(update={
            "admin_name": names.get(l.admin_id),
            "target_user_name": names.get(l.target_user_id),
            "target_status": (
                problem_status.get(l.problem_id) if l.problem_id
                else solution_status.get(l.solution_id) if l.solution_id
                else None
            ),
        })
        for l in logs
    ]

