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
from Models.user import User
from Services.reputation import is_currently_suspended


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
    
    peppered = password + PEPPER
    pre_hashed = hashlib.sha256(peppered.encode("utf-8")).hexdigest()
    
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(pre_hashed.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    peppered = plain_password + PEPPER
    pre_hashed = hashlib.sha256(peppered.encode("utf-8")).hexdigest()
    return bcrypt.checkpw(pre_hashed.encode("utf-8"), hashed_password.encode("utf-8"))

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

def revoke_refresh_token(raw_token: str, db: Session) -> bool:
    """Delete the refresh_tokens row matching this raw cookie value.

    Returns True if a row was actually deleted. Mirrors issue_refresh_token:
    the hashing rule lives in exactly one place, next to the function that
    created the hash in the first place.
    """
    hashed_token = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    db_token = db.query(RefreshToken).filter(RefreshToken.token_hash == hashed_token).first()

    if db_token is None:
        return False

    db.delete(db_token)
    db.commit()
    return True

def clear_auth_cookies(response: Response) -> None:
    """Remove both session cookies from the browser.

    The delete_cookie arguments must match how the cookies were set in
    issue_auth_cookie / issue_refresh_token, or the browser treats them as
    different cookies and silently keeps the originals.
    """
    response.delete_cookie(key="access_token", httponly=True, samesite="lax", secure=False)
    response.delete_cookie(key="refresh_token", httponly=True, samesite="lax", secure=False)

def issue_verification_token(user, db:Session) -> str:
    token = secrets.token_urlsafe(32)
    hashed_token = hashlib.sha256(token.encode('utf-8')).hexdigest()
    
    user.verification_token_hash = hashed_token
    user.verification_token_expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

    db.commit()
    
    return token

def decode_token(token: str) -> str:
    """Return the email stored in the token's `sub` claim.

    Raises ExpiredSignatureError if the token is past its `exp`, and JWTError
    for anything else wrong with it (bad signature, malformed, missing `sub`).
    Callers decide what HTTP status those mean - this function only knows tokens.
    """
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    email = payload.get("sub")

    if email is None:
        raise JWTError("Token has no 'sub' claim")
    return email


def get_current_user(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get("access_token")

    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            )

    try:
        email = decode_token(token)
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Access token expired")
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid access token")

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

def get_verified_user(current_user: db_models.User = Depends(get_current_user)):
    if not current_user.is_verified:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Please verify your email before posting")
    return current_user


def get_active_poster(current_user: db_models.User = Depends(get_verified_user)):
    """A verified user who is not currently suspended.

    Every endpoint that WRITES something - posting, solving, commenting,
    upvoting, rating, reporting - depends on this. Reading is deliberately
    left alone: a suspended user can still browse and still see why they were
    suspended, which is kinder and easier to explain than a blanket lockout.

    Note it calls is_currently_suspended() rather than reading is_suspended.
    Suspensions expire lazily, so the flag alone goes stale the moment an end
    date passes.
    """
    if is_currently_suspended(current_user):
        until = current_user.suspended_until
        when = f" until {until:%d %b %Y}" if until else ""
        reason = f" Reason: {current_user.suspension_reason}" if current_user.suspension_reason else ""
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Your account is suspended{when}.{reason}",
        )
    return current_user


#not for good practice avoid this
"""def hash_password(password: str) -> str:
    # SHA-256 produces 64 hex chars (always under 72 bytes)
    pwd = hashlib.sha256(password.encode("utf-8")).hexdigest()
    return bcrypt.hashpw(pwd.encode("utf-8"),bcrypt.gensalt(rounds=12)).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    pwd_verify = hashlib.sha256(plain_password.encode("utf-8")).hexdigest()
    return bcrypt.checkpw(pwd_verify.encode("utf-8"), hashed_password.encode("utf-8"))"""
