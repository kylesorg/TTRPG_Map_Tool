import React, { useState } from 'react';
import { SketchPicker } from 'react-color';
import type { ColorResult } from 'react-color';
import type { Biome } from '../../types/mapTypes';

interface BiomeSelectorProps {
    availableBiomes: Biome[];
    onBiomeSelect: (biome: Biome) => void;
    selectedBiomeName?: string;
    onBiomeColorChange: (biomeName: string, newColor: string) => void;
    onBiomeAdd?: (biomeName: string, color: string) => void;
    onBiomeRename?: (oldName: string, newName: string) => void;
    onBiomeDelete?: (biomeName: string) => void;
}

const BiomeSelector: React.FC<BiomeSelectorProps> = ({
    availableBiomes,
    onBiomeSelect,
    selectedBiomeName,
    onBiomeColorChange,
    onBiomeAdd,
    onBiomeRename,
    onBiomeDelete
}) => {
    const [editingBiome, setEditingBiome] = useState<Biome | null>(null);
    const [contextMenu, setContextMenu] = useState<{ biome: Biome; x: number; y: number } | null>(null);
    const [renamingBiome, setRenamingBiome] = useState<Biome | null>(null);
    const [newBiomeName, setNewBiomeName] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [addBiomeName, setAddBiomeName] = useState('');

    const handleColorClick = (e: React.MouseEvent, biome: Biome) => {
        e.stopPropagation();
        setEditingBiome(biome);
    };

    const handleColorChange = (colorResult: ColorResult) => {
        if (editingBiome) {
            const { r, g, b, a } = colorResult.rgb;
            const finalA = a === undefined ? 1 : a;
            const newColor = `rgba(${r}, ${g}, ${b}, ${finalA})`;
            onBiomeColorChange(editingBiome.name, newColor);
            setEditingBiome({ ...editingBiome, color: newColor });
        }
    };

    const handleClosePicker = () => {
        if (editingBiome) {
            // Auto-select the biome we just changed the color for
            onBiomeSelect(editingBiome);
        }
        setEditingBiome(null);
    };

    const handleRightClick = (e: React.MouseEvent, biome: Biome) => {
        e.preventDefault();
        e.stopPropagation();

        // Don't allow context menu on "Unassigned" biome
        if (biome.name === 'Unassigned') return;

        setContextMenu({
            biome,
            x: e.clientX,
            y: e.clientY
        });
    };

    const handleRename = (biome: Biome) => {
        setRenamingBiome(biome);
        setNewBiomeName(biome.name);
        setContextMenu(null);
    };

    const handleConfirmRename = () => {
        if (renamingBiome && newBiomeName.trim() && onBiomeRename) {
            const trimmedName = newBiomeName.trim();

            // Check if name already exists
            if (availableBiomes.some(b => b.name.toLowerCase() === trimmedName.toLowerCase() && b.name !== renamingBiome.name)) {
                alert(`A biome named "${trimmedName}" already exists. Please choose a different name.`);
                return;
            }

            onBiomeRename(renamingBiome.name, trimmedName);
        }
        setRenamingBiome(null);
        setNewBiomeName('');
    };

    const handleCancelRename = () => {
        setRenamingBiome(null);
        setNewBiomeName('');
    };

    const handleDelete = (biome: Biome) => {
        if (onBiomeDelete && window.confirm(`Are you sure you want to delete "${biome.name}"? This cannot be undone. All hexes/squares assigned to this biome will be set to "Unassigned".`)) {
            onBiomeDelete(biome.name);
        }
        setContextMenu(null);
    };

    const handleAddBiome = () => {
        if (addBiomeName.trim() && onBiomeAdd) {
            const trimmedName = addBiomeName.trim();

            // Check if name already exists
            if (availableBiomes.some(b => b.name.toLowerCase() === trimmedName.toLowerCase())) {
                alert(`A biome named "${trimmedName}" already exists. Please choose a different name.`);
                return;
            }

            onBiomeAdd(trimmedName, '#FFFFFF'); // Default to white
        }
        setAddBiomeName('');
        setShowAddForm(false);
    };

    const handleCancelAdd = () => {
        setAddBiomeName('');
        setShowAddForm(false);
    };

    // Close context menu when clicking outside
    React.useEffect(() => {
        const handleClick = () => setContextMenu(null);
        if (contextMenu) {
            document.addEventListener('click', handleClick);
            return () => document.removeEventListener('click', handleClick);
        }
    }, [contextMenu]);

    const cover: React.CSSProperties = {
        position: 'fixed',
        top: '0px',
        right: '0px',
        bottom: '0px',
        left: '0px',
    };

    return (
        <div style={{ marginTop: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h4 style={{ margin: 0, fontSize: '14px', color: 'black' }}>Biomes</h4>
                {onBiomeAdd && (
                    <button
                        onClick={() => setShowAddForm(true)}
                        style={{
                            padding: '4px 8px',
                            fontSize: '12px',
                            background: '#4CAF50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '3px',
                            cursor: 'pointer'
                        }}
                    >
                        + Add
                    </button>
                )}
            </div>

            {/* Add Form */}
            {showAddForm && (
                <div style={{
                    padding: '8px',
                    background: '#f9f9f9',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    marginBottom: '8px'
                }}>
                    <input
                        type="text"
                        value={addBiomeName}
                        onChange={(e) => setAddBiomeName(e.target.value)}
                        placeholder="Enter biome name"
                        style={{
                            width: '100%',
                            padding: '4px',
                            marginBottom: '4px',
                            border: '1px solid #ccc',
                            borderRadius: '2px',
                            color: 'black',
                            backgroundColor: 'white'
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddBiome();
                            if (e.key === 'Escape') handleCancelAdd();
                        }}
                        autoFocus
                    />
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                            onClick={handleAddBiome}
                            style={{
                                padding: '4px 8px',
                                fontSize: '11px',
                                background: '#4CAF50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '2px',
                                cursor: 'pointer'
                            }}
                        >
                            Add
                        </button>
                        <button
                            onClick={handleCancelAdd}
                            style={{
                                padding: '4px 8px',
                                fontSize: '11px',
                                background: '#999',
                                color: 'white',
                                border: 'none',
                                borderRadius: '2px',
                                cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Biome List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {availableBiomes.map((biome) => (
                    <div key={biome.name} style={{ position: 'relative' }}>
                        {renamingBiome?.name === biome.name ? (
                            // Rename Form
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '4px',
                                background: '#f9f9f9',
                                border: '1px solid #ddd',
                                borderRadius: '3px'
                            }}>
                                <input
                                    type="text"
                                    value={newBiomeName}
                                    onChange={(e) => setNewBiomeName(e.target.value)}
                                    style={{
                                        flex: 1,
                                        padding: '2px 4px',
                                        border: '1px solid #ccc',
                                        borderRadius: '2px',
                                        fontSize: '12px',
                                        color: 'black',
                                        backgroundColor: 'white'
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleConfirmRename();
                                        if (e.key === 'Escape') handleCancelRename();
                                    }}
                                    autoFocus
                                />
                                <button
                                    onClick={handleConfirmRename}
                                    style={{
                                        padding: '2px 6px',
                                        fontSize: '10px',
                                        background: '#4CAF50',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '2px',
                                        cursor: 'pointer',
                                        marginLeft: '4px'
                                    }}
                                >
                                    ✓
                                </button>
                                <button
                                    onClick={handleCancelRename}
                                    style={{
                                        padding: '2px 6px',
                                        fontSize: '10px',
                                        background: '#999',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '2px',
                                        cursor: 'pointer',
                                        marginLeft: '2px'
                                    }}
                                >
                                    ✗
                                </button>
                            </div>
                        ) : (
                            // Normal Biome Row
                            <div
                                onClick={() => onBiomeSelect(biome)}
                                onContextMenu={(e) => handleRightClick(e, biome)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '6px 8px',
                                    background: biome.name === selectedBiomeName ? '#e3f2fd' : '#f5f5f5',
                                    border: biome.name === selectedBiomeName ? '2px solid #2196F3' : '1px solid #ddd',
                                    borderRadius: '3px',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                }}
                            >
                                <span style={{
                                    textAlign: 'left',
                                    flex: 1,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    color: 'black',
                                    fontWeight: 'bold'
                                }}>
                                    {biome.name}
                                </span>
                                <div
                                    onClick={(e) => handleColorClick(e, biome)}
                                    style={{
                                        width: '24px',
                                        height: '18px',
                                        backgroundColor: biome.color || '#808080',
                                        border: '1px solid #888',
                                        cursor: 'pointer',
                                        borderRadius: '2px',
                                        flexShrink: 0
                                    }}
                                    title={`Click to change color for ${biome.name}`}
                                />
                            </div>
                        )}

                        {/* Color Picker Modal */}
                        {editingBiome?.name === biome.name && (
                            <div style={{
                                position: 'fixed',
                                zIndex: 9999,
                                left: '50%',
                                top: '50%',
                                transform: 'translate(-50%, -50%)',
                                background: '#fff',
                                border: '1px solid #ccc',
                                borderRadius: '8px',
                                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
                                padding: '16px',
                            }}>
                                <div style={cover} onClick={handleClosePicker} />
                                <SketchPicker
                                    color={editingBiome.color || '#808080'}
                                    onChange={handleColorChange}
                                    disableAlpha={false}
                                />
                                <button
                                    style={{
                                        marginTop: '8px',
                                        width: '100%',
                                        padding: '6px',
                                        background: '#2196F3',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer'
                                    }}
                                    onClick={handleClosePicker}
                                >
                                    Done
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Context Menu */}
            {contextMenu && (
                <div
                    style={{
                        position: 'fixed',
                        left: contextMenu.x,
                        top: contextMenu.y,
                        background: 'white',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        zIndex: 10000,
                        minWidth: '120px'
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div
                        onClick={() => handleRename(contextMenu.biome)}
                        style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            borderBottom: '1px solid #eee'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f0f0f0'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                    >
                        Rename
                    </div>
                    <div
                        onClick={() => handleDelete(contextMenu.biome)}
                        style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            color: '#d32f2f'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f0f0f0'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}
                    >
                        Delete
                    </div>
                </div>
            )}
        </div>
    );
};

export default BiomeSelector;
