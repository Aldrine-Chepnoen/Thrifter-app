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
from collections import Counter
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger(__name__)

# Structured candidate labels for category-aware auto-labeling
CATEGORIZED_LABELS = {
    "top": [
        "t-shirt", "graphic tee", "polo shirt", "button-up shirt", "blouse",
        "crop top", "tank top", "sleeveless top", "long sleeve shirt",
        "striped shirt", "floral blouse", "oversized shirt", "linen shirt",
        "printed top", "casual shirt", "jacket", "denim jacket", "leather jacket",
        "blazer", "coat", "trench coat", "hoodie", "sweatshirt", "bomber jacket",
        "windbreaker", "cardigan", "zip-up hoodie", "safari jacket", "suit jacket",
        "African print top", "African print jacket", "retro jacket", "second hand blazer",
        "vintage shirt", "classic trench coat", "dress shirt", "jersey", "football jersey", "basketball jersey"
    ],
    "bottom": [
        "jeans", "denim jeans", "skinny jeans", "wide leg pants", "cargo pants",
        "trousers", "chinos", "shorts", "denim shorts", "leggings",
        "mini skirt", "maxi skirt", "pleated skirt", "pencil skirt", "wrap skirt",
        "formal trousers", "African print skirt", "vintage denim"
    ],
    "dress": [
        "mini dress", "midi dress", "maxi dress", "floral dress", "bodycon dress",
        "wrap dress", "sundress", "evening dress", "casual dress",
        "African print dress", "kitenge dress", "ankara dress", "shirt dress",
        "sleeveless dress", "formal dress", "vintage dress"
    ],
    "accessory": [
        "belt", "hat", "cap", "sunglasses", "scarf", "necklace",
        "earrings", "watch", "bracelet", "hair accessory",
        "sneakers", "heels", "sandals", "boots", "loafers", "flat shoes",
        "high heels", "platform shoes", "canvas shoes", "wedge shoes", "slip-ons",
        "handbag", "shoulder bag", "backpack", "tote bag", "clutch bag",
        "crossbody bag", "leather bag"
    ],
    "general": [
        "kitenge", "ankara print", "kanga", "dashiki"
    ]
}

def parse_vector(text_val: str) -> np.ndarray:
    if not text_val:
        return np.zeros(512, dtype=np.float32)
    return np.fromstring(text_val.strip("[]"), sep=",", dtype=np.float32)

def run_clustering(db: Session, se: SearchEngine):
    """
    Runs multi-dimensional UMAP + HDBSCAN to discover styles, 
    then updates style_categories table with category-aware labeling.
    """
    logger.info("Starting automated style discovery (refined)...")
    
    # 1. Fetch items with embeddings and types
    rows = db.execute(text("""
        SELECT id, item_type, embedding::text AS embedding_text
        FROM items
        WHERE embedding IS NOT NULL
    """)).fetchall()
    
    if not rows:
        logger.warning("No items with embeddings found for clustering.")
        return

    ids = [row.id for row in rows]
    item_types = [row.item_type or "top" for row in rows]
    embeddings = np.array([parse_vector(row.embedding_text) for row in rows])
    
    # Filter out zero vectors
    valid_mask = ~np.all(embeddings == 0, axis=1)
    if valid_mask.sum() < 10:
        logger.warning("Not enough items with embeddings for clustering.")
        return
        
    embeddings = embeddings[valid_mask]
    valid_ids = [ids[i] for i, m in enumerate(valid_mask) if m]
    valid_item_types = [item_types[i] for i, m in enumerate(valid_mask) if m]

    # 2. Dimensionality Reduction (UMAP)
    # Using multiple dimensions for clustering to preserve more "fashion DNA" than 2D
    n_components = 25 # High dimensions for high specialization
    try:
        import umap
        reducer = umap.UMAP(n_components=n_components, n_neighbors=7, min_dist=0.0, random_state=42)
        coords_multi = reducer.fit_transform(embeddings)
    except Exception as e:
        logger.error(f"UMAP failed: {e}")
        return

    # 3. Clustering (HDBSCAN) on multi-dimensional space
    try:
        import hdbscan
        # Lower min_cluster_size to 5 to allow smaller, more specialized groups to form
        clusterer = hdbscan.HDBSCAN(min_cluster_size=4, min_samples=1) 
        labels = clusterer.fit_predict(coords_multi)
    except Exception as e:
        logger.error(f"HDBSCAN failed: {e}")
        return

    unique_labels = set(labels)
    real_clusters = [l for l in unique_labels if l >= 0]
    noise_count = np.sum(labels == -1)
    total_valid = len(labels)
    noise_percent = (noise_count / total_valid) * 100 if total_valid > 0 else 0

    logger.info(f"Discovered {len(real_clusters)} clusters in {n_components}D space.")

    logger.info(f"Noise items: {noise_count} ({noise_percent:.1f}% of {total_valid} items)")

    # 4. Labeling & Consistency
    # Pre-embed all labels once
    all_label_texts = []
    for cat in CATEGORIZED_LABELS:
        all_label_texts.extend(CATEGORIZED_LABELS[cat])
    
    all_label_texts = list(set(all_label_texts))
    label_embs = {txt: se.get_text_embedding(txt) for txt in all_label_texts}

    used_labels_in_run = set()
    
    # Sort clusters by size (largest first) to give them priority on labels
    cluster_stats = []
    for cluster_id in real_clusters:
        mask = labels == cluster_id
        cluster_stats.append({
            "id": cluster_id,
            "count": mask.sum(),
            "mask": mask
        })
    cluster_stats.sort(key=lambda x: x["count"], reverse=True)

    for c in cluster_stats:
        mask = c["mask"]
        cluster_embeddings = embeddings[mask]
        centroid = cluster_embeddings.mean(axis=0)
        
        # Determine majority item_type
        c_types = [valid_item_types[i] for i, m in enumerate(mask) if m]
        majority_type = Counter(c_types).most_common(1)[0][0]
        
        # Candidate labels for this type + general
        type_candidates = CATEGORIZED_LABELS.get(majority_type, []) + CATEGORIZED_LABELS["general"]
        
        # Find best unused label
        best_label = f"Style Group {c['id']}" # Fallback
        max_sim = -1.0
        
        for candidate in type_candidates:
            if candidate in used_labels_in_run:
                continue
            
            cand_emb = label_embs[candidate]
            sim = np.dot(centroid, cand_emb) / (np.linalg.norm(centroid) * np.linalg.norm(cand_emb))
            
            if sim > max_sim:
                max_sim = sim
                best_label = candidate
        
        # Confidence threshold: if similarity is too low, use a generic descriptive label
        if max_sim < 0.2:
            best_label = f"Misc {majority_type.capitalize()} Group"
            
        # Ensure global uniqueness across the entire run, including 'Misc' fallbacks
        base_label = best_label
        counter = 1
        while best_label in used_labels_in_run:
            best_label = f"{base_label} {counter}"
            counter += 1
            
        used_labels_in_run.add(best_label)

        # 5. Stability: Search for existing visual clusters with similar centroid
        existing_clusters = db.query(models.VisualCluster).all()
        found_match = False
        for vc in existing_clusters:
            if vc.centroid_embedding is not None:
                vc_emb = np.array(vc.centroid_embedding)
                sim = np.dot(centroid, vc_emb) / (np.linalg.norm(centroid) * np.linalg.norm(vc_emb))
                if sim > 0.95: 
                    # Update existing cluster
                    vc.centroid_embedding = centroid.tolist()
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
            # Create new visual cluster
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
    logger.info("Refined style discovery completed.")
