/**
 * Mixed Integer Programming approach for competitor partitioning
 * 
 * This algorithm formulates the partitioning problem as a MIP problem where:
 * - Binary variables x[i][j] indicate if competitor i is in subset j
 * - Objective function maximizes the quality score based on preferences
 * - Constraints ensure valid partitioning
 */

import type { Competitor, PartitionOptions, AlgorithmResult } from '../types';
import { createPartitionResult, validatePartition, createGuardianFamilies, scoreSubset, type ResolvedPartitionOptions } from '../utils';
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

function openSubsetFor(
    subsets: Competitor[][],
    familySize: number,
    currentSubset: number,
    options: { maxSubsetSize: number; preferredSubsetSize: number },
    maxSubsets: number
): { index: number; nextSubset: number } | null {
    const started = Math.min(currentSubset, subsets.length);
    let bestIndex = -1;
    let bestScore = -1;

    for (let index = 0; index < started; index++) {
        const available = options.maxSubsetSize - subsets[index].length;
        if (available < familySize) {
            continue;
        }
        const newSize = subsets[index].length + familySize;
        const totalScore = 1000 - Math.abs(newSize - options.preferredSubsetSize) + available;
        if (totalScore > bestScore) {
            bestScore = totalScore;
            bestIndex = index;
        }
    }

    if (bestIndex >= 0) {
        return { index: bestIndex, nextSubset: currentSubset };
    }
    if (currentSubset >= maxSubsets) {
        return null;
    }
    return { index: currentSubset, nextSubset: currentSubset + 1 };
}

/**
 * Simple MIP solver using branch-and-bound with linear relaxation
 * Note: In production, you would use a proper MIP solver like CPLEX, Gurobi, or GLPK
 */
class SimpleMIPSolver {
    private competitors: Competitor[];
    private options: ResolvedPartitionOptions;
    private numCompetitors: number;
    private maxSubsets: number;
    private variables: MIPVariable[];
    private constraints: MIPConstraint[];
    private bestSolution: MIPVariable[] | null = null;
    private bestObjective = -Infinity;

    constructor(competitors: Competitor[], options: ResolvedPartitionOptions) {
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

        // Place anyone still waiting into a group that is not already full.
        while (unassignedFamilies.length > 0) {
            const family = unassignedFamilies[0];
            const placement = openSubsetFor(subsets, family.length, currentSubset, this.options, this.maxSubsets);
            if (!placement) {
                break;
            }

            unassignedFamilies.shift();
            currentSubset = placement.nextSubset;
            for (const competitor of family) {
                subsets[placement.index].push(competitor);

                const competitorIndex = this.competitors.findIndex(c => c.id === competitor.id);
                const variableIndex = competitorIndex * this.maxSubsets + placement.index;
                solution[variableIndex].value = 1;
            }
        }

        return solution;
    }

    private calculateSubsetScore(subset: Competitor[]): number {
        return scoreSubset(subset, this.options).total;
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
