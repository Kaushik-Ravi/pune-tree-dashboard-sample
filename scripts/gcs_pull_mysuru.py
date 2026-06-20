"""Download Mysuru GEE-exported rasters from GCS to local disk.

Mirrors the FNE pattern (see ../../FNE/JP_Nagar_GIS/Earth Engine/gcs_pull_ecology.py).

GCS bucket: ee-your-kaushik-fne
Prefix:     FNE_Mysuru_Trees/
Local dir:  data/processed-rasters/mysuru/  (gitignored)

Auth: uses the same service-account JSON as gee_mysuru_export.py. The service
account already has Object Admin on the bucket (set up by FNE Climate_Air work).

Run: python scripts/gcs_pull_mysuru.py

Skips files that already exist locally with matching size — re-runnable safely
to incrementally pull as more export tasks complete.
"""

import json
import os
import sys
from pathlib import Path

try:
    from google.cloud import storage
    from google.oauth2 import service_account
except ImportError:
    print("Missing dependency. Install with: pip install google-cloud-storage", file=sys.stderr)
    sys.exit(1)

KEY_PATH = r"E:\Rainmatter\FNE\JP_Nagar_GIS\Earth Engine\ee-your-kaushik-567bdad16705.json"
BUCKET = "ee-your-kaushik-fne"
PREFIX = "FNE_Mysuru_Trees/"
LOCAL_ROOT = Path(__file__).resolve().parent.parent / "data" / "processed-rasters" / "mysuru"


def main():
    creds = service_account.Credentials.from_service_account_file(KEY_PATH)
    with open(KEY_PATH) as f:
        proj = json.load(f)["project_id"]
    client = storage.Client(project=proj, credentials=creds)

    LOCAL_ROOT.mkdir(parents=True, exist_ok=True)

    blobs = list(client.list_blobs(BUCKET, prefix=PREFIX))
    print(f"Found {len(blobs)} object(s) under gs://{BUCKET}/{PREFIX}")
    if not blobs:
        print("(No exports yet. Run scripts/gee_mysuru_export.py launch first, then wait for tasks to finish.)")
        return

    total_bytes = 0
    downloaded = 0
    skipped = 0

    for blob in blobs:
        rel = blob.name[len(PREFIX):] if blob.name.startswith(PREFIX) else blob.name
        if not rel or rel.endswith("/"):
            continue
        local_path = LOCAL_ROOT / rel
        local_path.parent.mkdir(parents=True, exist_ok=True)

        if local_path.exists() and local_path.stat().st_size == blob.size:
            print(f"  [SKIP] {rel}  ({blob.size:>12,} bytes -- already on disk)")
            skipped += 1
            continue

        print(f"  [DL]   {rel}  ({blob.size:>12,} bytes)")
        blob.download_to_filename(str(local_path))
        downloaded += 1
        total_bytes += blob.size

    print(f"\nDone. downloaded={downloaded}  skipped={skipped}  bytes={total_bytes:,}")
    print(f"Local: {LOCAL_ROOT}")


if __name__ == "__main__":
    main()
