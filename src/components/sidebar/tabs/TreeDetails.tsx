// src/components/sidebar/tabs/TreeDetails.tsx
import React, { useEffect, useState } from 'react';
import { Info, Leaf, CircleDashed, Thermometer, TreePine } from 'lucide-react';
import { useTreeStore } from '../../../store/TreeStore';

interface TreeDetailsProps {
  treeId: string | null;
}

// Define a type for the details to be displayed
interface TreeDetailsData {
    id: string;
    girth_cm: number | null;
    height_m: number | null;
    canopy_dia_m: number | null;
    common_name: string;
    botanical_name: string | null;
    co2_sequestered_kg: number | null;
    ward: string | null;
    economic_i: string | null;
    flowering: string | null;
    wood_density: number | null;
    // Optional, available for Mysuru-side live mapathon submissions
    image_url?: string | null;
    status?: string;
    created_at?: string;
    mapped_by_user_id?: string | null;
    condition?: string | null;
    ownership?: string | null;
}

const TreeDetails: React.FC<TreeDetailsProps> = ({ treeId }) => {
  const { getTreeDetails } = useTreeStore();
  const [treeDetails, setTreeDetails] = useState<TreeDetailsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (treeId) {
      const fetchDetails = async () => {
        setLoading(true);
        setError(null);
        setTreeDetails(null);
        try {
          const details = await getTreeDetails(treeId);
          if (details) {
            setTreeDetails(details);
          } else {
            setError('Could not find details for the selected tree.');
          }
        } catch (err) {
            setError('An error occurred while fetching tree details.');
            console.error(err);
        } finally {
            setLoading(false);
        }
      };
      fetchDetails();
    } else {
      setTreeDetails(null);
      setLoading(false);
      setError(null);
    }
  }, [treeId, getTreeDetails]);

  if (!treeId) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <TreePine size={48} className="text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-700 mb-2">No Tree Selected</h3>
        <p className="text-gray-500">
          Click on a tree on the map to see its details here.
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

  if (error || !treeDetails) {
    return (
      <div className="text-center p-6 bg-red-50 border border-red-200 rounded-md">
        <h3 className="text-lg font-medium text-red-700 mb-2">Error</h3>
        <p className="text-red-600">
          {error || 'Tree details could not be loaded.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with tree name and ID */}
      <div className="bg-primary-50 rounded-lg p-4">
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold text-primary-800 break-words">{treeDetails.common_name}</h2>
            {treeDetails.botanical_name && (
              <p className="text-gray-600 italic break-words">{treeDetails.botanical_name}</p>
            )}
            {treeDetails.status && (
              <span className={`mt-2 inline-block text-xs font-medium px-2 py-0.5 rounded-full ${
                treeDetails.status === 'verified' || treeDetails.status === 'COMPLETE'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-amber-100 text-amber-700'
              }`}>
                {treeDetails.status}
              </span>
            )}
          </div>
          <span className="bg-primary-100 text-primary-800 text-xs font-medium px-2.5 py-1 rounded-full whitespace-nowrap">
            ID: {String(treeDetails.id).slice(0, 8)}
          </span>
        </div>
        {treeDetails.created_at && (
          <p className="text-xs text-gray-500 mt-2">
            Mapped {new Date(treeDetails.created_at).toLocaleDateString()} at {new Date(treeDetails.created_at).toLocaleTimeString()}
          </p>
        )}
      </div>

      {/* Tree photo (when available — e.g., Mysuru mapathon submissions) */}
      {treeDetails.image_url && (
        <div className="card overflow-hidden">
          <img
            src={treeDetails.image_url}
            alt={treeDetails.common_name}
            className="w-full h-48 object-cover"
            loading="lazy"
          />
        </div>
      )}

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
              <div className="text-lg font-semibold text-green-700">
                {treeDetails.co2_sequestered_kg?.toFixed(2) || 'N/A'} kg
              </div>
            </div>
            {/* Using a simple leaf icon from lucide */}
            <Leaf size={36} className="text-green-600 opacity-80" />
          </div>
        </div>
      </div>

      {/* Additional information section */}
      <div className="card">
        <div className="card-header">
          <h3 className="font-medium flex items-center">
            <Info size={18} className="mr-2 text-gray-500" />
            Additional Information
          </h3>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <div className="text-sm text-gray-500">Ward</div>
              <div className="text-base">{treeDetails.ward ? `Ward ${treeDetails.ward}` : 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Wood Density</div>
              <div className="text-base">
                {treeDetails.wood_density != null
                  ? `${treeDetails.wood_density.toFixed(2)} g/cm³`
                  : 'N/A'}
              </div>
            </div>
            {treeDetails.condition && (
              <div>
                <div className="text-sm text-gray-500">Condition</div>
                <div className="text-base">{treeDetails.condition}</div>
              </div>
            )}
            {treeDetails.ownership && (
              <div>
                <div className="text-sm text-gray-500">Ownership</div>
                <div className="text-base">{treeDetails.ownership}</div>
              </div>
            )}
            {treeDetails.economic_i && (
              <div>
                <div className="text-sm text-gray-500">Economic Importance</div>
                <div className="text-base">{treeDetails.economic_i}</div>
              </div>
            )}
            {treeDetails.flowering && (
              <div>
                <div className="text-sm text-gray-500">Flowering</div>
                <div className="text-base">{treeDetails.flowering}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TreeDetails;