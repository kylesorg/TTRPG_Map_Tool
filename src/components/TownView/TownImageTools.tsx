import React, { useState, useRef } from 'react';
import type { TownSticker } from '../../types/townTypes';
import type { HexCoordinates } from '../../types/mapTypes';
import { BackgroundImageAPI } from '../../utils/backgroundImageAPI';

interface TownImageToolsProps {
    townId: string;
    townCoordinates: HexCoordinates; // Add town hex coordinates
    stickers: TownSticker[];
    onStickerAdd: (sticker: TownSticker) => void;
    onStickerUpdate: (sticker: TownSticker) => void;
    onStickerDelete: (stickerId: string) => void;
    onBackgroundImageUpdate: (imageUrl: string | null) => void;
    selectedSticker: TownSticker | null;
    onSelectSticker: (sticker: TownSticker | null) => void;
    // Layer visibility controls
    showStickers: boolean;
    onToggleStickers: (visible: boolean) => void;
    showBackgroundImage: boolean;
    onToggleBackgroundImage: (visible: boolean) => void;
    // Background image controls
    backgroundImageUrl: string | null;
    backgroundImageScale: number;
    setBackgroundImageScale: (scale: number) => void;
    backgroundImageOffsetX: number;
    setBackgroundImageOffsetX: (offset: number) => void;
    backgroundImageOffsetY: number;
    setBackgroundImageOffsetY: (offset: number) => void;
}

const TownImageTools: React.FC<TownImageToolsProps> = ({
    townId,
    townCoordinates,
    stickers,
    onStickerAdd,
    onStickerUpdate,
    onStickerDelete,
    onBackgroundImageUpdate,
    selectedSticker,
    onSelectSticker,
    showStickers,
    onToggleStickers,
    showBackgroundImage,
    onToggleBackgroundImage,
    backgroundImageUrl,
    backgroundImageScale,
    setBackgroundImageScale,
    backgroundImageOffsetX,
    setBackgroundImageOffsetX,
    backgroundImageOffsetY,
    setBackgroundImageOffsetY,
}) => {
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const backgroundInputRef = useRef<HTMLInputElement>(null);
    const stickerInputRef = useRef<HTMLInputElement>(null);

    // Input state for background controls
    const [scaleInputValue, setScaleInputValue] = useState('');
    const [offsetXInputValue, setOffsetXInputValue] = useState('');
    const [offsetYInputValue, setOffsetYInputValue] = useState('');

    const handleBackgroundUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setUploadError(null);

        try {
            // Generate map key from town ID or use a global map key
            const mapKey = townId.split('_')[1]; // Extract hex ID from town_hexId format
            const townCoords = `${townCoordinates.q}_${townCoordinates.r}`;

            const result = await BackgroundImageAPI.uploadBackgroundImage(
                file,
                mapKey,
                'townmap',
                townCoords
            );
            onBackgroundImageUpdate(result.url);
        } catch (error) {
            console.error('Background upload failed:', error);
            setUploadError('Failed to upload background image');
        } finally {
            setIsUploading(false);
            if (backgroundInputRef.current) {
                backgroundInputRef.current.value = '';
            }
        }
    };

    const handleStickerUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setUploadError(null);

        try {
            // Generate map key from town ID and use coordinates for sticker naming
            const mapKey = townId.split('_')[1]; // Extract hex ID from town_hexId format
            const stickerName = `sticker_${Date.now()}`;

            const result = await BackgroundImageAPI.uploadBackgroundImage(
                file,
                mapKey,
                'sticker',
                undefined, // townCoords not needed for stickers
                stickerName
            );

            // Create a new sticker at the center of the map
            const newSticker: TownSticker = {
                id: `sticker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                imageUrl: result.url,
                position: { x: 200, y: 200 }, // Default position
                scale: 1.0,
                rotation: 0,
                zIndex: 1
            };

            onStickerAdd(newSticker);
        } catch (error) {
            console.error('Sticker upload failed:', error);
            setUploadError('Failed to upload sticker image');
        } finally {
            setIsUploading(false);
            if (stickerInputRef.current) {
                stickerInputRef.current.value = '';
            }
        }
    };

    const handleStickerScaleChange = (value: number) => {
        if (selectedSticker) {
            onStickerUpdate({
                ...selectedSticker,
                scale: value
            });
        }
    };

    const handleStickerRotationChange = (value: number) => {
        if (selectedSticker) {
            onStickerUpdate({
                ...selectedSticker,
                rotation: (value * Math.PI) / 180 // Convert degrees to radians
            });
        }
    };

    const handleStickerZIndexChange = (value: number) => {
        if (selectedSticker) {
            onStickerUpdate({
                ...selectedSticker,
                zIndex: value
            });
        }
    };

    const handleDeleteSticker = () => {
        if (selectedSticker) {
            onStickerDelete(selectedSticker.id);
            onSelectSticker(null);
        }
    };

    return (
        <div className="town-image-tools" style={{
            padding: '12px',
            backgroundColor: '#f5f5f5',
            borderRadius: '8px',
            marginBottom: '8px'
        }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: 'black' }}>
                Image Tools
            </h4>

            {/* Layer Visibility Controls */}
            <div style={{ marginBottom: '16px' }}>
                <h5 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: '500', color: 'black' }}>
                    Layer Visibility
                </h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '12px', color: 'black' }}>
                        <input
                            type="checkbox"
                            checked={showBackgroundImage}
                            onChange={(e) => onToggleBackgroundImage(e.target.checked)}
                            style={{ marginRight: '6px' }}
                        />
                        Background Image
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', fontSize: '12px', color: 'black' }}>
                        <input
                            type="checkbox"
                            checked={showStickers}
                            onChange={(e) => onToggleStickers(e.target.checked)}
                            style={{ marginRight: '6px' }}
                        />
                        Stickers ({stickers.length})
                    </label>
                </div>
            </div>

            {/* Background Image Upload */}
            <div style={{ marginBottom: '16px' }}>
                <h5 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: '500', color: 'black' }}>
                    Background Image
                </h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <button
                        onClick={() => backgroundInputRef.current?.click()}
                        disabled={isUploading}
                        style={{
                            padding: '6px 12px',
                            fontSize: '12px',
                            backgroundColor: '#007bff',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: isUploading ? 'not-allowed' : 'pointer',
                        }}
                    >
                        {isUploading ? 'Uploading...' : 'Upload Background'}
                    </button>
                    <button
                        onClick={() => onBackgroundImageUpdate(null)}
                        style={{
                            padding: '4px 8px',
                            fontSize: '11px',
                            backgroundColor: '#dc3545',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                        }}
                    >
                        Clear Background
                    </button>
                </div>
                <input
                    ref={backgroundInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleBackgroundUpload}
                    style={{ display: 'none' }}
                />

                {/* Background Image Controls */}
                {backgroundImageUrl && (
                    <>
                        <label style={{ color: 'black', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '8px' }}>
                            <input
                                type="checkbox"
                                checked={showBackgroundImage}
                                onChange={(e) => onToggleBackgroundImage(e.target.checked)}
                            />
                            Show Background Image
                        </label>

                        <div style={{ marginTop: '8px' }}>
                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', color: 'black' }}>
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
                            <label style={{ display: 'block', marginBottom: '4px', fontSize: '11px', fontWeight: 'bold', color: 'black' }}>
                                Position Offset
                            </label>

                            <div style={{ marginBottom: '6px' }}>
                                <label style={{ display: 'block', marginBottom: '4px', fontSize: '10px', color: 'black' }}>
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

                            <div style={{ marginBottom: '6px' }}>
                                <label style={{ display: 'block', marginBottom: '4px', fontSize: '10px', color: 'black' }}>
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
                        </div>
                    </>
                )}
            </div>

            {/* Sticker Upload */}
            <div style={{ marginBottom: '16px' }}>
                <h5 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: '500', color: 'black' }}>
                    Add Sticker
                </h5>
                <button
                    onClick={() => stickerInputRef.current?.click()}
                    disabled={isUploading}
                    style={{
                        padding: '6px 12px',
                        fontSize: '12px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: isUploading ? 'not-allowed' : 'pointer',
                        width: '100%'
                    }}
                >
                    {isUploading ? 'Uploading...' : 'Upload Sticker'}
                </button>
                <input
                    ref={stickerInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleStickerUpload}
                    style={{ display: 'none' }}
                />
            </div>

            {/* Selected Sticker Controls */}
            {selectedSticker && (
                <div style={{ marginBottom: '16px', padding: '8px', backgroundColor: '#e9ecef', borderRadius: '4px' }}>
                    <h5 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: '500', color: 'black' }}>
                        Selected Sticker
                    </h5>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {/* Scale Control */}
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: '500', color: 'black' }}>
                                Scale: {selectedSticker.scale.toFixed(2)}
                            </label>
                            <input
                                type="range"
                                min="0.1"
                                max="3.0"
                                step="0.1"
                                value={selectedSticker.scale}
                                onChange={(e) => handleStickerScaleChange(parseFloat(e.target.value))}
                                style={{ width: '100%' }}
                            />
                        </div>

                        {/* Rotation Control */}
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: '500', color: 'black' }}>
                                Rotation: {Math.round((selectedSticker.rotation * 180) / Math.PI)}°
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="360"
                                step="15"
                                value={Math.round((selectedSticker.rotation * 180) / Math.PI)}
                                onChange={(e) => handleStickerRotationChange(parseInt(e.target.value))}
                                style={{ width: '100%' }}
                            />
                        </div>

                        {/* Z-Index Control */}
                        <div>
                            <label style={{ fontSize: '11px', fontWeight: '500', color: 'black' }}>
                                Layer Order: {selectedSticker.zIndex}
                            </label>
                            <input
                                type="range"
                                min="0"
                                max="10"
                                step="1"
                                value={selectedSticker.zIndex}
                                onChange={(e) => handleStickerZIndexChange(parseInt(e.target.value))}
                                style={{ width: '100%' }}
                            />
                        </div>

                        {/* Delete Button */}
                        <button
                            onClick={handleDeleteSticker}
                            style={{
                                padding: '4px 8px',
                                fontSize: '11px',
                                backgroundColor: '#dc3545',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                marginTop: '4px'
                            }}
                        >
                            Delete Sticker
                        </button>
                    </div>
                </div>
            )}

            {/* Sticker List */}
            {stickers.length > 0 && (
                <div>
                    <h5 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: '500', color: 'black' }}>
                        Stickers ({stickers.length})
                    </h5>
                    <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
                        {stickers.map((sticker) => (
                            <div
                                key={sticker.id}
                                onClick={() => onSelectSticker(sticker)}
                                style={{
                                    padding: '4px 6px',
                                    fontSize: '11px',
                                    backgroundColor: selectedSticker?.id === sticker.id ? '#007bff' : '#fff',
                                    color: selectedSticker?.id === sticker.id ? 'white' : 'black',
                                    border: '1px solid #ddd',
                                    borderRadius: '2px',
                                    marginBottom: '2px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}
                            >
                                <span>Sticker #{stickers.indexOf(sticker) + 1}</span>
                                <span>Scale: {sticker.scale.toFixed(1)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Error Display */}
            {uploadError && (
                <div style={{
                    padding: '6px',
                    fontSize: '11px',
                    backgroundColor: '#f8d7da',
                    color: '#721c24',
                    border: '1px solid #f5c6cb',
                    borderRadius: '4px',
                    marginTop: '8px'
                }}>
                    {uploadError}
                </div>
            )}
        </div>
    );
};

export default TownImageTools;
