import secrets
from datetime import datetime, timezone

from fastapi import APIRouter, status, Request, Response, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session
from Schemas.user import Register, Login, UserProfile, ProfileUpdate, Deactivate
from Models import user, problem, solution
from Models.user import build_display_name, DELETED_EMAIL_DOMAIN, DELETED_NAME
from Models.audit_log import AuditLog
from Models.database import get_db
from Security.utils import (
    hash_password,
    verify_password,
    get_current_user,
    issue_auth_cookie,
    issue_refresh_token,
    issue_verification_code,
    revoke_all_refresh_tokens,
    clear_auth_cookies,
)
from Security.passwords import password_problems
from Services.email import send_verification_code
from Services.reputation import get_tier
from Services import locations
from Services.audit import record
from Security.rate_limit import (
    LOGIN_PER_IP,
    LOGIN_FAILURES_PER_EMAIL,
    REGISTER_PER_IP,
    client_ip,
    enforce,
)
from Services.errors import api_error

router = APIRouter()


def check_password_strength(password: str) -> None:
    problems = password_problems(password)
    if problems:
        raise api_error(
            status.HTTP_422_UNPROCESSABLE_ENTITY, "weak_password",
            "Use at least 8 characters with uppercase, lowercase and a number, and avoid common passwords.",
            {"missing": problems},
        )


def check_address(body) -> None:
    if not locations.is_valid(body.region_code, body.province_code, body.city_code, body.barangay_code):
        raise api_error(status.HTTP_422_UNPROCESSABLE_ENTITY, "invalid_address",
                        "Please choose your region, province, city/municipality and barangay again.")


def apply_personal_info(target, body) -> None:
    for field in ("first_name", "middle_name", "last_name", "suffix", "birth_date", "sex",
                  "region_code", "province_code", "city_code", "barangay_code", "street"):
        setattr(target, field, getattr(body, field))
    target.name = build_display_name(body.first_name, body.last_name, body.suffix)


def find_by_email(db: Session, email: str):
    return db.query(user.User).filter(func.lower(user.User.email) == email.strip().lower()).first()


@router.post("/register", status_code=status.HTTP_201_CREATED)
def reg_body(register: Register, request: Request, response: Response, db: Session = Depends(get_db)):
    enforce(REGISTER_PER_IP, client_ip(request),
            "Too many accounts created from your network. Please try again later.")

    existing = find_by_email(db, register.email)
    if existing and existing.deactivated_at is not None:
        raise api_error(status.HTTP_400_BAD_REQUEST, "email_deactivated",
                        "This email belongs to a deactivated account. Sign in to reactivate it.")
    if existing:
        raise api_error(status.HTTP_400_BAD_REQUEST, "email_taken", "Email already exist")
    check_password_strength(register.password)
    check_address(register)

    new_user = user.User(email=register.email, password=hash_password(register.password))
    apply_personal_info(new_user, register)
    try:
        db.add(new_user)
        db.flush()
        record(db, "register", request, user=new_user)
        db.commit()
        db.refresh(new_user)
    except Exception:
        db.rollback()
        raise api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, "server_error", "Failed to register")

    issue_auth_cookie(response, new_user)
    issue_refresh_token(response, new_user, db)
    code = issue_verification_code(new_user, db)
    email_sent = send_verification_code(new_user.email, new_user.name, code)

    return {
        "message": "Account successfully registered",
        "email_sent": email_sent,
        "data": {
            "id": new_user.id,
            "name": new_user.name,
            "email": new_user.email,
        }
    }

# The same checks for signing in and for reactivating: rate limits, then email + password.
def check_credentials(body: Login, request: Request, db: Session):
    enforce(LOGIN_PER_IP, client_ip(request),
            "Too many login attempts from your network. Please wait a few minutes.")

    email_key = body.email.strip().lower()
    if LOGIN_FAILURES_PER_EMAIL.is_blocked(email_key):
        raise api_error(status.HTTP_429_TOO_MANY_REQUESTS, "login_locked", "Too many failed attempts for this email. Please wait 15 minutes, or reset your password.", {"minutes": 15})

    val_user = find_by_email(db, email_key)

    if not val_user or not verify_password(body.password, val_user.password):
        LOGIN_FAILURES_PER_EMAIL.hit(email_key)
        record(db, "login_failed", request, user=val_user, email=email_key)
        db.commit()
        raise api_error(status.HTTP_401_UNAUTHORIZED, "invalid_login", "Invalid email or password")

    LOGIN_FAILURES_PER_EMAIL.reset(email_key)
    return val_user


@router.post("/login")
def login(login: Login, request: Request, response: Response,db: Session = Depends(get_db)):
    val_user = check_credentials(login, request, db)

    # Only the real owner (right password) learns the account is deactivated, and is offered to reactivate it.
    if not val_user.is_active and val_user.deactivated_at is not None:
        raise api_error(status.HTTP_403_FORBIDDEN, "account_deactivated", "This account is deactivated. You can reactivate it.")
    if not val_user.is_active:
        raise api_error(status.HTTP_403_FORBIDDEN, "account_inactive", "Account is inactive")

    record(db, "login_success", request, user=val_user)

    issue_auth_cookie(response, val_user)
    issue_refresh_token(response, val_user, db)

    return {
        "user": {
            "id": val_user.id,
            "name": val_user.name,
            "email": val_user.email
        }
    }


# Everything the signed-in user may see about themselves (never sent to anyone else).
def me_payload(u) -> dict:
    return {
        "id": u.id,
        "name": u.name,
        "email": u.email,
        "role": u.role,
        "is_verified": u.is_verified,
        "points": u.points,
        "tier": get_tier(u.points),
        "verification_sent_at": u.verification_sent_at,
        "first_name": u.first_name,
        "middle_name": u.middle_name,
        "last_name": u.last_name,
        "suffix": u.suffix,
        "birth_date": u.birth_date,
        "sex": u.sex,
        "region_code": u.region_code,
        "province_code": u.province_code,
        "city_code": u.city_code,
        "barangay_code": u.barangay_code,
        "street": u.street,
        "address": locations.describe(u.region_code, u.province_code, u.city_code, u.barangay_code),
    }


@router.get("/users/me")
def get_profile(current_user: user.User = Depends(get_current_user)):
    return me_payload(current_user)


@router.patch("/users/me")
def update_profile(body: ProfileUpdate, request: Request, db: Session = Depends(get_db),
                   current_user: user.User = Depends(get_current_user)):
    check_address(body)
    apply_personal_info(current_user, body)
    record(db, "profile_updated", request, user=current_user)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, "server_error", "Failed to update profile")
    db.refresh(current_user)
    return me_payload(current_user)


PRIVATE_FIELDS = ("middle_name", "birth_date", "sex", "region_code", "province_code",
                  "city_code", "barangay_code", "street")


def reactivate(target, db: Session, request: Request) -> None:
    target.is_active = True
    target.deactivated_at = None
    record(db, "account_reactivated", request, user=target)


# Deactivate, not delete: the user's posts stay (others' solutions and ratings depend on them),
# but the account can no longer sign in and every session ends now.
@router.post("/users/me/deactivate")
def deactivate_account(body: Deactivate, request: Request, response: Response, db: Session = Depends(get_db),
                       current_user: user.User = Depends(get_current_user)):
    if current_user.role == "admin":
        raise api_error(status.HTTP_400_BAD_REQUEST, "admin_cannot_deactivate", "Admin accounts can't be deactivated here")
    # 400, not 401: a 401 would make the frontend try to refresh the session first.
    if not verify_password(body.password, current_user.password):
        raise api_error(status.HTTP_400_BAD_REQUEST, "wrong_password", "Password doesn't match")

    current_user.is_active = False
    current_user.deactivated_at = datetime.now(timezone.utc)
    # Data Privacy Act: keep only what the account still needs (name for their posts, email + password to come back).
    for field in PRIVATE_FIELDS:
        setattr(current_user, field, None)
    current_user.session_version += 1
    revoke_all_refresh_tokens(current_user.id, db)
    record(db, "account_deactivated", request, user=current_user)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, "server_error", "Failed to deactivate account")

    clear_auth_cookies(response)
    return {"message": "Account deactivated"}


# Permanent delete, Reddit-style: the account is anonymised, not removed. Problems, solutions and comments
# stay (threads and accepted answers keep working) but show "Deleted user". Name, email, password and personal
# details are wiped, so the person can't sign in again and their email is free for a brand-new account.
# Points other users earned from these posts are untouched; this account's own points go to 0.
@router.post("/users/me/delete")
def delete_account(body: Deactivate, request: Request, response: Response, db: Session = Depends(get_db),
                   current_user: user.User = Depends(get_current_user)):
    if current_user.role == "admin":
        raise api_error(status.HTTP_400_BAD_REQUEST, "admin_cannot_delete", "Admin accounts can't be deleted here")
    # 400, not 401: a 401 would make the frontend try to refresh the session first.
    if not verify_password(body.password, current_user.password):
        raise api_error(status.HTTP_400_BAD_REQUEST, "wrong_password", "Password doesn't match")

    placeholder = f"deleted-{current_user.id}@{DELETED_EMAIL_DOMAIN}"
    for field in PRIVATE_FIELDS + ("first_name", "last_name", "suffix"):
        setattr(current_user, field, None)
    current_user.name = DELETED_NAME
    current_user.email = placeholder
    # A random password nobody knows: the account can never be signed in to again.
    current_user.password = hash_password(secrets.token_urlsafe(32))
    current_user.verification_token_hash = None
    current_user.verification_token_expires_at = None
    current_user.password_reset_token_hash = None
    current_user.password_reset_expires_at = None
    current_user.points = 0
    current_user.is_active = False
    current_user.deactivated_at = None  # deleted, not deactivated: nothing to reactivate
    current_user.session_version += 1
    revoke_all_refresh_tokens(current_user.id, db)

    # Older audit rows still hold the real email; replace it too. IPs stay for security checks.
    db.query(AuditLog).filter(AuditLog.user_id == current_user.id).update(
        {AuditLog.email: placeholder}, synchronize_session=False
    )
    record(db, "account_deleted", request, user=current_user)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise api_error(status.HTTP_500_INTERNAL_SERVER_ERROR, "server_error", "Failed to delete account")

    clear_auth_cookies(response)
    return {"message": "Account deleted"}


# Sign back in to a deactivated account. A suspension still applies afterwards (it's stored separately).
@router.post("/reactivate")
def reactivate_account(body: Login, request: Request, response: Response, db: Session = Depends(get_db)):
    val_user = check_credentials(body, request, db)
    if val_user.is_active or val_user.deactivated_at is None:
        raise api_error(status.HTTP_400_BAD_REQUEST, "not_deactivated", "This account is not deactivated")

    reactivate(val_user, db, request)
    record(db, "login_success", request, user=val_user)
    issue_auth_cookie(response, val_user)
    issue_refresh_token(response, val_user, db)
    return {"user": {"id": val_user.id, "name": val_user.name, "email": val_user.email}}


@router.get("/users/{user_id}/profile", response_model=UserProfile)
def get_public_profile(user_id: int, db: Session = Depends(get_db)):
    fnd_user = db.query(user.User).filter(user.User.id == user_id, user.User.is_active).first()
    if not fnd_user:
        raise api_error(status.HTTP_404_NOT_FOUND, "not_found", "User not found")

    problems = (
        db.query(problem.Problem)
        .filter(
            problem.Problem.user_id == user_id,
            problem.Problem.moderation_status != "removed",
            problem.Problem.deleted_at.is_(None),
        )
        .order_by(problem.Problem.created_at.desc())
        .all()
    )

    # Skip solutions whose problem is gone, so the list never links to a missing page.
    solution_rows = (
        db.query(solution.Solution, problem.Problem.title)
        .join(problem.Problem, problem.Problem.id == solution.Solution.problem_id)
        .filter(
            solution.Solution.user_id == user_id,
            solution.Solution.moderation_status != "removed",
            solution.Solution.deleted_at.is_(None),
            problem.Problem.moderation_status != "removed",
            problem.Problem.deleted_at.is_(None),
        )
        .order_by(solution.Solution.created_at.desc())
        .all()
    )

    solutions = [
        {
            "id": s.id,
            "problem_id": s.problem_id,
            "problem_title": title,
            "solution_text": s.solution_text,
            "status": s.status,
            "created_at": s.created_at,
        }
        for s, title in solution_rows
    ]

    return {
        "id": fnd_user.id,
        "name": fnd_user.name,
        "points": fnd_user.points,
        "tier": fnd_user.tier,
        "created_at": fnd_user.created_at,
        "problem_count": len(problems),
        "solution_count": len(solutions),
        "accepted_count": sum(1 for s in solutions if s["status"] == "accepted"),
        "problems": problems,
        "solutions": solutions,
    }
