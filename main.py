import os
from dotenv import load_dotenv
from fastapi import FastAPI
from routers import  problem, rating, solution, user,comment,admin,auth,report,matching
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

SHOW_API_DOCS = os.getenv("SHOW_API_DOCS", "true").lower() == "true"

app = FastAPI(
    docs_url="/docs" if SHOW_API_DOCS else None,
    redoc_url="/redoc" if SHOW_API_DOCS else None,
    openapi_url="/openapi.json" if SHOW_API_DOCS else None,
)

app.include_router(rating.router)
app.include_router(solution.router)
app.include_router(user.router)
app.include_router(problem.router)
app.include_router(comment.router)
app.include_router(admin.router)
app.include_router(auth.router)
app.include_router(matching.router)
app.include_router(report.router)

@app.api_route("/", methods=["GET", "HEAD"], include_in_schema=False)
def hello():
    return {
        "message": "Works! Hehe"
    } 
    
app.add_middleware(
    CORSMiddleware,
    allow_origins=[os.getenv("FRONTEND_URL", "http://localhost:5173")],
    allow_credentials=True,
    allow_methods=["GET","POST","PATCH","DELETE" ],
    allow_headers=["Content-Type", "Authorization"],
)
