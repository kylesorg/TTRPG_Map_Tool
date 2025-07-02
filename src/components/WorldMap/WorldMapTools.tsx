import React, { useState, useRef } from 'react';
import { SketchPicker } from 'react-color';
import type { ColorResult } from 'react-color';
import type { ToolMode, Biome, HexTile } from '../../types/mapTypes'; // Added HexTile
import type { HexOrientation } from '../../utils/hexMath'; // NEW: Hex orientation types
import BiomeSelector from '../Tools/BiomeSelector';
import TownList from './TownList'; // Import the new TownList component
import GeographyToolPanel from '../Tools/GeographyToolPanel';
import { BackgroundImageAPI } from '../../utils/backgroundImageAPI';

interface WorldMapToolsProps {
    currentTool: ToolMode;
    onToolChange: (tool: ToolMode) => void;
    biomesLoaded: boolean;
    availableBiomes: Biome[];
    onBiomeSelect: (biome: Biome) => void;
    selectedBiomeName: string;
    gotoX: string;
    gotoY: string;
    onGotoXChange: (value: string) => void;
    onGotoYChange: (value: string) => void;
    onGoto: () => void;
    zoomLevel: number;
    renderedHexesCount: number;
    towns: HexTile[]; // Add towns to props
    onJumpToTown: (hexId: string) => void; // Add jump handler to props
    onEnterTown: (townId: string) => void;
    // Props for the new View tab
    viewSettings: {
        showTownNames: boolean;
    };
    onViewSettingChange: (setting: keyof WorldMapToolsProps['viewSettings'], value: boolean) => void;
    // Props for GeographyToolPanel
    brushSize: number;
    setBrushSize: (size: number) => void;
    brushColor: string;
    setBrushColor: (color: string) => void;
    isErasing: boolean;
    setIsErasing: (erasing: boolean) => void;
    // Layer controls
    gridLinesVisible: boolean;
    setGridLinesVisible: (visible: boolean) => void;
    gridLineThickness: number;
    setGridLineThickness: (thickness: number) => void;
    gridLineColor: string;
    setGridLineColor: (color: string) => void;
    textScale: number;
    setTextScale: (scale: number) => void;
    geographyVisible: boolean;
    setGeographyVisible: (visible: boolean) => void;
    onBiomeColorChange: (biomeName: string, newColor: string) => void;
    // Biome management
    onBiomeAdd?: (biomeName: string, color: string) => void;
    onBiomeRename?: (oldName: string, newName: string) => void;
    onBiomeDelete?: (biomeName: string) => void;
    // Background image controls
    backgroundImageUrl: string | null;
    setBackgroundImageUrl: (url: string | null) => void;
    backgroundImageScale: number;
    setBackgroundImageScale: (scale: number) => void;
    backgroundImageOffsetX: number;
    setBackgroundImageOffsetX: (offset: number) => void;
    backgroundImageOffsetY: number;
    setBackgroundImageOffsetY: (offset: number) => void;
    backgroundImageVisible: boolean;
    setBackgroundImageVisible: (visible: boolean) => void;
    // Hex orientation controls (NEW - additive only)
    hexOrientation: HexOrientation;
    setHexOrientation: (orientation: HexOrientation) => void;
}

const WorldMapTools: React.FC<WorldMapToolsProps> = ({
    currentTool,
    onToolChange,
    biomesLoaded,
    availableBiomes,
    onBiomeSelect,
    selectedBiomeName,
    gotoX,
    gotoY,
    onGotoXChange,
    onGotoYChange,
    onGoto,
    zoomLevel,
    renderedHexesCount,
    towns,
    onJumpToTown,
    onEnterTown,
    viewSettings,
    onViewSettingChange,
    brushSize,
    setBrushSize,
    brushColor,
    setBrushColor,
    isErasing,
    setIsErasing,
    // Layer controls
    gridLinesVisible,
    setGridLinesVisible,
    gridLineThickness,
    setGridLineThickness,
    gridLineColor,
    setGridLineColor,
    textScale,
    setTextScale,
    geographyVisible,
    setGeographyVisible,
    onBiomeColorChange,
    // Biome management
    onBiomeAdd,
    onBiomeRename,
    onBiomeDelete,
    // Background image controls
    backgroundImageUrl,
    setBackgroundImageUrl,
    backgroundImageScale,
    setBackgroundImageScale,
    backgroundImageOffsetX,
    setBackgroundImageOffsetX,
    backgroundImageOffsetY,
    setBackgroundImageOffsetY,
    backgroundImageVisible,
    setBackgroundImageVisible,
    // Hex orientation props (NEW - additive only)
    hexOrientation,
    setHexOrientation,
}) => {
    const [activeTab, setActiveTab] = useState<'edit' | 'view'>('edit');
    const [showGridLineColorPicker, setShowGridLineColorPicker] = useState(false);
    const [editingGridLineColor, setEditingGridLineColor] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Temporary input states for better UX
    const [scaleInputValue, setScaleInputValue] = useState<string>('');
    const [offsetXInputValue, setOffsetXInputValue] = useState<string>('');
    const [offsetYInputValue, setOffsetYInputValue] = useState<string>('');

    const handleRemoveBackgroundImage = async () => {
        try {
            // Extract mapId from the current URL if it exists
            if (backgroundImageUrl) {
                const urlParts = backgroundImageUrl.split('/');
                const filename = urlParts[urlParts.length - 1];
                const mapId = filename.replace('_background.jpeg', '').replace('_background.jpg', '').replace('_background.png', '');

                // Try to delete from server (optional - if it fails, we still clear the UI)
                try {
                    await BackgroundImageAPI.deleteBackgroundImage(mapId);
                    console.log('✅ Background image deleted from server');
                } catch (deleteError) {
                    console.warn('⚠️ Failed to delete from server (file may not exist):', deleteError);
                }
            }

            // Clear the UI state
            setBackgroundImageUrl(null);
            setBackgroundImageScale(1);
            setBackgroundImageOffsetX(0);
            setBackgroundImageOffsetY(0);

            // Clear the file input
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }

            console.log('✅ Background image cleared from UI');
        } catch (error) {
            console.error('❌ Error removing background image:', error);
        }
    };

    const handleGridLineColorClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setEditingGridLineColor(gridLineColor);
        setShowGridLineColorPicker(true);
    };

    const handleGridLineColorChange = (colorResult: ColorResult) => {
        const { r, g, b, a } = colorResult.rgb;
        const finalA = a === undefined ? 1 : a;
        const newColor = `rgba(${r}, ${g}, ${b}, ${finalA})`;
        setEditingGridLineColor(newColor);
    };

    const handleGridLineColorClose = () => {
        if (editingGridLineColor) {
            setGridLineColor(editingGridLineColor);
        }
        setShowGridLineColorPicker(false);
        setEditingGridLineColor(null);
    };

    return (
        <div className="world-map-tools">
            <div className="tabs">
                <button className={activeTab === 'edit' ? 'active' : ''} onClick={() => setActiveTab('edit')}>Edit</button>
                <button className={activeTab === 'view' ? 'active' : ''} onClick={() => setActiveTab('view')}>View</button>
            </div>

            {activeTab === 'edit' && (
                <>
                    <div className="tool-section">
                        <h4>Tools</h4>
                        <button onClick={() => onToolChange('select')} className={`panel-button ${currentTool === 'select' ? 'active' : ''}`}>Select Hex</button>
                        <button onClick={() => onToolChange('paint')} className={`panel-button ${currentTool === 'paint' ? 'active' : ''}`}>Paint Biome</button>
                        <button onClick={() => onToolChange('geography')} className={`panel-button ${currentTool === 'geography' ? 'active' : ''}`}>Geography</button>
                    </div>

                    {currentTool === 'paint' && biomesLoaded && (
                        <BiomeSelector
                            availableBiomes={availableBiomes}
                            onBiomeSelect={onBiomeSelect}
                            selectedBiomeName={selectedBiomeName}
                            onBiomeColorChange={onBiomeColorChange}
                            onBiomeAdd={onBiomeAdd}
                            onBiomeRename={onBiomeRename}
                            onBiomeDelete={onBiomeDelete}
                        />
                    )}

                    {currentTool === 'geography' && (
                        <GeographyToolPanel
                            brushSize={brushSize}
                            onSetBrushSize={setBrushSize}
                            color={brushColor}
                            onSetGeographyColor={setBrushColor}
                            isErasing={isErasing}
                            onSetIsErasing={setIsErasing}
                        />
                    )}

                    <div className="tool-section">
                        <h4>Navigation</h4>
                        <div className="goto-coords">
                            X: <input type="number" value={gotoX} onChange={(e) => onGotoXChange(e.target.value)} style={{ width: '50px' }} />
                            Y: <input type="number" value={gotoY} onChange={(e) => onGotoYChange(e.target.value)} style={{ width: '50px' }} />
                            <button className="panel-button" onClick={onGoto}>Go</button>
                        </div>
                    </div>
                    <div className="tool-section">
                        <p>Zoom: {zoomLevel.toFixed(2)}x</p>
                        <p>Rendered Hexes: {renderedHexesCount}</p>
                    </div>

                    <TownList towns={towns} onJumpToTown={onJumpToTown} onEnterTown={onEnterTown} />
                </>
            )}

            {activeTab === 'view' && (
                <div className="tool-section">
                    {/* Hex Orientation Controls (NEW - additive only) */}
                    <h4 style={{ color: 'white' }}>Hex Orientation</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'white' }}>
                            <input
                                type="radio"
                                name="hexOrientation"
                                value="flat-top"
                                checked={hexOrientation === 'flat-top'}
                                onChange={(e) => setHexOrientation(e.target.value as 'flat-top')}
                            />
                            <span>Flat Top (Current)</span>
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'white' }}>
                            <input
                                type="radio"
                                name="hexOrientation"
                                value="pointy-top"
                                checked={hexOrientation === 'pointy-top'}
                                onChange={(e) => setHexOrientation(e.target.value as 'pointy-top')}
                            />
                            <span>Pointy Top (New)</span>
                        </label>
                    </div>

                    <hr />

                    <h4 style={{ color: 'white' }}>Town Names</h4>
                    <label style={{ color: 'white' }}>
                        <input
                            type="checkbox"
                            checked={viewSettings.showTownNames}
                            onChange={(e) => onViewSettingChange('showTownNames', e.target.checked)}
                        />
                        Show Town Names
                    </label>
                    <label style={{ display: 'block', marginTop: '8px', color: 'white' }}>
                        Text Scale: {textScale.toFixed(1)}x
                        <input
                            type="range"
                            min="0.5"
                            max="3"
                            step="0.1"
                            value={textScale}
                            onChange={(e) => setTextScale(parseFloat(e.target.value))}
                            style={{ width: '100%' }}
                        />
                    </label>

                    <hr />

                    <h4 style={{ color: 'white' }}>Grid Lines</h4>
                    <label style={{ color: 'white' }}>
                        <input
                            type="checkbox"
                            checked={gridLinesVisible}
                            onChange={(e) => setGridLinesVisible(e.target.checked)}
                        />
                        Show Grid Lines
                    </label>                    <label style={{ display: 'block', marginTop: '8px', color: 'white' }}>
                        Color:
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', position: 'relative' }}>
                            <div
                                style={{
                                    width: '24px',
                                    height: '24px',
                                    backgroundColor: gridLineColor,
                                    border: '2px solid #ccc',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                                onClick={handleGridLineColorClick}
                                title="Click to change grid line color"
                            />
                            <span style={{ fontSize: '12px', color: '#666', fontFamily: 'monospace' }}>
                                {gridLineColor}
                            </span>

                            {showGridLineColorPicker && (
                                <div style={{
                                    position: 'fixed',
                                    zIndex: 9999,
                                    left: '50%',
                                    top: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    background: '#fff',
                                    border: '1px solid #ccc',
                                    borderRadius: '8px',
                                    boxShadow: '0 2px 16px rgba(0,0,0,0.2)',
                                    padding: '16px',
                                }}>
                                    <div
                                        style={{
                                            position: 'fixed',
                                            top: '0px',
                                            right: '0px',
                                            bottom: '0px',
                                            left: '0px',
                                        }}
                                        onClick={handleGridLineColorClose}
                                    />
                                    <SketchPicker
                                        color={editingGridLineColor || '#666666'}
                                        onChange={handleGridLineColorChange}
                                        disableAlpha={false}
                                    />
                                    <button
                                        style={{
                                            marginTop: 8,
                                            width: '100%'
                                        }}
                                        onClick={handleGridLineColorClose}
                                    >
                                        OK
                                    </button>
                                </div>
                            )}
                        </div>
                    </label>
                    <label style={{ display: 'block', marginTop: '8px', color: 'white' }}>
                        Line Thickness: {gridLineThickness.toFixed(1)}px
                        <input
                            type="range"
                            min="0.5"
                            max="5"
                            step="0.5"
                            value={gridLineThickness}
                            onChange={(e) => setGridLineThickness(parseFloat(e.target.value))}
                            style={{ width: '100%' }}
                        />
                    </label>

                    <hr />

                    <h4 style={{ color: 'white' }}>Geography</h4>
                    <label style={{ color: 'white' }}>
                        <input
                            type="checkbox"
                            checked={geographyVisible}
                            onChange={(e) => setGeographyVisible(e.target.checked)}
                        />
                        Show Geography Layer
                    </label>

                    <hr />

                    <h4 style={{ color: 'white' }}>Background Image</h4>
                    <div style={{ marginBottom: '10px' }}>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    try {
                                        // Generate map ID
                                        const mapId = BackgroundImageAPI.generateMapId();

                                        // Upload to server
                                        const result = await BackgroundImageAPI.uploadBackgroundImage(file, mapId);
                                        setBackgroundImageUrl(result.url);
                                        console.log('✅ Background image uploaded successfully:', result);
                                    } catch (error) {
                                        console.error('❌ Upload failed:', error);
                                        // You could add user-facing error handling here
                                    }
                                }
                            }}
                            style={{ width: '100%', marginBottom: '8px' }}
                        />
                        <small style={{ color: '#ccc', fontSize: '11px' }}>
                            Supports: JPG, PNG, TIFF, and other image formats
                        </small>
                    </div>

                    {backgroundImageUrl && (
                        <>
                            <label style={{ color: 'white' }}>
                                <input
                                    type="checkbox"
                                    checked={backgroundImageVisible}
                                    onChange={(e) => setBackgroundImageVisible(e.target.checked)}
                                />
                                Show Background Image
                            </label>

                            <div style={{ marginTop: '8px' }}>
                                <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: 'white' }}>
                                    Scale: {backgroundImageScale.toFixed(2)}x
                                </label>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    <button
                                        onClick={() => setBackgroundImageScale(Math.max(0.1, backgroundImageScale - 0.1))}
                                        style={{
                                            width: '30px',
                                            height: '24px',
                                            border: '1px solid #ccc',
                                            background: '#f0f0f0',
                                            color: '#000000',
                                            fontSize: '16px',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontFamily: 'monospace'
                                        }}
                                    >
                                        &#8722;
                                    </button>
                                    <input
                                        type="text"
                                        value={scaleInputValue || backgroundImageScale.toFixed(2)}
                                        onChange={(e) => setScaleInputValue(e.target.value)}
                                        onFocus={() => setScaleInputValue(backgroundImageScale.toFixed(2))}
                                        onBlur={(e) => {
                                            const value = parseFloat(e.target.value);
                                            if (!isNaN(value) && value >= 0.1 && value <= 10) {
                                                setBackgroundImageScale(value);
                                            }
                                            setScaleInputValue('');
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                const value = parseFloat(e.currentTarget.value);
                                                if (!isNaN(value) && value >= 0.1 && value <= 10) {
                                                    setBackgroundImageScale(value);
                                                }
                                                setScaleInputValue('');
                                                e.currentTarget.blur();
                                            }
                                        }}
                                        style={{
                                            width: '70px',
                                            height: '22px',
                                            textAlign: 'center',
                                            fontSize: '11px',
                                            border: '1px solid #ccc'
                                        }}
                                    />
                                    <button
                                        onClick={() => setBackgroundImageScale(Math.min(10, backgroundImageScale + 0.1))}
                                        style={{
                                            width: '30px',
                                            height: '24px',
                                            border: '1px solid #ccc',
                                            background: '#f0f0f0',
                                            color: '#000000',
                                            fontSize: '16px',
                                            fontWeight: 'bold',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            fontFamily: 'monospace'
                                        }}
                                    >
                                        &#43;
                                    </button>
                                </div>
                            </div>

                            <div style={{ marginTop: '12px' }}>
                                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px', fontWeight: 'bold', color: 'white' }}>
                                    Position Offset
                                </label>

                                <div style={{ marginBottom: '8px' }}>
                                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: 'white' }}>
                                        Horizontal (X): {backgroundImageOffsetX.toFixed(2)}
                                    </label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <button
                                            onClick={() => setBackgroundImageOffsetX(backgroundImageOffsetX - 1)}
                                            style={{
                                                width: '30px',
                                                height: '24px',
                                                border: '1px solid #ccc',
                                                background: '#f0f0f0',
                                                color: '#000000',
                                                fontSize: '16px',
                                                fontWeight: 'bold',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontFamily: 'monospace'
                                            }}
                                        >
                                            &#8722;
                                        </button>
                                        <input
                                            type="text"
                                            value={offsetXInputValue || backgroundImageOffsetX.toFixed(2)}
                                            onChange={(e) => setOffsetXInputValue(e.target.value)}
                                            onFocus={() => setOffsetXInputValue(backgroundImageOffsetX.toFixed(2))}
                                            onBlur={(e) => {
                                                const value = parseFloat(e.target.value);
                                                if (!isNaN(value)) {
                                                    setBackgroundImageOffsetX(value);
                                                }
                                                setOffsetXInputValue('');
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    const value = parseFloat(e.currentTarget.value);
                                                    if (!isNaN(value)) {
                                                        setBackgroundImageOffsetX(value);
                                                    }
                                                    setOffsetXInputValue('');
                                                    e.currentTarget.blur();
                                                }
                                            }}
                                            style={{
                                                width: '70px',
                                                height: '22px',
                                                textAlign: 'center',
                                                fontSize: '11px',
                                                border: '1px solid #ccc'
                                            }}
                                        />
                                        <button
                                            onClick={() => setBackgroundImageOffsetX(backgroundImageOffsetX + 1)}
                                            style={{
                                                width: '30px',
                                                height: '24px',
                                                border: '1px solid #ccc',
                                                background: '#f0f0f0',
                                                color: '#000000',
                                                fontSize: '16px',
                                                fontWeight: 'bold',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontFamily: 'monospace'
                                            }}
                                        >
                                            &#43;
                                        </button>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '8px' }}>
                                    <label style={{ display: 'block', marginBottom: '4px', fontSize: '12px', color: 'white' }}>
                                        Vertical (Y): {backgroundImageOffsetY.toFixed(2)}
                                    </label>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <button
                                            onClick={() => setBackgroundImageOffsetY(backgroundImageOffsetY - 1)}
                                            style={{
                                                width: '30px',
                                                height: '24px',
                                                border: '1px solid #ccc',
                                                background: '#f0f0f0',
                                                color: '#000000',
                                                fontSize: '16px',
                                                fontWeight: 'bold',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontFamily: 'monospace'
                                            }}
                                        >
                                            &#8722;
                                        </button>
                                        <input
                                            type="text"
                                            value={offsetYInputValue || backgroundImageOffsetY.toFixed(2)}
                                            onChange={(e) => setOffsetYInputValue(e.target.value)}
                                            onFocus={() => setOffsetYInputValue(backgroundImageOffsetY.toFixed(2))}
                                            onBlur={(e) => {
                                                const value = parseFloat(e.target.value);
                                                if (!isNaN(value)) {
                                                    setBackgroundImageOffsetY(value);
                                                }
                                                setOffsetYInputValue('');
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    const value = parseFloat(e.currentTarget.value);
                                                    if (!isNaN(value)) {
                                                        setBackgroundImageOffsetY(value);
                                                    }
                                                    setOffsetYInputValue('');
                                                    e.currentTarget.blur();
                                                }
                                            }}
                                            style={{
                                                width: '70px',
                                                height: '22px',
                                                textAlign: 'center',
                                                fontSize: '11px',
                                                border: '1px solid #ccc'
                                            }}
                                        />
                                        <button
                                            onClick={() => setBackgroundImageOffsetY(backgroundImageOffsetY + 1)}
                                            style={{
                                                width: '30px',
                                                height: '24px',
                                                border: '1px solid #ccc',
                                                background: '#f0f0f0',
                                                color: '#000000',
                                                fontSize: '16px',
                                                fontWeight: 'bold',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontFamily: 'monospace'
                                            }}
                                        >
                                            &#43;
                                        </button>
                                    </div>
                                </div>

                                <small style={{ color: '#ccc', fontSize: '10px', fontStyle: 'italic' }}>
                                    *Fine tuning can be manually done up to .00
                                </small>
                            </div>

                            <button
                                onClick={handleRemoveBackgroundImage}
                                style={{
                                    width: '100%',
                                    marginTop: '10px',
                                    padding: '6px',
                                    background: '#ff4444',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    fontSize: '12px'
                                }}
                            >
                                Remove Background Image
                            </button>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default WorldMapTools;
