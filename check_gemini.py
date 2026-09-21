"""Ask Gemini which models your key can actually use, and try each one.

Run this when the AI layer is not working and you want facts rather than
guesses:

    python check_gemini.py

It makes one tiny request per model - the same kind the app makes - and prints
exactly what came back. A 404 means the model name is wrong or unavailable to
your key; a 429 means that model's quota is spent; 200 means it works.
"""
import json
import os
import sys

import requests
from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")
if not API_KEY:
    sys.exit("GEMINI_API_KEY is not set in .env")

BASE = "https://generativelanguage.googleapis.com/v1beta"
HEADERS = {"content-type": "application/json", "x-goog-api-key": API_KEY}

print("=" * 72)
print("1. MODELS YOUR KEY CAN SEE")
print("=" * 72)

usable = []
try:
    r = requests.get(f"{BASE}/models", headers=HEADERS, timeout=20)
    if r.status_code == 200:
        for m in r.json().get("models", []):
            # The API returns names like "models/gemini-2.5-flash"
            name = m.get("name", "").replace("models/", "")
            if name:
                usable.append(name)
                print(f"   {name}")
    else:
        print(f"   Could not list models: {r.status_code} {r.text[:200]}")
except requests.exceptions.RequestException as e:
    print(f"   Could not reach the API: {e}")

print()
print("=" * 72)
print("2. TRYING EACH MODEL IN YOUR CHAIN")
print("=" * 72)

# Import the app's own chain so this tests exactly what the app will use.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from Services.gemini import MODEL_CHAIN  # noqa: E402

for model in MODEL_CHAIN:
    payload = {"model": model, "input": "Reply with the single word: ok"}
    try:
        r = requests.post(f"{BASE}/interactions", json=payload, headers=HEADERS, timeout=25)
    except requests.exceptions.RequestException as e:
        print(f"   {model:<28} could not connect: {e}")
        continue

    if r.status_code == 200:
        print(f"   {model:<28} 200 OK  <- usable right now")
    elif r.status_code == 429:
        print(f"   {model:<28} 429     quota spent for today or this minute")
    elif r.status_code == 404:
        print(f"   {model:<28} 404     no such model for this key / API")
    else:
        print(f"   {model:<28} {r.status_code}     {r.text[:160]}")

print()
print("Put the models that returned 200 into .env, best first:")
print("   GEMINI_MODELS=model-a,model-b,model-c")
