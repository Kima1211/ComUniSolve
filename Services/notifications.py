from typing import Optional

from sqlalchemy.orm import Session

from Models.notification import Notification


# Adds to the caller's transaction, so the notification is saved only if the action itself is.
def notify(db: Session, recipient_id: int, actor_id: int, kind: str,
           problem_id: int, solution_id: Optional[int] = None) -> None:
    if recipient_id == actor_id:
        return
    db.add(Notification(
        user_id=recipient_id,
        actor_id=actor_id,
        type=kind,
        problem_id=problem_id,
        solution_id=solution_id,
    ))
