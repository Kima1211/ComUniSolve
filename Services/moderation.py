from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.orm import Session

from Models.moderation_log import ModerationLog
from Services.keywords import check_text
from Services.moderation_ai import check_content
from Services.reputation import (
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
    moderation_status: str = "visible"
    message: Optional[str] = None
    suggestion: Optional[str] = None
    matched_terms: list[str] = field(default_factory=list)


def run_pre_post_gate(title: Optional[str], text: str, acknowledged: bool = False) -> GateResult:
    keywords = check_text(title or "", text)

    if keywords.is_blocked:
        terms = ", ".join(keywords.blocked)
        return GateResult(
            blocked=True,
            acknowledgeable=False,
            verdict="unchecked",
            message=(
                f"Your post cannot be submitted because it contains: {terms}. "
                "Please remove it and post again."
            ),
            matched_terms=keywords.blocked,
        )

    ai = check_content(title, text)

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


def _count_actions(db: Session, user_id: int, action: str) -> int:
    return (
        db.query(ModerationLog)
        .filter(ModerationLog.target_user_id == user_id, ModerationLog.action == action)
        .count()
    )


def _log(db: Session, admin_id: Optional[int], action: str, target_type: str,
         target_user_id: Optional[int], reason: Optional[str] = None,
         snapshot: Optional[str] = None, problem_id: Optional[int] = None,
         solution_id: Optional[int] = None) -> ModerationLog:
    entry = ModerationLog(
        admin_id=admin_id,
        target_type=target_type,
        problem_id=problem_id,
        solution_id=solution_id,
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


def remove_content(db: Session, admin_id: Optional[int], target, target_type: str,
                   author, reason: Optional[str] = None) -> dict:
    target.moderation_status = "removed"

    snapshot = getattr(target, "title", None) or ""
    body = getattr(target, "description", None) or getattr(target, "solution_text", "") or ""
    snapshot = f"{snapshot}\n{body}".strip()

    _log(
        db, admin_id, "removed", target_type, author.id, reason=reason, snapshot=snapshot,
        problem_id=target.id if target_type == "problem" else None,
        solution_id=target.id if target_type == "solution" else None,
    )

    award_points(author, REMOVAL_PENALTY_POINTS)

    db.flush()
    removals = _count_actions(db, author.id, "removed")

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
    target.moderation_status = "visible"
    award_points(author, -REMOVAL_PENALTY_POINTS)
    _log(
        db, admin_id, "restored", target_type, author.id, reason=reason,
        problem_id=target.id if target_type == "problem" else None,
        solution_id=target.id if target_type == "solution" else None,
    )

