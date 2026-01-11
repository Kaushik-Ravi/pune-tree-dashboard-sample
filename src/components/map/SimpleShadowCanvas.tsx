/**
 * SimpleShadowCanvas - Ultra-simple shadow implementation
 * No refs, no state, just pure canvas rendering
 */

import { useEffect } from 'react';
import * as THREE from 'three';
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
    canvas.style.border = '3px solid lime'; // DEBUG: Bright green border

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
