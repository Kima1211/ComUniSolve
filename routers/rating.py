from fastapi import HTTPException, status, APIRouter, Depends
from Schemas.rating import Rate,RateIn
from sqlalchemy.orm import Session
from Models.database import get_db
from Security.utils import get_current_user
from Models import rating,solution,problem,user

router = APIRouter()

@router.post("/solutions/{solution_id}/rate", response_model=Rate)
def rate(solution_id: int,rate: RateIn,db: Session=Depends(get_db), current_user: user.User=Depends(get_current_user)):
    fnd_solution = db.query(solution.Solution).filter(solution.Solution.id == solution_id).first()
    if not fnd_solution:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solution not found")
    
    fnd_problem = db.query(problem.Problem).filter(problem.Problem.id == fnd_solution.problem_id).first()
    if fnd_problem.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the problem poster can rate solutions")
    
    existing_rating = db.query(rating.Rating).filter(rating.Rating.user_id == current_user.id, rating.Rating.solution_id == solution_id).first()
    if existing_rating:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="User already scored")
    
    if rate.score < 1 or rate.score > 5:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,detail="Score must be 1-5 only")

    new_rating = rating.Rating(
        user_id= current_user.id,
        solution_id = solution_id,
        score = rate.score,
        feedback = rate.feedback
    )
    try:     
        db.add(new_rating)
        db.commit()
        db.refresh(new_rating)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to submit rating")
    
    return new_rating
