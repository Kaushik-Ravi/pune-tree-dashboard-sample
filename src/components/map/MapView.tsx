// src/components/map/MapView.tsx
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Map, {
  Source,
  Layer,
  ScaleControl,
  MapRef,
  NavigationControl,
  MapLayerMouseEvent,
  ViewStateChangeEvent,
} from 'react-map-gl/maplibre';
import type { LayerProps } from 'react-map-gl/maplibre';
import type { Fog } from 'maplibre-gl';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTreeStore } from '../../store/TreeStore';
import SimulatedTreesLayer from './SimulatedTreesLayer';
import DrawControl, { DrawEvent, DrawActionEvent } from './DrawControl';
import MapboxDraw from 'maplibre-gl-draw';
import ViewModeToggle from './ViewModeToggle';
import ThreeDTreesLayer from './ThreeDTreesLayer';
import { LightConfig } from '../sidebar/tabs/LightAndShadowControl';

const treeLayerStyle: LayerProps = {
  id: 'trees-point',
  type: 'circle',
  source: 'trees',
  'source-layer': 'trees',
  paint: {
    'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 2, 22, 8],
    'circle-color': '#2E7D32',
    'circle-stroke-width': 1,
    'circle-stroke-color': '#ffffff',
    'circle-opacity': 0.8,
  },
};

const treeLayerHighlightStyle: LayerProps = {
  id: 'trees-point-highlight',
  type: 'circle',
  source: 'trees',
  'source-layer': 'trees',
  paint: { 'circle-radius': 7, 'circle-color': '#ffc107', 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' },
  filter: ['==', 'Tree_ID', ''],
};

const buildings3DLayerStyle: LayerProps = {
    id: '3d-buildings',
    source: 'maptiler',
    'source-layer': 'building',
    type: 'fill-extrusion',
    minzoom: 15,
    paint: {
        'fill-extrusion-color': '#d6d2d2',
        'fill-extrusion-height': ['get', 'render_height'],
        'fill-extrusion-base': ['get', 'render_min_height'],
        'fill-extrusion-opacity': 0.7,
    }
};

interface MapViewProps {
  onTreeSelect: (treeId: string) => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  baseMap: string;
  changeBaseMap: (mapType: string) => void;
  showLSTOverlay: boolean;
  selectedTreeId: string | null;
  is3D: boolean;
  onToggle3D: () => void;
  lightConfig: LightConfig | null;
}

const MapView: React.FC<MapViewProps> = ({
  onTreeSelect,
  sidebarOpen,
  toggleSidebar,
  baseMap,
  changeBaseMap,
  showLSTOverlay,
  selectedTreeId,
  is3D,
  onToggle3D,
  lightConfig,
}) => {
  const mapRef = useRef<MapRef | null>(null);
  const { setSelectedArea } = useTreeStore();
  const drawControlRef = useRef<{ draw: MapboxDraw } | null>(null);
  const [zoom, setZoom] = useState(11.5);
  const [mapBounds, setMapBounds] = useState<{ sw: [number, number]; ne: [number, number] } | null>(null);
  
  const mapTilerKey = import.meta.env.VITE_MAPTILER_KEY;
  const getMapStyle = (style: string) => {
    const styleName = style === 'satellite' ? 'satellite' : style === 'dark' ? 'darkmatter' : style === 'streets' ? 'streets-v2' : 'dataviz-light';
    return `https://api.maptiler.com/maps/${styleName}/style.json?key=${mapTilerKey}`;
  };
  const mapStyleUrl = getMapStyle(baseMap);

  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;
  
    const terrainSourceName = 'maptiler-terrain';
  
    const setup3DEnvironment = () => {
      if (is3D) {
        if (!map.getSource(terrainSourceName)) {
          map.addSource(terrainSourceName, {
            type: 'raster-dem',
            url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${mapTilerKey}`,
            tileSize: 256,
          });
        }
        map.setTerrain({ source: terrainSourceName, exaggeration: 1.5 });
  
        if (lightConfig) {
          map.setLight(lightConfig.directional);
        } else {
          map.setLight({ anchor: 'viewport', position: [1.5, 180, 60], intensity: 0.5 });
        }
      } else {
        map.setTerrain(null);
      }
    };
  
    if (map.isStyleLoaded()) {
      setup3DEnvironment();
    } else {
      map.once('styledata', setup3DEnvironment);
    }
  
  }, [is3D, lightConfig, mapTilerKey, mapStyleUrl]);

  const fog = useMemo((): Fog | undefined => {
    if (!is3D || !lightConfig) {
      return undefined;
    }
    return {
      'color': 'rgb(186, 210, 235)',
      'high-color': 'rgb(36, 92, 223)',
      'horizon-blend': 0.05,
      'space-color': 'rgb(11, 11, 25)',
      'star-intensity': Math.max(0, 1 - lightConfig.ambientIntensity * 5)
    };
  }, [is3D, lightConfig]);
  
  const handleToggle3D = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    onToggle3D();

    if (!is3D) { // Transitioning TO 3D
      if (baseMap !== 'streets') {
        changeBaseMap('streets');
      }
      setTimeout(() => {
        map.flyTo({ pitch: 60, zoom: 17.5, duration: 2000, essential: true });
        const bounds = map.getBounds();
        setMapBounds({
          sw: [bounds.getWest(), bounds.getSouth()],
          ne: [bounds.getEast(), bounds.getNorth()],
        });
      }, 100);
    } else { // Transitioning TO 2D
      map.flyTo({ pitch: 0, zoom: map.getZoom() < 16 ? map.getZoom() : 16, duration: 2000, essential: true });
    }
  }, [is3D, onToggle3D, baseMap, changeBaseMap]);

  const handleMoveEnd = useCallback((e: ViewStateChangeEvent) => {
    if (is3D && e.viewState.zoom >= 16) {
      const map = mapRef.current;
      if (map) {
          const bounds = map.getBounds();
          setMapBounds({
            sw: [bounds.getWest(), bounds.getSouth()],
            ne: [bounds.getEast(), bounds.getNorth()],
          });
      }
    }
  }, [is3D]);

  const onDrawCreate = useCallback((evt: DrawEvent) => {
    const feature = evt.features[0];
    if (feature) {
      const draw = drawControlRef.current?.draw;
      if (draw) {
        const allFeatures = draw.getAll();
        const idsToDelete = allFeatures.features
          .map(f => f.id)
          .filter(id => id && id !== feature.id);
        if (idsToDelete.length > 0) { draw.delete(idsToDelete as string[]); }
      }
      setSelectedArea({ type: 'geojson', geojsonData: feature as any });
    }
  }, [setSelectedArea]);

  const onDrawUpdate = useCallback((evt: DrawActionEvent) => {
    const feature = evt.features[0];
    if (feature) {
      setSelectedArea({ type: 'geojson', geojsonData: feature as any });
    }
  }, [setSelectedArea]);

  const onDrawDelete = useCallback(() => { setSelectedArea(null); }, [setSelectedArea]);

  const lstImageBounds: [[number, number], [number, number], [number, number], [number, number]] = [
    [73.7606651, 18.62786903], [73.96308303, 18.62786903],
    [73.96308303, 18.41668612], [73.7606651, 18.41668612],
  ];
  const lstImageUrl = './lst_pune.png';

  const PUNE_TREES_TILESET_ID = '0197f37a-c205-7e6f-8c64-151bca4d9195';
  const vectorSourceUrl = `https://api.maptiler.com/tiles/${PUNE_TREES_TILESET_ID}/tiles.json?key=${mapTilerKey}`;

  const handleMapClick = useCallback((event: MapLayerMouseEvent) => {
    const features = event.features;
    if (!features || features.length === 0) return;

    if (is3D) {
      const threeDFeature = features.find(f => f.layer.id === 'tree-canopies-3d' || f.layer.id === 'tree-trunks-3d');
      if (threeDFeature && threeDFeature.properties?.id) {
        onTreeSelect(threeDFeature.properties.id);
      }
    } else {
      const treeFeature = features.find(f => f.layer.id === treeLayerStyle.id);
      if (treeFeature) {
        onTreeSelect(treeFeature.properties.Tree_ID);
      }
    }
  }, [onTreeSelect, is3D]);

  const handleMouseMove = useCallback((event: MapLayerMouseEvent) => {
    const map = mapRef.current?.getMap();
    if (!map || is3D) return;
    
    const treeFeature = event.features?.find(f => f.layer.id === treeLayerStyle.id);
    map.getCanvas().style.cursor = treeFeature ? 'pointer' : '';
    map.setFilter('trees-point-highlight', ['==', 'Tree_ID', treeFeature ? treeFeature.properties.Tree_ID : '']);
  }, [is3D]);
  
  const interactiveLayers = useMemo(() => {
    const layerIds = [treeLayerStyle.id, 'tree-trunks-3d', 'tree-canopies-3d'];
    return layerIds.filter((id): id is string => typeof id === 'string');
  }, []);

  return (
    <div className="map-container">
      <Map
        ref={mapRef}
        initialViewState={{ longitude: 73.8567, latitude: 18.5204, zoom: 11.5 }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapStyleUrl}
        interactiveLayerIds={interactiveLayers}
        onClick={handleMapClick}
        onMouseMove={handleMouseMove}
        onZoom={(e) => setZoom(e.viewState.zoom)}
        onMoveEnd={handleMoveEnd}
        fog={fog}
      >
        {!is3D && (
            <Source id="trees" type="vector" url={vectorSourceUrl}>
                <Layer {...treeLayerStyle} />
                <Layer {...treeLayerHighlightStyle} />
            </Source>
        )}

        {showLSTOverlay && (
          <Source id="lst-image-source" type="image" url={lstImageUrl} coordinates={lstImageBounds}>
            <Layer id="lst-image-layer" type="raster" source="lst-image-source" paint={{ 'raster-opacity': 0.65 }} />
          </Source>
        )}
        
        {is3D && <Layer {...buildings3DLayerStyle} />}

        {is3D && <ThreeDTreesLayer
          bounds={mapBounds}
          selectedTreeId={selectedTreeId}
          is3D={is3D}
        />}

        <DrawControl
          ref={drawControlRef as any}
          position="top-left"
          displayControlsDefault={false}
          controls={{ polygon: true, trash: true }}
          onCreate={onDrawCreate}
          onUpdate={onDrawUpdate}
          onDelete={onDrawDelete}
        />
        <SimulatedTreesLayer />
        <ScaleControl unit="metric" position="bottom-left" />
        <NavigationControl position="top-left" showCompass={true} />
      </Map>
      
      <ViewModeToggle is3D={is3D} onToggle={handleToggle3D} zoom={zoom} />

      <button
        className={`absolute top-1/2 -translate-y-1/2 z-[1010] bg-white p-2 shadow-xl hover:bg-gray-100 transition-all duration-300 ease-in-out border-t border-b border-gray-300 ${sidebarOpen ? 'right-[var(--sidebar-width)] rounded-r-md' : 'right-0 rounded-l-md'}`}
        onClick={toggleSidebar}
        aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {sidebarOpen ? <ChevronRight size={20} className="text-gray-700" /> : <ChevronLeft size={20} className="text-gray-700" />}
      </button>
    </div>
  );
};

export default MapView;