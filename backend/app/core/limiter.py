import logging

from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.config import settings

logger = logging.getLogger("devops_monitor.limiter")

# Shared limiter instance, keyed by client IP - blunts naive brute-force /
# credential-stuffing attempts against /auth/login.
#
# Storage backend: this is the one real, meaningful use of Redis in the
# project (see docs/ARCHITECTURE.md). An in-memory limiter only tracks
# requests seen by *that one* backend process - it is silently wrong the
# moment there is more than one backend replica/worker (each gets its own
# independent budget, so an attacker spreading requests across replicas
# gets N x the intended limit), and it forgets all counters on every
# restart/deploy. Backing it with Redis makes the limit correctly shared
# across every backend process talking to the same Redis instance.
#
# Redis is optional at the infrastructure level though: local development
# and CI run the backend without a Redis container at all. So we probe the
# configured Redis with a short timeout at startup and transparently fall
# back to the in-memory backend if it isn't reachable, instead of crashing
# the whole app over a rate-limiter storage choice.


def _build_limiter() -> Limiter:
    redis_url = f"redis://{settings.REDIS_HOST}:{settings.REDIS_PORT}/0"
    try:
        import redis as redis_lib

        client = redis_lib.from_url(redis_url, socket_connect_timeout=1, socket_timeout=1)
        client.ping()
        logger.info("Rate limiter using shared Redis storage at %s", redis_url)
        return Limiter(key_func=get_remote_address, storage_uri=redis_url)
    except Exception as exc:
        logger.warning(
            "Redis unavailable (%s) - rate limiter falling back to in-memory "
            "storage. Fine for local dev/tests/single-instance deployments; "
            "for a multi-replica production deployment the limit would be "
            "tracked per-replica instead of globally.",
            exc,
        )
        return Limiter(key_func=get_remote_address)


limiter = _build_limiter()
