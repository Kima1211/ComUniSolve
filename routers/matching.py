import os

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional

from Models.database import get_db
from Models import problem, solution
from Schemas.matching import MatchRequest, MatchResponse, MatchedProblem
from Services.matching import find_similar, build_candidate_pool, SIMILARITY_THRESHOLD, MAX_MATCHES
from Services import gemini

router = APIRouter()

_RELEVANCE_ORDER = {"high": 3, "medium": 2, "low": 1, "none": 0}

AUTO_AI_ON_DETAIL = os.getenv("GEMINI_AUTO_ON_DETAIL", "false").lower() in {"1", "true", "yes"}


def _fetch_candidates(db: Session, exclude_id: Optional[int]):
    query = db.query(problem.Problem)
    if exclude_id is not None:
        query = query.filter(problem.Problem.id != exclude_id)
    rows = query.all()
    candidates = [
        {"id": p.id, "title": p.title, "description": p.description, "category": p.category}
        for p in rows
    ]
    return rows, candidates


def _accepted_solutions(db: Session, problem_ids):
    if not problem_ids:
        return {}
    rows = (
        db.query(solution.Solution)
        .filter(
            solution.Solution.problem_id.in_(problem_ids),
            solution.Solution.status == "accepted",
        )
        .all()
    )
    return {s.problem_id: s for s in rows}


def _build_matches(
    query_title: str,
    query_description: Optional[str],
    db: Session,
    exclude_id: Optional[int] = None,
    use_ai: bool = False,
):
    rows, candidates = _fetch_candidates(db, exclude_id)
    if not candidates:
        return [], False

    by_id = {p.id: p for p in rows}

    tfidf_scores = dict(build_candidate_pool(query_title, query_description, candidates))

    ai_ranked = None
    if use_ai and gemini.is_enabled():
        pool = [c for c in candidates if c["id"] in tfidf_scores]
        ai_ranked = gemini.rerank(query_title, query_description, pool)

    if ai_ranked is not None:
        chosen = [
            (pid, tfidf_scores.get(pid, 0.0), info)
            for pid, info in ai_ranked.items()
        ]
        chosen.sort(key=lambda t: (_RELEVANCE_ORDER.get(t[2]["relevance"], 0), t[1]), reverse=True)
        chosen = chosen[:MAX_MATCHES]
    else:
        chosen = [
            (pid, score, None)
            for pid, score in sorted(tfidf_scores.items(), key=lambda kv: kv[1], reverse=True)
            if score >= SIMILARITY_THRESHOLD
        ][:MAX_MATCHES]

    accepted = _accepted_solutions(db, [pid for pid, _, _ in chosen])

    results = []
    for pid, score, info in chosen:
        p = by_id[pid]
        sol = accepted.get(pid)
        results.append(
            MatchedProblem(
                id=p.id,
                title=p.title,
                description=p.description,
                category=p.category,
                status=p.status,
                score=round(score, 4),
                accepted_solution=sol.solution_text if sol else None,
                relevance=info["relevance"] if info else None,
                reason=info["reason"] if info else None,
            )
        )
    return results, ai_ranked is not None


@router.post("/problems/match", response_model=MatchResponse)
def match_before_posting(body: MatchRequest, db: Session = Depends(get_db)):
    matches, ai_used = _build_matches(body.title, body.description, db, use_ai=False)
    return MatchResponse(matches=matches, ai_used=ai_used)


@router.post("/problems/match/ai", response_model=MatchResponse)
def match_with_ai(body: MatchRequest, db: Session = Depends(get_db)):
    matches, ai_used = _build_matches(body.title, body.description, db, use_ai=True)
    return MatchResponse(matches=matches, ai_used=ai_used)


@router.get("/problems/{problem_id}/similar", response_model=MatchResponse)
def similar_to_problem(problem_id: int, db: Session = Depends(get_db)):
    fnd = db.query(problem.Problem).filter(problem.Problem.id == problem_id).first()
    if not fnd:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found")

    matches, ai_used = _build_matches(
        fnd.title, fnd.description, db, exclude_id=problem_id, use_ai=AUTO_AI_ON_DETAIL
    )
    return MatchResponse(matches=matches, ai_used=ai_used)


@router.get("/problems/{problem_id}/similar/ai", response_model=MatchResponse)
def similar_to_problem_with_ai(problem_id: int, db: Session = Depends(get_db)):
    fnd = db.query(problem.Problem).filter(problem.Problem.id == problem_id).first()
    if not fnd:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found")

    matches, ai_used = _build_matches(
        fnd.title, fnd.description, db, exclude_id=problem_id, use_ai=True
    )
    return MatchResponse(matches=matches, ai_used=ai_used)

