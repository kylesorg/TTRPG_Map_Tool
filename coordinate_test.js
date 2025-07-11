// Quick coordinate range test for flat-top grid generation
// This simulates the coordinate generation logic to predict the ranges

const gridRows = 335;
const gridCols = 596;
const r_axial_offset = -(gridRows - 1); // -334

let minQ = Infinity, maxQ = -Infinity;
let minR = Infinity, maxR = -Infinity;

console.log('Testing coordinate ranges for', gridCols, 'x', gridRows, 'grid');
console.log('r_axial_offset:', r_axial_offset);

// Test just the corners and center to get ranges
const testPoints = [
    { userX: 0, userY: 0 },           // Bottom-left
    { userX: gridCols - 1, userY: 0 },  // Bottom-right  
    { userX: 0, userY: gridRows - 1 },  // Top-left
    { userX: gridCols - 1, userY: gridRows - 1 }, // Top-right
    { userX: Math.floor(gridCols / 2), userY: Math.floor(gridRows / 2) } // Center
];

testPoints.forEach(({ userX, userY }, i) => {
    const vCol = userX;
    const vRow_from_top = (gridRows - 1) - userY;

    const q_prime = vCol;
    const r_prime = vRow_from_top - (vCol + (vCol & 1)) / 2;

    const q_axial = q_prime;
    const r_axial = r_prime + r_axial_offset;

    minQ = Math.min(minQ, q_axial);
    maxQ = Math.max(maxQ, q_axial);
    minR = Math.min(minR, r_axial);
    maxR = Math.max(maxR, r_axial);

    console.log(`Point ${i} (user ${userX},${userY}) -> axial (${q_axial},${r_axial})`);
});

console.log('Predicted ranges:');
console.log('Q:', minQ, 'to', maxQ, '(range:', maxQ - minQ, ')');
console.log('R:', minR, 'to', maxR, '(range:', maxR - minR, ')');

// Expected ranges should be:
// Q: 0 to 595 (range: 595)
// R: ? to ? (range should be around 334)
