from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from Schemas.problem import ProblemOverview
from Models.database import get_db
from Security.utils import get_current_admin
from Models import problem,user,solution


router = APIRouter()

@router.get("/admin/overview", response_model=ProblemOverview) 
def get_problem_overview(db: Session = Depends(get_db), current_user: user.User = Depends(get_current_admin)):
    
    total_users = db.query(user.User).count()
    total_problems = db.query(problem.Problem).count()
    total_solutions = db.query(solution.Solution).count()
    
    
    return {
        "total_users": total_users,
        "total_problems": total_problems,
        "total_solutions": total_solutions,
    }