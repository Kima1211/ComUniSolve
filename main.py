from fastapi import FastAPI
from routers import  problem, rating, solution, user,comment,admin,auth
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.include_router(rating.router)
app.include_router(solution.router)
app.include_router(user.router)
app.include_router(problem.router)
app.include_router(comment.router)
app.include_router(admin.router)
app.include_router(auth.router)

@app.get("/")
def hello():
    return {
        "message": "Works! Hehe"
    } 
    
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["GET","POST","PATCH","DELETE" ],
    allow_headers=["Content-Type", "Authorization"],
)