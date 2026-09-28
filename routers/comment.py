from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from Models.database import get_db
from Security.utils import get_current_user, get_active_poster
from Models import user,solution,comment
from Schemas.comment import CommentIn, CommentEdit, CommentResponse
from Schemas.moderation import ContentCheckResponse
from Services.moderation import run_pre_post_gate

router = APIRouter()


def _check_comment(text: str):
    gate = run_pre_post_gate(None, text, kind="comment")
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
    return gate


# Hidden from everyone: removed by an admin, or deleted by the author.
def _live_comments(query):
    return query.filter(comment.Comment.moderation_status != "removed", comment.Comment.deleted_at.is_(None))

@router.get("/solutions/{solution_id}/comments", response_model=list[CommentResponse])
def get_comments(solution_id: int, db: Session = Depends(get_db)):
    fnd_solution = db.query(solution.Solution).filter(
        solution.Solution.id == solution_id, solution.Solution.deleted_at.is_(None)
    ).first()
    if not fnd_solution:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solution not found")

    return (
        _live_comments(db.query(comment.Comment))
        .filter(comment.Comment.solution_id == solution_id)
        .order_by(comment.Comment.created_at.asc())
        .all()
    )

@router.post("/comment/{solution_id}", response_model=CommentResponse)
def create_comment(solution_id: int,create_comm:CommentIn, db: Session = Depends(get_db), current_user: user.User = Depends(get_active_poster)):
    fnd_solution = db.query(solution.Solution).filter(
        solution.Solution.id == solution_id, solution.Solution.deleted_at.is_(None)
    ).first()
    if not fnd_solution:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail="Solution Not Found!")
    
    if create_comm.parent_id is not None:
        parent_comment = _live_comments(db.query(comment.Comment)).filter(
            comment.Comment.id == create_comm.parent_id
        ).first()
        if not parent_comment:
            raise HTTPException(
                status_code=404, 
                detail="Parent comment not found")
        if parent_comment.parent_id is not None:
            raise HTTPException(
                status_code=400,
                detail="Cannot reply to a reply, only one level of replies allowed")
    
        
    gate = _check_comment(create_comm.content)

    new_comment = comment.Comment(
        user_id = current_user.id,
        solution_id = solution_id,
        parent_id = create_comm.parent_id,
        content = create_comm.content,
        moderation_status = gate.moderation_status,
    )
    try:
        db.add(new_comment)
        db.commit()
        db.refresh(new_comment)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail ="Failed to submit comment")
    
    return new_comment


def _own_comment(comment_id: int, db: Session, current_user):
    fnd_comment = _live_comments(db.query(comment.Comment)).filter(comment.Comment.id == comment_id).first()
    if not fnd_comment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Comment not found")
    if fnd_comment.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only change your own comment")
    return fnd_comment


@router.patch("/comments/{comment_id}", response_model=CommentResponse)
def edit_comment(comment_id: int, body: CommentEdit, db: Session = Depends(get_db), current_user: user.User = Depends(get_active_poster)):
    fnd_comment = _own_comment(comment_id, db, current_user)
    gate = _check_comment(body.content)
    fnd_comment.content = body.content
    # Never un-flag on edit, or a small edit would skip admin review.
    if fnd_comment.moderation_status != "flagged":
        fnd_comment.moderation_status = gate.moderation_status
    fnd_comment.edited_at = datetime.now(timezone.utc)

    try:
        db.commit()
        db.refresh(fnd_comment)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update comment")

    return fnd_comment


@router.delete("/comments/{comment_id}")
def delete_comment(comment_id: int, db: Session = Depends(get_db), current_user: user.User = Depends(get_active_poster)):
    fnd_comment = _own_comment(comment_id, db, current_user)
    fnd_comment.deleted_at = datetime.now(timezone.utc)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to delete comment")

    return {"message": "Comment deleted"}
