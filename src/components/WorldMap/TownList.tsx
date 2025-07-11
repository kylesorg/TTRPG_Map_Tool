import React, { useState, useCallback, useEffect, useRef } from 'react';
import './TownList.css';
import type { HexTile } from '../../types/mapTypes';

interface TownListProps {
    towns: HexTile[];
    onJumpToTown: (hexId: string) => void;
    onEnterTown: (townId: string) => void;
    onRenameTown: (hexId: string, newName: string) => void;
}

interface ContextMenu {
    visible: boolean;
    x: number;
    y: number;
    selectedTown: HexTile | null;
}

interface RenameDialog {
    visible: boolean;
    townId: string;
    currentName: string;
    newName: string;
}

const TownList: React.FC<TownListProps> = ({ towns, onJumpToTown, onEnterTown, onRenameTown }) => {
    const [contextMenu, setContextMenu] = useState<ContextMenu>({ visible: false, x: 0, y: 0, selectedTown: null });
    const [renameDialog, setRenameDialog] = useState<RenameDialog>({ visible: false, townId: '', currentName: '', newName: '' });
    const contextMenuRef = useRef<HTMLDivElement>(null);
    const renameInputRef = useRef<HTMLInputElement>(null);

    const handleContextMenu = (event: React.MouseEvent, town: HexTile) => {
        event.preventDefault();
        setContextMenu({ visible: true, x: event.clientX, y: event.clientY, selectedTown: town });
    };

    const closeContextMenu = useCallback(() => {
        setContextMenu(prev => ({ ...prev, visible: false }));
    }, []);

    const openRenameDialog = useCallback((town: HexTile) => {
        setRenameDialog({
            visible: true,
            townId: town.id,
            currentName: town.townName || 'Unnamed Town',
            newName: town.townName || 'Unnamed Town'
        });
        closeContextMenu();
    }, [closeContextMenu]);

    const closeRenameDialog = useCallback(() => {
        setRenameDialog(prev => ({ ...prev, visible: false }));
    }, []);

    const handleRenameSubmit = useCallback(() => {
        const trimmedName = renameDialog.newName.trim();

        if (!trimmedName) {
            alert('Town name cannot be empty.');
            return;
        }

        // Check if name is already used by another town
        const isNameTaken = towns.some(town =>
            town.id !== renameDialog.townId &&
            (town.townName || 'Unnamed Town').toLowerCase() === trimmedName.toLowerCase()
        );

        if (isNameTaken) {
            alert('A town with this name already exists. Please choose a different name.');
            return;
        }

        onRenameTown(renameDialog.townId, trimmedName);
        closeRenameDialog();
    }, [renameDialog, towns, onRenameTown, closeRenameDialog]);

    const handleRenameKeyDown = useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleRenameSubmit();
        } else if (e.key === 'Escape') {
            closeRenameDialog();
        }
    }, [handleRenameSubmit, closeRenameDialog]);

    useEffect(() => {
        if (contextMenu.visible) {
            document.addEventListener('click', closeContextMenu);
            return () => {
                document.removeEventListener('click', closeContextMenu);
            };
        }
    }, [contextMenu.visible, closeContextMenu]);

    if (towns.length === 0) {
        return (
            <div className="tool-section">
                <h4>Towns</h4>
                <p>No towns have been founded yet.</p>
            </div>
        );
    }

    return (
        <div className="tool-section">
            <h4>Towns</h4>
            <div className="town-list-subwindow">
                <div className="town-list-header">
                    <span>Name</span>
                    <span>Coords</span>
                </div>
                <div className="town-list-body">
                    {towns.map((town) => (
                        <div key={town.id} className="town-list-row" onContextMenu={(e) => handleContextMenu(e, town)}>
                            <span title={town.townName || 'Unnamed Town'}>{town.townName || 'Unnamed Town'}</span>
                            <span title={`q: ${town.coordinates.q}, r: ${town.coordinates.r}`}>{`${town.coordinates.q},${town.coordinates.r}`}</span>
                        </div>
                    ))}
                </div>
            </div>
            {contextMenu.visible && contextMenu.selectedTown && (
                <div
                    ref={contextMenuRef}
                    className="context-menu"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <div className="context-menu-item" onClick={() => { onJumpToTown(contextMenu.selectedTown!.id); closeContextMenu(); }}>Go To</div>
                    <div className="context-menu-item" onClick={() => {
                        if (contextMenu.selectedTown?.townId) {
                            onEnterTown(contextMenu.selectedTown.townId);
                        }
                        closeContextMenu();
                    }}>Enter Town</div>
                    <div className="context-menu-item" onClick={() => openRenameDialog(contextMenu.selectedTown!)}>Rename</div>
                </div>
            )}

            {renameDialog.visible && (
                <div className="rename-dialog-overlay" onClick={closeRenameDialog}>
                    <div className="rename-dialog" onClick={(e) => e.stopPropagation()}>
                        <h3>Rename Town</h3>
                        <p>Current name: <strong>{renameDialog.currentName}</strong></p>
                        <input
                            ref={renameInputRef}
                            type="text"
                            value={renameDialog.newName}
                            onChange={(e) => setRenameDialog(prev => ({ ...prev, newName: e.target.value }))}
                            onKeyDown={handleRenameKeyDown}
                            placeholder="Enter new town name"
                            autoFocus
                        />
                        <div className="rename-dialog-buttons">
                            <button onClick={handleRenameSubmit}>OK</button>
                            <button onClick={closeRenameDialog}>Cancel</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default TownList;
