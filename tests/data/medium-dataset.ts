/**
 * Medium test dataset with 24 competitors
 * Includes multiple guardian families and diverse equipment/age distributions
 */

import type { Competitor } from '../../src/types';

export const mediumDataset: Competitor[] = [
    // Heavy Bow group
    { id: '001', equipmentClass: 'HB', ageCategory: 'J', gender: 'M' },
    { id: '002', equipmentClass: 'HB', ageCategory: 'J', gender: 'F' },
    { id: '003', equipmentClass: 'HB', ageCategory: 'YA', gender: 'M' },
    { id: '004', equipmentClass: 'HB', ageCategory: 'YA', gender: 'F' },

    // Light Bow group with guardian family
    { id: '005', equipmentClass: 'LB', ageCategory: 'A', gender: 'M' }, // Guardian
    { id: '006', equipmentClass: 'LB', ageCategory: 'A', gender: 'F' },
    { id: '007', equipmentClass: 'LB', ageCategory: 'C', gender: 'M', guardianId: '005' }, // Child
    { id: '008', equipmentClass: 'LB', ageCategory: 'C', gender: 'F', guardianId: '005' }, // Child

    // Traditional Recurve group
    { id: '009', equipmentClass: 'TR', ageCategory: 'V', gender: 'M' },
    { id: '010', equipmentClass: 'TR', ageCategory: 'V', gender: 'F' },
    { id: '011', equipmentClass: 'TR', ageCategory: 'S', gender: 'M' },
    { id: '012', equipmentClass: 'TR', ageCategory: 'S', gender: 'F' },

    // Barebow groups with guardian families
    { id: '013', equipmentClass: 'BHR', ageCategory: 'A', gender: 'F' }, // Guardian
    { id: '014', equipmentClass: 'BBR', ageCategory: 'C', gender: 'F', guardianId: '013' }, // Child
    { id: '015', equipmentClass: 'BBR', ageCategory: 'J', gender: 'M' },
    { id: '016', equipmentClass: 'BBR', ageCategory: 'J', gender: 'F' },

    // Freestyle groups
    { id: '017', equipmentClass: 'FSR', ageCategory: 'YA', gender: 'M' },
    { id: '018', equipmentClass: 'FSR', ageCategory: 'YA', gender: 'F' },
    { id: '019', equipmentClass: 'FSC', ageCategory: 'A', gender: 'M' }, // Guardian
    { id: '020', equipmentClass: 'FSC', ageCategory: 'C', gender: 'M', guardianId: '019' }, // Child

    // Mixed equipment classes
    { id: '021', equipmentClass: 'BBC', ageCategory: 'V', gender: 'M' },
    { id: '022', equipmentClass: 'BL', ageCategory: 'S', gender: 'F' },
    { id: '023', equipmentClass: 'BU', ageCategory: 'A', gender: 'F' },
    { id: '024', equipmentClass: 'FU', ageCategory: 'YA', gender: 'M' },
];

export const mediumDatasetExpectedConstraints = {
    totalCompetitors: 24,
    guardianFamilies: 21, // 3 guardian families (2+2+1 members) + 18 individuals
    minSubsets: 4, // 24 competitors / 6 max = 4
    maxSubsets: 12, // 24 competitors / 2 min = 12
    preferredSubsets: 6, // 24 competitors / 4 preferred = 6
    guardianPairs: [
        { guardian: '005', dependents: ['007', '008'] },
        { guardian: '013', dependents: ['014'] },
        { guardian: '019', dependents: ['020'] }
    ]
};
