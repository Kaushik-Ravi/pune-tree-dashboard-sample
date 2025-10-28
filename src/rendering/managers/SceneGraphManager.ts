// src/rendering/managers/SceneGraphManager.ts

/**
 * Scene graph organization and management
 * Maintains logical grouping of scene objects for efficient operations
 * 
 * Features:
 * - Logical grouping (trees, buildings, terrain, etc.)
 * - Batch add/remove operations
 * - Hierarchy management
 * - Memory-efficient disposal
 */

import * as THREE from 'three';

/**
 * Scene group categories
 */
export type SceneGroupType = 'trees' | 'buildings' | 'terrain' | 'lights' | 'helpers' | 'effects';

/**
 * Statistics for a scene group
 */
export interface GroupStats {
  name: string;
  objectCount: number;
  visible: boolean;
  childGroups: string[];
}

export class SceneGraphManager {
  private scene: THREE.Scene;
  private groups: Map<SceneGroupType, THREE.Group> = new Map();
  
  // Track object counts for performance
  private objectCounts: Map<SceneGroupType, number> = new Map();
  
  /**
   * Initialize scene graph manager
   */
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.initializeGroups();
    
    console.log('✅ [SceneGraphManager] Initialized with groups:', Array.from(this.groups.keys()));
  }
  
  /**
   * Create standard scene groups
   */
  private initializeGroups(): void {
    const groupTypes: SceneGroupType[] = ['trees', 'buildings', 'terrain', 'lights', 'helpers', 'effects'];
    
    groupTypes.forEach(type => {
      const group = new THREE.Group();
      group.name = `group-${type}`;
      group.userData.type = type;
      
      this.scene.add(group);
      this.groups.set(type, group);
      this.objectCounts.set(type, 0);
    });
  }
  
  /**
   * Add object to a specific group
   */
  addToGroup(groupType: SceneGroupType, object: THREE.Object3D): void {
    const group = this.groups.get(groupType);
    
    if (!group) {
      console.error(`❌ [SceneGraphManager] Group '${groupType}' not found`);
      return;
    }
    
    group.add(object);
    
    // Update count
    const currentCount = this.objectCounts.get(groupType) || 0;
    this.objectCounts.set(groupType, currentCount + 1);
  }
  
  /**
   * Add multiple objects to a group at once
   */
  addMultipleToGroup(groupType: SceneGroupType, objects: THREE.Object3D[]): void {
    const group = this.groups.get(groupType);
    
    if (!group) {
      console.error(`❌ [SceneGraphManager] Group '${groupType}' not found`);
      return;
    }
    
    objects.forEach(obj => group.add(obj));
    
    // Update count
    const currentCount = this.objectCounts.get(groupType) || 0;
    this.objectCounts.set(groupType, currentCount + objects.length);
    
    console.log(`📦 [SceneGraphManager] Added ${objects.length} objects to '${groupType}'`);
  }
  
  /**
   * Remove object from a group
   */
  removeFromGroup(groupType: SceneGroupType, object: THREE.Object3D): void {
    const group = this.groups.get(groupType);
    
    if (!group) {
      console.error(`❌ [SceneGraphManager] Group '${groupType}' not found`);
      return;
    }
    
    group.remove(object);
    
    // Update count
    const currentCount = this.objectCounts.get(groupType) || 0;
    this.objectCounts.set(groupType, Math.max(0, currentCount - 1));
  }
  
  /**
   * Clear all objects from a group
   */
  clearGroup(groupType: SceneGroupType, disposeGeometry = true, disposeMaterial = true): void {
    const group = this.groups.get(groupType);
    
    if (!group) {
      console.error(`❌ [SceneGraphManager] Group '${groupType}' not found`);
      return;
    }
    
    const objectCount = group.children.length;
    
    if (disposeGeometry || disposeMaterial) {
      // Dispose resources
      group.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          if (disposeGeometry && obj.geometry) {
            obj.geometry.dispose();
          }
          
          if (disposeMaterial && obj.material) {
            if (Array.isArray(obj.material)) {
              obj.material.forEach(mat => mat.dispose());
            } else {
              obj.material.dispose();
            }
          }
        }
      });
    }
    
    // Clear children
    group.clear();
    this.objectCounts.set(groupType, 0);
    
    console.log(`🗑️ [SceneGraphManager] Cleared '${groupType}' (${objectCount} objects)`);
  }
  
  /**
   * Get a specific group
   */
  getGroup(groupType: SceneGroupType): THREE.Group | undefined {
    return this.groups.get(groupType);
  }
  
  /**
   * Get all objects in a group
   */
  getGroupObjects(groupType: SceneGroupType): THREE.Object3D[] {
    const group = this.groups.get(groupType);
    return group ? [...group.children] : [];
  }
  
  /**
   * Get object count in a group
   */
  getGroupObjectCount(groupType: SceneGroupType): number {
    return this.objectCounts.get(groupType) || 0;
  }
  
  /**
   * Show/hide a group
   */
  setGroupVisible(groupType: SceneGroupType, visible: boolean): void {
    const group = this.groups.get(groupType);
    
    if (group) {
      group.visible = visible;
      console.log(`👁️ [SceneGraphManager] Group '${groupType}' visible: ${visible}`);
    }
  }
  
  /**
   * Check if a group is visible
   */
  isGroupVisible(groupType: SceneGroupType): boolean {
    const group = this.groups.get(groupType);
    return group ? group.visible : false;
  }
  
  /**
   * Get statistics for a group
   */
  getGroupStats(groupType: SceneGroupType): GroupStats | null {
    const group = this.groups.get(groupType);
    
    if (!group) return null;
    
    // Count child groups
    const childGroups: string[] = [];
    group.traverse(obj => {
      if (obj instanceof THREE.Group && obj !== group) {
        childGroups.push(obj.name);
      }
    });
    
    return {
      name: group.name,
      objectCount: this.getGroupObjectCount(groupType),
      visible: group.visible,
      childGroups
    };
  }
  
  /**
   * Get statistics for all groups
   */
  getAllGroupStats(): Map<SceneGroupType, GroupStats> {
    const stats = new Map<SceneGroupType, GroupStats>();
    
    this.groups.forEach((_, type) => {
      const groupStats = this.getGroupStats(type);
      if (groupStats) {
        stats.set(type, groupStats);
      }
    });
    
    return stats;
  }
  
  /**
   * Get total object count across all groups
   */
  getTotalObjectCount(): number {
    let total = 0;
    this.objectCounts.forEach(count => {
      total += count;
    });
    return total;
  }
  
  /**
   * Apply transform to entire group
   */
  transformGroup(groupType: SceneGroupType, transform: {
    position?: THREE.Vector3;
    rotation?: THREE.Euler;
    scale?: THREE.Vector3;
  }): void {
    const group = this.groups.get(groupType);
    
    if (!group) return;
    
    if (transform.position) {
      group.position.copy(transform.position);
    }
    
    if (transform.rotation) {
      group.rotation.copy(transform.rotation);
    }
    
    if (transform.scale) {
      group.scale.copy(transform.scale);
    }
    
    group.updateMatrix();
  }
  
  /**
   * Traverse all objects in a group
   */
  traverseGroup(groupType: SceneGroupType, callback: (object: THREE.Object3D) => void): void {
    const group = this.groups.get(groupType);
    
    if (group) {
      group.traverse(callback);
    }
  }
  
  /**
   * Log scene graph structure
   */
  logStructure(): void {
    console.group('🌳 Scene Graph Structure');
    
    this.groups.forEach((_, type) => {
      const stats = this.getGroupStats(type);
      console.log(`${type}:`, {
        objects: stats?.objectCount,
        visible: stats?.visible,
        children: stats?.childGroups.length
      });
    });
    
    console.log('Total objects:', this.getTotalObjectCount());
    console.groupEnd();
  }
  
  /**
   * Dispose all groups and resources
   */
  dispose(): void {
    console.log('🧹 [SceneGraphManager] Disposing...');
    
    // Clear all groups with resource disposal
    this.groups.forEach((_, type) => {
      this.clearGroup(type, true, true);
    });
    
    // Remove groups from scene
    this.groups.forEach(group => {
      this.scene.remove(group);
    });
    
    // Clear maps
    this.groups.clear();
    this.objectCounts.clear();
    
    console.log('✅ [SceneGraphManager] Disposed');
  }
}
