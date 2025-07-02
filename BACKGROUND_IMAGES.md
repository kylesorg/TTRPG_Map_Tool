# Background Image Upload System

This document describes the background image upload and management system for the World Map RPG tool.

## Overview

The background image system allows users to upload images (JPG, PNG, TIFF, etc.) that appear behind the hex grid. Users can control the image's visibility, scale, and position offset.

## Development Modes

### Quick Development Mode (`npm run dev`)
- **Image Storage**: Local blob URLs (temporary, for preview only)
- **Persistence**: Images are lost on page refresh
- **Benefits**: Fast startup, no external dependencies
- **Use Case**: UI development, testing, quick prototyping

### Full Development Mode (`npm run dev:with-uploads`)
- **Image Storage**: Server-side file storage
- **Persistence**: Images persist between sessions
- **Benefits**: Complete functionality testing
- **Use Case**: Full feature testing, production-like environment

## Architecture

### Client-Side Components

1. **WorldMapTools.tsx** - Contains the UI for background image upload and controls
2. **HexGridWebGL.tsx** - Passes background image props to the grid manager
3. **HexGridManager.ts** - Manages background image state and delegates to layer manager
4. **HexLayerManager.ts** - Handles PIXI.js sprite creation, scaling, and positioning
5. **backgroundImageAPI.ts** - API utility with automatic fallback handling

### Server-Side Components (Optional)

1. **server/server.js** - Express server with CORS configuration
2. **server/upload.js** - Multer-based upload endpoints
3. **vite.config.ts** - Development middleware for local testing

## Features

### Upload Process

**Quick Development Mode:**
1. User selects an image file through the file input
2. System generates a unique map ID using timestamp + random string
3. Client automatically uses `URL.createObjectURL()` for immediate display
4. Console shows helpful development message

**Full Development Mode:**
1. User selects an image file through the file input
2. System attempts server upload to `/api/upload/background`
3. Server stores file as `map_{mapId}_background.{ext}` in `public/uploads/backgrounds/`
4. Server returns public URL path for persistent storage

### Image Controls

- **Visibility Toggle**: Show/hide the background image
- **Scale Control**: Slider from 0.1x to 5.0x scaling
- **Position Offset**: Fine-tunable X and Y positioning with +/- buttons and number inputs
- **Remove Button**: Clears the background image and resets all settings

### Automatic Fallback

The system intelligently handles different development scenarios:
- **No server**: Automatically uses blob URLs with helpful console messages
- **Server unavailable**: Falls back to blob URLs with user-friendly notifications
- **Network issues**: Graceful degradation to local preview mode

## Getting Started

### For UI Development (Recommended)
```bash
npm install
npm run dev
```
- Fastest startup
- Background images work immediately in preview mode
- Perfect for testing UI, controls, and visual features

### For Full Feature Testing
```bash
npm install
npm run dev:with-uploads
```
- Complete upload functionality
- Persistent image storage
- Production-like behavior

## API Endpoints (Full Mode Only)

### POST `/api/upload/background`
Uploads a background image for a specific map.

**Request**: 
- `Content-Type: multipart/form-data`
- `backgroundImage`: File (image/*)
- `mapId`: String (unique map identifier)

**Response**:
```json
{
  "success": true,
  "url": "/uploads/backgrounds/map_123456789_abcdefghi_background.jpg",
  "filename": "map_123456789_abcdefghi_background.jpg",
  "mapId": "123456789_abcdefghi",
  "originalName": "my-map.jpg",
  "size": 1024000
}
```

### GET `/api/health`
Check server status and mode.

**Response**:
```json
{
  "status": "OK",
  "mode": "development",
  "timestamp": "2025-06-28T10:30:00.000Z"
}
```

## User Experience

### Development Mode Indicators

- **UI Message**: "Development mode: Images are stored locally for preview"
- **Console Logs**: Helpful information about fallback behavior
- **Error Handling**: Graceful fallback with user-friendly messages

### Console Messages

```
🗺️  World Map RPG Tool - Background Images
📝 Development Mode: Images will use local blob URLs for preview
🔄 For persistent server storage, run: npm run dev:with-uploads
📁 Upload directory ready at: /path/to/uploads
```

## Technical Implementation

### PIXI.js Integration

The background image is implemented as a PIXI.Sprite in the `HexLayerManager`:

```typescript
// Create background image sprite
this.backgroundImageSprite = new PIXI.Sprite();
this.backgroundImageSprite.anchor.set(0.5, 0.5); // Center anchor
this.backgroundImageSprite.zIndex = 0; // Behind hex grid
this.backgroundImageSprite.eventMode = 'none'; // No interactions

// Add to container (behind other layers)
this.container.addChildAt(this.backgroundImageSprite, 0);
```

### Automatic Fallback Logic

```typescript
static async uploadBackgroundImage(file: File, mapId: string): Promise<BackgroundImageUploadResult> {
  try {
    // Attempt server upload
    const response = await fetch('/api/upload/background', { ... });
    return response.json();
  } catch (error) {
    // Automatic fallback to blob URL
    console.warn('🔄 Server upload not available. Using local blob URL.');
    const blobUrl = URL.createObjectURL(file);
    return { success: true, url: blobUrl, ... };
  }
}
```

## File Structure

```
World Map/
├── server/                    # Optional upload server
│   ├── server.js             # Express server
│   └── upload.js             # Upload endpoints
├── public/
│   └── uploads/backgrounds/   # Server-side image storage
├── src/
│   ├── components/WorldMap/
│   │   ├── WorldMapTools.tsx    # Upload UI and controls
│   │   └── core/
│   │       └── HexLayerManager.ts   # PIXI.js implementation
│   └── utils/
│       └── backgroundImageAPI.ts    # Smart API with fallbacks
├── vite.config.ts            # Development middleware
└── package.json              # Scripts for different modes
```

## Troubleshooting

### Common Development Scenarios

1. **"Upload failed" in console**: Normal in quick dev mode - images still work via blob URLs
2. **Images disappear on refresh**: Expected in quick dev mode - use full mode for persistence
3. **Server not starting**: Run `npm run dev:with-uploads` for server functionality
4. **CORS errors**: Server automatically configured for development

### Performance Tips

- **Large Images**: Consider resizing before upload (50MB limit in server mode)
- **Memory Usage**: Blob URLs use browser memory - refresh page if needed
- **Development Speed**: Use quick mode (`npm run dev`) for fastest iteration

## Production Deployment

For production deployment:

1. **Build the client**: `npm run build`
2. **Configure server**: Use the `server/` directory as a reference
3. **Environment Variables**: Set production URLs in `backgroundImageAPI.ts`
4. **File Storage**: Ensure `public/uploads/backgrounds/` is writable
5. **Security**: Implement authentication and file validation as needed

## Future Enhancements

1. **Drag & Drop**: Direct file drop onto the map
2. **Image Editing**: Basic crop, rotate, and color adjustment tools
3. **Cloud Storage**: Integration with AWS S3, Google Cloud, etc.
4. **Performance**: Image compression and format optimization
5. **Multiple Layers**: Support for overlay images and layer management
