from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from Models.database import get_db
from Models.report import Report
from Models import problem as problem_models, solution as solution_models, user as user_models
from Schemas.report import ReportCreate, ReportResponse
from Security.utils import get_active_poster

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
        if not target or target.moderation_status == "removed":
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Problem not found")
    else:
        target = (
            db.query(solution_models.Solution)
            .filter(solution_models.Solution.id == body.solution_id)
            .first()
        )
        if not target or target.moderation_status == "removed":
            raise HTTPException(status.HTTP_404_NOT_FOUND, detail="Solution not found")

    new_report = Report(
        user_id=current_user.id,
        problem_id=body.problem_id,
        solution_id=body.solution_id,
        reason=body.reason,
        details=body.details,
    )

    try:
        db.add(new_report)
        db.commit()
        db.refresh(new_report)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already reported this.",
        )
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit report",
        )

    return new_report

