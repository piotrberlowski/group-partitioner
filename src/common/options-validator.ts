/**
 * Common options validation and sanitization functionality
 * Used across all algorithm implementations
 */

import type { PartitionOptions } from '../types';
import { MINIMUM_SUBSET_SIZE } from '../subsetSize';
import { DEFAULT_OPTIONS, type ResolvedPartitionOptions } from '../utils';

export interface ValidatedPartitionOptions extends ResolvedPartitionOptions {
    // All properties are required and validated
}

/**
 * Validates and sanitizes partition options with common logic
 * @param options - Partial options to validate
 * @param competitorCount - Number of competitors (used for special constraints)
 * @returns Validated and sanitized options
 */
export function validateAndSanitizeOptions(
    options: Partial<PartitionOptions>,
    competitorCount: number
): ValidatedPartitionOptions {
    const explicitMax = options.maxSubsetSize !== undefined && options.maxSubsetSize >= MINIMUM_SUBSET_SIZE;
    const sanitizedOptions = { ...DEFAULT_OPTIONS, ...options };
    swapInvertedSizes(sanitizedOptions);
    applySizeFloors(sanitizedOptions);
    applyDefaultFieldCap(sanitizedOptions, explicitMax, competitorCount);
    clampPreferredSize(sanitizedOptions);
    if (sanitizedOptions.closedGroupWeight < 0) {
        sanitizedOptions.closedGroupWeight = 0;
    }

    return sanitizedOptions;
}

function swapInvertedSizes(options: ResolvedPartitionOptions): void {
    if (options.minSubsetSize <= options.maxSubsetSize) {
        return;
    }
    const previousMin = options.minSubsetSize;
    options.minSubsetSize = options.maxSubsetSize;
    options.maxSubsetSize = previousMin;
}

function applySizeFloors(options: ResolvedPartitionOptions): void {
    if (options.minSubsetSize < MINIMUM_SUBSET_SIZE) {
        options.minSubsetSize = MINIMUM_SUBSET_SIZE;
    }
    if (options.maxSubsetSize < options.minSubsetSize) {
        options.maxSubsetSize = options.minSubsetSize;
    }
}

function applyDefaultFieldCap(
    options: ResolvedPartitionOptions,
    explicitMax: boolean,
    competitorCount: number
): void {
    const useFieldCap = !explicitMax && competitorCount > 0 && competitorCount <= 112;
    if (!useFieldCap) {
        return;
    }
    options.maxSubsetSize = Math.min(options.maxSubsetSize, 4);
    if (options.maxSubsetSize < options.minSubsetSize) {
        options.maxSubsetSize = options.minSubsetSize;
    }
}

function clampPreferredSize(options: ResolvedPartitionOptions): void {
    if (options.preferredSubsetSize < options.minSubsetSize) {
        options.preferredSubsetSize = options.minSubsetSize;
    }
    if (options.preferredSubsetSize > options.maxSubsetSize) {
        options.preferredSubsetSize = options.maxSubsetSize;
    }
}

/**
 * Calculates the optimal number of subsets based on options and competitor count
 */
export function calculateOptimalSubsetCount(
    competitorCount: number,
    options: ValidatedPartitionOptions
): {
    minSubsets: number;
    maxSubsets: number;
    preferredSubsets: number;
    recommendedSubsets: number;
} {
    const minSubsets = Math.ceil(competitorCount / options.maxSubsetSize);
    const maxSubsets = Math.min(options.maxSubsets, Math.floor(competitorCount / options.minSubsetSize));
    const preferredSubsets = Math.round(competitorCount / options.preferredSubsetSize);

    // Recommend a subset count that balances constraints
    const recommendedSubsets = Math.max(
        minSubsets,
        Math.min(maxSubsets, preferredSubsets)
    );

    return {
        minSubsets,
        maxSubsets,
        preferredSubsets,
        recommendedSubsets
    };
}
