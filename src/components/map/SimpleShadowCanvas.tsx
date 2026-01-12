/**
 * SimpleShadowCanvas - Shadow system using proper building extraction
 * Creates invisible Three.js geometries from MapLibre building data that cast realistic shadows
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

    // Create canvas overlay
    const canvas = document.createElement('canvas');
    canvas.id = 'shadow-canvas';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '1';

    const mapContainer = map.getContainer();
    mapContainer.appendChild(canvas);
    console.log('📦 [SimpleShadowCanvas] Canvas added to DOM');

    // Get dimensions
    const width = mapContainer.offsetWidth;
    const height = mapContainer.offsetHeight;
    canvas.width = width;
    canvas.height = height;
    console.log('📐 [SimpleShadowCanvas] Canvas size:', width, 'x', height);

    // Setup Three.js scene
    const scene = new THREE.Scene();
    
    const camera = new THREE.PerspectiveCamera(
      map.transform.fov * (180 / Math.PI),
      width / height,
      0.1,
      100000
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
    console.log('✅ [SimpleShadowCanvas] Renderer created');

    // Directional sun light
    const sunLight = new THREE.DirectionalLight(0xffffff, 2.0);
    sunLight.position.set(100, 200, 100);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 4096;
    sunLight.shadow.mapSize.height = 4096;
    sunLight.shadow.camera.left = -500;
    sunLight.shadow.camera.right = 500;
    sunLight.shadow.camera.top = 500;
    sunLight.shadow.camera.bottom = -500;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 2000;
    scene.add(sunLight);
    scene.add(new THREE.AmbientLight(0x404040, 0.5));
    console.log('☀️ [SimpleShadowCanvas] Lights configured');

    // Ground plane to receive shadows
    const groundGeometry = new THREE.PlaneGeometry(10000, 10000);
    const groundMaterial = new THREE.ShadowMaterial({ 
      opacity: 0.5,
      transparent: true 
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.position.y = 0;
    scene.add(ground);
    console.log('🌍 [SimpleShadowCanvas] Ground plane added');

    // Building group
    const buildingGroup = new THREE.Group();
    scene.add(buildingGroup);

    // Function to extract building geometries from MapLibre
    const fetchBuildings = () => {
      console.log('🏢 [SimpleShadowCanvas] Extracting buildings from MapLibre...');
      
      try {
        // Get building layers from style
        const style = map.getStyle();
        if (!style || !style.layers) {
          console.error('❌ [SimpleShadowCanvas] No map style available');
          return;
        }

        const buildingLayerIds = style.layers
          .filter((layer: any) => layer.type === 'fill-extrusion')
          .map((layer: any) => layer.id);

        console.log('🔍 [SimpleShadowCanvas] Building layer IDs:', buildingLayerIds);

        if (buildingLayerIds.length === 0) {
          console.warn('⚠️ [SimpleShadowCanvas] No fill-extrusion layers found - using all features');
        }

        // Query all rendered features
        const allFeatures = map.queryRenderedFeatures();
        console.log(`📋 [SimpleShadowCanvas] Total rendered features: ${allFeatures.length}`);

        // Filter for buildings with height
        const buildingFeatures = allFeatures.filter((feature: any) => {
          const hasHeight = feature.properties?.height || 
                           feature.properties?.render_height ||
                           feature.properties?.min_height ||
                           feature.layer?.type === 'fill-extrusion';
          const isPolygon = feature.geometry?.type === 'Polygon';
          return hasHeight && isPolygon;
        });

        console.log(`🏗️ [SimpleShadowCanvas] Buildings with height: ${buildingFeatures.length}`);

        // Clear existing building meshes
        buildingGroup.clear();

        const center = map.getCenter();
        const zoom = map.getZoom();
        let added = 0;

        // Convert map scale (meters per pixel at current zoom)
        const metersPerPixel = (156543.03392 * Math.cos(center.lat * Math.PI / 180)) / Math.pow(2, zoom);

        buildingFeatures.forEach((feature: any, index: number) => {
          try {
            if (!feature.geometry || feature.geometry.type !== 'Polygon') return;

            const coords = feature.geometry.coordinates[0];
            if (!coords || coords.length < 3) return;

            // Get building height
            const heightValue = feature.properties?.height || 
                               feature.properties?.render_height ||
                               feature.properties?.min_height ||
                               15; // Default 15m

            const height = typeof heightValue === 'string' ? parseFloat(heightValue) : heightValue;
            if (height <= 0 || isNaN(height)) return;

            // Calculate bounding box
            const lngs = coords.map((c: number[]) => c[0]);
            const lats = coords.map((c: number[]) => c[1]);
            const minLng = Math.min(...lngs);
            const maxLng = Math.max(...lngs);
            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);

            // Convert to mercator space
            const minMerc = MercatorCoordinate.fromLngLat([minLng, minLat], 0);
            const maxMerc = MercatorCoordinate.fromLngLat([maxLng, maxLat], 0);
            const centerMerc = MercatorCoordinate.fromLngLat([center.lng, center.lat], 0);

            // Calculate size in meters
            const EARTH_CIRCUMFERENCE = 40075016.686;
            const width = (maxMerc.x - minMerc.x) * EARTH_CIRCUMFERENCE;
            const depth = (maxMerc.y - minMerc.y) * EARTH_CIRCUMFERENCE;

            if (width <= 0 || depth <= 0 || width > 1000 || depth > 1000) {
              return; // Skip invalid or too large buildings
            }

            // Building center in mercator
            const buildingCenterLng = (minLng + maxLng) / 2;
            const buildingCenterLat = (minLat + maxLat) / 2;
            const buildingCenterMerc = MercatorCoordinate.fromLngLat([buildingCenterLng, buildingCenterLat], 0);

            // Position relative to map center
            const x = (buildingCenterMerc.x - centerMerc.x) * EARTH_CIRCUMFERENCE;
            const z = (buildingCenterMerc.y - centerMerc.y) * EARTH_CIRCUMFERENCE;

            // Only add buildings within reasonable distance (1km radius)
            if (Math.abs(x) > 1000 || Math.abs(z) > 1000) return;

            // Create invisible building mesh (only casts shadow)
            const geometry = new THREE.BoxGeometry(width, height, depth);
            const material = new THREE.MeshStandardMaterial({
              color: 0x888888,
              transparent: true,
              opacity: 0, // Invisible - only shadows visible
            });

            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(x, height / 2, z);
            mesh.castShadow = true;
            mesh.receiveShadow = false;

            buildingGroup.add(mesh);
            added++;

            // Log first few buildings for debugging
            if (index < 3) {
              console.log(`🏢 Building ${index}: pos(${x.toFixed(1)}, ${(height/2).toFixed(1)}, ${z.toFixed(1)}) size(${width.toFixed(1)}x${height.toFixed(1)}x${depth.toFixed(1)})`);
            }
          } catch (error) {
            console.error('❌ Error processing building:', error);
          }
        });

        console.log(`✅ [SimpleShadowCanvas] Added ${added} building shadow casters`);
      } catch (error) {
        console.error('❌ [SimpleShadowCanvas] Error in fetchBuildings:', error);
      }
    };

    // Camera synchronization with MapLibre
    const syncCamera = () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      const pitch = map.getPitch() * (Math.PI / 180);
      const bearing = map.getBearing() * (Math.PI / 180);

      // Calculate camera altitude based on zoom
      const altitude = 500 / Math.pow(2, zoom - 14);

      // Position camera
      camera.position.set(0, altitude, 0);
      camera.lookAt(0, 0, 0);
      
      // Apply map pitch (tilt)
      camera.rotation.x = -pitch;
      
      // Apply map bearing (rotation)
      camera.rotation.z = bearing;

      camera.updateProjectionMatrix();
      camera.updateMatrixWorld();
    };

    // Render function
    const render = () => {
      syncCamera();
      renderer.render(scene, camera);
    };

    // Event handlers
    const handleMapMove = () => {
      render();
    };

    const handleMapZoom = () => {
      // Re-fetch buildings on significant zoom changes for better performance
      const currentZoom = map.getZoom();
      if (Math.abs(currentZoom - map.getZoom()) > 2) {
        fetchBuildings();
      }
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

    // Register map event listeners
    map.on('move', handleMapMove);
    map.on('zoom', handleMapZoom);
    map.on('rotate', handleMapMove);
    map.on('pitch', handleMapMove);
    map.on('resize', handleMapResize);

    // Wait for map to be fully loaded, then fetch buildings
    const initBuildings = () => {
      console.log('🔄 [SimpleShadowCanvas] Map loaded, waiting for style...');
      const checkAndFetch = () => {
        if (map.isStyleLoaded()) {
          console.log('✅ [SimpleShadowCanvas] Style loaded, fetching buildings');
          fetchBuildings();
        } else {
          console.log('⏳ [SimpleShadowCanvas] Style not ready, retrying...');
          setTimeout(checkAndFetch, 200);
        }
      };
      checkAndFetch();
    };

    if (map.loaded() && map.isStyleLoaded()) {
      setTimeout(initBuildings, 100);
    } else {
      map.once('load', initBuildings);
    }

    // Initial render
    syncCamera();
    render();
    console.log('🎬 [SimpleShadowCanvas] FIRST RENDER');

    // Animation loop with frame counting
    let frameCount = 0;
    let animationId: number;
    
    const animate = () => {
      frameCount++;
      render();
      
      // Log every 60 frames (1 second at 60fps)
      if (frameCount % 60 === 0) {
        console.log(`🔄 [SimpleShadowCanvas] Frame ${frameCount}`);
      }
      
      animationId = requestAnimationFrame(animate);
    };
    animate();

    console.log('✅ [SimpleShadowCanvas] INITIALIZATION COMPLETE');

    // Cleanup function
    return () => {
      console.log('🧹 [SimpleShadowCanvas] Cleaning up');
      cancelAnimationFrame(animationId);
      map.off('move', handleMapMove);
      map.off('zoom', handleMapZoom);
      map.off('rotate', handleMapMove);
      map.off('pitch', handleMapMove);
      map.off('resize', handleMapResize);
      
      // Dispose Three.js resources
      buildingGroup.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) {
            object.material.forEach(mat => mat.dispose());
          } else {
            object.material.dispose();
          }
        }
      });
      
      ground.geometry.dispose();
      groundMaterial.dispose();
      renderer.dispose();
      canvas.remove();
    };
  }, [map, enabled]);

  return null;
}
