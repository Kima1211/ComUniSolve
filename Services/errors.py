from typing import Optional

from fastapi import HTTPException


# Every API error carries a stable `code` the frontend translates (English/Tagalog).
# `message` stays English for /docs, logs and older cached frontends; `params` fills placeholders like {minutes}.
def api_error(status_code: int, code: str, message: str, params: Optional[dict] = None) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "params": params or {}},
    )
