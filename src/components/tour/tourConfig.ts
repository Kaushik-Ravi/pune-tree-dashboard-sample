// src/components/tour/tourConfig.ts
import { Step } from 'react-joyride';

export interface TourStepRequirements {
  requiresSidebar?: 'open' | 'closed';
  requiresTab?: number;
  requires3D?: boolean;
  skipOnMobile?: boolean;
  skipOnDesktop?: boolean;
}

export interface EnhancedTourStep extends Step {
  key: string;
  requirements?: TourStepRequirements;
}

const tourStyles = {
  options: {
    primaryColor: '#2E7D32',
    textColor: '#212529',
    arrowColor: '#FFFFFF',
    backgroundColor: '#FFFFFF',
    overlayColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 10000,
  },
  tooltip: {
    maxWidth: '90vw',
    width: '360px',
    padding: '16px',
  },
  tooltipContainer: {
    textAlign: 'left',
  },
  tooltipContent: {
    padding: '12px 0',
  },
  buttonNext: {
    backgroundColor: '#2E7D32',
    padding: '8px 16px',
    borderRadius: '4px',
  },
  buttonBack: {
    color: '#2E7D32',
    marginRight: '8px',
  },
  buttonSkip: {
    color: '#666',
  },
};

/**
 * Centralized tour step configuration with requirements for orchestration.
 * This eliminates duplication between TourGuide and App components.
 */
export const TOUR_STEPS_CONFIG: EnhancedTourStep[] = [
  {
    key: 'welcome',
    target: 'body',
    content: "Welcome to the Pune Urban Tree Dashboard! Let's take a quick tour to explore the key features.",
    placement: 'center',
    disableBeacon: true,
    styles: tourStyles,
    requirements: {
      requiresSidebar: 'closed',
    },
  },
  {
    key: 'openDashboardDesktop',
    target: '[data-tour-id="sidebar-toggle-desktop"]',
    content: 'Click "Next" to open the main dashboard panel and see what you can do.',
    placement: 'left',
    styles: tourStyles,
    requirements: {
      requiresSidebar: 'closed',
    },
  },
  {
    key: 'openDashboardMobile',
    target: '[data-tour-id="sidebar-toggle-mobile"]',
    content: 'Tap "Next" to open the main dashboard panel and see what you can do.',
    placement: 'top-start',
    styles: tourStyles,
    requirements: {
      requiresSidebar: 'closed',
    },
  },
  {
    key: 'dashboardTabs',
    target: '[data-tour-id="sidebar-tabs"]',
    content: 'The dashboard is organized into four main tabs: City Overview, Tree Details, Planting Advisor, and Map Layers.',
    placement: 'auto',
    styles: tourStyles,
    requirements: {
      requiresSidebar: 'open',
      requiresTab: 0,
    },
  },
  {
    key: 'drawingTools',
    target: '[data-tour-id="draw-polygon"]',
    content: 'These tools let you draw a custom area on the map to analyze specific neighborhoods or plan plantings.',
    placement: 'right',
    styles: tourStyles,
    requirements: {
      requiresSidebar: 'closed',
    },
  },
  {
    key: 'knowYourNeighbourhood',
    target: '[data-tour-id="know-your-neighbourhood"]',
    content: 'After drawing an area, this section will show you detailed statistics like tree count and CO₂ sequestration for that specific zone.',
    placement: 'auto',
    disableScrolling: false,
    styles: tourStyles,
    requirements: {
      requiresSidebar: 'open',
      requiresTab: 0,
    },
  },
  {
    key: 'plantingAdvisor',
    target: '[data-tour-id="tab-planting-advisor"]',
    content: 'The Planting Advisor helps you choose the best tree species for a selected area and simulate how many can be planted.',
    placement: 'left',
    styles: tourStyles,
    requirements: {
      requiresSidebar: 'open',
      requiresTab: 2,
    },
  },
  {
    key: 'mapLayers',
    target: '[data-tour-id="tab-map-layers"]',
    content: 'Here you can change the basemap style and toggle data overlays, like the Land Surface Temperature layer.',
    placement: 'left',
    styles: tourStyles,
    requirements: {
      requiresSidebar: 'open',
      requiresTab: 3,
    },
  },
  {
    key: 'threeDMode',
    target: '[data-tour-id="view-mode-toggle"]',
    content: 'Zoom in and switch to 3D mode to see building and tree models, allowing you to visualize their real-world height and scale.',
    placement: 'right',
    styles: tourStyles,
    requirements: {
      requiresSidebar: 'closed',
    },
  },
  {
    key: 'finish',
    target: 'body',
    content: "You're all set! Click on any tree or start drawing on the map to begin your exploration.",
    placement: 'center',
    disableBeacon: true,
    styles: tourStyles,
    requirements: {
      requiresSidebar: 'closed',
    },
  },
];

/**
 * Get tour steps filtered and adjusted for the current device.
 */
export function getTourSteps(isMobile: boolean): EnhancedTourStep[] {
  return TOUR_STEPS_CONFIG.map(step => {
    // Replace desktop/mobile specific steps
    if (isMobile && step.key === 'openDashboardDesktop') {
      return null; // Will be filtered out
    }
    if (!isMobile && step.key === 'openDashboardMobile') {
      return null; // Will be filtered out
    }
    return step;
  }).filter(Boolean) as EnhancedTourStep[];
}

/**
 * Get step requirements for orchestration
 */
export function getStepRequirements(stepKey: string): TourStepRequirements | undefined {
  const step = TOUR_STEPS_CONFIG.find(s => s.key === stepKey);
  return step?.requirements;
}

/**
 * Get step by key
 */
export function getStepByKey(stepKey: string): EnhancedTourStep | undefined {
  return TOUR_STEPS_CONFIG.find(s => s.key === stepKey);
}
