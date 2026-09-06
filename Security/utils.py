import bcrypt
import os 
from jose import jwt, JWTError , ExpiredSignatureError
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from dotenv import load_dotenv
from Database.database import get_db
import Database.db_models as db_models

load_dotenv()

PEPPER = os.getenv("PASSWORD_PEPPER")
if not PEPPER: 
    raise RuntimeError("PASSWORD_PEPPER is not set in environment!")

SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY is not set in environment!")

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")


def hash_password(password: str) -> str:
    if len(password) < 8:
        raise ValueError("Password must be at least 8 characters")
    
    pepper  = password + PEPPER[:72]
    
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(pepper.encode("utf-8"),salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    peppered = plain_password + PEPPER
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


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    email = decode_token(token)
    
    if email is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"}
            )

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





#not for good practice avoid this
"""def hash_password(password: str) -> str:
    # SHA-256 produces 64 hex chars (always under 72 bytes)
    pwd = hashlib.sha256(password.encode("utf-8")).hexdigest()
    return bcrypt.hashpw(pwd.encode("utf-8"),bcrypt.gensalt(rounds=12)).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    pwd_verify = hashlib.sha256(plain_password.encode("utf-8")).hexdigest()
    return bcrypt.checkpw(pwd_verify.encode("utf-8"), hashed_password.encode("utf-8"))"""
