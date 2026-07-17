"""One-off migration of legacy Cloudinary-hosted images to R2 (Phase F3).

For every image row whose image_path is still a Cloudinary (or other http)
URL, this downloads the original, uploads it to R2 via the same
storage.upload_image() the app uses (original + WebP variants), and updates
image_path to the returned R2 URL. cloudinary_public_id is left untouched and
NOTHING is deleted from Cloudinary — the existing assets become the fallback
layer served to users on ISPs that block the R2 domain.

Each row is committed as it finishes, and the worklist is simply "rows whose
image_path is not yet an R2 URL" — so the script can be interrupted and rerun
at any time and it continues where it stopped.

Covers: item_images, items (legacy single-image rows), vendor banners,
style covers. Rows with non-http paths (ancient local-file era) are reported
and skipped.

Run order note: deploy the fallback-aware backend + frontend (F4) BEFORE this
script — once a row flips to R2, blocked users need the fallback logic live.

Usage:
    python migrate_to_r2.py --dry-run       # counts only, no changes
    python migrate_to_r2.py --limit 5       # trial: migrate 5 images, then stop
    python migrate_to_r2.py                 # full migration
"""
import argparse
import io
import os
import sys
import time
import urllib.request

import psycopg2
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

import storage  # noqa: E402  (reads the same .env via config)

DOWNLOAD_TIMEOUT = 30


def fetch_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "thrifter-migrate/1.0"})
    with urllib.request.urlopen(req, timeout=DOWNLOAD_TIMEOUT) as r:
        data = r.read()
    if not data:
        raise RuntimeError("empty response body")
    return data


def build_worklist(cur, r2_prefix: str):
    """Returns (tasks, local_era_skips). Each task is a dict describing one
    image to migrate and how to write its new URL back."""
    not_r2 = "LIKE 'http%%' AND {col} NOT LIKE %(r2)s"
    params = {"r2": r2_prefix + "%"}
    tasks = []

    # 1. Multi-image era: item_images rows (also sync items.image_path when it
    # mirrors the migrated row, so the legacy display column stays consistent)
    cur.execute(
        f"SELECT id, item_id, image_path FROM item_images WHERE image_path {not_r2.format(col='image_path')} ORDER BY item_id, id",
        params)
    for row_id, item_id, url in cur.fetchall():
        tasks.append({"kind": "item_image", "id": row_id, "item_id": item_id,
                      "url": url, "folder": "items"})

    # 2. Single-image era: items with no item_images rows at all
    cur.execute(
        f"""SELECT i.id, i.image_path FROM items i
            WHERE i.image_path {not_r2.format(col='i.image_path')}
              AND NOT EXISTS (SELECT 1 FROM item_images ii WHERE ii.item_id = i.id)
            ORDER BY i.id""",
        params)
    for item_id, url in cur.fetchall():
        tasks.append({"kind": "item_legacy", "id": item_id, "url": url, "folder": "items"})

    # 3. Vendor banners
    cur.execute(
        f"SELECT id, banner_image FROM vendors WHERE banner_image {not_r2.format(col='banner_image')} ORDER BY id",
        params)
    for vendor_id, url in cur.fetchall():
        tasks.append({"kind": "banner", "id": vendor_id, "url": url, "folder": "banners"})

    # 4. Style covers
    cur.execute(
        f"SELECT id, cover_image_path FROM style_categories WHERE cover_image_path {not_r2.format(col='cover_image_path')} ORDER BY id",
        params)
    for style_id, url in cur.fetchall():
        tasks.append({"kind": "style_cover", "id": style_id, "url": url, "folder": "styles"})

    # Ancient local-file era (bare filenames) — nothing to download, report only
    cur.execute(
        """SELECT 'item_image', id FROM item_images WHERE image_path IS NOT NULL AND image_path NOT LIKE 'http%%'
           UNION ALL
           SELECT 'item', id FROM items WHERE image_path IS NOT NULL AND image_path NOT LIKE 'http%%'""")
    local_era = cur.fetchall()

    return tasks, local_era


def write_back(cur, task, new_url: str):
    if task["kind"] == "item_image":
        cur.execute("UPDATE item_images SET image_path = %s WHERE id = %s",
                    (new_url, task["id"]))
        # Keep the legacy display column in sync when it mirrored this row
        cur.execute("UPDATE items SET image_path = %s WHERE id = %s AND image_path = %s",
                    (new_url, task["item_id"], task["url"]))
    elif task["kind"] == "item_legacy":
        cur.execute("UPDATE items SET image_path = %s WHERE id = %s AND image_path = %s",
                    (new_url, task["id"], task["url"]))
    elif task["kind"] == "banner":
        cur.execute("UPDATE vendors SET banner_image = %s WHERE id = %s AND banner_image = %s",
                    (new_url, task["id"], task["url"]))
    elif task["kind"] == "style_cover":
        cur.execute("UPDATE style_categories SET cover_image_path = %s WHERE id = %s AND cover_image_path = %s",
                    (new_url, task["id"], task["url"]))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Print the worklist and exit")
    parser.add_argument("--limit", type=int, default=0, help="Migrate at most N images (trial run)")
    args = parser.parse_args()

    if not storage.is_configured():
        sys.exit("R2 is not configured — check the R2_* variables in backend/.env")

    conn = psycopg2.connect(os.getenv("DATABASE_URL"))
    conn.autocommit = False
    cur = conn.cursor()

    r2_prefix = storage._public_base() + "/"
    tasks, local_era = build_worklist(cur, r2_prefix)

    counts = {}
    for t in tasks:
        counts[t["kind"]] = counts.get(t["kind"], 0) + 1
    print(f"Worklist: {len(tasks)} images to migrate "
          f"({', '.join(f'{k}: {v}' for k, v in counts.items()) or 'nothing'})")
    if local_era:
        print(f"Skipping {len(local_era)} local-file era rows (no Cloudinary asset): "
              f"{', '.join(f'{k} {i}' for k, i in local_era[:10])}"
              f"{' ...' if len(local_era) > 10 else ''}")

    if args.dry_run:
        print("Dry run — no changes made.")
        return

    if args.limit:
        tasks = tasks[:args.limit]
        print(f"Trial run: limiting to {len(tasks)} images")

    migrated, failed = 0, []
    started = time.time()
    try:
        for i, task in enumerate(tasks, 1):
            label = f"{task['kind']} {task['id']}" + (
                f" (item {task['item_id']})" if task["kind"] == "item_image" else "")
            t0 = time.time()
            try:
                data = fetch_bytes(task["url"])
                new_url = storage.upload_image(data, task["folder"])
                write_back(cur, task, new_url)
                conn.commit()
                migrated += 1
                print(f"[{i}/{len(tasks)}] {label}: ok "
                      f"({len(data) // 1024} KB, {time.time() - t0:.1f}s)", flush=True)
            except Exception as e:
                conn.rollback()
                failed.append((label, task["url"], str(e)))
                print(f"[{i}/{len(tasks)}] {label}: FAILED — {e}", flush=True)
    except KeyboardInterrupt:
        print("\nInterrupted — all completed rows are committed. Rerun to continue.")

    print(f"\nDone in {(time.time() - started) / 60:.1f} min: "
          f"{migrated} migrated, {len(failed)} failed")
    if failed:
        print("Failures (rerun the script to retry them):")
        for label, url, err in failed:
            print(f"  {label}: {err}\n    {url}")
        sys.exit(1)


if __name__ == "__main__":
    main()
