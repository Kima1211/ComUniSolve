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
