import hashlib
import os
import time
from typing import Optional

import requests
from dotenv import load_dotenv

load_dotenv()

CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME")
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY")
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET")

UPLOAD_FOLDER = "comunisolve/problems"

MAX_IMAGE_BYTES = 5 * 1024 * 1024


def is_configured() -> bool:
    return bool(CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET)


def detect_image_type(data: bytes) -> Optional[str]:
    if data.startswith(b"\xff\xd8\xff"):
        return "jpeg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return "png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "webp"
    return None


def _sign(params: dict) -> str:
    to_sign = "&".join(f"{k}={params[k]}" for k in sorted(params))
    return hashlib.sha1((to_sign + CLOUDINARY_API_SECRET).encode("utf-8")).hexdigest()


def upload_image(data: bytes, filename: str) -> Optional[str]:
    params = {"folder": UPLOAD_FOLDER, "timestamp": int(time.time())}

    try:
        response = requests.post(
            f"https://api.cloudinary.com/v1_1/{CLOUDINARY_CLOUD_NAME}/image/upload",
            data={**params, "api_key": CLOUDINARY_API_KEY, "signature": _sign(params)},
            files={"file": (filename, data)},
            timeout=30,
        )
    except requests.exceptions.RequestException as e:
        print(f"[IMAGE] FAILED to reach Cloudinary: {e}")
        return None

    if response.status_code >= 400:
        print(f"[IMAGE] Cloudinary REJECTED {response.status_code}: {response.text[:300]}")
        return None

    url = response.json().get("secure_url")
    print(f"[IMAGE] uploaded {len(data)} bytes -> {url}")
    return url

