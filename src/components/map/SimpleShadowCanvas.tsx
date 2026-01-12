/**
 * SimpleShadowCanvas - Ultra-simple shadow implementation
 * No refs, no state, just pure canvas rendering
 */

import { useEffect } from 'react';
import * as THREE from 'three';
import { MercatorCoordinate } from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';

interface SimpleShadowCanvasProps {
  map: MapLibreMap;
  enabled: boolean;
}

/**
 * Convert lng/lat to Three.js world coordinates
 */
function lngLatToWorld(lng: number, lat: number, worldSize: number = 2000): { x: number, z: number } {
  const mercator = MercatorCoordinate.fromLngLat([lng, lat], 0);
  return {
    x: (mercator.x - 0.5) * worldSize,
    z: (mercator.y - 0.5) * worldSize,
  };
}

export function SimpleShadowCanvas({ map, enabled }: SimpleShadowCanvasProps) {
  console.log('🎯 [SimpleShadowCanvas] Render - enabled:', enabled);

  useEffect(() => {
    if (!enabled) {
      console.log('⏸️ [SimpleShadowCanvas] Disabled, skipping');
      return;
    }

    console.log('🚀 [SimpleShadowCanvas] STARTING INITIALIZATION');

    // Create canvas element
    const canvas = document.createElement('canvas');
    canvas.id = 'shadow-canvas';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '1';
    canvas.style.border = '2px solid rgba(0,255,0,0.3)'; // DEBUG: Subtle green border

    // Append to map container
    const mapContainer = map.getContainer();
    mapContainer.appendChild(canvas);

    console.log('📦 [SimpleShadowCanvas] Canvas added to DOM');

    // Get dimensions
    const width = mapContainer.offsetWidth;
    const height = mapContainer.offsetHeight;
    canvas.width = width;
    canvas.height = height;

    console.log('📐 [SimpleShadowCanvas] Canvas size:', width, 'x', height);

    // Create Three.js scene
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 5000);
    camera.position.set(0, 200, 200);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    console.log('✅ [SimpleShadowCanvas] Three.js renderer created');

    // Add lights
    const sunLight = new THREE.DirectionalLight(0xffffff, 2);
    sunLight.position.set(200, 300, 200);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.left = -400;
    sunLight.shadow.camera.right = 400;
    sunLight.shadow.camera.top = 400;
    sunLight.shadow.camera.bottom = -400;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 1000;
    scene.add(sunLight);
    scene.add(new THREE.AmbientLight(0x404040, 0.3));

    console.log('☀️ [SimpleShadowCanvas] Lights added');

    // Add ground plane
    const groundGeometry = new THREE.PlaneGeometry(3000, 3000);
    const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.6 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    console.log('🌍 [SimpleShadowCanvas] Ground plane added');

    // Fetch building data from map
    const fetchBuildings = () => {
      console.log('🏢 [SimpleShadowCanvas] Fetching building data...');
      
      const bounds = map.getBounds();
      const features = map.queryRenderedFeatures(undefined, {
        layers: ['building', 'building-3d'], // Common building layer IDs
      });

      console.log(`📊 [SimpleShadowCanvas] Found ${features.length} building features`);

      let buildingsAdded = 0;

      features.forEach((feature, index) => {
        if (!feature.geometry || feature.geometry.type !== 'Polygon') return;

        const coordinates = feature.geometry.coordinates[0]; // Outer ring
        if (!coordinates || coordinates.length < 3) return;

        // Get building height from properties
        const height = feature.properties?.height || 
                      feature.properties?.render_height || 
                      feature.properties?.building_height || 
                      15; // Default 15m

        // Calculate center of polygon
        let centerLng = 0, centerLat = 0;
        coordinates.forEach((coord: number[]) => {
          centerLng += coord[0];
          centerLat += coord[1];
        });
        centerLng /= coordinates.length;
        centerLat /= coordinates.length;

        // Convert to world coordinates
        const worldPos = lngLatToWorld(centerLng, centerLat);

        // Create simple box geometry for shadow casting
        // Width/depth approximation from polygon bounds
        const lngs = coordinates.map((c: number[]) => c[0]);
        const lats = coordinates.map((c: number[]) => c[1]);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        
        const widthWorld = lngLatToWorld(maxLng, centerLat).x - lngLatToWorld(minLng, centerLat).x;
        const depthWorld = lngLatToWorld(centerLng, maxLat).z - lngLatToWorld(centerLng, minLat).z;

        // Create invisible building mesh that casts shadows
        const buildingGeometry = new THREE.BoxGeometry(
          Math.abs(widthWorld),
          height,
          Math.abs(depthWorld)
        );
        
        const buildingMaterial = new THREE.MeshStandardMaterial({
          color: 0x808080,
          transparent: true,
          opacity: 0.01, // Almost invisible - just shadows
          wireframe: false,
        });

        const buildingMesh = new THREE.Mesh(buildingGeometry, buildingMaterial);
        buildingMesh.position.set(worldPos.x, height / 2, worldPos.z);
        buildingMesh.castShadow = true;
        buildingMesh.receiveShadow = true;

        scene.add(buildingMesh);
        buildingsAdded++;
      });

      console.log(`🏗️ [SimpleShadowCanvas] Added ${buildingsAdded} buildings to shadow scene`);
    };

    // Fetch buildings after a short delay to ensure map is loaded
    setTimeout(fetchBuildings, 1000);

    // Render
    renderer.render(scene, camera);
    console.log('🎬 [SimpleShadowCanvas] FIRST FRAME RENDERED');

    // Animation loop
    let frameCount = 0;
    const animate = () => {
      frameCount++;
      
      renderer.render(scene, camera);
      
      if (frameCount === 1 || frameCount % 60 === 0) {
        console.log(`🔄 [SimpleShadowCanvas] Frame ${frameCount} rendered`);
      }
      
      requestAnimationFrame(animate);
    };
    animate();

    console.log('✅✅✅ [SimpleShadowCanvas] FULLY INITIALIZED AND ANIMATING');

    // Cleanup
    return () => {
      console.log('🧹 [SimpleShadowCanvas] Cleaning up');
      canvas.remove();
      renderer.dispose();
    };
  }, [map, enabled]);

  return null; // No JSX - we create canvas manually
}
