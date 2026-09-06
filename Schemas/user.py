from pydantic import BaseModel, Field
from typing import Optional

class Register(BaseModel):
    name: str
    email: str
    password: str = Field(..., max_length=72)
    location: Optional[str] = None

class DeleteUser(BaseModel):
    user_password: str

class Login(BaseModel):
    email: str
    password: str
