/**
 * Utility functions for competitor partitioning
 */

import type { Competitor, PartitionOptions, PartitionResult } from './types';
import { isValidEquipmentClass, isValidAgeGroup, isValidGender } from './constants';

/**
 * Default partition options
 */
export const DEFAULT_OPTIONS: Required<PartitionOptions> = {
    algorithm: 'auto',
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
 * Validates that a partition solution meets all constraints
 */
export function validatePartition(
    competitors: Competitor[],
    subsets: Competitor[][],
    options: Partial<PartitionOptions> = {}
): { valid: boolean; errors: string[] } {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const errors: string[] = [];

    // Check all competitors are assigned exactly once
    const assignedCompetitors = new Set<string>();
    for (const subset of subsets) {
        for (const competitor of subset) {
            if (assignedCompetitors.has(competitor.id)) {
                errors.push(`Competitor ${competitor.id} assigned to multiple subsets`);
            }
            assignedCompetitors.add(competitor.id);
        }
    }

    if (assignedCompetitors.size !== competitors.length) {
        errors.push(`Not all competitors assigned: ${assignedCompetitors.size}/${competitors.length}`);
    }

    // Check subset size constraints
    for (let i = 0; i < subsets.length; i++) {
        const size = subsets[i].length;
        if (size < opts.minSubsetSize) {
            errors.push(`Subset ${i} too small: ${size} < ${opts.minSubsetSize}`);
        }
        if (size > opts.maxSubsetSize) {
            errors.push(`Subset ${i} too large: ${size} > ${opts.maxSubsetSize}`);
        }
    }

    // Check maximum number of subsets
    if (subsets.length > opts.maxSubsets) {
        errors.push(`Too many subsets: ${subsets.length} > ${opts.maxSubsets}`);
    }

    // Check guardian constraints
    const guardianValidation = validateGuardianConstraints(competitors, subsets);
    errors.push(...guardianValidation.errors);

    return { valid: errors.length === 0, errors };
}

/**
 * Calculates the quality score for a partition solution
 */
export function calculateScore(
    subsets: Competitor[][],
    options: Partial<PartitionOptions> = {}
): { score: number; breakdown: PartitionResult['metadata']['scoreBreakdown'] } {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    let sizeScore = 0;
    let genderScore = 0;
    let ageCategoryScore = 0;
    let equipmentClassScore = 0;

    const totalSubsets = subsets.length;

    for (const subset of subsets) {
        const size = subset.length;

        // Size preference score (prefer size of 4, penalize deviation)
        const sizeDeviation = Math.abs(size - opts.preferredSubsetSize);
        sizeScore += Math.max(0, 10 - sizeDeviation * 2);

        // Gender balance score (prefer even numbers of same gender)
        const genderCounts = new Map<string, number>();
        for (const competitor of subset) {
            genderCounts.set(competitor.gender, (genderCounts.get(competitor.gender) || 0) + 1);
        }

        let genderBalance = 0;
        for (const count of genderCounts.values()) {
            if (count % 2 === 0) genderBalance += count;
        }
        genderScore += (genderBalance / size) * 10;

        // Age category homogeneity score
        const ageCategoryCounts = new Map<string, number>();
        for (const competitor of subset) {
            ageCategoryCounts.set(competitor.ageCategory, (ageCategoryCounts.get(competitor.ageCategory) || 0) + 1);
        }

        const maxAgeCount = Math.max(...ageCategoryCounts.values());
        ageCategoryScore += (maxAgeCount / size) * 10;

        // Equipment class score (either homogeneity or distribution based on preference)
        const equipmentCounts = new Map<string, number>();
        for (const competitor of subset) {
            equipmentCounts.set(competitor.equipmentClass, (equipmentCounts.get(competitor.equipmentClass) || 0) + 1);
        }

        if (opts.groupByEquipmentClass) {
            // Prefer homogeneous equipment classes
            const maxEquipmentCount = Math.max(...equipmentCounts.values());
            equipmentClassScore += (maxEquipmentCount / size) * 10;
        } else {
            // Prefer diverse equipment classes
            const uniqueEquipmentCount = equipmentCounts.size;
            equipmentClassScore += (uniqueEquipmentCount / Math.min(size, 3)) * 10; // Cap at 3 for reasonable diversity
        }
    }

    // Average scores across all subsets
    const breakdown = {
        sizeScore: sizeScore / totalSubsets,
        genderScore: (genderScore / totalSubsets) * opts.genderWeight,
        ageCategoryScore: (ageCategoryScore / totalSubsets) * opts.ageCategoryWeight,
        equipmentClassScore: (equipmentClassScore / totalSubsets) * opts.equipmentClassWeight,
    };

    const totalScore = breakdown.sizeScore + breakdown.genderScore + breakdown.ageCategoryScore + breakdown.equipmentClassScore;

    return { score: totalScore, breakdown };
}

/**
 * Creates a partition result with metadata
 */
export function createPartitionResult(
    subsets: Competitor[][],
    options: Partial<PartitionOptions> = {}
): PartitionResult {
    const totalCompetitors = subsets.reduce((sum, subset) => sum + subset.length, 0);
    const { score, breakdown } = calculateScore(subsets, options);

    return {
        subsets,
        score,
        metadata: {
            totalCompetitors,
            totalSubsets: subsets.length,
            averageSubsetSize: totalCompetitors / subsets.length,
            scoreBreakdown: breakdown,
        },
    };
}

/**
 * Helper to get competitors by guardian relationship
 */
export function getGuardianGroups(competitors: Competitor[]): Map<string, Competitor[]> {
    const guardianGroups = new Map<string, Competitor[]>();

    for (const competitor of competitors) {
        if (competitor.guardianId) {
            const key = competitor.guardianId;
            if (!guardianGroups.has(key)) {
                guardianGroups.set(key, []);
            }
            guardianGroups.get(key)!.push(competitor);

            // Also add the guardian if they exist in the competitors list
            const guardian = competitors.find(c => c.id === competitor.guardianId);
            if (guardian && !guardianGroups.get(key)!.includes(guardian)) {
                guardianGroups.get(key)!.push(guardian);
            }
        }
    }

    return guardianGroups;
}

/**
 * Groups competitors into guardian families (guardian + their dependents)
 * Returns an array where each element is either a single competitor or a guardian family
 */
export function createGuardianFamilies(competitors: Competitor[]): Competitor[][] {
    const families: Competitor[][] = [];
    const processed = new Set<string>();

    // Create a map of guardians to their dependents
    const guardianToDependents = new Map<string, Competitor[]>();
    const dependentToGuardian = new Map<string, string>();

    for (const competitor of competitors) {
        if (competitor.guardianId) {
            if (!guardianToDependents.has(competitor.guardianId)) {
                guardianToDependents.set(competitor.guardianId, []);
            }
            guardianToDependents.get(competitor.guardianId)!.push(competitor);
            dependentToGuardian.set(competitor.id, competitor.guardianId);
        }
    }

    for (const competitor of competitors) {
        if (processed.has(competitor.id)) {
            continue;
        }

        // If this competitor is a guardian, create a family
        if (guardianToDependents.has(competitor.id)) {
            const family = [competitor, ...guardianToDependents.get(competitor.id)!];
            families.push(family);

            // Mark all family members as processed
            for (const member of family) {
                processed.add(member.id);
            }
        }
        // If this competitor is a dependent, skip (already processed with guardian)
        else if (dependentToGuardian.has(competitor.id)) {
            // Will be processed when we encounter their guardian
            continue;
        }
        // If this competitor has no guardian relationship, they're a single unit
        else {
            families.push([competitor]);
            processed.add(competitor.id);
        }
    }

    return families;
}

/**
 * Validates that guardian constraints are satisfied in the partition
 */
export function validateGuardianConstraints(
    competitors: Competitor[],
    subsets: Competitor[][]
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Create a map of competitor ID to subset index
    const competitorToSubset = new Map<string, number>();
    for (let subsetIndex = 0; subsetIndex < subsets.length; subsetIndex++) {
        for (const competitor of subsets[subsetIndex]) {
            competitorToSubset.set(competitor.id, subsetIndex);
        }
    }

    // Check each competitor with a guardian
    for (const competitor of competitors) {
        if (competitor.guardianId) {
            const competitorSubset = competitorToSubset.get(competitor.id);
            const guardianSubset = competitorToSubset.get(competitor.guardianId);

            if (competitorSubset === undefined) {
                errors.push(`Competitor ${competitor.id} not assigned to any subset`);
                continue;
            }

            if (guardianSubset === undefined) {
                errors.push(`Guardian ${competitor.guardianId} for competitor ${competitor.id} not found in any subset`);
                continue;
            }

            if (competitorSubset !== guardianSubset) {
                errors.push(`Competitor ${competitor.id} and their guardian ${competitor.guardianId} are in different subsets (${competitorSubset} vs ${guardianSubset})`);
            }
        }
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Shuffles an array using Fisher-Yates algorithm
 */
export function shuffle<T>(array: T[]): T[] {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

/**
 * Validates a competitor object
 */
export function isValidCompetitor(competitor: any): competitor is Competitor {
    if (!competitor || typeof competitor !== 'object') {
        return false;
    }

    // Check required fields
    if (typeof competitor.id !== 'string' || competitor.id.trim().length === 0) {
        return false;
    }

    if (!isValidEquipmentClass(competitor.equipmentClass)) {
        return false;
    }

    if (!isValidAgeGroup(competitor.ageCategory)) {
        return false;
    }

    if (!isValidGender(competitor.gender)) {
        return false;
    }

    // Check optional guardian ID
    if (competitor.guardianId !== undefined &&
        (typeof competitor.guardianId !== 'string' || competitor.guardianId.trim().length === 0)) {
        return false;
    }

    return true;
}

/**
 * Validates an array of competitors
 */
export function validateCompetitors(competitors: any[]): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!Array.isArray(competitors)) {
        errors.push('Competitors must be an array');
        return { valid: false, errors };
    }

    if (competitors.length === 0) {
        errors.push('At least one competitor is required');
        return { valid: false, errors };
    }

    if (competitors.length > 168) {
        errors.push('Maximum 168 competitors allowed');
    }

    // Check each competitor
    const competitorIds = new Set<string>();
    competitors.forEach((competitor, index) => {
        if (!isValidCompetitor(competitor)) {
            errors.push(`Competitor at index ${index} is invalid`);
            return;
        }

        // Check for duplicate IDs
        if (competitorIds.has(competitor.id)) {
            errors.push(`Duplicate competitor ID: ${competitor.id}`);
        } else {
            competitorIds.add(competitor.id);
        }
    });

    // Check guardian references exist
    competitors.forEach(competitor => {
        if (competitor.guardianId && !competitors.some(c => c.id === competitor.guardianId)) {
            errors.push(`Guardian ${competitor.guardianId} for competitor ${competitor.id} not found`);
        }
    });

    // Check for circular guardian references
    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const hasCircularReference = (competitorId: string): boolean => {
        if (recursionStack.has(competitorId)) {
            return true; // Circular reference found
        }
        if (visited.has(competitorId)) {
            return false; // Already processed
        }

        visited.add(competitorId);
        recursionStack.add(competitorId);

        const competitor = competitors.find(c => c.id === competitorId);
        if (competitor?.guardianId) {
            if (hasCircularReference(competitor.guardianId)) {
                return true;
            }
        }

        recursionStack.delete(competitorId);
        return false;
    };

    for (const competitor of competitors) {
        if (hasCircularReference(competitor.id)) {
            errors.push(`Circular guardian reference detected involving competitor ${competitor.id}`);
            break;
        }
    }

    // Check family size constraints (max 3 members: 1 guardian + 2 dependents)
    const guardianFamilySizes = new Map<string, number>();

    // Count family sizes
    competitors.forEach(competitor => {
        if (competitor.guardianId) {
            // This is a dependent - increment the guardian's family size
            guardianFamilySizes.set(competitor.guardianId, (guardianFamilySizes.get(competitor.guardianId) || 1) + 1);
        } else {
            // This could be a guardian - ensure they're counted
            if (!guardianFamilySizes.has(competitor.id)) {
                guardianFamilySizes.set(competitor.id, 1);
            }
        }
    });

    // Check if any family exceeds the limit
    guardianFamilySizes.forEach((familySize, guardianId) => {
        if (familySize > 3) {
            errors.push(`Family with guardian ${guardianId} has ${familySize} members, maximum allowed is 3 (1 guardian + 2 dependents)`);
        }
    });

    return { valid: errors.length === 0, errors };
}
