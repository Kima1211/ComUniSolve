import hmac
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
    issue_verification_code,
    hash_verification_code,
    issue_password_reset_token,
    revoke_all_refresh_tokens,
    hash_password,
    get_current_user,
    PASSWORD_RESET_EXPIRE_MINUTES,
    VERIFICATION_MAX_ATTEMPTS,
)
from Models.user import User
from Schemas.user import ForgotPassword, ResetPassword, VerifyCode
from Services.email import send_verification_code, send_password_reset_email
from Services.audit import record
from routers.user import check_password_strength, find_by_email
from Security.rate_limit import FORGOT_PASSWORD_PER_IP, client_ip, enforce
from Services.errors import api_error

router = APIRouter()

RESEND_COOLDOWN = timedelta(seconds=60)

ROTATION_GRACE = timedelta(seconds=30)

@router.post("/resend-verification")
def resend_verification(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if current_user.is_verified:
        raise api_error(status.HTTP_400_BAD_REQUEST, "already_verified", "This account is already verified")

    sent_at = current_user.verification_sent_at
    if sent_at is not None and datetime.now(timezone.utc) - sent_at < RESEND_COOLDOWN:
        raise api_error(status.HTTP_429_TOO_MANY_REQUESTS, "email_cooldown", "Please wait a minute before requesting another email")

    code = issue_verification_code(current_user, db)
    if not send_verification_code(current_user.email, current_user.name, code):
        raise api_error(status.HTTP_502_BAD_GATEWAY, "email_send_failed", "We couldn't send the email right now. Please try again in a minute.")

    return {"message": f"Verification code sent to {current_user.email}"}

# 5 wrong tries per code, and a new code at most once a minute: guessing 1 in a million is hopeless.
@router.post("/verify-code")
def verify_code(body: VerifyCode, request: Request, db: Session = Depends(get_db),
                current_user: User = Depends(get_current_user)):
    if current_user.is_verified:
        return {"message": "Email verified successfully"}

    if current_user.verification_token_hash is None or current_user.verification_token_expires_at is None:
        raise api_error(status.HTTP_400_BAD_REQUEST, "code_expired", "This code has expired. Request a new one.")
    if current_user.verification_attempts >= VERIFICATION_MAX_ATTEMPTS:
        raise api_error(status.HTTP_429_TOO_MANY_REQUESTS, "code_locked", "Too many wrong codes. Request a new one.")
    if datetime.now(timezone.utc) >= current_user.verification_token_expires_at:
        raise api_error(status.HTTP_400_BAD_REQUEST, "code_expired", "This code has expired. Request a new one.")

    expected = current_user.verification_token_hash
    if not hmac.compare_digest(expected, hash_verification_code(current_user.id, body.code)):
        current_user.verification_attempts += 1
        db.commit()
        left = VERIFICATION_MAX_ATTEMPTS - current_user.verification_attempts
        if left <= 0:
            raise api_error(status.HTTP_429_TOO_MANY_REQUESTS, "code_locked", "Too many wrong codes. Request a new one.")
        raise api_error(status.HTTP_400_BAD_REQUEST, "code_invalid", "That code is not correct.", {"left": left})

    current_user.is_verified = True
    current_user.verification_token_hash = None
    current_user.verification_token_expires_at = None
    current_user.verification_attempts = 0
    record(db, "email_verified", request, user=current_user)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, "server_error", "Failed to verify account")

    return {"message": "Email verified successfully"}

@router.post("/refresh")
def refresh_token(request: Request, response: Response, db: Session = Depends(get_db)):
    token = request.cookies.get("refresh_token")
    
    if token is None:
        raise api_error(status.HTTP_401_UNAUTHORIZED, "session_ended", "Refresh token missing")
    
    hashed_token = hashlib.sha256(token.encode('utf-8')).hexdigest()
    db_token = db.query(RefreshToken).filter(RefreshToken.token_hash == hashed_token).first()
    
    if db_token is None:
        raise api_error(status.HTTP_401_UNAUTHORIZED, "session_ended", "Invalid refresh token")
    
    current_time = datetime.now(timezone.utc)
    db_expires_at = db_token.expires_at
    
    if current_time >= db_expires_at:
        db.delete(db_token)
        db.commit()
        raise api_error(status.HTTP_401_UNAUTHORIZED, "session_ended", "Refresh token has expired")
    
    # A replaced token coming back means it was copied: end every session (30s grace for two tabs).
    if db_token.revoked_at is not None:
        if current_time - db_token.revoked_at <= ROTATION_GRACE:
            return {"message": "Token Refreshed"}

        revoke_all_refresh_tokens(db_token.user_id, db)
        db.commit()
        clear_auth_cookies(response)
        print(f"[AUTH] reused refresh token for user_id={db_token.user_id} - all sessions revoked")
        raise api_error(status.HTTP_401_UNAUTHORIZED, "session_ended", "Your session has ended for security reasons. Please sign in again.")

    user = db.query(User).filter(User.id == db_token.user_id).first()
    if not user:
        raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "User associated with token not found")

    if not user.is_active:
        db.delete(db_token)
        db.commit()
        raise api_error(status.HTTP_403_FORBIDDEN, "account_inactive", "Account is inactive")

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

# Same answer for every email, so nobody can check which emails have accounts.
FORGOT_PASSWORD_MESSAGE = "If an account exists for that email, we sent a link to reset the password."

@router.post("/forgot-password")
def forgot_password(body: ForgotPassword, request: Request, db: Session = Depends(get_db)):
    enforce(FORGOT_PASSWORD_PER_IP, client_ip(request),
            "Too many reset requests from your network. Please try again in 15 minutes.")

    db_user = find_by_email(db, body.email)

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
def reset_password(body: ResetPassword, request: Request, response: Response, db: Session = Depends(get_db)):
    hashed_token = hashlib.sha256(body.token.encode('utf-8')).hexdigest()

    db_user = db.query(User).filter(User.password_reset_token_hash == hashed_token).first()

    if db_user is None:
        raise api_error(status.HTTP_400_BAD_REQUEST, "reset_invalid", "This reset link is invalid or has already been used")

    current_time = datetime.now(timezone.utc)
    if db_user.password_reset_expires_at is None or current_time >= db_user.password_reset_expires_at:
        raise api_error(status.HTTP_400_BAD_REQUEST, "reset_expired", "This reset link has expired. Please request a new one.")

    check_password_strength(body.new_password)
    db_user.password = hash_password(body.new_password)

    db_user.password_reset_token_hash = None
    db_user.password_reset_expires_at = None

    db_user.is_verified = True

    revoke_all_refresh_tokens(db_user.id, db)
    db_user.session_version += 1
    record(db, "password_reset", request, user=db_user)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, "server_error", "Failed to reset password")

    clear_auth_cookies(response)

    return {"message": "Your password has been reset. You can now sign in."}

