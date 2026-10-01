from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import or_
from sqlalchemy.orm import Session

from Models.comment import Comment
from Models.moderation_log import ModerationLog, REMOVAL_ACTIONS
from Models.problem import Problem
from Models.solution import Solution
from Services.keywords import check_text
from Services.moderation_ai import check_content
from Services.reputation import (
    COMMENT_REMOVAL_PENALTY_POINTS,
    REMOVAL_PENALTY_POINTS,
    REMOVALS_BEFORE_SUSPENSION,
    award_points,
    next_suspension_days,
)


@dataclass
class GateResult:
    blocked: bool = False
    acknowledgeable: bool = False
    verdict: str = "unchecked"
    code: Optional[str] = None
    moderation_status: str = "visible"
    message: Optional[str] = None
    suggestion: Optional[str] = None
    matched_terms: list[str] = field(default_factory=list)


# context is only shown to the AI (e.g. the problem a solution answers); keywords check title and text only.
def run_pre_post_gate(title: Optional[str], text: str, acknowledged: bool = False,
                      kind: str = "problem", context: Optional[str] = None) -> GateResult:
    keywords = check_text(title or "", text)

    if keywords.is_blocked:
        terms = ", ".join(keywords.blocked)
        return GateResult(
            blocked=True,
            acknowledgeable=False,
            verdict="unchecked",
            code="keyword_blocked",
            message=(
                f"Your post cannot be submitted because it contains: {terms}. "
                "Please remove it and post again."
            ),
            matched_terms=keywords.blocked,
        )

    # Comments are short discussion, so they only get the keyword filter, not the AI clarity check.
    if kind == "comment":
        return GateResult(
            blocked=False,
            verdict="unchecked",
            moderation_status="flagged" if keywords.is_flagged else "visible",
            matched_terms=keywords.flagged,
        )

    ai = check_content(title, text, kind=kind, context=context)

    if ai is None:
        return GateResult(
            blocked=False,
            verdict="unchecked",
            moderation_status="flagged" if keywords.is_flagged else "visible",
            matched_terms=keywords.flagged,
        )

    if ai["verdict"] == "inappropriate":
        return GateResult(
            blocked=True,
            acknowledgeable=False,
            verdict="inappropriate",
            code="ai_inappropriate",
            message=ai["reason"] or "This post looks inappropriate for the platform.",
            suggestion=ai["suggestion"],
            matched_terms=keywords.flagged,
        )

    if ai["verdict"] == "unclear":
        if not acknowledged:
            return GateResult(
                blocked=True,
                acknowledgeable=True,
                verdict="unclear",
                code="ai_unclear",
                message=ai["reason"] or "This post may be too vague for others to act on.",
                suggestion=ai["suggestion"],
                matched_terms=keywords.flagged,
            )
        return GateResult(
            blocked=False,
            verdict="unclear",
            moderation_status="flagged",
            matched_terms=keywords.flagged,
        )

    return GateResult(
        blocked=False,
        verdict="ok",
        moderation_status="flagged" if keywords.is_flagged else "visible",
        matched_terms=keywords.flagged,
    )


# A restore undoes the admin's mistake, so only posts that are STILL removed count toward suspension.
# Counted per post, so a post removed, restored and removed again counts once.
# Only the post's latest removal decides: if it was last removed without penalty, it doesn't count.
def active_removal_counts(db: Session, user_ids) -> dict[int, int]:
    user_ids = list(user_ids)
    if not user_ids:
        return {}

    rows = (
        db.query(ModerationLog.target_user_id, ModerationLog.problem_id,
                 ModerationLog.solution_id, ModerationLog.comment_id, ModerationLog.action)
        .outerjoin(Problem, Problem.id == ModerationLog.problem_id)
        .outerjoin(Solution, Solution.id == ModerationLog.solution_id)
        .outerjoin(Comment, Comment.id == ModerationLog.comment_id)
        .filter(
            ModerationLog.target_user_id.in_(user_ids),
            ModerationLog.action.in_(REMOVAL_ACTIONS),
            or_(
                Problem.moderation_status == "removed",
                Solution.moderation_status == "removed",
                Comment.moderation_status == "removed",
            ),
        )
        .order_by(ModerationLog.created_at, ModerationLog.id)
        .all()
    )

    latest: dict[tuple, str] = {}
    for user_id, problem_id, solution_id, comment_id, action in rows:
        latest[(user_id, problem_id, solution_id, comment_id)] = action

    counts: dict[int, int] = {}
    for (user_id, *_), action in latest.items():
        if action == "removed":
            counts[user_id] = counts.get(user_id, 0) + 1
    return counts


def _latest_removal(db: Session, target, target_type: str) -> Optional[str]:
    column = {"problem": ModerationLog.problem_id, "solution": ModerationLog.solution_id,
              "comment": ModerationLog.comment_id}[target_type]
    entry = (
        db.query(ModerationLog.action)
        .filter(column == target.id, ModerationLog.action.in_(REMOVAL_ACTIONS))
        .order_by(ModerationLog.created_at.desc(), ModerationLog.id.desc())
        .first()
    )
    return entry[0] if entry else None


def _count_actions(db: Session, user_id: int, action: str) -> int:
    return (
        db.query(ModerationLog)
        .filter(ModerationLog.target_user_id == user_id, ModerationLog.action == action)
        .count()
    )


def _log(db: Session, admin_id: Optional[int], action: str, target_type: str,
         target_user_id: Optional[int], reason: Optional[str] = None,
         snapshot: Optional[str] = None, problem_id: Optional[int] = None,
         solution_id: Optional[int] = None, comment_id: Optional[int] = None) -> ModerationLog:
    entry = ModerationLog(
        admin_id=admin_id,
        target_type=target_type,
        problem_id=problem_id,
        solution_id=solution_id,
        comment_id=comment_id,
        target_user_id=target_user_id,
        action=action,
        reason=reason,
        content_snapshot=(snapshot or "")[:5000] or None,
    )
    db.add(entry)
    return entry


def suspend_user(db: Session, admin_id: Optional[int], target_user,
                 reason: Optional[str] = None) -> Optional[int]:
    prior = _count_actions(db, target_user.id, "suspended")
    days = next_suspension_days(prior)

    target_user.is_suspended = True
    target_user.suspended_at = datetime.now(timezone.utc)
    target_user.suspended_until = (
        datetime.now(timezone.utc) + timedelta(days=days) if days is not None else None
    )
    target_user.suspension_reason = reason

    _log(db, admin_id, "suspended", "user", target_user.id,
         reason=reason or (f"{days} day suspension" if days else "permanent suspension"))
    return days


def unsuspend_user(db: Session, admin_id: Optional[int], target_user,
                   reason: Optional[str] = None) -> None:
    target_user.is_suspended = False
    target_user.suspended_until = None
    target_user.suspension_reason = None
    _log(db, admin_id, "unsuspended", "user", target_user.id, reason=reason)


def _penalty(target_type: str) -> int:
    return COMMENT_REMOVAL_PENALTY_POINTS if target_type == "comment" else REMOVAL_PENALTY_POINTS


def _target_ids(target, target_type: str) -> dict:
    return {
        "problem_id": target.id if target_type == "problem" else None,
        "solution_id": target.id if target_type == "solution" else None,
        "comment_id": target.id if target_type == "comment" else None,
    }


def remove_content(db: Session, admin_id: Optional[int], target, target_type: str,
                   author, reason: Optional[str] = None, penalize: bool = True) -> dict:
    target.moderation_status = "removed"

    snapshot = getattr(target, "title", None) or ""
    body = (getattr(target, "description", None) or getattr(target, "solution_text", None)
            or getattr(target, "content", "") or "")
    snapshot = f"{snapshot}\n{body}".strip()

    _log(db, admin_id, "removed" if penalize else "removed_no_penalty", target_type, author.id,
         reason=reason, snapshot=snapshot, **_target_ids(target, target_type))

    # For posts that should go but aren't misconduct (e.g. off-topic):
    # no penalty and no step toward suspension.
    if not penalize:
        db.flush()
        return {
            "removals": active_removal_counts(db, [author.id]).get(author.id, 0),
            "points_after": author.points,
            "suspended": False,
            "suspended_days": None,
        }

    award_points(author, _penalty(target_type))

    db.flush()
    removals = active_removal_counts(db, [author.id]).get(author.id, 0)

    suspended_days: Optional[int] = None
    newly_suspended = False
    if removals >= REMOVALS_BEFORE_SUSPENSION and not author.is_suspended:
        suspended_days = suspend_user(
            db, admin_id, author,
            reason=f"{removals} posts removed by moderation",
        )
        newly_suspended = True

    return {
        "removals": removals,
        "points_after": author.points,
        "suspended": newly_suspended,
        "suspended_days": suspended_days,
    }


def restore_content(db: Session, admin_id: Optional[int], target, target_type: str,
                    author, reason: Optional[str] = None) -> None:
    # Only give points back if the removal actually took them.
    if _latest_removal(db, target, target_type) == "removed":
        award_points(author, -_penalty(target_type))
    target.moderation_status = "visible"
    _log(db, admin_id, "restored", target_type, author.id, reason=reason, **_target_ids(target, target_type))

