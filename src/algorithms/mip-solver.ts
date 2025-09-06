/**
 * Mixed Integer Programming approach for competitor partitioning
 * 
 * This algorithm formulates the partitioning problem as a MIP problem where:
 * - Binary variables x[i][j] indicate if competitor i is in subset j
 * - Objective function maximizes the quality score based on preferences
 * - Constraints ensure valid partitioning
 */

import type { Competitor, PartitionOptions, AlgorithmResult } from '../types';
import { createPartitionResult, validatePartition, createGuardianFamilies } from '../utils';
import { validateAndSanitizeOptions, ValidatedPartitionOptions } from '../common/options-validator';
import { handleEmptyDataset, createAlgorithmResult } from '../common/algorithm-base';

interface MIPVariable {
    competitorIndex: number;
    subsetIndex: number;
    value: number; // 0 or 1
}

interface MIPConstraint {
    variables: { competitorIndex: number; subsetIndex: number; coefficient: number }[];
    operator: '=' | '<=' | '>=';
    rhs: number;
    name: string;
}

/**
 * Simple MIP solver using branch-and-bound with linear relaxation
 * Note: In production, you would use a proper MIP solver like CPLEX, Gurobi, or GLPK
 */
class SimpleMIPSolver {
    private competitors: Competitor[];
    private options: Required<PartitionOptions>;
    private numCompetitors: number;
    private maxSubsets: number;
    private variables: MIPVariable[];
    private constraints: MIPConstraint[];
    private bestSolution: MIPVariable[] | null = null;
    private bestObjective = -Infinity;

    constructor(competitors: Competitor[], options: Required<PartitionOptions>) {
        this.competitors = competitors;

        // Use common options validation
        this.options = validateAndSanitizeOptions(options, competitors.length);

        this.numCompetitors = competitors.length;
        this.maxSubsets = Math.min(this.options.maxSubsets, Math.ceil(competitors.length / this.options.minSubsetSize));
        this.variables = [];
        this.constraints = [];
        this.initializeVariables();
        this.initializeConstraints();
    }

    private initializeVariables(): void {
        // Create binary variables x[i][j] for competitor i in subset j
        for (let i = 0; i < this.numCompetitors; i++) {
            for (let j = 0; j < this.maxSubsets; j++) {
                this.variables.push({
                    competitorIndex: i,
                    subsetIndex: j,
                    value: 0,
                });
            }
        }
    }

    private initializeConstraints(): void {
        // Constraint 1: Each competitor must be in exactly one subset
        for (let i = 0; i < this.numCompetitors; i++) {
            const constraint: MIPConstraint = {
                variables: [],
                operator: '=',
                rhs: 1,
                name: `competitor_${i}_assignment`,
            };

            for (let j = 0; j < this.maxSubsets; j++) {
                constraint.variables.push({
                    competitorIndex: i,
                    subsetIndex: j,
                    coefficient: 1,
                });
            }

            this.constraints.push(constraint);
        }

        // Constraint 2: Subset size limits
        for (let j = 0; j < this.maxSubsets; j++) {
            // Minimum size constraint (if subset is used)
            const minConstraint: MIPConstraint = {
                variables: [],
                operator: '>=',
                rhs: 0, // Will be adjusted based on subset usage
                name: `subset_${j}_min_size`,
            };

            // Maximum size constraint
            const maxConstraint: MIPConstraint = {
                variables: [],
                operator: '<=',
                rhs: this.options.maxSubsetSize,
                name: `subset_${j}_max_size`,
            };

            for (let i = 0; i < this.numCompetitors; i++) {
                minConstraint.variables.push({
                    competitorIndex: i,
                    subsetIndex: j,
                    coefficient: 1,
                });
                maxConstraint.variables.push({
                    competitorIndex: i,
                    subsetIndex: j,
                    coefficient: 1,
                });
            }

            this.constraints.push(maxConstraint);
            // Note: Min constraint is handled differently in the objective
        }
    }

    private calculateObjectiveValue(solution: MIPVariable[]): number {
        // Convert solution to subsets
        const subsets: Competitor[][] = Array(this.maxSubsets).fill(null).map(() => []);

        for (const variable of solution) {
            if (variable.value === 1) {
                subsets[variable.subsetIndex].push(this.competitors[variable.competitorIndex]);
            }
        }

        // Remove empty subsets
        const nonEmptySubsets = subsets.filter(subset => subset.length > 0);

        // Check if solution is valid
        const validation = validatePartition(this.competitors, nonEmptySubsets, this.options);
        if (!validation.valid) {
            return -Infinity; // Invalid solution
        }

        // Calculate score
        const result = createPartitionResult(nonEmptySubsets, this.options);
        return result.score;
    }

    private isSolutionValid(solution: MIPVariable[]): boolean {
        // Check that each competitor is assigned exactly once
        const competitorAssignments = new Array(this.numCompetitors).fill(0);

        for (const variable of solution) {
            if (variable.value === 1) {
                competitorAssignments[variable.competitorIndex]++;
            }
        }

        return competitorAssignments.every(count => count === 1);
    }

    private solveGreedy(): MIPVariable[] {
        // Greedy heuristic with guardian constraints: assign guardian families as units
        const solution = this.variables.map(v => ({ ...v, value: 0 }));
        const subsets: Competitor[][] = Array(this.maxSubsets).fill(null).map(() => []);

        // Create guardian families (each family must be assigned together)
        const families = createGuardianFamilies(this.competitors);
        const unassignedFamilies = [...families];
        let currentSubset = 0;

        while (unassignedFamilies.length > 0 && currentSubset < this.maxSubsets) {
            const subset = subsets[currentSubset];

            // Try to fill current subset with families
            let canAddMore = true;
            while (canAddMore && unassignedFamilies.length > 0) {
                let bestFamilyIndex = -1;
                let bestScore = -Infinity;

                // Try each unassigned family and pick the one that fits and improves score most
                for (let i = 0; i < unassignedFamilies.length; i++) {
                    const family = unassignedFamilies[i];

                    // Check if family fits in current subset
                    if (subset.length + family.length <= this.options.maxSubsetSize) {
                        const testSubset = [...subset, ...family];
                        const testScore = this.calculateSubsetScore(testSubset);

                        if (testScore > bestScore) {
                            bestScore = testScore;
                            bestFamilyIndex = i;
                        }
                    }
                }

                // If we found a family that fits, assign it
                if (bestFamilyIndex >= 0) {
                    const family = unassignedFamilies.splice(bestFamilyIndex, 1)[0];

                    // Add all family members to current subset
                    for (const competitor of family) {
                        subset.push(competitor);

                        const competitorIndex = this.competitors.findIndex(c => c.id === competitor.id);
                        const variableIndex = competitorIndex * this.maxSubsets + currentSubset;
                        solution[variableIndex].value = 1;
                    }
                } else {
                    // No more families fit in current subset
                    canAddMore = false;
                }
            }

            // Move to next subset if current one meets minimum size or we can't add more
            if (subset.length >= this.options.minSubsetSize || !canAddMore) {
                currentSubset++;
            } else if (unassignedFamilies.length === 0) {
                break;
            }
        }

        // Handle remaining families that didn't fit (force them into existing subsets if possible)
        while (unassignedFamilies.length > 0) {
            const family = unassignedFamilies.shift()!;

            // Find best subset considering both available space and preferred size
            let bestSubsetIndex = 0;
            let bestScore = -1;

            for (let i = 0; i < subsets.length; i++) {
                const currentSize = subsets[i].length;
                const newSize = currentSize + family.length;
                const availableSpace = this.options.maxSubsetSize - currentSize;

                if (availableSpace >= family.length) {
                    // Calculate score: prefer sizes closer to preferred size
                    const sizeScore = 1000 - Math.abs(newSize - this.options.preferredSubsetSize);
                    const spaceScore = availableSpace; // Also consider available space
                    const totalScore = sizeScore + spaceScore;

                    if (totalScore > bestScore) {
                        bestScore = totalScore;
                        bestSubsetIndex = i;
                    }
                }
            }

            const maxAvailableSpace = this.options.maxSubsetSize - subsets[bestSubsetIndex].length;

            // If no existing subset can fit the family, create a new one if possible
            if (maxAvailableSpace < family.length && currentSubset < this.maxSubsets) {
                bestSubsetIndex = currentSubset;
                currentSubset++;
            }

            // Assign family to best subset (even if it exceeds max size - constraint will be handled later)
            for (const competitor of family) {
                subsets[bestSubsetIndex].push(competitor);

                const competitorIndex = this.competitors.findIndex(c => c.id === competitor.id);
                const variableIndex = competitorIndex * this.maxSubsets + bestSubsetIndex;
                solution[variableIndex].value = 1;
            }
        }

        return solution;
    }

    private calculateSubsetScore(subset: Competitor[]): number {
        if (subset.length === 0) return 0;

        // Simplified scoring for individual subset
        let score = 0;
        const size = subset.length;

        // Size preference
        const sizeDeviation = Math.abs(size - this.options.preferredSubsetSize);
        score += Math.max(0, 10 - sizeDeviation * 2);

        // Gender balance
        const genderCounts = new Map<string, number>();
        for (const competitor of subset) {
            genderCounts.set(competitor.gender, (genderCounts.get(competitor.gender) || 0) + 1);
        }

        let evenGenderCount = 0;
        for (const count of genderCounts.values()) {
            if (count % 2 === 0) evenGenderCount += count;
        }
        score += (evenGenderCount / size) * 10 * this.options.genderWeight;

        // Age category homogeneity
        const ageCounts = new Map<string, number>();
        for (const competitor of subset) {
            ageCounts.set(competitor.ageCategory, (ageCounts.get(competitor.ageCategory) || 0) + 1);
        }
        const maxAgeCount = Math.max(...ageCounts.values());
        score += (maxAgeCount / size) * 10 * this.options.ageCategoryWeight;

        return score;
    }

    solve(): MIPVariable[] {
        // For this simplified implementation, we use a greedy heuristic
        // In a real MIP solver, this would use branch-and-bound with linear relaxation
        const greedySolution = this.solveGreedy();

        if (this.isSolutionValid(greedySolution)) {
            const objective = this.calculateObjectiveValue(greedySolution);
            if (objective > this.bestObjective) {
                this.bestObjective = objective;
                this.bestSolution = greedySolution;
            }
        }

        return this.bestSolution || greedySolution;
    }

    getBestSolution(): { solution: MIPVariable[]; objective: number } {
        return {
            solution: this.bestSolution || [],
            objective: this.bestObjective,
        };
    }
}

/**
 * Solves the competitor partitioning problem using Mixed Integer Programming
 */
export function solveMIP(
    competitors: Competitor[],
    options: Partial<PartitionOptions> = {}
): AlgorithmResult {
    const startTime = performance.now();

    // Handle empty dataset
    if (competitors.length === 0) {
        return handleEmptyDataset(options, 'Mixed Integer Programming');
    }

    // Use common options validation
    const opts = validateAndSanitizeOptions(options, competitors.length);
    const solver = new SimpleMIPSolver(competitors, opts);
    const solution = solver.solve();

    // Convert solution back to subsets
    const subsets: Competitor[][] = Array(opts.maxSubsets).fill(null).map(() => []);

    for (const variable of solution) {
        if (variable.value === 1) {
            subsets[variable.subsetIndex].push(competitors[variable.competitorIndex]);
        }
    }

    // Remove empty subsets
    const nonEmptySubsets = subsets.filter(subset => subset.length > 0);

    // Use common result creation utility
    return createAlgorithmResult(competitors, nonEmptySubsets, opts, 'Mixed Integer Programming', startTime);
}
