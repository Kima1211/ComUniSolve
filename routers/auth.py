from fastapi import APIRouter, HTTPException, status, Depends, Request, Response
from sqlalchemy.orm import Session
from Models.database import get_db
import hashlib
from Models.refresh_token import RefreshToken
from datetime import datetime, timezone
from datetime import timedelta
from Security.utils import (
    issue_auth_cookie,
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

router = APIRouter()

# A verification token lasts 24 hours, so "issued at" is expires_at minus 24h.
# Refusing a resend within this window stops the button being used to spam
# someone's inbox - or to burn through the free email quota in one afternoon.
RESEND_COOLDOWN = timedelta(seconds=60)


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

    # Issuing a new token overwrites the old one, so any previously emailed
    # link stops working from this moment. That is the intended behaviour -
    # only the most recent link should ever be valid.
    token = issue_verification_token(current_user, db)
    if not send_verification_email(current_user.email, current_user.name, token):
        # 502 Bad Gateway: our server is fine, the service it depends on
        # (Brevo) is not. The user asked for this email, so say it failed.
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

    # Clicking the same link twice must not look like a failure. This check
    # comes BEFORE the expiry check, so an old link for an already-verified
    # account still gets a friendly answer instead of "expired".
    # It also makes the endpoint idempotent (calling it twice has the same
    # effect as calling it once), which is what React StrictMode's double
    # request in development needs.
    if db_user.is_verified:
        return {"message": "Email verified successfully"}

    current_time = datetime.now(timezone.utc)
    if db_user.verification_token_expires_at is None or current_time >= db_user.verification_token_expires_at:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Verification token has expired")

    # The hash is kept on purpose, so a second click can still find this user
    # and land on the is_verified branch above. It is safe to keep: the only
    # thing this token can do is verify, and that is already done.
    db_user.is_verified=True

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to verify account")
    
    return {"message": "Email verified successfully"}


# Every request gets this exact answer, whether the email is registered or not.
# If the reply differed, anyone could type in emails to find out who has an
# account here (called "user enumeration").
FORGOT_PASSWORD_MESSAGE = "If an account exists for that email, we sent a link to reset the password."


@router.post("/forgot-password")
def forgot_password(body: ForgotPassword, db: Session = Depends(get_db)):
    db_user = db.query(User).filter(User.email == body.email).first()

    if db_user is None or not db_user.is_active:
        return {"message": FORGOT_PASSWORD_MESSAGE}

    # Same cooldown idea as resend-verification. It is silent here on purpose:
    # a 429 would only happen for real accounts, which would leak the same
    # "this email exists" fact the generic message is hiding.
    expires_at = db_user.password_reset_expires_at
    if expires_at is not None:
        issued_at = expires_at - timedelta(minutes=PASSWORD_RESET_EXPIRE_MINUTES)
        if datetime.now(timezone.utc) - issued_at < RESEND_COOLDOWN:
            return {"message": FORGOT_PASSWORD_MESSAGE}

    token = issue_password_reset_token(db_user, db)
    # A failed send is only logged (inside send_password_reset_email). Telling
    # the user would reveal the account exists; they can simply ask again.
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

    # Single-use: unlike verification, the token is cleared. A reset link that
    # still worked after use would let whoever saw it change the password again.
    db_user.password_reset_token_hash = None
    db_user.password_reset_expires_at = None

    # The link reached this person's inbox, which proves they own the email -
    # the same thing clicking a verification link proves.
    db_user.is_verified = True

    # Log out every device. If someone else was signed in to this account,
    # the reset is what kicks them out.
    revoke_all_refresh_tokens(db_user.id, db)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to reset password")

    # This browser too: the user signs in again with the new password.
    clear_auth_cookies(response)

    return {"message": "Your password has been reset. You can now sign in."}

    