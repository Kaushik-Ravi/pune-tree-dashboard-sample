// src/utils/geometryBuilder.ts
import * as THREE from 'three';
import { MercatorCoordinate } from 'maplibre-gl';
import type { Feature, Point, Polygon } from 'geojson';

/**
 * Converts geographic coordinates to Three.js world space
 * Uses Mercator projection to match MapLibre GL coordinate system
 */
export const geoToWorld = (
  longitude: number,
  latitude: number,
  altitude: number = 0
): THREE.Vector3 => {
  const mercator = MercatorCoordinate.fromLngLat([longitude, latitude], altitude);
  
  console.log(`🗺️ [geometryBuilder] Converting geo to world:`, {
    input: { longitude, latitude, altitude },
    mercator: { x: mercator.x, y: mercator.y, z: mercator.z },
    scale: mercator.meterInMercatorCoordinateUnits()
  });
  
  // Scale to world coordinates (MapLibre uses normalized 0-1 coordinates)
  const scale = mercator.meterInMercatorCoordinateUnits();
  
  const result = new THREE.Vector3(
    mercator.x,
    mercator.z / scale, // altitude in meters
    mercator.y
  );
  
  console.log(`  📍 World position:`, result);
  
  return result;
};

/**
 * Creates realistic tree geometry with trunk and canopy
 * Returns a Group containing both meshes, ready to cast/receive shadows
 */
export const createTreeGeometry = (
  feature: Feature<Point>,
  options: {
    heightM: number;
    girthCm: number;
    canopyDiaM: number;
    trunkColor?: string;
    canopyColor?: string;
  }
): THREE.Group => {
  const { heightM, girthCm, canopyDiaM, trunkColor = '#8B4513', canopyColor = '#2E7D32' } = options;
  
  const coords = feature.geometry.coordinates as [number, number];
  const [lng, lat] = coords;
  
  console.log(`🌳 [geometryBuilder] Creating tree at [${lng}, ${lat}]`, {
    heightM,
    girthCm,
    canopyDiaM
  });
  
  // Calculate dimensions
  const trunkRadius = (girthCm / 100) / (2 * Math.PI); // circumference → radius
  const trunkHeight = heightM * 0.4; // 40% of total height is trunk
  const canopyHeight = heightM * 0.6; // 60% is canopy
  const canopyRadius = canopyDiaM / 2;
  
  console.log(`  📏 Calculated dimensions:`, {
    trunkRadius,
    trunkHeight,
    canopyRadius,
    canopyHeight
  });
  
  // Create group to hold both trunk and canopy
  const treeGroup = new THREE.Group();
  
  // Create trunk (cylinder)
  const trunkGeometry = new THREE.CylinderGeometry(
    trunkRadius,
    trunkRadius * 1.2, // Slightly wider at base
    trunkHeight,
    8 // 8 segments for performance
  );
  
  const trunkMaterial = new THREE.MeshStandardMaterial({
    color: trunkColor,
    roughness: 0.9,
    metalness: 0.1
  });
  
  const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  trunk.position.y = trunkHeight / 2; // Center at base
  
  console.log(`  🪵 Trunk created:`, {
    castShadow: trunk.castShadow,
    receiveShadow: trunk.receiveShadow,
    position: trunk.position
  });
  
  // Create canopy (cone shape for realistic tree)
  const canopyGeometry = new THREE.ConeGeometry(
    canopyRadius,
    canopyHeight,
    8, // radial segments
    1  // height segments
  );
  
  const canopyMaterial = new THREE.MeshStandardMaterial({
    color: canopyColor,
    roughness: 0.8,
    metalness: 0.0
  });
  
  const canopy = new THREE.Mesh(canopyGeometry, canopyMaterial);
  canopy.castShadow = true;
  canopy.receiveShadow = false; // Canopy doesn't need to receive (top of tree)
  canopy.position.y = trunkHeight + (canopyHeight / 2);
  
  console.log(`  🌿 Canopy created:`, {
    castShadow: canopy.castShadow,
    receiveShadow: canopy.receiveShadow,
    position: canopy.position
  });
  
  // Add both to group
  treeGroup.add(trunk);
  treeGroup.add(canopy);
  
  // Position in world space
  const worldPos = geoToWorld(lng, lat, 0);
  treeGroup.position.copy(worldPos);
  
  console.log(`  🌍 World position:`, worldPos);
  console.log(`  ✅ Tree group complete:`, {
    children: treeGroup.children.length,
    position: treeGroup.position
  });
  
  // Store metadata
  treeGroup.userData = {
    type: 'tree',
    id: feature.properties?.id,
    height: heightM,
    girth: girthCm,
    canopyDia: canopyDiaM
  };
  
  return treeGroup;
};

/**
 * Creates extruded building geometry from MapTiler building data
 */
export const createBuildingGeometry = (
  feature: Feature<Polygon>,
  options: {
    height?: number;
    baseHeight?: number;
    color?: string;
  }
): THREE.Mesh => {
  const { height = 10, baseHeight = 0, color = '#d6d2d2' } = options;
  
  // Extract polygon coordinates
  const coords = feature.geometry.coordinates[0]; // First ring (outer boundary)
  
  // Convert to Three.js shape
  const shape = new THREE.Shape();
  
  coords.forEach((coord, index) => {
    const [lng, lat] = coord as [number, number];
    const worldPos = geoToWorld(lng, lat, 0);
    
    if (index === 0) {
      shape.moveTo(worldPos.x, worldPos.z);
    } else {
      shape.lineTo(worldPos.x, worldPos.z);
    }
  });
  
  // Extrude settings
  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: height - baseHeight,
    bevelEnabled: false
  };
  
  const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  
  const material = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.7,
    metalness: 0.3
  });
  
  const building = new THREE.Mesh(geometry, material);
  building.castShadow = true;
  building.receiveShadow = true;
  
  // Rotate to match MapLibre orientation
  building.rotation.x = -Math.PI / 2;
  building.position.y = baseHeight;
  
  building.userData = {
    type: 'building',
    height,
    baseHeight
  };
  
  return building;
};

/**
 * Creates ground plane to receive shadows
 * Size is dynamically calculated based on viewport bounds
 */
export const createGroundPlane = (
  bounds: { sw: [number, number]; ne: [number, number] },
  options: {
    color?: string;
    receiveShadow?: boolean;
  } = {}
): THREE.Mesh => {
  const { color = '#f0f0f0', receiveShadow = true } = options;
  
  console.log(`🟩 [geometryBuilder] Creating ground plane with bounds:`, bounds);
  
  // Convert bounds to world space
  const swPos = geoToWorld(bounds.sw[0], bounds.sw[1], 0);
  const nePos = geoToWorld(bounds.ne[0], bounds.ne[1], 0);
  
  const width = Math.abs(nePos.x - swPos.x);
  const height = Math.abs(nePos.z - swPos.z);
  
  console.log(`  📐 Ground plane dimensions:`, { width, height });
  
  const geometry = new THREE.PlaneGeometry(width, height, 64, 64); // High segments for terrain
  
  const material = new THREE.MeshStandardMaterial({
    color: color,
    roughness: 0.95,
    metalness: 0.0
  });
  
  const plane = new THREE.Mesh(geometry, material);
  plane.receiveShadow = receiveShadow;
  plane.rotation.x = -Math.PI / 2; // Horizontal
  
  // Center the plane
  const centerX = (swPos.x + nePos.x) / 2;
  const centerZ = (swPos.z + nePos.z) / 2;
  plane.position.set(centerX, 0, centerZ);
  
  console.log(`  📍 Ground plane position:`, plane.position);
  console.log(`  ✅ Ground plane created:`, {
    receiveShadow: plane.receiveShadow,
    rotation: plane.rotation.x,
    segments: '64x64'
  });
  
  plane.userData = {
    type: 'ground'
  };
  
  return plane;
};

/**
 * Applies DEM (Digital Elevation Model) data to ground plane
 * Creates terrain displacement for realistic shadow draping
 */
export const applyTerrainToPlane = (
  plane: THREE.Mesh,
  demData: ImageData,
  options: {
    exaggeration?: number;
  } = {}
): void => {
  const { exaggeration = 1.5 } = options;
  
  // Extract RGB values from DEM
  // MapTiler Terrain RGB format: height = -10000 + ((R * 256 * 256 + G * 256 + B) * 0.1)
  const width = demData.width;
  const height = demData.height;
  
  const geometry = plane.geometry as THREE.PlaneGeometry;
  const position = geometry.attributes.position;
  
  // Apply displacement to vertices
  for (let i = 0; i < position.count; i++) {
    const x = Math.floor((i % width));
    const y = Math.floor(i / width);
    
    if (x < width && y < height) {
      const pixelIndex = (y * width + x) * 4;
      const r = demData.data[pixelIndex];
      const g = demData.data[pixelIndex + 1];
      const b = demData.data[pixelIndex + 2];
      
      // Decode RGB to elevation
      const elevation = -10000 + ((r * 256 * 256 + g * 256 + b) * 0.1);
      
      // Apply exaggeration and update vertex Y position
      position.setY(i, elevation * exaggeration);
    }
  }
  
  position.needsUpdate = true;
  geometry.computeVertexNormals(); // Recalculate normals for proper lighting
};

/**
 * Creates optimized LOD (Level of Detail) for trees
 * Distant trees use simpler geometry for performance
 */
export const createTreeLOD = (
  feature: Feature<Point>,
  options: {
    heightM: number;
    girthCm: number;
    canopyDiaM: number;
  }
): THREE.LOD => {
  const lod = new THREE.LOD();
  
  // High detail (close up)
  const highDetail = createTreeGeometry(feature, options);
  lod.addLevel(highDetail, 0);
  
  // Medium detail (medium distance) - simplified geometry
  const mediumDetail = createTreeGeometry(feature, {
    ...options,
    trunkColor: '#8B4513',
    canopyColor: '#2E7D32'
  });
  // Reduce geometry complexity for medium detail
  mediumDetail.children.forEach(child => {
    if (child instanceof THREE.Mesh) {
      child.geometry = child.geometry.clone();
      // Simplify geometry here if needed
    }
  });
  lod.addLevel(mediumDetail, 50); // Switch at 50 units distance
  
  // Low detail (far away) - billboard/impostor
  const lowDetailGeometry = new THREE.PlaneGeometry(
    options.canopyDiaM,
    options.heightM
  );
  const lowDetailMaterial = new THREE.MeshBasicMaterial({
    color: '#2E7D32',
    side: THREE.DoubleSide
  });
  const lowDetail = new THREE.Mesh(lowDetailGeometry, lowDetailMaterial);
  lowDetail.castShadow = true;
  lod.addLevel(lowDetail, 200); // Switch at 200 units distance
  
  return lod;
};

/**
 * Batch geometry creation for performance
 * Creates instanced meshes for identical trees
 */
export const createInstancedTrees = (
  features: Feature<Point>[],
  baseOptions: {
    heightM: number;
    girthCm: number;
    canopyDiaM: number;
  }
): THREE.InstancedMesh => {
  const count = features.length;
  
  // Create base geometry (will be instanced)
  const baseTree = createTreeGeometry(features[0], baseOptions);
  const geometry = (baseTree.children[0] as THREE.Mesh).geometry;
  const material = (baseTree.children[0] as THREE.Mesh).material;
  
  // Create instanced mesh
  const instancedMesh = new THREE.InstancedMesh(geometry, material, count);
  instancedMesh.castShadow = true;
  instancedMesh.receiveShadow = true;
  
  // Set transform for each instance
  const matrix = new THREE.Matrix4();
  features.forEach((feature, i) => {
    const coords = feature.geometry.coordinates as [number, number];
    const worldPos = geoToWorld(coords[0], coords[1], 0);
    
    matrix.setPosition(worldPos);
    instancedMesh.setMatrixAt(i, matrix);
  });
  
  instancedMesh.instanceMatrix.needsUpdate = true;
  
  return instancedMesh;
};
