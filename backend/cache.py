"""
In-memory TTL caching for Thrifter backend.

IMPORTANT — process-local limitation:
  cachetools stores data in the process heap. With multiple Uvicorn workers or
  container replicas, each process has its own independent cache. For that setup,
  replace this module with a Redis-backed cache (e.g. fastapi-cache2 + redis).
  For a single-worker Docker container this is fully effective.
"""
import logging
from dataclasses import dataclass
from threading import Lock
from typing import Any, Optional

from cachetools import TTLCache

logger = logging.getLogger(__name__)

# ── TTL constants (seconds) ────────────────────────────────────────────────────
FEED_TTL   =  300  # 5 min  — public feed
ITEM_TTL   = 3600  # 1 hr   — item details (shared across all users by item_id)
USER_TTL   = 1800  # 30 min — user/me profile (rarely changes, explicit invalidation covers writes)
ADMIN_TTL  =  300  # 5 min  — admin stats
SEARCH_TTL = 3600  # 1 hr   — search results (keyed by normalised query string)

# ── Cache instances ────────────────────────────────────────────────────────────
_feed_cache   = TTLCache(maxsize=512,  ttl=FEED_TTL)    # keyed by query-string key
_item_cache   = TTLCache(maxsize=1024, ttl=ITEM_TTL)    # keyed by item_id (int)
_admin_cache  = TTLCache(maxsize=1,    ttl=ADMIN_TTL)   # single "stats" entry
_user_cache   = TTLCache(maxsize=512,  ttl=USER_TTL)    # keyed by user_id — CachedUser
_me_cache     = TTLCache(maxsize=512,  ttl=USER_TTL)    # keyed by user_id — /auth/me payload
_search_cache = TTLCache(maxsize=256,  ttl=SEARCH_TTL)  # keyed by normalised query string

# ── Thread locks (one per cache) ───────────────────────────────────────────────
_feed_lock   = Lock()
_item_lock   = Lock()
_admin_lock  = Lock()
_user_lock   = Lock()
_me_lock     = Lock()
_search_lock = Lock()


# ── Lightweight user dataclass ─────────────────────────────────────────────────
# Safe to cache: plain Python object, no ORM session attached.
# Covers every attribute of models.User that endpoints actually read.
@dataclass
class CachedUser:
    id: int
    email: str
    is_vendor: bool
    is_admin: bool
    vendor_id: Optional[int]


# ── Internal helpers ───────────────────────────────────────────────────────────
def _get(cache: TTLCache, lock: Lock, key: Any, label: str) -> Optional[Any]:
    with lock:
        value = cache.get(key)
    if value is not None:
        logger.debug("Cache HIT  [%s] key=%s", label, key)
    else:
        logger.debug("Cache MISS [%s] key=%s", label, key)
    return value

def _set(cache: TTLCache, lock: Lock, key: Any, value: Any) -> None:
    with lock:
        cache[key] = value

def _del(cache: TTLCache, lock: Lock, key: Any) -> None:
    with lock:
        cache.pop(key, None)

def _clear(cache: TTLCache, lock: Lock, label: str) -> None:
    with lock:
        cache.clear()
    logger.info("Cache CLEAR [%s] all entries evicted", label)


# ── Feed cache — GET /items ────────────────────────────────────────────────────
def feed_get(key: str) -> Optional[Any]:
    return _get(_feed_cache, _feed_lock, key, "feed")

def feed_set(key: str, value: Any) -> None:
    _set(_feed_cache, _feed_lock, key, value)

def feed_invalidate_all() -> None:
    """Call after any item/vendor write that affects the public feed."""
    _clear(_feed_cache, _feed_lock, "feed")

def feed_invalidate_user(user_id: int) -> None:
    """Evict only entries for a specific user (wardrobe changes)."""
    prefix = f"u{user_id}:"
    with _feed_lock:
        stale = [k for k in list(_feed_cache.keys()) if isinstance(k, str) and k.startswith(prefix)]
        for k in stale:
            del _feed_cache[k]
    if stale:
        logger.info("Cache CLEAR [feed] %d entries for user_id=%d", len(stale), user_id)


# ── Item detail cache — GET /items/{item_id} ───────────────────────────────────
def item_get(item_id: int) -> Optional[Any]:
    return _get(_item_cache, _item_lock, item_id, "item")

def item_set(item_id: int, value: Any) -> None:
    _set(_item_cache, _item_lock, item_id, value)

def item_invalidate(item_id: int) -> None:
    _del(_item_cache, _item_lock, item_id)
    logger.info("Cache CLEAR [item] id=%d", item_id)


# ── Admin stats cache — GET /admin/stats ──────────────────────────────────────
_STATS_KEY = "stats"

def admin_stats_get() -> Optional[Any]:
    return _get(_admin_cache, _admin_lock, _STATS_KEY, "admin_stats")

def admin_stats_set(value: Any) -> None:
    _set(_admin_cache, _admin_lock, _STATS_KEY, value)

def admin_stats_invalidate() -> None:
    _clear(_admin_cache, _admin_lock, "admin_stats")


# ── User DB lookup cache — get_current_user ────────────────────────────────────
def user_get(user_id: int) -> Optional[CachedUser]:
    return _get(_user_cache, _user_lock, user_id, "user_db")

def user_set(user_id: int, value: CachedUser) -> None:
    _set(_user_cache, _user_lock, user_id, value)

def user_invalidate(user_id: int) -> None:
    """Evict both the DB lookup and /auth/me response for this user."""
    _del(_user_cache, _user_lock, user_id)
    _del(_me_cache, _me_lock, user_id)
    logger.info("Cache CLEAR [user+me] id=%d", user_id)


# ── /auth/me response cache ────────────────────────────────────────────────────
def me_get(user_id: int) -> Optional[Any]:
    return _get(_me_cache, _me_lock, user_id, "auth_me")

def me_set(user_id: int, value: Any) -> None:
    _set(_me_cache, _me_lock, user_id, value)


# ── Search results cache — GET /search ────────────────────────────────────────
def search_get(query: str) -> Optional[Any]:
    return _get(_search_cache, _search_lock, query.lower().strip(), "search")

def search_set(query: str, value: Any) -> None:
    _set(_search_cache, _search_lock, query.lower().strip(), value)

def search_invalidate_all() -> None:
    """Call after bulk item writes that could affect search results."""
    _clear(_search_cache, _search_lock, "search")


# ── Demand board cache — GET /demand ──────────────────────────────────────────
# Caches the base entry list (scores only, no user_vote) for all users.
# TTL is intentionally short so scores stay reasonably fresh without needing
# invalidation on every vote. user_vote is merged per-request after cache lookup.
DEMAND_TTL = 120  # 2 minutes

_demand_cache = TTLCache(maxsize=1, ttl=DEMAND_TTL)
_demand_lock  = Lock()

_DEMAND_KEY = "base"

def demand_get() -> Optional[Any]:
    return _get(_demand_cache, _demand_lock, _DEMAND_KEY, "demand")

def demand_set(value: Any) -> None:
    _set(_demand_cache, _demand_lock, _DEMAND_KEY, value)

def demand_invalidate() -> None:
    """Call after admin actions that structurally change the board (approve, edit, delete)."""
    _del(_demand_cache, _demand_lock, _DEMAND_KEY)
    logger.info("Cache CLEAR [demand] board invalidated")
