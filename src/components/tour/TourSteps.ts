// src/components/tour/TourSteps.ts
import { Step } from 'react-joyride';

// Define an extended step type that includes a pre-step action and a transition flag
export interface ExtendedStep extends Step {
  action?: (helpers: {
    setSidebarOpen: (isOpen: boolean) => void;
    setActiveTabIndex: (index: number) => void;
  }) => void;
  causesTransition?: boolean; // New property to flag steps that trigger animations
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
    action: closeSidebar,
    causesTransition: true, // This step ensures the sidebar is closed
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
    causesTransition: true, // This step opens the sidebar
  },
  {
    target: '[data-tour-id="neighborhood-stats-card"]',
    content: 'This card will show you statistics for any custom area you draw on the map. Let\'s see the tools for that next.',
    title: 'Analyze a Custom Area',
    placement: 'left',
    action: ({ setSidebarOpen, setActiveTabIndex }) => {
      setSidebarOpen(true);
      setActiveTabIndex(0);
    },
  },
  {
    target: '#draw-controls-container',
    content: 'Use these tools to draw a polygon on the map. The dashboard will then analyze the tree count and CO₂ sequestration specifically within that area.',
    title: 'Analyze Your Neighborhood',
    placement: 'right',
    action: closeSidebar,
    causesTransition: true, // This step closes the sidebar
  },
  {
    target: '.sidebar > div:nth-of-type(3) > div > button:nth-of-type(3)',
    content: 'Get recommendations for the best tree species for cooling and simulate planting scenarios in your selected area.',
    title: 'Planting Advisor',
    placement: 'left',
    action: ({ setSidebarOpen, setActiveTabIndex }) => {
      setSidebarOpen(true);
      setActiveTabIndex(2);
    },
    causesTransition: true, // This step opens the sidebar
  },
  {
    target: '.sidebar > div:nth-of-type(3) > div > button:nth-of-type(4)',
    content: 'Here you can change the basemap style, toggle the Land Surface Temperature (LST) overlay, and control lighting and shadows in the 3D view.',
    title: 'Map Layers & Settings',
    placement: 'left',
    action: ({ setSidebarOpen, setActiveTabIndex }) => {
      setSidebarOpen(true);
      setActiveTabIndex(3);
    },
    // No transition here because the sidebar is already open and we are just changing tabs
  },
  {
    target: 'body',
    content: 'You\'re all set! Start exploring the urban forest of Pune.',
    placement: 'center',
    title: 'Tour Complete',
    action: closeSidebar,
    causesTransition: true, // This step closes the sidebar
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
        action: closeSidebar,
        causesTransition: true, // This step ensures the sidebar is closed
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
        causesTransition: true, // This step opens the sidebar
      },
      {
        target: '[data-tour-id="neighborhood-stats-card"]',
        content: 'This card will show you statistics for any custom area you draw on the map. Let\'s see the tools for that next.',
        title: 'Analyze a Custom Area',
        placement: 'top',
        action: ({ setSidebarOpen, setActiveTabIndex }) => {
          setSidebarOpen(true);
          setActiveTabIndex(0);
        },
      },
      {
        target: '#draw-controls-container',
        content: 'Use these tools to draw a polygon on the map to analyze the trees within that specific area.',
        title: 'Analyze Your Neighborhood',
        placement: 'bottom',
        action: closeSidebar,
        causesTransition: true, // This step closes the sidebar
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
        causesTransition: true, // This step opens the sidebar
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
        // No transition here because the sidebar is already open
      },
      {
        target: 'body',
        content: 'You\'re all set! Start exploring the urban forest of Pune.',
        placement: 'center',
        title: 'Tour Complete',
        action: closeSidebar,
        causesTransition: true, // This step closes the sidebar
      },
];