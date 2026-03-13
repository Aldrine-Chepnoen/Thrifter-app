# Architecture Notes – Shopping Web App

## Purpose of this document
This file explains how the system is structured and how the parts work together.
It is written for someone learning the codebase.

---

## High-level overview
- Frontend: (React / location)
- Backend: (Python / framework)
- Database: (type, if known)
- Communication: (HTTP / REST / other)

---

## Frontend
Location:
- 

Entry point:
- 

Key folders:
- 

What the frontend is responsible for:
- 

---

## Backend
Location:
- 

Framework:
- 

Entry point:
- 

Key folders:
- package.json- This file is the package.json for the frontend of the Thrifter application. It defines the project metadata, dependencies, and scripts for building and running the frontend. The dependencies include React, React Router, Axios, and various development tools such as Vite, ESLint, and Tailwind CSS. The scripts section provides commands for starting the development server, building the application, linting the code, and previewing the production build.

What the backend is responsible for:
- 

---

## Data model (high level)
Main entities:
- User
- Product
- Order
- Cart
(verify as you explore)

---

## Request flow example
Example: “User views products”
1. Browser loads React page
2. React calls API endpoint
3. Backend processes request
4. Data is returned and rendered

---

## Notes / Questions
Full tech stack
 ### Frontend
  -React 18-        UI framework
  -Vite-            Build tool and dev server
  -React Router v6- Client-side routing
  -Tailwind CSS-    Utility-first styling
  -Frame Motion-    Animations
  -Axios-           Http requests to the backend
  -Lucide React-    Icon library
 ### Backend
  -FastAPI(Python)-                 REST API framework
  -SQLAlchemy-                      ORM for database models and queries
  -Alembic-                         Database migrations
  -Pydantic/pydantic-settings-      data validation and settings management
  -PyJWT-                           JWT token generation and verification
  -SlowAPI-                         rate limiting on auth and search endpoints
  -Sentence Transformers + PyTorch- CLIP model for generating image embeddings(power the visual search)
  -scikit-learn-                    cosine similarity calculations for outfit matching
  -Pillow-                          image processing
  -python-dotenv-                   loading .env config
 ### Database
  -PostgreSQL(hosted on Supabase)- Primary database
  -pgvector-                       PostgreSQL extension for storing and queryng 512-dimension vector embeddings(used for AI image similarity search)
### Storage
  -Cloudinary- cloud storage and CDN for product images, with auto-compression and WebP conversion on upload
### Infrastructure
  -Docker-         both frontend and backend are containerised
  -Docker Compose- orchastrates the two containers together
  -Nginx-          serves the built React app and proxies /api requests to the FastAPI backend
  -Uvicorn-        ASGI server that runs the FastAPI app inside the backend container

- 
