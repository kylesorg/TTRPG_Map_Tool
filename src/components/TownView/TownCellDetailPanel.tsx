import React from 'react';
import type { TownCell, TownCellCoordinates } from '../../types/townTypes';
import type { TownMaterial } from '../../types/mapTypes';

interface TownCellDetailPanelProps {
    selectedCell: TownCell | null;
    availableTownMaterials?: TownMaterial[];
    onUpdateMaterial: (coords: TownCellCoordinates, newMaterialStyle: string) => void;
}

const TownCellDetailPanel: React.FC<TownCellDetailPanelProps> = ({
    selectedCell,
    availableTownMaterials = [],
    // onUpdateMaterial, // This is now unused since we removed the selector
}) => {
    if (!selectedCell) {
        return (
            <div style={{ padding: '10px', borderLeft: '1px solid #444', height: '100%' }}>
                <p>No cell selected.</p>
            </div>
        );
    }

    const coordsToDisplay = selectedCell.coordinates;

    let materialName = 'Unassigned';
    let materialColor = '#fff';
    if (selectedCell.material) {
        const found = availableTownMaterials.find(m => m.style === selectedCell.material);
        if (found) {
            materialName = found.name;
            materialColor = found.color;
        } else {
            materialName = selectedCell.material;
            materialColor = '#fff';
        }
    }

    return (
        <div style={{ padding: '10px', borderLeft: '1px solid #444', height: '100%', overflowY: 'auto', backgroundColor: '#2f2f2f', color: '#eee' }}>
            <h4>Cell Details</h4>
            {coordsToDisplay && (
                <p>Coordinates: X: {coordsToDisplay.x}, Y: {coordsToDisplay.y}</p>
            )}
            {selectedCell ? (
                <>
                    <p>
                        Material: <span style={{ display: 'inline-block', width: 16, height: 16, backgroundColor: materialColor, border: '1px solid #555', verticalAlign: 'middle', marginRight: 6 }} />
                        {materialName} <span style={{ color: '#aaa', fontSize: '0.9em' }}>{materialColor}</span>
                    </p>
                    {selectedCell.buildingId && <p style={{ marginTop: '10px' }}>Building ID: {selectedCell.buildingId}</p>}
                </>
            ) : (
                <p>Loading cell data...</p>
            )}
        </div>
    );
};

export default TownCellDetailPanel;
