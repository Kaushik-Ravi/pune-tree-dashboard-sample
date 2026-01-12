// src/components/map/DrawControl.tsx
import MapboxDraw from 'maplibre-gl-draw';
import { useControl, IControl } from 'react-map-gl/maplibre';
import type { ControlPosition } from 'react-map-gl/maplibre';
import type { Feature, Map as MapLibreMap } from 'maplibre-gl';
import { forwardRef, useImperativeHandle, useEffect } from 'react';

// EXPORT: Define authoritative event types to be used by consuming components.
export interface DrawEvent {
  features: Feature[];
  target: MapLibreMap;
  type: string;
}
export interface DrawActionEvent extends DrawEvent {
  action: string;
}

// Props for our component, using the exported event types.
type DrawControlProps = ConstructorParameters<typeof MapboxDraw>[0] & {
  position?: ControlPosition;
  onCreate: (evt: DrawEvent) => void;
  onUpdate: (evt: DrawActionEvent) => void;
  onDelete: (evt: DrawEvent) => void;
};

// This wrapper class correctly implements the IControl interface.
class DrawControlWrapper implements IControl {
  private _draw: MapboxDraw;
  private _props: DrawControlProps;
  private _container: HTMLElement | null = null;

  constructor(props: DrawControlProps) {
    this._props = props;
    this._draw = new MapboxDraw(props);
  }

  onAdd(map: MapLibreMap): HTMLElement {
    map.on('draw.create', this._props.onCreate);
    map.on('draw.update', this._props.onUpdate);
    map.on('draw.delete', this._props.onDelete);
    // FIX: Use type assertion to resolve library version incompatibility.
    this._container = this._draw.onAdd(map as any);
    return this._container;
  }

  onRemove(map: MapLibreMap): void {
    map.off('draw.create', this._props.onCreate);
    map.off('draw.update', this._props.onUpdate);
    map.off('draw.delete', this._props.onDelete);
     // FIX: Use type assertion and pass the map argument.
    this._draw.onRemove(map as any);
    this._container = null;
  }

  public get draw(): MapboxDraw {
    return this._draw;
  }
  
  public get container(): HTMLElement | null {
    return this._container;
  }
}

// FIX: Change ref type to expose the wrapper instance.
const DrawControl = forwardRef<DrawControlWrapper, DrawControlProps>((props, ref) => {
  const ctrl = useControl<DrawControlWrapper>(() => new DrawControlWrapper(props), {
    position: props.position,
  });

  useEffect(() => {
    // Surgically add the data-tour-id attribute after the control has been added to the map.
    // This is the cleanest way to add a tour target to a third-party control.
    const container = ctrl.container;
    if (container) {
      const polygonButton = container.querySelector('.mapbox-gl-draw_polygon');
      if (polygonButton) {
        polygonButton.setAttribute('data-tour-id', 'draw-polygon');
      }
      
      // Add tour ID to trash button for undo/clear functionality
      const trashButton = container.querySelector('.mapbox-gl-draw_trash');
      if (trashButton) {
        trashButton.setAttribute('data-tour-id', 'draw-trash');
      }
    }
  }, [ctrl]);

  useImperativeHandle(ref, () => ctrl, [ctrl]);

  return null;
});

export default DrawControl;