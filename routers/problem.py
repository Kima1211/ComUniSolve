from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from typing import Optional
from Schemas.problem import Problems, ProblemResponse
from Models.database import get_db
from Security.utils import get_current_user
from Models import problem,user


router = APIRouter()

@router.get("/problems", response_model=list[ProblemResponse])
def get_problems(category: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(problem.Problem)
    
    if category:
        query = query.filter(problem.Problem.category == category)
        
    return query.all()
    

@router.get("/problems/{problem_id}", response_model=ProblemResponse)
def get_problem(problem_id: int, db: Session = Depends(get_db)):
    fnd_prob = db.query(problem.Problem).filter(problem.Problem.id == problem_id).first()
    
    if not fnd_prob:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Problem with id {problem_id} not found"
    )
    return fnd_prob

@router.post("/problems", status_code=status.HTTP_201_CREATED)
def create_problem(prob: Problems, db: Session = Depends(get_db), current_user: user.User = Depends(get_current_user)):
    new_problem = problem.Problem(
        user_id=current_user.id,
        title=prob.title,
        description=prob.description,
        category=prob.category
    )
    db.add(new_problem)
    db.commit()
    db.refresh(new_problem)
    
    return {
    "id": new_problem.id,
    "title": new_problem.title,
    "description": new_problem.description,
    "category": new_problem.category,
    "status": new_problem.status,
    "posted_by": current_user.name,
    "created_at": new_problem.created_at
}