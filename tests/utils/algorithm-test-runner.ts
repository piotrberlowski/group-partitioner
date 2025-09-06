/**
 * Common test utilities for running and comparing algorithms
 */

import { solveMIP } from '../../src/algorithms/mip-solver';
import { solveClustering } from '../../src/algorithms/clustering';
import type { Competitor, AlgorithmResult, PartitionOptions } from '../../src/types';

export interface AlgorithmTestResults {
    mip: AlgorithmResult;
    clustering: AlgorithmResult;
}

/**
 * Runs all available algorithms on a dataset with the same options
 * Common pattern used across multiple test files
 */
export function runAllAlgorithms(
    competitors: Competitor[],
    options: Partial<PartitionOptions> = {}
): AlgorithmTestResults {
    return {
        mip: solveMIP(competitors, options),
        clustering: solveClustering(competitors, options),
    };
}

/**
 * Runs all algorithms and validates they all satisfy constraints
 * Common test pattern
 */
export function runAndValidateAllAlgorithms(
    competitors: Competitor[],
    options: Partial<PartitionOptions> = {},
    expectConstraintsMet: (competitors: Competitor[], result: any, options?: any) => void
): AlgorithmTestResults {
    const results = runAllAlgorithms(competitors, options);

    // Validate all results meet constraints
    Object.entries(results).forEach(([algorithmName, result]) => {
        if (result) {
            expectConstraintsMet(competitors, result.result, options);
        }
    });

    return results;
}

/**
 * Common test for guardian family integrity across algorithms
 */
export function testGuardianFamilyIntegrity(
    competitors: Competitor[],
    results: AlgorithmTestResults,
    guardianPairs: Array<{ guardian: string; dependents: string[] }>
): void {
    Object.entries(results).forEach(([algorithmName, result]) => {
        const subsets = result.result.subsets;
        const competitorToSubset = new Map<string, number>();

        // Map competitors to their subsets
        for (let i = 0; i < subsets.length; i++) {
            for (const competitor of subsets[i]) {
                competitorToSubset.set(competitor.id, i);
            }
        }

        // Verify all guardian families are kept together
        for (const family of guardianPairs) {
            const guardianSubset = competitorToSubset.get(family.guardian);
            for (const dependent of family.dependents) {
                expect(competitorToSubset.get(dependent)).toBe(guardianSubset);
            }
        }
    });
}

/**
 * Common test datasets array for iteration
 */
export const COMMON_TEST_DATASETS = [
    'small',
    'medium',
    'large',
    'minimum',
    'homogeneous',
    'diverse'
] as const;

export type CommonTestDataset = typeof COMMON_TEST_DATASETS[number];

/**
 * Common test pattern for running algorithms on multiple datasets
 */
export function testAlgorithmsOnDatasets(
    datasets: Array<{ name: string; data: Competitor[] }>,
    testFunction: (name: string, data: Competitor[], results: AlgorithmTestResults) => void
): void {
    datasets.forEach(({ name, data }) => {
        const results = runAllAlgorithms(data);
        testFunction(name, data, results);
    });
}

/**
 * Common expectations for algorithm results
 */
export const commonAlgorithmExpectations = {
    hasValidExecutionTime: (result: AlgorithmResult) => {
        expect(result.executionTime).toBeGreaterThanOrEqual(0);
    },

    hasAlgorithmName: (result: AlgorithmResult) => {
        expect(result.algorithmUsed).toBeDefined();
        expect(typeof result.algorithmUsed).toBe('string');
        expect(result.algorithmUsed.length).toBeGreaterThan(0);
    },

    hasValidMetadata: (result: AlgorithmResult, expectedCompetitorCount: number) => {
        expect(result.result.metadata.totalCompetitors).toBe(expectedCompetitorCount);
        expect(result.result.metadata.totalSubsets).toBeGreaterThanOrEqual(0);
        expect(result.result.metadata.averageSubsetSize).toBeGreaterThanOrEqual(0);
        expect(result.result.score).toBeGreaterThanOrEqual(0);
    },

    hasValidSubsets: (result: AlgorithmResult) => {
        expect(Array.isArray(result.result.subsets)).toBe(true);
        result.result.subsets.forEach(subset => {
            expect(Array.isArray(subset)).toBe(true);
            subset.forEach(competitor => {
                expect(competitor).toHaveProperty('id');
                expect(competitor).toHaveProperty('equipmentClass');
                expect(competitor).toHaveProperty('ageCategory');
                expect(competitor).toHaveProperty('gender');
            });
        });
    }
};
