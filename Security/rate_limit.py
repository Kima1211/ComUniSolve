import threading
import time
from collections import deque

from fastapi import HTTPException, Request, status


# Counts live in memory: correct only while the backend runs as ONE process.
class RateLimiter:
    def __init__(self, max_events: int, window_seconds: int):
        self.max_events = max_events
        self.window_seconds = window_seconds
        self._events: dict[str, deque] = {}
        self._lock = threading.Lock()

    def _recent(self, key: str, now: float) -> deque:
        events = self._events.get(key)
        if events is None:
            events = deque()
            self._events[key] = events
        while events and events[0] <= now - self.window_seconds:
            events.popleft()
        return events

    SWEEP_ABOVE_KEYS = 10_000

    def _sweep(self, now: float) -> None:
        for key in list(self._events):
            if not self._recent(key, now):
                del self._events[key]

    def hit(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            if len(self._events) > self.SWEEP_ABOVE_KEYS:
                self._sweep(now)
            events = self._recent(key, now)
            if len(events) >= self.max_events:
                return False
            events.append(now)
            return True

    def is_blocked(self, key: str) -> bool:
        now = time.monotonic()
        with self._lock:
            events = self._recent(key, now)
            blocked = len(events) >= self.max_events
            if not events:
                del self._events[key]
            return blocked

    def reset(self, key: str) -> None:
        with self._lock:
            self._events.pop(key, None)


# Callers who bypass Vercel can fake this header, so never rely on IP limits alone.
def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


def enforce(limiter: RateLimiter, key: str, message: str) -> None:
    if not limiter.hit(key):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=message)


LOGIN_PER_IP = RateLimiter(max_events=30, window_seconds=5 * 60)

LOGIN_FAILURES_PER_EMAIL = RateLimiter(max_events=5, window_seconds=15 * 60)

REGISTER_PER_IP = RateLimiter(max_events=5, window_seconds=60 * 60)

FORGOT_PASSWORD_PER_IP = RateLimiter(max_events=5, window_seconds=15 * 60)

