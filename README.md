# Thrifter - Fashion Discovery MVP

This is a Phase One MVP for **Thrifter**, a fashion discovery app featuring AI image search, a Pinterest-style masonry grid, and vendor uploads.

## Prerequisites

1.  **Python 3.9+**
2.  **Node.js 16+**
3.  **PostgreSQL** (running locally)

## Project Structure

-   `backend/`: FastAPI application with CLIP image search.
-   `frontend/`: React + Vite application.

## Setup Instructions

### 1. Database Setup

Ensure PostgreSQL is running and create a database named `thrifter`.

```sql
CREATE DATABASE thrifter;
```

### 2. Backend Setup

Navigate to the `backend` directory:

```bash
cd backend
```

Create a virtual environment (optional but recommended):

```bash
python -m venv venv
# Windows
venv\Scripts\activate
# Mac/Linux
source venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Run the server:

```bash
uvicorn main:app --reload
```

The backend will start at `http://localhost:8000`.
On the first run, it will download the CLIP model (approx. 300MB), which may take a moment.

### 3. Frontend Setup

Open a new terminal and navigate to the `frontend` directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

The frontend will start at `http://localhost:5173`.

## Features

-   **Feed**: Masonry grid layout of fashion items.
-   **Search**: Real-time text search by name, aesthetic, etc.
-   **AI Image Search**: Click the camera icon, upload an image, and see visually similar items from the database (powered by OpenAI's CLIP).
-   **Upload**: Vendors can list items with photos and WhatsApp details.
-   **WhatsApp Integration**: "Shop Now" button opens a direct WhatsApp chat with the vendor.

## Tech Stack

-   **Backend**: FastAPI, SQLAlchemy, PostgreSQL, Sentence-Transformers (CLIP).
-   **Frontend**: React, Vite, Tailwind CSS, Framer Motion.
