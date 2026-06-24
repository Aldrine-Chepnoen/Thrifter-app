# This is the database configuration and setup file for the Thrifter backend application. It uses SQLAlchemy to manage database connections and interactions. The DATABASE_URL is loaded from the environment variables, allowing for flexible configuration across different environments (development, testing, production). The engine is created with appropriate pooling configurations for production use, while SQLite is handled with specific connection arguments. The SessionLocal class is defined to create database sessions, and a Base class is created for declarative models. The get_db function is a dependency that provides a database session for API endpoints, ensuring that sessions are properly closed after use. This setup allows for efficient and secure database interactions throughout the application.
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

from config import settings

# Use settings from config.py
DATABASE_URL = settings.DATABASE_URL

# Pooling configuration for production
# SQLite doesn't support pool_size, so we only apply it for other DBs
if DATABASE_URL.startswith("sqlite"):
    engine = create_engine(
        DATABASE_URL, 
        connect_args={"check_same_thread": False}
    )
else:
    engine = create_engine(
        DATABASE_URL,
        pool_size=20,
        max_overflow=10,
        pool_timeout=30,
        pool_recycle=1800,
        pool_pre_ping=True,
        connect_args={
            "keepalives": 1,
            "keepalives_idle": 60,
            "keepalives_interval": 10,
            "keepalives_count": 5,
        }
    )
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
