/**
 * Unit tests for Mixed Integer Programming solver
 */

import { solveMIP } from '../../src/algorithms/mip-solver';
import { smallDataset, smallDatasetExpectedConstraints } from '../data/small-dataset';
import { mediumDataset, mediumDatasetExpectedConstraints } from '../data/medium-dataset';
import { largeDataset, largeDatasetExpectedConstraints } from '../data/large-dataset';
import {
    minimumDataset,
    homogeneousDataset,
    diverseDataset,
    largeGuardianFamily,
    edgeCaseExpectedConstraints
} from '../data/edge-cases';
import { expectAllConstraintsMet } from '../utils/constraint-validators';

describe('MIP Solver', () => {
    describe('Small Dataset Tests', () => {
        test('should solve small dataset with all constraints met', () => {
            const result = solveMIP(smallDataset);

            expect(result.algorithmUsed).toBe('Mixed Integer Programming');
            expect(result.executionTime).toBeGreaterThan(0);
            expect(result.result.metadata.totalCompetitors).toBe(smallDatasetExpectedConstraints.totalCompetitors);

            expectAllConstraintsMet(smallDataset, result.result);
        });

        test('should respect guardian relationships in small dataset', () => {
            const result = solveMIP(smallDataset);

            // Check specific guardian-dependent pairs are in same subset
            const subsets = result.result.subsets;
            const competitorToSubset = new Map<string, number>();

            for (let i = 0; i < subsets.length; i++) {
                for (const competitor of subsets[i]) {
                    competitorToSubset.set(competitor.id, i);
                }
            }

            // Guardian 003 and dependent 004 should be in same subset
            expect(competitorToSubset.get('003')).toBe(competitorToSubset.get('004'));

            // Guardian 005 and dependents 006, 007 should be in same subset
            expect(competitorToSubset.get('005')).toBe(competitorToSubset.get('006'));
            expect(competitorToSubset.get('005')).toBe(competitorToSubset.get('007'));
        });

        test('should create reasonable number of subsets for small dataset', () => {
            const result = solveMIP(smallDataset);

            expect(result.result.metadata.totalSubsets).toBeGreaterThanOrEqual(smallDatasetExpectedConstraints.minSubsets);
            expect(result.result.metadata.totalSubsets).toBeLessThanOrEqual(smallDatasetExpectedConstraints.maxSubsets);
        });
    });

    describe('Medium Dataset Tests', () => {
        test('should solve medium dataset with all constraints met', () => {
            const result = solveMIP(mediumDataset);

            expect(result.algorithmUsed).toBe('Mixed Integer Programming');
            expect(result.result.metadata.totalCompetitors).toBe(mediumDatasetExpectedConstraints.totalCompetitors);

            expectAllConstraintsMet(mediumDataset, result.result);
        });

        test('should handle multiple guardian families in medium dataset', () => {
            const result = solveMIP(mediumDataset);
            const subsets = result.result.subsets;
            const competitorToSubset = new Map<string, number>();

            for (let i = 0; i < subsets.length; i++) {
                for (const competitor of subsets[i]) {
                    competitorToSubset.set(competitor.id, i);
                }
            }

            // Verify each guardian family is together
            for (const family of mediumDatasetExpectedConstraints.guardianPairs) {
                const guardianSubset = competitorToSubset.get(family.guardian);
                expect(guardianSubset).toBeDefined();

                for (const dependent of family.dependents) {
                    expect(competitorToSubset.get(dependent)).toBe(guardianSubset);
                }
            }
        });

        test('should optimize for preferred subset size in medium dataset', () => {
            const result = solveMIP(mediumDataset, { preferredSubsetSize: 4 });

            // Count subsets at preferred size
            const preferredSizeCount = result.result.subsets.filter(subset => subset.length === 4).length;
            const totalSubsets = result.result.subsets.length;

            // At least some subsets should be at preferred size
            expect(preferredSizeCount / totalSubsets).toBeGreaterThan(0.3);
        });
    });

    describe('Large Dataset Tests', () => {
        test('should solve maximum dataset (168 competitors) with all constraints met', () => {
            const result = solveMIP(largeDataset);

            expect(result.algorithmUsed).toBe('Mixed Integer Programming');
            expect(result.result.metadata.totalCompetitors).toBe(largeDatasetExpectedConstraints.totalCompetitors);

            expectAllConstraintsMet(largeDataset, result.result);
        });

        test('should not exceed maximum subset limit with large dataset', () => {
            const result = solveMIP(largeDataset);

            expect(result.result.metadata.totalSubsets).toBeLessThanOrEqual(28);
        });

        test('should handle all guardian relationships in large dataset', () => {
            const result = solveMIP(largeDataset);
            const subsets = result.result.subsets;
            const competitorToSubset = new Map<string, number>();

            for (let i = 0; i < subsets.length; i++) {
                for (const competitor of subsets[i]) {
                    competitorToSubset.set(competitor.id, i);
                }
            }

            // Verify all guardian families are together
            for (const family of largeDatasetExpectedConstraints.guardianPairs) {
                const guardianSubset = competitorToSubset.get(family.guardian);
                expect(guardianSubset).toBeDefined();

                for (const dependent of family.dependents) {
                    const dependentSubset = competitorToSubset.get(dependent);
                    expect(dependentSubset).toBe(guardianSubset);
                }
            }
        });

        test('should complete large dataset in reasonable time', () => {
            const result = solveMIP(largeDataset);

            // Should complete within 10 seconds
            expect(result.executionTime).toBeLessThan(10000);
        });
    });

    describe('Edge Cases', () => {
        test('should handle minimum dataset (2 competitors)', () => {
            const result = solveMIP(minimumDataset);

            expectAllConstraintsMet(minimumDataset, result.result);
            expect(result.result.metadata.totalSubsets).toBe(1);
            expect(result.result.subsets[0].length).toBe(2);
        });

        test('should handle homogeneous dataset', () => {
            const result = solveMIP(homogeneousDataset);

            expectAllConstraintsMet(homogeneousDataset, result.result);

            // Should achieve high age category homogeneity
            expect(result.result.metadata.scoreBreakdown.ageCategoryScore).toBeGreaterThan(8);
        });

        test('should handle diverse dataset', () => {
            const result = solveMIP(diverseDataset);

            expectAllConstraintsMet(diverseDataset, result.result);

            // With diverse equipment classes, score depends on groupByEquipmentClass option
            const groupedResult = solveMIP(diverseDataset, { groupByEquipmentClass: true });
            const distributedResult = solveMIP(diverseDataset, { groupByEquipmentClass: false });

            expect(groupedResult.result.score).toBeGreaterThan(0);
            expect(distributedResult.result.score).toBeGreaterThan(0);
        });

        test('should handle large guardian family', () => {
            const result = solveMIP(largeGuardianFamily);

            expectAllConstraintsMet(largeGuardianFamily, result.result);

            // The family of 3 should be in the same subset (max allowed family size)
            const subsets = result.result.subsets;
            const familyMembers = ['001', '002', '003']; // Guardian + 2 dependents
            const competitorToSubset = new Map<string, number>();

            for (let i = 0; i < subsets.length; i++) {
                for (const competitor of subsets[i]) {
                    competitorToSubset.set(competitor.id, i);
                }
            }

            const familySubset = competitorToSubset.get('001');
            for (const memberId of familyMembers) {
                expect(competitorToSubset.get(memberId)).toBe(familySubset);
            }
        });
    });

    describe('Options Testing', () => {
        test('should respect custom subset size preferences', () => {
            const result3 = solveMIP(mediumDataset, { preferredSubsetSize: 3 });
            const result5 = solveMIP(mediumDataset, { preferredSubsetSize: 5 });

            expectAllConstraintsMet(mediumDataset, result3.result);
            expectAllConstraintsMet(mediumDataset, result5.result);

            // Should tend toward different subset sizes
            const avg3 = result3.result.metadata.averageSubsetSize;
            const avg5 = result5.result.metadata.averageSubsetSize;

            expect(Math.abs(avg3 - 3)).toBeLessThanOrEqual(Math.abs(avg3 - 5));
            expect(Math.abs(avg5 - 5)).toBeLessThanOrEqual(Math.abs(avg5 - 3));
        });

        test('should handle equipment class grouping options', () => {
            const groupedResult = solveMIP(diverseDataset, {
                groupByEquipmentClass: true,
                equipmentClassWeight: 2.0
            });

            const distributedResult = solveMIP(diverseDataset, {
                groupByEquipmentClass: false,
                equipmentClassWeight: 2.0
            });

            expectAllConstraintsMet(diverseDataset, groupedResult.result);
            expectAllConstraintsMet(diverseDataset, distributedResult.result);

            // Equipment class scores should differ based on strategy
            expect(groupedResult.result.metadata.scoreBreakdown.equipmentClassScore)
                .not.toBe(distributedResult.result.metadata.scoreBreakdown.equipmentClassScore);
        });
    });

    describe('Error Handling', () => {
        test('should handle empty competitor array', () => {
            const result = solveMIP([]);

            expect(result.result.subsets).toEqual([]);
            expect(result.result.metadata.totalCompetitors).toBe(0);
            expect(result.result.metadata.totalSubsets).toBe(0);
        });

        test('should handle invalid options gracefully', () => {
            const result = solveMIP(smallDataset, {
                minSubsetSize: 10, // Too large
                maxSubsetSize: 1,  // Too small
                preferredSubsetSize: 0 // Invalid
            });

            // Should still produce a valid result with default constraints
            expectAllConstraintsMet(smallDataset, result.result);
        });
    });
});
