// Debug Console Script for World Map Coordinate Analysis
// Copy and paste this into the browser console to test coordinate debugging

console.log('=== World Map Coordinate Debug Script ===');

// Wait for the application to be ready
function waitForGridManager() {
    if (window.hexGridManager && window.debugHexCoordinates) {
        console.log('✓ Grid manager and debug function are available');

        // Run the coordinate analysis
        console.log('\n--- Running Coordinate Analysis ---');
        window.debugHexCoordinates();

        // Additional debugging info
        console.log('\n--- Additional Debug Info ---');
        console.log('Grid Manager:', window.hexGridManager);

        // Try to get some basic info about the grid
        if (window.hexGridManager.getHexTiles) {
            const tiles = window.hexGridManager.getHexTiles();
            console.log('Total hex tiles:', tiles?.length || 'Method not available');
        }

        return true;
    } else {
        console.log('⏳ Waiting for grid manager to be available...');
        console.log('Available:', {
            hexGridManager: !!window.hexGridManager,
            debugHexCoordinates: !!window.debugHexCoordinates
        });
        return false;
    }
}

// Try immediately, then retry if needed
if (!waitForGridManager()) {
    let attempts = 0;
    const maxAttempts = 10;

    const interval = setInterval(() => {
        attempts++;
        if (waitForGridManager() || attempts >= maxAttempts) {
            clearInterval(interval);
            if (attempts >= maxAttempts) {
                console.log('❌ Grid manager not available after', maxAttempts, 'attempts');
                console.log('Available on window:', Object.keys(window).filter(k => k.includes('hex') || k.includes('debug')));
            }
        }
    }, 1000);
}
