from pydantic import BaseModel, ConfigDict


class AuthorOut(BaseModel):
    """The public face of a user, embedded in problems, solutions and comments.

    Deliberately excludes email, role, is_active and verification state. A
    response schema is what stops a private field leaking - not the intention
    to be careful when writing the endpoint.
    """
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    points: int
    tier: str
