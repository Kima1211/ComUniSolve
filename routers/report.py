from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from Models.database import get_db
from Models.report import Report
from Models import problem as problem_models, solution as solution_models, user as user_models
from Models import comment as comment_models
from Schemas.report import ReportCreate, ReportResponse
from Security.utils import get_active_poster
from Services.errors import api_error

router = APIRouter()


@router.post("/reports", response_model=ReportResponse, status_code=status.HTTP_201_CREATED)
def create_report(
    body: ReportCreate,
    db: Session = Depends(get_db),
    current_user: user_models.User = Depends(get_active_poster),
):
    if body.problem_id is not None:
        target = (
            db.query(problem_models.Problem)
            .filter(problem_models.Problem.id == body.problem_id)
            .first()
        )
        if not target or target.moderation_status == "removed" or target.deleted_at is not None:
            raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "Problem not found")
    elif body.solution_id is not None:
        target = (
            db.query(solution_models.Solution)
            .filter(solution_models.Solution.id == body.solution_id)
            .first()
        )
        if not target or target.moderation_status == "removed" or target.deleted_at is not None:
            raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "Solution not found")
    else:
        target = (
            db.query(comment_models.Comment)
            .filter(comment_models.Comment.id == body.comment_id)
            .first()
        )
        if not target or target.moderation_status == "removed" or target.deleted_at is not None:
            raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "Comment not found")

    new_report = Report(
        user_id=current_user.id,
        problem_id=body.problem_id,
        solution_id=body.solution_id,
        comment_id=body.comment_id,
        reason=body.reason,
        details=body.details,
    )

    try:
        db.add(new_report)
        db.commit()
        db.refresh(new_report)
    except IntegrityError:
        db.rollback()
        raise api_error(status.HTTP_409_CONFLICT, "already_reported", "You have already reported this.")
    except Exception:
        db.rollback()
        raise api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, "server_error", "Failed to submit report")

    return new_report

