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

# Email apps ignore stylesheets and flexbox, so the layout is tables with inline styles.
FONT = "'IBM Plex Sans', 'Segoe UI', Arial, Helvetica, sans-serif"
INK = "#1C2230"
MUTED = "#576072"
CANVAS = "#F6F7F9"
AMBER = "#F59E0B"
ON_AMBER = "#2B1A00"
LINK = "#9A5A06"

def _layout(preheader: str, body: str, footer: str) -> str:
    logo = f"{FRONTEND_URL}/icons/logo-128.png"
    return f"""<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:0;background:#FFFFFF;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">{preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;">
<tr><td align="center" style="padding:40px 24px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:440px;">
    <tr><td style="padding-bottom:36px;">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="vertical-align:middle;"><img src="{logo}" width="26" height="26" alt="" style="display:block;border:0;"></td>
        <td style="vertical-align:middle;padding-left:8px;font-family:{FONT};font-size:16px;font-weight:600;color:{INK};">ComUniSolve</td>
      </tr></table>
    </td></tr>
    <tr><td style="font-family:{FONT};font-size:15px;line-height:1.6;color:{INK};">{body}</td></tr>
    <tr><td style="padding-top:32px;border-top:1px solid {CANVAS};font-family:{FONT};font-size:12px;line-height:1.6;color:{MUTED};">{footer}</td></tr>
  </table>
</td></tr>
</table>
</body></html>"""

def _button(href: str, label: str) -> str:
    # A padded table cell, not CSS padding on the link: Outlook ignores padding on <a>.
    return (
        f'<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr>'
        f'<td style="background:{AMBER};border-radius:10px;">'
        f'<a href="{href}" style="display:inline-block;padding:12px 24px;font-family:{FONT};font-size:15px;'
        f'font-weight:600;color:{ON_AMBER};text-decoration:none;">{label}</a></td></tr></table>'
    )

def _heading(text: str) -> str:
    return f'<p style="margin:0 0 8px;font-size:22px;font-weight:600;line-height:1.3;color:{INK};">{text}</p>'

def _muted(text: str, bottom: int = 24) -> str:
    return f'<p style="margin:0 0 {bottom}px;color:{MUTED};">{text}</p>'

def verification_email(name: str, code: str) -> tuple[str, str, str]:
    safe_name = html.escape(name)
    subject = f"{code} is your ComUniSolve verification code"
    body = (
        _heading("Verify your email")
        + _muted(f"Hi {safe_name}, enter this code to finish creating your account.")
        + f'<p style="margin:0 0 24px;font-size:34px;font-weight:700;letter-spacing:8px;color:{INK};">{code}</p>'
        + _muted("It expires in 10 minutes.", bottom=32)
    )
    footer = (
        "Didn't create an account? Ignore this email.<br>"
        "Ito ang iyong verification code. Mag-e-expire ito sa loob ng 10 minuto. "
        "Kung hindi ikaw ang gumawa ng account, huwag pansinin ito."
    )
    text = (
        f"Hi {name},\n\nYour ComUniSolve verification code is: {code}\n"
        f"It expires in 10 minutes.\n\n"
        f"Ang iyong ComUniSolve verification code ay {code}. Mag-e-expire ito sa loob ng 10 minuto.\n\n"
        f"Didn't create an account? Ignore this email."
    )
    return subject, _layout("Your code expires in 10 minutes.", body, footer), text

def reset_email(name: str, token: str) -> tuple[str, str, str]:
    reset_link = f"{FRONTEND_URL}/reset-password/{token}"
    safe_name = html.escape(name)
    subject = "Reset your ComUniSolve password"
    body = (
        _heading("Reset your password")
        + _muted(f"Hi {safe_name}, we got a request to reset your password. The link works once and expires in 30 minutes.")
        + _button(reset_link, "Reset password")
        + _muted(f'Or paste this link into your browser:<br>'
                 f'<a href="{reset_link}" style="color:{LINK};word-break:break-all;">{reset_link}</a>', bottom=32)
    )
    footer = (
        "Didn't ask for this? Ignore this email; your password stays the same.<br>"
        "May humiling na i-reset ang password mo. Kung hindi ikaw ito, huwag pansinin ang email na ito."
    )
    text = (
        f"Hi {name},\n\nSomeone asked to reset your ComUniSolve password. If it was you, open this link:\n"
        f"{reset_link}\n\nIt works once and expires in 30 minutes. Didn't ask for this? Ignore this email."
    )
    return subject, _layout("Your reset link expires in 30 minutes.", body, footer), text

def send_verification_code(to_email: str, to_name: str, code: str) -> bool:
    subject, html_content, text = verification_email(to_name, code)
    return _send_email(to_email, to_name, subject, html_content, text)

def send_password_reset_email(to_email: str, to_name: str, token: str) -> bool:
    subject, html_content, text = reset_email(to_name, token)
    return _send_email(to_email, to_name, subject, html_content, text)

def _send_email(to_email: str, to_name: str, subject: str, html_content: str, text_content: str) -> bool:
    payload = {
        "sender": {"name": "ComUniSolve", "email": SENDER_EMAIL},
        "to": [{"email": to_email, "name": to_name}],
        "subject": subject,
        "htmlContent": html_content,
        "textContent": text_content,
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

if __name__ == "__main__":
    import tempfile
    previews = {"verify": verification_email("Juan Dela Cruz", "482917"),
                "reset": reset_email("Juan Dela Cruz", "sample-token")}
    for label, (_, page, _) in previews.items():
        path = os.path.join(tempfile.gettempdir(), f"comunisolve-email-{label}.html")
        with open(path, "w", encoding="utf-8") as f:
            f.write(page)
        print("Preview:", path)
