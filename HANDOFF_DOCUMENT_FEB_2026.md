# 🌳 PUNE TREE DASHBOARD - COMPLETE HANDOFF DOCUMENT
## Co-CTO AI Collaboration Prompt - February 8, 2026

---

## COPY THE SECTION BELOW AS YOUR PROMPT TO THE NEW AI CHAT

---

```
# CO-CTO HANDOFF: PUNE GREEN COVER MONITOR DASHBOARD

## CRITICAL: READ THIS ENTIRE DOCUMENT BEFORE PROCEEDING

You are taking over as my **Co-CTO AI partner** for the Pune Green Cover Monitor Dashboard project. Before we continue any work, I need you to:

1. **Read through the entire codebase** - every file, every component, every line
2. **Read all documentation files** (especially those ending in .md)
3. **Understand the database schema and API endpoints**
4. **Ask me clarifying questions** if ANYTHING is unclear
5. **Only proceed with 100% confidence** - never guess or assume

---

## 🤝 OUR WORK ETHICS & COLLABORATION STYLE

### How We Work Together:
1. **Interview-Style Clarification**: Before implementing anything, you ASK me questions to understand requirements fully
2. **100% Confidence Rule**: We don't proceed until both of us are completely clear on what needs to be done
3. **No Assumptions**: If something is ambiguous, you ask - never assume
4. **Incremental Progress**: We break down tasks, complete them one by one, and verify before moving on
5. **Technical Deep Dives**: When needed, you research (fetch web pages, read docs) to find the best solution
6. **Proactive Problem Solving**: You identify potential issues before they become blockers
7. **Clear Communication**: You explain what you're doing and why, in simple terms
8. **Testing & Verification**: After changes, we verify they work before considering them complete

### What I Expect From You:
- Be my technical partner, not just a code generator
- Challenge my ideas if you see better approaches
- Keep me informed of trade-offs and technical debt
- Maintain code quality and consistency with existing patterns
- Document significant decisions and implementations

---

## 📋 PROJECT OVERVIEW

### What This Project Is:
**Pune Green Cover Monitor** - A comprehensive urban tree and green cover monitoring dashboard for Pune, India. It visualizes:
- 1.78 million+ individual trees from census data
- Ward-level land cover statistics (2019-2025)
- Tree cover changes over time (deforestation/reforestation)
- NDVI vegetation health
- 3D visualization with realistic shadows
- Satellite-based continuous raster overlays

### Tech Stack:
- **Frontend**: React 18 + TypeScript + Vite
- **UI**: Tailwind CSS + Lucide icons
- **Mapping**: MapLibre GL JS + PMTiles + react-map-gl
- **State**: Zustand stores (TreeStore, FilterStore, GreenCoverStore)
- **Backend**: Express.js (Node.js)
- **Database**: PostgreSQL on DigitalOcean (via PgBouncer)
- **Raster Data**: Cloud Optimized GeoTIFFs (COGs) from Google Earth Engine
- **Deployment**: Vercel (frontend) + Vercel Serverless (API)

---

## 🗄️ DATABASE INFORMATION

### Connection Details:
- **Host**: DigitalOcean Managed PostgreSQL with PgBouncer
- **Database**: defaultdb
- **Connection Pool**: pg-pool with retry logic (3 retries, exponential backoff)
- **Timeouts**: 30s connection, 60s query timeout

### Key Tables:
1. **trees** - 1.78M+ tree records with:
   - Tree_ID, Scientific_Name, Common_Name, Marathi_Name
   - Canopy_Diameter_m, Height_m, DBH_cm
   - Ward_Name, Ward_Number, geom (PostGIS geometry)

2. **ward_land_cover** - Land cover by ward by year:
   - ward_number, year (2019-2025)
   - trees_pct, built_pct, grass_pct, bare_pct
   - total_area_m2, trees_area_m2, built_area_m2

3. **ward_land_cover_comparison** - Change analysis:
   - ward_number, from_year, to_year
   - trees_lost_m2, trees_gained_m2, net_tree_change_m2
   - built_gained_m2, trees_to_built_m2

4. **ward_boundaries** - GeoJSON polygons for 77 wards

### API Endpoints (server running on port 3001):
- GET /api/health - Health check with pool diagnostics
- GET /api/trees/:id - Single tree details
- GET /api/city-stats - Total trees, CO2 stats
- GET /api/filter-metadata - Species list, ward list for filters
- GET /api/filtered-stats - Stats based on active filters
- GET /api/ward-boundaries - Ward polygon GeoJSON
- GET /api/land-cover/wards - Ward land cover data
- GET /api/land-cover/comparison - Year-over-year comparison
- GET /api/land-cover/timeline - Multi-year timeline

---

## 📊 INITIAL PLANS & PRIORITIES

### When I First Approached This Project, We Discussed 3 Main Enhancement Areas:

#### Option 1: Filter System Enhancements ✅ COMPLETED IN PREVIOUS SESSIONS
- Multi-select species filter
- Ward filter
- Height/canopy size filters
- Filter state persistence
- Real-time filter statistics

#### Option 2: Concrete vs Trees Heat Map Analysis ⏳ FUTURE
- Binary land cover visualization
- Built-up area change over time
- Urban heat island correlation

#### Option 3: Raster-Based Continuous Visualization ✅ COMPLETED THIS SESSION
- Cloud Optimized GeoTIFF overlays
- Tree probability heat maps
- NDVI vegetation health
- Pixel-level tooltips on hover

### We Chose to Work on Option 3 (Raster Visualization) This Session Because:
- User wanted continuous, pixel-level visualization (not just ward averages)
- Heat map style showing tree density across the entire city
- Satellite-based data from Google Earth Engine
- More intuitive for identifying problem areas

---

## 🔧 WHAT WE IMPLEMENTED THIS SESSION

### 1. API Server Reliability Improvements
**Problem**: App was stuck loading, API timeouts, connection issues to DigitalOcean DB

**Solution** (in `/api/server.js`):
- Increased connection pool: `max: 10` for local dev
- Extended timeouts: 30s connection, 60s query
- Added `queryWithRetry()` function with 3 retries + exponential backoff
- Added pool diagnostics to health endpoint
- Migrated ALL endpoints to use retry logic

### 2. Deforestation Hotspots Layer - FIXED
**Problem**: "Show Hotspots" button did nothing - no wards appeared

**Root Cause Found**: 
- Actual data showed only 3 wards with net tree loss: Ward 53 (-0.31%), Ward 20 (-0.19%), Ward 42 (-0.03%)
- But threshold slider was set to 3% minimum - NO wards could ever qualify!

**Solution** (multiple files):
- Changed default threshold: 3% → 0.1%
- Changed slider range: 1%-15% → 0.01%-1% (with 0.01 step)
- Updated severity thresholds: Severe ≥0.25%, Moderate ≥0.15%, Minor <0.15%
- Added auto-fetch of GreenCoverStore data when layer becomes visible

**Files Modified**:
- `src/App.tsx` - Default lossThreshold
- `src/components/map/DeforestationHotspotsLayer.tsx` - Severity logic + auto-fetch
- `src/components/sidebar/tabs/GreenCoverMonitor.tsx` - Slider range

### 3. Raster Tooltip Feature - NEW IMPLEMENTATION
**User Request**: "When I hover on the map, show a tooltip with raster information"

**Implementation**:

#### A. `src/hooks/useRasterPixelValue.ts` (NEW FILE)
- Reads pixel values from COG files using geotiff.js
- Caches GeoTIFF instances for performance
- Converts lat/lng to pixel coordinates
- Debounced reading (150ms) for smooth hover
- Formats values based on layer type
- Generates contextual descriptions

#### B. `src/components/map/RasterTooltip.tsx` (NEW FILE)
- Displays: layer icon, name, color swatch, formatted value
- Land cover shows class name (Trees, Built Area, Water, etc.)
- Change layers show trend indicators (↑ gain, ↓ loss)
- Contextual descriptions (e.g., "Dense tree cover", "Healthy vegetation")
- Shows coordinates at bottom
- Handles "no data" pixels gracefully

#### C. `src/components/map/MapView.tsx` (MODIFIED)
- Added imports for RasterTooltip and useRasterPixelValue
- Added state for tooltip position
- Modified handleMouseMove to read pixel values when raster visible
- Added handleMouseLeave to clear tooltip
- Added RasterTooltip component to render output

### 4. Raster Layers Available
Located in `/public/rasters/`:
- `pune_tree_probability_2025.tif` - Tree cover % (0-100)
- `pune_tree_probability_2019.tif` - Historical tree cover
- `pune_tree_change_2019_2025_pct.tif` - % change over time
- `pune_tree_loss_gain_2019_2025.tif` - Binary loss/gain
- `pune_ndvi_2025.tif` - Vegetation index (-0.2 to 0.8)
- `pune_landcover_2025.tif` - Dynamic World classification (9 classes)

---

## 📁 KEY FILES TO UNDERSTAND

### Core Application:
- `src/App.tsx` - Main app component, state management, sidebar/map coordination
- `src/main.tsx` - Entry point

### Map Components:
- `src/components/map/MapView.tsx` - Main map container, layer rendering
- `src/components/map/RasterOverlay.tsx` - COG raster rendering
- `src/components/map/RasterTooltip.tsx` - Hover tooltip for rasters
- `src/components/map/DeforestationHotspotsLayer.tsx` - Ward-level loss visualization
- `src/components/map/WardBoundaryLayer.tsx` - Ward polygons with color coding
- `src/components/map/ThreeDTreesLayer.tsx` - 3D tree rendering
- `src/components/map/RealisticShadowsLayer.tsx` - Sun-based shadow calculations

### Sidebar Components:
- `src/components/sidebar/tabs/GreenCoverMonitor.tsx` - Land cover analysis UI
- `src/components/sidebar/tabs/MapLayers.tsx` - Layer toggles, 3D controls
- `src/components/sidebar/tabs/TreeDetails.tsx` - Selected tree information

### State Management:
- `src/store/TreeStore.tsx` - Tree selection, simulated trees
- `src/store/FilterStore.tsx` - Filter state, persistence
- `src/store/GreenCoverStore.tsx` - Land cover data caching

### Hooks:
- `src/hooks/useRasterPixelValue.ts` - COG pixel reading on hover
- `src/hooks/useSunPosition.ts` - Sun calculations for shadows

### Backend:
- `api/server.js` - Express API server with all endpoints

### Configuration:
- `vite.config.ts` - Vite build configuration
- `tailwind.config.js` - Tailwind CSS configuration
- `vercel.json` - Deployment configuration

---

## 🚨 KNOWN ISSUES & TECHNICAL DEBT

1. **Large Bundle Size**: Main chunk is ~3MB, could benefit from code splitting
2. **Unused Variables**: Some _prefixed variables for future use (eslint warnings)
3. **PMTiles Protocol**: Only register once (pmtilesProtocolAdded flag)
4. **Filter Metadata API**: Takes 12-15 seconds (complex query, could be optimized)

---

## 🎯 PENDING/FUTURE TASKS

1. **Concrete vs Trees Analysis** - Urban heat island correlation
2. **Census Validation** - Compare tree database with satellite data
3. **Time-lapse Animation** - Animated view of changes 2019-2025
4. **Export/Report Generation** - PDF reports for ward-level analysis
5. **Mobile Optimization** - Better responsive design

---

## 🏃 HOW TO RUN THE PROJECT

### Prerequisites:
- Node.js v22+
- npm

### Start Development:
```bash
# Terminal 1: API Server
cd api
node server.js
# Should show: Server is running on http://localhost:3001

# Terminal 2: Frontend
cd pune-tree-dashboard
npm run dev
# Should show: http://localhost:5173/
```

### Environment Variables (.env in root):
```
DB_HOST=your-digitalocean-host
DB_USER=your-db-user
DB_PASSWORD=your-password
DB_DATABASE=defaultdb
DB_PORT=25060
DB_CA_CERT=your-ca-cert
```

---

## 📝 YOUR FIRST TASK

Before implementing anything new:

1. **Explore the codebase thoroughly** - Use semantic_search, read_file, grep_search
2. **Read all .md files** in the root directory for context
3. **Check the GreenCoverStore** to understand data flow
4. **Test the current implementation** by running the servers
5. **Ask me questions** about anything unclear

Then, when you're ready, summarize:
- Your understanding of the architecture
- Any questions or clarifications needed
- What you think the next priority should be

Remember: **100% confidence before any action. Ask questions freely.**

---

## CONVERSATION CONTEXT

The user (Kaushik) is building this dashboard for urban planning and environmental monitoring in Pune, India. He wants a professional, polished product that can be used by city officials and researchers.

He appreciates:
- Clear explanations of technical decisions
- Proactive identification of issues
- Code that follows existing patterns
- Thorough testing before marking complete

He gets frustrated by:
- Assumptions without clarification
- Half-implemented features
- Breaking existing functionality
- Repetitive or unnecessary explanations

---

END OF HANDOFF DOCUMENT
```

---

## HOW TO USE THIS DOCUMENT

1. Copy everything between the ``` marks above
2. Paste it as your first message in the new AI chat
3. Let the AI read through your codebase
4. Answer any questions it asks
5. Continue building!

Good luck with the next phase! 🚀
