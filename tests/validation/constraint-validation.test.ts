/**
 * Comprehensive constraint validation tests
 * These tests prove that all constraints are satisfied across all scenarios
 */

import { solveMIP } from '../../src/algorithms/mip-solver';
import { solveClustering } from '../../src/algorithms/clustering';
import { validateCompetitors, validatePartition, validateGuardianConstraints } from '../../src/utils';

import { smallDataset } from '../data/small-dataset';
import { mediumDataset } from '../data/medium-dataset';
import { largeDataset } from '../data/large-dataset';
import {
    minimumDataset,
    homogeneousDataset,
    diverseDataset,
    largeGuardianFamily,
    multipleGuardianChains,
    unevenGenderDataset,
    forceMaxSubsetsDataset
} from '../data/edge-cases';

import {
    validateAllConstraints,
    validateGuardianFamilyIntegrity,
    calculateOptimizationMetrics
} from '../utils/constraint-validators';

import type { Competitor, AlgorithmResult } from '../../src/types';

describe('Constraint Validation Tests', () => {

    const testAllAlgorithms = (competitors: Competitor[], testName: string) => {
        return {
            mip: solveMIP(competitors),
            clustering: solveClustering(competitors),
        };
    };

    describe('Basic Constraint Validation', () => {
        test('all competitors must be assigned exactly once', () => {
            const datasets = [smallDataset, mediumDataset, minimumDataset, homogeneousDataset];

            datasets.forEach((dataset, index) => {
                const results = testAllAlgorithms(dataset, `dataset-${index}`);

                Object.entries(results).forEach(([algorithmName, result]) => {
                    if (!result) return; // Skip null results (e.g., branch-and-bound for large datasets)

                    const assignedCompetitors = new Set<string>();
                    const duplicates: string[] = [];

                    for (const subset of result.result.subsets) {
                        for (const competitor of subset) {
                            if (assignedCompetitors.has(competitor.id)) {
                                duplicates.push(competitor.id);
                            } else {
                                assignedCompetitors.add(competitor.id);
                            }
                        }
                    }

                    // No duplicates allowed
                    expect(duplicates).toHaveLength(0);

                    // All competitors must be assigned
                    expect(assignedCompetitors.size).toBe(dataset.length);

                    // Verify each competitor from original dataset is assigned
                    for (const competitor of dataset) {
                        expect(assignedCompetitors.has(competitor.id)).toBe(true);
                    }
                });
            });
        });

        test('subset size constraints must be respected', () => {
            const datasets = [smallDataset, mediumDataset, largeDataset, diverseDataset];

            datasets.forEach((dataset) => {
                const results = testAllAlgorithms(dataset, 'size-test');

                Object.entries(results).forEach(([algorithmName, result]) => {
                    if (!result) return;

                    for (let i = 0; i < result.result.subsets.length; i++) {
                        const subset = result.result.subsets[i];

                        // Minimum size constraint
                        expect(subset.length).toBeGreaterThanOrEqual(2);

                        // Maximum size constraint
                        expect(subset.length).toBeLessThanOrEqual(6);

                        // Non-empty subsets only
                        expect(subset.length).toBeGreaterThan(0);
                    }
                });
            });
        });

        test('maximum number of subsets constraint', () => {
            const datasets = [smallDataset, mediumDataset, largeDataset, forceMaxSubsetsDataset];

            datasets.forEach((dataset) => {
                const results = testAllAlgorithms(dataset, 'subset-count-test');

                Object.entries(results).forEach(([algorithmName, result]) => {
                    if (!result) return;

                    // Must not exceed maximum of 28 subsets
                    expect(result.result.metadata.totalSubsets).toBeLessThanOrEqual(28);

                    // Must have at least minimum number of subsets needed
                    const minSubsetsNeeded = Math.ceil(dataset.length / 6); // 6 is max subset size
                    expect(result.result.metadata.totalSubsets).toBeGreaterThanOrEqual(minSubsetsNeeded);
                });
            });
        });
    });

    describe('Guardian Constraint Validation', () => {
        test('competitors must be in same subset as their guardians', () => {
            const datasetsWithGuardians = [smallDataset, mediumDataset, largeDataset, largeGuardianFamily, multipleGuardianChains];

            datasetsWithGuardians.forEach((dataset) => {
                const results = testAllAlgorithms(dataset, 'guardian-test');

                Object.entries(results).forEach(([algorithmName, result]) => {
                    if (!result) return;

                    // Create competitor to subset mapping
                    const competitorToSubset = new Map<string, number>();
                    for (let i = 0; i < result.result.subsets.length; i++) {
                        for (const competitor of result.result.subsets[i]) {
                            competitorToSubset.set(competitor.id, i);
                        }
                    }

                    // Check each competitor with a guardian
                    for (const competitor of dataset) {
                        if (competitor.guardianId) {
                            const competitorSubset = competitorToSubset.get(competitor.id);
                            const guardianSubset = competitorToSubset.get(competitor.guardianId);

                            expect(competitorSubset).toBeDefined();
                            expect(guardianSubset).toBeDefined();
                            expect(competitorSubset).toBe(guardianSubset);
                        }
                    }
                });
            });
        });

        test('guardian families must remain intact', () => {
            const datasetsWithGuardians = [smallDataset, mediumDataset, largeDataset, largeGuardianFamily];

            datasetsWithGuardians.forEach((dataset) => {
                const results = testAllAlgorithms(dataset, 'family-integrity-test');

                Object.entries(results).forEach(([algorithmName, result]) => {
                    if (!result) return;

                    const validation = validateGuardianFamilyIntegrity(dataset, result.result.subsets);
                    expect(validation.valid).toBe(true);
                    if (!validation.valid) {
                        console.error(`${algorithmName} failed guardian family integrity:`, validation.errors);
                    }
                });
            });
        });

        test('no circular guardian references should exist in test data', () => {
            const datasets = [smallDataset, mediumDataset, largeDataset, multipleGuardianChains];

            datasets.forEach((dataset) => {
                const validation = validateCompetitors(dataset);
                expect(validation.valid).toBe(true);

                // Specifically check for circular references
                const circularErrors = validation.errors.filter(error => error.includes('circular'));
                expect(circularErrors).toHaveLength(0);
            });
        });
    });

    describe('Comprehensive Constraint Testing', () => {
        test('all constraints satisfied simultaneously on all datasets', () => {
            const allDatasets = [
                { name: 'small', data: smallDataset },
                { name: 'medium', data: mediumDataset },
                { name: 'large', data: largeDataset },
                { name: 'minimum', data: minimumDataset },
                { name: 'homogeneous', data: homogeneousDataset },
                { name: 'diverse', data: diverseDataset },
                { name: 'large-family', data: largeGuardianFamily },
                { name: 'multiple-chains', data: multipleGuardianChains },
                { name: 'uneven-gender', data: unevenGenderDataset },
                { name: 'max-subsets', data: forceMaxSubsetsDataset },
            ];

            allDatasets.forEach(({ name, data }) => {
                const results = testAllAlgorithms(data, name);

                Object.entries(results).forEach(([algorithmName, result]) => {
                    if (!result) return;

                    // Use comprehensive validation
                    const validation = validateAllConstraints(data, result.result);

                    if (!validation.valid) {
                        console.error(`${algorithmName} failed on ${name} dataset:`);
                        validation.errors.forEach(error => console.error(`  - ${error}`));
                    }

                    expect(validation.valid).toBe(true);

                    // All individual constraint types should pass
                    expect(validation.details.basicConstraints).toBe(true);
                    expect(validation.details.guardianConstraints).toBe(true);
                    expect(validation.details.sizeConstraints).toBe(true);
                    expect(validation.details.subsetCountConstraints).toBe(true);
                    expect(validation.details.assignmentConstraints).toBe(true);
                });
            });
        });

        test('constraint validation with custom options', () => {
            const customOptions = [
                { preferredSubsetSize: 3, minSubsetSize: 2, maxSubsetSize: 5 },
                { preferredSubsetSize: 5, minSubsetSize: 3, maxSubsetSize: 6 },
                { maxSubsets: 20, preferredSubsetSize: 4 },
                { genderWeight: 2.0, ageCategoryWeight: 0.5, equipmentClassWeight: 1.5 },
            ];

            customOptions.forEach((options, index) => {
                const mipResult = solveMIP(mediumDataset, options);
                const clusteringResult = solveClustering(mediumDataset, options);

                const mipValidation = validateAllConstraints(mediumDataset, mipResult.result, options);
                const clusteringValidation = validateAllConstraints(mediumDataset, clusteringResult.result, options);

                expect(mipValidation.valid).toBe(true);
                expect(clusteringValidation.valid).toBe(true);

                // Verify custom constraints are respected
                if (options.minSubsetSize) {
                    mipResult.result.subsets.forEach(subset => {
                        expect(subset.length).toBeGreaterThanOrEqual(options.minSubsetSize!);
                    });
                    clusteringResult.result.subsets.forEach(subset => {
                        expect(subset.length).toBeGreaterThanOrEqual(options.minSubsetSize!);
                    });
                }

                if (options.maxSubsets) {
                    expect(mipResult.result.metadata.totalSubsets).toBeLessThanOrEqual(options.maxSubsets);
                    expect(clusteringResult.result.metadata.totalSubsets).toBeLessThanOrEqual(options.maxSubsets);
                }
            });
        });
    });

    describe('Optimization Quality Validation', () => {
        test('algorithms should produce reasonable optimization scores', () => {
            const datasets = [smallDataset, mediumDataset, homogeneousDataset];

            datasets.forEach((dataset) => {
                const results = testAllAlgorithms(dataset, 'optimization-test');

                Object.entries(results).forEach(([algorithmName, result]) => {
                    if (!result) return;

                    // Score should be positive
                    expect(result.result.score).toBeGreaterThan(0);

                    // Individual score components should be reasonable
                    const breakdown = result.result.metadata.scoreBreakdown;
                    expect(breakdown.sizeScore).toBeGreaterThanOrEqual(0);
                    expect(breakdown.genderScore).toBeGreaterThanOrEqual(0);
                    expect(breakdown.ageCategoryScore).toBeGreaterThanOrEqual(0);
                    expect(breakdown.equipmentClassScore).toBeGreaterThanOrEqual(0);

                    // Calculate optimization metrics
                    const metrics = calculateOptimizationMetrics(result.result.subsets);
                    expect(metrics.sizeOptimality).toBeGreaterThan(0);
                    expect(metrics.genderBalance).toBeGreaterThanOrEqual(0);
                    expect(metrics.ageHomogeneity).toBeGreaterThan(0);
                    expect(metrics.equipmentHomogeneity).toBeGreaterThan(0);
                });
            });
        });

        test('homogeneous datasets should achieve high homogeneity scores', () => {
            const results = testAllAlgorithms(homogeneousDataset, 'homogeneity-test');

            Object.entries(results).forEach(([algorithmName, result]) => {
                if (!result) return;

                const metrics = calculateOptimizationMetrics(result.result.subsets);

                // Should achieve very high homogeneity for age and equipment
                expect(metrics.ageHomogeneity).toBeGreaterThan(0.8);
                expect(metrics.equipmentHomogeneity).toBeGreaterThan(0.8);

                // Score breakdown should reflect high homogeneity
                expect(result.result.metadata.scoreBreakdown.ageCategoryScore).toBeGreaterThan(8);
                expect(result.result.metadata.scoreBreakdown.equipmentClassScore).toBeGreaterThan(8);
            });
        });
    });

    describe('Error Handling and Edge Cases', () => {
        test('algorithms should handle invalid input gracefully', () => {
            // Empty dataset
            const emptyResults = testAllAlgorithms([], 'empty-test');
            Object.entries(emptyResults).forEach(([algorithmName, result]) => {
                if (!result) return;
                expect(result.result.subsets).toEqual([]);
                expect(result.result.metadata.totalCompetitors).toBe(0);
            });

            // Single competitor (violates minimum subset size but should handle gracefully)
            const singleCompetitor = [smallDataset[0]];
            const singleResults = testAllAlgorithms(singleCompetitor, 'single-test');
            Object.entries(singleResults).forEach(([algorithmName, result]) => {
                if (!result) return;
                expect(result.result.metadata.totalCompetitors).toBe(1);
                expect(result.result.subsets.length).toBeGreaterThan(0);
            });
        });

        test('validation functions should catch constraint violations', () => {
            // Create an invalid solution manually
            const validResult = solveMIP(smallDataset);

            // Test with missing competitor
            const incompleteSubsets = validResult.result.subsets.map(subset => subset.slice(1)); // Remove first competitor from each subset
            const incompleteValidation = validateAllConstraints(smallDataset, {
                ...validResult.result,
                subsets: incompleteSubsets
            });
            expect(incompleteValidation.valid).toBe(false);
            expect(incompleteValidation.errors.some(e => e.includes('Not all competitors assigned'))).toBe(true);

            // Test with oversized subset
            const oversizedSubsets = [smallDataset]; // Put all competitors in one subset
            const oversizedValidation = validateAllConstraints(smallDataset, {
                ...validResult.result,
                subsets: oversizedSubsets
            });
            expect(oversizedValidation.valid).toBe(false);
            expect(oversizedValidation.errors.some(e => e.includes('too large'))).toBe(true);
        });
    });

    describe('Stress Testing', () => {
        test('maximum dataset should satisfy all constraints', () => {
            // This is the ultimate test - 168 competitors with guardian relationships
            const mipResult = solveMIP(largeDataset);
            const clusteringResult = solveClustering(largeDataset);

            const mipValidation = validateAllConstraints(largeDataset, mipResult.result);
            const clusteringValidation = validateAllConstraints(largeDataset, clusteringResult.result);

            expect(mipValidation.valid).toBe(true);
            expect(clusteringValidation.valid).toBe(true);

            // Should use close to maximum number of subsets
            expect(mipResult.result.metadata.totalSubsets).toBeGreaterThan(25);
            expect(clusteringResult.result.metadata.totalSubsets).toBeGreaterThan(25);

            // Should not exceed maximum
            expect(mipResult.result.metadata.totalSubsets).toBeLessThanOrEqual(28);
            expect(clusteringResult.result.metadata.totalSubsets).toBeLessThanOrEqual(28);

            console.log(`Stress test results:`);
            console.log(`  MIP: ${mipResult.result.metadata.totalSubsets} subsets, score: ${mipResult.result.score.toFixed(2)}`);
            console.log(`  Clustering: ${clusteringResult.result.metadata.totalSubsets} subsets, score: ${clusteringResult.result.score.toFixed(2)}`);
        });
    });
});
