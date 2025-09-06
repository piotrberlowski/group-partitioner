/**
 * Small test dataset with 8 competitors
 * Includes guardian relationships and diverse categories
 */

import type { Competitor } from '../../src/types';

export const smallDataset: Competitor[] = [
    // Individual competitors
    { id: '001', equipmentClass: 'HB', ageCategory: 'J', gender: 'M' },
    { id: '002', equipmentClass: 'HB', ageCategory: 'J', gender: 'F' },

    // Guardian family 1: Adult guardian with child
    { id: '003', equipmentClass: 'LB', ageCategory: 'A', gender: 'M' }, // Guardian
    { id: '004', equipmentClass: 'BBR', ageCategory: 'C', gender: 'M', guardianId: '003' }, // Child

    // Guardian family 2: Veteran guardian with two children
    { id: '005', equipmentClass: 'FSC', ageCategory: 'V', gender: 'F' }, // Guardian
    { id: '006', equipmentClass: 'BL', ageCategory: 'C', gender: 'F', guardianId: '005' }, // Child 1
    { id: '007', equipmentClass: 'BU', ageCategory: 'C', gender: 'M', guardianId: '005' }, // Child 2

    // Individual senior
    { id: '008', equipmentClass: 'TR', ageCategory: 'S', gender: 'F' },
];

export const smallDatasetExpectedConstraints = {
    totalCompetitors: 8,
    guardianFamilies: 5, // 3 families + 2 individuals
    minSubsets: 2, // 8 competitors / 4 preferred = 2
    maxSubsets: 4, // 8 competitors / 2 minimum = 4
    guardianPairs: [
        { guardian: '003', dependents: ['004'] },
        { guardian: '005', dependents: ['006', '007'] }
    ]
};
