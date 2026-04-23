# This file defines the SearchEngine class for the Thrifter backend application. The SearchEngine is responsible for generating embeddings for text and images, which are used for search functionality within the application. It attempts to use a pre-trained model (CLIP) for generating embeddings, but if the model is not available, it falls back to simple heuristic-based embeddings. The text embedding method tokenizes the input text and creates a vector based on token frequencies, while the image embedding method processes the image to create a feature vector based on color and grayscale information. This allows the application to perform similarity searches even without access to a more sophisticated model, ensuring that search functionality remains available in all environments.
import numpy as np
import re
import hashlib
from PIL import Image, ImageFile

# Allow loading of truncated images
ImageFile.LOAD_TRUNCATED_IMAGES = True

MODEL_NAME = "patrickjohncyh/fashion-clip"
model = None
processor = None

try:
    from transformers import CLIPProcessor, CLIPModel
    import torch
    
    # Load model and processor directly from transformers
    model = CLIPModel.from_pretrained(MODEL_NAME)
    processor = CLIPProcessor.from_pretrained(MODEL_NAME)
    # Set to evaluation mode
    model.eval()
except Exception as e:
    print(f"Error loading FashionCLIP: {e}")
    model = None
    processor = None

def _simple_image_embedding(image: Image.Image):
    # (Existing fallback remains the same)
    image = image.convert("RGB").resize((32, 32))
    arr = np.asarray(image, dtype=np.float32) / 255.0
    rgb_mean = arr.mean(axis=(0, 1))
    gray = image.convert("L").resize((16, 16))
    garr = np.asarray(gray, dtype=np.float32) / 255.0
    vec = np.concatenate([rgb_mean, garr.flatten()])
    n = np.linalg.norm(vec)
    return vec if n == 0 else vec / n

def _simple_text_embedding(text: str):
    # (Existing fallback remains the same)
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
        self.processor = processor

    def get_text_embedding(self, text: str):
        if self.model and self.processor:
            import torch
            with torch.no_grad():
                inputs = self.processor(text=[text], return_tensors="pt", padding=True)
                text_features = self.model.get_text_features(**inputs).pooler_output
                # Normalize
                text_features = text_features / text_features.norm(dim=-1, keepdim=True)
                return text_features.cpu().numpy()[0]
        return _simple_text_embedding(text)

    def get_image_embedding(self, image_path: str):
        image = Image.open(image_path)
        return self.get_image_embedding_from_file(image)

    def get_image_embedding_from_file(self, image_file):
        # image_file can be a stream or a PIL image
        if isinstance(image_file, Image.Image):
            image = image_file
        else:
            image = Image.open(image_file)
            
        if self.model and self.processor:
            import torch
            with torch.no_grad():
                inputs = self.processor(images=image, return_tensors="pt")
                image_features = self.model.get_image_features(**inputs).pooler_output
                # Normalize
                image_features = image_features / image_features.norm(dim=-1, keepdim=True)
                return image_features.cpu().numpy()[0]
        return _simple_image_embedding(image)
