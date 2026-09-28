from sqlalchemy.orm import Session

from Models.problem import Problem
from Models.rating import Rating
from Models.solution import Solution


# Only the problem poster's rating of the accepted solution counts as evidence.
def poster_ratings(db: Session, solution_ids) -> dict[int, int]:
    ids = list(solution_ids)
    if not ids:
        return {}

    rows = (
        db.query(Rating.solution_id, Rating.score)
        .join(Solution, Solution.id == Rating.solution_id)
        .join(Problem, Problem.id == Solution.problem_id)
        .filter(
            Rating.solution_id.in_(ids),
            Rating.user_id == Problem.user_id,
            Solution.status == "accepted",
        )
        .all()
    )
    return {solution_id: score for solution_id, score in rows}


# A rating describes one acceptance, so it is cleared whenever acceptance changes.
def clear_ratings(db: Session, solution_id: int) -> None:
    db.query(Rating).filter(Rating.solution_id == solution_id).delete()
