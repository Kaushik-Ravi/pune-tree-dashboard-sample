// src/components/sidebar/tabs/CityOverview.tsx
import React, { useState, useEffect } from 'react';
import { XCircle, BarChartBig, Filter } from 'lucide-react';
import CityOverviewCharts from './CityOverviewCharts';
import { useTreeStore } from '../../../store/TreeStore';
import { useFilters } from '../../../store/FilterStore';
import { ActiveFilterChips } from '../../filters';
import InfoPopover from '../../common/InfoPopover';



const CityOverview: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="card">
        <div className="card-header flex justify-between items-center">
          <h3 className="text-lg font-medium">Charts</h3>
        </div>
        <div className="card-body space-y-4">
          <CityOverviewCharts />
        </div>
      </div>
    </div>
  );
};
    </div>
  );
};

export default CityOverview;