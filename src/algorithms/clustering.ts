/**
 * Clustering approach for competitor partitioning
 * 
 * This algorithm uses a modified K-means clustering approach where:
 * - Competitors are represented as feature vectors
 * - Distance metric considers gender, age category, and equipment class
 * - Clusters are formed and then adjusted to meet size constraints
 * - Post-processing ensures all constraints are satisfied
 */

import type { Competitor, PartitionOptions, AlgorithmResult } from '../types';
import { createPartitionResult, shuffle, createGuardianFamilies } from '../utils';
import { validateAndSanitizeOptions, ValidatedPartitionOptions } from '../common/options-validator';
import { handleEmptyDataset, createAlgorithmResult } from '../common/algorithm-base';

interface CompetitorFeatures {
    competitor: Competitor;
    features: number[]; // Encoded feature vector
    clusterId: number;
    familyId: number; // Index of the guardian family this competitor belongs to
}

interface FamilyFeatures {
    family: Competitor[]; // All competitors in this family (guardian + dependents)
    features: number[]; // Average feature vector for the family
    clusterId: number;
}

interface ClusterCenter {
    id: number;
    features: number[];
    members: FamilyFeatures[]; // Now clusters contain families instead of individual competitors
}

/**
 * Encodes competitor attributes into numerical feature vector
 */
function encodeCompetitor(competitor: Competitor, allCompetitors: Competitor[]): number[] {
    // Get unique values for categorical encoding
    const uniqueGenders = [...new Set(allCompetitors.map(c => c.gender))];
    const uniqueAgeCategories = [...new Set(allCompetitors.map(c => c.ageCategory))];
    const uniqueEquipmentClasses = [...new Set(allCompetitors.map(c => c.equipmentClass))];

    const features: number[] = [];

    // One-hot encode gender
    for (const gender of uniqueGenders) {
        features.push(competitor.gender === gender ? 1 : 0);
    }

    // One-hot encode age category
    for (const ageCategory of uniqueAgeCategories) {
        features.push(competitor.ageCategory === ageCategory ? 1 : 0);
    }

    // One-hot encode equipment class
    for (const equipmentClass of uniqueEquipmentClasses) {
        features.push(competitor.equipmentClass === equipmentClass ? 1 : 0);
    }

    // Add guardian relationship feature (binary)
    features.push(competitor.guardianId ? 1 : 0);

    return features;
}


/**
 * Calculates Euclidean distance between two feature vectors
 */
function calculateDistance(features1: number[], features2: number[]): number {
    let sum = 0;
    for (let i = 0; i < features1.length; i++) {
        const diff = features1[i] - features2[i];
        sum += diff * diff;
    }
    return Math.sqrt(sum);
}

/**
 * Calculates weighted distance considering clustering preferences
 */
function calculateWeightedDistance(
    features1: number[],
    features2: number[],
    options: Required<PartitionOptions>,
    featureWeights: { genderStart: number; ageStart: number; equipmentStart: number }
): number {
    let sum = 0;

    for (let i = 0; i < features1.length; i++) {
        const diff = features1[i] - features2[i];
        let weight = 1.0;

        // Apply different weights based on feature type
        if (i >= featureWeights.genderStart && i < featureWeights.ageStart) {
            weight = options.genderWeight;
        } else if (i >= featureWeights.ageStart && i < featureWeights.equipmentStart) {
            weight = options.ageCategoryWeight;
        } else if (i >= featureWeights.equipmentStart) {
            weight = options.equipmentClassWeight;
        }

        sum += weight * diff * diff;
    }

    return Math.sqrt(sum);
}

/**
 * Initializes cluster centers using K-means++ algorithm for families
 */
function initializeClusterCenters(
    familyFeatures: FamilyFeatures[],
    numClusters: number,
    options: Required<PartitionOptions>
): ClusterCenter[] {
    const centers: ClusterCenter[] = [];
    const families = [...familyFeatures];

    // Choose first center randomly
    const firstCenter = families[Math.floor(Math.random() * families.length)];
    centers.push({
        id: 0,
        features: [...firstCenter.features],
        members: [],
    });

    // Choose remaining centers using K-means++ (probability proportional to squared distance)
    for (let i = 1; i < numClusters; i++) {
        const distances = families.map(family => {
            const minDist = Math.min(...centers.map(center =>
                calculateDistance(family.features, center.features)
            ));
            return minDist * minDist;
        });

        const totalDistance = distances.reduce((sum, dist) => sum + dist, 0);
        const randomValue = Math.random() * totalDistance;

        let cumulativeDistance = 0;
        let selectedIndex = 0;

        for (let j = 0; j < distances.length; j++) {
            cumulativeDistance += distances[j];
            if (cumulativeDistance >= randomValue) {
                selectedIndex = j;
                break;
            }
        }

        centers.push({
            id: i,
            features: [...families[selectedIndex].features],
            members: [],
        });
    }

    return centers;
}

/**
 * Creates family feature vectors by averaging individual competitor features
 */
function createFamilyFeatures(families: Competitor[][], allCompetitors: Competitor[]): FamilyFeatures[] {
    return families.map((family, familyIndex) => {
        // Encode all family members
        const familyMemberFeatures = family.map(competitor =>
            encodeCompetitor(competitor, allCompetitors)
        );

        // Calculate average features for the family
        const avgFeatures = new Array(familyMemberFeatures[0].length).fill(0);
        for (const memberFeatures of familyMemberFeatures) {
            for (let i = 0; i < memberFeatures.length; i++) {
                avgFeatures[i] += memberFeatures[i];
            }
        }
        for (let i = 0; i < avgFeatures.length; i++) {
            avgFeatures[i] /= familyMemberFeatures.length;
        }

        return {
            family,
            features: avgFeatures,
            clusterId: -1,
        };
    });
}

/**
 * Assigns families to nearest cluster center
 */
function assignToClusters(
    familyFeatures: FamilyFeatures[],
    centers: ClusterCenter[],
    options: Required<PartitionOptions>,
    featureWeights: { genderStart: number; ageStart: number; equipmentStart: number }
): void {
    // Clear previous assignments
    centers.forEach(center => center.members = []);

    for (const family of familyFeatures) {
        let minDistance = Infinity;
        let bestCluster = 0;

        for (let i = 0; i < centers.length; i++) {
            const distance = calculateWeightedDistance(
                family.features,
                centers[i].features,
                options,
                featureWeights
            );

            if (distance < minDistance) {
                minDistance = distance;
                bestCluster = i;
            }
        }

        family.clusterId = bestCluster;
        centers[bestCluster].members.push(family);
    }
}

/**
 * Updates cluster centers to centroid of assigned members
 */
function updateClusterCenters(centers: ClusterCenter[]): boolean {
    let changed = false;

    for (const center of centers) {
        if (center.members.length === 0) continue;

        const newFeatures = new Array(center.features.length).fill(0);

        for (const member of center.members) {
            for (let i = 0; i < member.features.length; i++) {
                newFeatures[i] += member.features[i];
            }
        }

        for (let i = 0; i < newFeatures.length; i++) {
            newFeatures[i] /= center.members.length;
        }

        // Check if center moved
        for (let i = 0; i < center.features.length; i++) {
            if (Math.abs(center.features[i] - newFeatures[i]) > 1e-6) {
                changed = true;
                break;
            }
        }

        center.features = newFeatures;
    }

    return changed;
}


/**
 * Adjusts clusters to meet size constraints while keeping families together
 */
function adjustClusterSizes(
    centers: ClusterCenter[],
    options: Required<PartitionOptions>,
    maxAllowedClusters?: number
): ClusterCenter[] {
    const effectiveMaxSubsets = maxAllowedClusters || options.maxSubsets;
    const validCenters: ClusterCenter[] = [];
    const redistributeFamilies: FamilyFeatures[] = [];

    // Calculate total competitors in each cluster (families can have multiple members)
    for (const center of centers) {
        if (center.members.length === 0) {
            continue; // Skip empty clusters
        }

        const totalCompetitors = center.members.reduce((sum, family) => sum + family.family.length, 0);

        if (totalCompetitors <= options.maxSubsetSize && totalCompetitors >= options.minSubsetSize) {
            // Cluster size is valid
            validCenters.push(center);
        } else if (totalCompetitors > options.maxSubsetSize) {
            // Cluster is too large, need to redistribute some families
            const shuffledFamilies = shuffle([...center.members]);
            let currentCluster: FamilyFeatures[] = [];
            let currentSize = 0;

            for (const family of shuffledFamilies) {
                const familySize = family.family.length;

                // If adding this family would exceed max size, start a new cluster
                if (currentSize + familySize > options.maxSubsetSize) {
                    // Save current cluster if it meets minimum size
                    if (currentSize >= options.minSubsetSize) {
                        validCenters.push({
                            id: validCenters.length,
                            features: center.features,
                            members: [...currentCluster],
                        });
                    } else {
                        // Current cluster is too small, redistribute its families
                        redistributeFamilies.push(...currentCluster);
                    }

                    currentCluster = [family];
                    currentSize = familySize;
                } else {
                    currentCluster.push(family);
                    currentSize += familySize;
                }
            }

            // Handle remaining families
            if (currentCluster.length > 0) {
                if (currentSize >= options.minSubsetSize) {
                    validCenters.push({
                        id: validCenters.length,
                        features: center.features,
                        members: currentCluster,
                    });
                } else {
                    redistributeFamilies.push(...currentCluster);
                }
            }
        } else {
            // Cluster is too small, redistribute all families
            redistributeFamilies.push(...center.members);
        }
    }

    // Redistribute families that couldn't fit properly
    while (redistributeFamilies.length > 0) {
        let placed = false;

        // Try to add families to existing clusters that have room
        for (const center of validCenters) {
            if (redistributeFamilies.length === 0) break;

            const currentSize = center.members.reduce((sum, family) => sum + family.family.length, 0);

            // Find families that can fit in this cluster
            for (let i = redistributeFamilies.length - 1; i >= 0; i--) {
                const family = redistributeFamilies[i];
                if (currentSize + family.family.length <= options.maxSubsetSize) {
                    center.members.push(family);
                    redistributeFamilies.splice(i, 1);
                    placed = true;
                    break; // Only add one family per cluster per iteration to balance
                }
            }
        }

        // If no families could be placed in existing clusters, create new ones (if under max limit)
        if (!placed && redistributeFamilies.length > 0 && validCenters.length < effectiveMaxSubsets) {
            const newCluster: FamilyFeatures[] = [];
            let newClusterSize = 0;

            // Add families to new cluster until we reach preferred size or run out
            while (redistributeFamilies.length > 0 && newClusterSize < options.preferredSubsetSize) {
                const family = redistributeFamilies.shift()!;
                if (newClusterSize + family.family.length <= options.maxSubsetSize) {
                    newCluster.push(family);
                    newClusterSize += family.family.length;
                } else {
                    // This family doesn't fit, put it back and stop
                    redistributeFamilies.unshift(family);
                    break;
                }
            }

            if (newCluster.length > 0) {
                // Calculate centroid for new cluster
                const newFeatures = new Array(newCluster[0].features.length).fill(0);
                for (const family of newCluster) {
                    for (let i = 0; i < family.features.length; i++) {
                        newFeatures[i] += family.features[i];
                    }
                }
                for (let i = 0; i < newFeatures.length; i++) {
                    newFeatures[i] /= newCluster.length;
                }

                validCenters.push({
                    id: validCenters.length,
                    features: newFeatures,
                    members: newCluster,
                });
            }

            // If we still have families that can't fit anywhere, force them into existing clusters
            if (redistributeFamilies.length > 0 && (newCluster.length === 0 || validCenters.length >= effectiveMaxSubsets)) {
                // Force remaining families into existing clusters, prioritizing smallest clusters
                while (redistributeFamilies.length > 0) {
                    let smallestCenter = validCenters[0];
                    let smallestSize = smallestCenter.members.reduce((sum, family) => sum + family.family.length, 0);

                    for (const center of validCenters) {
                        const size = center.members.reduce((sum, family) => sum + family.family.length, 0);
                        if (size < smallestSize) {
                            smallestCenter = center;
                            smallestSize = size;
                        }
                    }

                    // Add one family to the smallest cluster (may exceed max size)
                    const family = redistributeFamilies.shift()!;
                    smallestCenter.members.push(family);
                }
            }
        }
    }

    return validCenters;
}

/**
 * Solves the competitor partitioning problem using clustering with guardian constraints
 */
export function solveClustering(
    competitors: Competitor[],
    options: Partial<PartitionOptions> = {}
): AlgorithmResult {
    const startTime = performance.now();

    // Handle empty dataset
    if (competitors.length === 0) {
        return handleEmptyDataset(options, 'K-means Clustering');
    }

    // Validate and sanitize options using common utility
    const opts = validateAndSanitizeOptions(options, competitors.length);

    // Create guardian families (each family must stay together)
    const families = createGuardianFamilies(competitors);

    // Create family feature vectors
    const familyFeatures = createFamilyFeatures(families, competitors);

    // Calculate feature weight boundaries for weighted distance
    const uniqueGenders = [...new Set(competitors.map(c => c.gender))];
    const uniqueAgeCategories = [...new Set(competitors.map(c => c.ageCategory))];
    const featureWeights = {
        genderStart: 0,
        ageStart: uniqueGenders.length,
        equipmentStart: uniqueGenders.length + uniqueAgeCategories.length,
    };

    // Estimate optimal number of clusters based on families, not individual competitors
    const totalCompetitors = competitors.length;
    const minClusters = Math.ceil(totalCompetitors / opts.maxSubsetSize);
    const maxClusters = Math.min(opts.maxSubsets, Math.floor(totalCompetitors / opts.minSubsetSize));
    const preferredClusters = Math.round(totalCompetitors / opts.preferredSubsetSize);

    // Ensure we don't exceed max subsets constraint - this is the critical fix
    const numClusters = Math.min(
        maxClusters,
        Math.max(minClusters, Math.min(preferredClusters, families.length))
    );

    // Initialize cluster centers using families
    let centers = initializeClusterCenters(familyFeatures, numClusters, opts);

    // K-means iterations with families
    const maxIterations = 100;
    for (let iteration = 0; iteration < maxIterations; iteration++) {
        assignToClusters(familyFeatures, centers, opts, featureWeights);
        const centersChanged = updateClusterCenters(centers);

        if (!centersChanged) {
            break; // Converged
        }
    }

    // Adjust cluster sizes to meet constraints while keeping families together
    // Pass the initial cluster count to enforce max subsets constraint
    const adjustedCenters = adjustClusterSizes(centers, opts, numClusters);

    // Convert clusters to competitor subsets (flatten families back to individual competitors)
    let subsets: Competitor[][] = adjustedCenters.map(center => {
        const subset: Competitor[] = [];
        for (const family of center.members) {
            subset.push(...family.family);
        }
        return subset;
    });

    // CRITICAL FIX: Enforce max subsets constraint by merging excess subsets
    while (subsets.length > opts.maxSubsets) {
        let bestMerge = null;
        let bestScore = -1;

        // Find the best pair to merge (prioritize pairs that stay within max size)
        for (let i = 0; i < subsets.length - 1; i++) {
            for (let j = i + 1; j < subsets.length; j++) {
                const combinedSize = subsets[i].length + subsets[j].length;

                // Calculate merge score (prefer smaller combined sizes, and heavily prefer staying within limits)
                let score = 0;
                if (combinedSize <= opts.maxSubsetSize) {
                    score = 1000 - combinedSize; // High score for valid merges
                } else if (combinedSize <= opts.maxSubsetSize + 1) {
                    score = 50 - combinedSize; // Medium score for slightly oversized merges
                } else {
                    score = 10 - combinedSize; // Low score for very oversized merges
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestMerge = { i, j, combinedSize };
                }
            }
        }

        if (bestMerge) {
            // Merge the best pair
            subsets[bestMerge.i].push(...subsets[bestMerge.j]);
            subsets.splice(bestMerge.j, 1);
        } else {
            // Fallback: merge the two smallest if no good pairs found
            let smallestIdx1 = 0, smallestIdx2 = 1;
            for (let i = 0; i < subsets.length; i++) {
                if (subsets[i].length < subsets[smallestIdx1].length) {
                    smallestIdx2 = smallestIdx1;
                    smallestIdx1 = i;
                } else if (i !== smallestIdx1 && subsets[i].length < subsets[smallestIdx2].length) {
                    smallestIdx2 = i;
                }
            }

            subsets[smallestIdx1].push(...subsets[smallestIdx2]);
            subsets.splice(smallestIdx2, 1);
        }
    }

    // FINAL FIX: Redistribute competitors to achieve optimal size distribution
    // BUT preserve guardian relationships
    if (subsets.length === opts.maxSubsets) {
        const totalCompetitors = subsets.reduce((sum, subset) => sum + subset.length, 0);
        const targetSize = Math.floor(totalCompetitors / opts.maxSubsets);
        const remainder = totalCompetitors % opts.maxSubsets;

        // Only redistribute if we have size violations, and do it carefully
        const oversized = subsets.filter(s => s.length > opts.maxSubsetSize);
        const undersized = subsets.filter(s => s.length < opts.minSubsetSize);

        if (oversized.length > 0 || undersized.length > 0) {
            // Rebuild families from current subsets to preserve guardian relationships
            const familiesInSubsets = families.map(family => {
                // Find which subset this family is in
                const familyIds = new Set(family.map(c => c.id));
                for (let i = 0; i < subsets.length; i++) {
                    const subsetIds = new Set(subsets[i].map(c => c.id));
                    if (family.every(c => subsetIds.has(c.id))) {
                        return { family, subsetIndex: i };
                    }
                }
                return { family, subsetIndex: -1 }; // Shouldn't happen
            });

            // Redistribute families to balance sizes while preserving guardian constraints
            subsets.length = 0; // Clear existing subsets

            // Sort families by size (largest first) for better packing
            const sortedFamilies = familiesInSubsets.sort((a, b) => b.family.length - a.family.length);

            // Greedy bin packing with families
            for (const { family } of sortedFamilies) {
                let bestSubsetIndex = -1;
                let bestScore = -1;

                // Find the best subset to place this family
                for (let i = 0; i < Math.min(subsets.length, opts.maxSubsets); i++) {
                    const newSize = subsets[i].length + family.length;
                    if (newSize <= opts.maxSubsetSize) {
                        // Prefer subsets that are closer to target size
                        const score = 1000 - Math.abs(newSize - targetSize);
                        if (score > bestScore) {
                            bestScore = score;
                            bestSubsetIndex = i;
                        }
                    }
                }

                // If no existing subset can fit this family, create a new one (if under limit)
                if (bestSubsetIndex === -1 && subsets.length < opts.maxSubsets) {
                    subsets.push([]);
                    bestSubsetIndex = subsets.length - 1;
                }

                // Place the family
                if (bestSubsetIndex !== -1) {
                    subsets[bestSubsetIndex].push(...family);
                } else {
                    // Force into smallest subset if we must
                    let smallestIndex = 0;
                    for (let i = 1; i < subsets.length; i++) {
                        if (subsets[i].length < subsets[smallestIndex].length) {
                            smallestIndex = i;
                        }
                    }
                    subsets[smallestIndex].push(...family);
                }
            }
        }
    }

    // FINAL CLEANUP: Ensure no subsets are smaller than minimum size
    let finalUndersized = subsets.filter(s => s.length < opts.minSubsetSize);
    let maxCleanupIterations = subsets.length; // Safety limit to prevent infinite loops
    let cleanupIterations = 0;

    while (finalUndersized.length > 0 && cleanupIterations < maxCleanupIterations) {
        cleanupIterations++;

        // Find the smallest undersized subset
        let smallestUndersized = finalUndersized[0];
        let smallestIdx = subsets.indexOf(smallestUndersized);

        for (const undersized of finalUndersized) {
            if (undersized.length < smallestUndersized.length) {
                smallestUndersized = undersized;
                smallestIdx = subsets.indexOf(undersized);
            }
        }

        // Find the best subset to merge it with (smallest that can accommodate)
        let bestMergeIdx = -1;
        let bestMergeSize = Infinity;

        for (let i = 0; i < subsets.length; i++) {
            if (i === smallestIdx) continue;

            const combinedSize = subsets[i].length + smallestUndersized.length;
            if (combinedSize <= opts.maxSubsetSize && subsets[i].length < bestMergeSize) {
                bestMergeSize = subsets[i].length;
                bestMergeIdx = i;
            }
        }

        // If no good merge found, merge with the smallest subset anyway (may exceed max size)
        if (bestMergeIdx === -1) {
            bestMergeIdx = 0;
            for (let i = 1; i < subsets.length; i++) {
                if (i !== smallestIdx && subsets[i].length < subsets[bestMergeIdx].length) {
                    bestMergeIdx = i;
                }
            }
        }

        // Merge the undersized subset
        if (bestMergeIdx !== -1 && bestMergeIdx !== smallestIdx) {
            subsets[bestMergeIdx].push(...smallestUndersized);
            subsets.splice(smallestIdx, 1);

            // Update the list of undersized subsets
            finalUndersized = subsets.filter(s => s.length < opts.minSubsetSize);
        } else {
            // If we can't merge, break to avoid infinite loop
            break;
        }
    }

    // Use common result creation utility
    return createAlgorithmResult(competitors, subsets, opts, 'K-means Clustering', startTime);
}
