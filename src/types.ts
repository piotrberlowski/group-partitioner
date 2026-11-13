/**
 * Core types for competitor partitioning algorithms
 */

/** Built-in IFAA catalogue. Callers can supply any other labels through SolutionSpace. */
export type EquipmentClass = 'HB' | 'LB' | 'TR' | 'BHR' | 'BBR' | 'FSR' | 'BBC' | 'BL' | 'BU' | 'FSC' | 'FU';
export type AgeGroup = 'C' | 'J' | 'YA' | 'A' | 'V' | 'S';
export type Gender = 'F' | 'M';

export type Algorithm = 'mip' | 'mip-lp' | 'clustering' | 'auto';

/**
 * Labels the solver is allowed to see. When omitted, the built-in IFAA lists are used.
 * Pass the host application's own age, gender, and bowstyle ids here.
 */
export interface SolutionSpace {
    equipmentClasses: readonly string[];
    ageCategories: readonly string[];
    genders: readonly string[];
}

export interface Competitor {
    id: string;
    equipmentClass: string;
    ageCategory: string;
    gender: string;
    guardianId?: string; // Reference to another competitor who is the guardian
}

export interface PartitionOptions {
    /** Algorithm to use for partitioning (default: 'auto') */
    algorithm?: Algorithm;
    /** Prefer grouping competitors of same equipment class together vs distributing evenly */
    groupByEquipmentClass: boolean;
    /** Maximum number of subsets allowed (default: 28) */
    maxSubsets?: number;
    /** Minimum subset size. Values below 3 are raised to 3. Size 1 and 2 are never a target. */
    minSubsetSize?: number;
    /** Maximum subset size (default: 6) */
    maxSubsetSize?: number;
    /** Preferred subset size (default: 4) */
    preferredSubsetSize?: number;
    /** Weight for same gender preference (default: 1.0) */
    genderWeight?: number;
    /** Weight for same age category preference (default: 1.0) */
    ageCategoryWeight?: number;
    /** Weight for equipment class grouping preference (default: 1.0) */
    equipmentClassWeight?: number;
    /**
     * Extra weight for subsets whose size equals preferredSubsetSize.
     * Zero keeps the historical size score. Raise it when full groups should outrank mix.
     */
    closedGroupWeight?: number;
    /** When set, competitor labels are checked against these lists instead of the IFAA defaults. */
    solutionSpace?: SolutionSpace;
}

export interface PartitionResult {
    subsets: Competitor[][];
    score: number;
    metadata: {
        totalCompetitors: number;
        totalSubsets: number;
        averageSubsetSize: number;
        scoreBreakdown: {
            sizeScore: number;
            closedGroupScore: number;
            genderScore: number;
            ageCategoryScore: number;
            equipmentClassScore: number;
        };
    };
}

export interface AlgorithmResult {
    result: PartitionResult;
    executionTime: number;
    algorithmUsed: string;
}
