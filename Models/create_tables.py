from Models.database import engine, Base
from Models import user, problem, solution, comment,rating,refresh_token

Base.metadata.create_all(bind=engine)
print("Tables created successfully")