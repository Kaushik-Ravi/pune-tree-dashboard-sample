// src/components/filters/QuickFilterChips.tsx
// Quick one-tap filter preset chips for common filter combinations

import React from 'react';
import { Apple, Pill, Flower2, TreeDeciduous, Leaf, CircleDot } from 'lucide-react';
import { useFilters } from '../../store/FilterStore';

interface QuickChip {
  id: string;
  label: string;
  icon: React.ReactNode;
  /** Check if this chip is currently active based on filters */
  isActive: (filters: ReturnType<typeof useFilters>['filters']) => boolean;
  /** Apply this chip's filter */
  apply: (updateFilter: ReturnType<typeof useFilters>['updateFilter']) => void;
  /** Remove this chip's filter */
  remove: (updateFilter: ReturnType<typeof useFilters>['updateFilter']) => void;
}

// Purpose-based quick filters (Economic Importance)
const purposeChips: QuickChip[] = [
  {
    id: 'fruit',
    label: 'Fruit Trees',
    icon: <Apple size={14} />,
    isActive: (filters) => filters.economicImportance === 'Fruit',
    apply: (updateFilter) => updateFilter('economicImportance', 'Fruit'),
    remove: (updateFilter) => updateFilter('economicImportance', null),
  },
  {
    id: 'medicinal',
    label: 'Medicinal',
    icon: <Pill size={14} />,
    isActive: (filters) => filters.economicImportance === 'Medicinal',
    apply: (updateFilter) => updateFilter('economicImportance', 'Medicinal'),
    remove: (updateFilter) => updateFilter('economicImportance', null),
  },
  {
    id: 'ornamental',
    label: 'Ornamental',
    icon: <Flower2 size={14} />,
    isActive: (filters) => filters.economicImportance === 'Ornamental',
    apply: (updateFilter) => updateFilter('economicImportance', 'Ornamental'),
    remove: (updateFilter) => updateFilter('economicImportance', null),
  },
];

// Size-based quick filters (Range presets)
const sizeChips: QuickChip[] = [
  {
    id: 'tall',
    label: 'Tall (>10m)',
    icon: <TreeDeciduous size={14} />,
    isActive: (filters) => filters.height.min !== null && filters.height.min >= 10,
    apply: (updateFilter) => updateFilter('height', { min: 10, max: null }),
    remove: (updateFilter) => updateFilter('height', { min: null, max: null }),
  },
  {
    id: 'highCO2',
    label: 'High CO₂',
    icon: <Leaf size={14} />,
    isActive: (filters) => filters.co2Sequestered.min !== null && filters.co2Sequestered.min >= 200,
    apply: (updateFilter) => updateFilter('co2Sequestered', { min: 200, max: null }),
    remove: (updateFilter) => updateFilter('co2Sequestered', { min: null, max: null }),
  },
  {
    id: 'largeCanopy',
    label: 'Large Canopy',
    icon: <CircleDot size={14} />,
    isActive: (filters) => filters.canopyDiameter.min !== null && filters.canopyDiameter.min >= 6,
    apply: (updateFilter) => updateFilter('canopyDiameter', { min: 6, max: null }),
    remove: (updateFilter) => updateFilter('canopyDiameter', { min: null, max: null }),
  },
];

// Popular species for quick selection
const POPULAR_SPECIES = ['Neem', 'Mango', 'Coconut', 'Banyan', 'Peepal'];

interface QuickFilterChipsProps {
  /** Show compact version for mobile */
  compact?: boolean;
}

const QuickFilterChips: React.FC<QuickFilterChipsProps> = ({ compact = false }) => {
  const { filters, updateFilter } = useFilters();

  const handleChipClick = (chip: QuickChip) => {
    if (chip.isActive(filters)) {
      chip.remove(updateFilter);
    } else {
      chip.apply(updateFilter);
    }
  };

  const handleSpeciesChipClick = (species: string) => {
    const currentSpecies = filters.species;
    if (currentSpecies.includes(species)) {
      // Remove species
      updateFilter('species', currentSpecies.filter(s => s !== species));
    } else {
      // Add species
      updateFilter('species', [...currentSpecies, species]);
    }
  };

  const ChipButton: React.FC<{
    chip: QuickChip;
    active: boolean;
  }> = ({ chip, active }) => (
    <button
      type="button"
      onClick={() => handleChipClick(chip)}
      className={`
        inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium
        transition-all duration-200 border
        ${active
          ? 'bg-primary-100 border-primary-300 text-primary-700 shadow-sm'
          : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
        }
      `}
    >
      {chip.icon}
      <span>{chip.label}</span>
    </button>
  );

  const SpeciesChip: React.FC<{ species: string }> = ({ species }) => {
    const isActive = filters.species.includes(species);
    return (
      <button
        type="button"
        onClick={() => handleSpeciesChipClick(species)}
        className={`
          inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium
          transition-all duration-200 border
          ${isActive
            ? 'bg-emerald-100 border-emerald-300 text-emerald-700'
            : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
          }
        `}
      >
        🌳 {species}
      </button>
    );
  };

  if (compact) {
    // Mobile compact version - horizontal scroll
    return (
      <div className="space-y-3">
        {/* Purpose chips */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5">Quick Filters</p>
          <div className="flex flex-wrap gap-2">
            {purposeChips.map((chip) => (
              <ChipButton key={chip.id} chip={chip} active={chip.isActive(filters)} />
            ))}
            {sizeChips.map((chip) => (
              <ChipButton key={chip.id} chip={chip} active={chip.isActive(filters)} />
            ))}
          </div>
        </div>

        {/* Popular species */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5">Popular Species</p>
          <div className="flex flex-wrap gap-1.5">
            {POPULAR_SPECIES.map((species) => (
              <SpeciesChip key={species} species={species} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Desktop version
  return (
    <div className="space-y-4">
      {/* Purpose-based quick filters */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Purpose</p>
        <div className="flex flex-wrap gap-2">
          {purposeChips.map((chip) => (
            <ChipButton key={chip.id} chip={chip} active={chip.isActive(filters)} />
          ))}
        </div>
      </div>

      {/* Size-based quick filters */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Tree Size</p>
        <div className="flex flex-wrap gap-2">
          {sizeChips.map((chip) => (
            <ChipButton key={chip.id} chip={chip} active={chip.isActive(filters)} />
          ))}
        </div>
      </div>

      {/* Popular species quick access */}
      <div>
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Popular Species</p>
        <div className="flex flex-wrap gap-1.5">
          {POPULAR_SPECIES.map((species) => (
            <SpeciesChip key={species} species={species} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuickFilterChips;
