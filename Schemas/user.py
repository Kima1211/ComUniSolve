from pydantic import BaseModel, Field, EmailStr

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

