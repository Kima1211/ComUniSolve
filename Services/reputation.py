from datetime import datetime, timezone
from typing import Optional

REMOVAL_PENALTY_POINTS = -15
COMMENT_REMOVAL_PENALTY_POINTS = -5
REMOVALS_BEFORE_SUSPENSION = 3
SUSPENSION_LADDER = [1, 3, 7]


# Avatar frames follow the current title; keep in sync with frontend/src/avatar-frames.js.
FRAME_MIN_POINTS = {"usbong": 0, "alon": 10, "capiz": 30, "araw": 70}
TIER_UP_NOTIFICATIONS = {"Contributor": "tier_contributor", "Trusted Helper": "tier_trusted",
                         "Community Expert": "tier_expert"}


def award_points(user, amount: int) -> None:
    before = get_tier(user.points)
    user.points = max(0, user.points + amount)
    after = get_tier(user.points)
    if amount > 0 and after != before and after in TIER_UP_NOTIFICATIONS:
        _announce_tier(user, TIER_UP_NOTIFICATIONS[after])


# Joins the session the points change is in, so it is saved only if the change is.
def _announce_tier(user, kind: str) -> None:
    from sqlalchemy.orm import object_session
    from Models.notification import Notification

    db = object_session(user)
    if db is None:
        return
    if db.query(Notification.id).filter(Notification.user_id == user.id, Notification.type == kind).first():
        return
    db.add(Notification(user_id=user.id, actor_id=None, type=kind))


def frame_unlocked(frame: str, points: int) -> bool:
    return points >= FRAME_MIN_POINTS[frame]


# None in the database means "follow my title"; "none" means the user hid the frame.
def effective_frame(choice: Optional[str], points: int) -> Optional[str]:
    if choice == "none":
        return None
    if choice in FRAME_MIN_POINTS and frame_unlocked(choice, points):
        return choice
    return max((f for f, need in FRAME_MIN_POINTS.items() if points >= need), key=FRAME_MIN_POINTS.get)

def get_tier(points: int) -> str:
    if points >= 70:
        return "Community Expert"
    elif points >= 30:
        return "Trusted Helper"
    elif points >= 10:
        return "Contributor"
    return "Newcomer"


# Always use this, never user.is_suspended: suspensions expire without the flag being cleared.
def is_currently_suspended(user) -> bool:
    if not user.is_suspended:
        return False

    if user.suspended_until is None:
        return True
    
    return user.suspended_until > datetime.now(timezone.utc)


def next_suspension_days(prior_suspensions: int) -> Optional[int]:
    if prior_suspensions < len(SUSPENSION_LADDER):
        return SUSPENSION_LADDER[prior_suspensions]
    return None

