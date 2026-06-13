from database import SessionLocal
from sqlalchemy import text
import models
import clustering
from main import search_engine
import time

db = SessionLocal()
try:
    count = db.execute(text("SELECT count(*) FROM items WHERE embedding IS NOT NULL")).scalar()
    print(f"Items with embeddings: {count}")
    
    styles_count = db.query(models.StyleCategory).count()
    print(f"Current style categories: {styles_count}")

    print("Forcing style discovery...")
    clustering.run_clustering(db, search_engine)
    
    # Update last run
    last_run = db.query(models.AppSetting).filter(models.AppSetting.key == "last_style_discovery").first()
    if not last_run:
        last_run = models.AppSetting(key="last_style_discovery", value_float=time.time())
        db.add(last_run)
    else:
        last_run.value_float = time.time()
    db.commit()
    
    new_styles_count = db.query(models.StyleCategory).count()
    print(f"New style categories count: {new_styles_count}")
    
finally:
    db.close()
