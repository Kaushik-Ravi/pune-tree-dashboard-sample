// src/components/map/MapTreeLayer.tsx
import React, { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import { useTreeStore } from '../../store/TreeStore'; 
// Assuming you have lucide-react icons available as needed
// import { Droplets, Binary, Hash } from 'lucide-react'; // Example icons

const MapTreeLayer: React.FC<MapTreeLayerProps> = ({ onTreeClick }) => {
  const map = useMap();
  const { trees, fetchTrees } = useTreeStore();

  useEffect(() => {
    fetchTrees(); 
  }, [fetchTrees]);

  useEffect(() => {
    if (!map || !trees || trees.length === 0) {
      map.eachLayer((layer) => {
        if ((layer as any).isTreeMarker) { 
          map.removeLayer(layer);
        }
      });
      return;
    }

    const treeLayerGroup = L.layerGroup();

    trees.forEach((tree) => {
      const marker = L.circleMarker([tree.latitude, tree.longitude], {
        radius: 5, 
        fillColor: '#00BCD4',   
        fillOpacity: 0.9,
        color: '#FFFFFF',       
        weight: 2,              
        opacity: 1,
        pane: 'markerPane' 
      });
      (marker as any).isTreeMarker = true; 

      // --- ENHANCED POPUP CONTENT ---
      const popupContentElement = document.createElement('div');
      popupContentElement.className = 'tree-popup p-3 bg-white rounded-lg shadow-sm space-y-2'; // Added more Tailwind classes
      popupContentElement.style.minWidth = '220px'; // Ensure a decent minimum width

      popupContentElement.innerHTML = `
        <div>
          <h3 class="text-md font-bold text-primary-700 mb-0.5">${tree.common_name}</h3>
          <p class="text-xs text-gray-500 italic">${tree.botanical_name_short}</p>
        </div>
        
        <div class="border-t border-gray-200 pt-2 space-y-1">
          <div class="flex items-center text-xs text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1.5 opacity-70"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg> <!-- Generic ID icon -->
            ID: <span class="font-medium ml-1">${tree.id}</span>
          </div>
          <div class="flex items-center text-xs text-gray-600">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="mr-1.5 opacity-70"><path d="M21.2 15c.7-1.2 1-2.5.7-3.9-.6-2.4-3-4-5.4-4-1.6 0-3.1.8-4 2.2M7.2 20.9c.4.3.8.7 1.2 1M4.2 14.4c-.1.9.1 1.8.7 2.6M7 17.7c-.4-.3-.8-.7-1.2-1M10.2 3.1c.4-.3.8-.7 1.2-1M4.2 9.6C4.1 8.7 4.3 7.8 4.8 7M7 6.3c-.4.3-.8.7-1.2 1M18.8 15c-.7-1.2-1-2.5-.7-3.9.6-2.4 3-4 5.4-4 1.6 0 3.1.8 4-2.2M16.8 3.1c-.4-.3-.8-.7-1.2-1M20.2 9.6c.1.9-.1 1.8-.7 2.6M17 6.3c.4.3.8.7 1.2 1M12 18a6 6 0 0 0 0-12v0a6 6 0 0 0 0 12v0Z"></path></svg> <!-- CO2/Leaf icon -->
            CO₂ Sequestered: <span class="font-medium ml-1">${tree.CO2_sequestered_kg.toFixed(1)} kg</span>
          </div>
        </div>
        
        <button 
          class="mt-3 w-full btn btn-primary btn-sm text-xs py-1.5 view-details-btn-internal"
        >
          View Details
        </button>
      `;
      // Note: Using Tailwind class 'btn btn-primary btn-sm' on the button for consistency.
      // You might need to adjust if 'btn-sm' or if your global 'btn' styles are different.
      // I've used text-xs and py-1.5 to make it a bit smaller for the popup context.
      
      const viewDetailsButton = popupContentElement.querySelector('.view-details-btn-internal');
      if (viewDetailsButton) {
        viewDetailsButton.addEventListener('click', () => {
          if (typeof onTreeClick === 'function') {
            onTreeClick(tree.id);
          } else {
            console.error("onTreeClick is not a function in MapTreeLayer. Props:", onTreeClick);
          }
        });
      }

      marker.bindPopup(popupContentElement, {
        minWidth: 200, // Leaflet option for popup min width
        // closeButton: false, // Optional: hide default Leaflet close button if you add your own
      });
      treeLayerGroup.addLayer(marker);
    });

    treeLayerGroup.addTo(map);

    return () => {
      map.removeLayer(treeLayerGroup);
    };
  }, [map, trees, onTreeClick]);

  return null;
};

// Prop types (ensure this matches how MapView uses it)
interface MapTreeLayerProps {
  onTreeClick: (treeId: string) => void;
}

export default MapTreeLayer;