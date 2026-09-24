from datetime import datetime, timezone
from typing import Optional

REMOVAL_PENALTY_POINTS = -15
REMOVALS_BEFORE_SUSPENSION = 3
SUSPENSION_LADDER = [1, 3, 7]


def award_points(user, amount: int) -> None:
    user.points =max (0, user.points + amount)

# Must match the tier table in the manuscript.
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

