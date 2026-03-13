# This file defines the SearchEngine class for the Thrifter backend application. The SearchEngine is responsible for generating embeddings for text and images, which are used for search functionality within the application. It attempts to use a pre-trained model (CLIP) for generating embeddings, but if the model is not available, it falls back to simple heuristic-based embeddings. The text embedding method tokenizes the input text and creates a vector based on token frequencies, while the image embedding method processes the image to create a feature vector based on color and grayscale information. This allows the application to perform similarity searches even without access to a more sophisticated model, ensuring that search functionality remains available in all environments.
import numpy as np
import re
import hashlib
from PIL import Image

MODEL_NAME = "clip-ViT-B-32"
model = None
try:
    from sentence_transformers import SentenceTransformer
    model = SentenceTransformer(MODEL_NAME)
except Exception:
    model = None

def _simple_image_embedding(image: Image.Image):
    image = image.convert("RGB").resize((32, 32))
    arr = np.asarray(image, dtype=np.float32) / 255.0
    rgb_mean = arr.mean(axis=(0, 1))
    gray = image.convert("L").resize((16, 16))
    garr = np.asarray(gray, dtype=np.float32) / 255.0
    vec = np.concatenate([rgb_mean, garr.flatten()])
    n = np.linalg.norm(vec)
    return vec if n == 0 else vec / n

def _simple_text_embedding(text: str):
    tokens = re.findall(r"\w+", (text or "").lower())
    vec = np.zeros(128, dtype=np.float32)
    for t in tokens:
        h = int(hashlib.md5(t.encode()).hexdigest(), 16) % 128
        vec[h] += 1.0
    n = np.linalg.norm(vec)
    return vec if n == 0 else vec / n

class SearchEngine:
    def __init__(self):
        self.model = model

    def get_text_embedding(self, text: str):
        if self.model:
            return self.model.encode(text)
        return _simple_text_embedding(text)

    def get_image_embedding(self, image_path: str):
        image = Image.open(image_path)
        if self.model:
            return self.model.encode(image)
        return _simple_image_embedding(image)

    def get_image_embedding_from_file(self, image_file):
        image = Image.open(image_file)
        if self.model:
            return self.model.encode(image)
        return _simple_image_embedding(image)
