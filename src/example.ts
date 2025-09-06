/**
 * Example usage of the competitor partitioning algorithms
 */

import type { Competitor, PartitionOptions } from './types';
import { solve, compareAlgorithms, solveMIP, solveClustering, createGuardianFamilies, validateGuardianConstraints } from './index';

// Example competitors data with guardian relationships using realistic categories
const exampleCompetitors: Competitor[] = [
    { id: '001', equipmentClass: 'HB', ageCategory: 'J', gender: 'M' },
    { id: '002', equipmentClass: 'HB', ageCategory: 'J', gender: 'F' },
    { id: '003', equipmentClass: 'LB', ageCategory: 'A', gender: 'M' }, // Guardian
    { id: '004', equipmentClass: 'LB', ageCategory: 'A', gender: 'F' }, // Guardian
    { id: '005', equipmentClass: 'TR', ageCategory: 'YA', gender: 'M' },
    { id: '006', equipmentClass: 'TR', ageCategory: 'YA', gender: 'F' },
    { id: '007', equipmentClass: 'BHR', ageCategory: 'V', gender: 'M' }, // Guardian
    { id: '008', equipmentClass: 'BHR', ageCategory: 'V', gender: 'F' },
    { id: '009', equipmentClass: 'BBR', ageCategory: 'C', gender: 'M', guardianId: '003' }, // Child dependent of 003
    { id: '010', equipmentClass: 'FSR', ageCategory: 'C', gender: 'F', guardianId: '004' }, // Child dependent of 004
    { id: '011', equipmentClass: 'BBC', ageCategory: 'J', gender: 'M' },
    { id: '012', equipmentClass: 'BBC', ageCategory: 'J', gender: 'F' },
    { id: '013', equipmentClass: 'BL', ageCategory: 'C', gender: 'M', guardianId: '007' }, // Child dependent of 007
    { id: '014', equipmentClass: 'BU', ageCategory: 'C', gender: 'F', guardianId: '007' }, // Another child dependent of 007
    { id: '015', equipmentClass: 'FSC', ageCategory: 'S', gender: 'M' },
    { id: '016', equipmentClass: 'FSC', ageCategory: 'S', gender: 'F' },
    { id: '017', equipmentClass: 'FU', ageCategory: 'YA', gender: 'M' },
    { id: '018', equipmentClass: 'FU', ageCategory: 'YA', gender: 'F' },
    { id: '019', equipmentClass: 'HB', ageCategory: 'A', gender: 'M' }, // Guardian
    { id: '020', equipmentClass: 'LB', ageCategory: 'C', gender: 'M', guardianId: '019' }, // Child dependent of 019
];

// Example options
const options: PartitionOptions = {
    groupByEquipmentClass: true,
    maxSubsets: 28,
    minSubsetSize: 2,
    maxSubsetSize: 6,
    preferredSubsetSize: 4,
    genderWeight: 1.0,
    ageCategoryWeight: 1.0,
    equipmentClassWeight: 1.0,
};

/**
 * Example function demonstrating all three algorithms
 */
export async function runExample(): Promise<void> {
    console.log('=== Competitor Partitioning Example with Unified API ===\n');
    console.log(`Total competitors: ${exampleCompetitors.length}`);

    // Show guardian families
    const families = createGuardianFamilies(exampleCompetitors);
    console.log(`Guardian families: ${families.length}`);
    families.forEach((family, index) => {
        if (family.length > 1) {
            const guardianId = family.find(c => exampleCompetitors.some(comp => comp.guardianId === c.id))?.id || family[0].id;
            const dependents = family.filter(c => c.guardianId === guardianId);
            console.log(`  Family ${index + 1}: Guardian ${guardianId} with dependents [${dependents.map(d => d.id).join(', ')}]`);
        } else {
            console.log(`  Individual ${index + 1}: ${family[0].id}`);
        }
    });

    console.log(`\nOptions:`, options);
    console.log('\n');

    // Demonstrate the new unified API
    console.log('=== New Unified API Examples ===');

    // 1. Use auto-selection (default behavior)
    console.log('\n1. Auto-selection (runs all algorithms, returns best):');
    const autoResult = await solve(exampleCompetitors, options);
    console.log(`   Algorithm used: ${autoResult.algorithmUsed}`);
    console.log(`   Score: ${autoResult.result.score.toFixed(2)}`);
    console.log(`   Execution time: ${autoResult.executionTime.toFixed(2)}ms`);

    // 2. Use specific algorithms
    console.log('\n2. Specific algorithm selection:');

    const mipResult = await solve(exampleCompetitors, { ...options, algorithm: 'mip' });
    console.log(`   MIP: Score ${mipResult.result.score.toFixed(2)} in ${mipResult.executionTime.toFixed(2)}ms`);

    const higgsResult = await solve(exampleCompetitors, { ...options, algorithm: 'mip-lp' });
    console.log(`   HiGHS: Score ${higgsResult.result.score.toFixed(2)} in ${higgsResult.executionTime.toFixed(2)}ms`);

    const clusteringResult = await solve(exampleCompetitors, { ...options, algorithm: 'clustering' });
    console.log(`   Clustering: Score ${clusteringResult.result.score.toFixed(2)} in ${clusteringResult.executionTime.toFixed(2)}ms`);

    // 3. Compare all algorithms
    console.log('\n3. Algorithm comparison:');
    const { bestResult: comparisonBest, allResults } = await compareAlgorithms(exampleCompetitors, options);
    console.log(`   Best from comparison: ${comparisonBest.algorithmUsed} (Score: ${comparisonBest.result.score.toFixed(2)})`);
    allResults.forEach((result, index) => {
        console.log(`   ${index + 1}. ${result.algorithmUsed}: ${result.result.score.toFixed(2)} (${result.executionTime.toFixed(2)}ms)`);
    });

    // Use the best result for validation
    const bestResult = autoResult;

    console.log('\n=== Best Solution Subsets ===\n');

    bestResult.result.subsets.forEach((subset: Competitor[], index: number) => {
        console.log(`Subset ${index + 1} (${subset.length} competitors):`);
        subset.forEach((competitor: Competitor) => {
            const guardian = competitor.guardianId ? ` (guardian: ${competitor.guardianId})` : '';
            const isGuardian = exampleCompetitors.some(c => c.guardianId === competitor.id) ? ' [GUARDIAN]' : '';
            const genderDisplay = competitor.gender === 'M' ? 'Male' : 'Female';
            console.log(`  - ${competitor.id}: ${competitor.equipmentClass}/${competitor.ageCategory}/${genderDisplay}${guardian}${isGuardian}`);
        });
        console.log('');
    });

    console.log('=== Score Breakdown ===');
    console.log(`Size Score: ${bestResult.result.metadata.scoreBreakdown.sizeScore.toFixed(2)}`);
    console.log(`Gender Score: ${bestResult.result.metadata.scoreBreakdown.genderScore.toFixed(2)}`);
    console.log(`Age Category Score: ${bestResult.result.metadata.scoreBreakdown.ageCategoryScore.toFixed(2)}`);
    console.log(`Equipment Class Score: ${bestResult.result.metadata.scoreBreakdown.equipmentClassScore.toFixed(2)}`);

    // Validate guardian constraints
    const guardianValidation = validateGuardianConstraints(exampleCompetitors, bestResult.result.subsets);
    console.log('\n=== Guardian Constraint Validation ===');
    console.log(`Valid: ${guardianValidation.valid}`);
    if (!guardianValidation.valid) {
        console.log('Errors:');
        guardianValidation.errors.forEach(error => console.log(`  - ${error}`));
    } else {
        console.log('✅ All guardian constraints satisfied!');
    }
}

/**
 * Example comparing groupByEquipmentClass options
 */
export function compareEquipmentClassOptions(): void {
    console.log('=== Comparing Equipment Class Grouping Options ===\n');

    const groupedOptions: PartitionOptions = { ...options, groupByEquipmentClass: true };
    const distributedOptions: PartitionOptions = { ...options, groupByEquipmentClass: false };

    console.log('1. Grouping by Equipment Class:');
    const groupedResult = solveClustering(exampleCompetitors, groupedOptions);
    console.log(`   Score: ${groupedResult.result.score.toFixed(2)}`);
    console.log(`   Equipment Class Score: ${groupedResult.result.metadata.scoreBreakdown.equipmentClassScore.toFixed(2)}`);

    console.log('\n2. Distributing Equipment Classes:');
    const distributedResult = solveClustering(exampleCompetitors, distributedOptions);
    console.log(`   Score: ${distributedResult.result.score.toFixed(2)}`);
    console.log(`   Equipment Class Score: ${distributedResult.result.metadata.scoreBreakdown.equipmentClassScore.toFixed(2)}`);

    console.log('\n=== Equipment Class Distribution Comparison ===\n');

    [groupedResult, distributedResult].forEach((result, index) => {
        const strategy = index === 0 ? 'Grouped' : 'Distributed';
        console.log(`${strategy} Strategy Subsets:`);

        result.result.subsets.forEach((subset, subsetIndex) => {
            const equipmentClasses = subset.map(c => c.equipmentClass);
            const uniqueClasses = [...new Set(equipmentClasses)];
            console.log(`  Subset ${subsetIndex + 1}: [${equipmentClasses.join(', ')}] (${uniqueClasses.length} unique)`);
        });
        console.log('');
    });
}

// Uncomment to run examples
// runExample();
// compareEquipmentClassOptions();
