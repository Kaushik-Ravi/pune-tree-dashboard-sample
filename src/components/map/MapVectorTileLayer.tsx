// src/components/map/MapVectorTileLayer.tsx
import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet.vectorgrid';

interface VectorGridClickEvent extends L.LeafletEvent {
    layer: {
        properties: {
            Tree_ID: string;
            [key: string]: any; 
        };
    };
}

interface MapVectorTileLayerProps {
  onTreeSelect: (treeId: string) => void;
}

const MapVectorTileLayer: React.FC<MapVectorTileLayerProps> = ({ onTreeSelect }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    // FIX: This is the definitive URL. The library will fetch this JSON file
    // and then use the tile URL template provided within it. This is the
    // most robust method and matches the URL from your MapTiler dashboard.
    const tileJsonUrl = `https://api.maptiler.com/tiles/0197f37a-c205-7e6f-8c64-151bca4d9195/tiles.json?key=${import.meta.env.VITE_MAPTILER_KEY}`;

    const vectorTileOptions: L.VectorGrid.ProtobufOptions = {
      vectorTileLayerStyles: {
        'trees': {
          fillColor: '#00BCD4',
          fillOpacity: 0.8,
          stroke: true,
          fill: true,
          color: 'white',
          opacity: 1,
          weight: 1,
          radius: 5
        } as any 
      },
      interactive: true,
      getFeatureId: (f: any) => f.properties.Tree_ID, 
    };
    
    const vectorGrid = L.vectorGrid.protobuf(tileJsonUrl, vectorTileOptions);

    vectorGrid.on('click', (e: VectorGridClickEvent) => {
      L.DomEvent.stop(e); 
      const properties = e.layer.properties;
      if (properties && properties.Tree_ID) {
        onTreeSelect(properties.Tree_ID);
      }
    });
    
    vectorGrid.on('error', (e) => {
        console.error('Vector Grid Error:', e);
    });

    vectorGrid.addTo(map);

    return () => {
      map.removeLayer(vectorGrid);
    };
  }, [map, onTreeSelect]);

  return null; 
};

export default MapVectorTileLayer;