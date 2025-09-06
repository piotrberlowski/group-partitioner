/**
 * Integration tests comparing all algorithms
 * Uses the same datasets to ensure consistent constraint satisfaction
 */

import { solveMIP } from '../../src/algorithms/mip-solver';
import { solveClustering } from '../../src/algorithms/clustering';
import { solve, compareAlgorithms } from '../../src/index';

import { smallDataset, smallDatasetExpectedConstraints } from '../data/small-dataset';
import { mediumDataset, mediumDatasetExpectedConstraints } from '../data/medium-dataset';
import { largeDataset, largeDatasetExpectedConstraints } from '../data/large-dataset';
import {
    minimumDataset,
    homogeneousDataset,
    diverseDataset,
    edgeCaseExpectedConstraints
} from '../data/edge-cases';

import { expectAllConstraintsMet, calculateOptimizationMetrics } from '../utils/constraint-validators';
import { runAllAlgorithms, testGuardianFamilyIntegrity, commonAlgorithmExpectations } from '../utils/algorithm-test-runner';
import type { AlgorithmResult, PartitionOptions } from '../../src/types';

describe('Algorithm Comparison Integration Tests', () => {

    // Using common test utility for running algorithms

    describe('Small Dataset Comparison', () => {
        test('all algorithms should satisfy constraints on small dataset', () => {
            const results = runAllAlgorithms(smallDataset);

            expectAllConstraintsMet(smallDataset, results.mip.result);
            expectAllConstraintsMet(smallDataset, results.clustering.result);
        });

        test('all algorithms should handle guardian families', () => {
            const results = runAllAlgorithms(smallDataset);

            // Use common guardian family integrity test
            testGuardianFamilyIntegrity(smallDataset, results, smallDatasetExpectedConstraints.guardianPairs);
        });
    });

    describe('Medium Dataset Comparison', () => {
        test('all algorithms should satisfy constraints on medium dataset', () => {
            const results = runAllAlgorithms(mediumDataset);

            expectAllConstraintsMet(mediumDataset, results.mip.result);
            expectAllConstraintsMet(mediumDataset, results.clustering.result);
        });

        test('all algorithms should handle multiple guardian families', () => {
            const results = runAllAlgorithms(mediumDataset);

            [results.mip, results.clustering].forEach((result, index) => {
                const algorithmName = ['MIP', 'Clustering'][index];
                const subsets = result.result.subsets;
                const competitorToSubset = new Map<string, number>();

                for (let i = 0; i < subsets.length; i++) {
                    for (const competitor of subsets[i]) {
                        competitorToSubset.set(competitor.id, i);
                    }
                }

                // Verify all guardian families are kept together
                for (const family of mediumDatasetExpectedConstraints.guardianPairs) {
                    const guardianSubset = competitorToSubset.get(family.guardian);
                    for (const dependent of family.dependents) {
                        expect(competitorToSubset.get(dependent)).toBe(guardianSubset);
                    }
                }
            });
        });

        test('algorithms should show different optimization characteristics', () => {
            const groupedOptions = { groupByEquipmentClass: true, equipmentClassWeight: 2.0 };
            const results = runAllAlgorithms(mediumDataset, groupedOptions);

            // All should satisfy constraints
            expectAllConstraintsMet(mediumDataset, results.mip.result, groupedOptions);
            expectAllConstraintsMet(mediumDataset, results.clustering.result, groupedOptions);

            // Calculate metrics for each
            const mipMetrics = calculateOptimizationMetrics(results.mip.result.subsets, groupedOptions);
            const clusteringMetrics = calculateOptimizationMetrics(results.clustering.result.subsets, groupedOptions);

            // All should achieve reasonable equipment homogeneity
            expect(mipMetrics.equipmentHomogeneity).toBeGreaterThan(0.2);
            expect(clusteringMetrics.equipmentHomogeneity).toBeGreaterThan(0.2);
        });
    });

    describe('Large Dataset Comparison', () => {
        test('MIP and Clustering should handle large dataset', () => {
            // Only test MIP and Clustering for large dataset
            const mipResult = solveMIP(largeDataset);
            const clusteringResult = solveClustering(largeDataset);

            expectAllConstraintsMet(largeDataset, mipResult.result);
            expectAllConstraintsMet(largeDataset, clusteringResult.result);

            // Both should produce reasonable scores
            expect(mipResult.result.score).toBeGreaterThan(10);
            expect(clusteringResult.result.score).toBeGreaterThan(5);
        });
    });

    describe('Edge Cases', () => {
        test('all algorithms should handle minimum dataset', () => {
            const results = runAllAlgorithms(minimumDataset);

            expectAllConstraintsMet(minimumDataset, results.mip.result);
            expectAllConstraintsMet(minimumDataset, results.clustering.result);

            // Should produce exactly 1 subset
            expect(results.mip.result.metadata.totalSubsets).toBe(1);
            expect(results.clustering.result.metadata.totalSubsets).toBe(1);
        });

        test('all algorithms should handle homogeneous dataset', () => {
            const results = runAllAlgorithms(homogeneousDataset);

            expectAllConstraintsMet(homogeneousDataset, results.mip.result);
            expectAllConstraintsMet(homogeneousDataset, results.clustering.result);

            // Should achieve high homogeneity scores
            [results.mip, results.clustering].forEach(result => {
                expect(result.result.metadata.scoreBreakdown.ageCategoryScore).toBeGreaterThan(8);
            });
        });

        test('all algorithms should handle diverse dataset', () => {
            const results = runAllAlgorithms(diverseDataset);

            expectAllConstraintsMet(diverseDataset, results.mip.result);
            expectAllConstraintsMet(diverseDataset, results.clustering.result);

            // All should produce valid results
            expect(results.mip.result.score).toBeGreaterThan(2);
            expect(results.clustering.result.score).toBeGreaterThan(2);
        });
    });

    describe('Unified API Tests', () => {
        test('solve function should work with algorithm selection', async () => {
            const mipResult = await solve(smallDataset, { algorithm: 'mip' });
            const clusteringResult = await solve(smallDataset, { algorithm: 'clustering' });

            expectAllConstraintsMet(smallDataset, mipResult.result);
            expectAllConstraintsMet(smallDataset, clusteringResult.result);
        });

        test('compareAlgorithms function should work correctly', async () => {
            const comparison = await compareAlgorithms(smallDataset);

            expect(comparison.bestResult).toBeDefined();
            expect(comparison.allResults).toHaveLength(3); // mip, mip-lp, clustering

            // All results should satisfy constraints
            comparison.allResults.forEach(result => {
                expectAllConstraintsMet(smallDataset, result.result);
            });
        });
    });

    describe('Consistency and Reliability', () => {
        test('algorithms should produce consistent results with same input', () => {
            // Run each algorithm multiple times
            const runs = 3;
            const mipScores: number[] = [];
            const clusteringScores: number[] = [];

            for (let i = 0; i < runs; i++) {
                const mipResult = solveMIP(smallDataset);
                const clusteringResult = solveClustering(smallDataset);

                expectAllConstraintsMet(smallDataset, mipResult.result);
                expectAllConstraintsMet(smallDataset, clusteringResult.result);

                mipScores.push(mipResult.result.score);
                clusteringScores.push(clusteringResult.result.score);
            }

            // MIP should be deterministic (same scores)
            const mipVariation = Math.max(...mipScores) - Math.min(...mipScores);
            expect(mipVariation).toBeLessThan(0.1); // Very small variation allowed

            // Clustering may have some variation due to randomness, but should be reasonable
            const clusteringVariation = Math.max(...clusteringScores) - Math.min(...clusteringScores);
            expect(clusteringVariation).toBeLessThan(Math.max(...clusteringScores) * 0.35); // Less than 35% variation due to randomness
        });

        test('all algorithms should handle empty input gracefully', () => {
            const results = runAllAlgorithms([]);

            expect(results.mip.result.subsets).toEqual([]);
            expect(results.clustering.result.subsets).toEqual([]);

            expect(results.mip.result.metadata.totalCompetitors).toBe(0);
            expect(results.clustering.result.metadata.totalCompetitors).toBe(0);
        });
    });
});