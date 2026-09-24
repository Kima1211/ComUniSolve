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
    get_current_user,
)
from Models.user import User
from Services.email import send_verification_email

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

    