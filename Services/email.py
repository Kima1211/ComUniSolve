import os
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

def send_verification_email(to_email: str, to_name: str, token: str) -> None:
    verification_link = f"{FRONTEND_URL}/verify/{token}"

    payload = {
        "sender": {"name": "ComUniSolve", "email": SENDER_EMAIL},
        "to": [{"email": to_email, "name": to_name}],
        "subject": "Verify your ComUniSolve account",
        "htmlContent": (
            f"<p>Hi {to_name},</p>"
            f"<p>Click the link below to verify your ComUniSolve account:</p>"
            f"<p><a href='{verification_link}'>{verification_link}</a></p>"
            f"<p>This link expires in 24 hours.</p>"
        ),
    }

    headers = {
        "accept": "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
    }

    try:
        response = requests.post(BREVO_API_URL, json=payload, headers=headers, timeout=10)
        response.raise_for_status()
    except requests.exceptions.RequestException as e:
        print(f"Failed to send verification email: {e}")