import os
import logging
import numpy as np
from sqlalchemy.orm import Session
from sqlalchemy import text
import models
from search_engine import SearchEngine
from typing import List, Dict
import time
import json

logger = logging.getLogger(__name__)

def parse_vector(text_val: str) -> np.ndarray:
    if not text_val:
        return np.zeros(512, dtype=np.float32)
    return np.fromstring(text_val.strip("[]"), sep=",", dtype=np.float32)

def run_clustering(db: Session, search_engine: SearchEngine):
    """
    Runs UMAP + HDBSCAN to discover styles, then updates style_categories table.
    """
    logger.info("Starting automated style discovery...")
    
    # 1. Fetch items with embeddings
    rows = db.execute(text("""
        SELECT id, embedding::text AS embedding_text
        FROM items
        WHERE embedding IS NOT NULL
    """)).fetchall()
    
    if not rows:
        logger.warning("No items with embeddings found for clustering.")
        return

    ids = [row.id for row in rows]
    embeddings = np.array([parse_vector(row.embedding_text) for row in rows])
    
    # Filter out zero vectors
    valid_mask = ~np.all(embeddings == 0, axis=1)
    if valid_mask.sum() < 10:
        logger.warning("Not enough items with embeddings for clustering.")
        return
        
    embeddings = embeddings[valid_mask]
    valid_ids = [ids[i] for i, m in enumerate(valid_mask) if m]

    # 2. Dimensionality Reduction (UMAP)
    try:
        import umap
        reducer = umap.UMAP(n_components=2, n_neighbors=15, min_dist=0.1, random_state=42)
        coords_2d = reducer.fit_transform(embeddings)
    except Exception as e:
        logger.error(f"UMAP failed: {e}")
        return

    # 3. Clustering (HDBSCAN)
    try:
        import hdbscan
        clusterer = hdbscan.HDBSCAN(min_cluster_size=5, min_samples=3)
        labels = clusterer.fit_predict(coords_2d)
    except Exception as e:
        logger.error(f"HDBSCAN failed: {e}")
        return

    unique_labels = set(labels)
    real_clusters = [l for l in unique_labels if l >= 0]
    
    logger.info(f"Discovered {len(real_clusters)} clusters.")

    # 4. Process each cluster
    for cluster_id in real_clusters:
        mask = labels == cluster_id
        cluster_embeddings = embeddings[mask]
        centroid = cluster_embeddings.mean(axis=0)
        
        # Search for existing styles with similar centroid
        existing_styles = db.query(models.StyleCategory).all()
        found_match = False
        for style in existing_styles:
            if style.centroid_embedding is not None:
                style_emb = np.array(style.centroid_embedding)
                # Cosine similarity
                sim = np.dot(centroid, style_emb) / (np.linalg.norm(centroid) * np.linalg.norm(style_emb))
                if sim > 0.95: 
                    # Update existing style's centroid
                    style.centroid_embedding = centroid.tolist()
                    found_match = True
                    break
        
        if not found_match:
            # Create a new pending style
            new_slug = f"discovered-style-{int(time.time())}-{cluster_id}"
            
            # Find sample items for preview
            centroid_str = "[" + ",".join(str(x) for x in centroid) + "]"
            samples = db.execute(text(f"""
                SELECT id FROM items 
                WHERE embedding IS NOT NULL 
                ORDER BY embedding <=> '{centroid_str}'::vector 
                LIMIT 5
            """)).fetchall()
            sample_ids = [s.id for s in samples]

            new_style = models.StyleCategory(
                slug=new_slug,
                name=f"New Style {cluster_id}",
                description="Automatically discovered style. Review and approve in Admin Dashboard.",
                centroid_embedding=centroid.tolist(),
                sample_item_ids=json.dumps(sample_ids),
                is_approved=False
            )
            db.add(new_style)
            
    db.commit()
    logger.info("Style discovery completed.")
