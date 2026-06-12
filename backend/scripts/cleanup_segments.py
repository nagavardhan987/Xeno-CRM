import sys
import os
import ast
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

from database import SessionLocal
from models import Segment

def run_cleanup():
    db = SessionLocal()
    try:
        segments = db.query(Segment).order_by(Segment.id.asc()).all()
        
        # 1. Clean up duplicate names, keep the latest one (highest ID)
        seen_names = {}
        duplicates_to_delete = []
        
        for s in segments:
            name = s.name
            if name in seen_names:
                # Add the older one to delete list, keep the newer one
                duplicates_to_delete.append(seen_names[name])
                seen_names[name] = s
            else:
                seen_names[name] = s
                
        # Delete duplicates
        for dup in duplicates_to_delete:
            print(f"Deleting duplicate segment: {dup.name} (ID: {dup.id})")
            db.delete(dup)
            
        # 2. Fix filter serialization for remaining segments
        for s in seen_names.values():
            if isinstance(s.filters, dict):
                cleaned = {}
                for k, v in s.filters.items():
                    if isinstance(v, str):
                        try:
                            parsed = ast.literal_eval(v)
                            cleaned[k] = parsed
                        except Exception:
                            cleaned[k] = v
                    else:
                        cleaned[k] = v
                
                if cleaned != s.filters:
                    print(f"Fixing filters for segment: {s.name} (ID: {s.id})")
                    s.filters = cleaned
        
        db.commit()
        print("Cleanup successful.")
    except Exception as e:
        db.rollback()
        print(f"Error during cleanup: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    run_cleanup()
