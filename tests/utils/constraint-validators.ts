/**
 * Comprehensive constraint validation utilities for testing
 */

import type { Competitor, PartitionResult, PartitionOptions } from '../../src/types';
import { validatePartition, validateGuardianConstraints, createGuardianFamilies } from '../../src/utils';
import { DEFAULT_OPTIONS } from '../../src/utils';

export interface ConstraintValidationResult {
    valid: boolean;
    errors: string[];
    warnings: string[];
    details: {
        basicConstraints: boolean;
        guardianConstraints: boolean;
        sizeConstraints: boolean;
        subsetCountConstraints: boolean;
        assignmentConstraints: boolean;
    };
}

/**
 * Comprehensive constraint validation for test results
 */
export function validateAllConstraints(
    competitors: Competitor[],
    result: PartitionResult,
    options: Partial<PartitionOptions> = {}
): ConstraintValidationResult {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const errors: string[] = [];
    const warnings: string[] = [];

    let basicConstraints = true;
    let guardianConstraints = true;
    let sizeConstraints = true;
    let subsetCountConstraints = true;
    let assignmentConstraints = true;

    // 1. Basic partition validation
    const basicValidation = validatePartition(competitors, result.subsets, opts);
    if (!basicValidation.valid) {
        basicConstraints = false;
        errors.push(...basicValidation.errors.map(e => `Basic: ${e}`));
    }

    // 2. Guardian constraint validation
    const guardianValidation = validateGuardianConstraints(competitors, result.subsets);
    if (!guardianValidation.valid) {
        guardianConstraints = false;
        errors.push(...guardianValidation.errors.map(e => `Guardian: ${e}`));
    }

    // 3. Detailed size constraint validation
    for (let i = 0; i < result.subsets.length; i++) {
        const subset = result.subsets[i];
        if (subset.length < opts.minSubsetSize) {
            sizeConstraints = false;
            errors.push(`Size: Subset ${i + 1} too small (${subset.length} < ${opts.minSubsetSize})`);
        }
        if (subset.length > opts.maxSubsetSize) {
            sizeConstraints = false;
            errors.push(`Size: Subset ${i + 1} too large (${subset.length} > ${opts.maxSubsetSize})`);
        }
    }

    // 4. Subset count constraints
    if (result.subsets.length > opts.maxSubsets) {
        subsetCountConstraints = false;
        errors.push(`Count: Too many subsets (${result.subsets.length} > ${opts.maxSubsets})`);
    }

    const minPossibleSubsets = Math.ceil(competitors.length / opts.maxSubsetSize);
    if (result.subsets.length < minPossibleSubsets) {
        subsetCountConstraints = false;
        errors.push(`Count: Too few subsets (${result.subsets.length} < ${minPossibleSubsets})`);
    }

    // 5. Assignment constraint validation
    const assignedCompetitors = new Set<string>();
    const duplicateAssignments: string[] = [];

    for (const subset of result.subsets) {
        for (const competitor of subset) {
            if (assignedCompetitors.has(competitor.id)) {
                assignmentConstraints = false;
                duplicateAssignments.push(competitor.id);
            } else {
                assignedCompetitors.add(competitor.id);
            }
        }
    }

    if (duplicateAssignments.length > 0) {
        errors.push(`Assignment: Competitors assigned multiple times: ${duplicateAssignments.join(', ')}`);
    }

    if (assignedCompetitors.size !== competitors.length) {
        assignmentConstraints = false;
        errors.push(`Assignment: Not all competitors assigned (${assignedCompetitors.size}/${competitors.length})`);
    }

    // 6. Generate warnings for suboptimal solutions
    if (result.subsets.length > Math.ceil(competitors.length / opts.preferredSubsetSize)) {
        warnings.push(`More subsets than preferred (${result.subsets.length} vs ~${Math.ceil(competitors.length / opts.preferredSubsetSize)})`);
    }

    const averageSubsetSize = competitors.length / result.subsets.length;
    if (Math.abs(averageSubsetSize - opts.preferredSubsetSize) > 1) {
        warnings.push(`Average subset size deviates from preferred (${averageSubsetSize.toFixed(1)} vs ${opts.preferredSubsetSize})`);
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        details: {
            basicConstraints,
            guardianConstraints,
            sizeConstraints,
            subsetCountConstraints,
            assignmentConstraints,
        },
    };
}

/**
 * Validates that guardian families stay together
 */
export function validateGuardianFamilyIntegrity(
    competitors: Competitor[],
    subsets: Competitor[][]
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const families = createGuardianFamilies(competitors);

    // Create competitor to subset mapping
    const competitorToSubset = new Map<string, number>();
    for (let i = 0; i < subsets.length; i++) {
        for (const competitor of subsets[i]) {
            competitorToSubset.set(competitor.id, i);
        }
    }

    // Check each family is in the same subset
    for (let familyIndex = 0; familyIndex < families.length; familyIndex++) {
        const family = families[familyIndex];
        if (family.length <= 1) continue; // Skip individual competitors

        const familySubsets = new Set<number>();
        for (const member of family) {
            const subsetIndex = competitorToSubset.get(member.id);
            if (subsetIndex !== undefined) {
                familySubsets.add(subsetIndex);
            }
        }

        if (familySubsets.size > 1) {
            const memberIds = family.map(m => m.id).join(', ');
            const subsetList = Array.from(familySubsets).join(', ');
            errors.push(`Family [${memberIds}] split across subsets [${subsetList}]`);
        }
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Calculates optimization metrics for test validation
 */
export function calculateOptimizationMetrics(
    subsets: Competitor[][],
    options: Partial<PartitionOptions> = {}
): {
    genderBalance: number;
    ageHomogeneity: number;
    equipmentHomogeneity: number;
    sizeOptimality: number;
} {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let genderBalance = 0;
    let ageHomogeneity = 0;
    let equipmentHomogeneity = 0;
    let sizeOptimality = 0;

    for (const subset of subsets) {
        if (subset.length === 0) continue;

        // Gender balance (higher score for even gender distribution)
        const genderCounts = new Map<string, number>();
        for (const competitor of subset) {
            genderCounts.set(competitor.gender, (genderCounts.get(competitor.gender) || 0) + 1);
        }

        let evenGenderCount = 0;
        for (const count of genderCounts.values()) {
            if (count % 2 === 0) evenGenderCount += count;
        }
        genderBalance += evenGenderCount / subset.length;

        // Age homogeneity (higher score for same age categories)
        const ageCounts = new Map<string, number>();
        for (const competitor of subset) {
            ageCounts.set(competitor.ageCategory, (ageCounts.get(competitor.ageCategory) || 0) + 1);
        }
        const maxAgeCount = Math.max(...ageCounts.values());
        ageHomogeneity += maxAgeCount / subset.length;

        // Equipment homogeneity (depends on groupByEquipmentClass option)
        const equipmentCounts = new Map<string, number>();
        for (const competitor of subset) {
            equipmentCounts.set(competitor.equipmentClass, (equipmentCounts.get(competitor.equipmentClass) || 0) + 1);
        }

        if (opts.groupByEquipmentClass) {
            const maxEquipmentCount = Math.max(...equipmentCounts.values());
            equipmentHomogeneity += maxEquipmentCount / subset.length;
        } else {
            const uniqueEquipmentCount = equipmentCounts.size;
            equipmentHomogeneity += Math.min(uniqueEquipmentCount / subset.length, 1);
        }

        // Size optimality (prefer sizes close to preferred size)
        const sizeDeviation = Math.abs(subset.length - opts.preferredSubsetSize);
        sizeOptimality += Math.max(0, 1 - sizeDeviation / opts.preferredSubsetSize);
    }

    const numSubsets = subsets.length;
    return {
        genderBalance: numSubsets > 0 ? genderBalance / numSubsets : 0,
        ageHomogeneity: numSubsets > 0 ? ageHomogeneity / numSubsets : 0,
        equipmentHomogeneity: numSubsets > 0 ? equipmentHomogeneity / numSubsets : 0,
        sizeOptimality: numSubsets > 0 ? sizeOptimality / numSubsets : 0,
    };
}

/**
 * Test helper to assert all constraints are met
 */
export function expectAllConstraintsMet(
    competitors: Competitor[],
    result: PartitionResult,
    options: Partial<PartitionOptions> = {}
): void {
    const validation = validateAllConstraints(competitors, result, options);

    if (!validation.valid) {
        const errorMessage = [
            'Constraint validation failed:',
            ...validation.errors.map(e => `  - ${e}`),
            '',
            'Constraint details:',
            `  Basic constraints: ${validation.details.basicConstraints}`,
            `  Guardian constraints: ${validation.details.guardianConstraints}`,
            `  Size constraints: ${validation.details.sizeConstraints}`,
            `  Subset count constraints: ${validation.details.subsetCountConstraints}`,
            `  Assignment constraints: ${validation.details.assignmentConstraints}`,
        ].join('\n');

        throw new Error(errorMessage);
    }

    // Also validate guardian family integrity
    const familyValidation = validateGuardianFamilyIntegrity(competitors, result.subsets);
    if (!familyValidation.valid) {
        throw new Error(`Guardian family integrity failed:\n${familyValidation.errors.map(e => `  - ${e}`).join('\n')}`);
    }
}
