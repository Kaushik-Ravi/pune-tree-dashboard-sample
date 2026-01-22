// src/components/filters/FilterLoadingState.tsx
// Engaging loading component with dynamic tree-themed messages

import React, { useState, useEffect } from 'react';
import { Leaf, TreePine, Sprout, TreeDeciduous, Flower2 } from 'lucide-react';

interface FilterLoadingStateProps {
  /** Optional custom class name */
  className?: string;
  /** Compact mode for inline display */
  compact?: boolean;
}

// Tree-themed loading messages that rotate
const LOADING_MESSAGES = [
  { text: 'Picking the leaves for you...', icon: Leaf },
  { text: 'Growing your forest options...', icon: TreePine },
  { text: 'Counting tree rings...', icon: TreeDeciduous },
  { text: 'Gathering species data...', icon: Sprout },
  { text: 'Branching out to find filters...', icon: TreePine },
  { text: 'Rustling through the canopy...', icon: Leaf },
  { text: 'Sprouting filter options...', icon: Flower2 },
  { text: 'Photosynthesizing your data...', icon: TreeDeciduous },
];

// Fun tree facts to show during longer waits
const TREE_FACTS = [
  'A single tree can absorb 21 kg of CO₂ per year!',
  'Pune has over 1.7 million cataloged trees.',
  'Trees can communicate through underground fungal networks.',
  'Street trees can reduce air temperature by up to 8°C.',
  'The oldest tree in India is over 3,000 years old!',
];

const FilterLoadingState: React.FC<FilterLoadingStateProps> = ({ 
  className = '',
  compact = false 
}) => {
  const [messageIndex, setMessageIndex] = useState(0);
  const [showFact, setShowFact] = useState(false);
  const [factIndex, setFactIndex] = useState(0);
  const [dots, setDots] = useState('');

  // Rotate through messages every 2.5 seconds
  useEffect(() => {
    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 2500);

    return () => clearInterval(messageInterval);
  }, []);

  // Animate dots
  useEffect(() => {
    const dotsInterval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 400);

    return () => clearInterval(dotsInterval);
  }, []);

  // Show fact after 5 seconds
  useEffect(() => {
    const factTimer = setTimeout(() => {
      setShowFact(true);
      setFactIndex(Math.floor(Math.random() * TREE_FACTS.length));
    }, 5000);

    return () => clearTimeout(factTimer);
  }, []);

  const currentMessage = LOADING_MESSAGES[messageIndex];
  const IconComponent = currentMessage.icon;

  if (compact) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <div className="relative">
          <Leaf className="w-4 h-4 text-primary-500 animate-bounce" />
          <div className="absolute inset-0 animate-ping opacity-30">
            <Leaf className="w-4 h-4 text-primary-400" />
          </div>
        </div>
        <span className="text-sm text-gray-600 animate-pulse">
          {currentMessage.text.replace('...', dots)}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center justify-center py-8 px-4 ${className}`}>
      {/* Animated tree icon cluster */}
      <div className="relative mb-4">
        {/* Background glow */}
        <div className="absolute inset-0 bg-primary-200/30 rounded-full blur-xl scale-150" />
        
        {/* Main animated icon */}
        <div className="relative">
          <div className="flex items-end justify-center gap-1">
            {/* Left tree - bounces with delay */}
            <TreePine 
              className="w-6 h-6 text-primary-400 animate-bounce" 
              style={{ animationDelay: '0.1s' }}
            />
            {/* Center tree - main icon */}
            <div className="relative">
              <IconComponent 
                className="w-10 h-10 text-primary-600 animate-pulse" 
              />
              {/* Floating leaves effect */}
              <Leaf 
                className="absolute -top-2 -right-1 w-3 h-3 text-green-400 animate-bounce"
                style={{ animationDelay: '0.3s' }}
              />
              <Leaf 
                className="absolute -top-1 -left-2 w-2 h-2 text-green-300 animate-bounce"
                style={{ animationDelay: '0.6s' }}
              />
            </div>
            {/* Right tree - bounces with delay */}
            <TreePine 
              className="w-6 h-6 text-primary-400 animate-bounce" 
              style={{ animationDelay: '0.2s' }}
            />
          </div>
        </div>
      </div>

      {/* Loading message with fade transition */}
      <div className="h-6 mb-2">
        <p 
          key={messageIndex}
          className="text-sm font-medium text-gray-700 animate-fade-in text-center"
        >
          {currentMessage.text.replace('...', dots)}
        </p>
      </div>

      {/* Progress indicator bar */}
      <div className="w-48 h-1.5 bg-gray-200 rounded-full overflow-hidden mb-4">
        <div className="h-full bg-gradient-to-r from-primary-400 via-primary-600 to-primary-400 rounded-full animate-loading-bar" />
      </div>

      {/* Fun fact - appears after 5 seconds */}
      {showFact && (
        <div className="mt-2 max-w-xs animate-fade-in">
          <div className="bg-primary-50 border border-primary-100 rounded-lg px-3 py-2">
            <p className="text-xs text-primary-700 text-center">
              <span className="font-medium">🌳 Did you know?</span>
              <br />
              {TREE_FACTS[factIndex]}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterLoadingState;
