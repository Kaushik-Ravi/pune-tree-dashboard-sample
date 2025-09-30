// src/components/tour/TourSteps.ts
import { Step } from 'react-joyride';

export const TOUR_STEPS: Step[] = [
  {
    target: 'body',
    content: 'Welcome to the Pune Urban Tree Dashboard! Let\'s take a quick tour of the main features.',
    placement: 'center',
    title: 'Welcome!',
    disableBeacon: true,
  },
  {
    target: '.sidebar',
    content: 'This is the main dashboard panel. Here you can find city-wide statistics, detailed information about individual trees, and planning tools.',
    title: 'The Dashboard Panel',
    placement: 'left',
  },
  {
    // MODIFIED: Selector now targets the first tab button for more precise anchoring.
    target: '.sidebar > div:nth-of-type(3) > div > button:nth-of-type(1)',
    content: 'Navigate through the different sections of the dashboard using these tabs.',
    title: 'Dashboard Navigation',
    placement: 'bottom',
  },
  {
    target: '.sidebar > div:nth-of-type(3) > div > button:nth-of-type(4)',
    content: 'In the "Map Layers" tab, you can change the basemap style, toggle the Land Surface Temperature (LST) overlay, and manage 3D view settings like sun position and shadows.',
    title: 'Map Layers & Settings',
    placement: 'bottom',
  },
  {
    target: '.absolute.top-\\[170px\\].left-\\[10px\\] button',
    content: 'Switch between a 2D and an immersive 3D view of the city. Note: 3D mode is available at higher zoom levels.',
    title: 'Toggle 3D View',
    placement: 'right',
  },
  {
    target: '#draw-controls-container',
    content: 'Use these tools to draw a polygon on the map. You can analyze the tree count and CO₂ sequestration within any custom area you define.',
    title: 'Analyze Your Neighbourhood',
    placement: 'right',
  },
  {
    target: '.sidebar > div:nth-of-type(3) > div > button:nth-of-type(3)',
    content: 'Get recommendations for the best tree species to plant for cooling and simulate planting scenarios in your selected area.',
    title: 'Planting Advisor',
    placement: 'bottom',
  },
  {
    target: 'body',
    content: 'You\'re all set! Start exploring the urban forest of Pune. Click on any tree to begin.',
    placement: 'center',
    title: 'Tour Complete',
  },
];