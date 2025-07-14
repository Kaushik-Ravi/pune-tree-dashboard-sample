// src/components/map/DrawControl.tsx
import MapboxDraw from "@mapbox/mapbox-gl-draw";
import { useControl } from "react-map-gl";

type DrawControlProps = ConstructorParameters<typeof MapboxDraw>[0] & {
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  onDrawCreate: (evt: { features: any[] }) => void;
  onDrawUpdate: (evt: { features: any[], action: string }) => void;
  onDrawDelete: (evt: { features: any[] }) => void;
};

export default function DrawControl(props: DrawControlProps) {
  useControl(
    () => new MapboxDraw(props),
    ({ map }) => {
      map.on("draw.create", props.onDrawCreate);
      map.on("draw.update", props.onDrawUpdate);
      map.on("draw.delete", props.onDrawDelete);
    },
    ({ map }) => {
      map.off("draw.create", props.onDrawCreate);
      map.off("draw.update", props.onDrawUpdate);
      map.off("draw.delete", props.onDrawDelete);
    },
    {
      position: props.position,
    }
  );

  return null;
}