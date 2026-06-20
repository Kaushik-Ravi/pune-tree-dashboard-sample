# Mysuru rasters integration roadmap

End-to-end plan for getting Land Surface Temperature, NDVI, Dynamic World landcover, and tree-probability rasters from Google Earth Engine into the live Mysuru dashboard (LST as a Map Layers toggle, the rest as the Green Cover Monitor tab).

Sequential — each step depends on the previous. Time estimates are wall-clock; user time is roughly half (most of it is GEE/Vercel/R2 doing async work).

## Phase 0 — One-time GEE auth refresh (user, 2 min)

The service account in `ee-your-kaushik-567bdad16705.json` cannot write to Google Drive (no per-user storage quota — Drive is keyed to a human Google account). Switch to user OAuth.

```powershell
earthengine authenticate
```

Opens a browser → log in with the Google account that owns the Drive folder you want exports to land in → paste the verification code back into the terminal. Token is cached at `~/.config/earthengine/credentials` for ~7 days.

Verify it worked:
```powershell
python -c "import ee; ee.Initialize(project='ee-your-kaushik'); print(ee.Image('USGS/SRTMGL1_003').getInfo()['id'])"
```

Should print `USGS/SRTMGL1_003` without any auth prompt.

## Phase 1 — Relaunch the 5 exports (user, 1 min to kick off, 10–30 min wait)

```powershell
cd "E:\D_Drive_Migration\Products\Product 1\trial 1\pune-tree-dashboard"
python scripts/gee_mysuru_export.py launch --skip-qc ndvi_2025 landcover_2025 lst_landsat_2025 tree_probability_2025 tree_probability_2019
```

The five tasks queue on GEE servers and run in parallel. Monitor:

```powershell
python scripts/gee_mysuru_export.py monitor
```

When all show `COMPLETED`, they will appear in your Google Drive under folder **`mysuru_gee_exports/`** as five GeoTIFFs:
- `mysuru_ndvi_2025.tif`
- `mysuru_landcover_2025.tif`
- `mysuru_lst_landsat_2025.tif`
- `mysuru_tree_probability_2025.tif`
- `mysuru_tree_probability_2019.tif`

If any task FAILS, check the manifest CSV for the error:
```powershell
type scripts\.gee_mysuru_export_manifest.csv
```

## Phase 2 — Download rasters from Drive to local (user, 5 min)

Manually download all five from Drive into the gitignored project staging directory:

```
data/processed-rasters/mysuru/
  mysuru_ndvi_2025.tif
  mysuru_landcover_2025.tif
  mysuru_lst_landsat_2025.tif
  mysuru_tree_probability_2025.tif
  mysuru_tree_probability_2019.tif
```

(Alternatively `pip install gdown` and pull via file IDs — but the manual web UI is faster for 5 files.)

## Phase 3 — QGIS review (user, 10 min)

Open each in QGIS, check:
- **LST**: temperature range plausible (24–44 °C for Karnataka 2025), no obvious cloud holes, coverage spans the Mysuru bbox
- **NDVI**: range -1 to +1, vegetation clearly distinguishable from built/water
- **Dynamic World landcover**: discrete class values 0–8 (water, trees, grass, flooded, shrub, crops, built, bare, snow)
- **Tree probability**: 0–1 floats, urban core lower than periphery

Anything that looks wrong → re-export with adjusted bounds or year. Anything good → next phase.

## Phase 4 — Convert to Cloud-Optimized GeoTIFF (you+me, 10 min)

COGs let MapLibre fetch byte-ranges instead of the full file. Pune uses them already.

```powershell
gdal_translate -of COG -co COMPRESS=DEFLATE -co BLOCKSIZE=512 -co OVERVIEWS=AUTO `
  data/processed-rasters/mysuru/mysuru_ndvi_2025.tif `
  data/processed-rasters/mysuru/mysuru_ndvi_2025_cog.tif
```

Repeat for the other 4. Or batch via a one-liner foreach.

The README `scripts/GEE_MYSURU_README.md` has the full gdal commands per layer.

## Phase 5 — Compute change derivatives (you+me, 5 min)

Skip the change-derivative GEE exports — easier to compute locally from the 2019 and 2025 tree-probability COGs:

```powershell
gdal_calc.py -A data/processed-rasters/mysuru/mysuru_tree_probability_2025_cog.tif `
             -B data/processed-rasters/mysuru/mysuru_tree_probability_2019_cog.tif `
             --outfile=data/processed-rasters/mysuru/mysuru_tree_change_2019_2025_pct_cog.tif `
             --calc="(A-B)*100" --type=Float32 --co=COMPRESS=DEFLATE --co=TILED=YES
```

```powershell
gdal_calc.py -A data/processed-rasters/mysuru/mysuru_tree_probability_2025_cog.tif `
             -B data/processed-rasters/mysuru/mysuru_tree_probability_2019_cog.tif `
             --outfile=data/processed-rasters/mysuru/mysuru_tree_loss_gain_2019_2025_cog.tif `
             --calc="numpy.sign(A-B) * (numpy.abs(A-B) > 0.1)" --type=Int8 --co=COMPRESS=DEFLATE --co=TILED=YES
```

## Phase 6 — Upload to Cloudflare R2 (user, 5 min)

Pune's R2 bucket is `pub-6a88122430ec4e08bc70cf4abd6d1f58.r2.dev`. Upload the 7 Mysuru COGs to a `mysuru_*` prefix (matches the naming Pune already uses):

- `mysuru_lst_landsat_2025.tif`
- `mysuru_ndvi_2025.tif`
- `mysuru_landcover_2025.tif`
- `mysuru_tree_probability_2025.tif`
- `mysuru_tree_probability_2019.tif`
- `mysuru_tree_change_2019_2025_pct.tif`
- `mysuru_tree_loss_gain_2019_2025.tif`

Upload via the Cloudflare R2 web UI or `rclone copy`. After upload, verify each is reachable:
```powershell
curl -I https://pub-6a88122430ec4e08bc70cf4abd6d1f58.r2.dev/mysuru_ndvi_2025.tif
```

Expect `HTTP/2 200` with `accept-ranges: bytes`.

## Phase 7 — Wire RasterOverlay to use Mysuru COGs (me, 30 min)

`src/components/map/RasterOverlay.tsx` currently has hardcoded Pune URLs in 6 places. Refactor to:

1. Read `activeCityId` from CityStore.
2. Build the R2 URL from a city-keyed table:
   ```ts
   const RASTER_URLS = {
     pune: {
       tree_probability_2025: 'https://pub-.../pune_tree_probability_2025.tif',
       // ... (existing)
     },
     mysuru: {
       tree_probability_2025: 'https://pub-.../mysuru_tree_probability_2025.tif',
       ndvi: 'https://pub-.../mysuru_ndvi_2025.tif',
       landcover: 'https://pub-.../mysuru_landcover_2025.tif',
       tree_change: 'https://pub-.../mysuru_tree_change_2019_2025_pct.tif',
       tree_loss_gain: 'https://pub-.../mysuru_tree_loss_gain_2019_2025.tif',
       // Note: no MODIS LST since we use Landsat directly via lst.tif
     },
   };
   ```

3. Pixel-color scales stay the same per layer (NDVI -1 to 1, landcover 0–8 etc.).

## Phase 8 — LST in Map Layers tab for Mysuru (me, 20 min)

Currently `src/components/sidebar/tabs/MapLayers.tsx` has a single `showLSTOverlay` toggle that loads Pune's `lst_pune.png`. Replace with city-aware:

1. For Pune: keep PNG overlay (small file, fast).
2. For Mysuru: use the LST GeoTIFF served as a COG raster overlay (like the Pune rasters).
3. Both fed via the same `showLSTOverlay` boolean from App.tsx.

In `src/components/map/MapView.tsx`, branch the LST source:
```tsx
{showLSTOverlay && activeCityId === 'pune' && (<Source ... lst_pune.png ... />)}
{showLSTOverlay && activeCityId === 'mysuru' && (<RasterOverlay layer="lst" ... />)}
```

## Phase 9 — Re-enable Green Cover Monitor tab for Mysuru (me, 1 hour)

`src/components/sidebar/Sidebar.tsx` currently marks Green Cover as `puneOnly: true`. Drop that flag once Mysuru landcover + per-ward stats exist.

But the existing GreenCoverMonitor component does a lot more than render rasters — it queries `/api/green-cover/bundle` for the timeline 2019–2025. Mysuru doesn't have that yet. Two paths:

**A) Minimum Mysuru green-cover tab (recommended first)**:
- Re-enables tab when city = mysuru AND a feature flag is on.
- Shows only: Landcover toggle (visual overlay) + NDVI toggle + Tree probability toggle.
- Skips: timeline, ward leaderboard, deforestation hotspots (need per-ward aggregation we don't have).
- Wire ward boundaries toggle here so MysuruWardBoundaryLayer becomes visible while the tab is open.

**B) Full parity with Pune**:
- Requires per-ward landcover stats for Mysuru. Either:
  - Add a GEE export that aggregates Dynamic World per Mysuru ward (zonal stats), exported as CSV
  - OR compute it server-side from the COG and the ward polygons (heavier)
- Defer until after the Mapathon.

Recommend A for the first iteration. B as a follow-up.

## Phase 10 — Deploy + smoke test (me, 5 min)

After R2 upload + frontend wiring:

```powershell
git add -A
git commit -m "feat: wire Mysuru rasters into RasterOverlay + Green Cover Monitor"
git push
vercel --prod
```

Then visit https://pune-tree-dashboard-sample.vercel.app , switch to Mysuru, open Green Cover tab (now visible), toggle Landcover/NDVI overlays, verify rasters render aligned with the ward boundaries.

## Followups (post-mapathon)

- **CO2 estimate for Mysuru trees** — mapped_trees has dbh + height; apply Chave 2014 allometric formula in the API, populate the empty CO2 number.
- **Mysuru ward leaderboard** — needs cross-DB join (Supabase trees → DO ward polygons). Either materialize a cached aggregate per-ward in DO Postgres, refreshed by a cron, OR do JS-side aggregation at the API.
- **Tree image_url access** — currently `tree_results.image_url` is RLS-blocked. Options to surface in chat: (a) ask mobile team to copy image_url into mapped_trees, (b) get a Supabase service-role key for the dashboard backend (server-side only, never exposed), (c) ask mobile team for a permissive RLS policy on the image_url column.
- **Real-time updates instead of 15s polling** — switch to Supabase Realtime websocket once stability is proven.
