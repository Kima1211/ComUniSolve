from pydantic import BaseModel, Field, EmailStr
from typing import Optional

class Register(BaseModel):
    name: str
    email: EmailStr
    password: str = Field(..., min_length=8,max_length=72)

class DeleteUser(BaseModel):
    user_password: str

class Login(BaseModel):
    email: str
    password: str
