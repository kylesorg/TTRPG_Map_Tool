## Project Overview

This project is a Tabletop RPG world-making tool. It will allow users to create and manage large hexagonal world maps, design towns with a grid-based system, and add details like biomes, encounters, notes, and free-hand drawings for roads and rivers.

## Key Features

*   **Hexagonal World Map:**
    *   Large grid of hexagonal tiles (each representing 12 miles).
    *   Selectable hexes displaying details:
        *   Biome (list of 28, affecting display).
        *   Encounters (with custom properties).
        *   Notes.
        *   Other potential information.
*   **Free-Hand Drawing Tool:**
    *   Draw roads, rivers, and landmarks over the hex grid.
*   **Town Creation & Management:**
    *   Designated hexes can be towns.
    *   Town details: icon/art, notes, population, races, etc.
    *   "Enter Town" button loads a 5x5 grid (500x500, 5-foot squares).
    *   Default cell color based on biome.
    *   Change cell appearance to represent buildings.
    *   Group multiple cells into a single building (e.g., "Tavern").
    *   Edit building details (notes, etc.).
*   **Tools & Modes:**
    *   Select tool.
    *   Group tool (for buildings).
    *   Create mode.
    *   View mode.

## Tech Stack

*   Node.js
*   Vite
*   React
*   TypeScript

## Important Considerations

*   **Scalability:** The world map can be very large, so performance is crucial.
*   **Data Management:** Need an efficient way to store and retrieve map and town data.
*   **User Interface:** Should be intuitive and easy to use.

## Development Workflow

1.  **World Map Core:** Implement the hexagonal grid and basic hex selection/details.
2.  **Drawing Tool:** Develop the free-hand drawing functionality.
3.  **Town System:** Implement town creation, the 5x5 grid, and building management.
4.  **UI/UX:** Refine the user interface and experience.
5.  **Data Persistence:** Implement a way to save and load created worlds.

Remember to break down tasks into smaller, manageable pieces. Focus on one feature at a time.
