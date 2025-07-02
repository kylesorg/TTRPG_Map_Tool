# World Map RPG Tool

A tabletop RPG world-making tool built with React, TypeScript, and Vite. This application allows users to create and manage large hexagonal world maps, design towns with grid-based systems, and add details like biomes, encounters, notes, and background images.

## Features

- **Hexagonal World Map**: Large grid of hexagonal tiles (each representing 12 miles)
- **Background Images**: Upload and manage background images with scale and position controls
- **Biome System**: 28 different biomes affecting display and gameplay
- **Town Management**: Create towns with detailed 5x5 grids and building systems
- **Free-Hand Drawing**: Draw roads, rivers, and landmarks over the hex grid
- **Performance Optimized**: Efficient rendering for large world maps using PIXI.js

## New Feature: Background Image Upload

The application now supports uploading background images that display behind the hex grid. Features include:

- Upload JPG, PNG, TIFF, and other image formats
- Real-time scale and position controls
- Server-side storage with map-coded filenames
- Fallback to local display for development
- Complete visibility and management controls

See [BACKGROUND_IMAGES.md](./BACKGROUND_IMAGES.md) for detailed documentation.

## Getting Started

### Development (Client Only)
```bash
npm install
npm run dev
```

### Full Stack Development (Client + Server)
```bash
npm install
npm run server:install
npm run dev:full
```

### Server Only
```bash
npm run server:install
npm run dev:server
```

## Technical Stack

- **Frontend**: React 19, TypeScript, Vite
- **Graphics**: PIXI.js for high-performance rendering
- **Backend**: Express.js with Multer for file uploads
- **Styling**: CSS with component-based architecture

## Project Structure

```
World Map/
├── server/                    # Express server for file uploads
│   ├── server.js             # Main server file
│   ├── upload.js             # Upload endpoints
│   └── package.json          # Server dependencies
├── public/
│   └── uploads/backgrounds/   # Background image storage
├── src/
│   ├── components/
│   │   ├── WorldMap/         # Main map components
│   │   ├── Tools/            # Tool panels and controls
│   │   └── TownView/         # Town management
│   ├── types/                # TypeScript type definitions
│   └── utils/                # Utility functions and APIs
└── package.json              # Main project dependencies
```

## Available Scripts

- `npm run dev` - Start development client only
- `npm run dev:server` - Start server only
- `npm run dev:full` - Start both client and server
- `npm run build` - Build for production
- `npm run server:install` - Install server dependencies

## Contributing

This is a tabletop RPG tool focused on world-building and map creation. Key development areas include:

1. **Performance Optimization**: Efficient rendering for large maps
2. **User Experience**: Intuitive tools and interfaces
3. **Data Management**: Save/load functionality and export features
4. **Visual Features**: Enhanced graphics and customization options

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config({
  extends: [
    // Remove ...tseslint.configs.recommended and replace with this
    ...tseslint.configs.recommendedTypeChecked,
    // Alternatively, use this for stricter rules
    ...tseslint.configs.strictTypeChecked,
    // Optionally, add this for stylistic rules
    ...tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config({
  plugins: {
    // Add the react-x and react-dom plugins
    'react-x': reactX,
    'react-dom': reactDom,
  },
  rules: {
    // other rules...
    // Enable its recommended typescript rules
    ...reactX.configs['recommended-typescript'].rules,
    ...reactDom.configs.recommended.rules,
  },
})
```
