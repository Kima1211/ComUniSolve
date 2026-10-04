from datetime import datetime, timezone

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from Models.database import get_db
from Models.notification import Notification
from Models.problem import Problem
from Models import user
from Schemas.notification import NotificationList, UnreadCount
from Security.utils import get_current_user
from Services.errors import api_error

router = APIRouter()

LATEST = 30


# A notification about a deleted or removed problem would open a 404, so it is hidden.
def _mine(db: Session, current_user):
    return (
        db.query(Notification)
        .join(Problem, Problem.id == Notification.problem_id)
        .filter(
            Notification.user_id == current_user.id,
            Problem.deleted_at.is_(None),
            Problem.moderation_status != "removed",
        )
    )


def _unread(db: Session, current_user) -> int:
    return _mine(db, current_user).filter(Notification.read_at.is_(None)).count()


@router.get("/notifications", response_model=NotificationList)
def list_notifications(db: Session = Depends(get_db), current_user: user.User = Depends(get_current_user)):
    rows = _mine(db, current_user).order_by(Notification.created_at.desc(), Notification.id.desc()).limit(LATEST).all()
    items = [
        {
            "id": n.id,
            "type": n.type,
            "actor_name": n.actor.name if n.actor else None,
            "actor_deleted": n.actor is None or n.actor.is_deleted,
            "problem_id": n.problem_id,
            "problem_title": n.problem.title,
            "solution_id": n.solution_id,
            "read": n.read_at is not None,
            "created_at": n.created_at,
        }
        for n in rows
    ]
    return {"unread": _unread(db, current_user), "items": items}


@router.post("/notifications/{notification_id}/read", response_model=UnreadCount)
def mark_read(notification_id: int, db: Session = Depends(get_db), current_user: user.User = Depends(get_current_user)):
    n = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
    ).first()
    if not n:
        raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "Notification not found")
    if n.read_at is None:
        n.read_at = datetime.now(timezone.utc)
        db.commit()
    return {"unread": _unread(db, current_user)}


@router.delete("/notifications", response_model=UnreadCount)
def clear_notifications(db: Session = Depends(get_db), current_user: user.User = Depends(get_current_user)):
    db.query(Notification).filter(Notification.user_id == current_user.id).delete(synchronize_session=False)
    db.commit()
    return {"unread": 0}


@router.post("/notifications/read-all", response_model=UnreadCount)
def mark_all_read(db: Session = Depends(get_db), current_user: user.User = Depends(get_current_user)):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.read_at.is_(None),
    ).update({Notification.read_at: datetime.now(timezone.utc)}, synchronize_session=False)
    db.commit()
    return {"unread": 0}
