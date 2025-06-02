// src/components/map/LeafletGeocoder.tsx
import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet-control-geocoder/dist/Control.Geocoder.css';
import 'leaflet-control-geocoder';

declare module 'leaflet' {
  namespace Control {
    interface GeocoderOptions {
      defaultMarkGeocode?: boolean;
      collapsed?: boolean;
      position?: L.ControlPosition; 
      placeholder?: string;
      errorMessage?: string;
      iconLabel?: string;
      showUniqueResult?: boolean;
      showResultIcons?: boolean;
      geocoder?: any;
    }
    // Ensure getContainer might return null if control not added/ready
    function geocoder(options?: GeocoderOptions): L.Control & { getContainer: () => HTMLElement | null; };
  }
}

const LeafletGeocoder: React.FC = () => {
  const map = useMap();
  const geocoderCustomWrapperRef = useRef<HTMLDivElement | null>(null); // Ref for our custom wrapper

  useEffect(() => {
    if (!map) return;

    if (!(L.Control as any).Geocoder) {
      console.error('L.Control.Geocoder not found.');
      return;
    }
    
    let geocoderService;
    if (typeof (L.Control.Geocoder as any).nominatim === 'function') {
      geocoderService = (L.Control.Geocoder as any).nominatim();
    } else if (typeof (L.Control.Geocoder as any).Nominatim === 'function') {
      geocoderService = new (L.Control.Geocoder as any).Nominatim();
    }

    const geocoderControlOptions: L.Control.GeocoderOptions = {
      defaultMarkGeocode: false,
      collapsed: false, 
      placeholder: 'Search address or place...',
      geocoder: geocoderService,
      // position is not set here, as we are manually positioning its container
    };

    // @ts-ignore
    const geocoderControl = L.Control.geocoder(geocoderControlOptions);

    // Create our custom wrapper div if it doesn't exist
    if (!geocoderCustomWrapperRef.current) {
        const wrapper = L.DomUtil.create('div', 'leaflet-geocoder-custom-wrapper leaflet-control'); // Added leaflet-control for base styling
        geocoderCustomWrapperRef.current = wrapper;
        
        // Style the custom wrapper for top-center positioning and desired width
        wrapper.style.position = 'absolute';
        wrapper.style.top = '10px'; // Margin from top of map
        wrapper.style.left = '50%';
        wrapper.style.transform = 'translateX(-50%)';
        wrapper.style.zIndex = '1001'; // Ensure it's above map tiles, but potentially below other specific controls if needed
        wrapper.style.width = '320px'; // ** SET GEOCODER WIDTH HERE **
        // wrapper.classList.add('leaflet-bar'); // Optional: if you want leaflet-bar shadow/border

        // Get the geocoder's actual DOM element and append it to our custom wrapper
        const geocoderElement = geocoderControl.getContainer(); // This is the control's own container
        if (geocoderElement) {
          wrapper.appendChild(geocoderElement); // Put the geocoder inside our wrapper
          
          // Ensure geocoderElement and its form take full width of the wrapper
          geocoderElement.style.width = '100%';
          const formElement = geocoderElement.querySelector('.leaflet-control-geocoder-form');
          if (formElement) {
            (formElement as HTMLElement).style.width = '100%';
            (formElement as HTMLElement).style.position = 'relative'; 
          }

          // Apply styling to input and icons (as before)
          const inputElement = geocoderElement.querySelector('input[type="text"]');
          if (inputElement) {
            const inputEl = inputElement as HTMLInputElement;
            inputEl.style.width = '100%'; 
            inputEl.style.minHeight = '40px'; 
            inputEl.style.paddingLeft = '36px'; 
            inputEl.style.paddingRight = '30px'; 
            inputEl.style.boxSizing = 'border-box';
            inputEl.style.borderRadius = '4px'; 
            inputEl.style.backgroundImage = 'url(images/geocoder.png)'; 
            inputEl.style.backgroundRepeat = 'no-repeat';
            inputEl.style.backgroundPosition = '10px center'; 
          }
          
          const closeButton = geocoderElement.querySelector('.leaflet-control-geocoder-icon-close') as HTMLElement;
          if (closeButton) {
            closeButton.style.position = 'absolute'; 
            closeButton.style.right = '8px'; 
            closeButton.style.top = '50%';    
            closeButton.style.transform = 'translateY(-50%)'; 
            closeButton.style.zIndex = '1'; 
          }

          const suggestionsList = geocoderElement.querySelector('.leaflet-control-geocoder-alternatives');
          if (suggestionsList) {
            (suggestionsList as HTMLElement).style.width = '100%';
            (suggestionsList as HTMLElement).style.maxWidth = 'none';
            (suggestionsList as HTMLElement).style.zIndex = '1005'; 
            (suggestionsList as HTMLElement).style.marginTop = '2px'; 
            (suggestionsList as HTMLElement).style.borderRadius = '4px';
            (suggestionsList as HTMLElement).style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
          }
        }
        // Add our custom wrapper (which now contains the geocoder) to the map's main container
        // This ensures it's part of the map DOM but positioned by our absolute styles
        map.getContainer().appendChild(wrapper);
    }
    
    // Attach event listener to the control AFTER it's been processed and potentially added to DOM
    geocoderControl.on('markgeocode', function (e: any) {
        const latlng = e.geocode.center;
        map.setView(latlng, 15); 
    });


    return () => {
      // Remove the custom wrapper when component unmounts
      if (geocoderCustomWrapperRef.current && geocoderCustomWrapperRef.current.parentNode) {
        geocoderCustomWrapperRef.current.parentNode.removeChild(geocoderCustomWrapperRef.current);
        geocoderCustomWrapperRef.current = null; // Clear ref
      }
      // The geocoderControl instance itself doesn't need explicit map.removeControl if we manage its container
    };
  }, [map]);

  return null; 
};

export default LeafletGeocoder;