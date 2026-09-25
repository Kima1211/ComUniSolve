from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field, EmailStr

class Register(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(..., min_length=8,max_length=128)

class DeleteUser(BaseModel):
    user_password: str

class Login(BaseModel):
    email: str
    password: str

class ForgotPassword(BaseModel):
    email: EmailStr

class ResetPassword(BaseModel):
    token: str = Field(..., min_length=1, max_length=255)
    new_password: str = Field(..., min_length=8, max_length=128)

class AdminUserRow(BaseModel):
    id: int
    name: str
    email: str
    role: str
    points: int
    tier: str
    is_verified: bool
    is_active: bool
    is_suspended: bool
    suspended_until: Optional[datetime] = None
    suspension_reason: Optional[str] = None
    created_at: Optional[datetime] = None
    problem_count: int = 0
    solution_count: int = 0
    removal_count: int = 0

class AdminUserList(BaseModel):
    total: int
    users: list[AdminUserRow]

class ProfileProblem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    category: str
    status: str
    created_at: Optional[datetime] = None

class ProfileSolution(BaseModel):
    id: int
    problem_id: int
    problem_title: str
    solution_text: str
    status: str
    created_at: Optional[datetime] = None

# Public on purpose: never add email, suspension or token fields here.
class UserProfile(BaseModel):
    id: int
    name: str
    points: int
    tier: str
    created_at: Optional[datetime] = None
    problem_count: int
    solution_count: int
    accepted_count: int
    problems: list[ProfileProblem]
    solutions: list[ProfileSolution]

