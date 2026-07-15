# Image storage layer backed by Cloudflare R2 (S3-compatible).
# Variants are generated at upload time with Pillow instead of on-demand:
# each image is stored as an original plus WebP variants at VARIANT_WIDTHS,
# under a shared key base, e.g.
#   items/1751800000-a1b2c3d4e5f6/orig
#   items/1751800000-a1b2c3d4e5f6/w200.webp
#   items/1751800000-a1b2c3d4e5f6/w600.webp
#   items/1751800000-a1b2c3d4e5f6/w800.webp
# The DB stores the public URL of the largest variant; smaller variants are
# derived from it by swapping the /wNNN.webp suffix (see frontend utils.js).
import io
import logging
import secrets
import threading
import time
from typing import List

import boto3
from PIL import Image, ImageOps

from config import settings

logger = logging.getLogger(__name__)

VARIANT_WIDTHS = [200, 600, 800]
LARGEST_WIDTH = VARIANT_WIDTHS[-1]
WEBP_QUALITY = 80

_client = None
_client_lock = threading.Lock()


def is_configured() -> bool:
    return all([
        settings.R2_ACCOUNT_ID,
        settings.R2_ACCESS_KEY_ID,
        settings.R2_SECRET_ACCESS_KEY,
        settings.R2_BUCKET_NAME,
        settings.R2_PUBLIC_BASE_URL,
    ])


def _public_base() -> str:
    return settings.R2_PUBLIC_BASE_URL.rstrip("/")


def _get_client():
    global _client
    if _client is None:
        with _client_lock:
            if _client is None:
                _client = boto3.client(
                    "s3",
                    endpoint_url=f"https://{settings.R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
                    aws_access_key_id=settings.R2_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
                    region_name="auto",
                )
    return _client


def is_r2_url(url) -> bool:
    return bool(url) and is_configured() and str(url).startswith(_public_base() + "/")


def variant_url(url: str, width: int) -> str:
    """Given any variant URL, return the URL of the smallest variant >= width."""
    target = next((w for w in VARIANT_WIDTHS if w >= width), LARGEST_WIDTH)
    base, _, _ = url.rpartition("/")
    return f"{base}/w{target}.webp"


def upload_image(image_bytes: bytes, folder: str) -> str:
    """Uploads an original plus WebP variants to R2. Returns the public URL of
    the largest variant. Raises on any failure — caller is responsible for
    rollback via delete_image()."""
    if not is_configured():
        raise RuntimeError("R2 storage is not configured (missing R2_* env vars)")

    img = Image.open(io.BytesIO(image_bytes))
    original_mime = Image.MIME.get(img.format, "application/octet-stream")
    # Bake in EXIF rotation so resized variants aren't sideways
    img = ImageOps.exif_transpose(img)
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")

    key_base = f"{folder}/{int(time.time())}-{secrets.token_hex(8)}"
    client = _get_client()
    bucket = settings.R2_BUCKET_NAME
    cache_headers = {"CacheControl": "public, max-age=31536000, immutable"}

    client.put_object(
        Bucket=bucket,
        Key=f"{key_base}/orig",
        Body=image_bytes,
        ContentType=original_mime,
        **cache_headers,
    )

    for width in VARIANT_WIDTHS:
        variant = img.copy()
        if variant.width > width:
            height = round(variant.height * width / variant.width)
            variant = variant.resize((width, height), Image.LANCZOS)
        buf = io.BytesIO()
        variant.save(buf, format="WEBP", quality=WEBP_QUALITY)
        client.put_object(
            Bucket=bucket,
            Key=f"{key_base}/w{width}.webp",
            Body=buf.getvalue(),
            ContentType="image/webp",
            **cache_headers,
        )

    return f"{_public_base()}/{key_base}/w{LARGEST_WIDTH}.webp"


def _keys_for_url(url: str) -> List[str]:
    key_base, _, _ = str(url)[len(_public_base()) + 1:].rpartition("/")
    if not key_base:
        return []
    return [f"{key_base}/orig"] + [f"{key_base}/w{w}.webp" for w in VARIANT_WIDTHS]


def delete_image(url: str) -> None:
    """Deletes the original and all variants for an R2 image URL.
    Logs and swallows errors — orphaned files are preferable to failed deletes."""
    if not is_r2_url(url):
        return
    keys = _keys_for_url(url)
    if not keys:
        return
    try:
        _get_client().delete_objects(
            Bucket=settings.R2_BUCKET_NAME,
            Delete={"Objects": [{"Key": k} for k in keys], "Quiet": True},
        )
    except Exception as e:
        logger.error(f"R2 delete failed for {url}: {e}")
