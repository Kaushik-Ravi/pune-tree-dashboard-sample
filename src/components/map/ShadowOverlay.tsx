/**
 * ShadowOverlay - Renders physics-based shadows using Three.js canvas overlaid on MapLibre
 * 
 * Architecture: Independent Three.js canvas positioned absolutely over MapLibre map
 * CRITICAL: Uses ref callback instead of useEffect to bypass React lifecycle blocking
 */

import { useRef } from 'react';
import * THREE from 'three';
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
  const { map, enabled, shadowQuality = 'high' } = props;
  
  const sceneRef = useRef<THREE.Scene>();
  const cameraRef = useRef<THREE.PerspectiveCamera>();
  const rendererRef = useRef<THREE.WebGLRenderer>();
  const animationFrameRef = useRef<number>();
  const initializedRef = useRef(false);
  
  console.log('🎨 [ShadowOverlay] Component rendering:', { enabled, shadowQuality });

  // BYPASS useEffect - initialize immediately when canvas mounts via ref callback
  const canvasRefCallback = (canvas: HTMLCanvasElement | null) => {
    if (!canvas || !enabled || initializedRef.current) {
      console.log('⏭️ [ShadowOverlay] Skipping init:', { hasCanvas: !!canvas, enabled, alreadyInit: initializedRef.current });
      return;
    }
    
    console.log('🚀🚀🚀 [ShadowOverlay] CANVAS MOUNTED - INITIALIZING IMMEDIATELY');
    initializedRef.current = true;

    try {
      // Get map container dimensions
      const mapContainer = map.getContainer();
      const width = mapContainer.offsetWidth;
      const height = mapContainer.offsetHeight;

      console.log('📐 [ShadowOverlay] Canvas size:', { width, height });

      // Create scene
      const scene = new THREE.Scene();
      sceneRef.current = scene;

      // Create camera matching MapLibre's projection
      const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 10000);
      cameraRef.current = camera;

      // Create WebGL renderer
      const renderer = new THREE.WebGLRenderer({
        canvas,
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

      console.log('✅ [ShadowOverlay] Renderer created');

      // Add directional light (sun) with shadow camera
      const sunLight = new THREE.DirectionalLight(0xffffff, 1.5);
      sunLight.position.set(100, 150, 100);
      sunLight.castShadow = true;
      
      // Configure shadow camera for wide coverage
      sunLight.shadow.camera.left = -300;
      sunLight.shadow.camera.right = 300;
      sunLight.shadow.camera.top = 300;
      sunLight.shadow.camera.bottom = -300;
      sunLight.shadow.camera.near = 0.5;
      sunLight.shadow.camera.far = 1000;
      
      // Shadow map resolution
      const shadowMapSize = shadowQuality === 'high' ? 2048 : shadowQuality === 'medium' ? 1024 : 512;
      sunLight.shadow.mapSize.width = shadowMapSize;
      sunLight.shadow.mapSize.height = shadowMapSize;
      
      scene.add(sunLight);
      scene.add(new THREE.AmbientLight(0x404040, 0.4)); // Soft ambient light

      console.log('☀️ [ShadowOverlay] Lights added');

      // Add ground plane to receive shadows
      const groundGeometry = new THREE.PlaneGeometry(2000, 2000);
      const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.5 });
      const ground = new THREE.Mesh(groundGeometry, groundMaterial);
      ground.rotation.x = -Math.PI / 2;
      ground.receiveShadow = true;
      scene.add(ground);
      
      console.log('🌍 [ShadowOverlay] Ground plane added');

      // Add test cube to cast shadow - BRIGHT RED for visibility
      const cubeGeometry = new THREE.BoxGeometry(40, 40, 40);
      const cubeMaterial = new THREE.MeshStandardMaterial({ 
        color: 0xff0000,
        metalness: 0.3,
        roughness: 0.7
      });
      const cube = new THREE.Mesh(cubeGeometry, cubeMaterial);
      cube.position.set(0, 20, 0);
      cube.castShadow = true;
      scene.add(cube);

      console.log('🧊 [ShadowOverlay] Test cube added');

      // Camera and render loop
      const updateCamera = () => {
        const mapCenter = map.getCenter();
        const zoom = map.getZoom();
        const bearing = map.getBearing();
        const pitch = map.getPitch();

        // Convert lat/lng to world coordinates
        const mercator = MercatorCoordinate.fromLngLat([mapCenter.lng, mapCenter.lat], 0);
        
        // Position Three.js camera to match MapLibre
        const scale = Math.pow(2, zoom - 14); // Adjusted scale
        camera.position.set(
          (mercator.x - 0.5) * 2000,
          100 / scale,
          (mercator.y - 0.5) * 2000
        );
        
        camera.rotation.y = THREE.MathUtils.degToRad(-bearing);
        camera.rotation.x = THREE.MathUtils.degToRad(-pitch);
        camera.updateMatrixWorld();

        // Render frame
        renderer.render(scene, camera);
      };

      // Update on map events
      const handleMove = () => updateCamera();
      map.on('move', handleMove);
      map.on('zoom', handleMove);
      map.on('rotate', handleMove);
      map.on('pitch', handleMove);

      // Initial render
      updateCamera();

      // Continuous render loop
      const animate = () => {
        updateCamera();
        animationFrameRef.current = requestAnimationFrame(animate);
      };
      animate();

      console.log('✅✅✅ [ShadowOverlay] THREE.JS FULLY INITIALIZED - RENDERING NOW');

    } catch (error) {
      console.error('❌ [ShadowOverlay] Initialization error:', error);
    }
  };

  if (!enabled) {
    console.log('⏸️ [ShadowOverlay] Disabled - not rendering canvas');
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
        border: '2px solid red', // DEBUG: Make canvas visible
      }}
    />
  );
}
