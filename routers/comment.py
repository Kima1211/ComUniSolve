from fastapi import APIRouter, HTTPException, status, Depends
from sqlalchemy.orm import Session
from Models.database import get_db
from Security.utils import get_current_user
from Models import problem,user,solution,comment
from Schemas.comment import CommentEdit,CommentIn,CommentResponse

router = APIRouter()

@router.post("/comment/{solution_id}", response_model=CommentResponse)
def create_comment(solution_id: int,create_comm:CommentIn, db: Session = Depends(get_db), current_user: user.User = Depends(get_current_user)):
    fnd_solution = db.query(solution.Solution).filter(solution.Solution.id == solution_id).first()
    if not fnd_solution:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND,detail="Solution Not Found!")
    
    if create_comm.parent_id is not None:
        parent_comment = db.query(comment.Comment).filter(comment.Comment.id == create_comm.parent_id).first()
        if not parent_comment:
            raise HTTPException(
                status_code=404, 
                detail="Parent comment not found")
        if parent_comment.parent_id is not None:
            raise HTTPException(
                status_code=400,
                detail="Cannot reply to a reply, only one level of replies allowed")
    
        
    new_comment = comment.Comment(
        user_id = current_user.id,
        solution_id = solution_id,
        parent_id = create_comm.parent_id,
        content = create_comm.content
    )
    try:
        db.add(new_comment)
        db.commit()
        db.refresh(new_comment)
    except Exception:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail ="Failed to submit comment")
    
    return new_comment