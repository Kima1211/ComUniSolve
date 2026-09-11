import bcrypt
import os 
from jose import jwt, JWTError , ExpiredSignatureError
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import Depends, HTTPException, status, Request, Response
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from Models.database import get_db
import Models.user as db_models
import secrets
import hashlib
from Models.refresh_token import RefreshToken


load_dotenv()

PEPPER = os.getenv("PASSWORD_PEPPER")
if not PEPPER: 
    raise RuntimeError("PASSWORD_PEPPER is not set in environment!")

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY is not set in environment!")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 30

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


def hash_password(password: str) -> str:
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")
    
    pepper  = password + PEPPER[:72]
    
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(pepper.encode("utf-8"),salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    peppered = plain_password + PEPPER[:72]
    return bcrypt.checkpw(peppered.encode("utf-8"), hashed_password.encode("utf-8"))


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=15)
        
    to_encode.update({"exp": expire})
    
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def issue_auth_cookie(response: Response, user) -> None:
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
            data={"sub":  user.email},
            expires_delta=access_token_expires
        )
    response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            samesite="lax",
            secure=False,
            max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60
        )

def issue_refresh_token(response: Response, user, db: Session) -> str:
    token =  secrets.token_urlsafe(32)
    hashed_token = hashlib.sha256(token.encode('utf-8')).hexdigest()

    
    db_token = RefreshToken(
        user_id=user.id,
        token_hash=hashed_token,
    )
    db.add(db_token)
    db.commit()
    
    response.set_cookie(
        key="refresh_token",
        value=token,
        httponly=True,
        secure=False, 
        samesite="lax",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60
    )
    return token
    

def decode_token(token: str) -> Optional[str]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str = payload.get("sub")
        
        if email is None:
            return None
        return email
    
    except ExpiredSignatureError:
        return None
    except JWTError:
        return None


def get_current_user(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get("access_token")
    
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            )

    email = decode_token(token)
    user = db.query(db_models.User).filter(db_models.User.email == email).first()
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found")
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive")
    return user

def get_current_admin(current_user: db_models.User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You are not an admin")
    return current_user

#not for good practice avoid this
"""def hash_password(password: str) -> str:
    # SHA-256 produces 64 hex chars (always under 72 bytes)
    pwd = hashlib.sha256(password.encode("utf-8")).hexdigest()
    return bcrypt.hashpw(pwd.encode("utf-8"),bcrypt.gensalt(rounds=12)).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    pwd_verify = hashlib.sha256(plain_password.encode("utf-8")).hexdigest()
    return bcrypt.checkpw(pwd_verify.encode("utf-8"), hashed_password.encode("utf-8"))"""
