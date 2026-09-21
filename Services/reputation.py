from datetime import datetime, timezone
from typing import Optional

# --- Layer 4 settings -------------------------------------------------------
# Kept as named constants so the numbers are a decision you can point at and
# change, not magic values buried in an endpoint.

# An accepted solution is worth +10. A removal penalty smaller than that would
# mean content could be farmed faster than moderation takes it away.
REMOVAL_PENALTY_POINTS = -15

# How many of your posts an admin has removed before the account is suspended.
REMOVALS_BEFORE_SUSPENSION = 3

# Suspension lengths in days, by how many times this user has been suspended
# before. Past the end of the list, the suspension is permanent.
SUSPENSION_LADDER = [1, 3, 7]


def award_points(user, amount: int) -> None:
    user.points =max (0, user.points + amount)

def get_tier(points: int) -> str:
    if points >=80:
        return "Community Expert"
    elif points >= 60:
        return "Trusted Helper"
    elif points >= 30:
        return "Contributor"
    return "Newcomer"


def is_currently_suspended(user) -> bool:
    """The only correct way to ask whether a user is suspended right now.

    Nothing anywhere should read user.is_suspended directly. Suspensions
    expire lazily - no job clears the flag - so the boolean on its own goes
    stale the moment a suspension's end date passes, and a user whose
    suspension ended last week would still be locked out.
    """
    if not user.is_suspended:
        return False

    # Suspended with no end date means permanent.
    if user.suspended_until is None:
        return True

    # Both sides must be timezone-aware or this comparison raises.
    return user.suspended_until > datetime.now(timezone.utc)


def next_suspension_days(prior_suspensions: int) -> Optional[int]:
    """How long this user's next suspension should last.

    Returns a number of days, or None for permanent. `prior_suspensions` is
    counted from moderation_logs rather than stored on the user - it is read
    only when an admin removes something, so a query is cheaper than a
    denormalised counter that could drift.
    """
    if prior_suspensions < len(SUSPENSION_LADDER):
        return SUSPENSION_LADDER[prior_suspensions]
    return None
