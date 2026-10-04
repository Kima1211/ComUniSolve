from datetime import datetime, timezone
from fastapi import HTTPException, APIRouter, status, Depends
from sqlalchemy.orm import Session
from Schemas.solution import SolutionCreate, SolutionEdit, SolutionResponse, SolutionAccept
from Models.database import get_db
from Models import solution,problem,user
from Security.utils import get_current_user, get_verified_user, get_active_poster, get_optional_user
from Services.reputation import award_points
from Services.rating import poster_ratings, clear_ratings
from Services.moderation import run_pre_post_gate, removed_with_penalty
from Schemas.moderation import ContentCheckResponse
from Services.errors import api_error
from Services.notifications import notify, withdraw_unread_accept

router = APIRouter()

def _problem_context(fnd_problem) -> str:
    if fnd_problem is None:
        return ""
    return f"Title: {fnd_problem.title}\nDescription: {(fnd_problem.description or '')[:500]}"

@router.post("/solutions", status_code=status.HTTP_201_CREATED)
def create_solution(solution_create: SolutionCreate, db: Session = Depends(get_db), current_user: user.User = Depends(get_active_poster)):
    fnd_problem = db.query(problem.Problem).filter(
        problem.Problem.id == solution_create.problem_id,
        problem.Problem.deleted_at.is_(None),
        problem.Problem.moderation_status != "removed",
    ).first()
     
    if not fnd_problem:
        raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "Problem not found")

    existing_solution = db.query(solution.Solution).filter(solution.Solution.user_id == current_user.id, solution.Solution.problem_id == fnd_problem.id).first()
    
    gate = run_pre_post_gate(None, solution_create.solution_text,
                             acknowledged=solution_create.acknowledged, kind="solution",
                             context=_problem_context(fnd_problem))
    if gate.blocked:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=ContentCheckResponse(
                verdict=gate.verdict,
                code=gate.code,
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
        db.flush()
        notify(db, fnd_problem.user_id, current_user.id, "new_solution", fnd_problem.id, new_solution.id)
        db.commit()
        db.refresh(new_solution)
    except Exception: 
        db.rollback()
        raise api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, "server_error", "Failed to save solution to the database")
    
    return {
    "id": new_solution.id,
    "problem_id": new_solution.problem_id,
    "solution_text": new_solution.solution_text, 
    "status": new_solution.status,
    "posted_by": current_user.name,
    "created_at": new_solution.created_at
}

@router.get("/solutions/problem/{problem_id}", response_model=list[SolutionResponse])
def get_solution(problem_id: int, db: Session=Depends(get_db), viewer=Depends(get_optional_user)):
    fnd_problem = db.query(problem.Problem).filter(problem.Problem.id == problem_id).first()
    if not fnd_problem:
        raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "Problem not found")

    solutions = (
        db.query(solution.Solution)
        .filter(solution.Solution.problem_id == problem_id)
        .filter(solution.Solution.moderation_status != "removed", solution.Solution.deleted_at.is_(None))
        .order_by(
            (solution.Solution.status == "accepted").desc(),
            solution.Solution.upvote_count.desc(),
            solution.Solution.created_at.desc(),
        )
        .all()
    )
    stars = poster_ratings(db, [s.id for s in solutions])
    mine = set()
    if viewer:
        mine = {sid for (sid,) in db.query(solution.Upvote.solution_id).filter(
            solution.Upvote.user_id == viewer.id,
            solution.Upvote.solution_id.in_([s.id for s in solutions] or [-1]),
        )}
    for s in solutions:
        s.rating = stars.get(s.id)
        s.upvoted = s.id in mine
    return solutions

@router.patch("/solutions/{solution_id}/accept", response_model=SolutionAccept)
def update_solution(solution_id: int, db: Session = Depends(get_db), current_user: user.User = Depends(get_active_poster)):
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
        raise api_error(status.HTTP_403_FORBIDDEN, "not_owner", "Problem doesnt belong to this user")

    # A repeated accept (double tap, retry) must not pay the +10 again or clear the rating.
    if fnd_solution.status == "accepted":
        return {
            "status": fnd_solution.status,
            "problem_status": fnd_problem.status
        }

    incoming_is_self_solve = (
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
        clear_ratings(db, previously_accepted.id)
        outgoing_is_self_solve = previously_accepted.user_id == fnd_problem.user_id
        # Its author already lost 15 for the removal; taking the 10 too would punish them twice.
        outgoing_already_penalized = removed_with_penalty(db, previously_accepted, "solution")
        previous_author = db.query(user.User).filter(user.User.id == previously_accepted.user_id).first()
        if not outgoing_is_self_solve and not outgoing_already_penalized:
            if previous_author:
                award_points(previous_author, -10)

    new_author = db.query(user.User).filter(user.User.id == fnd_solution.user_id).first()
    if not incoming_is_self_solve:
        if new_author:
            award_points(new_author, 10)
    
    clear_ratings(db, fnd_solution.id)
    fnd_solution.status = "accepted"
    fnd_problem.status = "resolved"
    notify(db, fnd_solution.user_id, current_user.id, "solution_accepted", fnd_problem.id, fnd_solution.id)

    try:
        db.commit()
        db.refresh(fnd_solution)
        db.refresh(fnd_problem)
    except Exception:
        db.rollback()
        raise api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, "server_error", "Failed to accept solution")

    return {
        "status": fnd_solution.status,
        "problem_status": fnd_problem.status
    }
    
@router.patch("/solutions/{solution_id}/unaccept", response_model=SolutionAccept)
def unaccept_solution(solution_id: int, db: Session = Depends(get_db), current_user: user.User = Depends(get_active_poster)):
    fnd_solution = db.query(solution.Solution).filter(solution.Solution.id == solution_id).first()
    if not fnd_solution:
        raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "Solution not found")
    
    fnd_problem = db.query(problem.Problem).filter(problem.Problem.id == fnd_solution.problem_id).first()
    if not fnd_problem:
        raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "Problem not found")
    
    if fnd_problem.user_id != current_user.id:
        raise api_error(status.HTTP_403_FORBIDDEN, "not_owner", "Problem doesnt belong to this user")
    
    if fnd_solution.status != "accepted":
        raise api_error(status.HTTP_400_BAD_REQUEST, "not_accepted", "This solution isn't currently accepted")
    
    is_self_solve=(
        fnd_problem.user_id == fnd_solution.user_id
    )

    fnd_solution.status = "pending"
    clear_ratings(db, fnd_solution.id)
    withdraw_unread_accept(db, fnd_solution.id)
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
        raise api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, "server_error", "Failed to un-accept solution")
        
    return{
        "status": fnd_solution.status,
        "problem_status": fnd_problem.status
        }

@router.post("/solutions/{solution_id}/upvote")
def upvote_solution(solution_id: int, db: Session=Depends(get_db), current_user: user.User=Depends(get_active_poster)):
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
    
    existing_upvote = db.query(solution.Upvote).filter(solution.Upvote.user_id == current_user.id, solution.Upvote.solution_id == solution_id).first()
    point = 0 if fnd_solution.user_id == current_user.id else 1

    solution_author = db.query(user.User).filter(user.User.id == fnd_solution.user_id).first()
    if existing_upvote:
        db.delete(existing_upvote)
        fnd_solution.upvote_count = max(0, fnd_solution.upvote_count - 1)
        if solution_author:
            award_points(solution_author, -point)
    else:
        db.add(solution.Upvote(user_id=current_user.id, solution_id=solution_id))
        fnd_solution.upvote_count += 1
        if solution_author:
            award_points(solution_author, point)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, "server_error", "Failed to upvote solution")

    return {
        "upvoted": existing_upvote is None,
        "upvote_count": fnd_solution.upvote_count
    }

def _own_solution(solution_id: int, db: Session, current_user):
    fnd_solution = (
        db.query(solution.Solution)
        .filter(
            solution.Solution.id == solution_id,
            solution.Solution.moderation_status != "removed",
            solution.Solution.deleted_at.is_(None),
        )
        .first()
    )
    if not fnd_solution:
        raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "Solution not found")
    if fnd_solution.user_id != current_user.id:
        raise api_error(status.HTTP_403_FORBIDDEN, "not_owner", "You can only change your own solution")
    return fnd_solution

@router.patch("/solutions/{solution_id}", response_model=SolutionResponse)
def edit_solution(
    solution_id: int,
    body: SolutionEdit,
    db: Session = Depends(get_db),
    current_user: user.User = Depends(get_active_poster),
):
    fnd_solution = _own_solution(solution_id, db, current_user)

    fnd_problem = db.query(problem.Problem).filter(problem.Problem.id == fnd_solution.problem_id).first()
    gate = run_pre_post_gate(None, body.solution_text, acknowledged=body.acknowledged, kind="solution",
                             context=_problem_context(fnd_problem))
    if gate.blocked:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=ContentCheckResponse(
                verdict=gate.verdict,
                code=gate.code,
                blocked=gate.blocked,
                acknowledgeable=gate.acknowledgeable,
                message=gate.message,
                matched_terms=gate.matched_terms,
                suggestion=gate.suggestion,
            ).model_dump(),
        )

    fnd_solution.solution_text = body.solution_text
    fnd_solution.ai_status = gate.verdict
    # Never un-flag on edit, or a small edit would skip admin review.
    if fnd_solution.moderation_status != "flagged":
        fnd_solution.moderation_status = gate.moderation_status
    fnd_solution.edited_at = datetime.now(timezone.utc)

    try:
        db.commit()
        db.refresh(fnd_solution)
    except Exception:
        db.rollback()
        raise api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, "server_error", "Failed to update solution")

    return fnd_solution

@router.delete("/solutions/{solution_id}")
def delete_solution(
    solution_id: int,
    db: Session = Depends(get_db),
    current_user: user.User = Depends(get_active_poster),
):
    fnd_solution = _own_solution(solution_id, db, current_user)

    # The problem owner relied on it, so an accepted solution can only be edited.
    if fnd_solution.status == "accepted":
        raise api_error(status.HTTP_400_BAD_REQUEST, "accepted_cant_delete", "An accepted solution can't be deleted. You can still edit it.")

    fnd_problem = db.query(problem.Problem).filter(problem.Problem.id == fnd_solution.problem_id).first()

    # Take back exactly what create_solution and upvote_solution gave for this solution.
    points_to_reverse = 0
    earlier_solution = (
        db.query(solution.Solution.id)
        .filter(
            solution.Solution.user_id == current_user.id,
            solution.Solution.problem_id == fnd_solution.problem_id,
            solution.Solution.id < fnd_solution.id,
        )
        .first()
    )
    is_self_solution = fnd_problem is not None and fnd_problem.user_id == current_user.id
    if not is_self_solution and earlier_solution is None:
        points_to_reverse += 2

    points_to_reverse += (
        db.query(solution.Upvote)
        .filter(solution.Upvote.solution_id == fnd_solution.id, solution.Upvote.user_id != current_user.id)
        .count()
    )

    award_points(current_user, -points_to_reverse)
    fnd_solution.deleted_at = datetime.now(timezone.utc)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, "server_error", "Failed to delete solution")

    return {"message": "Solution deleted", "points_reversed": points_to_reverse}
