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

    const handleContextMenu = (e: React.MouseEvent, material: TownMaterial) => {
        e.preventDefault();
        e.stopPropagation();

        // Don't show context menu for default material
        if (material.name === 'default') return;

        setContextMenu({ material, x: e.clientX, y: e.clientY });
    };

    const handleRename = (material: TownMaterial) => {
        setRenamingMaterial(material);
        setNewMaterialName(material.name);
        setContextMenu(null);
    };

    const handleDelete = (material: TownMaterial) => {
        if (onMaterialDelete && material.name !== 'default') {
            onMaterialDelete(material.name);
        }
        setContextMenu(null);
    };

    const handleRenameSubmit = () => {
        if (renamingMaterial && onMaterialRename && newMaterialName.trim() && newMaterialName !== renamingMaterial.name) {
            onMaterialRename(renamingMaterial.name, newMaterialName.trim());
        }
        setRenamingMaterial(null);
        setNewMaterialName('');
    };

    const handleAddSubmit = () => {
        if (onMaterialAdd && addMaterialName.trim()) {
            // Generate a random color for new materials
            const randomColor = `rgba(${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)}, ${Math.floor(Math.random() * 256)}, 1)`;
            onMaterialAdd(addMaterialName.trim(), randomColor);
            setAddMaterialName('');
            setShowAddForm(false);
        }
    };

    // Close context menu on outside click
    React.useEffect(() => {
        const handleClickOutside = () => {
            setContextMenu(null);
        };
        if (contextMenu) {
            document.addEventListener('click', handleClickOutside);
            return () => document.removeEventListener('click', handleClickOutside);
        }
    }, [contextMenu]);

    return (
        <div style={{ padding: '12px' }}>
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px'
            }}>
                <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 'bold' }}>Town Materials</h4>
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
                        Add
                    </button>
                )}
            </div>

            {/* Add Material Form */}
            {showAddForm && (
                <div style={{
                    marginBottom: '8px',
                    padding: '8px',
                    background: '#f5f5f5',
                    borderRadius: '4px'
                }}>
                    <input
                        type="text"
                        value={addMaterialName}
                        onChange={(e) => setAddMaterialName(e.target.value)}
                        placeholder="Material name..."
                        style={{
                            width: '100%',
                            padding: '4px 6px',
                            fontSize: '12px',
                            border: '1px solid #ccc',
                            borderRadius: '3px',
                            marginBottom: '4px'
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddSubmit();
                            if (e.key === 'Escape') {
                                setShowAddForm(false);
                                setAddMaterialName('');
                            }
                        }}
                        autoFocus
                    />
                    <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                            onClick={handleAddSubmit}
                            style={{
                                padding: '4px 8px',
                                fontSize: '11px',
                                background: '#4CAF50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '3px',
                                cursor: 'pointer'
                            }}
                        >
                            Add
                        </button>
                        <button
                            onClick={() => {
                                setShowAddForm(false);
                                setAddMaterialName('');
                            }}
                            style={{
                                padding: '4px 8px',
                                fontSize: '11px',
                                background: '#ccc',
                                color: 'black',
                                border: 'none',
                                borderRadius: '3px',
                                cursor: 'pointer'
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Material List */}
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {availableMaterials.map((material) => (
                    <div
                        key={material.name}
                        onClick={() => onMaterialSelect(material)}
                        onContextMenu={(e) => handleContextMenu(e, material)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            padding: '6px 8px',
                            marginBottom: '4px',
                            backgroundColor: selectedMaterialName === material.name ? '#e3f2fd' : '#f8f9fa',
                            border: selectedMaterialName === material.name ? '2px solid #2196F3' : '1px solid #ddd',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            position: 'relative',
                            fontSize: '12px',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                            if (selectedMaterialName !== material.name) {
                                e.currentTarget.style.backgroundColor = '#f0f0f0';
                            }
                        }}
                        onMouseLeave={(e) => {
                            if (selectedMaterialName !== material.name) {
                                e.currentTarget.style.backgroundColor = '#f8f9fa';
                            }
                        }}
                    >
                        <div
                            onClick={(e) => handleColorClick(e, material)}
                            style={{
                                width: '20px',
                                height: '20px',
                                backgroundColor: material.color,
                                border: '1px solid #000',
                                borderRadius: '3px',
                                marginRight: '8px',
                                cursor: 'pointer',
                                flexShrink: 0
                            }}
                        />
                        {renamingMaterial?.name === material.name ? (
                            <input
                                type="text"
                                value={newMaterialName}
                                onChange={(e) => setNewMaterialName(e.target.value)}
                                onBlur={handleRenameSubmit}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleRenameSubmit();
                                    if (e.key === 'Escape') {
                                        setRenamingMaterial(null);
                                        setNewMaterialName('');
                                    }
                                }}
                                style={{
                                    flex: 1,
                                    padding: '2px 4px',
                                    fontSize: '12px',
                                    border: '1px solid #2196F3',
                                    borderRadius: '2px'
                                }}
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <span
                                style={{
                                    flex: 1,
                                    fontWeight: selectedMaterialName === material.name ? 'bold' : 'normal'
                                }}
                            >
                                {material.name}
                            </span>
                        )}

                        {/* Color Picker */}
                        {editingMaterial?.name === material.name && (
                            <div
                                style={{
                                    position: 'absolute',
                                    top: '100%',
                                    left: '0',
                                    zIndex: 9999,
                                    backgroundColor: 'white',
                                    border: '1px solid #ccc',
                                    borderRadius: '4px',
                                    padding: '8px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                                }}
                                onClick={(e) => e.stopPropagation()}
                            >
                                <SketchPicker
                                    color={material.color}
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
