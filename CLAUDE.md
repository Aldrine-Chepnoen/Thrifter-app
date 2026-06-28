# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Thrifter is a live, production fashion discovery platform targeting the Kampala/Uganda market. It has 1,200+ registered users and 600+ items uploaded. The immediate roadmap includes major feature improvements, a mobile app, and a payment system.

Treat all changes with production-level care — real users are actively using this. Prefer safe, incremental changes over broad refactors, and flag anything that could affect data integrity or user-facing reliability.

**Stack:** FastAPI + PostgreSQL (pgvector) backend, React + Vite + Tailwind CSS frontend, FashionCLIP for embeddings, Cloudinary for image storage.

## Dev Environment (Docker)

The dev environment runs via Docker Compose from the project root. The venv/direct approach in older notes is superseded by this.

```bash
docker compose up          # Start backend + frontend (rebuilds if needed)
docker compose up --build  # Force rebuild (after Dockerfile or dependency changes)
docker compose down        # Stop all services
```

- **Backend** runs at `http://localhost:8000` — uvicorn with `--reload`, so code changes in `backend/` apply instantly without a container restart.
- **Frontend** runs at `http://localhost:5173` — Vite dev server with hot reload; `npm install` runs automatically on container start.
- Both services mount local directories as volumes (`./backend:/app`, `./frontend:/app`), so switching git branches takes effect live — no restart required.

**Database migrations** must be run inside the backend container:
```bash
docker compose exec backend alembic upgrade head
docker compose exec backend alembic revision --autogenerate -m "description"
```

**Other useful frontend commands** (run inside the container):
```bash
docker compose exec frontend npm run build
docker compose exec frontend npm run lint
```

## Environment Setup

`backend/.env` is loaded automatically by pydantic-settings (mounted into the container at `/app/.env`). Create it with:
```
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
JWT_SECRET=your-secret-here
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
DEBUG=True
SEED_DEMO=False
JWT_EXP_SECONDS=2592000
```

The database is hosted on **Supabase** (managed PostgreSQL). The app connects to it via a standard SQLAlchemy connection string — no Supabase-specific SDK is used. pgvector is enabled on the Supabase instance by default; no manual `CREATE EXTENSION` is needed. The connection string is available in the Supabase dashboard under Project Settings → Database.

`VITE_API_BASE_URL` is set to `http://localhost:8000` in `docker-compose.yml` — no separate `frontend/.env` needed in dev. In production it defaults to `/api`.

The backend auto-creates tables on startup via `models.Base.metadata.create_all()`.

On first run the FashionCLIP model (`patrickjohncyh/fashion-clip`, ~300MB) is downloaded automatically.

## Architecture

### Backend (`backend/`)

All API routes live in **`main.py`** — there is no router splitting. Key modules:

- `config.py` — `pydantic-settings` loading from `.env`; import `settings` everywhere
- `database.py` — SQLAlchemy engine (pool configured for prod) and `get_db` dependency
- `models.py` — SQLAlchemy ORM models
- `schemas.py` — Pydantic request/response schemas
- `search_engine.py` — `SearchEngine` class wrapping FashionCLIP; falls back to a simple heuristic embedding if the model fails to load

**Database models:** `User`, `Vendor`, `Item`, `ItemImage`, `BlacklistedToken`, `Wardrobe`

**Dual image columns on `Item`:** Items have both legacy `image_path`/`cloudinary_public_id` columns and a new `ItemImage` relationship (up to 3 images per item). The `serialize_item()` function in `main.py` bridges both: it prefers the new `ItemImage` table but falls back to the legacy columns. Always use `serialize_item()` when returning items.

**Personalized feed (`_personalised_feed`):** Builds a recency-weighted embedding profile from the user's wardrobe (up to 15 most recent items), then mixes pgvector similarity results with random discovery. The mix starts at 90% similar / 10% random on page 1 and fades to 10% / 90% by page 10+. Falls back to pure random if the user has no wardrobe embeddings.

**Search:** Combines pgvector L2 distance (top 40 semantic results) with SQL keyword ILIKE (top 20), deduped, capped at 30 results.

**Auth flow:** JWT (HS256) with blacklisting on logout. Blacklisted tokens are stored in the `blacklisted_tokens` table and checked on every request. Rate limits: register 5/min, login 10/min, search 30/min.

**Item upload:** Atomic — if any Cloudinary upload fails mid-loop, all previously uploaded assets are destroyed and the DB transaction is rolled back.

### Frontend (`frontend/src/`)

- `App.jsx` — Root component owning all application state (items, user, search results, feed pagination, wardrobe). Passes callbacks down to children; no global state library.
- `api.js` — Axios instance with auth interceptor (reads `thrifter_token` from localStorage) and 401 auto-logout.
- `components/` — `Navbar`, `MasonryGrid`, `ItemCard`, `ProductModal`, `UploadForm`, `VendorPage`, `AuthModal`, `Auth`

**Routes:** `/` (feed), `/upload` (vendor-only), `/vendor/:name`, `/outfit-builder`, `/wardrobe`

**Infinite scroll:** Implemented via a scroll event listener in `App.jsx`. A stable `feedSeed` (set once on mount, range -1 to 1 for Postgres `setseed()`) is passed with paginated requests to keep random ordering consistent across pages.

**Analytics:** PostHog is initialized in `main.jsx` and used in `App.jsx` for `image_search_performed` and `outfit_builder_performed` events. User identity is set after login/session restore.
