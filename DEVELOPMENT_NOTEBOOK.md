# Thrifter Development Notebook

## Entry: April 23, 2026
### Task: Fix Image Upload Bug (UnidentifiedImageError)

**Objective:**
Resolve a bug where some image uploads failed with `PIL.UnidentifiedImageError: cannot identify image file <tempfile.SpooledTemporaryFile...>`.

**Root Cause Analysis:**
The backend was attempting to read from FastAPI's `SpooledTemporaryFile` multiple times. Even with `.seek(0)`, Pillow sometimes struggled to identify the file format when reading directly from the spooled file handle in certain environments (like Docker). This was exacerbated by calling `await file.read()` earlier in the function, which consumes the stream.

**Changes Implemented in `backend/main.py`:**

1.  **Memory-Based Image Processing (`io.BytesIO`):**
    - Imported the `io` module.
    - Modified `upload_item`, `outfit_search`, and `outfit_builder` to capture the file content using `await file.read()` and wrap it in `io.BytesIO`.
    - Passed the `BytesIO` stream to both the AI embedding generator and the Cloudinary uploader.
    - **Result:** This guarantees that Pillow is always reading from a clean, memory-resident byte stream, completely bypassing any issues with temporary file handles or spooling logic.

**Verification:**
- [x] Images that previously failed due to spooling issues now upload successfully.
- [x] AI embeddings are correctly generated from the memory stream.
- [x] Cloudinary uploads continue to function normally using the same stream (with `.seek(0)`).

## Entry: April 23, 2026 (Continued)
### Task: Fix Truncated Image Error

**Objective:**
Resolve `OSError: image file is truncated` occurring during image uploads and AI processing.

**Root Cause Analysis:**
Pillow (PIL) by default raises an error if it detects that an image file is missing data at the end (truncated). This can happen with certain image sources or if an upload is slightly interrupted/corrupted.

**Changes Implemented in `backend/search_engine.py`:**

1.  **Enable Truncated Image Loading:**
    - Imported `ImageFile` from `PIL`.
    - Set `ImageFile.LOAD_TRUNCATED_IMAGES = True`.
    - **Result:** Pillow will now attempt to load and process images even if they are missing the end-of-file marker, preventing the application from crashing on these files.

**Verification:**
- [x] Images that previously triggered "image file is truncated" errors are now processed successfully by the AI model and Cloudinary.

## Entry: April 23, 2026 (Continued)
### Task: Improve Registration Validation & Error Handling

**Objective:**
Address the issue where short passwords (under 8 characters) caused a generic "Network Error" and provide clearer feedback to the user.

**Changes Implemented in `frontend/src/components/Auth.jsx`:**

1.  **Client-Side Validation:**
    - Added an immediate check in `handleRegister` to verify that `password.length >= 8`.
    - **Result:** Users now get an instant alert if their password is too short, preventing unnecessary network requests.

2.  **Enhanced Backend Error Parsing:**
    - Updated the `catch` block to specifically handle `422 Unprocessable Entity` responses (the default FastAPI status for validation failures).
    - **Result:** Instead of a generic "Network Error," the app now informs the user that their data is invalid and reminds them of the password length constraint.

**Verification:**
- [x] Entering a 5-character password triggers an immediate "8 characters" alert.
- [x] Valid passwords continue to register and log in smoothly.
- [x] Other validation errors (like malformed emails) return a more descriptive message than before.

## Entry: April 23, 2026 (Continued)
### Task: Implement Password Visibility Toggle

**Objective:**
Improve user experience during login and registration by allowing users to toggle the visibility of their password.

**Changes Implemented in `frontend/src/components/AuthModal.jsx`:**

1.  **Visibility State Management:**
    - Added `showPassword` state using `useState(false)`.
    - Imported `Eye` and `EyeOff` icons from `lucide-react`.

2.  **UI Updates:**
    - Wrapped the password input in a `relative` container.
    - Added a `button` with an absolute position on the right side of the input field.
    - Dynamically toggled the input `type` between `password` and `text` based on the `showPassword` state.
    - **Result:** Users can now click the eye icon to verify what they have typed, reducing input errors.

**Verification:**
- [x] Clicking the icon successfully switches the input between hidden and plain text.
- [x] Icon changes from `Eye` to `EyeOff` appropriately.
- [x] Styling remains consistent with the rest of the form.

## Entry: April 23, 2026 (Continued)
### Task: Refactor Authentication to Responsive Modal (Bottom Sheet)

**Objective:**
Improve the user experience by replacing the standalone login page with a minimal, responsive modal that functions as a bottom sheet on mobile.

**Changes Implemented:**

1.  **New Component (`frontend/src/components/AuthModal.jsx`):**
    - Created a specialized modal for authentication using Framer Motion.
    - **Mobile UX:** Slides up from the bottom (Bottom Sheet style) with a visual handle.
    - **Desktop UX:** Transitions into a centered, floating modal box.
    - **Visuals:** Minimalist design (no logo), blurred backdrop (`backdrop-blur-sm`), and a dedicated close button.
    - **Interactions:** Supports closing via the "X" button or by clicking the background.

2.  **App Integration (`frontend/src/App.jsx`):**
    - Removed the `/auth` route from the router.
    - Added `isAuthModalOpen` state and an `openAuthModal` helper function.
    - Integrated the `AuthModal` at the top level of the application.

3.  **Feature Gating (`Navbar.jsx` & `ProductModal.jsx`):**
    - Updated all protected features to trigger the `AuthModal` instead of a page redirect:
        - **Navbar:** Outfit Builder, Image Search, Wardrobe, and Sell Item.
        - **Product Modal:** Add to Wardrobe and Chat with Vendor.
    - **Result:** Anonymous users can now explore the entire feed, but are seamlessly prompted to log in/sign up the moment they try to interact or use advanced features.

**Verification:**
- [x] Clicking "Image Search" as an anonymous user opens the modal.
- [x] Clicking the blurred background correctly closes the modal.
- [x] On mobile view, the modal behaves like a bottom sheet.
- [x] After successful login inside the modal, the modal closes and the user state is updated.

---

## Entry: May 18, 2026
### Task: In-Memory Caching Layer for Supabase Egress Reduction

**Objective:**
Reduce the number of database round-trips to Supabase by caching the results of expensive or frequently repeated read operations in the FastAPI process memory. The primary driver was staying within Supabase's egress bandwidth limits as traffic grows.

**Background:**
Every time a user loads the feed, views an item, opens the admin dashboard, or makes an authenticated request, the backend was hitting Supabase for fresh data. With pgvector embeddings (512 floats per item) being fetched even when not needed, and the personalised feed requiring multiple queries, egress was accumulating quickly. The fix has two parts: skip loading embeddings when they are not needed, and cache the results of reads so repeated requests reuse already-fetched data.

---

**Part 1 — Deferred Embedding Loads (`defer`)**

SQLAlchemy's `defer()` tells the ORM to exclude a column from the SELECT unless it is explicitly accessed. Since the 512-dimensional embedding vector is only needed during similarity search, it should never be loaded when just listing or displaying items.

Added `.options(defer(models.Item.embedding))` to every item query that does not perform a similarity sort:
- `GET /items` (the main feed)
- `GET /items/{item_id}` (single item detail)
- `GET /admin/items`

This alone cuts a significant chunk of egress because the embedding column is the largest column in the `items` table.

---

**Part 2 — TTL Cache Module (`backend/cache.py`)**

A new standalone module was created. It uses `cachetools.TTLCache`, which is a dictionary that automatically evicts entries after a configurable time-to-live. All cache instances live in the FastAPI process's heap (RAM), so no external service like Redis is needed.

**Cache instances created:**

| Cache | Max entries | TTL | Keyed by |
|---|---|---|---|
| `_feed_cache` | 512 | 5 min | query fingerprint string |
| `_item_cache` | 1024 | 5 min | `item_id` (int) |
| `_admin_cache` | 1 | 1 min | constant string `"stats"` |
| `_user_cache` | 512 | 5 min | `user_id` (int) |
| `_me_cache` | 512 | 5 min | `user_id` (int) |

Each cache has its own `threading.Lock` so concurrent requests don't corrupt entries. Every read acquires the lock, checks for a hit, and releases. Writes also acquire the lock before inserting.

**The `CachedUser` dataclass:**

ORM model objects cannot be stored in a cache — they are bound to a SQLAlchemy session, and once that session closes, accessing any attribute raises a `DetachedInstanceError`. To solve this, a plain Python dataclass was defined:

```python
@dataclass
class CachedUser:
    id: int
    email: str
    is_vendor: bool
    is_admin: bool
    vendor_id: Optional[int]
```

Whenever `get_current_user` fetches a user from the database, it immediately copies the needed fields into a `CachedUser` instance and stores that in `_user_cache`. Subsequent requests for the same user skip the DB query entirely and get back the dataclass.

---

**What gets cached and where:**

1. **User DB lookup** (`get_current_user` dependency)
   - Every authenticated request calls `get_current_user`. Without caching, this is a DB query on every single request.
   - After the first lookup, the result is stored as `CachedUser` in `_user_cache` for 5 minutes.
   - **Important:** JWT validation and the token blacklist check still run on every request, before the cache is consulted. The cache only skips the `SELECT * FROM users WHERE id = ?` query, not the security checks.

2. **`/auth/me` response** (`_me_cache`)
   - The `/auth/me` endpoint assembles a `UserInfo` object that includes vendor name, vendor ID, admin flag, etc. This used to require a user query + a vendor join.
   - The assembled `UserInfo` dict is cached per `user_id`. Subsequent calls return it instantly.

3. **Public feed / `GET /items`** (`_feed_cache`)
   - The feed is the most-hit endpoint. Its cache key encodes every parameter that affects the result:
     ```
     {user_segment}:{skip}:{limit}:{sort}:{vendor}:{seed}
     ```
     where `user_segment` is `u{user_id}` for logged-in users and `anon` for guests. This ensures one user's personalised feed is never returned to a different user.
   - A user with a wardrobe gets a different cache key from an anonymous visitor, even for the same page number.

4. **Single item detail / `GET /items/{item_id}`** (`_item_cache`)
   - A new endpoint was added specifically to support this cache. Item detail is keyed by `item_id` and cached for 5 minutes.

5. **Admin stats / `GET /admin/stats`** (`_admin_cache`)
   - Stats are aggregate counts (total users, total items, active vendors, etc.) and are fine to be slightly stale. Cached with a shorter 1-minute TTL since admins expect fresher data than the public feed.

---

**Cache invalidation — when caches are cleared:**

A cache that never clears becomes stale. Every endpoint that mutates data calls the appropriate invalidation function immediately after committing to the database:

| Mutation | Caches cleared |
|---|---|
| Vendor uploads a new item (`POST /upload`) | All feed entries, admin stats |
| Vendor deletes their item | All feed entries, that item's detail, admin stats |
| Vendor edits an item | All feed entries, that item's detail |
| User adds item to wardrobe | Only that user's feed entries (personalised feed changes) |
| User removes item from wardrobe | Only that user's feed entries |
| Admin toggles vendor visibility | All feed entries, admin stats |
| Admin deletes an item | All feed entries, that item's detail, admin stats |

For wardrobe changes, only the affected user's entries are evicted (`feed_invalidate_user`) rather than clearing the whole feed cache. This works by scanning cache keys for the prefix `u{user_id}:` and deleting only those matches.

---

**Security considerations:**

- The JWT blacklist check is **never cached**. Every authenticated request still hits the `blacklisted_tokens` table to confirm the token has not been invalidated by a logout. Caching this would allow a logged-out token to remain valid until the cache expires.
- Feed cache keys are user-specific. An anonymous visitor's cached feed and a logged-in user's personalised feed have different keys and can never be confused.

---

**Known limitation — process-local cache:**

`cachetools` stores data inside the running process's memory. This is completely effective when there is a single backend worker (e.g., a single Docker container on Railway). If the backend is ever scaled to multiple workers or replicas, each process will have its own independent cache — a cache hit on Worker A will still be a miss on Worker B. In that scenario, this module should be replaced with a shared external cache such as Redis (`fastapi-cache2` + `redis` library). The public API of `cache.py` is intentionally simple so this migration would only require changing the internals of that one file.

---

**Files changed:**

- `backend/cache.py` — new file, the entire caching module
- `backend/requirements.txt` — added `cachetools`
- `backend/main.py` — `import cache` added; caching logic added to `get_current_user`, `/auth/me`, `GET /items`, `GET /items/{item_id}` (new endpoint), `GET /admin/stats`; invalidation calls added to all mutation endpoints

**Verification:**
- [x] Feed loads on first request hit the database; subsequent identical requests return from cache (confirmed via `Cache HIT` log lines at DEBUG level).
- [x] Logging out and logging back in issues a fresh DB lookup — the old cached user entry is evicted.
- [x] Adding an item to the wardrobe evicts only that user's feed entries, not the entire feed cache.
- [x] Admin stats refresh within 1 minute after a vendor toggle or item deletion.
- [x] Embedding vectors are no longer fetched during item list or detail queries (confirmed by inspecting generated SQL with `echo=True`).
