"""Mosaic any sharded GEE outputs, COG-convert all Mysuru rasters, and upload
to Cloudflare R2 (pune-trees-tiles bucket, rasters/ prefix, mysuru_* filenames).

SAFETY: Only writes files matching `mysuru_*.tif`. NEVER touches `pune_*` files.
The R2 token is scoped to pune-trees-tiles but with read+write on all objects;
the script enforces the mysuru_ prefix on every PUT.

Run: python scripts/cog_and_upload_mysuru.py

After this, the dashboard URLs:
  https://pub-6a88122430ec4e08bc70cf4abd6d1f58.r2.dev/rasters/mysuru_<layer>.tif
"""

import os
import sys
import subprocess
from pathlib import Path

try:
    import boto3
    from botocore.config import Config
    import rasterio
except ImportError as e:
    print(f"Missing dep: {e}. Install: pip install boto3 rasterio", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "processed-rasters" / "mysuru"
COG = ROOT / "data" / "processed-rasters" / "mysuru" / "cog"
COG.mkdir(parents=True, exist_ok=True)

# Layer-name -> source file path. The chosen LST uses the user-picked 2024
# annual variant. NDVI 2025 picks the WINTER one (single file, vs sharded
# full-year) for consistency with the rest of the season-consistent series.
LAYERS = {
    # LST (single file — user's pick)
    "mysuru_lst.tif":                              "mysuru_lst_landsat_2024_annual.tif",
    # NDVI annual winter series
    **{f"mysuru_ndvi_{y}_winter.tif": f"mysuru_ndvi_{y}_winter.tif" for y in range(2019, 2027)},
    # Tree probability annual series
    **{f"mysuru_tree_probability_{y}.tif": f"mysuru_tree_probability_{y}.tif" for y in range(2019, 2027)},
    # Landcover annual series
    **{f"mysuru_landcover_{y}.tif": f"mysuru_landcover_{y}.tif" for y in range(2019, 2027)},
    # Tree change derivatives
    "mysuru_tree_change_2019_2025_pct.tif":        "mysuru_tree_change_2019_2025_pct.tif",
    "mysuru_tree_loss_gain_2019_2025.tif":         "mysuru_tree_loss_gain_2019_2025.tif",
}


def mosaic_ndvi_shards():
    """The full-year NDVI 2025 came back as 4 shards. Mosaic into one file."""
    shards = sorted(SRC.glob("mysuru_ndvi_20250000*-0000*.tif"))
    if not shards:
        return None
    out = SRC / "mysuru_ndvi_2025.tif"
    if out.exists():
        return out
    vrt = SRC / "mysuru_ndvi_2025.vrt"
    subprocess.run(["gdalbuildvrt", str(vrt), *[str(s) for s in shards]], check=True, capture_output=True)
    subprocess.run([
        "gdal_translate", str(vrt), str(out),
        "-of", "GTiff", "-co", "COMPRESS=DEFLATE", "-co", "TILED=YES",
    ], check=True, capture_output=True)
    vrt.unlink()
    print(f"  mosaicked {len(shards)} NDVI 2025 shards -> {out.name} ({out.stat().st_size//1024} KB)")
    return out


def to_cog(src: Path, dst: Path):
    """Convert a GeoTIFF to Cloud Optimized GeoTIFF in place (idempotent)."""
    if dst.exists():
        return False
    cmd = [
        "gdal_translate", str(src), str(dst),
        "-of", "COG",
        "-co", "COMPRESS=DEFLATE",
        "-co", "BLOCKSIZE=512",
        "-co", "OVERVIEWS=AUTO",
    ]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print(f"    FAILED: {r.stderr[:200]}")
        return False
    return True


def upload(dst_path: Path, key: str, s3):
    """Upload to R2. Hard guard: never accept a key without mysuru_ prefix."""
    if not key.startswith("rasters/mysuru_"):
        raise ValueError(f"SAFETY VIOLATION: would have written {key} (no mysuru_ prefix)")
    s3.upload_file(
        str(dst_path), "pune-trees-tiles", key,
        ExtraArgs={"ContentType": "image/tiff", "CacheControl": "public, max-age=86400"},
    )


def main():
    # 1) Mosaic
    print("=== Step 1: Mosaic NDVI 2025 shards ===")
    mosaic_ndvi_shards()

    # 2) COG convert
    print("\n=== Step 2: COG-convert ===")
    cog_files = []
    for out_name, src_name in LAYERS.items():
        src = SRC / src_name
        if not src.exists():
            print(f"  [SKIP] {src_name} (missing)")
            continue
        dst = COG / out_name
        did = to_cog(src, dst)
        flag = "made" if did else "exists"
        print(f"  [{flag:>6}] {dst.name}  ({dst.stat().st_size//1024} KB)")
        cog_files.append((dst, out_name))

    # 3) Upload to R2
    print(f"\n=== Step 3: Upload {len(cog_files)} COG(s) to R2 (pune-trees-tiles/rasters/) ===")
    s3 = boto3.client(
        "s3",
        endpoint_url="https://3ca11b224a000e62822b3e15aade8d0d.r2.cloudflarestorage.com",
        aws_access_key_id="921a68d96bdcf47ba3041e72f06e928f",
        aws_secret_access_key="e7917b58e1b4fbfd4959420c1a79b5a7931a3c50b29a638f3a0f9a9dca3d5bc0",
        region_name="auto",
        config=Config(s3={"addressing_style": "virtual"}),
    )
    total_bytes = 0
    for dst, out_name in cog_files:
        key = f"rasters/{out_name}"
        upload(dst, key, s3)
        sz = dst.stat().st_size
        total_bytes += sz
        print(f"  [UP] {key}  ({sz//1024:>5} KB)")

    print(f"\nDone. Uploaded {len(cog_files)} files / {total_bytes/(1024*1024):.1f} MB")
    print(f"Public URL pattern: https://pub-6a88122430ec4e08bc70cf4abd6d1f58.r2.dev/rasters/<file>")


if __name__ == "__main__":
    main()
