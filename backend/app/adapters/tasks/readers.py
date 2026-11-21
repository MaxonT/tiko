import hashlib
import threading
import time
from collections.abc import Callable, Iterator

# A person's reader nobody asked for this long is dropped with what it remembers.
IDLE_S = 3600


class PersonalReaders[R]:
    """One reader per person, kept between requests so its pace and memory last.

    A reader is made again when the person's secret changes, so nothing read with an old
    token or password is served after it.
    """

    def __init__(self, clock: Callable[[], float] = time.time) -> None:
        self._clock = clock
        # By person: the digest of the secret the reader was made for, the reader, its last use.
        self._own: dict[str, tuple[bytes, R, float]] = {}
        self._lock = threading.Lock()

    def of(
        self,
        user_id: str,
        secret: str,
        make: Callable[[], R],
        reuse: Callable[[R], None] | None = None,
    ) -> R:
        """The person's reader for this secret; `reuse` updates a kept one with what may change
        without a new secret."""
        digest = hashlib.sha256(secret.encode()).digest()
        now = self._clock()
        with self._lock:
            for idle in [u for u, (_, _, used) in self._own.items() if now - used > IDLE_S]:
                del self._own[idle]
            kept = self._own.get(user_id)
            if kept is None or kept[0] != digest:
                reader = make()
            else:
                reader = kept[1]
                if reuse:
                    reuse(reader)
            self._own[user_id] = (digest, reader, now)
            return reader

    def __iter__(self) -> Iterator[str]:
        """The people a reader is kept for."""
        with self._lock:
            return iter(list(self._own))

    def forget(self, user_id: str) -> None:
        with self._lock:
            self._own.pop(user_id, None)
