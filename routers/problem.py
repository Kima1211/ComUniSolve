from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from Schemas.problem import ProblemCreate, ProblemResponse
from Schemas.moderation import ContentCheckRequest, ContentCheckResponse
from Models.database import get_db
from Security.utils import get_current_user, get_verified_user, get_active_poster
from Models import problem, user, solution
from Services.moderation import run_pre_post_gate
from Services import images

router = APIRouter()


def _gate_to_response(result) -> dict:
    return ContentCheckResponse(
        verdict=result.verdict,
        blocked=result.blocked,
        acknowledgeable=result.acknowledgeable,
        message=result.message,
        matched_terms=result.matched_terms,
        suggestion=result.suggestion,
    ).model_dump()


def _visible(query):
    """Removed content disappears from every public listing.

    It is a soft delete - the row is still there for the audit trail - so the
    filter has to be applied deliberately everywhere the public reads.
    """
    return query.filter(problem.Problem.moderation_status != "removed")

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
    query = _visible(db.query(problem.Problem))

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
    fnd_prob = _visible(db.query(problem.Problem)).filter(problem.Problem.id == problem_id).first()

    if not fnd_prob:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Problem with id {problem_id} not found"
    )
    _attach_solution_counts([fnd_prob], db)
    return fnd_prob

@router.post("/problems/check", response_model=ContentCheckResponse)
def check_problem_text(
    body: ContentCheckRequest,
    current_user: user.User = Depends(get_active_poster),
):
    """Run the pre-post gate without creating anything.

    Objective 3 says the AI evaluates posts "before they are submitted by the
    user", so the form can call this and show the result while they are still
    editing. POST /problems runs the same gate again server-side - this
    endpoint is a convenience for the UI, never the enforcement point.
    """
    return _gate_to_response(run_pre_post_gate(body.title, body.text))


@router.post("/problems", status_code=status.HTTP_201_CREATED)
def create_problem(prob: ProblemCreate, db: Session = Depends(get_db), current_user: user.User = Depends(get_active_poster)):
    gate = run_pre_post_gate(prob.title, prob.description or "", acknowledged=prob.acknowledged)

    if gate.blocked:
        # 422: the request was understood and is well-formed, but its content
        # is not acceptable. The body carries the reason and the suggested
        # rewrite so the user can fix it and try again.
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=_gate_to_response(gate),
        )

    new_problem = problem.Problem(
        user_id=current_user.id,
        title=prob.title,
        description=prob.description,
        category=prob.category,
        ai_status=gate.verdict,
        moderation_status=gate.moderation_status,
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


@router.post("/problems/{problem_id}/image")
def upload_problem_image(
    problem_id: int,
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: user.User = Depends(get_active_poster),
):
    """Attach the one supporting image to a problem the user just posted.

    A separate step from POST /problems on purpose: that endpoint carries the
    moderation gate and its "post anyway" flow, and mixing a file into it would
    mean rewriting working code. The frontend calls this right after a
    successful post.
    """
    if not images.is_configured():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Image upload is not available right now")

    fnd_prob = _visible(db.query(problem.Problem)).filter(problem.Problem.id == problem_id).first()
    if not fnd_prob:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Problem with id {problem_id} not found")

    if fnd_prob.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You can only add an image to your own problem")

    # One image per problem (scope). Replacing one belongs to editing posts,
    # which is not built yet.
    if fnd_prob.image_url:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This problem already has an image")

    # Read one byte past the limit: if that byte exists, the file is too big.
    # This way an oversized file is never held in memory in full.
    data = image.file.read(images.MAX_IMAGE_BYTES + 1)
    if len(data) > images.MAX_IMAGE_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Image must be 5 MB or smaller")

    if images.detect_image_type(data) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Image must be a JPG, PNG or WebP file")

    url = images.upload_image(data, image.filename or "image")
    if url is None:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail="Could not upload the image. Please try again.")

    fnd_prob.image_url = url
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to save the image")

    return {"image_url": url}

