from datetime import datetime, timezone
from typing import Optional

from sqlalchemy.orm import Session

from Models.notification import Notification


# Adds to the caller's transaction, so the notification is saved only if the action itself is.
def notify(db: Session, recipient_id: int, actor_id: int, kind: str,
           problem_id: int, solution_id: Optional[int] = None) -> None:
    if recipient_id == actor_id:
        return

    same = db.query(Notification).filter(
        Notification.user_id == recipient_id,
        Notification.actor_id == actor_id,
        Notification.type == kind,
    )
    # Answers are grouped per problem; comments and accepts per solution.
    if kind == "new_solution":
        same = same.filter(Notification.problem_id == problem_id)
    else:
        same = same.filter(Notification.solution_id == solution_id)

    # Toggling accept on and off must never notify twice.
    if kind == "solution_accepted":
        if same.first():
            return
    else:
        unread = same.filter(Notification.read_at.is_(None)).first()
        if unread:
            # One unread line per person and post: a repeat moves it to the top instead of adding another.
            unread.created_at = datetime.now(timezone.utc)
            unread.solution_id = solution_id
            return

    db.add(Notification(
        user_id=recipient_id,
        actor_id=actor_id,
        type=kind,
        problem_id=problem_id,
        solution_id=solution_id,
    ))


# An "accepted" line the author hasn't seen yet would be false after an un-accept.
def withdraw_unread_accept(db: Session, solution_id: int) -> None:
    db.query(Notification).filter(
        Notification.type == "solution_accepted",
        Notification.solution_id == solution_id,
        Notification.read_at.is_(None),
    ).delete(synchronize_session=False)
