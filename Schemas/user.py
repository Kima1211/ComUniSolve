import re
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, EmailStr, field_validator

from Models.user import SUFFIXES

# Keep in sync with frontend/src/validation.js.
NAME_PATTERN = re.compile(r"[^\W\d_]+(?:[ .'\-]+[^\W\d_]+)*\.?")
MIN_AGE = 13
OLDEST_BIRTH_YEAR = 1900

def _clean_name(value: Optional[str], required: bool) -> Optional[str]:
    value = " ".join((value or "").split())
    if not value:
        if required:
            raise ValueError("This name is required")
        return None
    if not NAME_PATTERN.fullmatch(value):
        raise ValueError("Use letters only (spaces, periods, hyphens and apostrophes are allowed)")
    return value

def age_on(birth: date, today: date) -> int:
    return today.year - birth.year - ((today.month, today.day) < (birth.month, birth.day))

class PersonalInfo(BaseModel):
    first_name: str = Field(..., max_length=100)
    middle_name: Optional[str] = Field(None, max_length=100)
    last_name: str = Field(..., max_length=100)
    suffix: Optional[Literal[tuple(SUFFIXES)]] = None
    birth_date: date
    sex: Optional[Literal["male", "female"]] = None
    region_code: str = Field(..., max_length=10)
    province_code: Optional[str] = Field(None, max_length=10)
    city_code: str = Field(..., max_length=10)
    barangay_code: str = Field(..., max_length=10)
    street: Optional[str] = Field(None, max_length=255)

    @field_validator("first_name", "last_name", mode="before")
    @classmethod
    def required_name(cls, v):
        return _clean_name(v, required=True)

    @field_validator("middle_name", mode="before")
    @classmethod
    def optional_name(cls, v):
        return _clean_name(v, required=False)

    @field_validator("suffix", "sex", "province_code", mode="before")
    @classmethod
    def blank_is_none(cls, v):
        return v or None

    @field_validator("street", mode="before")
    @classmethod
    def clean_street(cls, v):
        return " ".join((v or "").split()) or None

    @field_validator("birth_date")
    @classmethod
    def sensible_birth_date(cls, v: date):
        today = date.today()
        if v > today:
            raise ValueError("Birth date can't be in the future")
        if v.year < OLDEST_BIRTH_YEAR:
            raise ValueError("Please check the birth year")
        if age_on(v, today) < MIN_AGE:
            raise ValueError(f"You must be at least {MIN_AGE} years old")
        return v

class Register(PersonalInfo):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("email")
    @classmethod
    def lowercase_email(cls, v: str):
        return v.strip().lower()

class ProfileUpdate(PersonalInfo):
    pass

class VerifyCode(BaseModel):
    code: str = Field(..., pattern=r"^\d{6}$")

class Deactivate(BaseModel):
    password: str = Field(..., min_length=1, max_length=128)

class Login(BaseModel):
    email: str = Field(..., max_length=255)
    password: str = Field(..., max_length=128)

class ForgotPassword(BaseModel):
    email: EmailStr

    @field_validator("email")
    @classmethod
    def lowercase_email(cls, v: str):
        return v.strip().lower()

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
    is_deleted: bool = False
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
    # Reads shown_status when the API computed one (see shown_status() in Services/moderation.py),
    # otherwise the stored status.
    status: str = Field(validation_alias=AliasChoices("shown_status", "status"))
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

