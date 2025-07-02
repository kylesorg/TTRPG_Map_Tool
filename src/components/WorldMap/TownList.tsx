import React, { useState, useCallback, useEffect, useRef } from 'react';
import './TownList.css';
import type { HexTile } from '../../types/mapTypes';

interface TownListProps {
    towns: HexTile[];
    onJumpToTown: (hexId: string) => void;
    onEnterTown: (townId: string) => void;
}

interface ContextMenu {
    visible: boolean;
    x: number;
    y: number;
    selectedTown: HexTile | null;
}

const TownList: React.FC<TownListProps> = ({ towns, onJumpToTown, onEnterTown }) => {
    const [contextMenu, setContextMenu] = useState<ContextMenu>({ visible: false, x: 0, y: 0, selectedTown: null });
    const contextMenuRef = useRef<HTMLDivElement>(null);

    const handleContextMenu = (event: React.MouseEvent, town: HexTile) => {
        event.preventDefault();
        setContextMenu({ visible: true, x: event.clientX, y: event.clientY, selectedTown: town });
    };

    const closeContextMenu = useCallback(() => {
        setContextMenu(prev => ({ ...prev, visible: false }));
    }, []);

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
                    <div className="context-menu-item" onClick={() => { onEnterTown(contextMenu.selectedTown!.townId!); closeContextMenu(); }}>Enter Town</div>
                </div>
            )}
        </div>
    );
};

export default TownList;
