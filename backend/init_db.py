import sys
import os
# Ensure backend directory is in python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import engine
from models import Base

def initialize_database():
    print("Connecting to database and creating tables...")
    try:
        Base.metadata.create_all(bind=engine)
        print("Tables created successfully!")
    except Exception as e:
        print(f"Error creating tables: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    initialize_database()
