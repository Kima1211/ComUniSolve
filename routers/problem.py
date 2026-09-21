from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from Schemas.problem import ProblemCreate, ProblemResponse
from Models.database import get_db
from Security.utils import get_current_user, get_verified_user
from Models import problem, user, solution

router = APIRouter()

def _attach_solution_counts(problems, db):
    """Set .solution_count on each problem using one grouped query.

    Counting inside a loop would fire one query per problem (the N+1 problem);
    this fires exactly one no matter how many problems there are.
    """
    if not problems:
        return problems

    ids = [p.id for p in problems]
    counts = dict(
        db.query(solution.Solution.problem_id, func.count(solution.Solution.id))
        .filter(solution.Solution.problem_id.in_(ids))
        .group_by(solution.Solution.problem_id)
        .all()
    )
    for p in problems:
        p.solution_count = counts.get(p.id, 0)
    return problems


@router.get("/problems", response_model=list[ProblemResponse])
def get_problems(
    category: Optional[str] = None,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(problem.Problem)

    if category:
        query = query.filter(problem.Problem.category == category)

    if user_id:
        query = query.filter(problem.Problem.user_id == user_id)

    # Without an explicit ORDER BY, SQL makes no promise about row order, and
    # Postgres physically moves a row when it is updated - so accepting a
    # solution used to shuffle that problem's position in the feed.
    query = query.order_by(problem.Problem.created_at.desc())

    return _attach_solution_counts(query.all(), db)


@router.get("/problems/{problem_id}", response_model=ProblemResponse)
def get_problem(problem_id: int, db: Session = Depends(get_db)):
    fnd_prob = db.query(problem.Problem).filter(problem.Problem.id == problem_id).first()

    if not fnd_prob:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Problem with id {problem_id} not found"
    )
    _attach_solution_counts([fnd_prob], db)
    return fnd_prob

@router.post("/problems", status_code=status.HTTP_201_CREATED)
def create_problem(prob: ProblemCreate, db: Session = Depends(get_db), current_user: user.User = Depends(get_verified_user)):
    new_problem = problem.Problem(
        user_id=current_user.id,
        title=prob.title,
        description=prob.description,
        category=prob.category
    )
    try:
        db.add(new_problem)
        db.commit()
        db.refresh(new_problem)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to submit problem")
        
    return {
    "id": new_problem.id,
    "title": new_problem.title,
    "description": new_problem.description,
    "category": new_problem.category,
    "status": new_problem.status,
    "posted_by": current_user.name,
    "created_at": new_problem.created_at
}

