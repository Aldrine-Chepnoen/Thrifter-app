import os
import sys
import io
import urllib.request
from PIL import Image
from sqlalchemy.orm import Session
from database import SessionLocal
import models
from search_engine import SearchEngine

def reindex():
    print("🚀 Starting FashionCLIP re-indexing...")
    db: Session = SessionLocal()
    search_engine = SearchEngine()
    
    if not search_engine.model:
        print("❌ Error: FashionCLIP model failed to load. Check your internet or dependencies.")
        return

    items = db.query(models.Item).all()
    total = len(items)
    print(f"📦 Found {total} items to process.")

    for idx, item in enumerate(items, 1):
        print(f"[{idx}/{total}] Processing: {item.name}...", end="\r")
        
        try:
            # Download image from image_path (Cloudinary URL or local path)
            image_url = item.image_path
            if not image_url:
                continue
                
            if image_url.startswith("http"):
                # Download from URL
                with urllib.request.urlopen(image_url) as resp:
                    image_data = resp.read()
            else:
                # Load from local disk (for demo items)
                img_path = os.path.join("images", image_url)
                if os.path.exists(img_path):
                    with open(img_path, "rb") as f:
                        image_data = f.read()
                else:
                    print(f"\n⚠️ Skip: Local image not found: {img_path}")
                    continue

            # Generate new embedding
            image_stream = io.BytesIO(image_data)
            new_emb = search_engine.get_image_embedding_from_file(image_stream)
            
            # Update item in database
            item.embedding = new_emb.tolist()
            db.add(item)
            
            # Commit every 5 items to save progress
            if idx % 5 == 0:
                db.commit()
                
        except Exception as e:
            print(f"\n❌ Error processing item {item.id} ({item.name}): {e}")
            continue

    db.commit()
    print(f"\n✅ Finished! Successfully re-indexed {total} items with FashionCLIP.")
    db.close()

if __name__ == "__main__":
    reindex()
