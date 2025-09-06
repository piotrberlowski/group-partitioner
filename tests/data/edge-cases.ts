/**
 * Edge case test datasets for comprehensive testing
 */

import type { Competitor } from '../../src/types';

// Minimum valid dataset (2 competitors)
export const minimumDataset: Competitor[] = [
    { id: '001', equipmentClass: 'HB', ageCategory: 'A', gender: 'M' },
    { id: '002', equipmentClass: 'HB', ageCategory: 'A', gender: 'F' },
];

// All same category (tests homogeneity scoring)
export const homogeneousDataset: Competitor[] = [
    { id: '001', equipmentClass: 'HB', ageCategory: 'A', gender: 'M' },
    { id: '002', equipmentClass: 'HB', ageCategory: 'A', gender: 'F' },
    { id: '003', equipmentClass: 'HB', ageCategory: 'A', gender: 'M' },
    { id: '004', equipmentClass: 'HB', ageCategory: 'A', gender: 'F' },
    { id: '005', equipmentClass: 'HB', ageCategory: 'A', gender: 'M' },
    { id: '006', equipmentClass: 'HB', ageCategory: 'A', gender: 'F' },
];

// Maximum diversity (all different categories)
export const diverseDataset: Competitor[] = [
    { id: '001', equipmentClass: 'HB', ageCategory: 'C', gender: 'M' },
    { id: '002', equipmentClass: 'LB', ageCategory: 'J', gender: 'F' },
    { id: '003', equipmentClass: 'TR', ageCategory: 'YA', gender: 'M' },
    { id: '004', equipmentClass: 'BHR', ageCategory: 'A', gender: 'F' },
    { id: '005', equipmentClass: 'BBR', ageCategory: 'V', gender: 'M' },
    { id: '006', equipmentClass: 'FSR', ageCategory: 'S', gender: 'F' },
    { id: '007', equipmentClass: 'BBC', ageCategory: 'C', gender: 'M' },
    { id: '008', equipmentClass: 'BL', ageCategory: 'J', gender: 'F' },
];

// Large guardian family (guardian with maximum dependents - max 3 total)
export const largeGuardianFamily: Competitor[] = [
    { id: '001', equipmentClass: 'LB', ageCategory: 'A', gender: 'F' }, // Guardian
    { id: '002', equipmentClass: 'BBR', ageCategory: 'C', gender: 'F', guardianId: '001' },
    { id: '003', equipmentClass: 'BBR', ageCategory: 'J', gender: 'M', guardianId: '001' },
    // Additional individuals to make valid subsets
    { id: '004', equipmentClass: 'HB', ageCategory: 'A', gender: 'M' },
    { id: '005', equipmentClass: 'TR', ageCategory: 'V', gender: 'F' },
    { id: '006', equipmentClass: 'FSC', ageCategory: 'YA', gender: 'M' },
];

// Multiple guardian chains (but not circular)
export const multipleGuardianChains: Competitor[] = [
    // Chain 1: Guardian -> Child
    { id: '001', equipmentClass: 'HB', ageCategory: 'A', gender: 'M' }, // Guardian 1
    { id: '002', equipmentClass: 'HB', ageCategory: 'C', gender: 'M', guardianId: '001' },

    // Chain 2: Guardian -> Child -> Grandchild (if we allowed nested guardians, but we don't)
    { id: '003', equipmentClass: 'LB', ageCategory: 'V', gender: 'F' }, // Guardian 2
    { id: '004', equipmentClass: 'LB', ageCategory: 'A', gender: 'F', guardianId: '003' },

    // Chain 3: Guardian -> Multiple children (max 2 children)
    { id: '005', equipmentClass: 'TR', ageCategory: 'A', gender: 'M' }, // Guardian 3
    { id: '006', equipmentClass: 'TR', ageCategory: 'J', gender: 'M', guardianId: '005' },
    { id: '007', equipmentClass: 'TR', ageCategory: 'J', gender: 'F', guardianId: '005' },

    // Individual competitor (was previously part of family)
    { id: '008', equipmentClass: 'TR', ageCategory: 'C', gender: 'M' },
];

// Uneven gender distribution
export const unevenGenderDataset: Competitor[] = [
    { id: '001', equipmentClass: 'HB', ageCategory: 'A', gender: 'M' },
    { id: '002', equipmentClass: 'HB', ageCategory: 'A', gender: 'M' },
    { id: '003', equipmentClass: 'HB', ageCategory: 'A', gender: 'M' },
    { id: '004', equipmentClass: 'HB', ageCategory: 'A', gender: 'M' },
    { id: '005', equipmentClass: 'HB', ageCategory: 'A', gender: 'M' },
    { id: '006', equipmentClass: 'HB', ageCategory: 'A', gender: 'F' }, // Only one female
    { id: '007', equipmentClass: 'LB', ageCategory: 'J', gender: 'M' },
    { id: '008', equipmentClass: 'LB', ageCategory: 'J', gender: 'M' },
];

// Force maximum subsets scenario
export const forceMaxSubsetsDataset: Competitor[] = [];

// Generate 56 competitors (28 subsets * 2 min size = 56)
for (let i = 1; i <= 56; i++) {
    const id = i.toString().padStart(3, '0');
    const equipmentClass = i % 2 === 1 ? 'HB' : 'LB'; // Alternate equipment
    const ageCategory = i <= 28 ? 'A' : 'V'; // Half Adults, half Veterans
    const gender = i % 2 === 1 ? 'M' : 'F'; // Alternate gender

    forceMaxSubsetsDataset.push({
        id,
        equipmentClass: equipmentClass as any,
        ageCategory: ageCategory as any,
        gender: gender as any
    });
}

export const edgeCaseExpectedConstraints = {
    minimum: {
        totalCompetitors: 2,
        minSubsets: 1,
        maxSubsets: 1
    },
    homogeneous: {
        totalCompetitors: 6,
        minSubsets: 1,
        maxSubsets: 3,
        preferredSubsets: 2 // 6/4 = 1.5, rounded to 2
    },
    diverse: {
        totalCompetitors: 8,
        minSubsets: 2,
        maxSubsets: 4,
        preferredSubsets: 2
    },
    largeFamily: {
        totalCompetitors: 6,
        guardianFamilies: 4, // 1 family of 3 + 3 individuals
        familySize: 3 // Largest family
    },
    forceMaxSubsets: {
        totalCompetitors: 56,
        minSubsets: 28, // Exactly at the limit
        maxSubsets: 28
    }
};
