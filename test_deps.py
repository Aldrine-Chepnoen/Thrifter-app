# This script tests the dependencies required for the Thrifter application, specifically the PyTorch library and the SentenceTransformer model. It attempts to import PyTorch and load the "clip-ViT-B-32" model from the SentenceTransformer library, logging the results to a file called "deps_log.txt". The script captures any import errors or exceptions that occur during the process and writes them to the log file for troubleshooting purposes. This can help identify issues with missing or incompatible dependencies before running the main application.
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
