/**
 * Mixed Integer Programming approach using HiGHS solver
 * 
 * This algorithm formulates the partitioning problem as a proper MIP problem where:
 * - Binary variables x[i][j] indicate if competitor i is in subset j
 * - Objective function maximizes the quality score based on preferences
 * - Constraints ensure valid partitioning and guardian relationships
 */

import type { Competitor, PartitionOptions, AlgorithmResult } from '../types';
import { DEFAULT_OPTIONS, createPartitionResult, createGuardianFamilies } from '../utils';

// Import HiGHS solver
const highs = require('highs');

interface HiGHSVariable {
    name: string;
    lower: number;
    upper: number;
    type: 'continuous' | 'integer' | 'binary';
    cost: number;
}

interface HiGHSConstraint {
    name: string;
    lower: number;
    upper: number;
    entries: Array<{ variable: string; coefficient: number }>;
}

interface HiGHSModel {
    sense: 'minimize' | 'maximize';
    variables: HiGHSVariable[];
    constraints: HiGHSConstraint[];
}

/**
 * Enhanced MIP solver using HiGHS for proper optimization
 */
class HiGHSMIPSolver {
    private competitors: Competitor[];
    private families: Competitor[][];
    private options: Required<PartitionOptions>;
    private maxSubsets: number;

    constructor(competitors: Competitor[], options: Required<PartitionOptions>) {
        this.competitors = competitors;
        this.families = createGuardianFamilies(competitors);
        // Special constraint: if ≤112 competitors, max subset size is 4
        this.options = competitors.length <= 112
            ? { ...options, maxSubsetSize: Math.min(options.maxSubsetSize, 4) }
            : options;
        this.maxSubsets = Math.min(this.options.maxSubsets, Math.ceil(competitors.length / this.options.minSubsetSize));
    }

    /**
     * Creates a MIP model for the HiGHS solver
     */
    private createMIPModel(): HiGHSModel {
        const model: HiGHSModel = {
            sense: 'maximize',
            variables: [],
            constraints: []
        };

        // Create binary variables: x[family_i][subset_j] = 1 if family i is assigned to subset j
        const variableMap = new Map<string, number>();
        let varIndex = 0;

        for (let i = 0; i < this.families.length; i++) {
            for (let j = 0; j < this.maxSubsets; j++) {
                const varName = `x_${i}_${j}`;
                variableMap.set(varName, varIndex++);

                // Calculate objective coefficient for this variable
                const cost = this.calculateObjectiveCoefficient(i, j);

                model.variables.push({
                    name: varName,
                    lower: 0,
                    upper: 1,
                    type: 'binary',
                    cost: cost
                });
            }
        }

        // Constraint 1: Each family must be assigned to exactly one subset
        for (let i = 0; i < this.families.length; i++) {
            const entries: Array<{ variable: string; coefficient: number }> = [];

            for (let j = 0; j < this.maxSubsets; j++) {
                const varName = `x_${i}_${j}`;
                entries.push({ variable: varName, coefficient: 1 });
            }

            model.constraints.push({
                name: `assign_family_${i}`,
                lower: 1,
                upper: 1,
                entries: entries
            });
        }

        // Constraint 2: Subset maximum size limits
        for (let j = 0; j < this.maxSubsets; j++) {
            const entries: Array<{ variable: string; coefficient: number }> = [];

            for (let i = 0; i < this.families.length; i++) {
                const varName = `x_${i}_${j}`;
                const familySize = this.families[i].length;
                entries.push({ variable: varName, coefficient: familySize });
            }

            model.constraints.push({
                name: `max_size_subset_${j}`,
                lower: 0,
                upper: this.options.maxSubsetSize,
                entries: entries
            });
        }

        // Constraint 3: Minimum size constraints using indicator variables
        // For each subset j: if any family is assigned to j, then total size >= minSubsetSize
        for (let j = 0; j < this.maxSubsets; j++) {
            // Create indicator variable y[j] = 1 if subset j is used
            const indicatorVarName = `y_${j}`;
            variableMap.set(indicatorVarName, varIndex++);

            model.variables.push({
                name: indicatorVarName,
                lower: 0,
                upper: 1,
                type: 'binary',
                cost: -0.1 // Small penalty for using more subsets
            });

            // Link constraint: sum of assignments in subset j <= M * y[j]
            // where M is a large number (maxSubsetSize)
            const linkEntries: Array<{ variable: string; coefficient: number }> = [];
            linkEntries.push({ variable: indicatorVarName, coefficient: -this.options.maxSubsetSize });

            for (let i = 0; i < this.families.length; i++) {
                const varName = `x_${i}_${j}`;
                linkEntries.push({ variable: varName, coefficient: 1 });
            }

            model.constraints.push({
                name: `link_subset_${j}`,
                lower: -Infinity,
                upper: 0,
                entries: linkEntries
            });

            // Minimum size constraint: total size in subset j >= minSubsetSize * y[j]
            const minSizeEntries: Array<{ variable: string; coefficient: number }> = [];
            minSizeEntries.push({ variable: indicatorVarName, coefficient: -this.options.minSubsetSize });

            for (let i = 0; i < this.families.length; i++) {
                const varName = `x_${i}_${j}`;
                const familySize = this.families[i].length;
                minSizeEntries.push({ variable: varName, coefficient: familySize });
            }

            model.constraints.push({
                name: `min_size_subset_${j}`,
                lower: 0,
                upper: Infinity,
                entries: minSizeEntries
            });
        }

        return model;
    }

    /**
     * Calculates the objective coefficient for a family-subset assignment
     */
    private calculateObjectiveCoefficient(familyIndex: number, subsetIndex: number): number {
        const family = this.families[familyIndex];
        const familySize = family.length;

        // Base reward for assignment
        let coefficient = 10;

        // Size preference: prefer assignments that help achieve preferred subset size
        if (familySize === this.options.preferredSubsetSize) {
            coefficient += 5; // Bonus for preferred size families
        } else if (familySize <= this.options.preferredSubsetSize) {
            coefficient += 3; // Smaller bonus for smaller families
        }

        // Gender balance bonus: simple check for mixed genders in family
        const hasMultipleGenders = new Set(family.map(c => c.gender)).size > 1;
        if (hasMultipleGenders) {
            coefficient += 2 * this.options.genderWeight;
        }

        // Age category bonus: bonus for families with same age category
        const uniqueAges = new Set(family.map(c => c.ageCategory)).size;
        if (uniqueAges === 1) {
            coefficient += 2 * this.options.ageCategoryWeight;
        }

        // Equipment class bonus
        const uniqueEquipment = new Set(family.map(c => c.equipmentClass)).size;
        if (this.options.groupByEquipmentClass && uniqueEquipment === 1) {
            coefficient += 2 * this.options.equipmentClassWeight;
        } else if (!this.options.groupByEquipmentClass && uniqueEquipment > 1) {
            coefficient += 1 * this.options.equipmentClassWeight;
        }

        return coefficient;
    }

    /**
     * Solves the MIP model using HiGHS and returns the solution
     */
    async solve(): Promise<Competitor[][]> {
        const model = this.createMIPModel();

        // Debug: log model size (only for small problems)
        if (this.families.length <= 5) {
            console.log(`HiGHS model: ${model.variables.length} variables, ${model.constraints.length} constraints`);
        }

        // Convert to HiGHS LP format
        const lpModel = this.convertToLPFormat(model);

        // Initialize HiGHS module and solve
        const solver = await highs();
        const solution = solver.solve(lpModel);

        // Debug: log solution status
        if (this.families.length <= 5) {
            console.log('HiGHS solution status:', solution.Status);
        }

        if (!solution) {
            throw new Error('HiGHS solver returned no solution');
        }

        if (solution.Status !== 'Optimal') {
            throw new Error(`HiGHS solver failed with status: ${solution.Status}`);
        }

        // Extract solution from HiGHS format
        const subsets: Competitor[][] = Array(this.maxSubsets).fill(null).map(() => []);

        for (let i = 0; i < this.families.length; i++) {
            for (let j = 0; j < this.maxSubsets; j++) {
                const varName = `x_${i}_${j}`;
                const column = solution.Columns[varName];

                if (column && column.Primal > 0.5) { // Binary variable should be 1
                    subsets[j].push(...this.families[i]);
                    break; // Family can only be in one subset
                }
            }
        }

        // Remove empty subsets
        const nonEmptySubsets = subsets.filter(subset => subset.length > 0);

        // Validate solution
        if (!this.validateSolution(nonEmptySubsets)) {
            throw new Error('HiGHS solution validation failed - constraints not met');
        }

        return nonEmptySubsets;
    }

    /**
     * Converts our HiGHS model to LP format string that HiGHS can understand
     */
    private convertToLPFormat(model: HiGHSModel): string {
        let lp = '';

        // Objective function
        lp += model.sense === 'maximize' ? 'Maximize\n' : 'Minimize\n';
        lp += 'obj: ';

        const objTerms: string[] = [];
        for (const variable of model.variables) {
            if (variable.cost !== 0) {
                const sign = variable.cost >= 0 ? '+' : '';
                objTerms.push(`${sign}${variable.cost} ${variable.name}`);
            }
        }
        lp += objTerms.join(' ') + '\n\n';

        // Constraints
        lp += 'Subject To\n';
        for (const constraint of model.constraints) {
            let constraintStr = `${constraint.name}: `;
            const terms: string[] = [];

            for (const entry of constraint.entries) {
                const sign = entry.coefficient >= 0 ? '+' : '';
                terms.push(`${sign}${entry.coefficient} ${entry.variable}`);
            }

            constraintStr += terms.join(' ');

            // Add bounds
            if (constraint.lower === constraint.upper) {
                constraintStr += ` = ${constraint.lower}`;
            } else {
                if (constraint.lower > -Infinity) {
                    constraintStr += ` >= ${constraint.lower}`;
                }
                if (constraint.upper < Infinity) {
                    if (constraint.lower > -Infinity) {
                        // This is a range constraint, need to handle differently
                        lp += constraintStr + '\n';
                        constraintStr = `${constraint.name}_upper: ${terms.join(' ')} <= ${constraint.upper}`;
                    } else {
                        constraintStr += ` <= ${constraint.upper}`;
                    }
                }
            }

            lp += constraintStr + '\n';
        }

        // Variable bounds and types
        lp += '\nBounds\n';
        const binaryVars: string[] = [];

        for (const variable of model.variables) {
            if (variable.type === 'binary') {
                binaryVars.push(variable.name);
            } else {
                if (variable.lower !== 0 || variable.upper !== Infinity) {
                    lp += `${variable.lower} <= ${variable.name} <= ${variable.upper}\n`;
                }
            }
        }

        if (binaryVars.length > 0) {
            lp += '\nBinary\n';
            lp += binaryVars.join(' ') + '\n';
        }

        lp += '\nEnd\n';

        // Debug: log LP model for small problems
        if (this.families.length <= 3) {
            console.log('Generated LP model:');
            console.log(lp);
        }

        return lp;
    }


    /**
     * Validates that the solution meets all constraints
     */
    private validateSolution(subsets: Competitor[][]): boolean {
        // Check all competitors are assigned exactly once
        const assignedIds = new Set<string>();
        for (const subset of subsets) {
            for (const competitor of subset) {
                if (assignedIds.has(competitor.id)) {
                    return false; // Duplicate assignment
                }
                assignedIds.add(competitor.id);
            }
        }

        // Check all competitors are assigned
        if (assignedIds.size !== this.competitors.length) {
            return false;
        }

        // Check subset size constraints
        for (const subset of subsets) {
            if (subset.length < this.options.minSubsetSize || subset.length > this.options.maxSubsetSize) {
                return false;
            }
        }

        // Check guardian constraints
        for (const subset of subsets) {
            const subsetIds = new Set(subset.map(c => c.id));
            for (const competitor of subset) {
                if (competitor.guardianId && !subsetIds.has(competitor.guardianId)) {
                    return false; // Guardian not in same subset
                }
            }
        }

        return true;
    }

}

/**
 * Solves the competitor partitioning problem using HiGHS MIP solver
 */
export async function solveMIPWithLP(
    competitors: Competitor[],
    options: Partial<PartitionOptions> = {}
): Promise<AlgorithmResult> {
    const startTime = performance.now();
    const opts = { ...DEFAULT_OPTIONS, ...options };

    if (competitors.length === 0) {
        return {
            result: createPartitionResult([], opts),
            executionTime: 0,
            algorithmUsed: 'Mixed Integer Programming (HiGHS)',
        };
    }

    // Use simplified solver to avoid memory issues
    const solver = new HiGHSMIPSolver(competitors, opts);
    const subsets = await solver.solve();

    const result = createPartitionResult(subsets, opts);
    const executionTime = performance.now() - startTime;

    return {
        result,
        executionTime,
        algorithmUsed: 'Mixed Integer Programming (HiGHS)',
    };
}
