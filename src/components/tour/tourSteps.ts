// src/components/tour/tourSteps.ts
import { Step } from 'react-joyride';

// We define custom options for styling that react-joyride will merge.
const tourStyles = {
  options: {
    primaryColor: '#2E7D32', // Corresponds to primary-600
    textColor: '#212529',    // Corresponds to gray-900
    arrowColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
  },
};

// Define unique keys for each step for better management.
export const TourSteps: { [key: string]: Step } = {
  // Step 1: Initial Welcome
  welcome: {
    target: 'body',
    content: "Welcome to the Pune Urban Tree Dashboard! Let's take a quick tour to explore the key features.",
    placement: 'center',
    disableBeacon: true,
    styles: tourStyles,
  },
  // Step 2: Show mobile FAB
  openDashboardMobile: {
    target: '[data-tour-id="sidebar-toggle-mobile"]',
    content: 'On mobile, tap this button anytime to open the main dashboard panel.',
    placement: 'top-start',
    styles: tourStyles,
  },
  // Step 3: Show desktop sidebar toggle
  openDashboardDesktop: {
    target: '[data-tour-id="sidebar-toggle-desktop"]',
    content: 'On desktop, click this handle to open and close the main dashboard panel.',
    placement: 'left',
    styles: tourStyles,
  },
  // Step 4: Introduce the tabs
  dashboardTabs: {
    target: '[data-tour-id="sidebar-tabs"]',
    content: 'The dashboard is organized into four main tabs: City Overview, Tree Details, Planting Advisor, and Map Layers.',
    placement: 'top',
    styles: tourStyles,
  },
  // Step 5: Explain drawing tools
  drawingTools: {
    target: '.maplibregl-ctrl-group button[title="Draw a polygon"]',
    content: 'These tools let you draw a custom area on the map to analyze specific neighborhoods or plan plantings.',
    placement: 'right',
    styles: tourStyles,
  },
  // Step 6: Connect drawing to "Know Your Neighbourhood"
  knowYourNeighbourhood: {
    target: '[data-tour-id="know-your-neighbourhood"]',
    content: 'After drawing an area, this section will show you detailed statistics like tree count and CO₂ sequestration for that specific zone.',
    placement: 'top',
    styles: tourStyles,
  },
  // Step 7: Planting Advisor Tab
  plantingAdvisor: {
    target: '[data-tour-id="tab-planting-advisor"]',
    content: 'The Planting Advisor helps you choose the best tree species for a selected area and simulate how many can be planted.',
    placement: 'top',
    styles: tourStyles,
  },
  // Step 8: Map Layers Tab
  mapLayers: {
    target: '[data-tour-id="tab-map-layers"]',
    content: 'Here you can change the basemap style and toggle data overlays, like the Land Surface Temperature layer.',
    placement: 'top',
    styles: tourStyles,
  },
  // Step 9: 3D Mode Toggle
  threeDMode: {
    target: '[data-tour-id="view-mode-toggle"]',
    content: 'Zoom in and switch to 3D mode to see building and tree models, allowing you to visualize their real-world height and scale.',
    placement: 'right',
    styles: tourStyles,
  },
  // Step 10: Final message
  finish: {
    target: 'body',
    content: "You're all set! Click on any tree or start drawing on the map to begin your exploration.",
    placement: 'center',
    disableBeacon: true,
    styles: tourStyles,
  },
};