# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Thrifter is a fashion discovery app (MVP) with AI-powered image/text search, a Pinterest-style masonry grid, and vendor item uploads. Focused on Kampala/Uganda market.

**Stack:** FastAPI + PostgreSQL (pgvector) backend, React + Vite + Tailwind CSS frontend, FashionCLIP for embeddings, Cloudinary for image storage.

## Commands

### Backend (run from `backend/`)
```bash
# Activate venv first (Windows)
venv\Scripts\activate

# Run dev server
uvicorn main:app --reload

# Run database migrations
alembic upgrade head

# Generate a new migration after model changes
alembic revision --autogenerate -m "description"
```

### Frontend (run from `frontend/`)
```bash
npm run dev       # Dev server at http://localhost:5173
npm run build     # Production build
npm run lint      # ESLint
npm run preview   # Preview production build
```

## Environment Setup

Create `backend/.env` with:
```
DATABASE_URL=postgresql://postgres:postgres@localhost/thrifter
JWT_SECRET=your-secret-here
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
DEBUG=True
SEED_DEMO=False
FEATURE_OUTFIT_BUILDER_ENABLED=True
```

Create `frontend/.env` (optional):
```
VITE_API_BASE_URL=http://localhost:8000
```
In dev, `api.js` defaults to `http://localhost:8000`. In production it defaults to `/api`.

PostgreSQL must have the `pgvector` extension available (`CREATE EXTENSION IF NOT EXISTS vector`). The backend auto-creates tables on startup via `models.Base.metadata.create_all()`.

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
