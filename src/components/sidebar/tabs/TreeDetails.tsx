// src/components/sidebar/tabs/TreeDetails.tsx
import React, { useEffect, useState } from 'react';
import { Info, Leaf, CircleDashed, Thermometer, TreePine } from 'lucide-react';
import { useTreeStore } from '../../../store/TreeStore';

interface TreeDetailsProps {
  treeId: string | null;
}

const TreeDetails: React.FC<TreeDetailsProps> = ({ treeId }) => {
  const { getTreeDetails } = useTreeStore();
  const [treeDetails, setTreeDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (treeId) {
      setLoading(true);
      const details = getTreeDetails(treeId);
      setTreeDetails(details);
      setLoading(false);
    } else {
      setTreeDetails(null);
    }
  }, [treeId, getTreeDetails]);

  if (!treeId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <TreePine size={48} className="text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-700 mb-2">No Tree Selected</h3>
        <p className="text-gray-500">
          Click on a tree on the map and select "View Details" to see information about that tree.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!treeDetails) {
    return (
      <div className="text-center p-6">
        <h3 className="text-lg font-medium text-gray-700 mb-2">Tree Not Found</h3>
        <p className="text-gray-500">
          Could not find details for the selected tree.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with tree name and ID */}
      <div className="bg-primary-50 rounded-lg p-4">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-primary-800">{treeDetails.common_name}</h2>
            <p className="text-gray-600 italic">{treeDetails.botanical_name_short}</p>
          </div>
          <span className="bg-primary-100 text-primary-800 text-xs font-medium px-2.5 py-1 rounded-full">
            ID: {treeDetails.id}
          </span>
        </div>
      </div>

      {/* Tree dimensions section */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-medium flex items-center">
            <CircleDashed size={18} className="mr-2 text-gray-500" />
            Dimensions
          </h3>
        </div>
        <div className="card-body grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="text-sm text-gray-500">Height</div>
            <div className="text-lg font-semibold">{treeDetails.height_m?.toFixed(2) || 'N/A'} m</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-500">Girth</div>
            <div className="text-lg font-semibold">{treeDetails.girth_cm?.toFixed(2) || 'N/A'} cm</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-500">Canopy Diameter</div>
            <div className="text-lg font-semibold">{treeDetails.canopy_dia_m?.toFixed(2) || 'N/A'} m</div>
          </div>
        </div>
      </div>

      {/* Environmental impact section */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-medium flex items-center">
            <Leaf size={18} className="mr-2 text-gray-500" />
            Environmental Impact
          </h3>
        </div>
        <div className="card-body">
          <div className="flex items-center justify-between bg-green-50 p-3 rounded-md">
            <div>
              <div className="text-sm text-gray-500">CO₂ Sequestered</div>
              <div className="text-lg font-semibold text-success-500">
                {treeDetails.CO2_sequestered_kg?.toFixed(2) || 'N/A'} kg
              </div>
            </div>
            <div className="text-3xl text-success-500">
              <Thermometer size={36} />
            </div>
          </div>
        </div>
      </div>

      {/* Additional information section - UPDATED GRID LAYOUT */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-medium flex items-center">
            <Info size={18} className="mr-2 text-gray-500" />
            Additional Information
          </h3>
        </div>
        <div className="card-body">
          {/* Changed to grid-cols-2 for all items in this section */}
          <div className="grid grid-cols-2 gap-x-4 gap-y-3"> {/* gap-y-3 for vertical spacing between rows */}
            <div>
              <div className="text-sm text-gray-500">Ward</div>
              <div className="text-base">{treeDetails.ward ? `Ward ${treeDetails.ward}` : 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Economic Importance</div>
              <div className="text-base">{treeDetails.economic_i || 'N/A'}</div>
            </div>
            <div> {/* Flowering now in the first column of the second row */}
              <div className="text-sm text-gray-500">Flowering</div>
              <div className="text-base">{treeDetails.flowering || 'N/A'}</div>
            </div>
            <div> {/* Wood Density now in the second column of the second row */}
              <div className="text-sm text-gray-500">Wood Density</div>
              <div className="text-base">{treeDetails.wood_density?.toFixed(2) || 'N/A'} g/cm³</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TreeDetails;