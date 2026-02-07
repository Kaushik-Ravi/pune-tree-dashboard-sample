/**
 * PUNE TREE DASHBOARD - GEE RASTER TILES EXPORT
 * ==============================================
 * 
 * This script exports high-resolution raster data for continuous visualization.
 * Instead of ward-level aggregation, this exports pixel-level data at 10m resolution.
 * 
 * OUTPUTS:
 * 1. Tree Cover Probability (0-100%) - Continuous green visualization
 * 2. NDVI (Vegetation Index) - Health of vegetation
 * 3. Land Cover Change (Loss/Gain) - Deforestation/Reforestation
 * 4. Multi-year time series (2019-2025)
 * 
 * HOW TO USE:
 * 1. Go to https://code.earthengine.google.com/
 * 2. Copy and paste this script
 * 3. Click "Run"
 * 4. In "Tasks" tab, click "RUN" on each export
 * 5. Download from Google Drive → PuneTreeDashboard folder
 * 
 * After downloading, use gdal2tiles or titiler to serve as web tiles.
 */

// =====================================================
// CONFIGURATION - Pune City Extent
// =====================================================

// Get the extent from your tree database query:
// SELECT ST_Extent(geom) FROM trees;
// Result: BOX(73.7606704 18.4166862, 73.9626057 18.6210861)
var PUNE_BOUNDS = ee.Geometry.Rectangle([73.760670, 18.416686, 73.962606, 18.621086]);

// Slightly expanded bounds for edge effects
var PUNE_BOUNDS_EXPANDED = ee.Geometry.Rectangle([73.74, 18.40, 73.98, 18.64]);

// Years for multi-temporal analysis
var YEARS = [2019, 2020, 2021, 2022, 2023, 2024, 2025];

// Output resolution in meters
var RESOLUTION = 10;

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Get Dynamic World tree probability for a year
 * Returns continuous 0-100% tree probability
 */
function getTreeProbability(year) {
  var startDate = year + '-01-01';
  var endDate = year + '-12-31';
  
  var dw = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1')
    .filterBounds(PUNE_BOUNDS)
    .filterDate(startDate, endDate)
    .select('trees');  // Tree probability band (0-1)
  
  // Use median composite for stability
  var treeProbability = dw.median()
    .multiply(100)  // Convert to percentage
    .clip(PUNE_BOUNDS_EXPANDED)
    .rename('tree_probability_' + year);
  
  return treeProbability;
}

/**
 * Get Sentinel-2 NDVI for a year
 * Returns continuous -1 to 1 NDVI values
 */
function getNDVI(year) {
  var startDate = year + '-01-01';
  var endDate = year + '-12-31';
  
  var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(PUNE_BOUNDS)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));
  
  var ndvi = s2.map(function(img) {
    return img.normalizedDifference(['B8', 'B4']).rename('ndvi');
  }).median().clip(PUNE_BOUNDS_EXPANDED);
  
  return ndvi.rename('ndvi_' + year);
}

/**
 * Get full land cover classification for a year
 */
function getLandCover(year) {
  var startDate = year + '-01-01';
  var endDate = year + '-12-31';
  
  var dw = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1')
    .filterBounds(PUNE_BOUNDS)
    .filterDate(startDate, endDate);
  
  // Mode composite (most common class)
  var landCover = dw.select('label').mode().clip(PUNE_BOUNDS_EXPANDED);
  
  return landCover.rename('landcover_' + year);
}

// =====================================================
// MAIN PROCESSING
// =====================================================

print('=== PUNE TREE DASHBOARD - RASTER EXPORT ===');
print('Processing years:', YEARS);
print('Resolution:', RESOLUTION, 'meters');

// 1. Tree Probability for all years
var treeStack = ee.Image.cat(YEARS.map(function(year) {
  return getTreeProbability(year);
}));
print('Tree probability stack bands:', treeStack.bandNames());

// 2. NDVI for all years
var ndviStack = ee.Image.cat(YEARS.map(function(year) {
  return getNDVI(year);
}));
print('NDVI stack bands:', ndviStack.bandNames());

// 3. Land cover for baseline and current
var landcover2019 = getLandCover(2019);
var landcover2025 = getLandCover(2025);

// 4. Calculate tree cover CHANGE (2025 - 2019)
var tree2019 = getTreeProbability(2019);
var tree2025 = getTreeProbability(2025);
var treeChange = tree2025.subtract(tree2019).rename('tree_change_pct');

// 5. Calculate binary change map
//    - Green gained where current trees, not historical trees (class 1)
//    - Red lost where historical trees, not current trees
var dwLabel2019 = getLandCover(2019);
var dwLabel2025 = getLandCover(2025);
var wasTree = dwLabel2019.eq(1);  // Was tree in 2019
var isTree = dwLabel2025.eq(1);   // Is tree in 2025
var treeGain = isTree.and(wasTree.not());  // Gained
var treeLoss = wasTree.and(isTree.not());  // Lost
var binaryChange = treeGain.multiply(1).add(treeLoss.multiply(-1)).rename('binary_change');

// =====================================================
// VISUALIZATION (for preview in GEE)
// =====================================================

Map.centerObject(PUNE_BOUNDS, 12);

// Tree probability gradient
var treePalette = ['#f7fcf5', '#c7e9c0', '#74c476', '#31a354', '#006d2c'];
Map.addLayer(tree2025, {min: 0, max: 50, palette: treePalette}, 'Tree Probability 2025');

// NDVI gradient
var ndviPalette = ['#d73027', '#fc8d59', '#fee08b', '#d9ef8b', '#91cf60', '#1a9850'];
Map.addLayer(getNDVI(2025), {min: -0.1, max: 0.6, palette: ndviPalette}, 'NDVI 2025', false);

// Tree change 
var changePalette = ['#d73027', '#fc8d59', '#ffffbf', '#91cf60', '#1a9850'];
Map.addLayer(treeChange, {min: -20, max: 20, palette: changePalette}, 'Tree Change 2019-2025', false);

// Binary change (loss/gain)
Map.addLayer(binaryChange, {min: -1, max: 1, palette: ['red', 'white', 'green']}, 'Tree Loss/Gain', false);

// Land cover classification
var dwPalette = ['419bdf', '397d49', '88b053', '7a87c6', 'e49635', 'dfc35a', 'c4281b', 'a59b8f', 'b39fe1'];
Map.addLayer(landcover2025, {min: 0, max: 8, palette: dwPalette}, 'Land Cover 2025', false);

// =====================================================
// EXPORTS - Cloud Optimized GeoTIFFs
// =====================================================

// Export as COG (Cloud Optimized GeoTIFF) for web serving
var cogParams = {
  cloudOptimized: true,
  fileDimensions: [1024, 1024]  // Tile size for internal tiling
};

// 1. Current (2025) Tree Probability - Main visualization
Export.image.toDrive({
  image: tree2025.toFloat(),
  description: 'pune_tree_probability_2025',
  folder: 'PuneTreeDashboard',
  fileNamePrefix: 'pune_tree_probability_2025',
  region: PUNE_BOUNDS_EXPANDED,
  scale: RESOLUTION,
  maxPixels: 1e13,
  crs: 'EPSG:4326',
  formatOptions: cogParams
});

// 2. Historical (2019) Tree Probability
Export.image.toDrive({
  image: tree2019.toFloat(),
  description: 'pune_tree_probability_2019',
  folder: 'PuneTreeDashboard',
  fileNamePrefix: 'pune_tree_probability_2019',
  region: PUNE_BOUNDS_EXPANDED,
  scale: RESOLUTION,
  maxPixels: 1e13,
  crs: 'EPSG:4326',
  formatOptions: cogParams
});

// 3. Tree Change (continuous %)
Export.image.toDrive({
  image: treeChange.toFloat(),
  description: 'pune_tree_change_pct',
  folder: 'PuneTreeDashboard',
  fileNamePrefix: 'pune_tree_change_2019_2025_pct',
  region: PUNE_BOUNDS_EXPANDED,
  scale: RESOLUTION,
  maxPixels: 1e13,
  crs: 'EPSG:4326',
  formatOptions: cogParams
});

// 4. Binary Loss/Gain map
Export.image.toDrive({
  image: binaryChange.toInt8(),
  description: 'pune_tree_loss_gain',
  folder: 'PuneTreeDashboard',
  fileNamePrefix: 'pune_tree_loss_gain_2019_2025',
  region: PUNE_BOUNDS_EXPANDED,
  scale: RESOLUTION,
  maxPixels: 1e13,
  crs: 'EPSG:4326',
  formatOptions: cogParams
});

// 5. Multi-year tree probability stack (for time slider)
Export.image.toDrive({
  image: treeStack.toFloat(),
  description: 'pune_tree_probability_multiyear',
  folder: 'PuneTreeDashboard',
  fileNamePrefix: 'pune_tree_probability_2019_2025',
  region: PUNE_BOUNDS_EXPANDED,
  scale: RESOLUTION,
  maxPixels: 1e13,
  crs: 'EPSG:4326',
  formatOptions: cogParams
});

// 6. Current NDVI
Export.image.toDrive({
  image: getNDVI(2025).toFloat(),
  description: 'pune_ndvi_2025',
  folder: 'PuneTreeDashboard',
  fileNamePrefix: 'pune_ndvi_2025',
  region: PUNE_BOUNDS_EXPANDED,
  scale: RESOLUTION,
  maxPixels: 1e13,
  crs: 'EPSG:4326',
  formatOptions: cogParams
});

// 7. Land cover classification
Export.image.toDrive({
  image: landcover2025.toUint8(),
  description: 'pune_landcover_2025',
  folder: 'PuneTreeDashboard',
  fileNamePrefix: 'pune_landcover_2025',
  region: PUNE_BOUNDS_EXPANDED,
  scale: RESOLUTION,
  maxPixels: 1e13,
  crs: 'EPSG:4326',
  formatOptions: cogParams
});

// =====================================================
// INSTRUCTIONS
// =====================================================

print('');
print('=== EXPORT INSTRUCTIONS ===');
print('1. Check the Tasks tab (top-right)');
print('2. Click RUN on each export task');
print('3. Files will be saved to Google Drive: PuneTreeDashboard/');
print('');
print('=== AFTER DOWNLOAD ===');
print('Option A: Use Titiler or similar to serve COGs directly');
print('Option B: Convert to XYZ tiles with gdal2tiles.py');
print('   gdal2tiles.py -z 10-16 -w none pune_tree_probability_2025.tif tiles/');
print('Option C: Upload to MapTiler Cloud');
print('');
print('=== FILE DESCRIPTIONS ===');
print('pune_tree_probability_2025.tif - Current tree cover % (0-100)');
print('pune_tree_probability_2019.tif - Historical tree cover %');
print('pune_tree_change_2019_2025_pct.tif - Change in tree % (-100 to +100)');
print('pune_tree_loss_gain_2019_2025.tif - Binary: -1=loss, 0=no change, 1=gain');
print('pune_tree_probability_2019_2025.tif - Multi-band: one band per year');
print('pune_ndvi_2025.tif - Vegetation index (-1 to +1)');
print('pune_landcover_2025.tif - Classification (0-8 classes)');

