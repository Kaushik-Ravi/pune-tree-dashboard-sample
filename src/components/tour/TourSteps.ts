// src/components/tour/TourSteps.ts
import { Step } from 'react-joyride';

// Define an extended step type that includes a pre-step action
export interface ExtendedStep extends Step {
  action?: (helpers: {
    setSidebarOpen: (isOpen: boolean) => void;
    setActiveTabIndex: (index: number) => void;
  }) => void;
}

// Default action to close the sidebar
const closeSidebar = ({ setSidebarOpen }: { setSidebarOpen: (isOpen: boolean) => void }) => {
  setSidebarOpen(false);
};

// --- DESKTOP TOUR CONFIGURATION ---
export const DESKTOP_STEPS: ExtendedStep[] = [
  {
    target: 'body',
    content: 'Welcome to the Pune Urban Tree Dashboard! Let\'s take a quick tour of the main features.',
    placement: 'center',
    title: 'Welcome!',
    disableBeacon: true,
  },
  {
    target: '.map-container',
    content: 'This map displays all the surveyed trees in Pune. You can click on any green dot to view detailed information about that specific tree.',
    title: 'Explore the Urban Forest',
    placement: 'center',
    action: ({ setSidebarOpen }) => setSidebarOpen(false),
  },
  {
    target: '.sidebar',
    content: 'This is the main dashboard panel. The "City Overview" tab provides high-level statistics about the city\'s entire tree population.',
    title: 'City-Wide Analysis',
    placement: 'left',
    action: ({ setSidebarOpen, setActiveTabIndex }) => {
      setSidebarOpen(true);
      setActiveTabIndex(0);
    },
  },
  {
    target: '.absolute.top-\\[170px\\].left-\\[10px\\] button',
    content: 'Switch between a 2D and an immersive 3D view of the city. In 3D, you can visualize tree heights and canopy structures. (Note: 3D mode is available at higher zoom levels).',
    title: 'Toggle 3D View',
    placement: 'right',
    action: closeSidebar,
  },
  {
    target: '#draw-controls-container',
    content: 'Use these tools to draw a polygon on the map. The dashboard will then analyze the tree count and CO₂ sequestration specifically within that area.',
    title: 'Analyze Your Neighborhood',
    placement: 'right',
    action: closeSidebar,
  },
  {
    target: '.sidebar > div:nth-of-type(3) > div > button:nth-of-type(3)',
    content: 'Get recommendations for the best tree species for cooling and simulate planting scenarios in your selected area.',
    title: 'Planting Advisor',
    placement: 'bottom',
    action: ({ setSidebarOpen, setActiveTabIndex }) => {
      setSidebarOpen(true);
      setActiveTabIndex(2);
    },
  },
  {
    target: '.sidebar > div:nth-of-type(3) > div > button:nth-of-type(4)',
    content: 'Here you can change the basemap style, toggle the Land Surface Temperature (LST) overlay, and control lighting and shadows in the 3D view.',
    title: 'Map Layers & Settings',
    placement: 'bottom',
    action: ({ setSidebarOpen, setActiveTabIndex }) => {
      setSidebarOpen(true);
      setActiveTabIndex(3);
    },
  },
  {
    target: 'body',
    content: 'You\'re all set! Start exploring the urban forest of Pune.',
    placement: 'center',
    title: 'Tour Complete',
    action: ({ setSidebarOpen }) => setSidebarOpen(false),
  },
];


// --- MOBILE TOUR CONFIGURATION ---
export const MOBILE_STEPS: ExtendedStep[] = [
    {
        target: 'body',
        content: 'Welcome to the Pune Urban Tree Dashboard! Let\'s take a quick tour of the main features.',
        placement: 'center',
        title: 'Welcome!',
        disableBeacon: true,
      },
      {
        target: '.map-container',
        content: 'This map displays all the surveyed trees in Pune. You can tap on any green dot to view detailed information about that specific tree.',
        title: 'Explore the Urban Forest',
        placement: 'center',
        action: ({ setSidebarOpen }) => setSidebarOpen(false),
      },
      {
        target: '.sidebar',
        content: 'This is the main dashboard panel. The "City Overview" tab provides high-level statistics about the city\'s entire tree population.',
        title: 'City-Wide Analysis',
        placement: 'top',
        action: ({ setSidebarOpen, setActiveTabIndex }) => {
          setSidebarOpen(true);
          setActiveTabIndex(0);
        },
      },
      {
        target: '.absolute.top-\\[170px\\].left-\\[10px\\] button',
        content: 'Switch between a 2D and an immersive 3D view of the city. (Note: 3D mode is available at higher zoom levels).',
        title: 'Toggle 3D View',
        placement: 'bottom',
        action: closeSidebar,
      },
      {
        target: '#draw-controls-container',
        content: 'Use these tools to draw a polygon on the map to analyze the trees within that specific area.',
        title: 'Analyze Your Neighborhood',
        placement: 'bottom',
        action: closeSidebar,
      },
      {
        target: '.sidebar > div:nth-of-type(3) > div > button:nth-of-type(3)',
        content: 'Get recommendations for the best tree species to plant for cooling and simulate planting scenarios.',
        title: 'Planting Advisor',
        placement: 'top',
        action: ({ setSidebarOpen, setActiveTabIndex }) => {
          setSidebarOpen(true);
          setActiveTabIndex(2);
        },
      },
      {
        target: '.sidebar > div:nth-of-type(3) > div > button:nth-of-type(4)',
        content: 'Change the basemap style, toggle overlays, and control 3D lighting and shadows here.',
        title: 'Map Layers & Settings',
        placement: 'top',
        action: ({ setSidebarOpen, setActiveTabIndex }) => {
          setSidebarOpen(true);
          setActiveTabIndex(3);
        },
      },
      {
        target: 'body',
        content: 'You\'re all set! Start exploring the urban forest of Pune.',
        placement: 'center',
        title: 'Tour Complete',
        action: ({ setSidebarOpen }) => setSidebarOpen(false),
      },
];