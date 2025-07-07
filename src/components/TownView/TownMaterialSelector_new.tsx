import React, { useState } from 'react';
import { SketchPicker } from 'react-color';
import type { ColorResult } from 'react-color';
import type { TownMaterial } from '../../types/mapTypes';

interface TownMaterialSelectorProps {
    availableMaterials: TownMaterial[];
    onMaterialSelect: (material: TownMaterial) => void;
    selectedMaterialName?: string;
    onMaterialColorChange: (materialName: string, newColor: string) => void;
    onMaterialAdd?: (materialName: string, color: string) => void;
    onMaterialRename?: (oldName: string, newName: string) => void;
    onMaterialDelete?: (materialName: string) => void;
}

const TownMaterialSelector: React.FC<TownMaterialSelectorProps> = ({
    availableMaterials,
    onMaterialSelect,
    selectedMaterialName,
    onMaterialColorChange,
    onMaterialAdd,
    onMaterialRename,
    onMaterialDelete
}) => {
    const [editingMaterial, setEditingMaterial] = useState<TownMaterial | null>(null);
    const [contextMenu, setContextMenu] = useState<{ material: TownMaterial; x: number; y: number } | null>(null);
    const [renamingMaterial, setRenamingMaterial] = useState<TownMaterial | null>(null);
    const [newMaterialName, setNewMaterialName] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [addMaterialName, setAddMaterialName] = useState('');

    const handleColorClick = (e: React.MouseEvent, material: TownMaterial) => {
        e.stopPropagation();
        setEditingMaterial(material);
    };

    const handleColorChange = (colorResult: ColorResult) => {
        if (editingMaterial) {
            const { r, g, b, a } = colorResult.rgb;
            const finalA = a === undefined ? 1 : a;
            const newColor = `rgba(${r}, ${g}, ${b}, ${finalA})`;
            onMaterialColorChange(editingMaterial.name, newColor);
            setEditingMaterial({ ...editingMaterial, color: newColor });
        }
    };

    const handleClosePicker = () => {
        if (editingMaterial) {
            // Auto-select the material we just changed the color for
            onMaterialSelect(editingMaterial);
        }
        setEditingMaterial(null);
    };

    const handleRightClick = (e: React.MouseEvent, material: TownMaterial) => {
        e.preventDefault();
        e.stopPropagation();

        // Don't allow context menu on "default" material
        if (material.name === 'default') return;

        setContextMenu({
            material,
            x: e.clientX,
            y: e.clientY
        });
    };

    const handleRename = (material: TownMaterial) => {
        setRenamingMaterial(material);
        setNewMaterialName(material.name);
        setContextMenu(null);
    };

    const handleConfirmRename = () => {
        if (renamingMaterial && newMaterialName.trim() && onMaterialRename) {
            const trimmedName = newMaterialName.trim();

            // Check if name already exists
            if (availableMaterials.some(m => m.name.toLowerCase() === trimmedName.toLowerCase() && m.name !== renamingMaterial.name)) {
                alert(`A material named "${trimmedName}" already exists. Please choose a different name.`);
                return;
            }

            onMaterialRename(renamingMaterial.name, trimmedName);
        }
        setRenamingMaterial(null);
        setNewMaterialName('');
    };

    const handleCancelRename = () => {
        setRenamingMaterial(null);
        setNewMaterialName('');
    };

    const handleDelete = (material: TownMaterial) => {
        if (onMaterialDelete && window.confirm(`Are you sure you want to delete "${material.name}"? This cannot be undone. All cells assigned to this material will be set to "default".`)) {
            onMaterialDelete(material.name);
        }
        setContextMenu(null);
    };

    const handleAddMaterial = () => {
        if (addMaterialName.trim() && onMaterialAdd) {
            const trimmedName = addMaterialName.trim();

            // Check if name already exists
            if (availableMaterials.some(m => m.name.toLowerCase() === trimmedName.toLowerCase())) {
                alert(`A material named "${trimmedName}" already exists. Please choose a different name.`);
                return;
            }

            onMaterialAdd(trimmedName, '#FFFFFF'); // Default to white
        }
        setAddMaterialName('');
        setShowAddForm(false);
    };

    const handleCancelAdd = () => {
        setAddMaterialName('');
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
                <h4 style={{ margin: 0, fontSize: '14px', color: 'black' }}>Materials</h4>
                {onMaterialAdd && (
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
                        value={addMaterialName}
                        onChange={(e) => setAddMaterialName(e.target.value)}
                        placeholder="Enter material name"
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
                            if (e.key === 'Enter') handleAddMaterial();
                            if (e.key === 'Escape') handleCancelAdd();
                        }}
                        autoFocus
                    />
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                            onClick={handleAddMaterial}
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

            {/* Material List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {availableMaterials.map((material) => (
                    <div key={material.name} style={{ position: 'relative' }}>
                        {renamingMaterial?.name === material.name ? (
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
                                    value={newMaterialName}
                                    onChange={(e) => setNewMaterialName(e.target.value)}
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
                            // Normal Material Row
                            <div
                                onClick={() => onMaterialSelect(material)}
                                onContextMenu={(e) => handleRightClick(e, material)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '6px 8px',
                                    background: material.name === selectedMaterialName ? '#e3f2fd' : '#f5f5f5',
                                    border: material.name === selectedMaterialName ? '2px solid #2196F3' : '1px solid #ddd',
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
                                    {material.name}
                                </span>
                                <div
                                    onClick={(e) => handleColorClick(e, material)}
                                    style={{
                                        width: '24px',
                                        height: '18px',
                                        backgroundColor: material.color || '#808080',
                                        border: '1px solid #888',
                                        cursor: 'pointer',
                                        borderRadius: '2px',
                                        flexShrink: 0
                                    }}
                                    title={`Click to change color for ${material.name}`}
                                />
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Color Picker Modal */}
            {editingMaterial && (
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
                        color={editingMaterial.color || '#808080'}
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
                        onClick={() => handleRename(contextMenu.material)}
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
                        onClick={() => handleDelete(contextMenu.material)}
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

export default TownMaterialSelector;
