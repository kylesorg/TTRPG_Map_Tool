import React, { useState, useEffect } from 'react';
import type { HexTile } from '../../types/mapTypes';
import type { TownSizeCategory } from '../../types/townTypes';

interface HexDetailPanelProps {
    selectedHex: HexTile | null;
    onUpdateNotes: (updatedNotes: string) => void;
    onUpdateEncounterNotes: (updatedEncounterNotes: string) => void;
    onEnterTown: (townId: string) => void;
    onDesignateTown: (hexId: string, townName: string, townSize: TownSizeCategory) => void;
    onUndesignateTown: (hexId: string) => void; // Added
}

const HexDetailPanel: React.FC<HexDetailPanelProps> = ({
    selectedHex,
    onUpdateNotes,
    onUpdateEncounterNotes,
    onEnterTown,
    onDesignateTown,
    onUndesignateTown, // Added
}) => {
    const [notes, setNotes] = useState('');
    const [encounterNotes, setEncounterNotes] = useState('');
    const [isEditingNotes, setIsEditingNotes] = useState(false);
    const [isEditingEncounterNotes, setIsEditingEncounterNotes] = useState(false);
    const [selectedTownSize, setSelectedTownSize] = useState<TownSizeCategory>('Medium');
    const [townNameInput, setTownNameInput] = useState(''); // Added for controlled input

    useEffect(() => {
        if (selectedHex) {
            setNotes(selectedHex.notes || '');
            setEncounterNotes(selectedHex.encounters && selectedHex.encounters.length > 0 ? selectedHex.encounters.join('\\n') : (selectedHex as any).encounterNotes || '');
            // Set initial town name for designation input if hex is not a town
            if (!selectedHex.isTown) {
                // Use coordinates from hex ID if labelX/labelY are undefined
                const coordsFromId = selectedHex.id.split(',');
                const fallbackX = selectedHex.labelX ?? (coordsFromId[0] ? parseInt(coordsFromId[0]) : 0);
                const fallbackY = selectedHex.labelY ?? (coordsFromId[1] ? parseInt(coordsFromId[1]) : 0);
                setTownNameInput(`Town at ${fallbackX},${fallbackY}`);
            } else {
                setTownNameInput(''); // Clear if it is a town
            }
        } else {
            setNotes('');
            setEncounterNotes('');
            setTownNameInput('');
        }
        setIsEditingNotes(false);
        setIsEditingEncounterNotes(false);
    }, [selectedHex]);

    if (!selectedHex) {
        return (
            <div style={{ padding: '10px' }}>
                Select a hex to see details.
            </div>
        );
    }

    const handleSaveNotes = () => {
        onUpdateNotes(notes);
        setIsEditingNotes(false);
    };

    const handleSaveEncounterNotes = () => {
        onUpdateEncounterNotes(encounterNotes);
        setIsEditingEncounterNotes(false);
    };

    const handleDesignateTownClick = () => {
        if (selectedHex && !selectedHex.isTown && townNameInput.trim() !== '') {
            onDesignateTown(selectedHex.id, townNameInput.trim(), selectedTownSize);
        } else if (townNameInput.trim() === '') {
            alert('Please enter a name for the town.');
        }
    };

    const handleUndesignateTownClick = () => {
        if (selectedHex && selectedHex.isTown && selectedHex.id) {
            onUndesignateTown(selectedHex.id);
        }
    };

    return (
        <div style={{ padding: '10px' }}>
            <h3>Hex Details</h3>
            <p>Coords X: {selectedHex.labelX ?? 'N/A'}, Y: {selectedHex.labelY ?? 'N/A'}</p>
            <p>Axial Coords (q,r,s): {selectedHex.coordinates.q}, {selectedHex.coordinates.r}, {-selectedHex.coordinates.q - selectedHex.coordinates.r}</p>
            <p>Biome: {selectedHex.biome.name}</p>
            <p>Color: <span style={{ display: 'inline-block', width: '12px', height: '12px', backgroundColor: selectedHex.biome.color, border: '1px solid #555' }}></span> {selectedHex.biome.color}</p>

            {selectedHex.isTown && selectedHex.townName && (
                <p><strong>Town: {selectedHex.townName}</strong></p>
            )}

            {/* Town Management Section */}
            <div style={{ borderTop: '1px solid #ccc', paddingTop: '15px', marginTop: '15px' }}>
                {!selectedHex.isTown ? (
                    <>
                        <h4>Designate as New Town</h4>
                        <div>
                            <label htmlFor="townNameInput">Town Name: </label>
                            <input
                                type="text"
                                id="townNameInput"
                                value={townNameInput}
                                onChange={(e) => setTownNameInput(e.target.value)}
                                placeholder="Enter town name"
                                style={{ marginBottom: '10px', width: 'calc(100% - 12px)' }}
                            />
                        </div>
                        <div>
                            <label htmlFor="townSizeSelect">Town Size: </label>
                            <select
                                id="townSizeSelect"
                                value={selectedTownSize}
                                onChange={(e) => setSelectedTownSize(e.target.value as TownSizeCategory)}
                                style={{ marginBottom: '10px' }}
                            >
                                <option value="Small">Small (220x124)</option>
                                <option value="Medium">Medium (330x186)</option>
                                <option value="Large">Large (440x248)</option>
                            </select>
                        </div>
                        <button onClick={handleDesignateTownClick} style={{ marginTop: '5px' }} className="panel-button">
                            Designate Town
                        </button>
                    </>
                ) : (
                    <>
                        <h4>Town Information</h4>
                        {/* <p><strong>Town Label:</strong> {selectedHex.townName || 'Unnamed Town'}</p> */}
                        <button
                            onClick={() => selectedHex.townId && onEnterTown(selectedHex.townId)}
                            className="panel-button"
                            style={{ marginRight: '10px' }} // Keep margin for spacing
                            disabled={!selectedHex.townId}
                        >
                            Enter Town
                        </button>
                        <button
                            onClick={handleUndesignateTownClick}
                            className="panel-button button-danger"
                        >
                            Remove Town Designation
                        </button>
                    </>
                )}
            </div>

            <div>
                <strong>Notes:</strong>
                {isEditingNotes ? (
                    <>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={3}
                            style={{ width: '100%', marginTop: '5px', boxSizing: 'border-box', backgroundColor: '#333', color: '#ddd', border: '1px solid #555' }}
                        />
                        <button onClick={handleSaveNotes} style={{ marginTop: '5px' }} className="panel-button">Save</button>
                        <button onClick={() => { setIsEditingNotes(false); setNotes(selectedHex.notes || ''); }} style={{ marginTop: '5px', marginLeft: '5px' }} className="panel-button">Cancel</button>
                    </>
                ) : (
                    <>
                        <p style={{ whiteSpace: 'pre-wrap', margin: '5px 0 0 0', minHeight: '40px', background: '#2c2c2c', border: '1px solid #444', padding: '5px', borderRadius: '3px' }}>{notes || 'No notes yet.'}</p>
                        <button onClick={() => setIsEditingNotes(true)} style={{ marginTop: '5px' }} className="panel-button">Edit Notes</button>
                    </>
                )}
            </div>

            <div>
                <strong>Encounter Notes:</strong>
                {isEditingEncounterNotes ? (
                    <>
                        <textarea
                            value={encounterNotes}
                            onChange={(e) => setEncounterNotes(e.target.value)}
                            rows={3}
                            style={{ width: '100%', marginTop: '5px', boxSizing: 'border-box', backgroundColor: '#333', color: '#ddd', border: '1px solid #555' }}
                        />
                        <button onClick={handleSaveEncounterNotes} style={{ marginTop: '5px' }} className="panel-button">Save</button>
                        <button onClick={() => { setIsEditingEncounterNotes(false); setEncounterNotes((selectedHex as any).encounterNotes || ''); }} style={{ marginTop: '5px', marginLeft: '5px' }} className="panel-button">Cancel</button>
                    </>
                ) : (
                    <>
                        <p style={{ whiteSpace: 'pre-wrap', margin: '5px 0 0 0', minHeight: '40px', background: '#2c2c2c', border: '1px solid #444', padding: '5px', borderRadius: '3px' }}>{encounterNotes || 'No encounter notes yet.'}</p>
                        <button onClick={() => setIsEditingEncounterNotes(true)} style={{ marginTop: '5px' }} className="panel-button">Edit Encounter Notes</button>
                    </>
                )}
            </div>
        </div>
    );
};

export default HexDetailPanel;
