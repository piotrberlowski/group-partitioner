/**
 * Common options validation and sanitization functionality
 * Used across all algorithm implementations
 */

import type { PartitionOptions } from '../types';
import { DEFAULT_OPTIONS } from '../utils';

export interface ValidatedPartitionOptions extends Required<PartitionOptions> {
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
    // Merge with defaults first
    let sanitizedOptions = { ...DEFAULT_OPTIONS, ...options };

    // Fix invalid size constraints by swapping if necessary
    if (sanitizedOptions.minSubsetSize > sanitizedOptions.maxSubsetSize) {
        const temp = sanitizedOptions.minSubsetSize;
        sanitizedOptions.minSubsetSize = sanitizedOptions.maxSubsetSize;
        sanitizedOptions.maxSubsetSize = temp;
    }

    // Ensure minimum size is at least 2
    if (sanitizedOptions.minSubsetSize < 2) {
        sanitizedOptions.minSubsetSize = 2;
    }

    // Ensure maximum size is at least equal to minimum
    if (sanitizedOptions.maxSubsetSize < sanitizedOptions.minSubsetSize) {
        sanitizedOptions.maxSubsetSize = sanitizedOptions.minSubsetSize;
    }

    // Ensure preferred size is within bounds
    if (sanitizedOptions.preferredSubsetSize < sanitizedOptions.minSubsetSize) {
        sanitizedOptions.preferredSubsetSize = sanitizedOptions.minSubsetSize;
    }
    if (sanitizedOptions.preferredSubsetSize > sanitizedOptions.maxSubsetSize) {
        sanitizedOptions.preferredSubsetSize = sanitizedOptions.maxSubsetSize;
    }

    // Special constraint: if ≤112 competitors, max subset size is 4
    if (competitorCount <= 112) {
        sanitizedOptions.maxSubsetSize = Math.min(sanitizedOptions.maxSubsetSize, 4);
    }

    return sanitizedOptions;
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
