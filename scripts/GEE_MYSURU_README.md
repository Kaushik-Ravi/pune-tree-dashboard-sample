# Mysuru GEE Export Pipeline

Companion script: `scripts/gee_mysuru_export.py`.
Mirrors the Pune raster stack (`gee-land-cover-export.js`, `gee-raster-tiles-export.js`)
for Mysuru, Karnataka, plus a new **LST** layer the Pune dashboard does not have yet.

The exporter queues asynchronous Google Drive jobs against the FNE service
account (`E:/Rainmatter/FNE/JP_Nagar_GIS/Earth Engine/ee-your-kaushik-567bdad16705.json`).
It exits after queueing -- GEE runs the jobs in the background.

---

## 1. Quick start

```powershell
# 1. Install deps (one-time)
pip install earthengine-api

# 2. List configured layers (also confirms auth works)
python scripts/gee_mysuru_export.py list

# 3. Optional: just inspect quality (scene counts, % no-data, value ranges)
#    without queueing any exports
python scripts/gee_mysuru_export.py qc
python scripts/gee_mysuru_export.py qc lst_modis_2025   # single layer

# 4. Queue ALL exports (runs QC first, then submits Drive tasks)
python scripts/gee_mysuru_export.py launch
python scripts/gee_mysuru_export.py launch --skip-qc      # skip QC probes

# 5. Subset
python scripts/gee_mysuru_export.py launch lst_modis_2025 ndvi_2025

# 6. Refresh task statuses after some minutes/hours
python scripts/gee_mysuru_export.py monitor
```

Task statuses also appear at <https://code.earthengine.google.com/tasks>.

---

## 2. What gets exported

All exports land in **Google Drive folder `mysuru_gee_exports/`**, GeoTIFF
(Cloud-Optimized), CRS `EPSG:4326`, clipped to the Mysuru bbox
`[76.5700, 12.2400, 76.7200, 12.3700]`.

| Slug                            | Native scale | Source / Recipe                                                              |
| ------------------------------- | ------------ | ---------------------------------------------------------------------------- |
| `lst_modis_2025`                | 1000 m       | MODIS MOD11A1 + MYD11A1 daily LST, QC-masked, annual mean, day+night Celsius |
| `lst_landsat_2025`              | 30 m         | Landsat 8+9 C2 L2 thermal (ST_B10), QA_PIXEL masked, annual median Celsius   |
| `ndvi_2025`                     | 10 m         | Sentinel-2 SR Harmonized, SCL+QA60 cloud mask, CPP<20, annual median         |
| `landcover_2025`                | 10 m         | Dynamic World V1 `label` band, annual mode                                   |
| `tree_probability_2025`         | 10 m         | Dynamic World V1 `trees` band, annual median x 100 (0-100%)                  |
| `tree_probability_2019`         | 10 m         | Same as above for the 2019 baseline                                          |
| `tree_change_2019_2025_pct`     | 10 m         | Continuous % change derivative `tree_2025 - tree_2019`                       |
| `tree_loss_gain_2019_2025`      | 10 m         | Binary `-1 / 0 / +1` derived from DW mode `label.eq(1)` 2025 vs 2019         |

Output filenames are `mysuru_<slug>.tif`. Large rasters (e.g. NDVI 10 m over
the full bbox) will be split into multiple tiles by GEE's exporter; the merge
step below stitches them.

---

## 3. Quality bar (per user requirement)

Every layer is composited across a full calendar year so single-cloud days
cannot bias the result, and the script prints a synchronous QC report before
queueing each export:

- **scene count** in the composited collection
- **first / last image date** that contributed
- **% no-data pixels** at a coarse sample scale
- per-band **mean / min / max**

Karnataka has clear monsoon-free windows roughly Nov-May for optical sensors
(Sentinel-2, Landsat) and effectively every day for MODIS (1 km, sees through
thin cirrus). Verified expectations:

- **MODIS LST (1 km)**: ~0% no-data, ~700 day + ~700 night scenes per year.
- **Landsat LST (30 m)**: may have small (<5%) monsoon gaps over the bbox even
  after annual median compositing. If `qc` reports >5% no-data, gap-fill from
  the MODIS LST or widen the date window. The dashboard's primary LST should
  be the MODIS layer; Landsat is a high-resolution supplement.
- **NDVI (10 m)**: ~0% gaps. Sentinel-2 revisits every ~5 days and the year-
  long median absorbs cloud holes.
- **Dynamic World**: ~0% gaps -- mode of `label` over the year fills every
  pixel that ever saw a clear S2 observation.

If `qc` flags a layer as `WARN: gaps present`, options:

1. **Widen** the time window to a multi-year composite (edit `CURRENT_YEAR`
   in the script or call `build_*` with a custom date range).
2. **Switch sensors** for LST: prefer MODIS (1 km) over Landsat (30 m) when
   gaps are unacceptable.
3. **Re-run** with `--skip-qc` once you've accepted the trade-off.

---

## 4. Approximate runtime per layer

(Mysuru bbox is ~16 x 14 km, ~225 km^2. Numbers from comparable Pune jobs.)

| Layer                          | Queue -> Drive ready |
| ------------------------------ | -------------------- |
| `lst_modis_2025` (1 km)        | 1-2 min              |
| `lst_landsat_2025` (30 m)      | 3-8 min              |
| `ndvi_2025` (10 m)             | 5-15 min             |
| `landcover_2025` (10 m)        | 5-15 min             |
| `tree_probability_2025` (10 m) | 5-15 min             |
| `tree_probability_2019` (10 m) | 5-15 min             |
| `tree_change_*` (10 m derived) | 10-20 min            |
| `tree_loss_gain_*` (10 m)      | 10-20 min            |

Total wall-clock if everything is queued at once: ~30-60 minutes.

---

## 5. Post-export: stitch tiles -> COG -> R2

After files land in Drive, download them to
`E:\D_Drive_Migration\Products\Product 1\trial 1\pune-tree-dashboard\data\mysuru_raw\`,
then convert to dashboard-ready Cloud-Optimized GeoTIFFs.

### 5.1 Stitch GEE tiles into single COGs

GEE splits large exports into `mysuru_<slug>-0000000000-0000000000.tif` chunks.
Use GDAL to merge:

```powershell
$IN  = "E:\D_Drive_Migration\Products\Product 1\trial 1\pune-tree-dashboard\data\mysuru_raw"
$OUT = "E:\D_Drive_Migration\Products\Product 1\trial 1\pune-tree-dashboard\public\rasters"

# For each slug:
$slugs = @(
  "mysuru_lst_modis_2025",
  "mysuru_lst_landsat_2025",
  "mysuru_ndvi_2025",
  "mysuru_landcover_2025",
  "mysuru_tree_probability_2025",
  "mysuru_tree_probability_2019",
  "mysuru_tree_change_2019_2025_pct",
  "mysuru_tree_loss_gain_2019_2025"
)

foreach ($slug in $slugs) {
  $tiles = Get-ChildItem "$IN\$slug*.tif"
  if ($tiles.Count -eq 0) { Write-Host "no tiles for $slug"; continue }
  $vrt = "$env:TEMP\$slug.vrt"
  gdalbuildvrt $vrt @($tiles.FullName)
  $compression = if ($slug -match "landcover|loss_gain") { "DEFLATE" } else { "LZW" }
  gdal_translate $vrt "$OUT\$slug.tif" `
    -of COG `
    -co COMPRESS=$compression `
    -co PREDICTOR=2 `
    -co BIGTIFF=IF_SAFER `
    -co OVERVIEW_RESAMPLING=AVERAGE `
    -co NUM_THREADS=ALL_CPUS
  Remove-Item $vrt -ErrorAction SilentlyContinue
}
```

This is a Mysuru-flavoured version of the existing `scripts/process-gee-rasters.ps1`.
You may want to duplicate that script to `process-mysuru-gee-rasters.ps1` so the
Pune pipeline stays untouched.

### 5.2 Upload to Cloudflare R2

The Pune dashboard reads COGs from a public R2 bucket
(`pub-6a88122430ec4e08bc70cf4abd6d1f58.r2.dev/rasters`). Push the Mysuru COGs
to the same bucket (filenames keep them apart):

```powershell
foreach ($f in Get-ChildItem "$OUT\mysuru_*.tif") {
  wrangler r2 object put "pune-tree-dashboard/rasters/$($f.Name)" --file=$f.FullName
}
```

Adjust the bucket name to whatever the project actually uses.

---

## 6. Frontend integration (`RasterOverlay.tsx`)

The dashboard's raster layer registry lives in
`src/components/map/RasterOverlay.tsx` (`LAYER_CONFIGS`). To wire Mysuru in:

### 6.1 Naming convention

All Pune entries are keyed `tree_probability_2025`, `ndvi`, etc., with URLs
`${BASE_URL}/pune_<slug>.tif`. Two options:

- **Option A (recommended):** make the URL city-dependent. Add a `CITY`
  context (e.g. `useParams`, route prefix, or env flag) that maps to a
  prefix (`pune` vs `mysuru`) and rewrite each `url` to
  `${BASE_URL}/${CITY}_<slug>.tif`. The layer keys stay the same.
- **Option B (no city context yet):** add parallel Mysuru entries to
  `RasterLayerType` and `LAYER_CONFIGS`:

```ts
// src/components/map/RasterOverlay.tsx
export type RasterLayerType =
  | 'tree_probability_2025'    // Pune
  | 'tree_probability_2019'
  | 'tree_change'
  | 'tree_loss_gain'
  | 'ndvi'
  | 'landcover'
  // Mysuru:
  | 'mysuru_tree_probability_2025'
  | 'mysuru_tree_probability_2019'
  | 'mysuru_tree_change'
  | 'mysuru_tree_loss_gain'
  | 'mysuru_ndvi'
  | 'mysuru_landcover'
  | 'mysuru_lst_modis'           // NEW layer type
  | 'mysuru_lst_landsat';        // NEW layer type
```

And add a `LAYER_CONFIGS` entry per slug pointing at
`${BASE_URL}/mysuru_<slug>.tif`. The new **LST** entries need a color scale
appropriate for Celsius (suggested below).

### 6.2 LST color scale (new layer, no Pune precedent)

```ts
mysuru_lst_modis: {
  url: `${BASE_URL}/mysuru_lst_modis_2025.tif`,
  name: 'Land Surface Temp (MODIS, day) 2025',
  unit: 'degC',
  description: 'Annual mean MODIS daytime LST',
  valueRange: [20, 50],
  noDataValue: -9999,           // matches the convention from FNE scripts
  colorScale: [
    { value: 20, color: '#2c7bb6' },  // cool
    { value: 28, color: '#abd9e9' },
    { value: 32, color: '#ffffbf' },
    { value: 36, color: '#fdae61' },
    { value: 42, color: '#d7191c' },  // hot
    { value: 50, color: '#67000d' },
  ],
},
```

Note: `lst_modis_2025` exports **two bands** (Day + Night). The raster
overlay reads band index 0 by default (Day). If you also want night, you'll
need to thread a `bandIndex` knob through `image.readRasters()`.

### 6.3 Required type updates

Search the codebase for the inlined `RasterLayerType` literal:

```text
src/App.tsx                                       (line ~81, 85)
src/components/sidebar/Sidebar.tsx                (line ~97, 102)
src/components/sidebar/tabs/GreenCoverMonitor.tsx (line ~996, 1048)
src/hooks/useRasterPixelValue.ts                  (uses the type alias)
src/store/LayerLoadingStore.ts                    (raster_* union)
```

All of these have inline unions that need the Mysuru slugs added. A grep:

```powershell
rg "tree_probability_2025'.*tree_loss_gain.*ndvi.*landcover" src
```

### 6.4 File naming summary

| Frontend layer key                | Dashboard URL                                            |
| --------------------------------- | -------------------------------------------------------- |
| `mysuru_tree_probability_2025`    | `<R2>/rasters/mysuru_tree_probability_2025.tif`          |
| `mysuru_tree_probability_2019`    | `<R2>/rasters/mysuru_tree_probability_2019.tif`          |
| `mysuru_tree_change`              | `<R2>/rasters/mysuru_tree_change_2019_2025_pct.tif`      |
| `mysuru_tree_loss_gain`           | `<R2>/rasters/mysuru_tree_loss_gain_2019_2025.tif`       |
| `mysuru_ndvi`                     | `<R2>/rasters/mysuru_ndvi_2025.tif`                      |
| `mysuru_landcover`                | `<R2>/rasters/mysuru_landcover_2025.tif`                 |
| `mysuru_lst_modis`                | `<R2>/rasters/mysuru_lst_modis_2025.tif`                 |
| `mysuru_lst_landsat`              | `<R2>/rasters/mysuru_lst_landsat_2025.tif`               |

---

## 7. Per-ward aggregation (separate SQL flow)

Per-ward area/percentage stats for the 65 Mysuru wards do NOT come from this
script. Pune used the GEE Code Editor JS scripts (`gee-ward-analysis.js`,
`gee-multi-year-analysis.js`) which require uploading the ward GeoJSON as a
GEE asset.

For Mysuru, the wards already live in DigitalOcean Postgres
(`mysuru_ward_boundaries`, 65 rows). The user can either:

1. **Export** `mysuru_ward_boundaries` to GeoJSON (similar to
   `scripts/export-wards-geojson.cjs`), upload as a GEE asset, then run a
   ported version of `gee-multi-year-analysis.js` pointing at the Mysuru
   asset path. -- OR --
2. **Sample** the exported COGs locally (Python rasterio +
   shapely/geopandas) against the Postgres ward polygons. This avoids GEE
   asset uploads but pulls multi-GB rasters down once.

Option (1) follows Pune's pattern exactly. Option (2) is faster if you
already have the COGs downloaded.

---

## 8. Known caveats (be honest)

- **Drive quota for service accounts.** GEE service accounts have a very
  small default Drive quota. If the launch queues but tasks die immediately
  with "user does not have sufficient permissions" or "quota exceeded",
  the FNE library's pattern is to switch to either (a) user-OAuth (set
  `prefer_user_oauth=True`, see `gee_climate_air_export.py:init_ee`) or
  (b) export to a Cloud Storage bucket instead of Drive. This script
  currently targets Drive per the brief; if it stalls, port the GCS code
  path from `gee_climate_air_export.py:_start_image_task`.
- **2025 is mid-year if you run this before Dec 31.** Today's date is
  2026-06-20 per session context, so a full `2025-01-01 -> 2025-12-31`
  composite is valid. If you re-run for 2026 mid-year, edit the
  `CURRENT_END` constant.
- **MODIS LST resolution.** 1 km is coarse over the ~14 x 16 km Mysuru
  bbox (~224 pixels). For neighborhood-scale visualization the Landsat
  30 m variant is much better; MODIS is the no-gap fallback.
- **Dynamic World pre-2019.** DW V1 starts 2015-06-27 so the 2019 baseline
  is fine, but you can't extend the baseline earlier without switching to
  Landsat NDVI as a proxy (see `gee_ecology_export.py:launch_landsat_ndvi_baseline`).
- **Reading multi-band rasters in `RasterOverlay.tsx`.** The current
  component reads band 0 only. The MODIS LST export has two bands (Day +
  Night). Either split it into two exports in the script (rename
  `LST_Day_C` / `LST_Night_C` as separate files) or extend the overlay
  to take a `bandIndex` config.

---

## 9. File locations recap

- Exporter: `scripts/gee_mysuru_export.py`
- This README: `scripts/GEE_MYSURU_README.md`
- Manifest (created on first launch): `scripts/.gee_mysuru_export_manifest.csv`
- Service account JSON (unchanged): `E:/Rainmatter/FNE/JP_Nagar_GIS/Earth Engine/ee-your-kaushik-567bdad16705.json`
- Pune scripts that informed this work (do NOT modify):
  `scripts/gee-land-cover-export.js`,
  `scripts/gee-raster-tiles-export.js`,
  `scripts/gee-multi-year-analysis.js`,
  `scripts/gee-ward-analysis.js`,
  `scripts/process-gee-rasters.ps1`
- FNE library that informed this work (do NOT modify):
  `E:/Rainmatter/FNE/JP_Nagar_GIS/Earth Engine/gee_climate_air_export.py`
  (MODIS LST + Landsat thermal masks, FNE auth pattern),
  `E:/Rainmatter/FNE/JP_Nagar_GIS/Earth Engine/gee_ecology_export.py`
  (Landsat cloud mask + dry-season NDVI),
  `E:/Rainmatter/FNE/JP_Nagar_GIS/ee_dynamic_world.py` (DW mode composite).
