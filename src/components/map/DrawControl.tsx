// src/components/map/DrawControl.tsx
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import { useControl } from "react-map-gl";

// Default styles conforming to the new expression syntax to prevent crashes
const defaultDrawStyles = [
  // ACTIVE (being drawn)
  {
    "id": "gl-draw-line", "type": "line",
    "filter": ["all", ["==", "$type", "LineString"], ["!=", "mode", "static"]],
    "layout": { "line-cap": "round", "line-join": "round" },
    "paint": { "line-color": "#D20C0C", "line-dasharray": [0.2, 2], "line-width": 2 }
  },
  {
    "id": "gl-draw-polygon-fill", "type": "fill",
    "filter": ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
    "paint": { "fill-color": "#D20C0C", "fill-outline-color": "#D20C0C", "fill-opacity": 0.1 }
  },
  {
    "id": "gl-draw-polygon-stroke-active", "type": "line",
    "filter": ["all", ["==", "$type", "Polygon"], ["!=", "mode", "static"]],
    "layout": { "line-cap": "round", "line-join": "round" },
    "paint": { "line-color": "#D20C0C", "line-dasharray": [0.2, 2], "line-width": 2 }
  },
  {
    "id": "gl-draw-polygon-and-line-vertex-halo-active", "type": "circle",
    "filter": ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"], ["!=", "mode", "static"]],
    "paint": { "circle-radius": 5, "circle-color": "#FFF" }
  },
  {
    "id": "gl-draw-polygon-and-line-vertex-active", "type": "circle",
    "filter": ["all", ["==", "meta", "vertex"], ["==", "$type", "Point"], ["!=", "mode", "static"]],
    "paint": { "circle-radius": 3, "circle-color": "#D20C0C", }
  },
  // INACTIVE (static)
  {
    "id": "gl-draw-line-static", "type": "line",
    "filter": ["all", ["==", "$type", "LineString"], ["==", "mode", "static"]],
    "layout": { "line-cap": "round", "line-join": "round" },
    "paint": { "line-color": "#000", "line-width": 3 }
  },
  {
    "id": "gl-draw-polygon-fill-static", "type": "fill",
    "filter": ["all", ["==", "$type", "Polygon"], ["==", "mode", "static"]],
    "paint": { "fill-color": "#000", "fill-outline-color": "#000", "fill-opacity": 0.1 }
  },
  {
    "id": "gl-draw-polygon-stroke-static", "type": "line",
    "filter": ["all", ["==", "$type", "Polygon"], ["==", "mode", "static"]],
    "layout": { "line-cap": "round", "line-join": "round" },
    "paint": { "line-color": "#000", "line-width": 3 }
  }
];

type DrawControlProps = Omit<ConstructorParameters<typeof MapboxDraw>[0], 'styles'> & {
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  onDrawCreate: (evt: { features: any[] }) => void;
  onDrawUpdate: (evt: { features: any[], action: string }) => void;
  onDrawDelete: (evt: { features: any[] }) => void;
};

export default function DrawControl(props: DrawControlProps) {
  useControl(
    () => new MapboxDraw({ ...props, styles: defaultDrawStyles }) as any, // <-- THE DEFINITIVE FIX
    ({ map }: { map: any }) => {
      map.on("draw.create", props.onDrawCreate);
      map.on("draw.update", props.onDrawUpdate);
      map.on("draw.delete", props.onDrawDelete);
    },
    ({ map }: { map: any }) => {
      map.off("draw.create", props.onDrawCreate);
      map.off("draw.update", props.onDrawUpdate);
      map.off("draw.delete", props.onDrawDelete);
    },
    { position: props.position }
  );
  return null;
}