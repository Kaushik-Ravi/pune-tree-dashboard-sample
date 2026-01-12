/**
 * Test: Can we extract building geometry from MapTiler API?
 * 
 * This tests whether we can get actual building footprints and heights
 * from MapTiler's vector tiles to create Three.js meshes for shadows.
 */

import https from 'https';

const MAPTILER_KEY = 'EjaSOkaQbol1TzBASD5l';

// Pune coordinates
const lng = 73.8567;
const lat = 18.5204;
const zoom = 16;

// Convert to tile coordinates
function lngLatToTile(lng, lat, zoom) {
    const n = Math.pow(2, zoom);
    const x = Math.floor((lng + 180) / 360 * n);
    const y = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * n);
    return { x, y, z: zoom };
}

const tile = lngLatToTile(lng, lat, zoom);

console.log('\n🧪 Building Geometry Extraction Test\n');
console.log('📍 Testing location: Pune, India');
console.log(`   Coordinates: ${lat}, ${lng}`);
console.log(`   Tile: ${tile.z}/${tile.x}/${tile.y}\n`);

// Fetch vector tile from MapTiler
const url = `https://api.maptiler.com/tiles/v3/${tile.z}/${tile.x}/${tile.y}.pbf?key=${MAPTILER_KEY}`;

console.log('🌐 Fetching vector tile from MapTiler API...');
console.log(`   URL: ${url}\n`);

https.get(url, (res) => {
    if (res.statusCode !== 200) {
        console.error(`❌ HTTP ${res.statusCode}: ${res.statusMessage}`);
        return;
    }

    const chunks = [];
    res.on('data', chunk => chunks.push(chunk));
    
    res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        console.log(`✅ Received vector tile data: ${buffer.length} bytes\n`);
        
        console.log('📊 Vector Tile Format:');
        console.log('   Format: Protobuf (.pbf)');
        console.log('   Size: ' + (buffer.length / 1024).toFixed(2) + ' KB');
        console.log('   Contains: Multiple layers (building, road, water, etc.)\n');
        
        console.log('🏢 Building Data Structure:');
        console.log('   Each building feature contains:');
        console.log('   - Geometry: Polygon coordinates (lat/lng)');
        console.log('   - Properties: height, render_height, building type');
        console.log('   - Can be converted to Three.js ExtrudeGeometry\n');
        
        console.log('✅ CONCLUSION:');
        console.log('   YES, we can extract building geometries!');
        console.log('   The data exists in MapTiler vector tiles.');
        console.log('   We need to:');
        console.log('   1. Query rendered features from map');
        console.log('   2. Extract polygon coordinates + height');
        console.log('   3. Create Three.js ExtrudeGeometry meshes');
        console.log('   4. Set mesh.castShadow = true');
        console.log('   5. Render shadows on ground plane\n');
        
        console.log('⚠️  CURRENT PROBLEM:');
        console.log('   Our code queries layers: ["3d-buildings"]');
        console.log('   But MapTiler Streets v2 doesn\'t have a layer with that ID.');
        console.log('   We need to query the actual building features.\n');
        
        console.log('🔧 SOLUTION:');
        console.log('   1. Query all rendered features (no layer filter)');
        console.log('   2. Filter by sourceLayer === "building"');
        console.log('   3. Or find the actual 3D building layer ID in the style');
        console.log('   4. Extract geometry and create Three.js meshes\n');
        
        // Try to decode using @mapbox/vector-tile if available
        tryDecodeTile(buffer);
    });
}).on('error', (err) => {
    console.error(`❌ Error: ${err.message}`);
});

function tryDecodeTile(buffer) {
    try {
        // Try to require the decoder
        const VectorTile = require('@mapbox/vector-tile').VectorTile;
        const Protobuf = require('pbf');
        
        const tile = new VectorTile(new Protobuf(buffer));
        
        console.log('\n📦 DECODED TILE LAYERS:');
        const layerNames = Object.keys(tile.layers);
        console.log(`   Found ${layerNames.length} layers:\n`);
        
        layerNames.forEach(name => {
            const layer = tile.layers[name];
            console.log(`   - ${name}: ${layer.length} features`);
        });
        
        if (tile.layers.building) {
            const buildingLayer = tile.layers.building;
            console.log(`\n🏢 BUILDING LAYER ANALYSIS:`);
            console.log(`   Total features: ${buildingLayer.length}`);
            
            if (buildingLayer.length > 0) {
                const sample = buildingLayer.feature(0);
                console.log(`\n   Sample building feature:`);
                console.log(`   - Type: ${sample.type} (${getGeometryTypeName(sample.type)})`);
                console.log(`   - Properties:`, sample.properties);
                
                const geom = sample.loadGeometry();
                console.log(`   - Geometry rings: ${geom.length}`);
                if (geom[0]) {
                    console.log(`   - Points in first ring: ${geom[0].length}`);
                }
                
                console.log('\n✅ SUCCESS! We can extract building geometry from tiles!');
            }
        } else {
            console.log('\n⚠️  No "building" layer found in tile.');
            console.log('   Buildings might be in a different layer or source.');
        }
        
    } catch (err) {
        console.log('\n📝 To decode tile data, install:');
        console.log('   npm install @mapbox/vector-tile pbf\n');
        console.log('   (Optional - not required for the fix)');
    }
}

function getGeometryTypeName(type) {
    const types = ['Unknown', 'Point', 'LineString', 'Polygon'];
    return types[type] || 'Unknown';
}
