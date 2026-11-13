import type { Competitor } from './types';

/** A target smaller than this is not a group. Size 1 and size 2 are never emitted. */
export const MINIMUM_SUBSET_SIZE = 3;

export function smallestAllowedSubset(requestedMin: number): number {
    return Math.max(MINIMUM_SUBSET_SIZE, requestedMin);
}

function isLinked(competitor: Competitor, group: Competitor[]): boolean {
    if (competitor.guardianId && group.some((member) => member.id === competitor.guardianId)) {
        return true;
    }
    return group.some((member) => member.guardianId === competitor.id);
}

function takeUnlinked(group: Competitor[]): Competitor | undefined {
    for (let index = group.length - 1; index >= 0; index--) {
        const competitor = group[index];
        if (!isLinked(competitor, group)) {
            group.splice(index, 1);
            return competitor;
        }
    }
    return undefined;
}

function undoMoves(short: Competitor[], moved: { person: Competitor; donor: Competitor[] }[]): void {
    for (const move of moved.reverse()) {
        const index = short.indexOf(move.person);
        if (index >= 0) {
            short.splice(index, 1);
        }
        move.donor.push(move.person);
    }
}

function fillFromDonors(groups: Competitor[][], shortIndex: number, min: number, max: number): boolean {
    const short = groups[shortIndex];
    const need = min - short.length;
    if (need <= 0 || short.length + need > max) {
        return false;
    }

    const moved: { person: Competitor; donor: Competitor[] }[] = [];
    let remaining = need;
    for (const group of groups) {
        remaining = takeFromDonor(group, short, remaining, min, moved);
    }

    if (remaining === 0) {
        return true;
    }
    undoMoves(short, moved);
    return false;
}

function takeFromDonor(
    group: Competitor[],
    short: Competitor[],
    remaining: number,
    min: number,
    moved: { person: Competitor; donor: Competitor[] }[]
): number {
    let left = remaining;
    while (left > 0 && group !== short && group.length > min) {
        const person = takeUnlinked(group);
        if (!person) {
            return left;
        }
        short.push(person);
        moved.push({ person, donor: group });
        left -= 1;
    }
    return left;
}

function mergeIntoHost(groups: Competitor[][], shortIndex: number, min: number, max: number): boolean {
    const short = groups[shortIndex];
    const hostIndex = groups.findIndex((group, index) => {
        if (index === shortIndex) {
            return false;
        }
        const combined = group.length + short.length;
        return combined >= min && combined <= max;
    });
    if (hostIndex < 0) {
        return false;
    }
    groups[hostIndex].push(...short);
    groups.splice(shortIndex, 1);
    return true;
}

function absorbShortGroup(groups: Competitor[][], min: number, max: number): boolean {
    const shortIndex = groups.findIndex((group) => group.length < min);
    if (shortIndex < 0) {
        return false;
    }
    if (fillFromDonors(groups, shortIndex, min, max)) {
        return true;
    }
    if (mergeIntoHost(groups, shortIndex, min, max)) {
        return true;
    }
    groups.splice(shortIndex, 1);
    return true;
}

/**
 * Drops or repairs targets of size 1 or 2.
 * A short group is filled from donors, merged into another group, or removed.
 * Removed archers are not given a target.
 */
export function retainLegalSubsets(
    subsets: Competitor[][],
    min: number,
    max: number
): Competitor[][] {
    const floor = smallestAllowedSubset(min);
    const groups = subsets.map((subset) => [...subset]).filter((subset) => subset.length > 0);
    let progressed = true;
    let steps = 0;
    const stepLimit = groups.length * groups.length + groups.length + 1;
    while (progressed && steps < stepLimit) {
        steps += 1;
        progressed = absorbShortGroup(groups, floor, max);
    }
    return groups.filter((group) => group.length >= floor);
}
