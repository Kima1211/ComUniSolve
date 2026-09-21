from fastapi import HTTPException, APIRouter, status, Depends
from sqlalchemy.orm import Session
from Schemas.solution import SolutionCreate, SolutionResponse, SolutionAccept
from Models.database import get_db
from Models import solution,problem,user
from Security.utils import get_current_user, get_verified_user, get_active_poster
from Services.reputation import award_points
from Services.moderation import run_pre_post_gate
from Schemas.moderation import ContentCheckResponse

router = APIRouter()

@router.post("/solutions", status_code=status.HTTP_201_CREATED)
def create_solution(solution_create: SolutionCreate, db: Session = Depends(get_db), current_user: user.User = Depends(get_active_poster)):
    fnd_problem = db.query(problem.Problem).filter(problem.Problem.id == solution_create.problem_id).first()
     
    if not fnd_problem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found")

    existing_solution = db.query(solution.Solution).filter(solution.Solution.user_id == current_user.id, solution.Solution.problem_id == fnd_problem.id).first()
    
    # Same gate as posting a problem. A solution is user-generated content on
    # the same platform, so it gets the same Layer 1 and Layer 2 treatment.
    gate = run_pre_post_gate(None, solution_create.solution_text,
                             acknowledged=solution_create.acknowledged)
    if gate.blocked:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=ContentCheckResponse(
                verdict=gate.verdict,
                blocked=gate.blocked,
                acknowledgeable=gate.acknowledgeable,
                message=gate.message,
                matched_terms=gate.matched_terms,
                suggestion=gate.suggestion,
            ).model_dump(),
        )

    is_self_solution = (
        fnd_problem.user_id == current_user.id
    )
    new_solution = solution.Solution(
        user_id = current_user.id,
        problem_id = solution_create.problem_id,
        solution_text = solution_create.solution_text,
        ai_status = gate.verdict,
        moderation_status = gate.moderation_status,
    )
    if not is_self_solution and not existing_solution:
        award_points(current_user, 2)
        
    try:
        db.add(new_solution)
        db.commit()
        db.refresh(new_solution)
    except Exception: 
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to save solution to the database")
    
    return {
    "id": new_solution.id,
    "problem_id": new_solution.problem_id,
    "solution_text": new_solution.solution_text, 
    "status": new_solution.status,
    "posted_by": current_user.name,
    "created_at": new_solution.created_at
}

@router.get("/solutions/problem/{problem_id}", response_model=list[SolutionResponse])
def get_solution(problem_id: int, db: Session=Depends(get_db)):
    fnd_problem = db.query(problem.Problem).filter(problem.Problem.id == problem_id).first()
    if not fnd_problem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found")

    # Accepted answer first, then most upvoted, then newest. Reputation
    # deliberately does not affect this order - that was considered and
    # rejected, to avoid burying good answers from new contributors.
    return (
        db.query(solution.Solution)
        .filter(solution.Solution.problem_id == problem_id)
        .filter(solution.Solution.moderation_status != "removed")
        .order_by(
            (solution.Solution.status == "accepted").desc(),
            solution.Solution.upvote_count.desc(),
            solution.Solution.created_at.desc(),
        )
        .all()
    )

@router.patch("/solutions/{solution_id}/accept", response_model=SolutionAccept)
def update_solution(solution_id: int, db: Session = Depends(get_db), current_user: user.User = Depends(get_active_poster)):
    fnd_solution = db.query(solution.Solution).filter(solution.Solution.id == solution_id).first()
    if not fnd_solution:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solution not found")

    fnd_problem = db.query(problem.Problem).filter(problem.Problem.id == fnd_solution.problem_id).first()
    if not fnd_problem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found")

    if fnd_problem.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Problem doesnt belong to this user")
    
    is_self_solve = (
        fnd_solution.user_id == fnd_problem.user_id
    )
        
    previously_accepted = (
        db.query(solution.Solution).filter
        (solution.Solution.problem_id == fnd_problem.id,
         solution.Solution.status == "accepted"
         ,solution.Solution.id != fnd_solution.id).first()
    )
    
    if previously_accepted:
        previously_accepted.status = "pending"
        previous_author = db.query(user.User).filter(user.User.id == previously_accepted.user_id).first()
        if not is_self_solve:
            if previous_author:
                award_points(previous_author, -10)
            
    new_author = db.query(user.User).filter(user.User.id == fnd_solution.user_id).first()
    if not is_self_solve:
        if new_author:
            award_points(new_author, 10)
    
    fnd_solution.status = "accepted"
    fnd_problem.status = "resolved"

    try:
        db.commit()
        db.refresh(fnd_solution)
        db.refresh(fnd_problem)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to accept solution")

    return {
        "status": fnd_solution.status,
        "problem_status": fnd_problem.status
    }
    
@router.patch("/solutions/{solution_id}/unaccept", response_model=SolutionAccept)
def unaccept_solution(solution_id: int, db: Session = Depends(get_db), current_user: user.User = Depends(get_active_poster)):
    fnd_solution = db.query(solution.Solution).filter(solution.Solution.id == solution_id).first()
    if not fnd_solution:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solution not found")
    
    fnd_problem = db.query(problem.Problem).filter(problem.Problem.id == fnd_solution.problem_id).first()
    if not fnd_problem:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found")
    
    if fnd_problem.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Problem doesnt belong to this user")
    
    if fnd_solution.status != "accepted":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail ="This solution isn't currently accepted")
    
    is_self_solve=(
        fnd_problem.user_id == fnd_solution.user_id
    )

    fnd_solution.status = "pending"
    solution_author = db.query(user.User).filter(user.User.id == fnd_solution.user_id).first()
    if not is_self_solve:
        if solution_author:
            award_points(solution_author, -10)
        
    fnd_problem.status = "open"
    
    try:
        db.commit()
        db.refresh(fnd_solution)
        db.refresh(fnd_problem)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to un-accept solution")
        
    return{
        "status": fnd_solution.status,
        "problem_status": fnd_problem.status
        }

@router.post("/solutions/{solution_id}/upvote")
def upvote_solution(solution_id: int, db: Session=Depends(get_db), current_user: user.User=Depends(get_active_poster)):
    fnd_solution = db.query(solution.Solution).filter(solution.Solution.id == solution_id).first()
    if not fnd_solution: 
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solution not found")
    
    existing_upvote = db.query(solution.Upvote).filter(solution.Upvote.user_id == current_user.id, solution.Upvote.solution_id == solution_id).first()
    if existing_upvote:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already upvoted!")
    
    is_self_upvote = (
           fnd_solution.user_id == current_user.id
        )
    
    new_upvote = solution.Upvote(
        user_id = current_user.id,
        solution_id = solution_id
    )
    fnd_solution.upvote_count +=1
    
    solution_author = db.query(user.User).filter(user.User.id == fnd_solution.user_id).first()
    if not is_self_upvote:
        if solution_author:
            award_points(solution_author, 1)
    
    try:
        db.add(new_upvote)
        db.commit()
        db.refresh(new_upvote)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail = "Failed to upvote solution")
    
    return {
        "message": "Upvoted Successfully",
        "upvote_count": fnd_solution.upvote_count
    }