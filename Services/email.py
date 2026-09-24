import os
import html
import requests
from dotenv import load_dotenv

load_dotenv()

BREVO_API_KEY = os.getenv("BREVO_API_KEY")
if not BREVO_API_KEY:
    raise RuntimeError("BREVO_API_KEY is not set in environment!")

SENDER_EMAIL = os.getenv("SENDER_EMAIL")
if not SENDER_EMAIL:
    raise RuntimeError("SENDER_EMAIL is not set in environment!")

FRONTEND_URL = os.getenv("FRONTEND_URL")
if not FRONTEND_URL:
    raise RuntimeError("FRONTEND_URL is not set in environment!")

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"

def send_verification_email(to_email: str, to_name: str, token: str) -> bool:
    """Send the verification link. Returns True only if Brevo accepted it.

    It returns instead of raising so each caller can decide what a failure
    means: registration still succeeds (the account exists, the user can
    resend), while an explicit resend reports the failure to the user.
    """
    verification_link = f"{FRONTEND_URL}/verify/{token}"

    # to_name is whatever the user typed at registration. Anything that ends up
    # inside an HTML document has to be escaped first, or a name like
    # '<b>Rojan' becomes real markup in the email instead of text.
    safe_name = html.escape(to_name)

    return _send_email(
        to_email, to_name,
        subject="Verify your ComUniSolve account",
        html_content=(
            f"<p>Hi {safe_name},</p>"
            f"<p>Click the link below to verify your ComUniSolve account:</p>"
            f"<p><a href='{verification_link}'>{verification_link}</a></p>"
            f"<p>This link expires in 24 hours.</p>"
        ),
    )


def send_password_reset_email(to_email: str, to_name: str, token: str) -> bool:
    """Send the password reset link. Returns True only if Brevo accepted it."""
    reset_link = f"{FRONTEND_URL}/reset-password/{token}"
    safe_name = html.escape(to_name)

    return _send_email(
        to_email, to_name,
        subject="Reset your ComUniSolve password",
        html_content=(
            f"<p>Hi {safe_name},</p>"
            f"<p>Someone asked to reset the password for your ComUniSolve account. "
            f"Click the link below to reset password:</p>"
            f"<p><a href='{reset_link}'>{reset_link}</a></p>"
            f"<p>This link expires in 30 minutes and works once.</p>"
            f"<p>If you didn't ask for this, ignore this email.</p>"
        ),
    )


def _send_email(to_email: str, to_name: str, subject: str, html_content: str) -> bool:
    """The one place that talks to Brevo. Both emails above go through here,
    so a fix to sending or logging only ever has to be made once."""
    payload = {
        "sender": {"name": "ComUniSolve", "email": SENDER_EMAIL},
        "to": [{"email": to_email, "name": to_name}],
        "subject": subject,
        "htmlContent": html_content,
    }

    headers = {
        "accept": "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
    }

    try:
        response = requests.post(BREVO_API_URL, json=payload, headers=headers, timeout=10)
    except requests.exceptions.RequestException as e:
        # Nothing answered: no network, DNS failure, Brevo unreachable.
        print(f"[EMAIL] to={to_email} FAILED to reach Brevo: {e}")
        return False

    if response.status_code >= 400:
        # Brevo answered and said no. response.text carries the reason;
        # raise_for_status() would have thrown it away.
        print(f"[EMAIL] to={to_email} REJECTED {response.status_code}: {response.text}")
        return False

    # Logging success matters as much as logging failure. Without this line,
    # "no output" means either "sent fine" or "this code never ran", and you
    # cannot tell which.
    # The link is deliberately NOT logged: it contains the token, and anyone
    # who can read the server logs (Render keeps them) could use it.
    print(f"[EMAIL] to={to_email} subject={subject!r} accepted by Brevo ({response.status_code})")
    return True