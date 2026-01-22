// src/components/common/ProgressiveLoadingOverlay.tsx
// Stunning animated loading screen with real stats and progress indicators

import React, { useState, useEffect, useMemo } from 'react';
import { TreePine, Leaf, MapPin, BarChart3, Sparkles, Wind } from 'lucide-react';

interface LoadingStep {
  id: string;
  label: string;
  completed: boolean;
  icon: React.ElementType;
}

interface ProgressiveLoadingOverlayProps {
  totalTrees?: number | null;
  totalCO2Kg?: number | null;
  wardsLoaded?: number;
  isComplete?: boolean;
}

// Floating leaf component for background animation
const FloatingLeaf: React.FC<{ 
  delay: number; 
  duration: number; 
  size: number;
  left: string;
  startTop: string;
}> = ({ delay, duration, size, left, startTop }) => (
  <div 
    className="absolute animate-float-down pointer-events-none"
    style={{ 
      left, 
      top: startTop,
      animationDelay: `${delay}s`,
      animationDuration: `${duration}s`,
    }}
  >
    <Leaf 
      className="text-primary-400 animate-spin-slow" 
      style={{ 
        width: size, 
        height: size,
        opacity: 0.15 + Math.random() * 0.15,
        animationDuration: `${3 + Math.random() * 4}s`,
      }} 
    />
  </div>
);

// Pulsing tree for background
const PulsingTree: React.FC<{
  className: string;
  size: number;
  delay: number;
}> = ({ className, size, delay }) => (
  <div 
    className={`absolute ${className} animate-pulse-gentle`}
    style={{ animationDelay: `${delay}s` }}
  >
    <TreePine 
      className="text-primary-500" 
      style={{ width: size, height: size, opacity: 0.08 }} 
    />
  </div>
);

const PUNE_TREE_FACTS = [
  { stat: '1.79 Million', label: 'Trees cataloged in Pune', icon: TreePine },
  { stat: '288,772 tons', label: 'CO₂ absorbed (lifetime)', icon: Leaf },
  { stat: '77 Wards', label: 'Covered across the city', icon: MapPin },
  { stat: '397+ Species', label: 'Documented tree species', icon: Sparkles },
];

const LOADING_MESSAGES = [
  'Counting trees across Pune...',
  'Calculating CO₂ absorption...',
  'Mapping urban forest data...',
  'Loading ward statistics...',
  'Preparing your green dashboard...',
  'Analyzing tree distribution...',
];

const ProgressiveLoadingOverlay: React.FC<ProgressiveLoadingOverlayProps> = ({
  totalTrees,
  totalCO2Kg,
  wardsLoaded = 0,
  isComplete = false,
}) => {
  const [messageIndex, setMessageIndex] = useState(0);
  const [factIndex, setFactIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [displayedTreeCount, setDisplayedTreeCount] = useState(0);
  const [activeStep, setActiveStep] = useState(0);

  // Rotate through loading messages
  useEffect(() => {
    const messageInterval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % LOADING_MESSAGES.length);
    }, 3000);
    return () => clearInterval(messageInterval);
  }, []);

  // Rotate through facts
  useEffect(() => {
    const factInterval = setInterval(() => {
      setFactIndex((prev) => (prev + 1) % PUNE_TREE_FACTS.length);
    }, 4000);
    return () => clearInterval(factInterval);
  }, []);

  // Animate progress bar and active step
  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (isComplete) return 100;
        const increment = prev < 70 ? 2 : prev < 90 ? 0.5 : 0.1;
        return Math.min(prev + increment, isComplete ? 100 : 95);
      });
    }, 100);
    return () => clearInterval(progressInterval);
  }, [isComplete]);

  // Update active step based on completion
  useEffect(() => {
    const completed = [!!totalTrees, !!totalCO2Kg, wardsLoaded > 0, isComplete];
    const newActiveStep = completed.filter(Boolean).length;
    setActiveStep(newActiveStep);
  }, [totalTrees, totalCO2Kg, wardsLoaded, isComplete]);

  // Animate tree counter when data arrives
  useEffect(() => {
    if (totalTrees && totalTrees > 0) {
      // Animate from 0 to total over 2 seconds
      const targetCount = totalTrees;
      const duration = 2000;
      const steps = 60;
      const increment = targetCount / steps;
      let current = 0;
      
      const countInterval = setInterval(() => {
        current += increment;
        if (current >= targetCount) {
          setDisplayedTreeCount(targetCount);
          clearInterval(countInterval);
        } else {
          setDisplayedTreeCount(Math.floor(current));
        }
      }, duration / steps);
      
      return () => clearInterval(countInterval);
    }
  }, [totalTrees]);

  const currentFact = PUNE_TREE_FACTS[factIndex];
  const FactIcon = currentFact.icon;

  // Calculate CO2 in tons for display
  const co2Tons = useMemo(() => {
    if (!totalCO2Kg) return null;
    return Math.round(totalCO2Kg / 1000);
  }, [totalCO2Kg]);

  // Loading steps based on actual data
  const loadingSteps: LoadingStep[] = useMemo(() => [
    { id: 'trees', label: 'Tree Census Data', completed: !!totalTrees, icon: TreePine },
    { id: 'co2', label: 'Carbon Sequestration', completed: !!totalCO2Kg, icon: Wind },
    { id: 'wards', label: 'Ward Statistics', completed: wardsLoaded > 0, icon: MapPin },
    { id: 'ready', label: 'Dashboard Ready', completed: isComplete, icon: Sparkles },
  ], [totalTrees, totalCO2Kg, wardsLoaded, isComplete]);

  const completedSteps = loadingSteps.filter(s => s.completed).length;

  // Generate floating leaves
  const floatingLeaves = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => ({
      id: i,
      delay: i * 1.5,
      duration: 8 + Math.random() * 6,
      size: 16 + Math.random() * 20,
      left: `${5 + Math.random() * 90}%`,
      startTop: `${-10 - Math.random() * 20}%`,
    }));
  }, []);

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-primary-50 via-white to-green-50 z-[20000] flex flex-col items-center justify-center p-6 overflow-hidden">
      {/* Animated background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Pulsing trees in background */}
        <PulsingTree className="top-10 left-10" size={128} delay={0} />
        <PulsingTree className="bottom-20 right-10" size={96} delay={1.5} />
        <PulsingTree className="top-1/4 right-1/4" size={192} delay={0.8} />
        <PulsingTree className="bottom-1/4 left-1/4" size={144} delay={2.2} />
        
        {/* Floating leaves */}
        {floatingLeaves.map((leaf) => (
          <FloatingLeaf key={leaf.id} {...leaf} />
        ))}
        
        {/* Subtle gradient orbs */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-primary-100/30 via-transparent to-transparent rounded-full animate-pulse-gentle" />
      </div>

      {/* Main content */}
      <div className="relative z-10 max-w-md w-full text-center">
        {/* Logo/Title area */}
        <div className="mb-8">
          <div className="flex items-center justify-center gap-3 mb-2">
            <TreePine className="w-10 h-10 text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-800">Pune Tree Dashboard</h1>
          </div>
          <p className="text-gray-500 text-sm">Urban Forest Intelligence Platform</p>
        </div>

        {/* Animated tree counter - shows real data when available */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-primary-100">
          {displayedTreeCount > 0 ? (
            <div className="animate-fade-in">
              <p className="text-sm text-gray-500 mb-1">Trees Cataloged</p>
              <p className="text-4xl font-bold text-primary-600 tabular-nums">
                {displayedTreeCount.toLocaleString()}
              </p>
              {co2Tons && (
                <p className="text-sm text-orange-500 mt-2 font-medium">
                  🌿 {co2Tons.toLocaleString()} tons CO₂ sequestered
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-center gap-2">
                <FactIcon className="w-6 h-6 text-primary-500" />
                <span className="text-2xl font-bold text-primary-600">{currentFact.stat}</span>
              </div>
              <p className="text-sm text-gray-500">{currentFact.label}</p>
            </div>
          )}
        </div>

        {/* Loading steps indicator - Enhanced with animations */}
        <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-5 mb-6 border border-primary-100 shadow-lg">
          <div className="flex items-center justify-between mb-4 relative">
            {/* Connecting line behind steps */}
            <div className="absolute top-4 left-8 right-8 h-1 bg-gray-200 rounded-full">
              <div 
                className="h-full bg-gradient-to-r from-primary-400 via-primary-500 to-primary-600 rounded-full transition-all duration-700 ease-out"
                style={{ width: `${completedSteps * 33.33}%` }}
              />
            </div>
            
            {loadingSteps.map((step, index) => {
              const StepIcon = step.icon;
              const isActive = index === activeStep - 1 || (index === 0 && activeStep === 0);
              
              return (
                <div key={step.id} className="flex flex-col items-center flex-1 relative z-10">
                  <div 
                    className={`
                      w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold
                      transition-all duration-500 transform
                      ${step.completed 
                        ? 'bg-gradient-to-br from-primary-400 to-primary-600 text-white scale-110 shadow-lg shadow-primary-300/50' 
                        : isActive
                          ? 'bg-primary-100 text-primary-600 scale-105 ring-4 ring-primary-200 animate-pulse'
                          : 'bg-gray-100 text-gray-400 scale-100'
                      }
                    `}
                  >
                    {step.completed ? (
                      <span className="animate-scale-in">✓</span>
                    ) : (
                      <StepIcon className={`w-4 h-4 ${isActive ? 'animate-bounce-gentle' : ''}`} />
                    )}
                  </div>
                  <span 
                    className={`
                      text-xs mt-2 font-medium transition-all duration-300
                      ${step.completed 
                        ? 'text-primary-600' 
                        : isActive 
                          ? 'text-primary-500'
                          : 'text-gray-400'
                      }
                    `}
                  >
                    {step.label.split(' ')[0]}
                  </span>
                  {/* Glow effect for completed steps */}
                  {step.completed && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-primary-400/30 animate-ping" style={{ animationDuration: '2s' }} />
                  )}
                </div>
              );
            })}
          </div>
          
          {/* Progress bar with shimmer effect */}
          <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden relative">
            <div 
              className="h-full bg-gradient-to-r from-primary-400 via-primary-500 to-primary-600 rounded-full transition-all duration-300 ease-out relative overflow-hidden"
              style={{ width: `${Math.max(progress, completedSteps * 25)}%` }}
            >
              {/* Shimmer effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
            </div>
          </div>
        </div>

        {/* Current action message */}
        <div className="flex items-center justify-center gap-2 text-gray-600">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
          </div>
          <span className="text-sm font-medium animate-pulse">
            {LOADING_MESSAGES[messageIndex]}
          </span>
        </div>

        {/* Fun fact footer */}
        <div className="mt-8 text-xs text-gray-400">
          <p className="flex items-center justify-center gap-1">
            <BarChart3 className="w-3 h-3" />
            Data sourced from Pune Municipal Corporation Tree Census
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProgressiveLoadingOverlay;
