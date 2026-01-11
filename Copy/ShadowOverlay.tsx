/**
 * ShadowOverlay - Renders physics-based shadows using Three.js canvas overlaid on MapLibre
 * 
 * Architecture: Independent Three.js canvas positioned absolutely over MapLibre map
 * Benefits:
 * - No React lifecycle issues (no custom layer integration)
 * - Independent render loop (no MapLibre coupling)
 * - Proven pattern (used by deck.gl, kepler.gl, Foursquare Studios)
 */

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { MercatorCoordinate } from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';

interface ShadowOverlayProps {
  map: MapLibreMap;
  enabled: boolean;
  shadowQuality?: 'low' | 'medium' | 'high';
  latitude: number;
  longitude: number;
  dateTime: Date;
}

export function ShadowOverlay(props: ShadowOverlayProps) {
  const { map, enabled, shadowQuality = 'high', latitude, longitude, dateTime } = props;
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<THREE.Scene>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const animationFrameRef = useRef<number>();
  
  console.log('🎨 [ShadowOverlay] Component rendering:', { enabled, shadowQuality });

  // Initialize Three.js scene
  useEffect(() => {
    if (!canvasRef.current || !enabled) return;
    
    console.log('🚀 [ShadowOverlay] Initializing Three.js scene');

    // Get map container dimensions
    const mapContainer = map.getContainer();
    const width = mapContainer.offsetWidth;
    const height = mapContainer.offsetHeight;

    // Create scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Create camera matching MapLibre's projection
    const camera = new THREE.PerspectiveCamera(
      map.transform.fov || 45,
      width / height,
      0.1,
      10000
    );
    cameraRef.current = camera;

    // Create WebGL renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      alpha: true, // Transparent background
      antialias: true,
      powerPreference: 'high-performance',
    });
    
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    
    // Enable shadows
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    rendererRef.current = renderer;

    // Add directional light (sun) with shadow camera
    const sunLight = new THREE.DirectionalLight(0xffffff, 1);
    sunLight.position.set(50, 100, 50);
    sunLight.castShadow = true;
    
    // Configure shadow camera for wide coverage
    sunLight.shadow.camera.left = -200;
    sunLight.shadow.camera.right = 200;
    sunLight.shadow.camera.top = 200;
    sunLight.shadow.camera.bottom = -200;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 500;
    
    // Shadow map resolution
    const shadowMapSize = shadowQuality === 'high' ? 2048 : shadowQuality === 'medium' ? 1024 : 512;
    sunLight.shadow.mapSize.width = shadowMapSize;
    sunLight.shadow.mapSize.height = shadowMapSize;
    
    scene.add(sunLight);
    scene.add(new THREE.AmbientLight(0x404040, 0.5)); // Soft ambient light

    // Add ground plane to receive shadows
    const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
    const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.3 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    console.log('✅ [ShadowOverlay] Three.js scene initialized');

    return () => {
      console.log('🧹 [ShadowOverlay] Cleaning up Three.js scene');
      renderer.dispose();
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [map, enabled, shadowQuality]);

  // Sync camera with MapLibre on every map move/zoom
  useEffect(() => {
    if (!map || !enabled || !cameraRef.current || !sceneRef.current || !rendererRef.current) return;

    const updateCamera = () => {
      const camera = cameraRef.current!;
      const scene = sceneRef.current!;
      const renderer = rendererRef.current!;

      // Get MapLibre's camera parameters
      const mapCenter = map.getCenter();
      const zoom = map.getZoom();
      const bearing = map.getBearing();
      const pitch = map.getPitch();

      // Convert lat/lng to world coordinates
      const mercator = MercatorCoordinate.fromLngLat([mapCenter.lng, mapCenter.lat], 0);
      
      // Position Three.js camera to match MapLibre
      // Scale factor for zoom level (higher zoom = closer camera)
      const scale = Math.pow(2, zoom - 12); // Adjust multiplier as needed
      camera.position.set(
        mercator.x * 1000,
        50 / scale, // Height above ground
        mercator.y * 1000
      );
      
      // Match bearing (rotation around Y axis)
      camera.rotation.y = THREE.MathUtils.degToRad(bearing);
      
      // Match pitch (rotation around X axis)
      camera.rotation.x = THREE.MathUtils.degToRad(-pitch);

      camera.updateMatrixWorld();

      // Render frame
      renderer.render(scene, camera);
    };

    // Update on map events
    map.on('move', updateCamera);
    map.on('zoom', updateCamera);
    map.on('rotate', updateCamera);
    map.on('pitch', updateCamera);

    // Initial render
    updateCamera();

    // Continuous render loop (for shadow animations, tree sway, etc.)
    const animate = () => {
      updateCamera();
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animate();

    console.log('🔄 [ShadowOverlay] Camera sync and render loop started');

    return () => {
      map.off('move', updateCamera);
      map.off('zoom', updateCamera);
      map.off('rotate', updateCamera);
      map.off('pitch', updateCamera);
      
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      
      console.log('� [ShadowOverlay] Camera sync stopped');
    };
  }, [map, enabled]);

  if (!enabled) {
    return null;
  }

  return (
    <canvas
      ref={canvasRefCallback}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none', // Let clicks pass through to map
        zIndex: 1, // Above map, below UI
      }}
    />
  );
}
