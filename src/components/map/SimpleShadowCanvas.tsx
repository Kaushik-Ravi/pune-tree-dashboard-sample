/**
 * SimpleShadowCanvas - Working shadow implementation with real scene geometry
 */

import { useEffect } from 'react';
import * as THREE from 'three';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { MercatorCoordinate } from 'maplibre-gl';

interface SimpleShadowCanvasProps {
  map: MapLibreMap;
  enabled: boolean;
  dateTime?: Date;
  latitude?: number;
  longitude?: number;
}

export function SimpleShadowCanvas({ 
  map, 
  enabled, 
  dateTime = new Date(),
  latitude = 18.5204,
  longitude = 73.8567 
}: SimpleShadowCanvasProps) {
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
    conCalculate sun position based on time and location
    const calculateSunPosition = (date: Date, lat: number, lng: number) => {
      const hours = date.getHours() + date.getMinutes() / 60;
      const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
      
      // Simplified solar calculation
      const solarNoon = 12;
      const hourAngle = (hours - solarNoon) * 15; // 15° per hour
      const declination = 23.45 * Math.sin((360 / 365) * (dayOfYear - 81) * Math.PI / 180);
      
      const altitude = Math.asin(
        Math.sin(lat * Math.PI / 180) * Math.sin(declination * Math.PI / 180) +
        Math.cos(lat * Math.PI / 180) * Math.cos(declination * Math.PI / 180) * Math.cos(hourAngle * Math.PI / 180)
      );
      
      const azimuth = Math.atan2(
        Math.sin(hourAngle * Math.PI / 180),
        Math.cos(hourAngle * Math.PI / 180) * Math.sin(lat * Math.PI / 180) - Math.tan(declination * Math.PI / 180) * Math.cos(lat * Math.PI / 180)
      );
      
      return { altitude, azimuth };
    };

    const { altitude, azimuth } = calculateSunPosition(dateTime, latitude, longitude);
    
    // Convert to Three.js position (distance from origin = 500 units)
    conFetch and add trees from MapLibre layer
    const addTreesToScene = () => {
      const features = map.querySourceFeatures('trees');
      if (!features || features.length === 0) {
        console.log('🌲 [SimpleShadowCanvas] No tree features found yet');
        return;
      }

      console.log(`🌲 [SimpleShadowCanvas] Adding ${features.length} trees to shadow scene`);

      // Create instanced tree geometry for performance
      const treeGeometry = new THREE.CylinderGeometry(3, 5, 15, 8); // Simplified tree shape
      const treeMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x2d5016,
        transparent: true,
        opacity: 0.05, // Nearly invisible but casts shadows
      });

      fSync camera with MapLibre
    const updateCameraAndRender = () => {
      const mapCenter = map.getCenter();
      const zoom = map.getZoom();
      const bearing = map.getBearing();
      const pitch = map.getPitch();
      
      const mercator = MercatorCoordinate.fromLngLat([mapCenter.lng, mapCenter.lat], 0);
      const scale = Math.pow(2, zoom - 15);
      
      camera.position.set(
        (mercator.x - 0.5) * 100000,
        300 / scale,
        (mercator.y - 0.5) * 100000
      );
      
      camera.rotation.y = THREE.MathUtils.degToRad(-bearing);
      camera.rotation.x = THREE.MathUtils.degToRad(-pitch);
      camera.lookAt(
        (mercator.x - 0.5) * 100000,
        0,
        (mercator.y - 0.5) * 100000
      );
      camera.updateMatrixWorld();
      
      renderer.render(scene, camera);
    };

    // Update on map movement
    map.on('move', updateCameraAndRender);
    map.on('zoom', updateCameraAndRender);
    map.on('rotate', updateCameraAndRender);
    map.on('pitch', updateCameraAndRender);

    // Animation loop
    let frameCount = 0;
    const animate = () => {
      frameCount++;
      updateCameraAndRender(
            (mercator.x - centerMercator.x) * 100000,
            7.5,
            (mercator.y - centerMercator.y) * 100000
          );
          tree.castShadow = true;
          scene.add(tree);
        }
      });

      console.log('✅ [SimpleShadowCanvas] Trees added to scene');
    };

    // Wait for map to load, then add trees
    if (map.loaded()) {
      addTreesToScene();
    } map.off('move', updateCameraAndRender);
      map.off('zoom', updateCameraAndRender);
      map.off('rotate', updateCameraAndRender);
      map.off('pitch', updateCameraAndRender);
      canvas.remove();
      renderer.dispose();
    };
  }, [map, enabled, dateTime, latitude, longitudew.camera.top = 500;
    sunLight.shadow.camera.bottom = -500;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 1500;
    scene.add(sunLight);
    scene.add(new THREE.AmbientLight(0x404040, 0.4));

    console.log('☀️ [SimpleShadowCanvas] Sun positioned:', { altitude: altitude * 180 / Math.PI, azimuth: azimuth * 180 / Math.PI, intensity: sunLight.intensity }
    // Add ground plane
    const groundGeometry = new THREE.PlaneGeometry(3000, 3000);
    const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.6 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    console.log('🌍 [SimpleShadowCanvas] Ground plane added');

    // Add GIANT RED CUBE for testing
    const cubeGeometry = new THREE.BoxGeometry(80, 80, 80);
    const cubeMaterial = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      metalness: 0,
      roughness: 1,
    });
    const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
    cube.position.set(0, 40, 0);
    cube.castShadow = true;
    scene.add(cube);

    console.log('🧊 [SimpleShadowCanvas] GIANT RED CUBE added');

    // Render
    renderer.render(scene, camera);
    console.log('🎬 [SimpleShadowCanvas] FIRST FRAME RENDERED');

    // Animation loop
    let frameCount = 0;
    const animate = () => {
      frameCount++;
      
      // Rotate cube for visibility
      cube.rotation.y += 0.01;
      
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
