from fastapi import FastAPI
from routers import  problem, rating, solution, user,comment

app = FastAPI()

app.include_router(rating.router)
app.include_router(solution.router)
app.include_router(user.router)
app.include_router(problem.router)
app.include_router(comment.router)

@app.get("/")
def hello():
    return {
        "message": "Works! Hehe"
    } 