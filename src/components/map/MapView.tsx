// src/components/map/MapView.tsx
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import Map, {
  Source,
  Layer,
  ScaleControl,
  MapRef,
  NavigationControl,
  MapLayerMouseEvent,
  MapLayerTouchEvent,
} from 'react-map-gl/maplibre';
import type { LayerProps } from 'react-map-gl/maplibre';
import { ChevronLeft, ChevronRight, LayoutDashboard } from 'lucide-react';
import { useTreeStore } from '../../store/TreeStore';
import SimulatedTreesLayer from './SimulatedTreesLayer';
import DrawControl, { DrawEvent, DrawActionEvent } from './DrawControl';
import MapboxDraw from 'maplibre-gl-draw';
import ViewModeToggle from './ViewModeToggle';
import ThreeDTreesLayer from './ThreeDTreesLayer';
import { RealisticShadowLayer } from './RealisticShadowLayer';
import { LightConfig } from '../sidebar/tabs/LightAndShadowControl';
import { ShadowQuality } from '../sidebar/tabs/MapLayers';

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
  shadowsEnabled: boolean;
  shadowQuality?: ShadowQuality;
  showTreeShadows?: boolean;
  showBuildingShadows?: boolean;
  renderMode?: 'basic' | 'realistic';
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
  shadowsEnabled,
  shadowQuality = 'high',
  showTreeShadows: _showTreeShadows = true,
  showBuildingShadows: _showBuildingShadows = true,
  renderMode = 'basic', // Default to basic mode
}) => {
  const mapRef = useRef<MapRef | null>(null);
  const { setSelectedArea } = useTreeStore();
  const drawControlRef = useRef<{ draw: MapboxDraw } | null>(null);
  const [zoom, setZoom] = useState(11.5);
  const [viewBounds, setViewBounds] = useState(null);
  const isDraggingRef = useRef(false);
  const [isLoading3DTrees, setIsLoading3DTrees] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');

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
        // Remove existing terrain source if it exists to prevent conflicts
        if (map.getSource(terrainSourceName)) {
          map.setTerrain(null);
          map.removeSource(terrainSourceName);
        }
        
        // Add fresh terrain source
        map.addSource(terrainSourceName, {
          type: 'raster-dem',
          url: `https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=${mapTilerKey}`,
          tileSize: 256,
        });
        
        map.setTerrain({ source: terrainSourceName, exaggeration: 1.5 });

        if (lightConfig) {
          map.setLight(lightConfig.directional);
        } else {
          map.setLight({ anchor: 'viewport', position: [1.5, 180, 60], intensity: 0.5 });
        }
        
        // Apply fog configuration only if setFog method exists
        if (lightConfig && typeof (map as any).setFog === 'function') {
          try {
            const fogConfig = {
              'color': 'rgb(186, 210, 235)',
              'high-color': 'rgb(36, 92, 223)',
              'horizon-blend': 0.05,
              'space-color': 'rgb(11, 11, 25)',
              'star-intensity': Math.max(0, 1 - lightConfig.ambientIntensity * 5)
            };
            (map as any).setFog(fogConfig);
          } catch (error) {
            console.warn('Fog not supported in this MapLibre GL version:', error);
          }
        }
      } else {
        // Proper cleanup when disabling 3D
        map.setTerrain(null);
        if (map.getSource(terrainSourceName)) {
          map.removeSource(terrainSourceName);
        }
        // Reset light to default
        map.setLight({ anchor: 'viewport', position: [1.5, 180, 60], intensity: 0.5 });
        // Remove fog safely
        if (typeof (map as any).setFog === 'function') {
          try {
            (map as any).setFog(null);
          } catch (error) {
            console.warn('Could not remove fog:', error);
          }
        }
      }
    };

    if (map.isStyleLoaded()) {
      setup3DEnvironment();
    } else {
      map.once('styledata', setup3DEnvironment);
    }

  }, [is3D, lightConfig, mapTilerKey]);

  const handleToggle3D = useCallback(async () => {
    const map = mapRef.current;
    if (!map) return;

    onToggle3D();

    if (!is3D) {
      if (baseMap !== 'streets') {
        changeBaseMap('streets');
      }
      
      // Show delightful loading message
      setLoadingMessage('🌳 Creating your 3D forest...');
      
      const currentBounds = map.getBounds();
      setViewBounds({
          sw: [currentBounds.getWest(), currentBounds.getSouth()],
          ne: [currentBounds.getEast(), currentBounds.getNorth()],
      } as any);
      
      setTimeout(() => {
        map.flyTo({ pitch: 60, zoom: 17.5, duration: 1500, essential: true });
        setTimeout(() => setLoadingMessage(''), 2000);
      }, 100);
    } else {
      setViewBounds(null);
      setLoadingMessage('');
      map.flyTo({ pitch: 0, zoom: map.getZoom() < 16 ? map.getZoom() : 16, duration: 1500, essential: true });
    }
  }, [is3D, onToggle3D, baseMap, changeBaseMap]);
  
  // Update bounds dynamically when map moves in 3D mode
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map || !is3D) return;

    const updateBounds = () => {
      const currentBounds = map.getBounds();
      setViewBounds({
        sw: [currentBounds.getWest(), currentBounds.getSouth()],
        ne: [currentBounds.getEast(), currentBounds.getNorth()],
      } as any);
    };

    // Update bounds when map finishes moving
    map.on('moveend', updateBounds);
    
    return () => {
      map.off('moveend', updateBounds);
    };
  }, [is3D]);
  
  const handleLoading3DChange = useCallback((loading: boolean) => {
    setIsLoading3DTrees(loading);
    if (loading) {
      const messages = [
        '🌲 Planting your digital forest...',
        '🏙️ Building your 3D city...',
        '✨ Rendering nature in 3D...',
        '🌍 Creating your urban canopy...',
      ];
      setLoadingMessage(messages[Math.floor(Math.random() * messages.length)]);
    } else {
      setTimeout(() => setLoadingMessage(''), 500);
    }
  }, []);

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

  const handleMapClick = useCallback((event: MapLayerMouseEvent | MapLayerTouchEvent) => {
    event.preventDefault();
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
    if (is3D) return;
    const map = mapRef.current?.getMap();
    if (!map) return;
    const treeFeature = event.features?.find(f => f.layer.id === treeLayerStyle.id);
    map.getCanvas().style.cursor = treeFeature ? 'pointer' : '';
    map.setFilter('trees-point-highlight', ['==', 'Tree_ID', treeFeature ? treeFeature.properties.Tree_ID : '']);
  }, [is3D]);
  
  const handleDragStart = useCallback(() => {
    isDraggingRef.current = true;
  }, []);
  
  const handleDragEnd = useCallback(() => {
    isDraggingRef.current = false;
  }, []);
  
  const handleTouchEnd = useCallback((event: MapLayerTouchEvent) => {
    if (!isDraggingRef.current) {
      handleMapClick(event);
    }
  }, [handleMapClick]);

  const interactiveLayers = useMemo(() => {
    const layers = [treeLayerStyle.id];
    if (is3D) {
      layers.push('tree-trunks-3d', 'tree-canopies-3d');
    }
    return layers.filter(Boolean) as string[];
  }, [is3D]);

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
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onTouchEnd={handleTouchEnd}
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
        
        {/* Basic 3D mode - fast, no realistic shadows */}
        {is3D && renderMode === 'basic' && (
          <ThreeDTreesLayer 
            bounds={viewBounds} 
            selectedTreeId={selectedTreeId}
            shadowsEnabled={shadowsEnabled}
            zoom={zoom}
            onLoadingChange={handleLoading3DChange}
          />
        )}
        
        {/* Realistic 3D mode - beautiful, accurate sun-based shadows */}
        {is3D && renderMode === 'realistic' && shadowsEnabled && mapRef.current && (
          <RealisticShadowLayer
            map={mapRef.current.getMap()}
            enabled={true}
            shadowQuality={shadowQuality || 'high'}
            maxVisibleTrees={5000}
            latitude={18.5204} // Pune, India
            longitude={73.8567}
            dateTime={new Date()} // Uses current date/time for sun position
            onPerformanceUpdate={(fps) => {
              // Optional: handle performance metrics
              if (fps < 30) {
                console.warn('Low FPS detected:', fps);
              }
            }}
          />
        )}

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
      
      <div data-tour-id="view-mode-toggle">
        <ViewModeToggle is3D={is3D} onToggle={handleToggle3D} zoom={zoom} />
      </div>
      
      {/* Loading indicator for 3D trees */}
      {(isLoading3DTrees || loadingMessage) && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 z-30 bg-primary-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center space-x-2 animate-fade-in">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          <span className="font-medium">{loadingMessage}</span>
        </div>
      )}
      
      {/* --- DESKTOP-ONLY SIDEBAR TOGGLE --- */}
      <button
        data-tour-id="sidebar-toggle-desktop"
        className={`hidden md:flex absolute top-1/2 -translate-y-1/2 z-20 bg-white p-2 shadow-xl hover:bg-gray-100 transition-all duration-300 ease-in-out border-t border-b border-gray-300 ${sidebarOpen ? 'right-[var(--sidebar-width)] rounded-l-md' : 'right-0 rounded-r-md'}`}
        onClick={toggleSidebar}
        aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
        title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {sidebarOpen ? <ChevronRight size={20} className="text-gray-700" /> : <ChevronLeft size={20} className="text-gray-700" />}
      </button>

      {/* --- MOBILE-ONLY FAB TO OPEN BOTTOM SHEET --- */}
      <button
        data-tour-id="sidebar-toggle-mobile"
        onClick={toggleSidebar}
        className="md:hidden absolute bottom-5 right-5 z-20 bg-primary-600 text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center hover:bg-primary-700 active:bg-primary-800 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
        aria-label="Open dashboard"
        title="Open dashboard"
      >
        <LayoutDashboard size={24} />
      </button>
    </div>
  );
};

export default MapView;