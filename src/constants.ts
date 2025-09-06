/**
 * Constants for competitor categories and validation
 */

import type { EquipmentClass, AgeGroup, Gender } from './types';

/**
 * Valid equipment classes
 */
export const EQUIPMENT_CLASSES: readonly EquipmentClass[] = [
    'HB',   // Heavy Bow
    'LB',   // Light Bow  
    'TR',   // Traditional Recurve
    'BHR',  // Barebow Heavy Recurve
    'BBR',  // Barebow Basic Recurve
    'FSR',  // Freestyle Recurve
    'BBC',  // Barebow Compound
    'BL',   // Barebow Longbow
    'BU',   // Barebow Unlimited
    'FSC',  // Freestyle Compound
    'FU',   // Freestyle Unlimited
] as const;

/**
 * Valid age groups (ordered from youngest to oldest)
 */
export const AGE_GROUPS: readonly AgeGroup[] = [
    'C',    // Children
    'J',    // Juniors
    'YA',   // Young Adults
    'A',    // Adults
    'V',    // Veterans
    'S',    // Seniors
] as const;

/**
 * Valid genders
 */
export const GENDERS: readonly Gender[] = [
    'F',    // Female
    'M',    // Male
] as const;

/**
 * Equipment class descriptions for documentation
 */
export const EQUIPMENT_CLASS_DESCRIPTIONS: Record<EquipmentClass, string> = {
    'HB': 'Heavy Bow',
    'LB': 'Light Bow',
    'TR': 'Traditional Recurve',
    'BHR': 'Barebow Heavy Recurve',
    'BBR': 'Barebow Basic Recurve',
    'FSR': 'Freestyle Recurve',
    'BBC': 'Barebow Compound',
    'BL': 'Barebow Longbow',
    'BU': 'Barebow Unlimited',
    'FSC': 'Freestyle Compound',
    'FU': 'Freestyle Unlimited',
};

/**
 * Age group descriptions for documentation
 */
export const AGE_GROUP_DESCRIPTIONS: Record<AgeGroup, string> = {
    'C': 'Children',
    'J': 'Juniors',
    'YA': 'Young Adults',
    'A': 'Adults',
    'V': 'Veterans',
    'S': 'Seniors',
};

/**
 * Gender descriptions for documentation
 */
export const GENDER_DESCRIPTIONS: Record<Gender, string> = {
    'F': 'Female',
    'M': 'Male',
};

/**
 * Checks if a value is a valid equipment class
 */
export function isValidEquipmentClass(value: string): value is EquipmentClass {
    return EQUIPMENT_CLASSES.includes(value as EquipmentClass);
}

/**
 * Checks if a value is a valid age group
 */
export function isValidAgeGroup(value: string): value is AgeGroup {
    return AGE_GROUPS.includes(value as AgeGroup);
}

/**
 * Checks if a value is a valid gender
 */
export function isValidGender(value: string): value is Gender {
    return GENDERS.includes(value as Gender);
}

/**
 * Gets the age group order for comparison (lower number = younger)
 */
export function getAgeGroupOrder(ageGroup: AgeGroup): number {
    return AGE_GROUPS.indexOf(ageGroup);
}

/**
 * Compares two age groups (-1 if a is younger, 0 if same, 1 if a is older)
 */
export function compareAgeGroups(a: AgeGroup, b: AgeGroup): number {
    return getAgeGroupOrder(a) - getAgeGroupOrder(b);
}
