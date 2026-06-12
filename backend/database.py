import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("DATABASE_URL is not set in environment variables")

# Adjust pgbouncer connection string if necessary
# Pgbouncer transaction mode doesn't support prepared statements,
# so we disable statement caching for SQLAlchemy.
engine = create_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_recycle=300,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
