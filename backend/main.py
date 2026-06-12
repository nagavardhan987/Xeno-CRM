import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os

from database import SessionLocal, engine
from models import Base, Customer
from init_db import initialize_database
from seed_data import seed_db

# Import routers
from routers import customers, segments, campaigns, receipt, ai

app = FastAPI(
    title="Xeno CRM Copilot API",
    description="Backend API for AI-Native Mini CRM",
    version="1.0.0"
)

# Configure CORS
# Allow frontend to connect
origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000"
]

frontend_url = os.getenv("FRONTEND_URL")
if frontend_url:
    origins.append(frontend_url.rstrip("/"))

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(customers.router)
app.include_router(segments.router)
app.include_router(campaigns.router)
app.include_router(receipt.router)
app.include_router(ai.router)

@app.on_event("startup")
def on_startup():
    print("FastAPI Backend Starting Up...")
    # Initialize tables
    initialize_database()
    
    # Check if customers table is empty, seed if so
    db = SessionLocal()
    try:
        customer_count = db.query(Customer).count()
        if customer_count == 0:
            print("Database empty. Seeding customer data...")
            seed_db()
        else:
            print(f"Database contains {customer_count} customers. Skipping seeding.")
    except Exception as e:
        print(f"Startup check failed: {e}")
    finally:
        db.close()

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "crm-backend"}

if __name__ == "__main__":
    # Get port from environment or default to 8002 to avoid Windows TCP ghost bugs on 8000
    port = int(os.getenv("PORT", 8002))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)

# Trigger reload 3
