// src/rendering/types/Events.ts

/**
 * Event system types for the rendering manager
 * Provides type-safe event handling across the rendering pipeline
 */

import type { RenderConfig, PerformanceMetrics, SunConfig } from './RenderConfig';

/**
 * All possible event types in the rendering system
 */
export type RenderingEventType =
  | 'initialized'
  | 'disposed'
  | 'config:changed'
  | 'sun:updated'
  | 'scene:ready'
  | 'trees:loaded'
  | 'trees:updated'
  | 'buildings:loaded'
  | 'buildings:updated'
  | 'terrain:loaded'
  | 'terrain:updated'
  | 'performance:update'
  | 'error'
  | 'warning';

/**
 * Event payload types for each event
 */
export interface RenderingEventPayloads {
  'initialized': void;
  'disposed': void;
  'config:changed': { config: RenderConfig };
  'sun:updated': { sun: SunConfig };
  'scene:ready': { objectCount: number };
  'trees:loaded': { count: number; duration: number };
  'trees:updated': { added: number; removed: number; total: number };
  'buildings:loaded': { count: number; duration: number };
  'buildings:updated': { added: number; removed: number; total: number };
  'terrain:loaded': { vertices: number; duration: number };
  'terrain:updated': { vertices: number };
  'performance:update': { metrics: PerformanceMetrics };
  'error': { error: Error; context?: string };
  'warning': { message: string; context?: string };
}

/**
 * Type-safe event listener function
 */
export type RenderingEventListener<T extends RenderingEventType> = (
  payload: RenderingEventPayloads[T]
) => void;

/**
 * Event emitter interface for rendering system
 */
export interface RenderingEventEmitter {
  on<T extends RenderingEventType>(
    event: T,
    listener: RenderingEventListener<T>
  ): void;
  
  once<T extends RenderingEventType>(
    event: T,
    listener: RenderingEventListener<T>
  ): void;
  
  off<T extends RenderingEventType>(
    event: T,
    listener: RenderingEventListener<T>
  ): void;
  
  emit<T extends RenderingEventType>(
    event: T,
    payload: RenderingEventPayloads[T]
  ): void;
}
