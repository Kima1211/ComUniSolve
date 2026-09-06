from database import engine, Base
import user, problem, solution, comment,rating

Base.metadata.create_all(bind=engine)
print("Tables created successfully")