import React, { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useTreeStore } from '../../store/TreeStore';

interface MapTreeLayerProps {
  onTreeClick: (treeId: string) => void;
}

// This component handles the efficient rendering of tree points
const MapTreeLayer: React.FC<MapTreeLayerProps> = ({ onTreeClick }) => {
  const map = useMap();
  const { trees, fetchTrees } = useTreeStore();

  useEffect(() => {
    // Fetch tree data when the component mounts
    fetchTrees();
    
    // Create a custom pane for tree markers to control the z-index
    if (!map.getPane('treesPane')) {
      map.createPane('treesPane');
      map.getPane('treesPane')!.style.zIndex = '450';
    }

    // Clean up function
    return () => {
      // Clean up code if needed
    };
  }, [map, fetchTrees]);

  useEffect(() => {
    if (!trees.length) return;

    // Clear any existing markers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    // Create a layer group for better performance
    const treeLayerGroup = L.layerGroup().addTo(map);

    // Add tree markers
    trees.forEach((tree) => {
      // Create custom marker
      const marker = L.circleMarker([tree.latitude, tree.longitude], {
        radius: 4,
        fillColor: '#2E7D32',
        color: '#fff',
        weight: 1,
        opacity: 0.8,
        fillOpacity: 0.8,
        pane: 'treesPane'
      });

      // Create popup content
      const popupContent = `
        <div class="tree-popup">
          <h3 class="font-semibold">${tree.common_name}</h3>
          <p class="text-sm text-gray-600">${tree.botanical_name_short}</p>
          <p class="text-sm mt-1">ID: ${tree.id}</p>
          <p class="text-sm">CO₂ Sequestered: ${tree.CO2_sequestered_kg.toFixed(2)} kg</p>
          <button 
            class="mt-2 px-3 py-1 bg-primary-600 text-white text-sm rounded hover:bg-primary-700 view-details-btn"
            data-tree-id="${tree.id}"
          >
            View Details
          </button>
        </div>
      `;

      const popup = L.popup().setContent(popupContent);
      
      marker.bindPopup(popup);
      marker.addTo(treeLayerGroup);
      
      // Handle marker click
      marker.on('click', () => {
        // The actual tree selection happens when the button in the popup is clicked
      });
    });

    // Add event listener for the "View Details" button in popups
    map.on('popupopen', (e) => {
      const btn = document.querySelector('.view-details-btn');
      if (btn) {
        btn.addEventListener('click', (event) => {
          const treeId = (event.target as HTMLElement).getAttribute('data-tree-id');
          if (treeId) {
            onTreeClick(treeId);
          }
        });
      }
    });

    return () => {
      map.removeLayer(treeLayerGroup);
      map.off('popupopen');
    };
  }, [map, trees, onTreeClick]);

  return null; // This component doesn't render any visible elements
};

export default MapTreeLayer;