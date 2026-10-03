from fastapi import HTTPException, status, APIRouter, Depends
from Schemas.rating import Rate,RateIn
from sqlalchemy.orm import Session
from Models.database import get_db
from Security.utils import get_current_user, get_active_poster
from Models import rating,solution,problem,user
from Services.errors import api_error

router = APIRouter()

@router.post("/solutions/{solution_id}/rate", response_model=Rate)
def rate(solution_id: int,rate: RateIn,db: Session=Depends(get_db), current_user: user.User=Depends(get_active_poster)):
    fnd_solution = db.query(solution.Solution).filter(
        solution.Solution.id == solution_id,
        solution.Solution.deleted_at.is_(None),
        solution.Solution.moderation_status != "removed",
    ).first()
    if not fnd_solution:
        raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "Solution not found")
    
    fnd_problem = db.query(problem.Problem).filter(
        problem.Problem.id == fnd_solution.problem_id,
        problem.Problem.deleted_at.is_(None),
        problem.Problem.moderation_status != "removed",
    ).first()
    if not fnd_problem:
        raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "Problem not found")

    if fnd_problem.user_id != current_user.id:
        raise api_error(status.HTTP_403_FORBIDDEN, "rate_not_poster", "Only the problem poster can rate solutions")

    if fnd_solution.status != "accepted":
        raise api_error(status.HTTP_400_BAD_REQUEST, "rate_not_accepted", "You can only rate the accepted solution")

    if fnd_solution.user_id == current_user.id:
        raise api_error(status.HTTP_400_BAD_REQUEST, "rate_own", "You can't rate your own solution")

    fnd_rating = db.query(rating.Rating).filter(rating.Rating.user_id == current_user.id, rating.Rating.solution_id == solution_id).first()
    if fnd_rating:
        fnd_rating.score = rate.score
        fnd_rating.feedback = rate.feedback
    else:
        fnd_rating = rating.Rating(
            user_id= current_user.id,
            solution_id = solution_id,
            score = rate.score,
            feedback = rate.feedback
        )
        db.add(fnd_rating)

    try:
        db.commit()
        db.refresh(fnd_rating)
    except Exception:
        db.rollback()
        raise api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, "server_error", "Failed to submit rating")

    return fnd_rating

