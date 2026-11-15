import threading
import time
from collections import deque
from collections.abc import Callable

LIMITED = "Spark agent has reached its limit for now. Try again later."

HOUR = 3600
DAY = 86400


class Limiter:
    """Counts Spark agent requests per visitor over the last hour and for everyone over the last day.

    The counts live in this server's memory, so each server instance has its own.
    """

    def __init__(self, per_hour: int, per_day: int, clock: Callable[[], float] = time.monotonic):
        self._per_hour = per_hour
        self._per_day = per_day
        self._clock = clock
        self._visitors: dict[str, deque[float]] = {}
        self._day: deque[float] = deque()
        self._lock = threading.Lock()

    def allow(self, visitor: str) -> bool:
        with self._lock:
            now = self._clock()
            while self._day and self._day[0] <= now - DAY:
                self._day.popleft()
            for name in [name for name, times in self._visitors.items() if times[-1] <= now - HOUR]:
                del self._visitors[name]
            times = self._visitors.setdefault(visitor, deque())
            while times and times[0] <= now - HOUR:
                times.popleft()
            if len(times) >= self._per_hour or len(self._day) >= self._per_day:
                if not times:
                    del self._visitors[visitor]
                return False
            times.append(now)
            self._day.append(now)
            return True
