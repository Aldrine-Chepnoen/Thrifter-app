import json
from sqlalchemy.orm import Session
from sqlalchemy import text
from database import SessionLocal
import models

def fix_missing_sample_item_ids():
    """
    Populates sample_item_ids for existing style categories by finding the 5 items 
    closest to their centroid embedding.
    """
    db = SessionLocal()
    try:
        styles = db.query(models.StyleCategory).all()
        print(f"Checking {len(styles)} styles...")
        
        for style in styles:
            if not style.centroid_embedding:
                print(f"Skipping style {style.id}: no centroid.")
                continue
                
            # Convert centroid to pgvector format
            centroid_str = "[" + ",".join(str(x) for x in style.centroid_embedding) + "]"
            
            # Find 5 closest items
            query = text(f"""
                SELECT id FROM items 
                WHERE embedding IS NOT NULL 
                ORDER BY embedding <=> '{centroid_str}'::vector 
                LIMIT 5
            """)
            samples = db.execute(query).fetchall()
            sample_ids = [s.id for s in samples]
            
            if sample_ids:
                style.sample_item_ids = json.dumps(sample_ids)
                print(f"Style {style.id} ({style.name}): Updated with {len(sample_ids)} samples.")
            else:
                print(f"Style {style.id}: No items found nearby.")
        
        db.commit()
        print("Done!")
    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_missing_sample_item_ids()
