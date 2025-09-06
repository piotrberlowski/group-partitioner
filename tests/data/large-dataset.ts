/**
 * Large test dataset with 168 competitors (maximum allowed)
 * Includes extensive guardian relationships and all equipment classes
 */

import type { Competitor, EquipmentClass, AgeGroup, Gender } from '../../src/types';

// Helper function to generate competitors
function generateCompetitor(
    id: string,
    equipmentClass: EquipmentClass,
    ageCategory: AgeGroup,
    gender: Gender,
    guardianId?: string
): Competitor {
    return { id, equipmentClass, ageCategory, gender, guardianId };
}

export const largeDataset: Competitor[] = [];

// Generate competitors systematically to ensure good distribution
let competitorId = 1;

const equipmentClasses: EquipmentClass[] = ['HB', 'LB', 'TR', 'BHR', 'BBR', 'FSR', 'BBC', 'BL', 'BU', 'FSC', 'FU'];
const ageGroups: AgeGroup[] = ['C', 'J', 'YA', 'A', 'V', 'S'];
const genders: Gender[] = ['M', 'F'];

// Create guardian families first (about 20% of competitors will be in guardian families)
const guardianFamilies: Array<{ guardian: string; dependents: string[] }> = [];

// Generate 15 guardian families with 1-3 children each
for (let familyIndex = 0; familyIndex < 15; familyIndex++) {
    const guardianId = competitorId.toString().padStart(3, '0');
    const equipmentClass = equipmentClasses[familyIndex % equipmentClasses.length];
    const guardianAge: AgeGroup = familyIndex < 8 ? 'A' : 'V'; // Mix of Adults and Veterans as guardians
    const guardianGender = genders[familyIndex % 2];

    // Create guardian
    largeDataset.push(generateCompetitor(guardianId, equipmentClass, guardianAge, guardianGender));
    competitorId++;

    // Create 1-2 children for this guardian (max family size = 3)
    const numChildren = (familyIndex % 2) + 1; // 1 or 2 children
    const dependents: string[] = [];

    for (let childIndex = 0; childIndex < numChildren; childIndex++) {
        const childId = competitorId.toString().padStart(3, '0');
        const childEquipment = equipmentClasses[(familyIndex + childIndex + 1) % equipmentClasses.length];
        const childAge: AgeGroup = childIndex === 0 ? 'C' : 'J'; // First child is Child, others are Juniors
        const childGender = genders[(familyIndex + childIndex) % 2];

        largeDataset.push(generateCompetitor(childId, childEquipment, childAge, childGender, guardianId));
        dependents.push(childId);
        competitorId++;
    }

    guardianFamilies.push({ guardian: guardianId, dependents });
}

// Generate individual competitors to reach 168 total
while (largeDataset.length < 168) {
    const id = competitorId.toString().padStart(3, '0');
    const equipmentClass = equipmentClasses[(competitorId - 1) % equipmentClasses.length];
    const ageCategory = ageGroups[Math.floor((competitorId - 1) / equipmentClasses.length) % ageGroups.length];
    const gender = genders[(competitorId - 1) % 2];

    largeDataset.push(generateCompetitor(id, equipmentClass, ageCategory, gender));
    competitorId++;
}

export const largeDatasetExpectedConstraints = {
    totalCompetitors: 168,
    guardianFamilies: guardianFamilies.length + (168 - guardianFamilies.reduce((sum, family) => sum + 1 + family.dependents.length, 0)),
    minSubsets: 28, // 168 competitors / 6 max = 28 (exactly at the limit)
    maxSubsets: 28, // Maximum allowed by constraints
    preferredSubsets: 42, // 168 competitors / 4 preferred = 42 (but capped at 28)
    guardianPairs: guardianFamilies
};

// Verify we have exactly 168 competitors
if (largeDataset.length !== 168) {
    throw new Error(`Large dataset should have exactly 168 competitors, but has ${largeDataset.length}`);
}

// Verify all guardian references are valid
for (const competitor of largeDataset) {
    if (competitor.guardianId && !largeDataset.some(c => c.id === competitor.guardianId)) {
        throw new Error(`Invalid guardian reference: ${competitor.guardianId} for competitor ${competitor.id}`);
    }
}
