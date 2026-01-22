// src/components/common/ProgressiveLoadingOverlay.tsx
// Engaging initial loading screen with real stats and progress indicators

import React, { useState, useEffect, useMemo } from 'react';
import { TreePine, Leaf, MapPin, BarChart3, Sparkles } from 'lucide-react';

interface LoadingStep {
  id: string;
  label: string;
  completed: boolean;
}

interface ProgressiveLoadingOverlayProps {
  /** Total trees count - shown when loaded */
  totalTrees?: number | null;
  /** Total CO2 in kg */
  totalCO2Kg?: number | null;
  /** Number of wards loaded */
  wardsLoaded?: number;
  /** Whether all data is loaded */
  isComplete?: boolean;
}

// Engaging facts about Pune's urban forest - shown during loading
const PUNE_TREE_FACTS = [
  { stat: '1.79 Million', label: 'Trees cataloged in Pune', icon: TreePine },
  { stat: '288,772 tons', label: 'CO₂ absorbed (lifetime)', icon: Leaf },
  { stat: '77 Wards', label: 'Covered across the city', icon: MapPin },
  { stat: '397+ Species', label: 'Documented tree species', icon: Sparkles },
];

// Rotating loading messages
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

  // Animate progress bar
  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        if (isComplete) return 100;
        // Slow down as we approach completion to avoid stalling at 99%
        const increment = prev < 70 ? 2 : prev < 90 ? 0.5 : 0.1;
        return Math.min(prev + increment, isComplete ? 100 : 95);
      });
    }, 100);
    return () => clearInterval(progressInterval);
  }, [isComplete]);

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
    { id: 'trees', label: 'Tree Census Data', completed: !!totalTrees },
    { id: 'co2', label: 'Carbon Sequestration', completed: !!totalCO2Kg },
    { id: 'wards', label: 'Ward Statistics', completed: wardsLoaded > 0 },
    { id: 'ready', label: 'Dashboard Ready', completed: isComplete },
  ], [totalTrees, totalCO2Kg, wardsLoaded, isComplete]);

  const completedSteps = loadingSteps.filter(s => s.completed).length;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-primary-50 via-white to-green-50 z-[20000] flex flex-col items-center justify-center p-6">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 opacity-10">
          <TreePine className="w-32 h-32 text-primary-600" />
        </div>
        <div className="absolute bottom-20 right-10 opacity-10">
          <Leaf className="w-24 h-24 text-primary-500 animate-bounce" style={{ animationDuration: '3s' }} />
        </div>
        <div className="absolute top-1/4 right-1/4 opacity-5">
          <TreePine className="w-48 h-48 text-primary-400" />
        </div>
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

        {/* Loading steps indicator */}
        <div className="bg-white/80 backdrop-blur rounded-xl p-4 mb-6 border border-gray-100">
          <div className="flex items-center justify-between mb-3">
            {loadingSteps.map((step, index) => (
              <div key={step.id} className="flex flex-col items-center flex-1">
                <div 
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-500 ${
                    step.completed 
                      ? 'bg-primary-500 text-white scale-110' 
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {step.completed ? '✓' : index + 1}
                </div>
                <span className={`text-xs mt-1 ${step.completed ? 'text-primary-600 font-medium' : 'text-gray-400'}`}>
                  {step.label.split(' ')[0]}
                </span>
              </div>
            ))}
          </div>
          
          {/* Progress bar */}
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-primary-400 to-primary-600 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.max(progress, completedSteps * 25)}%` }}
            />
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
