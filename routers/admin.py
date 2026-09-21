from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional

from Schemas.problem import ProblemOverview
from Schemas.moderation import (
    ModerationActionIn,
    ModerationLogResponse,
    QueueItem,
    SuspendUserIn,
)
from Models.database import get_db
from Models.report import Report
from Models.moderation_log import ModerationLog
from Security.utils import get_current_admin
from Models import problem, user, solution
from Services.moderation import remove_content, restore_content, suspend_user, unsuspend_user
from Services.reputation import is_currently_suspended

router = APIRouter()


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
    """Everything waiting for a human decision, problems and solutions in one list.

    Two ways in: the content was flagged automatically (Layer 1 or 2), or a
    user reported it (Layer 3). Both land here, because both mean the same
    thing - a person needs to look.
    """
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

    # Most-reported first, then newest. What the community complained about
    # loudest should not be buried under what an AI merely found unclear.
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

        else:  # dismissed - the reports are handled, the content is left as it is
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
    """Suspend or lift a suspension by hand, alongside the automatic one that
    Layer 4 applies after repeated removals."""
    target = db.query(user.User).filter(user.User.id == user_id).first()
    if not target:
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail="User not found")

    if target.id == current_user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, detail="You cannot suspend yourself")

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
    limit: int = 100,
    target_user_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: user.User = Depends(get_current_admin),
):
    query = db.query(ModerationLog)
    if target_user_id:
        query = query.filter(ModerationLog.target_user_id == target_user_id)
    return query.order_by(ModerationLog.created_at.desc()).limit(min(limit, 500)).all()
