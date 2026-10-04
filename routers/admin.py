from datetime import datetime, timezone
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from Schemas.problem import ProblemOverview
from Schemas.moderation import (
    ModerationActionIn,
    ModerationLogResponse,
    QueueItem,
    AuditLogResponse,
    ReportNote,
    SuspendUserIn,
)
from Schemas.user import AdminUserList, AdminUserRow
from Models.database import get_db
from Models.report import Report
from Models.moderation_log import ModerationLog
from Models.audit_log import AuditLog, AUDIT_ACTIONS
from Security.utils import get_current_admin
from Models import problem, user, solution, comment
from routers.user import reactivate
from Services.moderation import active_removal_counts, remove_content, restore_content, suspend_user, unsuspend_user
from Services.reputation import is_currently_suspended, get_tier
from Services.errors import api_error

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
    removal_counts = active_removal_counts(db, ids)

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
            is_deleted=u.is_deleted,
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
        + db.query(comment.Comment).filter(comment.Comment.moderation_status == "flagged").count()
    )

    return {
        "total_users": total_users,
        "total_problems": total_problems,
        "total_solutions": total_solutions,
        "pending_reports": pending_reports,
        "flagged_content": flagged_content,
    }

def _pending_reports(db: Session) -> dict[str, dict[int, list[Report]]]:
    grouped: dict[str, dict[int, list[Report]]] = {"problem": {}, "solution": {}, "comment": {}}
    for r in db.query(Report).filter(Report.status == "pending").order_by(Report.created_at).all():
        if r.problem_id is not None:
            grouped["problem"].setdefault(r.problem_id, []).append(r)
        elif r.solution_id is not None:
            grouped["solution"].setdefault(r.solution_id, []).append(r)
        else:
            grouped["comment"].setdefault(r.comment_id, []).append(r)
    return grouped

@router.get("/admin/queue", response_model=list[QueueItem])
def get_moderation_queue(db: Session = Depends(get_db), current_user: user.User = Depends(get_current_admin)):
    due = _pending_reports(db)
    models = {"problem": problem.Problem, "solution": solution.Solution, "comment": comment.Comment}

    targets = {
        kind: (
            db.query(model)
            .filter(model.moderation_status != "removed")
            .filter((model.moderation_status == "flagged") | (model.id.in_(due[kind].keys() or [-1])))
            .all()
        )
        for kind, model in models.items()
    }

    solution_problem = {s.id: s.problem_id for s in targets["solution"]}
    comment_solution = {c.id: c.solution_id for c in targets["comment"]}
    if comment_solution:
        solution_problem.update(dict(
            db.query(solution.Solution.id, solution.Solution.problem_id)
            .filter(solution.Solution.id.in_(set(comment_solution.values()))).all()
        ))
    problem_ids = set(solution_problem.values())
    titles = dict(
        db.query(problem.Problem.id, problem.Problem.title).filter(problem.Problem.id.in_(problem_ids)).all()
    ) if problem_ids else {}

    items: list[QueueItem] = []
    for kind, rows in targets.items():
        for t in rows:
            reports = due[kind].get(t.id, [])
            if kind == "problem":
                problem_id, title, text, ai_status = t.id, t.title, t.description, t.ai_status
            elif kind == "solution":
                problem_id, title, text, ai_status = t.problem_id, None, t.solution_text, t.ai_status
            else:
                problem_id = solution_problem.get(t.solution_id)
                title, text, ai_status = None, t.content, "unchecked"

            items.append(QueueItem(
                target_type=kind,
                id=t.id,
                title=title,
                excerpt=(text or "")[:300],
                author_id=t.user_id,
                author_name=t.author.name if t.author else "(unknown)",
                ai_status=ai_status,
                moderation_status=t.moderation_status,
                report_count=len(reports),
                report_reasons=sorted({r.reason for r in reports}),
                reports=[ReportNote(reason=r.reason, details=r.details) for r in reports],
                problem_id=problem_id,
                problem_title=titles.get(problem_id) if kind != "problem" else None,
                created_at=t.created_at,
            ))

    items.sort(key=lambda i: (i.report_count, i.created_at), reverse=True)
    return items

def _load_target(db: Session, target_type: str, target_id: int):
    models = {"problem": problem.Problem, "solution": solution.Solution, "comment": comment.Comment}
    model = models[target_type]
    target = db.query(model).filter(model.id == target_id).first()

    if not target:
        raise api_error(status.HTTP_404_NOT_FOUND, "not_found", f"{target_type.title()} not found")

    author = db.query(user.User).filter(user.User.id == target.user_id).first()
    if not author:
        raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "Author not found")
    return target, author

def _close_reports(db: Session, target_type: str, target_id: int, new_status: str) -> int:
    column = {"problem": Report.problem_id, "solution": Report.solution_id, "comment": Report.comment_id}[target_type]
    reports = db.query(Report).filter(column == target_id, Report.status == "pending").all()
    for r in reports:
        r.status = new_status
    return len(reports)

def _moderate(db: Session, admin, target_type: str, target_id: int, body: ModerationActionIn):
    target, author = _load_target(db, target_type, target_id)
    outcome: dict = {"action": body.action, "target_type": target_type, "id": target_id}

    try:
        if body.action in ("removed", "removed_no_penalty"):
            if target.moderation_status == "removed":
                raise api_error(status.HTTP_400_BAD_REQUEST, "already_removed", "Already removed")
            outcome.update(remove_content(db, admin.id, target, target_type, author, body.reason,
                                          penalize=body.action == "removed"))
            outcome["reports_closed"] = _close_reports(db, target_type, target_id, "actioned")

        elif body.action == "restored":
            if target.moderation_status != "removed":
                raise api_error(status.HTTP_400_BAD_REQUEST, "not_removed", "This is not removed")
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
        raise api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, "server_error", "Failed to apply moderation action")

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

@router.patch("/admin/comments/{comment_id}/moderate")
def moderate_comment(
    comment_id: int,
    body: ModerationActionIn,
    db: Session = Depends(get_db),
    current_user: user.User = Depends(get_current_admin),
):
    return _moderate(db, current_user, "comment", comment_id, body)

@router.patch("/admin/users/{user_id}/suspension")
def set_user_suspension(
    user_id: int,
    body: SuspendUserIn,
    db: Session = Depends(get_db),
    current_user: user.User = Depends(get_current_admin),
):
    target = db.query(user.User).filter(user.User.id == user_id).first()
    if not target:
        raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "User not found")

    if target.id == current_user.id:
        raise api_error(status.HTTP_400_BAD_REQUEST, "suspend_self", "You cannot suspend yourself")

    if target.role == "admin":
        raise api_error(status.HTTP_400_BAD_REQUEST, "suspend_admin", "Admins cannot be suspended")

    # Unverified accounts are already blocked from posting; a suspension would only use up a step of the ladder.
    if body.suspend and not target.is_verified:
        raise api_error(status.HTTP_400_BAD_REQUEST, "suspend_unverified", "Unverified accounts can't be suspended")

    # Each suspension moves one step up the ladder (1, 3, 7 days, permanent), so never count one twice.
    currently_suspended = is_currently_suspended(target)
    if body.suspend and currently_suspended:
        raise api_error(status.HTTP_400_BAD_REQUEST, "already_suspended", "This user is already suspended")
    if not body.suspend and not currently_suspended:
        raise api_error(status.HTTP_400_BAD_REQUEST, "not_suspended", "This user is not suspended")

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
        raise api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, "server_error", "Failed to update suspension")

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
    action: Optional[Literal["removed", "removed_no_penalty", "restored", "suspended", "unsuspended"]] = None,
    db: Session = Depends(get_db),
    current_user: user.User = Depends(get_current_admin),
):
    query = db.query(ModerationLog)
    if target_user_id:
        query = query.filter(ModerationLog.target_user_id == target_user_id)
    if action:
        query = query.filter(ModerationLog.action == action)
    logs = query.order_by(ModerationLog.created_at.desc()).limit(limit).all()

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
    comment_ids = {l.comment_id for l in logs if l.comment_id}
    comment_status = dict(
        db.query(comment.Comment.id, comment.Comment.moderation_status)
        .filter(comment.Comment.id.in_(comment_ids)).all()
    ) if comment_ids else {}

    return [
        ModerationLogResponse.model_validate(l).model_copy(update={
            "admin_name": names.get(l.admin_id),
            "target_user_name": names.get(l.target_user_id),
            "target_status": (
                problem_status.get(l.problem_id) if l.problem_id
                else solution_status.get(l.solution_id) if l.solution_id
                else comment_status.get(l.comment_id) if l.comment_id
                else None
            ),
        })
        for l in logs
    ]

@router.get("/admin/audit", response_model=list[AuditLogResponse])
def get_audit_logs(
    limit: int = Query(200, ge=1, le=500),
    action: Optional[Literal[tuple(AUDIT_ACTIONS)]] = None,
    db: Session = Depends(get_db),
    current_user: user.User = Depends(get_current_admin),
):
    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action == action)
    logs = query.order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).limit(limit).all()

    ids = {l.user_id for l in logs if l.user_id}
    names = dict(db.query(user.User.id, user.User.name).filter(user.User.id.in_(ids)).all()) if ids else {}
    return [
        AuditLogResponse.model_validate(l).model_copy(update={"user_name": names.get(l.user_id)})
        for l in logs
    ]

@router.patch("/admin/users/{user_id}/reactivate")
def admin_reactivate_user(
    user_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: user.User = Depends(get_current_admin),
):
    target = db.query(user.User).filter(user.User.id == user_id).first()
    if not target:
        raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "User not found")
    if target.is_deleted:
        raise api_error(status.HTTP_400_BAD_REQUEST, "account_deleted", "This account was deleted and can't be reactivated")
    if target.is_active:
        raise api_error(status.HTTP_400_BAD_REQUEST, "not_deactivated", "This account is not deactivated")

    reactivate(target, db, request)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, "server_error", "Failed to reactivate account")
    return {"id": target.id, "is_active": True}
