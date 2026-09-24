from pydantic import BaseModel, ConfigDict


class AuthorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    points: int
    tier: str

