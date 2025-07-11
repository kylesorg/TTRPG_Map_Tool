import React, { useState } from 'react';
import { SketchPicker } from 'react-color';
import type { ColorResult } from 'react-color';

interface GeographyToolPanelProps {
    brushSize: number;
    color: string;
    isErasing: boolean;
    onSetBrushSize: (size: number) => void;
    onSetGeographyColor: (color: string) => void;
    onSetIsErasing: (isErasing: boolean) => void;
}

const GeographyToolPanel: React.FC<GeographyToolPanelProps> = ({
    brushSize,
    color,
    isErasing,
    onSetBrushSize,
    onSetGeographyColor,
    onSetIsErasing,
}) => {
    const [displayColorPicker, setDisplayColorPicker] = useState(false);

    const handleColorChange = (colorResult: ColorResult) => {
        const { r, g, b, a = 1 } = colorResult.rgb; // Default alpha to 1
        onSetGeographyColor(`rgba(${r}, ${g}, ${b}, ${a})`);
        if (isErasing) {
            onSetIsErasing(false);
        }
    };

    // Helper function to determine if color has transparency
    const hasTransparency = (colorString: string): boolean => {
        if (colorString.includes('rgba')) {
            const alpha = parseFloat(colorString.split(',')[3]?.replace(')', '').trim() || '1');
            return alpha < 1;
        }
        return false;
    };

    // Create style object for color preview
    const colorPreviewStyle: React.CSSProperties = {
        height: '28px',
        width: '60px',
        border: '1px solid #888',
        borderRadius: '4px',
        backgroundColor: color,
        cursor: isErasing ? 'not-allowed' : 'pointer',
        opacity: isErasing ? 0.5 : 1,
        // Only show transparency pattern for transparent colors
        ...(hasTransparency(color) ? {
            backgroundImage: 'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAADBJREFUOE9jfPfs2X8GPEBTEMpAchAqQArTMDY2NjI2Nt4G8eO/T2gAS4YPAAAAAP//AwCGMAl4NB46AAAAAElFTkSuQmCC")',
            backgroundRepeat: 'repeat',
        } : {}),
    };

    const cover: React.CSSProperties = {
        position: 'fixed',
        top: '0px',
        right: '0px',
        bottom: '0px',
        left: '0px',
    };

    return (
        <div className="geography-tool-panel" style={{ position: 'relative' }}>
            <h4>Geography Tools</h4>
            <div className="tool-section">
                <label>Brush Size:</label>
                <div className="button-group">
                    <button onClick={() => onSetBrushSize(1.25)} className={brushSize === 1.25 ? 'active' : ''}>S</button>
                    <button onClick={() => onSetBrushSize(3.125)} className={brushSize === 3.125 ? 'active' : ''}>M</button>
                    <button onClick={() => onSetBrushSize(5)} className={brushSize === 5 ? 'active' : ''}>L</button>
                </div>
            </div>
            <div className="tool-section">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                    <label style={{ margin: 0 }}>Color:</label>
                    <div
                        style={colorPreviewStyle}
                        onClick={() => { if (!isErasing) { console.log('[GeographyToolPanel] color:', color); setDisplayColorPicker(true); } }}
                        title={isErasing ? "Turn off eraser to select color" : "Select Color"}
                    />
                </div>
                {displayColorPicker && !isErasing ? (
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
                        <div style={cover} onClick={() => setDisplayColorPicker(false)} />
                        <SketchPicker
                            color={color}
                            onChange={handleColorChange}
                        />
                        <button style={{ marginTop: 8, width: '100%' }} onClick={() => setDisplayColorPicker(false)}>OK</button>
                    </div>
                ) : null}
            </div>
            <div className="tool-section">
                <label>Tool Mode:</label>
                <div className="button-group">
                    <button
                        onClick={() => onSetIsErasing(false)}
                        className={!isErasing ? 'active' : ''}
                        title="Draw Mode"
                    >
                        🖊️ Draw
                    </button>
                    <button
                        onClick={() => onSetIsErasing(true)}
                        className={isErasing ? 'active' : ''}
                        title="Erase Mode"
                    >
                        🧽 Erase
                    </button>
                </div>
            </div>
        </div>
    );
};

export default GeographyToolPanel;