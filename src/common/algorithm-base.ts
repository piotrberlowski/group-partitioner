/**
 * Common algorithm functionality and base patterns
 */

import type { Competitor, PartitionOptions, AlgorithmResult } from '../types';
import { createPartitionResult } from '../utils';
import { validateAndSanitizeOptions, ValidatedPartitionOptions } from './options-validator';

/**
 * Common empty dataset handling for all algorithms
 */
export function handleEmptyDataset(
    options: Partial<PartitionOptions>,
    algorithmName: string
): AlgorithmResult {
    const validatedOptions = validateAndSanitizeOptions(options, 0);

    return {
        result: createPartitionResult([], validatedOptions),
        executionTime: 0,
        algorithmUsed: algorithmName,
    };
}

/**
 * Common algorithm result wrapper that handles timing and validation
 */
export function createAlgorithmResult(
    competitors: Competitor[],
    subsets: Competitor[][],
    options: ValidatedPartitionOptions,
    algorithmName: string,
    startTime: number
): AlgorithmResult {
    const executionTime = performance.now() - startTime;

    return {
        result: createPartitionResult(subsets, options),
        executionTime,
        algorithmUsed: algorithmName,
    };
}

/**
 * Common solution validation logic
 */
export function validateAlgorithmSolution(
    competitors: Competitor[],
    subsets: Competitor[][],
    options: ValidatedPartitionOptions
): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check all competitors are assigned exactly once
    const assignedIds = new Set<string>();
    for (const subset of subsets) {
        for (const competitor of subset) {
            if (assignedIds.has(competitor.id)) {
                errors.push(`Competitor ${competitor.id} assigned to multiple subsets`);
            }
            assignedIds.add(competitor.id);
        }
    }

    // Check all competitors are assigned
    if (assignedIds.size !== competitors.length) {
        errors.push(`Not all competitors assigned: ${assignedIds.size}/${competitors.length}`);
    }

    // Check subset size constraints
    for (let i = 0; i < subsets.length; i++) {
        const size = subsets[i].length;
        if (size < options.minSubsetSize) {
            errors.push(`Subset ${i} too small: ${size} < ${options.minSubsetSize}`);
        }
        if (size > options.maxSubsetSize) {
            errors.push(`Subset ${i} too large: ${size} > ${options.maxSubsetSize}`);
        }
    }

    // Check maximum number of subsets
    if (subsets.length > options.maxSubsets) {
        errors.push(`Too many subsets: ${subsets.length} > ${options.maxSubsets}`);
    }

    // Check guardian constraints
    for (const subset of subsets) {
        const subsetIds = new Set(subset.map(c => c.id));
        for (const competitor of subset) {
            if (competitor.guardianId && !subsetIds.has(competitor.guardianId)) {
                errors.push(`Competitor ${competitor.id} and their guardian ${competitor.guardianId} are in different subsets`);
            }
        }
    }

    return { valid: errors.length === 0, errors };
}

/**
 * Common interface for algorithm implementations
 */
export interface AlgorithmImplementation {
    name: string;
    solve(competitors: Competitor[], options: Partial<PartitionOptions>): AlgorithmResult | Promise<AlgorithmResult>;
}

/**
 * Abstract base class for algorithm implementations with common functionality
 */
export abstract class BaseAlgorithm implements AlgorithmImplementation {
    abstract name: string;

    protected handleEmptyInput(options: Partial<PartitionOptions>): AlgorithmResult {
        return handleEmptyDataset(options, this.name);
    }

    protected validateAndSanitizeOptions(options: Partial<PartitionOptions>, competitorCount: number): ValidatedPartitionOptions {
        return validateAndSanitizeOptions(options, competitorCount);
    }

    protected createResult(
        competitors: Competitor[],
        subsets: Competitor[][],
        options: ValidatedPartitionOptions,
        startTime: number
    ): AlgorithmResult {
        return createAlgorithmResult(competitors, subsets, options, this.name, startTime);
    }

    protected validateSolution(
        competitors: Competitor[],
        subsets: Competitor[][],
        options: ValidatedPartitionOptions
    ): { valid: boolean; errors: string[] } {
        return validateAlgorithmSolution(competitors, subsets, options);
    }

    abstract solve(competitors: Competitor[], options: Partial<PartitionOptions>): AlgorithmResult | Promise<AlgorithmResult>;
}
