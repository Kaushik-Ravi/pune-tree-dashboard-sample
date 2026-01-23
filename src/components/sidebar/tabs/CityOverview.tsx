// src/components/sidebar/tabs/CityOverview.tsx
import React from 'react';
import CityOverviewCharts from './CityOverviewCharts';

const CityOverview: React.FC = () => (
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

export default CityOverview;