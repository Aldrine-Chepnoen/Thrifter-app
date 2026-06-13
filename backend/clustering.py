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

from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)

# Candidate label phrases — tuned for East African / Kampala thrift market.
CANDIDATE_LABELS = [
    # Tops
    "t-shirt", "graphic tee", "polo shirt", "button-up shirt", "blouse",
    "crop top", "tank top", "sleeveless top", "long sleeve shirt",
    "striped shirt", "floral blouse", "oversized shirt", "linen shirt",
    "printed top", "casual shirt",
    # Bottoms
    "jeans", "denim jeans", "skinny jeans", "wide leg pants", "cargo pants",
    "trousers", "chinos", "shorts", "denim shorts", "leggings",
    "mini skirt", "maxi skirt", "pleated skirt", "pencil skirt", "wrap skirt",
    # Dresses
    "mini dress", "midi dress", "maxi dress", "floral dress", "bodycon dress",
    "wrap dress", "sundress", "evening dress", "casual dress",
    "African print dress", "kitenge dress", "ankara dress", "shirt dress",
    "sleeveless dress",
    # Outerwear
    "jacket", "denim jacket", "leather jacket", "blazer", "coat",
    "trench coat", "hoodie", "sweatshirt", "bomber jacket",
    "windbreaker", "cardigan", "zip-up hoodie", "safari jacket",
    # Shoes
    "sneakers", "heels", "sandals", "boots", "loafers", "flat shoes",
    "high heels", "platform shoes", "canvas shoes", "wedge shoes", "slip-ons",
    # Bags
    "handbag", "shoulder bag", "backpack", "tote bag", "clutch bag",
    "crossbody bag", "leather bag",
    # Accessories
    "belt", "hat", "cap", "sunglasses", "scarf", "necklace",
    "earrings", "watch", "bracelet", "hair accessory",
    # African / regional
    "kitenge", "ankara print", "African print top", "kanga", "dashiki",
    "African print skirt", "African print jacket",
    # Vintage / thrift styles
    "vintage denim", "retro jacket", "second hand blazer", "vintage dress",
    "vintage shirt", "classic trench coat",
    # Suits / formal
    "suit jacket", "formal trousers", "dress shirt", "formal dress",
]

def parse_vector(text_val: str) -> np.ndarray:
    if not text_val:
        return np.zeros(512, dtype=np.float32)
    return np.fromstring(text_val.strip("[]"), sep=",", dtype=np.float32)

def run_clustering(db: Session, se: SearchEngine):
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

    # Pre-embed candidate labels
    logger.info(f"Embedding {len(CANDIDATE_LABELS)} candidate labels...")
    candidate_embs = np.array([se.get_text_embedding(p) for p in CANDIDATE_LABELS])

    # 4. Process each cluster
    for cluster_id in real_clusters:
        mask = labels == cluster_id
        cluster_embeddings = embeddings[mask]
        centroid = cluster_embeddings.mean(axis=0)
        
        # Find best AI label
        sims = cosine_similarity(centroid.reshape(1, -1), candidate_embs)[0]
        best_idx = int(sims.argmax())
        best_label = CANDIDATE_LABELS[best_idx]

        # Search for existing visual clusters with similar centroid
        existing_clusters = db.query(models.VisualCluster).all()
        found_match = False
        for vc in existing_clusters:
            if vc.centroid_embedding is not None:
                vc_emb = np.array(vc.centroid_embedding)
                # Cosine similarity
                sim = np.dot(centroid, vc_emb) / (np.linalg.norm(centroid) * np.linalg.norm(vc_emb))
                if sim > 0.95: 
                    # Update existing cluster
                    vc.centroid_embedding = centroid.tolist()
                    # Only update ai_label if the custom_name is not set (admin hasn't renamed it)
                    if not vc.custom_name:
                        vc.ai_label = best_label
                    
                    # Update samples
                    centroid_str = "[" + ",".join(str(x) for x in centroid) + "]"
                    samples = db.execute(text(f"""
                        SELECT id FROM items 
                        WHERE embedding IS NOT NULL 
                        ORDER BY embedding <=> '{centroid_str}'::vector 
                        LIMIT 5
                    """)).fetchall()
                    vc.sample_item_ids = json.dumps([s.id for s in samples])
                    
                    found_match = True
                    break
        
        if not found_match:
            # Find sample items for preview
            centroid_str = "[" + ",".join(str(x) for x in centroid) + "]"
            samples = db.execute(text(f"""
                SELECT id FROM items 
                WHERE embedding IS NOT NULL 
                ORDER BY embedding <=> '{centroid_str}'::vector 
                LIMIT 5
            """)).fetchall()
            sample_ids = [s.id for s in samples]

            new_vc = models.VisualCluster(
                ai_label=best_label,
                centroid_embedding=centroid.tolist(),
                sample_item_ids=json.dumps(sample_ids)
            )
            db.add(new_vc)
            
    db.commit()
    logger.info("Style discovery completed.")

