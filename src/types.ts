/**
 * Core types for competitor partitioning algorithms
 */

export type EquipmentClass = 'HB' | 'LB' | 'TR' | 'BHR' | 'BBR' | 'FSR' | 'BBC' | 'BL' | 'BU' | 'FSC' | 'FU';
export type AgeGroup = 'C' | 'J' | 'YA' | 'A' | 'V' | 'S';
export type Gender = 'F' | 'M';

export type Algorithm = 'mip' | 'mip-lp' | 'clustering' | 'auto';

export interface Competitor {
    id: string;
    equipmentClass: EquipmentClass;
    ageCategory: AgeGroup;
    gender: Gender;
    guardianId?: string; // Reference to another competitor who is the guardian
}

export interface PartitionOptions {
    /** Algorithm to use for partitioning (default: 'auto') */
    algorithm?: Algorithm;
    /** Prefer grouping competitors of same equipment class together vs distributing evenly */
    groupByEquipmentClass: boolean;
    /** Maximum number of subsets allowed (default: 28) */
    maxSubsets?: number;
    /** Minimum subset size (default: 2) */
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
