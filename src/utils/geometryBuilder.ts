// src/utils/geometryBuilder.ts
import * as THREE from 'three';
import { MercatorCoordinate } from 'maplibre-gl';
import type { Feature, Point, Polygon } from 'geojson';

/**
 * Converts geographic coordinates to Three.js world space
 * Uses Mercator projection to match MapLibre GL coordinate system
 * 
 * CRITICAL: This function now uses MapLibre's modelMatrix scaling convention
 * to ensure Three.js objects appear correctly in the MapLibre viewport.
 * 
 * The coordinate system works as follows:
 * 1. MapLibre uses normalized Mercator coordinates (0-1 range globally)
 * 2. Custom layers receive a projectionMatrix that transforms these to clip space
 * 3. We position objects using Mercator coordinates directly (no scaling)
 * 4. The projectionMatrix handles the transformation to screen space
 */
export const geoToWorld = (
  longitude: number,
  latitude: number,
  altitude: number = 0
): THREE.Vector3 => {
  const mercator = MercatorCoordinate.fromLngLat([longitude, latitude], altitude);
  
  // MapLibre custom layers use Mercator coordinates (0-1 normalized range)
  // For Three.js positioning:
  // - Use mercator.x, mercator.y, mercator.z DIRECTLY as position coordinates
  // - They are already in the correct space for the projection matrix
  // - Altitude (mercator.z) is already in Mercator units (conformal with X/Y)
  // 
  // The scale transformation happens in the projection matrix, not here!
  // See: https://maplibre.org/maplibre-gl-js/docs/examples/add-a-3d-model-with-shadow-using-threejs/
  
  const result = new THREE.Vector3(
    mercator.x,    // X: Longitude in Mercator space (0-1)
    mercator.z,    // Y: Altitude in Mercator space (conformal)
    -mercator.y    // Z: Latitude in Mercator space (0-1), negated for Three.js right-hand coords
  );
  
  return result;
};

/**
 * Creates realistic tree geometry with trunk and canopy
 * Returns a Group containing both meshes, ready to cast/receive shadows
 * 
 * Shadow configuration:
 * - Trunk: Casts and receives shadows
 * - Canopy: Casts shadows, receives shadows (for building shadows on trees)
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
  
  // Calculate dimensions
  const trunkRadius = (girthCm / 100) / (2 * Math.PI); // circumference → radius
  const trunkHeight = heightM * 0.4; // 40% of total height is trunk
  const canopyHeight = heightM * 0.6; // 60% is canopy
  const canopyRadius = canopyDiaM / 2;
  
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
    metalness: 0.1,
    emissive: 0x000000,
    emissiveIntensity: 0.0,
  });
  
  const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  trunk.position.y = trunkHeight / 2; // Center at base
  
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
    metalness: 0.0,
    emissive: 0x000000,
    emissiveIntensity: 0.0,
  });
  
  const canopy = new THREE.Mesh(canopyGeometry, canopyMaterial);
  canopy.castShadow = true;
  canopy.receiveShadow = true; // IMPORTANT: Receive shadows from buildings
  canopy.position.y = trunkHeight + (canopyHeight / 2);
  
  // Add both to group
  treeGroup.add(trunk);
  treeGroup.add(canopy);
  
  // Position in world space using fixed coordinate transformation
  const worldPos = geoToWorld(lng, lat, 0);
  treeGroup.position.copy(worldPos);
  
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
    metalness: 0.3,
    emissive: 0x000000,
    emissiveIntensity: 0.0,
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
 * 
 * CRITICAL: Ground plane must be large enough to catch all shadows
 * and positioned correctly in Mercator coordinate space
 */
export const createGroundPlane = (
  bounds: { sw: [number, number]; ne: [number, number] },
  options: {
    color?: string;
    receiveShadow?: boolean;
    opacity?: number;
    shadowOnly?: boolean;
  } = {}
): THREE.Mesh => {
  const { 
    color = '#000000', 
    receiveShadow = true, 
    opacity = 0.5,
    shadowOnly = true // Default to transparency for map overlays
  } = options;
  
  // Convert bounds to world space
  const swPos = geoToWorld(bounds.sw[0], bounds.sw[1], 0);
  const nePos = geoToWorld(bounds.ne[0], bounds.ne[1], 0);
  
  const width = Math.abs(nePos.x - swPos.x);
  const height = Math.abs(nePos.z - swPos.z);
  
  // Create high-resolution plane for shadow quality
  const geometry = new THREE.PlaneGeometry(width, height, 128, 128);
  
  let material: THREE.Material;

  if (shadowOnly) {
    // CRITICAL: Use ShadowMaterial for transparent overlay
    // This allows the map to show through while still receiving shadows
    console.log('🌑 [geometryBuilder] Creating transparent ShadowMaterial ground plane');
    material = new THREE.ShadowMaterial({
      color: new THREE.Color(0x000000), // Force black shadows
      opacity: opacity,
      side: THREE.DoubleSide
    });
  } else {
    // Legacy/Debug mode: Opaque plane
    console.log('⬜ [geometryBuilder] Creating OPAQUE MeshStandardMaterial ground plane (Legacy/Debug)');
    material = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.95,
      metalness: 0.0,
      side: THREE.DoubleSide,
      emissive: 0x000000,
      emissiveIntensity: 0.0,
    });
  }
  
  const plane = new THREE.Mesh(geometry, material);
  plane.receiveShadow = receiveShadow;
  plane.rotation.x = -Math.PI / 2; // Horizontal
  
  // Center the plane in Mercator space
  const centerX = (swPos.x + nePos.x) / 2;
  const centerZ = (swPos.z + nePos.z) / 2;
  const centerY = (swPos.y + nePos.y) / 2;
  plane.position.set(centerX, centerY - 0.000001, centerZ); // Slightly below ground in Mercator units
  
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
