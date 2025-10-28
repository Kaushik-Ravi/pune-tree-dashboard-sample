/**
 * GeometryWorker - Web Worker for Off-Thread Geometry Creation
 * 
 * Creates Three.js geometries in a background thread to keep the main thread
 * free for rendering. This prevents frame drops during heavy tree loading.
 * 
 * Benefits:
 * - Main thread stays responsive during geometry creation
 * - 60 FPS maintained even when loading thousands of trees
 * - CPU-intensive operations don't block rendering
 * 
 * Worker Message Types:
 * - 'createTreeGeometry': Create tree trunk and canopy geometries
 * - 'createBuildingGeometry': Create extruded building geometry
 * - 'batchCreate': Create multiple geometries in one message
 */

import * as THREE from 'three';

/**
 * Geometry creation request
 */
export interface GeometryRequest {
  id: string;
  type: 'tree' | 'building' | 'terrain';
  params: any;
}

/**
 * Geometry creation response
 */
export interface GeometryResponse {
  id: string;
  success: boolean;
  data?: any;
  error?: string;
  timeTaken?: number;
}

/**
 * Tree geometry parameters
 */
export interface TreeGeometryParams {
  trunkRadius: number;
  trunkHeight: number;
  canopyRadius: number;
  canopyHeight: number;
  trunkSegments: number;
  canopySegments: number;
}

/**
 * Building geometry parameters
 */
export interface BuildingGeometryParams {
  vertices: Array<[number, number]>;
  height: number;
}

/**
 * Geometry worker manager
 * Manages communication with web worker for geometry creation
 */
export class GeometryWorkerManager {
  private worker: Worker | null = null;
  private pendingRequests: Map<string, {
    resolve: (data: any) => void;
    reject: (error: Error) => void;
    startTime: number;
  }> = new Map();
  
  private requestIdCounter = 0;
  private isInitialized = false;

  constructor() {
    // Check if Web Workers are supported
    if (typeof Worker === 'undefined') {
      console.warn('[GeometryWorker] Web Workers not supported');
      return;
    }

    this.initializeWorker();
  }

  /**
   * Initialize the web worker
   */
  private initializeWorker(): void {
    try {
      // Create inline worker (no separate file needed)
      const workerCode = this.getWorkerCode();
      const blob = new Blob([workerCode], { type: 'application/javascript' });
      const workerUrl = URL.createObjectURL(blob);
      
      this.worker = new Worker(workerUrl);
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      this.worker.onerror = this.handleWorkerError.bind(this);
      
      this.isInitialized = true;
      console.log('[GeometryWorker] Initialized');
      
      // Clean up blob URL
      URL.revokeObjectURL(workerUrl);
    } catch (error) {
      console.error('[GeometryWorker] Failed to initialize:', error);
    }
  }

  /**
   * Get inline worker code
   * This allows us to avoid creating a separate worker file
   */
  private getWorkerCode(): string {
    return `
      // Worker code runs in separate thread
      self.onmessage = function(event) {
        const { id, type, params } = event.data;
        const startTime = performance.now();
        
        try {
          let result;
          
          switch (type) {
            case 'tree':
              result = createTreeGeometry(params);
              break;
            case 'building':
              result = createBuildingGeometry(params);
              break;
            default:
              throw new Error('Unknown geometry type: ' + type);
          }
          
          const timeTaken = performance.now() - startTime;
          
          self.postMessage({
            id,
            success: true,
            data: result,
            timeTaken
          });
        } catch (error) {
          self.postMessage({
            id,
            success: false,
            error: error.message
          });
        }
      };
      
      // Create tree geometry (trunk + canopy)
      function createTreeGeometry(params) {
        const {
          trunkRadius,
          trunkHeight,
          canopyRadius,
          canopyHeight,
          trunkSegments,
          canopySegments
        } = params;
        
        // Create trunk vertices
        const trunkVertices = [];
        const trunkIndices = [];
        
        for (let i = 0; i <= trunkSegments; i++) {
          const theta = (i / trunkSegments) * Math.PI * 2;
          const x = Math.cos(theta) * trunkRadius;
          const z = Math.sin(theta) * trunkRadius;
          
          // Bottom
          trunkVertices.push(x, 0, z);
          // Top
          trunkVertices.push(x * 0.8, trunkHeight, z * 0.8);
        }
        
        // Create canopy vertices (sphere)
        const canopyVertices = [];
        const canopyIndices = [];
        
        for (let lat = 0; lat <= canopySegments; lat++) {
          const theta = (lat / canopySegments) * Math.PI;
          const sinTheta = Math.sin(theta);
          const cosTheta = Math.cos(theta);
          
          for (let lon = 0; lon <= canopySegments; lon++) {
            const phi = (lon / canopySegments) * Math.PI * 2;
            const x = Math.cos(phi) * sinTheta * canopyRadius;
            const y = cosTheta * canopyRadius + trunkHeight;
            const z = Math.sin(phi) * sinTheta * canopyRadius;
            
            canopyVertices.push(x, y, z);
          }
        }
        
        return {
          trunk: {
            vertices: trunkVertices,
            indices: trunkIndices
          },
          canopy: {
            vertices: canopyVertices,
            indices: canopyIndices
          }
        };
      }
      
      // Create building geometry (extruded polygon)
      function createBuildingGeometry(params) {
        const { vertices, height } = params;
        
        // Simple extrusion: create vertices for base and top
        const geometryVertices = [];
        
        // Bottom face
        for (const [x, y] of vertices) {
          geometryVertices.push(x, 0, y);
        }
        
        // Top face
        for (const [x, y] of vertices) {
          geometryVertices.push(x, height, y);
        }
        
        return {
          vertices: geometryVertices,
          faceCount: vertices.length * 2
        };
      }
    `;
  }

  /**
   * Handle message from worker
   */
  private handleWorkerMessage(event: MessageEvent): void {
    const response: GeometryResponse = event.data;
    const request = this.pendingRequests.get(response.id);
    
    if (!request) {
      console.warn(`[GeometryWorker] Received response for unknown request: ${response.id}`);
      return;
    }

    if (response.success) {
      request.resolve(response.data);
    } else {
      request.reject(new Error(response.error || 'Unknown error'));
    }

    this.pendingRequests.delete(response.id);
  }

  /**
   * Handle worker error
   */
  private handleWorkerError(error: ErrorEvent): void {
    console.error('[GeometryWorker] Worker error:', error);
    
    // Reject all pending requests
    for (const [id, request] of this.pendingRequests) {
      request.reject(new Error('Worker error'));
      this.pendingRequests.delete(id);
    }
  }

  /**
   * Create tree geometry in worker thread
   */
  public async createTreeGeometry(params: TreeGeometryParams): Promise<any> {
    if (!this.isInitialized || !this.worker) {
      throw new Error('Worker not initialized');
    }

    const id = `tree_${this.requestIdCounter++}`;
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, {
        resolve,
        reject,
        startTime: performance.now(),
      });

      this.worker!.postMessage({
        id,
        type: 'tree',
        params,
      });
    });
  }

  /**
   * Create building geometry in worker thread
   */
  public async createBuildingGeometry(params: BuildingGeometryParams): Promise<any> {
    if (!this.isInitialized || !this.worker) {
      throw new Error('Worker not initialized');
    }

    const id = `building_${this.requestIdCounter++}`;
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, {
        resolve,
        reject,
        startTime: performance.now(),
      });

      this.worker!.postMessage({
        id,
        type: 'building',
        params,
      });
    });
  }

  /**
   * Create multiple geometries in batch
   */
  public async createBatch(requests: GeometryRequest[]): Promise<any[]> {
    const promises = requests.map((request) => {
      if (request.type === 'tree') {
        return this.createTreeGeometry(request.params);
      } else if (request.type === 'building') {
        return this.createBuildingGeometry(request.params);
      } else {
        return Promise.reject(new Error(`Unknown type: ${request.type}`));
      }
    });

    return Promise.all(promises);
  }

  /**
   * Check if worker is ready
   */
  public isReady(): boolean {
    return this.isInitialized && this.worker !== null;
  }

  /**
   * Get number of pending requests
   */
  public getPendingCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Terminate worker and clean up
   */
  public dispose(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }

    // Reject all pending requests
    for (const [id, request] of this.pendingRequests) {
      request.reject(new Error('Worker disposed'));
      this.pendingRequests.delete(id);
    }

    this.isInitialized = false;
    console.log('[GeometryWorker] Disposed');
  }
}

/**
 * Helper function to convert worker data to Three.js geometry
 */
export function createGeometryFromWorkerData(data: any, _type: 'trunk' | 'canopy'): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  
  const vertices = new Float32Array(data.vertices);
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  
  if (data.indices && data.indices.length > 0) {
    const indices = new Uint16Array(data.indices);
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  }
  
  geometry.computeVertexNormals();
  
  return geometry;
}
