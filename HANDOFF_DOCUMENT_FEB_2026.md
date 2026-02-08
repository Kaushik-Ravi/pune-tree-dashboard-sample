# PUNE TREE DASHBOARD - COMPLETE HANDOFF DOCUMENT
**Date: February 8, 2026**
**Session Summary: Bug Fixes, Server Robustness & Loading Indicators**

---

## 🎯 MISSION STATEMENT

This is the **Pune Urban Tree Dashboard** - a comprehensive geospatial visualization platform for monitoring Pune's urban tree census data (1.79 million trees) and satellite-derived land cover changes (2019-2025). The goal is to provide municipal authorities and citizens with actionable insights about urban greenery.

---

## 📋 IMMEDIATE CONTEXT FOR NEW AI ASSISTANT

**READ THIS FIRST:**
Please start by scanning the codebase to understand the architecture. Key files to read:
1. `src/App.tsx` - Main application state and component wiring
2. `src/components/map/MapView.tsx` - Main map component
3. `api/server.js` - Backend API server
4. `src/store/` - All Zustand stores (TreeStore, GreenCoverStore, FilterStore, LayerLoadingStore)
5. `src/components/sidebar/tabs/GreenCoverMonitor.tsx` - Complex Green Cover UI

**Ask clarifying questions if needed** about any part of the system before making changes.

---

## 🏗️ INFRASTRUCTURE

### Database: DigitalOcean Managed PostgreSQL
```
Host: (Check .env file - DB_HOST)
Database: defaultdb
User: (Check .env file - DB_USER)
Port: 25060 (PgBouncer)
SSL: Required (CA cert in DB_CA_CERT env var)
Connection Pool: pune-tree-pool (10 connections, transaction mode)
```

**Important Tables:**
- `trees` - 1.79 million tree records with geom (PostGIS), height_m, canopy_dia_m, girth_cm, CO2_sequestered_kg, ward, botanical_name, common_name, distance_to_road_m
- `tree_archetypes` - Species cooling effect data for Planting Advisor
- `ward_boundaries` - GeoJSON boundaries for 77 wards
- `land_cover_stats` - Year-by-year land cover percentages per ward (2019-2025)
- `land_cover_change` - Tree loss/gain comparison data between years

### Hosting
- **Frontend**: Vercel (auto-deploys from `master` branch)
- **API**: Vercel Serverless Functions (same repo, `/api/server.js`)
- **Raster Files (COGs)**: Cloudflare R2 bucket
  - URL: `https://pub-6a88122430ec4e08bc70cf4abd6d1f58.r2.dev/rasters/`
  - Files: `pune_tree_probability_2025.tif`, `pune_tree_probability_2019.tif`, `pune_tree_change_2019_2025_pct.tif`, `pune_tree_loss_gain_2019_2025.tif`, `pune_ndvi_2025.tif`, `pune_landcover_2025.tif`

### Git Repository
```
Remote: https://github.com/Kaushik-Ravi/pune-tree-dashboard-sample.git
Branch: master
Latest Commit: 53ea54d (feat: add loading indicators for all map layer toggles)
```

---

## 🔧 CHANGES MADE THIS SESSION

### 1. CRITICAL BUG FIX: Restored `queryWithRetry()` Function

**Problem:** The `queryWithRetry()` function was accidentally removed in commit 2b65d99, but was still being called by 20+ API endpoints. This caused `ReferenceError: queryWithRetry is not defined` for ALL API calls.

**File:** `api/server.js`

**Fix Applied:**
```javascript
// Added after line 57 (after logConnection function)
async function queryWithRetry(queryText, params = [], retries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await pool.query(queryText, params);
      logConnection();
      return result;
    } catch (err) {
      const isConnectionError = err.message.includes('timeout') ||
                                 err.message.includes('connection') ||
                                 err.message.includes('ECONNREFUSED') ||
                                 err.message.includes('Connection terminated') ||
                                 err.code === 'ECONNREFUSED' ||
                                 err.code === 'ECONNRESET' ||
                                 err.code === '57P01'; // admin_shutdown

      if (isConnectionError && attempt < retries) {
        console.warn(`[Query] Attempt ${attempt}/${retries} failed: ${err.message}. Retrying in ${delay * attempt}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay * attempt)); // Exponential backoff
        continue;
      }
      throw err;
    }
  }
}
```

**Also Updated:**
- Health endpoint now uses `queryWithRetry()` and reports pool stats
- `connectionTimeoutMillis` increased from 10s to 15s for cold starts
- Added `application_name: 'pune-tree-dashboard'` for PgBouncer debugging

**Commit:** 34e84ac

---

### 2. FEATURE: Loading Indicators for Map Layers

**Problem:** When clicking layer toggles (Satellite Raster, Land Cover Overlay, Deforestation Hotspots), there was no feedback while data loaded (1-3 seconds), confusing users.

**Solution:** Created centralized loading state management with visual feedback.

#### New File: `src/store/LayerLoadingStore.ts`
```typescript
// Zustand store tracking loading state for each layer type
// Features:
// - Set<LayerType> tracks which layers are currently loading
// - 30-second safety timeout auto-clears stuck states
// - Helper functions: isLoading(), isAnyRasterLoading()
```

#### Modified Files:

**`src/components/map/RasterOverlay.tsx`**
- Added: `import { useLayerLoadingStore, rasterLayerToStoreType } from '../../store/LayerLoadingStore';`
- Reports loading state when COG fetch starts/completes
- Clears loading on unmount

**`src/components/map/LandCoverOverlay.tsx`**
- Added: `import { useLayerLoadingStore } from '../../store/LayerLoadingStore';`
- Reports 'ward_overlay' loading state during fetch

**`src/components/map/DeforestationHotspotsLayer.tsx`**
- Added: `import { useLayerLoadingStore } from '../../store/LayerLoadingStore';`
- Reports 'deforestation_hotspots' loading state

**`src/components/sidebar/tabs/GreenCoverMonitor.tsx`**
- Added: `import { Loader2 } from 'lucide-react';`
- Added: Loading state selectors from LayerLoadingStore
- Updated all three toggle buttons to show:
  - Spinning Loader2 icon during load
  - "Loading..." text
  - Disabled state with cursor-wait
  - Inline loading indicator below layer selection

**Commit:** 53ea54d

---

### 3. PREVIOUS SESSION FIX: Deforestation Hotspots Layer

**Problem:** "Deforestation Hotspots" layer showed NO wards despite being enabled.

**Root Cause:** The actual tree loss percentages in the data were 0.03% - 0.31%, but the threshold slider was set to require 3%+ loss.

**Fix Applied:**
- Default `lossThreshold` changed from `3` to `0.1`
- Slider range changed from `1-15%` to `0.01-1%` with step `0.01`
- Severity thresholds scaled: Severe ≥0.25%, Moderate ≥0.15%

**Files Modified:**
- `src/App.tsx` - Line ~45: `lossThreshold: 0.1`
- `src/components/sidebar/tabs/GreenCoverMonitor.tsx` - Slider min/max/step
- `src/components/map/DeforestationHotspotsLayer.tsx` - Severity calculation

---

### 4. PREVIOUS SESSION FEATURE: Raster Tooltip on Hover

**Problem:** User wanted to see pixel values when hovering over raster overlays.

**New Files Created:**
- `src/hooks/useRasterPixelValue.ts` - Hook that reads COG pixel values at coordinates
- `src/components/map/RasterTooltip.tsx` - Tooltip UI component

**How It Works:**
1. MapView tracks mouse position on `mousemove`
2. When raster layer is visible, `useRasterPixelValue` reads pixel at coordinates
3. Uses cached GeoTIFF instances for performance
4. Debounced at 150ms to avoid excessive reads
5. Shows color swatch, formatted value, description

**Integration in:** `src/components/map/MapView.tsx` (handleMouseMove, handleMouseLeave)

---

## 📁 KEY FILE LOCATIONS

### Frontend (React + TypeScript + Vite)
```
src/
├── App.tsx                           # Main app, all state management
├── main.tsx                          # Entry point
├── index.css                         # Tailwind base styles
├── components/
│   ├── Header.tsx                    # Top navigation bar
│   ├── map/
│   │   ├── MapView.tsx               # Main MapLibre GL JS map
│   │   ├── RasterOverlay.tsx         # COG visualization layer
│   │   ├── RasterTooltip.tsx         # Hover tooltip for raster values
│   │   ├── LandCoverOverlay.tsx      # Ward boundary choropleth
│   │   ├── DeforestationHotspotsLayer.tsx  # Red hotspot wards
│   │   └── TreeLayerMapLibre.tsx     # Tree point visualization
│   ├── sidebar/
│   │   ├── Sidebar.tsx               # Tab container
│   │   └── tabs/
│   │       ├── CityOverview.tsx      # City stats dashboard
│   │       ├── GreenCoverMonitor.tsx # Main green cover UI (1800+ lines)
│   │       ├── MapLayers.tsx         # Base map & shadow controls
│   │       ├── PlantingAdvisor.tsx   # Tree species recommender
│   │       └── LightAndShadowControl.tsx  # Time-of-day lighting
│   └── filters/
│       └── FilterPanel.tsx           # Tree filtering UI
├── hooks/
│   ├── useRasterPixelValue.ts        # Read COG pixel values
│   ├── useSunPosition.ts             # Solar calculations
│   └── index.ts
├── store/
│   ├── TreeStore.tsx                 # Tree data & city stats (Zustand)
│   ├── GreenCoverStore.tsx           # Land cover data (Zustand + localStorage cache)
│   ├── FilterStore.tsx               # Filter state (Zustand)
│   └── LayerLoadingStore.ts          # Loading indicators (Zustand) [NEW]
└── config/
    ├── index.ts                      # API base URL config
    └── production.ts                 # Production overrides
```

### Backend (Express.js for Vercel Serverless)
```
api/
├── server.js                         # Main API server (1180+ lines)
└── package.json                      # Server dependencies
```

### Key API Endpoints in server.js
| Endpoint | Purpose |
|----------|---------|
| `GET /api/health` | Database connection check |
| `GET /api/city-stats` | Total trees, CO2 |
| `GET /api/ward-data` | Per-ward tree counts |
| `GET /api/ward-boundaries` | GeoJSON ward polygons |
| `GET /api/filter-metadata` | Species, wards, ranges for filters |
| `POST /api/filtered-stats` | Stats with applied filters |
| `GET /api/land-cover/stats` | Land cover % by ward/year |
| `GET /api/land-cover/comparison` | Year-over-year change |
| `GET /api/tree-archetypes` | Species cooling data |
| `POST /api/trees-in-bounds` | Trees in viewport |
| `GET /api/sun-path` | Sun position for shadows |

---

## 🌳 DATA MODELS

### Tree Record (PostgreSQL)
```sql
CREATE TABLE trees (
  id SERIAL PRIMARY KEY,
  geom GEOMETRY(Point, 4326),
  girth_cm NUMERIC,
  height_m NUMERIC,
  canopy_dia_m NUMERIC,
  botanical_name VARCHAR,
  common_name VARCHAR,
  "CO2_sequestered_kg" NUMERIC,
  economic_i VARCHAR,
  flowering VARCHAR,
  ward VARCHAR,
  wood_density NUMERIC,
  distance_to_road_m NUMERIC  -- For street/non-street classification
);
-- Spatial index on geom for fast bbox queries
```

### Land Cover Stats
```sql
CREATE TABLE land_cover_stats (
  ward_number INTEGER,
  year INTEGER,
  total_area_m2 NUMERIC,
  trees_area_m2 NUMERIC,
  built_area_m2 NUMERIC,
  grass_area_m2 NUMERIC,
  bare_area_m2 NUMERIC,
  trees_pct NUMERIC,
  built_pct NUMERIC,
  grass_pct NUMERIC,
  bare_pct NUMERIC
);
```

### Land Cover Change (Comparison)
```sql
CREATE TABLE land_cover_change (
  ward_number INTEGER,
  from_year INTEGER,
  to_year INTEGER,
  period VARCHAR,
  trees_lost_m2 NUMERIC,
  trees_gained_m2 NUMERIC,
  net_tree_change_m2 NUMERIC,
  built_gained_m2 NUMERIC,
  trees_to_built_m2 NUMERIC
);
```

---

## 🔄 STATE MANAGEMENT

### GreenCoverStore (Zustand + localStorage)
```typescript
interface GreenCoverStore {
  // Data
  timelineData: CityTimelineData[];      // City-wide yearly stats
  wardData: WardYearData[];              // Per-ward land cover by year
  comparisonData: WardComparison[];      // 2019-2025 change per ward
  wardStats: WardStats[];                // Aggregated ward statistics
  
  // State
  isLoading: boolean;
  error: string | null;
  lastFetched: number | null;            // Timestamp for cache freshness
  isInitialized: boolean;
  
  // Actions
  fetchAllData: () => Promise<void>;     // Fetches all data, uses cache if <5min old
  flyToWard: (wardNumber: number) => void; // Triggers map fly-to
  
  // Cache: localStorage with 5-minute freshness check
}
```

### LayerLoadingStore (Zustand) [NEW]
```typescript
interface LayerLoadingState {
  loadingLayers: Set<LayerType>;
  setLoading: (layer: LayerType, isLoading: boolean) => void;
  isLoading: (layer: LayerType) => boolean;
  isAnyRasterLoading: () => boolean;
  clearAll: () => void;
}

type LayerType = 
  | 'raster_tree_probability_2025'
  | 'raster_tree_probability_2019'
  | 'raster_tree_change'
  | 'raster_tree_loss_gain'
  | 'raster_ndvi'
  | 'raster_landcover'
  | 'ward_overlay'
  | 'deforestation_hotspots'
  | 'lst_overlay';
```

---

## 🚀 DEVELOPMENT WORKFLOW

### Local Development
```bash
# Terminal 1: Start API server
cd api
node server.js
# Runs on http://localhost:3001

# Terminal 2: Start frontend
npm run dev
# Runs on http://localhost:5173
```

### Environment Variables (.env)
```
DB_USER=<digitalocean_user>
DB_HOST=<digitalocean_pgbouncer_host>
DB_DATABASE=defaultdb
DB_PASSWORD=<password>
DB_PORT=25060
DB_CA_CERT=<base64_encoded_ca_certificate>
VERCEL=1  # Set only in Vercel environment
```

### Deployment
```bash
git add -A
git commit -m "feat/fix: description"
git push origin master
# Vercel auto-deploys in ~30 seconds
```

---

## 📊 KEY METRICS & THRESHOLDS

### Deforestation Severity (in GreenCoverMonitor & DeforestationHotspotsLayer)
- **Severe**: ≥0.25% net tree loss
- **Moderate**: ≥0.15% net tree loss  
- **Minor**: <0.15% net tree loss
- **Slider Range**: 0.01% - 1%
- **Default Threshold**: 0.1%

### Actual Data Ranges (from API query)
- Ward 53: -0.31% (largest loss)
- Ward 20: -0.19%
- Ward 42: -0.03%
- Most wards: 0% or slight gain

### Pool Configuration (PgBouncer compatible)
```javascript
max: 3,                          // Low per-instance, PgBouncer handles pooling
min: 0,                          // No idle connections in serverless
idleTimeoutMillis: 10000,        // 10s idle timeout
connectionTimeoutMillis: 15000,  // 15s for cold starts
allowExitOnIdle: true,           // Serverless compatibility
```

---

## 🐛 KNOWN ISSUES & CONSIDERATIONS

1. **Raster files are large** - COGs use HTTP range requests, but first load can be slow
2. **localStorage cache** - GreenCoverStore caches for 5 min; clear if data seems stale
3. **Ward numbers** - Database has string wards like "1.0", UI displays as integers
4. **Shadow system disabled** - Requires MapTiler Buildings tileset (additional cost)
5. **baseline-browser-mapping warning** - Can be ignored, just outdated dev dependency

---

## 📝 PROMPT FOR NEXT AI SESSION

Copy and paste this to start your next session:

```
I'm continuing work on the Pune Tree Dashboard project. Please read the HANDOFF_DOCUMENT_FEB_2026.md file in the workspace root for complete context about:
- Infrastructure (DigitalOcean PostgreSQL, Vercel, Cloudflare R2)
- Recent changes (server.js fix, loading indicators)
- Key files and their purposes
- State management with Zustand stores
- API endpoints

Before we proceed:
1. Please scan the codebase to verify your understanding
2. Check api/server.js to confirm queryWithRetry() function exists
3. Ask me any clarifying questions about the architecture

My next task is: [DESCRIBE YOUR NEXT TASK HERE]
```

---

## ✅ SESSION COMMITS

| Commit | Message | Files Changed |
|--------|---------|---------------|
| 34e84ac | fix: restore queryWithRetry function and improve server robustness | api/server.js, HANDOFF_DOCUMENT_FEB_2026.md (deleted) |
| 53ea54d | feat: add loading indicators for all map layer toggles | 5 files (LayerLoadingStore.ts new, 4 modified) |

---

## 🎯 WHAT'S WORKING NOW

✅ API server responds correctly (health check returns OK)  
✅ All 20+ API endpoints use retry logic  
✅ Deforestation hotspots show wards with tree loss (0.1%+ threshold)  
✅ Raster tooltip shows pixel values on hover  
✅ Loading spinners appear when toggling map layers  
✅ Git pushes auto-deploy to Vercel  
✅ Database connection is robust with exponential backoff  

---

*Document generated: February 8, 2026*
*Last commit: 53ea54d*
