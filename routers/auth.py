from fastapi import APIRouter, HTTPException, status, Depends, Request, Response
from sqlalchemy.orm import Session
from Models.database import get_db
import hashlib
from Models.refresh_token import RefreshToken
from datetime import datetime, timezone
from datetime import timedelta
from Security.utils import (
    issue_auth_cookie,
    issue_refresh_token,
    revoke_refresh_token,
    clear_auth_cookies,
    issue_verification_token,
    issue_password_reset_token,
    revoke_all_refresh_tokens,
    hash_password,
    get_current_user,
    PASSWORD_RESET_EXPIRE_MINUTES,
)
from Models.user import User
from Schemas.user import ForgotPassword, ResetPassword
from Services.email import send_verification_email, send_password_reset_email
from Security.rate_limit import FORGOT_PASSWORD_PER_IP, client_ip, enforce

router = APIRouter()

RESEND_COOLDOWN = timedelta(seconds=60)

ROTATION_GRACE = timedelta(seconds=30)


@router.post("/resend-verification")
def resend_verification(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This account is already verified",
        )

    expires_at = current_user.verification_token_expires_at
    if expires_at is not None:
        issued_at = expires_at - timedelta(hours=24)
        if datetime.now(timezone.utc) - issued_at < RESEND_COOLDOWN:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Please wait a minute before requesting another email",
            )

    token = issue_verification_token(current_user, db)
    if not send_verification_email(current_user.email, current_user.name, token):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="We couldn't send the email right now. Please try again in a minute.",
        )

    return {"message": f"Verification email sent to {current_user.email}"}

@router.post("/refresh")
def refresh_token(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get("refresh_token")
    
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing",
        )
    
    hashed_token = hashlib.sha256(token.encode('utf-8')).hexdigest()
    db_token = db.query(RefreshToken).filter(RefreshToken.token_hash == hashed_token).first()
    
    if db_token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
        )
    
    current_time = datetime.now(timezone.utc)
    db_expires_at = db_token.expires_at
    
    if current_time >= db_expires_at:
        db.delete(db_token)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token has expired",
        )
    
    # A replaced token coming back means it was copied: end every session (30s grace for two tabs).
    if db_token.revoked_at is not None:
        if current_time - db_token.revoked_at <= ROTATION_GRACE:
            return {"message": "Token Refreshed"}

        revoke_all_refresh_tokens(db_token.user_id, db)
        db.commit()
        clear_auth_cookies(response)
        print(f"[AUTH] reused refresh token for user_id={db_token.user_id} - all sessions revoked")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Your session has ended for security reasons. Please sign in again.",
        )

    user = db.query(User).filter(User.id == db_token.user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User associated with token not found",
        )

    if not user.is_active:
        db.delete(db_token)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive",
        )

    db_token.revoked_at = current_time
    
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user.id,
        RefreshToken.expires_at < current_time,
    ).delete()

    issue_refresh_token(response, user, db)
    issue_auth_cookie(response, user)

    return {"message": "Token Refreshed"}

@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get("refresh_token")

    if token is not None:
        revoke_refresh_token(token, db)

    clear_auth_cookies(response)

    return {"message": "Logged out"}

@router.get("/verify/{token}")
def verify_email(token: str, db: Session = Depends(get_db)):
    hashed_token = hashlib.sha256(token.encode('utf-8')).hexdigest()
    
    db_user = db.query(User).filter(User.verification_token_hash == hashed_token).first()
    
    if db_user is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail = "Invalid verification token")

    if db_user.is_verified:
        return {"message": "Email verified successfully"}

    current_time = datetime.now(timezone.utc)
    if db_user.verification_token_expires_at is None or current_time >= db_user.verification_token_expires_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification token has expired")

    db_user.is_verified=True

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to verify account")
    
    return {"message": "Email verified successfully"}


# Same answer for every email, so nobody can check which emails have accounts.
FORGOT_PASSWORD_MESSAGE = "If an account exists for that email, we sent a link to reset the password."


@router.post("/forgot-password")
def forgot_password(body: ForgotPassword, request: Request, db: Session = Depends(get_db)):
    enforce(FORGOT_PASSWORD_PER_IP, client_ip(request),
            "Too many reset requests from your network. Please try again in 15 minutes.")

    db_user = db.query(User).filter(User.email == body.email).first()

    if db_user is None or not db_user.is_active:
        return {"message": FORGOT_PASSWORD_MESSAGE}

    expires_at = db_user.password_reset_expires_at
    if expires_at is not None:
        issued_at = expires_at - timedelta(minutes=PASSWORD_RESET_EXPIRE_MINUTES)
        if datetime.now(timezone.utc) - issued_at < RESEND_COOLDOWN:
            return {"message": FORGOT_PASSWORD_MESSAGE}

    token = issue_password_reset_token(db_user, db)
    send_password_reset_email(db_user.email, db_user.name, token)

    return {"message": FORGOT_PASSWORD_MESSAGE}


@router.post("/reset-password")
def reset_password(body: ResetPassword, response: Response, db: Session = Depends(get_db)):
    hashed_token = hashlib.sha256(body.token.encode('utf-8')).hexdigest()

    db_user = db.query(User).filter(User.password_reset_token_hash == hashed_token).first()

    if db_user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This reset link is invalid or has already been used",
        )

    current_time = datetime.now(timezone.utc)
    if db_user.password_reset_expires_at is None or current_time >= db_user.password_reset_expires_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This reset link has expired. Please request a new one.",
        )

    db_user.password = hash_password(body.new_password)

    # Single-use: unlike verification, a reset link must stop working once used.
    db_user.password_reset_token_hash = None
    db_user.password_reset_expires_at = None

    db_user.is_verified = True

    revoke_all_refresh_tokens(db_user.id, db)
    db_user.session_version += 1

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to reset password")

    clear_auth_cookies(response)

    return {"message": "Your password has been reset. You can now sign in."}

