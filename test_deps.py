import sys

with open("deps_log.txt", "w") as f:
    f.write("Starting import test...\n")
    try:
        import torch
        f.write("Imported torch\n")
    except ImportError as e:
        f.write(f"Failed to import torch: {e}\n")

    try:
        from sentence_transformers import SentenceTransformer
        f.write("Imported sentence_transformers\n")
        model = SentenceTransformer("clip-ViT-B-32")
        f.write("Loaded model\n")
    except Exception as e:
        f.write(f"Failed to load model: {e}\n")

    f.write("Test complete\n")
