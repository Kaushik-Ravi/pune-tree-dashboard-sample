/**
 * PUNE TREE DASHBOARD - GEE WARD-LEVEL ANALYSIS
 * ================================================
 * 
 * This script calculates land cover statistics for each ward in Pune.
 * It requires the ward boundaries to be uploaded as a GEE asset first.
 * 
 * PREREQUISITES:
 * 1. Upload pune-wards.geojson as a GEE Asset
 *    - Go to Assets tab in GEE Code Editor
 *    - Click NEW > Shape files or GeoJSON
 *    - Upload the file and note the asset path
 *    - Update WARD_ASSET_PATH below
 * 
 * 2. Run this script in https://code.earthengine.google.com/
 */

// =====================================================
// CONFIGURATION
// =====================================================

// IMPORTANT: Update this path after uploading ward boundaries
var WARD_ASSET_PATH = 'users/YOUR_USERNAME/pune-wards';  // UPDATE THIS!

// Alternative: Define wards inline if not uploaded
// We'll provide a fallback using the bounding box divided into grid cells

var PUNE_BOUNDS = ee.Geometry.Rectangle([73.760670, 18.416686, 73.962606, 18.621086]);

var DW_CLASSES = ['water', 'trees', 'grass', 'flooded_vegetation', 'crops', 
                  'shrub_and_scrub', 'built', 'bare', 'snow_and_ice'];

// =====================================================
// LOAD WARD BOUNDARIES
// =====================================================

var wards;
var useGridFallback = false;

try {
  wards = ee.FeatureCollection(WARD_ASSET_PATH);
  print('Loaded ward boundaries:', wards.size());
} catch(e) {
  print('Ward asset not found. Using grid fallback for demonstration.');
  print('To use real wards, upload pune-wards.geojson as a GEE asset.');
  useGridFallback = true;
  
  // Create a simple grid as fallback (10x10)
  var gridCells = [];
  var xMin = 73.760670, xMax = 73.962606;
  var yMin = 18.416686, yMax = 18.621086;
  var xStep = (xMax - xMin) / 10;
  var yStep = (yMax - yMin) / 10;
  
  for (var i = 0; i < 10; i++) {
    for (var j = 0; j < 10; j++) {
      var cellId = i * 10 + j + 1;
      var cellBounds = ee.Geometry.Rectangle([
        xMin + i * xStep,
        yMin + j * yStep,
        xMin + (i + 1) * xStep,
        yMin + (j + 1) * yStep
      ]);
      gridCells.push(ee.Feature(cellBounds, {
        ward_number: cellId,
        ward_name: 'Grid Cell ' + cellId
      }));
    }
  }
  wards = ee.FeatureCollection(gridCells);
}

// =====================================================
// LOAD DYNAMIC WORLD DATA
// =====================================================

var currentYear = '2025';
var historicalYear = '2019';

function getDWMode(year) {
  var startDate = year + '-01-01';
  var endDate = year + '-12-31';
  
  return ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1')
    .filterBounds(PUNE_BOUNDS)
    .filterDate(startDate, endDate)
    .select('label')
    .mode();
}

var currentLandCover = getDWMode(currentYear);
var historicalLandCover = getDWMode(historicalYear);

// =====================================================
// CALCULATE WARD STATISTICS
// =====================================================

function calculateWardStats(feature, landCover, yearLabel) {
  var geometry = feature.geometry();
  var wardNumber = feature.get('ward_number');
  var wardName = feature.get('ward_name');
  
  // Clip land cover to ward
  var clipped = landCover.clip(geometry);
  
  // Calculate pixel counts for each class
  var pixelArea = ee.Image.pixelArea();
  var totalArea = pixelArea.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: geometry,
    scale: 10,
    maxPixels: 1e13
  }).get('area');
  
  // Calculate area for key classes
  var treesArea = pixelArea.updateMask(clipped.eq(1)).reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: geometry,
    scale: 10,
    maxPixels: 1e13
  }).get('area');
  
  var builtArea = pixelArea.updateMask(clipped.eq(6)).reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: geometry,
    scale: 10,
    maxPixels: 1e13
  }).get('area');
  
  var grassArea = pixelArea.updateMask(clipped.eq(2)).reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: geometry,
    scale: 10,
    maxPixels: 1e13
  }).get('area');
  
  var bareArea = pixelArea.updateMask(clipped.eq(7)).reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: geometry,
    scale: 10,
    maxPixels: 1e13
  }).get('area');
  
  return feature.set({
    'year': yearLabel,
    'total_area_m2': totalArea,
    'trees_area_m2': treesArea,
    'built_area_m2': builtArea,
    'grass_area_m2': grassArea,
    'bare_area_m2': bareArea,
    'trees_pct': ee.Number(treesArea).divide(ee.Number(totalArea)).multiply(100),
    'built_pct': ee.Number(builtArea).divide(ee.Number(totalArea)).multiply(100),
    'grass_pct': ee.Number(grassArea).divide(ee.Number(totalArea)).multiply(100),
    'bare_pct': ee.Number(bareArea).divide(ee.Number(totalArea)).multiply(100)
  });
}

// Calculate stats for current year
var currentStats = wards.map(function(f) {
  return calculateWardStats(f, currentLandCover, currentYear);
});

// Calculate stats for historical year
var historicalStats = wards.map(function(f) {
  return calculateWardStats(f, historicalLandCover, historicalYear);
});

// =====================================================
// CALCULATE CHANGE DETECTION
// =====================================================

var changeStats = wards.map(function(f) {
  var geometry = f.geometry();
  var wardNumber = f.get('ward_number');
  
  var current = currentLandCover.clip(geometry);
  var historical = historicalLandCover.clip(geometry);
  
  var pixelArea = ee.Image.pixelArea();
  
  // Trees lost: was trees (1) in 2019, not trees now
  var treesLost = pixelArea.updateMask(
    historical.eq(1).and(current.neq(1))
  ).reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: geometry,
    scale: 10,
    maxPixels: 1e13
  }).get('area');
  
  // Trees gained: was not trees in 2019, is trees now
  var treesGained = pixelArea.updateMask(
    historical.neq(1).and(current.eq(1))
  ).reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: geometry,
    scale: 10,
    maxPixels: 1e13
  }).get('area');
  
  // Built increase: was not built in 2019, is built now
  var builtGained = pixelArea.updateMask(
    historical.neq(6).and(current.eq(6))
  ).reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: geometry,
    scale: 10,
    maxPixels: 1e13
  }).get('area');
  
  // Trees to built: was trees, now built
  var treesToBuilt = pixelArea.updateMask(
    historical.eq(1).and(current.eq(6))
  ).reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: geometry,
    scale: 10,
    maxPixels: 1e13
  }).get('area');
  
  return f.set({
    'trees_lost_m2': treesLost,
    'trees_gained_m2': treesGained,
    'net_tree_change_m2': ee.Number(treesGained).subtract(ee.Number(treesLost)),
    'built_gained_m2': builtGained,
    'trees_to_built_m2': treesToBuilt
  });
});

// =====================================================
// PRINT RESULTS
// =====================================================

print('=== CURRENT YEAR (' + currentYear + ') WARD STATISTICS ===');
print(currentStats.limit(5));

print('=== HISTORICAL YEAR (' + historicalYear + ') WARD STATISTICS ===');
print(historicalStats.limit(5));

print('=== CHANGE DETECTION (' + historicalYear + ' to ' + currentYear + ') ===');
print(changeStats.limit(5));

// =====================================================
// VISUALIZATION
// =====================================================

var dwPalette = ['419bdf', '397d49', '88b053', '7a87c6', 'e49635', 
                 'dfc35a', 'c4281b', 'a59b8f', 'b39fe1'];

Map.centerObject(PUNE_BOUNDS, 12);
Map.addLayer(currentLandCover.clip(PUNE_BOUNDS), 
  {min: 0, max: 8, palette: dwPalette}, 
  'Current Land Cover (' + currentYear + ')');
Map.addLayer(historicalLandCover.clip(PUNE_BOUNDS), 
  {min: 0, max: 8, palette: dwPalette}, 
  'Historical Land Cover (' + historicalYear + ')', false);

// Show ward boundaries
Map.addLayer(wards.style({color: 'blue', fillColor: '00000000', width: 2}), 
  {}, 'Ward Boundaries');

// =====================================================
// EXPORTS
// =====================================================

// Export current stats
Export.table.toDrive({
  collection: currentStats,
  description: 'pune_ward_landcover_' + currentYear,
  folder: 'PuneTreeDashboard',
  fileNamePrefix: 'pune_ward_landcover_' + currentYear,
  fileFormat: 'CSV',
  selectors: ['ward_number', 'ward_name', 'year', 'total_area_m2', 
              'trees_area_m2', 'built_area_m2', 'grass_area_m2', 'bare_area_m2',
              'trees_pct', 'built_pct', 'grass_pct', 'bare_pct']
});

// Export historical stats
Export.table.toDrive({
  collection: historicalStats,
  description: 'pune_ward_landcover_' + historicalYear,
  folder: 'PuneTreeDashboard',
  fileNamePrefix: 'pune_ward_landcover_' + historicalYear,
  fileFormat: 'CSV',
  selectors: ['ward_number', 'ward_name', 'year', 'total_area_m2', 
              'trees_area_m2', 'built_area_m2', 'grass_area_m2', 'bare_area_m2',
              'trees_pct', 'built_pct', 'grass_pct', 'bare_pct']
});

// Export change detection
Export.table.toDrive({
  collection: changeStats,
  description: 'pune_ward_change_' + historicalYear + '_' + currentYear,
  folder: 'PuneTreeDashboard',
  fileNamePrefix: 'pune_ward_change_' + historicalYear + '_' + currentYear,
  fileFormat: 'CSV',
  selectors: ['ward_number', 'ward_name', 'trees_lost_m2', 'trees_gained_m2', 
              'net_tree_change_m2', 'built_gained_m2', 'trees_to_built_m2']
});

print('');
print('=== EXPORTS READY ===');
print('Go to Tasks tab (top right) and click RUN on each export.');
print('Files will be saved to Google Drive folder: PuneTreeDashboard');
