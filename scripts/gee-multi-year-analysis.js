/**
 * PUNE TREE DASHBOARD - GEE MULTI-YEAR WARD ANALYSIS
 * ====================================================
 * 
 * This script calculates land cover statistics for each ward in Pune
 * for EVERY YEAR from 2019 to 2025 to create a historical timeline.
 * 
 * PREREQUISITES:
 * 1. Upload pune-wards-for-gee.geojson as a GEE Asset
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

// Your uploaded asset path
var WARD_ASSET_PATH = 'projects/hybrid-cabinet-447707-m5/assets/pune-wards';

var PUNE_BOUNDS = ee.Geometry.Rectangle([73.760670, 18.416686, 73.962606, 18.621086]);

var DW_CLASSES = ['water', 'trees', 'grass', 'flooded_vegetation', 'crops', 
                  'shrub_and_scrub', 'built', 'bare', 'snow_and_ice'];

// Years to analyze - FULL TIMELINE
var YEARS = ['2019', '2020', '2021', '2022', '2023', '2024', '2025'];

// =====================================================
// LOAD WARD BOUNDARIES
// =====================================================

var wards;
var useGridFallback = false;

try {
  wards = ee.FeatureCollection(WARD_ASSET_PATH);
  print('✅ Loaded ward boundaries:', wards.size());
} catch(e) {
  print('⚠️ Ward asset not found. Using grid fallback for demonstration.');
  print('To use real wards, upload pune-wards-for-gee.geojson as a GEE asset.');
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
// FUNCTIONS
// =====================================================

/**
 * Get Dynamic World mode composite for a year
 */
function getDWMode(year) {
  var startDate = year + '-01-01';
  var endDate = year + '-12-31';
  
  var dwCollection = ee.ImageCollection('GOOGLE/DYNAMICWORLD/V1')
    .filterBounds(PUNE_BOUNDS)
    .filterDate(startDate, endDate);
  
  return {
    mode: dwCollection.select('label').mode(),
    count: dwCollection.size()
  };
}

/**
 * Calculate ward statistics for a given land cover image
 */
function calculateWardStats(feature, landCover, yearLabel) {
  var geometry = feature.geometry();
  // Note: Shapefile field names are truncated to 10 chars
  var wardNumber = feature.get('ward_numbe');  // was ward_number
  var wardName = feature.get('ward_offic') || feature.get('prabhag_na') || 'Unknown';  // was ward_office/prabhag_name
  var treeCount = feature.get('tree_count') || 0;
  
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
  
  var waterArea = pixelArea.updateMask(clipped.eq(0)).reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: geometry,
    scale: 10,
    maxPixels: 1e13
  }).get('area');
  
  return ee.Feature(null, {
    'ward_number': wardNumber,
    'ward_name': wardName,
    'census_tree_count': treeCount,
    'year': yearLabel,
    'total_area_m2': totalArea,
    'trees_area_m2': treesArea,
    'built_area_m2': builtArea,
    'grass_area_m2': grassArea,
    'bare_area_m2': bareArea,
    'water_area_m2': waterArea,
    'trees_pct': ee.Number(treesArea).divide(ee.Number(totalArea)).multiply(100),
    'built_pct': ee.Number(builtArea).divide(ee.Number(totalArea)).multiply(100),
    'grass_pct': ee.Number(grassArea).divide(ee.Number(totalArea)).multiply(100),
    'bare_pct': ee.Number(bareArea).divide(ee.Number(totalArea)).multiply(100),
    'water_pct': ee.Number(waterArea).divide(ee.Number(totalArea)).multiply(100)
  });
}

// =====================================================
// PROCESS ALL YEARS
// =====================================================

print('Processing land cover for years: ' + YEARS.join(', '));
print('This will generate year-by-year timeline data for each ward.');
print('');

// Store all yearly stats
var allYearStats = [];

// Process each year
YEARS.forEach(function(year) {
  print('Processing year: ' + year + '...');
  
  var dwData = getDWMode(year);
  print('  - Dynamic World images found for ' + year + ':', dwData.count);
  
  var yearStats = wards.map(function(ward) {
    return calculateWardStats(ward, dwData.mode, year);
  });
  
  allYearStats.push({year: year, stats: yearStats});
  
  // Export each year's data
  Export.table.toDrive({
    collection: yearStats,
    description: 'pune_ward_landcover_' + year,
    folder: 'PuneTreeDashboard',
    fileNamePrefix: 'pune_ward_landcover_' + year,
    fileFormat: 'CSV',
    selectors: ['ward_number', 'ward_name', 'census_tree_count', 'year', 
                'total_area_m2', 'trees_area_m2', 'built_area_m2', 
                'grass_area_m2', 'bare_area_m2', 'water_area_m2',
                'trees_pct', 'built_pct', 'grass_pct', 'bare_pct', 'water_pct']
  });
});

// =====================================================
// YEAR-OVER-YEAR CHANGE DETECTION
// =====================================================

print('');
print('Calculating year-over-year changes...');

// Calculate changes between consecutive years
var yearPairs = [
  ['2019', '2020'],
  ['2020', '2021'],
  ['2021', '2022'],
  ['2022', '2023'],
  ['2023', '2024'],
  ['2024', '2025']
];

function calculateYearChange(fromYear, toYear) {
  var fromLC = getDWMode(fromYear).mode;
  var toLC = getDWMode(toYear).mode;
  
  var changeStats = wards.map(function(f) {
    var geometry = f.geometry();
    var wardNumber = f.get('ward_numbe');  // truncated shapefile field
    var wardName = f.get('ward_offic') || f.get('prabhag_na') || 'Unknown';
    
    var fromClipped = fromLC.clip(geometry);
    var toClipped = toLC.clip(geometry);
    
    var pixelArea = ee.Image.pixelArea();
    
    // Trees lost: was trees in fromYear, not trees in toYear
    var treesLost = pixelArea.updateMask(
      fromClipped.eq(1).and(toClipped.neq(1))
    ).reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: geometry,
      scale: 10,
      maxPixels: 1e13
    }).get('area');
    
    // Trees gained: was not trees in fromYear, is trees in toYear
    var treesGained = pixelArea.updateMask(
      fromClipped.neq(1).and(toClipped.eq(1))
    ).reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: geometry,
      scale: 10,
      maxPixels: 1e13
    }).get('area');
    
    // Built increase
    var builtGained = pixelArea.updateMask(
      fromClipped.neq(6).and(toClipped.eq(6))
    ).reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: geometry,
      scale: 10,
      maxPixels: 1e13
    }).get('area');
    
    // Trees converted to built
    var treesToBuilt = pixelArea.updateMask(
      fromClipped.eq(1).and(toClipped.eq(6))
    ).reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: geometry,
      scale: 10,
      maxPixels: 1e13
    }).get('area');
    
    return ee.Feature(null, {
      'ward_number': wardNumber,
      'ward_name': wardName,
      'from_year': fromYear,
      'to_year': toYear,
      'period': fromYear + '_to_' + toYear,
      'trees_lost_m2': treesLost,
      'trees_gained_m2': treesGained,
      'net_tree_change_m2': ee.Number(treesGained).subtract(ee.Number(treesLost)),
      'built_gained_m2': builtGained,
      'trees_to_built_m2': treesToBuilt
    });
  });
  
  return changeStats;
}

// Process and export each year-pair change
yearPairs.forEach(function(pair) {
  var fromYear = pair[0];
  var toYear = pair[1];
  
  print('  - Change detection: ' + fromYear + ' → ' + toYear);
  
  var changeStats = calculateYearChange(fromYear, toYear);
  
  Export.table.toDrive({
    collection: changeStats,
    description: 'pune_ward_change_' + fromYear + '_' + toYear,
    folder: 'PuneTreeDashboard',
    fileNamePrefix: 'pune_ward_change_' + fromYear + '_' + toYear,
    fileFormat: 'CSV',
    selectors: ['ward_number', 'ward_name', 'from_year', 'to_year', 'period',
                'trees_lost_m2', 'trees_gained_m2', 'net_tree_change_m2',
                'built_gained_m2', 'trees_to_built_m2']
  });
});

// Also export overall 2019-2025 change
print('  - Change detection: 2019 → 2025 (overall)');
var overallChange = calculateYearChange('2019', '2025');

Export.table.toDrive({
  collection: overallChange,
  description: 'pune_ward_change_2019_2025_overall',
  folder: 'PuneTreeDashboard',
  fileNamePrefix: 'pune_ward_change_2019_2025_overall',
  fileFormat: 'CSV',
  selectors: ['ward_number', 'ward_name', 'from_year', 'to_year', 'period',
              'trees_lost_m2', 'trees_gained_m2', 'net_tree_change_m2',
              'built_gained_m2', 'trees_to_built_m2']
});

// =====================================================
// VISUALIZATION
// =====================================================

var dwPalette = ['419bdf', '397d49', '88b053', '7a87c6', 'e49635', 
                 'dfc35a', 'c4281b', 'a59b8f', 'b39fe1'];

Map.centerObject(PUNE_BOUNDS, 12);

// Add latest year
var lc2025 = getDWMode('2025').mode.clip(PUNE_BOUNDS);
var lc2019 = getDWMode('2019').mode.clip(PUNE_BOUNDS);

Map.addLayer(lc2025, {min: 0, max: 8, palette: dwPalette}, 'Land Cover 2025');
Map.addLayer(lc2019, {min: 0, max: 8, palette: dwPalette}, 'Land Cover 2019', false);

// Show ward boundaries
Map.addLayer(wards.style({color: 'blue', fillColor: '00000000', width: 2}), 
  {}, 'Ward Boundaries');

// Tree change visualization
var treeChange = lc2025.eq(1).subtract(lc2019.eq(1));
Map.addLayer(treeChange, {min: -1, max: 1, palette: ['red', 'white', 'green']}, 
  'Tree Cover Change 2019→2025', false);

// =====================================================
// EXPORT SUMMARY
// =====================================================

print('');
print('═══════════════════════════════════════════════════════════');
print('                    EXPORT SUMMARY');
print('═══════════════════════════════════════════════════════════');
print('');
print('YEARLY LAND COVER DATA (7 exports):');
print('  • pune_ward_landcover_2019.csv');
print('  • pune_ward_landcover_2020.csv');
print('  • pune_ward_landcover_2021.csv');
print('  • pune_ward_landcover_2022.csv');
print('  • pune_ward_landcover_2023.csv');
print('  • pune_ward_landcover_2024.csv');
print('  • pune_ward_landcover_2025.csv');
print('');
print('YEAR-OVER-YEAR CHANGE DATA (6 exports):');
print('  • pune_ward_change_2019_2020.csv');
print('  • pune_ward_change_2020_2021.csv');
print('  • pune_ward_change_2021_2022.csv');
print('  • pune_ward_change_2022_2023.csv');
print('  • pune_ward_change_2023_2024.csv');
print('  • pune_ward_change_2024_2025.csv');
print('');
print('OVERALL CHANGE DATA (1 export):');
print('  • pune_ward_change_2019_2025_overall.csv');
print('');
print('TOTAL: 14 CSV files will be exported to Google Drive');
print('');
print('═══════════════════════════════════════════════════════════');
print('Go to TASKS tab (top right) and click RUN on each export.');
print('Files will be saved to: Google Drive > PuneTreeDashboard');
print('═══════════════════════════════════════════════════════════');

// Legend
print('');
print('=== DYNAMIC WORLD CLASS LEGEND ===');
print('0: Water - Blue (#419bdf)');
print('1: Trees - Dark Green (#397d49)');
print('2: Grass - Light Green (#88b053)');
print('3: Flooded Vegetation - Purple-Blue (#7a87c6)');
print('4: Crops - Orange (#e49635)');
print('5: Shrub and Scrub - Yellow (#dfc35a)');
print('6: Built (Concrete/Urban) - Red-Brown (#c4281b)');
print('7: Bare Ground - Tan (#a59b8f)');
print('8: Snow and Ice - Light Purple (#b39fe1)');
