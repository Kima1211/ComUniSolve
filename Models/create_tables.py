from Models.database import engine, Base
from Models import user, problem, solution, comment, rating, refresh_token, report, moderation_log, audit_log  # noqa: F401

Base.metadata.create_all(bind=engine)
print("Tables created successfully")
