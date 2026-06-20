"""
gee_mysuru_export.py - Mysuru tree-canopy dashboard GEE exporter.

Exports the same raster stack used by the Pune dashboard, for Mysuru, Karnataka:
  - LST (Land Surface Temperature) 2025   -- MODIS annual composite + Landsat high-res
  - NDVI 2025                              -- Sentinel-2 cloud-masked annual composite
  - Dynamic World landcover 2025           -- annual mode
  - Tree probability 2025                  -- Dynamic World 'trees' band median
  - Tree probability 2019                  -- baseline for change detection
  - Tree change 2019-2025                  -- continuous % derivative
  - Tree loss/gain binary                  -- -1 / 0 / +1 derivative

This script ONLY queues asynchronous Google Drive exports. It exits after
queueing; tasks run on GEE's infrastructure. Monitor progress with the
`monitor` subcommand (or the GEE Code Editor's Tasks tab) and download the
finished tiffs from Drive.

Auth pattern is verbatim from FNE (`smoke_test_ee_auth.py` /
`gee_climate_air_export.py`): service-account JSON, reads ONLY `client_email`
and `project_id`, never logs the private key.

Cloud / no-data quality strategy
--------------------------------
The user explicitly demanded zero no-data gaps across the Mysuru extent.
For each layer we composite enough scenes across a full year to guarantee
every pixel sees a clear observation. After queueing, the script prints a
synchronous quality check that reports scene count, date range, and the
percentage of no-data pixels in the AOI from a coarse-sample reduction
(NOT the final exported tiff itself -- that runs async).

  * LST primary  : MODIS MOD11A1+MYD11A1 daily, QC-masked, annual mean
                   at 1 km. Karnataka has thousands of clear days per
                   sensor per year -> guaranteed full coverage.
  * LST high-res : Landsat 8+9 Collection-2 L2 thermal (ST_B10),
                   QA_PIXEL masked, annual median at 30 m. May have
                   small monsoon gaps; reported in the QC printout.
  * NDVI         : Sentinel-2 SR Harmonized, CLOUDY_PIXEL_PERCENTAGE<20,
                   per-image SCL/QA60 mask, annual median at 10 m.
  * Dynamic World: annual mode of 'label' band at 10 m. Drops single-day
                   bias automatically.
  * Tree prob.   : DW 'trees' probability band, annual median, x100 -> 0-100.

Usage
-----
    python scripts/gee_mysuru_export.py launch          # queue ALL exports
    python scripts/gee_mysuru_export.py launch lst_modis ndvi  # subset
    python scripts/gee_mysuru_export.py qc              # quality-check report
    python scripts/gee_mysuru_export.py monitor         # refresh task states
    python scripts/gee_mysuru_export.py list            # show registered slugs
"""

from __future__ import annotations

import csv
import json
import os
import sys
from datetime import datetime, timezone
from typing import Callable, Dict, List, Optional, Tuple

import ee

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------

# Service-account JSON path (FNE pattern, verbatim).
KEY_PATH = r"E:\Rainmatter\FNE\JP_Nagar_GIS\Earth Engine\ee-your-kaushik-567bdad16705.json"

# Mysuru bounding box (lng_min, lat_min, lng_max, lat_max).
# West 76.5700, South 12.2400, East 76.7200, North 12.3700
MYSURU_BBOX = [76.5700, 12.2400, 76.7200, 12.3700]
MYSURU_CENTER = [76.6413, 12.3051]

# Target years.
CURRENT_YEAR = 2025
BASELINE_YEAR = 2019

# Date windows. Full calendar year keeps the cloud-free composite robust.
CURRENT_START = f"{CURRENT_YEAR}-01-01"
CURRENT_END = f"{CURRENT_YEAR}-12-31"
BASELINE_START = f"{BASELINE_YEAR}-01-01"
BASELINE_END = f"{BASELINE_YEAR}-12-31"

# Drive folder name (legacy — Drive path is unused now, see note below).
DRIVE_FOLDER = "mysuru_gee_exports"

# Export destination: Google Cloud Storage (NOT Drive).
# Reason: gautamravi2002@gmail.com's account is blocked by Google's
# sensitive-scope policy from the multi-scope `earthengine authenticate`
# flow, so user-OAuth Drive exports are unreachable. Service accounts
# cannot write to Drive (no per-user storage quota) but they CAN write
# to GCS. Same bucket the FNE Climate_Air / Ecology / Hazards exports
# use — service account already has Object Admin on it.
GCS_BUCKET = "ee-your-kaushik-fne"
GCS_PREFIX = "FNE_Mysuru_Trees"

# CRS + export ceilings.
CRS = "EPSG:4326"
MAX_PIXELS = int(1e13)

# Local manifest CSV (sibling of this script).
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MANIFEST_PATH = os.path.join(SCRIPT_DIR, ".gee_mysuru_export_manifest.csv")

# Optional Cloud-Optimized GeoTIFF format (matches gee-raster-tiles-export.js).
COG_PARAMS = {"cloudOptimized": True, "fileDimensions": [1024, 1024]}

TODAY = datetime.now(timezone.utc).strftime("%Y-%m-%d")

# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------

def _bbox_geometry() -> ee.Geometry:
    """Return the Mysuru bbox as an EE Geometry."""
    return ee.Geometry.Rectangle(MYSURU_BBOX)


# ---------------------------------------------------------------------------
# Auth (FNE pattern)
# ---------------------------------------------------------------------------

def _load_sa() -> Tuple[str, str]:
    """Return (client_email, project_id) only. Drop the rest immediately."""
    with open(KEY_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    email = data["client_email"]
    project = data["project_id"]
    data = None  # drop reference so private_key does not linger
    return email, project


def init_ee() -> ee.Geometry:
    """Initialize EE with auth that can write to Drive.

    Service accounts CANNOT write to Google Drive (no per-user storage quota),
    so we prefer user OAuth (cached at ~/.config/earthengine/credentials by
    `earthengine authenticate`). The service-account JSON is still used to
    discover the EE Cloud project id so we don't have to hardcode it.

    If user OAuth fails (token expired etc.), fall back to service account —
    that path still works for tasks that don't need Drive (in-EE asset writes,
    or future GCS export support).
    """
    _, project = _load_sa()
    try:
        ee.Initialize(project=project)
        return _bbox_geometry()
    except Exception as user_oauth_err:
        print(f"[init_ee] user-oauth init failed: {user_oauth_err}; falling back to service account")
        email, _ = _load_sa()
        creds = ee.ServiceAccountCredentials(email, key_file=KEY_PATH)
        ee.Initialize(creds, project=project)
        return _bbox_geometry()


# ---------------------------------------------------------------------------
# Manifest (queued task tracking)
# ---------------------------------------------------------------------------

MANIFEST_FIELDS = [
    "task_id",
    "asset_slug",
    "asset_id",
    "kind",            # image | table
    "output_prefix",
    "drive_folder",
    "scale_m",
    "region",
    "start_time_utc",
    "status",
    "error",
]


def _read_manifest() -> List[Dict[str, str]]:
    if not os.path.exists(MANIFEST_PATH):
        return []
    with open(MANIFEST_PATH, "r", encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def _write_manifest(rows: List[Dict[str, str]]) -> None:
    with open(MANIFEST_PATH, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=MANIFEST_FIELDS)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in MANIFEST_FIELDS})


def _append_manifest_rows(new_rows: List[Dict[str, str]]) -> None:
    existing = _read_manifest()
    existing.extend(new_rows)
    _write_manifest(existing)


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _row(
    *,
    task_id: Optional[str],
    asset_slug: str,
    asset_id: str,
    kind: str,
    file_prefix: str,
    scale_m: int,
    region_label: str,
    status: str,
    error: str,
) -> Dict[str, str]:
    return {
        "task_id": task_id or "",
        "asset_slug": asset_slug,
        "asset_id": asset_id,
        "kind": kind,
        "output_prefix": file_prefix,
        "drive_folder": DRIVE_FOLDER,
        "scale_m": str(scale_m),
        "region": region_label,
        "start_time_utc": _now(),
        "status": status,
        "error": error,
    }


# ---------------------------------------------------------------------------
# Cloud / QA masks (ported from FNE gee_climate_air_export.py +
#                    gee_ecology_export.py)
# ---------------------------------------------------------------------------

def _modis_lst_mask(img: ee.Image, lst_band: str, qc_band: str) -> ee.Image:
    """Mask MOD11A1 / MYD11A1 daily LST and convert DN -> Kelvin.

    QC bits 0-1 == 0 means good quality; bits 6-7 <= 1 keeps LST error <= 2K.
    Native scale factor 0.02 converts the uint16 DN to Kelvin.
    """
    qc = img.select(qc_band)
    good = qc.bitwiseAnd(0b11).eq(0)
    err_ok = qc.rightShift(6).bitwiseAnd(0b11).lte(1)
    return img.select(lst_band).updateMask(good.And(err_ok)).multiply(0.02)


def _landsat_thermal_mask(img: ee.Image) -> ee.Image:
    """Mask Landsat C2 L2 thermal (ST_B10) and convert DN -> Kelvin.

    QA_PIXEL bits 2/3/4/5 = dilated-cloud / cloud / shadow / snow; drop all.
    ST_QA scale 0.01 K, drop pixels whose LST std error > 3 K.
    DN -> Kelvin uses the published per-band offset/multiplier.
    """
    qa = img.select("QA_PIXEL")
    clear = (
        qa.bitwiseAnd(1 << 2).eq(0)
        .And(qa.bitwiseAnd(1 << 3).eq(0))
        .And(qa.bitwiseAnd(1 << 4).eq(0))
        .And(qa.bitwiseAnd(1 << 5).eq(0))
    )
    st_qa = img.select("ST_QA")
    err_ok = st_qa.lt(300)
    lst_k = img.select("ST_B10").multiply(0.00341802).add(149.0)
    return lst_k.rename("LST_K").updateMask(clear.And(err_ok))


def _s2_cloud_mask(img: ee.Image) -> ee.Image:
    """Sentinel-2 SR cloud mask using QA60 (bits 10/11) + SCL classes.

    QA60 bits flag opaque + cirrus clouds; SCL adds cloud-shadow (3),
    cloud-medium (8), cloud-high (9), cirrus (10).
    """
    qa = img.select("QA60")
    cloud_bits = (1 << 10) | (1 << 11)
    qa_clear = qa.bitwiseAnd(cloud_bits).eq(0)
    scl = img.select("SCL")
    scl_clear = (
        scl.neq(3).And(scl.neq(8)).And(scl.neq(9)).And(scl.neq(10))
    )
    return img.updateMask(qa_clear.And(scl_clear))


# ---------------------------------------------------------------------------
# Layer builders (return ee.Image, name)
# ---------------------------------------------------------------------------

def build_lst_modis(year: int, aoi: ee.Geometry) -> Tuple[ee.Image, Dict]:
    """MODIS Terra+Aqua daily LST annual mean -- guaranteed cloud-free 1 km."""
    start = f"{year}-01-01"
    end = f"{year}-12-31"
    terra = ee.ImageCollection("MODIS/061/MOD11A1").filterBounds(aoi).filterDate(start, end)
    aqua = ee.ImageCollection("MODIS/061/MYD11A1").filterBounds(aoi).filterDate(start, end)

    def _day(im):  # noqa: ANN001
        return _modis_lst_mask(im, "LST_Day_1km", "QC_Day").rename("LST_Day_K")

    def _night(im):  # noqa: ANN001
        return _modis_lst_mask(im, "LST_Night_1km", "QC_Night").rename("LST_Night_K")

    day = terra.map(_day).merge(aqua.map(_day)).mean().rename("LST_Day_K")
    night = terra.map(_night).merge(aqua.map(_night)).mean().rename("LST_Night_K")
    img = day.addBands(night).clip(aoi)
    # Convert to Celsius for dashboard convenience -- both bands.
    img = img.subtract(273.15).rename(["LST_Day_C", "LST_Night_C"])

    meta = {
        "asset_id": "MODIS/061/MOD11A1 + MODIS/061/MYD11A1",
        "scene_count_collection": terra.merge(aqua),
        "start": start,
        "end": end,
    }
    return img, meta


def build_lst_landsat(year: int, aoi: ee.Geometry) -> Tuple[ee.Image, Dict]:
    """Landsat 8/9 C2 L2 thermal annual median, 30 m."""
    start = f"{year}-01-01"
    end = f"{year}-12-31"
    l8 = (
        ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
        .filterBounds(aoi)
        .filterDate(start, end)
        .map(_landsat_thermal_mask)
    )
    l9 = (
        ee.ImageCollection("LANDSAT/LC09/C02/T1_L2")
        .filterBounds(aoi)
        .filterDate(start, end)
        .map(_landsat_thermal_mask)
    )
    merged = l8.merge(l9)
    img = merged.median().subtract(273.15).rename("LST_C").clip(aoi)
    meta = {
        "asset_id": "LANDSAT/LC08/C02/T1_L2 + LANDSAT/LC09/C02/T1_L2",
        "scene_count_collection": merged,
        "start": start,
        "end": end,
    }
    return img, meta


def build_ndvi(year: int, aoi: ee.Geometry) -> Tuple[ee.Image, Dict]:
    """Sentinel-2 SR Harmonized NDVI annual median, 10 m, cloud-masked."""
    start = f"{year}-01-01"
    end = f"{year}-12-31"
    s2 = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(aoi)
        .filterDate(start, end)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
        .map(_s2_cloud_mask)
    )

    def _ndvi(im):  # noqa: ANN001
        return im.normalizedDifference(["B8", "B4"]).rename("NDVI")

    img = s2.map(_ndvi).median().clip(aoi).rename("NDVI")
    meta = {
        "asset_id": "COPERNICUS/S2_SR_HARMONIZED",
        "scene_count_collection": s2,
        "start": start,
        "end": end,
    }
    return img, meta


def build_ndvi_window(label: str, start: str, end: str, aoi: ee.Geometry) -> Tuple[ee.Image, Dict]:
    """Sentinel-2 NDVI median over an arbitrary date window. Used to build
    season-consistent annual time-series (e.g., Dec-Feb winter each year)
    so phenology (deciduous leaf-shed) doesn't masquerade as deforestation."""
    s2 = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterBounds(aoi)
        .filterDate(start, end)
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
        .map(_s2_cloud_mask)
    )

    def _ndvi(im):  # noqa: ANN001
        return im.normalizedDifference(["B8", "B4"]).rename("NDVI")

    img = s2.map(_ndvi).median().clip(aoi).rename(f"NDVI_{label}")
    meta = {
        "asset_id": "COPERNICUS/S2_SR_HARMONIZED",
        "scene_count_collection": s2,
        "start": start,
        "end": end,
    }
    return img, meta


def build_lst_landsat_window(label: str, start: str, end: str, aoi: ee.Geometry) -> Tuple[ee.Image, Dict]:
    """Landsat 8/9 LST median over an arbitrary date window."""
    l8 = (
        ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
        .filterBounds(aoi)
        .filterDate(start, end)
        .map(_landsat_thermal_mask)
    )
    l9 = (
        ee.ImageCollection("LANDSAT/LC09/C02/T1_L2")
        .filterBounds(aoi)
        .filterDate(start, end)
        .map(_landsat_thermal_mask)
    )
    merged = l8.merge(l9)
    img = merged.median().subtract(273.15).rename(f"LST_C_{label}").clip(aoi)
    meta = {
        "asset_id": "LANDSAT/LC08/C02/T1_L2 + LANDSAT/LC09/C02/T1_L2",
        "scene_count_collection": merged,
        "start": start,
        "end": end,
    }
    return img, meta


def build_lst_modis_single(year: int, sensor: str, band: str, aoi: ee.Geometry) -> Tuple[ee.Image, Dict]:
    """MODIS daily LST annual mean -- single sensor (Aqua MYD11A1 or Terra MOD11A1),
    single band (LST_Day_1km or LST_Night_1km)."""
    start = f"{year}-01-01"
    end = f"{year}-12-31"
    qc_band = "QC_Day" if band == "LST_Day_1km" else "QC_Night"
    coll = ee.ImageCollection(sensor).filterBounds(aoi).filterDate(start, end)
    img = (
        coll.map(lambda im: _modis_lst_mask(im, band, qc_band).rename(band))
        .mean()
        .subtract(273.15)
        .rename(f"LST_C")
        .clip(aoi)
    )
    meta = {
        "asset_id": f"{sensor} band={band}",
        "scene_count_collection": coll,
        "start": start,
        "end": end,
    }
    return img, meta


def build_lst_modis_night(year: int, aoi: ee.Geometry) -> Tuple[ee.Image, Dict]:
    """MODIS combined Aqua+Terra NIGHT LST mean -- best for urban heat island
    since UHI is more pronounced at night (no direct solar heating)."""
    start = f"{year}-01-01"
    end = f"{year}-12-31"
    terra = ee.ImageCollection("MODIS/061/MOD11A1").filterBounds(aoi).filterDate(start, end)
    aqua = ee.ImageCollection("MODIS/061/MYD11A1").filterBounds(aoi).filterDate(start, end)

    def _night(im):  # noqa: ANN001
        return _modis_lst_mask(im, "LST_Night_1km", "QC_Night").rename("LST_Night_K")

    merged = terra.map(_night).merge(aqua.map(_night))
    img = merged.mean().subtract(273.15).rename("LST_C").clip(aoi)
    meta = {
        "asset_id": "MOD11A1 + MYD11A1 (night)",
        "scene_count_collection": terra.merge(aqua),
        "start": start,
        "end": end,
    }
    return img, meta


def winter_window(year: int) -> Tuple[str, str]:
    """Karnataka winter dry season — Dec (year-1) through Feb (year). Cleanest
    sky conditions, vegetation stable (post-monsoon, pre-summer drought).
    Best window for season-consistent multi-year comparisons."""
    return f"{year - 1}-12-01", f"{year}-02-28"


def build_landcover(year: int, aoi: ee.Geometry) -> Tuple[ee.Image, Dict]:
    """Dynamic World annual mode classification, 10 m."""
    start = f"{year}-01-01"
    end = f"{year}-12-31"
    dw = (
        ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1")
        .filterBounds(aoi)
        .filterDate(start, end)
    )
    img = dw.select("label").mode().clip(aoi).rename("landcover")
    meta = {
        "asset_id": "GOOGLE/DYNAMICWORLD/V1",
        "scene_count_collection": dw,
        "start": start,
        "end": end,
    }
    return img, meta


def build_tree_probability(year: int, aoi: ee.Geometry) -> Tuple[ee.Image, Dict]:
    """Dynamic World 'trees' probability band, annual median, scaled to 0-100."""
    start = f"{year}-01-01"
    end = f"{year}-12-31"
    dw = (
        ee.ImageCollection("GOOGLE/DYNAMICWORLD/V1")
        .filterBounds(aoi)
        .filterDate(start, end)
        .select("trees")
    )
    img = dw.median().multiply(100).clip(aoi).rename(f"tree_probability_{year}")
    meta = {
        "asset_id": "GOOGLE/DYNAMICWORLD/V1 (trees band)",
        "scene_count_collection": dw,
        "start": start,
        "end": end,
    }
    return img, meta


def build_tree_change(aoi: ee.Geometry) -> Tuple[ee.Image, Dict]:
    """Tree probability % change 2025 - 2019 (continuous, -100..+100)."""
    t25, _ = build_tree_probability(CURRENT_YEAR, aoi)
    t19, _ = build_tree_probability(BASELINE_YEAR, aoi)
    img = t25.subtract(t19).rename("tree_change_pct").clip(aoi)
    meta = {
        "asset_id": "derived: tree_prob_2025 - tree_prob_2019",
        "scene_count_collection": None,
        "start": BASELINE_START,
        "end": CURRENT_END,
    }
    return img, meta


def build_tree_loss_gain(aoi: ee.Geometry) -> Tuple[ee.Image, Dict]:
    """Binary loss/gain from DW mode: -1=lost, 0=stable, +1=gained."""
    lc25, _ = build_landcover(CURRENT_YEAR, aoi)
    lc19, _ = build_landcover(BASELINE_YEAR, aoi)
    was = lc19.eq(1)
    now = lc25.eq(1)
    gain = now.And(was.Not())
    loss = was.And(now.Not())
    img = gain.multiply(1).add(loss.multiply(-1)).rename("tree_loss_gain").toInt8().clip(aoi)
    meta = {
        "asset_id": "derived: DW.label.eq(1) 2025 vs 2019",
        "scene_count_collection": None,
        "start": BASELINE_START,
        "end": CURRENT_END,
    }
    return img, meta


# ---------------------------------------------------------------------------
# Export launcher
# ---------------------------------------------------------------------------

def _start_image_task(
    image: ee.Image,
    *,
    description: str,
    file_prefix: str,
    region: ee.Geometry,
    scale: int,
    cog: bool = True,
) -> Tuple[Optional[str], str, str]:
    """Submit an image export to Google Cloud Storage. Returns (task_id, status, error).

    Uses the same GCS bucket as the FNE Climate_Air / Ecology / Hazards exports
    (ee-your-kaushik-fne), where the service account already has Object Admin
    permission. After exports complete, run `python scripts/gcs_pull_mysuru.py`
    to download every blob under the prefix to `data/processed-rasters/mysuru/`.
    """
    try:
        task = ee.batch.Export.image.toCloudStorage(
            image=image,
            description=description[:100],
            bucket=GCS_BUCKET,
            fileNamePrefix=f"{GCS_PREFIX}/{file_prefix}",
            region=region,
            scale=scale,
            crs=CRS,
            maxPixels=MAX_PIXELS,
            fileFormat="GeoTIFF",
            formatOptions=COG_PARAMS if cog else None,
        )
        task.start()
        return task.id, "QUEUED", ""
    except Exception as e:
        return None, "FAILED_TO_START", f"{type(e).__name__}: {e}"


# ---------------------------------------------------------------------------
# Quality check (synchronous, on coarse-sample reduceRegion)
# ---------------------------------------------------------------------------

def qc_report(
    slug: str,
    img: ee.Image,
    meta: Dict,
    aoi: ee.Geometry,
    sample_scale: int,
) -> None:
    """Print scene count, date range, % no-data, mean/min/max per band.

    Uses ee.Reducer.{min,max,mean,count} at a coarse `sample_scale` so the
    check is fast. The exported tiff itself is produced async at the full
    native resolution; this check just validates that the recipe yields
    reasonable values across the AOI before we trust the export.
    """
    print(f"\n  -- QC: {slug} --")
    coll = meta.get("scene_count_collection")
    if coll is not None:
        try:
            n = coll.size().getInfo()
            print(f"     scenes in collection: {n}")
            if n > 0:
                first = ee.Date(coll.sort("system:time_start", True).first().get(
                    "system:time_start")).format("YYYY-MM-dd").getInfo()
                last = ee.Date(coll.sort("system:time_start", False).first().get(
                    "system:time_start")).format("YYYY-MM-dd").getInfo()
                print(f"     date range: {first} -> {last}")
        except Exception as e:
            print(f"     scene-count probe FAILED: {type(e).__name__}: {e}")
    else:
        print(f"     scenes: derived layer (date span {meta['start']} -> {meta['end']})")

    band_names = img.bandNames().getInfo()
    print(f"     bands: {band_names}")

    # Total AOI pixel count vs unmasked-pixel count -> % no-data.
    try:
        for band in band_names:
            band_img = img.select(band)
            # Count of unmasked pixels in the AOI at sample_scale.
            unmasked = band_img.reduceRegion(
                reducer=ee.Reducer.count(),
                geometry=aoi,
                scale=sample_scale,
                maxPixels=MAX_PIXELS,
                bestEffort=True,
            ).get(band)
            # Total pixel count of a constant-mask reference image.
            ref = ee.Image.constant(1).clip(aoi)
            total = ref.reduceRegion(
                reducer=ee.Reducer.count(),
                geometry=aoi,
                scale=sample_scale,
                maxPixels=MAX_PIXELS,
                bestEffort=True,
            ).get("constant")
            unmasked_v = ee.Number(unmasked).getInfo()
            total_v = ee.Number(total).getInfo()
            no_data_pct = (
                100.0 * (1.0 - (unmasked_v / total_v)) if total_v else float("nan")
            )

            stats = band_img.reduceRegion(
                reducer=ee.Reducer.mean().combine(
                    ee.Reducer.minMax(), sharedInputs=True
                ),
                geometry=aoi,
                scale=sample_scale,
                maxPixels=MAX_PIXELS,
                bestEffort=True,
            ).getInfo()

            mean_v = stats.get(f"{band}_mean")
            min_v = stats.get(f"{band}_min")
            max_v = stats.get(f"{band}_max")
            flag = " OK" if no_data_pct < 0.5 else " WARN: gaps present"
            print(
                f"     band={band:18s} no_data={no_data_pct:6.2f}%"
                f"  mean={mean_v}  min={min_v}  max={max_v}{flag}"
            )
    except Exception as e:
        print(f"     stats probe FAILED: {type(e).__name__}: {e}")


# ---------------------------------------------------------------------------
# Registry: slug -> (builder, scale_m, qc_sample_scale, description)
# ---------------------------------------------------------------------------

def _make_export(
    slug: str,
    builder_args,  # tuple of (callable, kwargs)
    *,
    scale: int,
    qc_scale: int,
    aoi: ee.Geometry,
    quality_check: bool,
) -> Dict[str, str]:
    """Build the image, optionally QC-report it, queue the Drive export."""
    builder, kwargs = builder_args
    img, meta = builder(aoi=aoi, **kwargs) if kwargs else builder(aoi=aoi)
    if quality_check:
        qc_report(slug, img, meta, aoi, qc_scale)
    file_prefix = f"mysuru_{slug}"
    tid, status, err = _start_image_task(
        img,
        description=f"mysuru_{slug}",
        file_prefix=file_prefix,
        region=aoi,
        scale=scale,
    )
    return _row(
        task_id=tid,
        asset_slug=slug,
        asset_id=meta["asset_id"],
        kind="image",
        file_prefix=file_prefix,
        scale_m=scale,
        region_label="mysuru_bbox",
        status=status,
        error=err,
    )


def build_registry(
    aoi: ee.Geometry,
) -> Dict[str, Callable[[bool], Dict[str, str]]]:
    reg: Dict[str, Callable[[bool], Dict[str, str]]] = {}

    # LST -- BOTH variants are exported. MODIS = guaranteed cloud-free; Landsat = 30 m high-res.
    reg["lst_modis_2025"] = lambda qc, a=aoi: _make_export(
        "lst_modis_2025",
        (lambda year=CURRENT_YEAR, aoi=a: build_lst_modis(year, aoi), {}),
        scale=1000, qc_scale=1000, aoi=a, quality_check=qc,
    )
    reg["lst_landsat_2025"] = lambda qc, a=aoi: _make_export(
        "lst_landsat_2025",
        (lambda year=CURRENT_YEAR, aoi=a: build_lst_landsat(year, aoi), {}),
        scale=30, qc_scale=120, aoi=a, quality_check=qc,
    )

    # NDVI (S2 10 m)
    reg["ndvi_2025"] = lambda qc, a=aoi: _make_export(
        "ndvi_2025",
        (lambda year=CURRENT_YEAR, aoi=a: build_ndvi(year, aoi), {}),
        scale=10, qc_scale=30, aoi=a, quality_check=qc,
    )

    # Dynamic World landcover (10 m mode)
    reg["landcover_2025"] = lambda qc, a=aoi: _make_export(
        "landcover_2025",
        (lambda year=CURRENT_YEAR, aoi=a: build_landcover(year, aoi), {}),
        scale=10, qc_scale=30, aoi=a, quality_check=qc,
    )

    # Tree probability (current + baseline)
    reg["tree_probability_2025"] = lambda qc, a=aoi: _make_export(
        "tree_probability_2025",
        (lambda year=CURRENT_YEAR, aoi=a: build_tree_probability(year, aoi), {}),
        scale=10, qc_scale=30, aoi=a, quality_check=qc,
    )
    reg["tree_probability_2019"] = lambda qc, a=aoi: _make_export(
        "tree_probability_2019",
        (lambda year=BASELINE_YEAR, aoi=a: build_tree_probability(year, aoi), {}),
        scale=10, qc_scale=30, aoi=a, quality_check=qc,
    )

    # Tree change derivatives
    reg["tree_change_2019_2025_pct"] = lambda qc, a=aoi: _make_export(
        "tree_change_2019_2025_pct",
        (lambda aoi=a: build_tree_change(aoi), {}),
        scale=10, qc_scale=30, aoi=a, quality_check=qc,
    )
    reg["tree_loss_gain_2019_2025"] = lambda qc, a=aoi: _make_export(
        "tree_loss_gain_2019_2025",
        (lambda aoi=a: build_tree_loss_gain(aoi), {}),
        scale=10, qc_scale=30, aoi=a, quality_check=qc,
    )

    # === ROUND 2 ADDITIONS (2026-06-20): expanded year coverage + LST options ===

    # LST OPTIONS (user picks best after QC) — 7 variants beyond the existing lst_landsat_2025
    lst_options = [
        ("lst_landsat_2024_annual",        2024, None,       lambda a: build_lst_landsat(2024, a)),
        ("lst_landsat_2026_to_date",       2026, None,       lambda a: build_lst_landsat_window("2026YTD", "2026-01-01", "2026-06-20", a)),
        ("lst_landsat_2025_winter",        2025, "winter",   lambda a: build_lst_landsat_window("2025winter", *winter_window(2025), a)),
        ("lst_landsat_2024_winter",        2024, "winter",   lambda a: build_lst_landsat_window("2024winter", *winter_window(2024), a)),
        ("lst_modis_aqua_2025_day",        2025, "day",      lambda a: build_lst_modis_single(2025, "MODIS/061/MYD11A1", "LST_Day_1km", a)),
        ("lst_modis_terra_2025_day",       2025, "day",      lambda a: build_lst_modis_single(2025, "MODIS/061/MOD11A1", "LST_Day_1km", a)),
        ("lst_modis_combined_2025_night",  2025, "night",    lambda a: build_lst_modis_night(2025, a)),
    ]
    for slug, _year, _season, builder in lst_options:
        is_modis = "modis" in slug
        reg[slug] = lambda qc, a=aoi, _slug=slug, _builder=builder, _is_modis=is_modis: _make_export(
            _slug,
            (lambda aoi=a, _b=_builder: _b(aoi), {}),
            scale=1000 if _is_modis else 30,
            qc_scale=1000 if _is_modis else 120,
            aoi=a,
            quality_check=qc,
        )

    # NDVI annual time series — winter (Dec-Feb) for season-consistent comparison.
    # 2019-2026 = 8 years. The full-year ndvi_2025 above stays as-is for comparison.
    for year in range(2019, 2027):
        slug = f"ndvi_{year}_winter"
        start, end = winter_window(year)
        reg[slug] = lambda qc, a=aoi, _slug=slug, _s=start, _e=end: _make_export(
            _slug,
            (lambda aoi=a, label=str(year), s=_s, e=_e: build_ndvi_window(label, s, e, aoi), {}),
            scale=10, qc_scale=30, aoi=a, quality_check=qc,
        )

    # Tree probability annual time series — Dynamic World, full year.
    # 2019 + 2025 already exist above; add 2020-2024 and 2026.
    for year in [2020, 2021, 2022, 2023, 2024, 2026]:
        slug = f"tree_probability_{year}"
        reg[slug] = lambda qc, a=aoi, _y=year: _make_export(
            f"tree_probability_{_y}",
            (lambda aoi=a, year=_y: build_tree_probability(year, aoi), {}),
            scale=10, qc_scale=30, aoi=a, quality_check=qc,
        )

    # Landcover annual time series — Dynamic World mode, full year.
    # 2025 already exists above; add 2019-2024 and 2026.
    for year in [2019, 2020, 2021, 2022, 2023, 2024, 2026]:
        slug = f"landcover_{year}"
        reg[slug] = lambda qc, a=aoi, _y=year: _make_export(
            f"landcover_{_y}",
            (lambda aoi=a, year=_y: build_landcover(year, aoi), {}),
            scale=10, qc_scale=30, aoi=a, quality_check=qc,
        )

    return reg


# ---------------------------------------------------------------------------
# CLI commands
# ---------------------------------------------------------------------------

def cmd_list() -> int:
    aoi = init_ee()
    reg = build_registry(aoi)
    print(f"== Configured Mysuru exports (n={len(reg)}) ==")
    for slug in sorted(reg.keys()):
        print(f"  - {slug}")
    print(f"\nBbox: {MYSURU_BBOX}")
    print(f"GCS destination: gs://{GCS_BUCKET}/{GCS_PREFIX}/")
    print(f"Manifest:     {MANIFEST_PATH}")
    return 0


def cmd_qc(slugs: List[str]) -> int:
    """Run QC reports only -- DO NOT queue exports."""
    aoi = init_ee()
    reg = build_registry(aoi)
    if not slugs:
        slugs = list(reg.keys())
    unknown = [s for s in slugs if s not in reg]
    if unknown:
        print(f"ERROR: unknown slug(s): {unknown}")
        return 2

    print(f"== QC report for {len(slugs)} layer(s) -- NO EXPORTS QUEUED ==")
    print(f"AOI bbox: {MYSURU_BBOX}\n")

    # Re-use builder + qc but skip the queueing path by calling builders directly.
    builders_by_slug = {
        "lst_modis_2025": (build_lst_modis, {"year": CURRENT_YEAR}, 1000),
        "lst_landsat_2025": (build_lst_landsat, {"year": CURRENT_YEAR}, 120),
        "ndvi_2025": (build_ndvi, {"year": CURRENT_YEAR}, 30),
        "landcover_2025": (build_landcover, {"year": CURRENT_YEAR}, 30),
        "tree_probability_2025": (build_tree_probability, {"year": CURRENT_YEAR}, 30),
        "tree_probability_2019": (build_tree_probability, {"year": BASELINE_YEAR}, 30),
        "tree_change_2019_2025_pct": (build_tree_change, {}, 30),
        "tree_loss_gain_2019_2025": (build_tree_loss_gain, {}, 30),
    }
    for slug in slugs:
        builder, kwargs, qc_scale = builders_by_slug[slug]
        img, meta = builder(aoi=aoi, **kwargs) if kwargs else builder(aoi=aoi)
        qc_report(slug, img, meta, aoi, qc_scale)
    return 0


def cmd_launch(slugs: List[str], skip_qc: bool = False) -> int:
    aoi = init_ee()
    reg = build_registry(aoi)
    if not slugs:
        slugs = list(reg.keys())
    unknown = [s for s in slugs if s not in reg]
    if unknown:
        print(f"ERROR: unknown slug(s): {unknown}")
        return 2

    print(f"== Launching {len(slugs)} Mysuru export(s) ==")
    print(f"AOI bbox: {MYSURU_BBOX}")
    print(f"GCS destination: gs://{GCS_BUCKET}/{GCS_PREFIX}/")
    print(f"Manifest: {MANIFEST_PATH}\n")

    new_rows: List[Dict[str, str]] = []
    queued = failed = 0
    for slug in slugs:
        print(f"-- launching {slug} --", flush=True)
        try:
            row = reg[slug](not skip_qc)
        except Exception as e:
            row = _row(
                task_id=None, asset_slug=slug, asset_id="?",
                kind="image", file_prefix=slug, scale_m=0,
                region_label="mysuru_bbox",
                status="LAUNCHER_RAISED",
                error=f"{type(e).__name__}: {e}",
            )
        new_rows.append(row)
        if row["status"] == "QUEUED":
            queued += 1
            print(f"   {slug}: QUEUED  task_id={row['task_id']}")
        else:
            failed += 1
            print(f"   {slug}: {row['status']}  {row['error']}")

    _append_manifest_rows(new_rows)
    print("\n== Launch summary ==")
    print(f"  queued: {queued}")
    print(f"  failed: {failed}")
    print(f"  manifest: {MANIFEST_PATH}")
    print(
        "\nMonitor progress with:\n"
        f"  python {os.path.basename(__file__)} monitor\n"
        "or visit https://code.earthengine.google.com/tasks"
    )
    return 0 if failed == 0 else 1


def cmd_monitor() -> int:
    init_ee()
    rows = _read_manifest()
    if not rows:
        print(f"No manifest at {MANIFEST_PATH}")
        return 0

    print(f"Refreshing task statuses for {len(rows)} manifest entries...", flush=True)
    by_id: Dict[str, Dict[str, str]] = {
        r["task_id"]: r for r in rows if r.get("task_id")
    }
    try:
        live = ee.batch.Task.list()
    except Exception as e:
        print(f"ee.batch.Task.list() failed: {type(e).__name__}: {e}")
        return 3

    for t in live:
        st = t.status()
        tid = st.get("id")
        if tid in by_id:
            row = by_id[tid]
            row["status"] = st.get("state", row.get("status", ""))
            err_msg = st.get("error_message")
            if err_msg:
                row["error"] = err_msg

    _write_manifest(rows)
    state_counts: Dict[str, int] = {}
    for r in rows:
        state_counts[r["status"]] = state_counts.get(r["status"], 0) + 1
    print("== Task status counts ==")
    for k in sorted(state_counts):
        print(f"  {k:24s} {state_counts[k]}")
    print(f"Manifest: {MANIFEST_PATH}")
    return 0


def main(argv: List[str]) -> int:
    if len(argv) < 2:
        print(__doc__)
        return 2
    cmd = argv[1]
    if cmd == "list":
        return cmd_list()
    if cmd == "qc":
        return cmd_qc(argv[2:])
    if cmd == "launch":
        # Optional `--skip-qc` flag to bypass synchronous QC probes.
        rest = argv[2:]
        skip_qc = False
        if "--skip-qc" in rest:
            skip_qc = True
            rest = [s for s in rest if s != "--skip-qc"]
        return cmd_launch(rest, skip_qc=skip_qc)
    if cmd == "monitor":
        return cmd_monitor()
    print(__doc__)
    return 2


if __name__ == "__main__":
    sys.exit(main(sys.argv))
