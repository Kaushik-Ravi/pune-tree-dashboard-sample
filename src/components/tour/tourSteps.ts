// src/components/tour/tourSteps.ts
import { Step } from 'react-joyride';

const tourStyles = {
  options: {
    primaryColor: '#2E7D32',
    textColor: '#212529',
    arrowColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
  },
};

export const TourSteps: { [key: string]: Step } = {
  welcome: {
    target: 'body',
    content: "Welcome to the Pune Urban Tree Dashboard! Let's take a quick tour to explore the key features.",
    placement: 'center',
    disableBeacon: true,
    styles: tourStyles,
  },
  openDashboardDesktop: {
    target: '[data-tour-id="sidebar-toggle-desktop"]',
    content: 'Click "Next" to open the main dashboard panel and see what you can do.',
    placement: 'left',
    styles: tourStyles,
  },
  openDashboardMobile: {
    target: '[data-tour-id="sidebar-toggle-mobile"]',
    content: 'Tap "Next" to open the main dashboard panel and see what you can do.',
    placement: 'top-start',
    styles: tourStyles,
  },
  dashboardTabs: {
    target: '[data-tour-id="sidebar-tabs"]',
    content: 'The dashboard is organized into four main tabs: City Overview, Tree Details, Planting Advisor, and Map Layers.',
    placement: 'top',
    styles: tourStyles,
    floaterProps: {
      disableAnimation: true,
    },
  },
  drawingTools: {
    target: '[data-tour-id="draw-polygon"]', // CORRECTED: Using robust data-tour-id
    content: 'These tools let you draw a custom area on the map to analyze specific neighborhoods or plan plantings.',
    placement: 'right',
    styles: tourStyles,
  },
  knowYourNeighbourhood: {
    target: '[data-tour-id="know-your-neighbourhood"]',
    content: 'After drawing an area, this section will show you detailed statistics like tree count and CO₂ sequestration for that specific zone.',
    placement: 'top',
    styles: tourStyles,
  },
  plantingAdvisor: {
    target: '[data-tour-id="tab-planting-advisor"]',
    content: 'The Planting Advisor helps you choose the best tree species for a selected area and simulate how many can be planted.',
    placement: 'top',
    styles: tourStyles,
  },
  mapLayers: {
    target: '[data-tour-id="tab-map-layers"]',
    content: 'Here you can change the basemap style and toggle data overlays, like the Land Surface Temperature layer.',
    placement: 'top',
    styles: tourStyles,
  },
  threeDMode: {
    target: '[data-tour-id="view-mode-toggle"]',
    content: 'Zoom in and switch to 3D mode to see building and tree models, allowing you to visualize their real-world height and scale.',
    placement: 'right',
    styles: tourStyles,
  },
  finish: {
    target: 'body',
    content: "You're all set! Click on any tree or start drawing on the map to begin your exploration.",
    placement: 'center',
    disableBeacon: true,
    styles: tourStyles,
  },
};