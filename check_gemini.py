import os
import sys

import requests
from dotenv import load_dotenv

load_dotenv()

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from Services.gemini import (  # noqa: E402
    GEMINI_API_URL,
    MODEL_CHAIN,
    _gemini_body,
)

GEMINI_KEY = os.getenv("GEMINI_API_KEY")

PROBE = 'Reply with this JSON exactly: {"matches": []}'


def report(label: str, response) -> None:
    code = response.status_code
    if code == 200:
        print(f"   {label:<30} 200 OK    <- usable right now")
    elif code == 429:
        print(f"   {label:<30} 429       limit spent (per-minute, per-day, or no credit)")
    elif code == 404:
        print(f"   {label:<30} 404       no such model for this key")
    elif code in (401, 403):
        print(f"   {label:<30} {code}       key rejected: {response.text[:120]}")
    else:
        print(f"   {label:<30} {code}       {response.text[:160]}")


print("=" * 72)
print("GEMINI")
print("=" * 72)

if not GEMINI_KEY:
    print("   GEMINI_API_KEY is not set in .env - the AI layer is off entirely.")
else:
    print("\n   Models this key can see:")
    try:
        r = requests.get(
            "https://generativelanguage.googleapis.com/v1beta/models",
            headers={"x-goog-api-key": GEMINI_KEY},
            timeout=20,
        )
        if r.status_code == 200:
            names = [m.get("name", "").replace("models/", "") for m in r.json().get("models", [])]
            for name in sorted(n for n in names if n):
                print(f"      {name}")
        else:
            print(f"      could not list models: {r.status_code} {r.text[:200]}")
    except requests.exceptions.RequestException as e:
        print(f"      could not reach the API: {e}")

    print("\n   Trying each model in your chain (one real request each):")
    for model in MODEL_CHAIN:
        try:
            r = requests.post(
                GEMINI_API_URL,
                json=_gemini_body(model, PROBE),
                headers={"content-type": "application/json", "x-goog-api-key": GEMINI_KEY},
                timeout=30,
            )
        except requests.exceptions.RequestException as e:
            print(f"   {model:<30} could not connect: {e}")
            continue
        report(model, r)

print()
print("Any model that printed 200 is working. To change the order the app tries")
print("them in, put the good ones first in .env:")
print("   GEMINI_MODELS=gemini-3.8-flash,gemini-3.6-flash")

