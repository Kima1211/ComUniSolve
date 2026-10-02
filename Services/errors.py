from typing import Optional

from fastapi import HTTPException

# `code` is translated by the frontend; `message` stays English for /docs and logs.
def api_error(status_code: int, code: str, message: str, params: Optional[dict] = None) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={"code": code, "message": message, "params": params or {}},
    )
