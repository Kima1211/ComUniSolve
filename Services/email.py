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

# The backend doesn't know which language the user picked, so the email has both.
def send_verification_code(to_email: str, to_name: str, code: str) -> bool:
    safe_name = html.escape(to_name)

    return _send_email(
        to_email, to_name,
        subject=f"{code} is your ComUniSolve verification code",
        html_content=(
            f"<p>Hi {safe_name},</p>"
            f"<p>Your ComUniSolve verification code is:</p>"
            f"<p style='font-size:28px;font-weight:bold;letter-spacing:6px'>{code}</p>"
            f"<p>It expires in 10 minutes. If you didn't create an account, ignore this email.</p>"
            f"<hr>"
            f"<p>Ang iyong ComUniSolve verification code ay <b>{code}</b>. "
            f"Mag-e-expire ito sa loob ng 10 minuto. Kung hindi ikaw ang gumawa ng account, huwag pansinin ang email na ito.</p>"
        ),
    )


def send_password_reset_email(to_email: str, to_name: str, token: str) -> bool:
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
        print(f"[EMAIL] to={to_email} FAILED to reach Brevo: {e}")
        return False

    if response.status_code >= 400:
        print(f"[EMAIL] to={to_email} REJECTED {response.status_code}: {response.text}")
        return False

    print(f"[EMAIL] to={to_email} subject={subject!r} accepted by Brevo ({response.status_code})")
    return True
