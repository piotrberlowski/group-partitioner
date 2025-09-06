/**
 * Group Planner Library
 * 
 * A TypeScript library for competitor partitioning algorithms.
 * Provides three different approaches: Mixed Integer Programming, 
 * K-means Clustering, and Branch-and-bound.
 */

// Core types
export type {
    Competitor,
    PartitionOptions,
    PartitionResult,
    AlgorithmResult,
    EquipmentClass,
    AgeGroup,
    Gender,
    Algorithm,
} from './types';

// Utility functions
export {
    validatePartition,
    calculateScore,
    createPartitionResult,
    getGuardianGroups,
    createGuardianFamilies,
    validateGuardianConstraints,
    isValidCompetitor,
    validateCompetitors,
    DEFAULT_OPTIONS,
} from './utils';

// Constants and validation
export {
    EQUIPMENT_CLASSES,
    AGE_GROUPS,
    GENDERS,
    EQUIPMENT_CLASS_DESCRIPTIONS,
    AGE_GROUP_DESCRIPTIONS,
    GENDER_DESCRIPTIONS,
    isValidEquipmentClass,
    isValidAgeGroup,
    isValidGender,
    getAgeGroupOrder,
    compareAgeGroups,
} from './constants';

// Algorithm implementations
export { solveMIP } from './algorithms/mip-solver';
export { solveMIPWithLP } from './algorithms/mip-solver-lp';
export { solveClustering } from './algorithms/clustering';

// Import types and functions for internal use
import type { Competitor, PartitionOptions, AlgorithmResult } from './types';
import { solveMIP } from './algorithms/mip-solver';
import { solveMIPWithLP } from './algorithms/mip-solver-lp';
import { solveClustering } from './algorithms/clustering';

/**
 * Main solver function - single API entry point for all algorithms
 * 
 * @param competitors - Array of competitor objects to partition
 * @param options - Configuration options including algorithm selection
 * @returns Algorithm result with partitioned subsets
 * 
 * @example
 * ```typescript
 * // Use specific algorithm
 * const result = solve(competitors, { algorithm: 'mip' });
 * 
 * // Use auto-selection (runs all algorithms, returns best)
 * const result = solve(competitors, { algorithm: 'auto' });
 * 
 * // Use default algorithm (auto)
 * const result = solve(competitors);
 * ```
 */
export async function solve(
    competitors: Competitor[],
    options: Partial<PartitionOptions> = {}
): Promise<AlgorithmResult> {
    const algorithm = options.algorithm || 'auto';

    switch (algorithm) {
        case 'mip':
            return solveMIP(competitors, options);

        case 'mip-lp':
            return await solveMIPWithLP(competitors, options);

        case 'clustering':
            return solveClustering(competitors, options);

        case 'auto':
        default:
            // Auto mode: run all algorithms and return the best result
            const results: AlgorithmResult[] = [
                solveMIP(competitors, options),
                await solveMIPWithLP(competitors, options),
                solveClustering(competitors, options),
            ];

            const bestResult = results.reduce((best, current) =>
                current.result.score > best.result.score ? current : best
            );

            return {
                ...bestResult,
                algorithmUsed: `${bestResult.algorithmUsed} (auto-selected)`,
            };
    }
}

/**
 * Runs all algorithms and returns detailed results for comparison
 * 
 * @param competitors - Array of competitor objects to partition
 * @param options - Configuration options (algorithm option is ignored)
 * @returns Object with best result and all algorithm results
 * 
 * @example
 * ```typescript
 * const { bestResult, allResults } = compareAlgorithms(competitors);
 * console.log('Best:', bestResult.algorithmUsed);
 * allResults.forEach(r => console.log(`${r.algorithmUsed}: ${r.result.score}`));
 * ```
 */
export async function compareAlgorithms(
    competitors: Competitor[],
    options: Partial<PartitionOptions> = {}
): Promise<{
    bestResult: AlgorithmResult;
    allResults: AlgorithmResult[];
}> {
    // Remove algorithm option to avoid affecting individual algorithms
    const { algorithm, ...algorithmOptions } = options;

    const results: AlgorithmResult[] = [
        solveMIP(competitors, algorithmOptions),
        await solveMIPWithLP(competitors, algorithmOptions),
        solveClustering(competitors, algorithmOptions),
    ];

    const bestResult = results.reduce((best, current) =>
        current.result.score > best.result.score ? current : best
    );

    return {
        bestResult,
        allResults: results,
    };
}

// Version
export const version = '0.1.0';
