/**
 * SimpleShadowCanvas - Working shadow implementation with real trees and time-synced sun
 */

import { useEffect } from 'react';
import * as THREE from 'three';
import * as SunCalc from 'suncalc';
import type { Map as MapLibreMap } from 'maplibre-gl';

interface SimpleShadowCanvasProps {
  map: MapLibreMap;
  enabled: boolean;
  latitude?: number;
  longitude?: number;
  dateTime?: Date;
}

export function SimpleShadowCanvas({ map, enabled, latitude = 18.5204, longitude = 73.8567, dateTime }: SimpleShadowCanvasProps) {
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
    // canvas.style.border = '3px solid lime'; // DEBUG: Bright green border (REMOVED - working now)

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

    // Calculate sun position BEFORE creating lights
    const currentDateTime = dateTime || new Date();
    const sunCalcPos = SunCalc.getPosition(currentDateTime, latitude, longitude);
    
    const altitude = sunCalcPos.altitude;
    const azimuth = sunCalcPos.azimuth;
    
    // Calculate intensity
    const naturalIntensity = Math.max(0, Math.min(1, (Math.sin(altitude) + 0.5) / 1.5));
    const intensity = altitude > 0 ? naturalIntensity : Math.max(0.3, naturalIntensity);
    
    // Convert to Three.js position
    const sunDistance = 300;
    const sunX = sunDistance * Math.cos(altitude) * Math.sin(azimuth);
    const sunY = sunDistance * Math.sin(altitude);
    const sunZ = sunDistance * Math.cos(altitude) * Math.cos(azimuth);

    // Add lights
    const sunLight = new THREE.DirectionalLight(0xffffff, Math.max(intensity, 0.5));
    sunLight.position.set(sunX, sunY, sunZ);
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

    console.log('☀️ [SimpleShadowCanvas] Sun synced:', {
      time: currentDateTime.toLocaleTimeString(),
      altitude: (altitude * 180 / Math.PI).toFixed(1) + '°',
      intensity: sunLight.intensity.toFixed(2),
      position: [sunX.toFixed(0), sunY.toFixed(0), sunZ.toFixed(0)]
    });

    // Add ground plane
    const groundGeometry = new THREE.PlaneGeometry(3000, 3000);
    const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.6 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    console.log('🌍 [SimpleShadowCanvas] Ground plane added');

    // Add demo shadow-casting objects (API doesn't exist yet)
    // TODO: Integrate with real tree data from MapLibre layer
    
    // Add a grid of trees for testing
    for (let x = -100; x <= 100; x += 30) {
      for (let z = -100; z <= 100; z += 30) {
        // Tree trunk
        const trunkGeometry = new THREE.CylinderGeometry(2, 2, 15, 8);
        const trunkMaterial = new THREE.MeshStandardMaterial({ 
          color: 0x4a3520,
          metalness: 0,
          roughness: 0.9
        });
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.set(x, 7.5, z);
        trunk.castShadow = true;
        scene.add(trunk);
        
        // Tree canopy
        const canopyGeometry = new THREE.SphereGeometry(8, 16, 16);
        const canopyMaterial = new THREE.MeshStandardMaterial({
          color: 0x228b22,
          metalness: 0,
          roughness: 0.8
        });
        const canopy = new THREE.Mesh(canopyGeometry, canopyMaterial);
        canopy.position.set(x, 18, z);
        canopy.castShadow = true;
        scene.add(canopy);
      }
    }
    
    console.log('🌳 [SimpleShadowCanvas] Added demo tree grid');

    // Skip API fetch for now - API endpoint doesn't exist
    /*
    // Fetch and add real trees
    const fetchTrees = async () => {
      try {
        const bounds = map.getBounds();
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        
        const response = await fetch(`/api/trees?swLng=${sw.lng}&swLat=${sw.lat}&neLng=${ne.lng}&neLat=${ne.lat}`);
        const data = await response.json();
        
        console.log(`🌳 [SimpleShadowCanvas] Fetched ${data.features?.length || 0} trees`);
        
        if (data.features && data.features.length > 0) {
          // Create instanced tree geometry
          const treeGeometry = new THREE.CylinderGeometry(0.5, 0.5, 10, 8);
          const treeMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x2d5016,
            metalness: 0,
            roughness: 0.9
          });
          
          const canopyGeometry = new THREE.SphereGeometry(5, 16, 16);
          const canopyMaterial = new THREE.MeshStandardMaterial({
            color: 0x228b22,
            metalness: 0,
            roughness: 0.8
          });
          
          // Add trees (limit to 500 for performance)
          const treesToAdd = data.features.slice(0, 500);
          treesToAdd.forEach((feature: any) => {
            const [lng, lat] = feature.geometry.coordinates;
            
            // Convert to world coordinates (simplified - centered around map)
            const x = (lng - longitude) * 111320; // meters
            const z = -(lat - latitude) * 110540; // meters (negative for Three.js Z)
            
            // Tree trunk
            const trunk = new THREE.Mesh(treeGeometry, treeMaterial);
            trunk.position.set(x, 5, z);
            trunk.castShadow = true;
            scene.add(trunk);
            
            // Tree canopy
            const canopy = new THREE.Mesh(canopyGeometry, canopyMaterial);
            canopy.position.set(x, 12, z);
            canopy.castShadow = true;
            scene.add(canopy);
          });
          
          console.log(`✅ [SimpleShadowCanvas] Added ${treesToAdd.length} trees to shadow scene`);
        }
      } catch (error) {
        console.error('❌ [SimpleShadowCanvas] Failed to fetch trees:', error);
      }
    };
    
    fetchTrees();

    // Remove test cube - we have real trees now!
    */

    // Render
    renderer.render(scene, camera);
    console.log('🎬 [SimpleShadowCanvas] FIRST FRAME RENDERED');

    // Animation loop
    let frameCount = 0;
    const animate = () => {
      frameCount++;
      
      // No rotation needed for real trees
      // cube.rotation.y += 0.01;
      
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
  }, [map, enabled, latitude, longitude, dateTime]);

  return null; // No JSX - we create canvas manually
}
