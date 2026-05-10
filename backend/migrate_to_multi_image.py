
import sys
import os

# Add the current directory to sys.path so we can import local modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models

def migrate_images():
    # Ensure tables are created
    models.Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        items = db.query(models.Item).all()
        print(f"Found {len(items)} items to check for migration.")
        
        migration_count = 0
        for item in items:
            # Check if this item already has images in the new table
            if not item.images and item.image_path:
                print(f"Migrating item {item.id}: {item.name}")
                new_image = models.ItemImage(
                    item_id=item.id,
                    image_path=item.image_path,
                    cloudinary_public_id=item.cloudinary_public_id,
                    is_primary=True
                )
                db.add(new_image)
                migration_count += 1
        
        db.commit()
        print(f"Successfully migrated {migration_count} items.")
        
    except Exception as e:
        print(f"Migration failed: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    migrate_images()
