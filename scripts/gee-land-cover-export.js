/**
 * PUNE TREE DASHBOARD - GOOGLE EARTH ENGINE EXPORT SCRIPT
 * =========================================================
 * 
 * This script exports Dynamic World land cover data for Pune city.
 * 
 * HOW TO USE:
 * 1. Go to https://code.earthengine.google.com/
 * 2. Login with your Google account that has GEE access
 * 3. Copy and paste this entire script
 * 4. Click "Run"
 * 5. In the "Tasks" tab (top right), click "RUN" on the export tasks
 * 6. Download the exported files from Google Drive
 * 
 * This script exports:
 * - Current (2025) land cover composite
 * - Historical (2019) land cover composite
 * - Ward-level statistics CSV
 */

// =====================================================
// CONFIGURATION - Pune City Bounding Box
// =====================================================
var PUNE_BOUNDS = ee.Geometry.Rectangle([73.760670, 18.416686, 73.962606, 18.621086]);
var PUNE_CENTER = ee.Geometry.Point([73.8567, 18.5204]);

// Time periods for analysis
var CURRENT_START = '2025-01-01';
var CURRENT_END = '2025-12-31';
var HISTORICAL_START = '2019-01-01';
var HISTORICAL_END = '2019-12-31';

// Dynamic World classes
var DW_CLASSES = ['water', 'trees', 'grass', 'flooded_vegetation', 'crops', 
                  'shrub_and_scrub', 'built', 'bare', 'snow_and_ice'];
var DW_PALETTE = ['419bdf', '397d49', '88b053', '7a87c6', 'e49635', 
                  'dfc35a', 'c4281b', 'a59b8f', 'b39fe1'];

// =====================================================
// FUNCTIONS
// =====================================================

/**
 * Get Dynamic World composite for a time period
 */
function getDynamicWorldComposite(startDate, endDate) {
  var dwCollection = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1')
    .filterBounds(PUNE_BOUNDS)
    .filterDate(startDate, endDate);
  
  print('Dynamic World images found:', dwCollection.size());
  
  // Create mode composite (most common class)
  var dwMode = dwCollection.select('label').mode().clip(PUNE_BOUNDS);
  
  // Create mean probability composite for each class
  var dwMean = dwCollection.select(DW_CLASSES).mean().clip(PUNE_BOUNDS);
  
  return {
    mode: dwMode,
    probabilities: dwMean
  };
}

/**
 * Calculate class percentages for a region
 */
function calculateClassPercentages(image, geometry, scale) {
  var pixelArea = ee.Image.pixelArea();
  var areaImage = image.multiply(0).add(1).multiply(pixelArea);
  
  var totalArea = areaImage.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: geometry,
    scale: scale,
    maxPixels: 1e13
  }).get('label');
  
  var classAreas = ee.List.sequence(0, 8).map(function(classValue) {
    var mask = image.eq(ee.Number(classValue));
    var classArea = areaImage.updateMask(mask).reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: geometry,
      scale: scale,
      maxPixels: 1e13
    }).get('label');
    
    return ee.Dictionary({
      'class': classValue,
      'class_name': ee.List(DW_CLASSES).get(classValue),
      'area_m2': classArea,
      'percentage': ee.Number(classArea).divide(ee.Number(totalArea)).multiply(100)
    });
  });
  
  return classAreas;
}

/**
 * Calculate NDVI from Sentinel-2
 */
function getNDVI(startDate, endDate) {
  var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(PUNE_BOUNDS)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));
  
  print('Sentinel-2 images found:', s2.size());
  
  var ndvi = s2.map(function(img) {
    return img.normalizedDifference(['B8', 'B4']).rename('NDVI');
  }).median().clip(PUNE_BOUNDS);
  
  return ndvi;
}

// =====================================================
// MAIN ANALYSIS
// =====================================================

// Get current (2025) land cover
print('Processing Current (2025) Land Cover...');
var currentDW = getDynamicWorldComposite(CURRENT_START, CURRENT_END);

// Get historical (2019) land cover
print('Processing Historical (2019) Land Cover...');
var historicalDW = getDynamicWorldComposite(HISTORICAL_START, HISTORICAL_END);

// Calculate NDVI for current period
print('Processing NDVI...');
var currentNDVI = getNDVI(CURRENT_START, CURRENT_END);

// =====================================================
// VISUALIZATION
// =====================================================

Map.centerObject(PUNE_CENTER, 12);

// Add layers to map for preview
Map.addLayer(currentDW.mode, {min: 0, max: 8, palette: DW_PALETTE}, 'Current Land Cover (2025)');
Map.addLayer(historicalDW.mode, {min: 0, max: 8, palette: DW_PALETTE}, 'Historical Land Cover (2019)', false);
Map.addLayer(currentNDVI, {min: -0.2, max: 0.8, palette: ['red', 'yellow', 'green']}, 'Current NDVI', false);

// Calculate change (trees class = 1)
var treesChange = currentDW.mode.eq(1).subtract(historicalDW.mode.eq(1));
Map.addLayer(treesChange, {min: -1, max: 1, palette: ['red', 'white', 'green']}, 'Tree Cover Change', false);

// =====================================================
// CALCULATE STATISTICS
// =====================================================

print('Calculating city-wide statistics...');

// Current statistics
var currentStats = calculateClassPercentages(currentDW.mode, PUNE_BOUNDS, 10);
print('Current (2025) Land Cover:', currentStats);

// Historical statistics  
var historicalStats = calculateClassPercentages(historicalDW.mode, PUNE_BOUNDS, 10);
print('Historical (2019) Land Cover:', historicalStats);

// =====================================================
// EXPORTS
// =====================================================

// Export current land cover as GeoTIFF
Export.image.toDrive({
  image: currentDW.mode,
  description: 'pune_landcover_2025',
  folder: 'PuneTreeDashboard',
  fileNamePrefix: 'pune_landcover_2025',
  region: PUNE_BOUNDS,
  scale: 10,
  maxPixels: 1e13,
  crs: 'EPSG:4326'
});

// Export historical land cover as GeoTIFF
Export.image.toDrive({
  image: historicalDW.mode,
  description: 'pune_landcover_2019',
  folder: 'PuneTreeDashboard',
  fileNamePrefix: 'pune_landcover_2019',
  region: PUNE_BOUNDS,
  scale: 10,
  maxPixels: 1e13,
  crs: 'EPSG:4326'
});

// Export NDVI as GeoTIFF
Export.image.toDrive({
  image: currentNDVI,
  description: 'pune_ndvi_2025',
  folder: 'PuneTreeDashboard',
  fileNamePrefix: 'pune_ndvi_2025',
  region: PUNE_BOUNDS,
  scale: 10,
  maxPixels: 1e13,
  crs: 'EPSG:4326'
});

// Export tree cover change
Export.image.toDrive({
  image: treesChange,
  description: 'pune_tree_change_2019_2025',
  folder: 'PuneTreeDashboard',
  fileNamePrefix: 'pune_tree_change_2019_2025',
  region: PUNE_BOUNDS,
  scale: 10,
  maxPixels: 1e13,
  crs: 'EPSG:4326'
});

// =====================================================
// CLASS LEGEND
// =====================================================
print('=== DYNAMIC WORLD CLASS LEGEND ===');
print('0: Water - Blue');
print('1: Trees - Dark Green');
print('2: Grass - Light Green');
print('3: Flooded Vegetation - Purple-Blue');
print('4: Crops - Orange');
print('5: Shrub and Scrub - Yellow');
print('6: Built (Concrete/Urban) - Red-Brown');
print('7: Bare Ground - Tan');
print('8: Snow and Ice - Light Purple');

print('=== EXPORT INSTRUCTIONS ===');
print('1. Check the Tasks tab (top-right corner)');
print('2. Click RUN on each export task');
print('3. Files will be saved to your Google Drive in folder: PuneTreeDashboard');
print('4. Download the GeoTIFF files for use in the dashboard');
