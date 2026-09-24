import os
from dotenv import load_dotenv
from fastapi import FastAPI
from routers import  problem, rating, solution, user,comment,admin,auth,report,matching
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

app = FastAPI()

app.include_router(rating.router)
app.include_router(solution.router)
app.include_router(user.router)
app.include_router(problem.router)
app.include_router(comment.router)
app.include_router(admin.router)
app.include_router(auth.router)
app.include_router(matching.router)
app.include_router(report.router)

@app.get("/")
def hello():
    return {
        "message": "Works! Hehe"
    } 
    
app.add_middleware(
    CORSMiddleware,
    # Locally this is http://localhost:5173. In production the frontend reaches
    # the backend through Vercel's /api proxy (same origin), so CORS is not
    # used there - but reading it from .env keeps both setups working.
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["GET","POST","PATCH","DELETE" ],
    allow_headers=["Content-Type", "Authorization"],
)