from Models.database import engine, Base
from Models import user, problem, solution, comment,rating

Base.metadata.create_all(bind=engine)
print("Tables created successfully")