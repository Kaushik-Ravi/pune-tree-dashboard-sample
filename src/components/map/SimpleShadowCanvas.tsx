/**
 * SimpleShadowCanvas - Shadow overlay with proper camera sync
 * Based on deck.gl/kepler.gl patterns for MapLibre + Three.js integration
 */

import { useEffect } from 'react';
import * as THREE from 'three';
import { MercatorCoordinate } from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';

interface SimpleShadowCanvasProps {
  map: MapLibreMap;
  enabled: boolean;
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
    
    // Create camera - will be synced with MapLibre
    const camera = new THREE.PerspectiveCamera(
      map.transform.fov * (180 / Math.PI), // Convert radians to degrees
      width / height,
      0.1,
      1e6 // Far plane - very large for map scale
    );

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

    // Add sun light (will be positioned based on time)
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
    sunLight.position.set(1000, 2000, 1000);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 4096; // High quality
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.left = -2000;
    sunLight.shadow.camera.right = 2000;
    sunLight.shadow.camera.top = 2000;
    sunLight.shadow.camera.bottom = -2000;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 10000;
    scene.add(sunLight);
    scene.add(new THREE.AmbientLight(0x404040, 0.2));

    console.log('☀️ [SimpleShadowCanvas] Lights added');

    // Add ground plane to receive shadows
    const groundGeometry = new THREE.PlaneGeometry(1e6, 1e6);
    const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.4 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.position.y = -0.1; // Slightly below ground to avoid z-fighting
    scene.add(ground);

    console.log('🌍 [SimpleShadowCanvas] Ground plane added');

    // Fetch buildings from map
    const buildingGroup = new THREE.Group();
    scene.add(buildingGroup);

    const fetchBuildings = () => {
      console.log('🏢 [SimpleShadowCanvas] Fetching building data...');
      
      try {
        // Get all style layers to find building layers
        const layers = map.getStyle().layers || [];
        const buildingLayers = layers
          .filter((l: any) => 
            l.type === 'fill-extrusion' || 
            l.id.includes('building') ||
            l['source-layer'] === 'building'
          )
          .map((l: any) => l.id);

        console.log('🔍 [SimpleShadowCanvas] Found building layers:', buildingLayers);

        if (buildingLayers.length === 0) {
          console.warn('⚠️ [SimpleShadowCanvas] No building layers found, using default query');
        }

        // Query buildings (try with layers if found, otherwise all features)
        const features = buildingLayers.length > 0
          ? map.queryRenderedFeatures(undefined, { layers: buildingLayers })
          : map.queryRenderedFeatures();

        // Filter for building-like features
        const buildingFeatures = features.filter((f: any) => 
          f.geometry?.type === 'Polygon' &&
          (f.properties?.height || f.properties?.render_height || f.layer?.type === 'fill-extrusion')
        );

        console.log(`📊 [SimpleShadowCanvas] Found ${buildingFeatures.length} building features`);

        // Clear previous buildings
        buildingGroup.clear();

        let buildingsAdded = 0;
        const center = map.getCenter();
        const centerMercator = MercatorCoordinate.fromLngLat([center.lng, center.lat], 0);

        buildingFeatures.forEach((feature: any) => {
          if (!feature.geometry || feature.geometry.type !== 'Polygon') return;

          const coordinates = feature.geometry.coordinates[0];
          if (!coordinates || coordinates.length < 3) return;

          const height = feature.properties?.height || 
                        feature.properties?.render_height || 
                        feature.properties?.building_height || 
                        20; // Default 20m

          // Calculate polygon center
          let sumLng = 0, sumLat = 0;
          coordinates.forEach((coord: number[]) => {
            sumLng += coord[0];
            sumLat += coord[1];
          });
          const centerLng = sumLng / coordinates.length;
          const centerLat = sumLat / coordinates.length;

          // Convert to Mercator space
          const posMercator = MercatorCoordinate.fromLngLat([centerLng, centerLat], 0);
          
          // Calculate world position relative to map center (in meters)
          const worldX = (posMercator.x - centerMercator.x) * 40075016.686; // Earth circumference at equator
          const worldZ = (posMercator.y - centerMercator.y) * 40075016.686;

          // Calculate building footprint size
          const lngs = coordinates.map((c: number[]) => c[0]);
          const lats = coordinates.map((c: number[]) => c[1]);
          const minMerc = MercatorCoordinate.fromLngLat([Math.min(...lngs), Math.min(...lats)], 0);
          const maxMerc = MercatorCoordinate.fromLngLat([Math.max(...lngs), Math.max(...lats)], 0);
          
          const widthWorld = (maxMerc.x - minMerc.x) * 40075016.686;
          const depthWorld = (maxMerc.y - minMerc.y) * 40075016.686;

          if (widthWorld > 0 && depthWorld > 0 && height > 0) {
            // Create invisible box that casts shadows
            const buildingGeometry = new THREE.BoxGeometry(widthWorld, height, depthWorld);
            const buildingMaterial = new THREE.MeshStandardMaterial({
              color: 0x808080,
              transparent: true,
              opacity: 0.0, // Completely invisible - only shadows
            });

            const buildingMesh = new THREE.Mesh(buildingGeometry, buildingMaterial);
            buildingMesh.position.set(worldX, height / 2, worldZ);
            buildingMesh.castShadow = true;
            buildingMesh.receiveShadow = true;

            buildingGroup.add(buildingMesh);
            buildingsAdded++;
          }
        });

        console.log(`🏗️ [SimpleShadowCanvas] Added ${buildingsAdded} buildings to shadow scene`);
      } catch (error) {
        console.error('❌ [SimpleShadowCanvas] Error fetching buildings:', error);
      }
    };

    // Sync camera with MapLibre using transform matrix
    const syncCamera = () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      const pitch = map.getPitch() * Math.PI / 180;
      const bearing = -map.getBearing() * Math.PI / 180;

      // Camera altitude based on zoom (closer at high zoom)
      const altitude = 10000 / Math.pow(2, zoom - 10);

      // Position camera above map center
      camera.position.set(0, altitude, 0);
      camera.lookAt(0, 0, 0);
      
      // Apply pitch
      camera.rotation.x = -pitch;
      
      // Apply bearing
      camera.rotation.z = bearing;

      camera.updateMatrixWorld();
    };

    // Render function
    const render = () => {
      syncCamera();
      renderer.render(scene, camera);
    };

    // Handle map events
    const handleMapMove = () => {
      render();
    };

    const handleMapResize = () => {
      const newWidth = mapContainer.offsetWidth;
      const newHeight = mapContainer.offsetHeight;
      canvas.width = newWidth;
      canvas.height = newHeight;
      renderer.setSize(newWidth, newHeight);
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      render();
    };

    map.on('move', handleMapMove);
    map.on('zoom', handleMapMove);
    map.on('rotate', handleMapMove);
    map.on('pitch', handleMapMove);
    map.on('resize', handleMapResize);

    // Fetch buildings after map is fully loaded
    if (map.loaded()) {
      setTimeout(fetchBuildings, 500);
    } else {
      map.once('load', () => setTimeout(fetchBuildings, 500));
    }

    // Initial render
    render();
    console.log('🎬 [SimpleShadowCanvas] FIRST FRAME RENDERED');

    // Animation loop for smooth rendering
    let frameCount = 0;
    const animate = () => {
      frameCount++;
      render();
      
      if (frameCount % 300 === 0) {
        console.log(`🔄 [SimpleShadowCanvas] Frame ${frameCount}`);
      }
      
      requestAnimationFrame(animate);
    };
    animate();

    console.log('✅✅✅ [SimpleShadowCanvas] FULLY INITIALIZED');

    // Cleanup
    return () => {
      console.log('🧹 [SimpleShadowCanvas] Cleaning up');
      map.off('move', handleMapMove);
      map.off('zoom', handleMapMove);
      map.off('rotate', handleMapMove);
      map.off('pitch', handleMapMove);
      map.off('resize', handleMapResize);
      canvas.remove();
      renderer.dispose();
    };
  }, [map, enabled]);

  return null;
}
