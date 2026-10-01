from typing import Optional

from fastapi import Request
from sqlalchemy.orm import Session

from Models.audit_log import AUDIT_ACTIONS, AuditLog
from Security.rate_limit import client_ip


# Adds a row; the caller's commit saves it together with whatever the action changed.
def record(db: Session, action: str, request: Optional[Request] = None, user=None, email: Optional[str] = None) -> None:
    assert action in AUDIT_ACTIONS, action
    db.add(AuditLog(
        user_id=user.id if user is not None else None,
        email=email or (user.email if user is not None else None),
        action=action,
        ip=client_ip(request) if request is not None else None,
    ))
