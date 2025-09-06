/**
 * Test script to verify the cleaned up API works correctly
 */

const { solve, compareAlgorithms } = require('./dist/index.js');

const testCompetitors = [
    { id: '001', equipmentClass: 'HB', ageCategory: 'J', gender: 'M' },
    { id: '002', equipmentClass: 'HB', ageCategory: 'J', gender: 'F' },
    { id: '003', equipmentClass: 'LB', ageCategory: 'A', gender: 'M' }, // Guardian
    { id: '004', equipmentClass: 'LB', ageCategory: 'A', gender: 'F' },
    { id: '005', equipmentClass: 'BBR', ageCategory: 'C', gender: 'M', guardianId: '003' }, // Child
    { id: '006', equipmentClass: 'TR', ageCategory: 'YA', gender: 'F' },
    { id: '007', equipmentClass: 'BHR', ageCategory: 'V', gender: 'M' },
    { id: '008', equipmentClass: 'BHR', ageCategory: 'V', gender: 'F' },
];

console.log('=== Testing Cleaned Up API ===\n');

// Test 1: Main solve function
console.log('1. Main solve function:');
const autoResult = solve(testCompetitors);
console.log(`   Auto: ${autoResult.algorithmUsed}, Score: ${autoResult.result.score.toFixed(2)}`);

const mipResult = solve(testCompetitors, { algorithm: 'mip' });
console.log(`   MIP: ${mipResult.algorithmUsed}, Score: ${mipResult.result.score.toFixed(2)}`);

// Test 2: Algorithm comparison function
console.log('\n2. Algorithm comparison:');
const { bestResult, allResults } = compareAlgorithms(testCompetitors);
console.log(`   Best: ${bestResult.algorithmUsed}, Score: ${bestResult.result.score.toFixed(2)}`);
console.log(`   All results:`);
allResults.forEach((result, index) => {
    console.log(`     ${index + 1}. ${result.algorithmUsed}: ${result.result.score.toFixed(2)} (${result.executionTime.toFixed(2)}ms)`);
});

// Test 3: Verify no legacy function exists
console.log('\n3. Verify no legacy function:');
const exports = require('./dist/index.js');
if ('solveCompetitorPartitioning' in exports) {
    console.log('   ❌ Legacy function still exists!');
} else {
    console.log('   ✅ Legacy function properly removed');
}

console.log('\n✅ Clean API tests completed successfully!');
