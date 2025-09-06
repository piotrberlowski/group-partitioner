# Group Planner

A TypeScript library for competitor partitioning algorithms, designed to be integrated into Next.js applications. Provides multiple algorithmic approaches to partition competitors into balanced subsets based on equipment class, age category, and gender preferences.

## Features

- **Multiple Algorithm Approaches**: Mixed Integer Programming (Greedy & HiGHS), K-means Clustering
- **Flexible Constraints**: Configurable subset sizes (2-6 competitors, prefer 4)
- **Guardian Constraint Enforcement**: Competitors must be in the same subset as their guardians
- **Multiple Optimization Criteria**: 
  - Even gender distribution within subsets
  - Age category homogeneity
  - Equipment class grouping or distribution
  - Guardian relationship handling
- **TypeScript Support**: Full type safety and IntelliSense
- **Performance Optimized**: Efficient algorithms suitable for up to 168 competitors

## Installation

```bash
npm install group-planner
```

## Quick Start

### Usage

```typescript
import { solve, type Competitor } from 'group-planner';

const competitors: Competitor[] = [
  { id: '001', equipmentClass: 'HB', ageCategory: 'J', gender: 'M' },
  { id: '002', equipmentClass: 'HB', ageCategory: 'J', gender: 'F' },
  { id: '003', equipmentClass: 'LB', ageCategory: 'A', gender: 'M' }, // Guardian
  { id: '004', equipmentClass: 'LB', ageCategory: 'A', gender: 'F' },
  { id: '005', equipmentClass: 'BBR', ageCategory: 'C', gender: 'M', guardianId: '003' }, // Must be with guardian 003
  // ... more competitors
];

// Auto-select best algorithm (default)
const result = await solve(competitors, {
  groupByEquipmentClass: true,
  preferredSubsetSize: 4,
});

// Or specify a particular algorithm
const mipResult = await solve(competitors, { algorithm: 'mip' });
const higgsResult = await solve(competitors, { algorithm: 'mip-lp' }); // HiGHS MIP solver
const clusteringResult = await solve(competitors, { algorithm: 'clustering' });

console.log(`Algorithm used: ${result.algorithmUsed}`);
console.log(`Score: ${result.result.score}`);
console.log(`Subsets:`, result.result.subsets);
```

### Algorithm Comparison

If you want to compare all algorithms and see detailed results:

```typescript
import { compareAlgorithms } from 'group-planner';

const { bestResult, allResults } = await compareAlgorithms(competitors, {
  groupByEquipmentClass: true,
  preferredSubsetSize: 4,
});

console.log(`Best algorithm: ${bestResult.algorithmUsed}`);
allResults.forEach(result => {
  console.log(`${result.algorithmUsed}: Score ${result.result.score} (${result.executionTime}ms)`);
});
```


## Algorithm Approaches

### 1. Mixed Integer Programming (MIP)
Formulates the problem as an optimization problem with binary variables and constraints. Treats guardian families as atomic units that must be assigned together.

```typescript
import { solveMIP } from 'group-planner';

const result = solveMIP(competitors, options);
```

### 2. K-means Clustering
Uses feature encoding and weighted distance metrics to cluster guardian families based on similarity, then adjusts clusters to meet size constraints while keeping families together.

```typescript
import { solveClustering } from 'group-planner';

const result = solveClustering(competitors, options);
```

### 3. Branch-and-bound
Systematically searches the solution space by assigning guardian families (not individual competitors) to subsets, ensuring guardians and their dependents stay together.

```typescript
// Branch-and-bound algorithm has been removed due to performance issues
// Use 'mip', 'mip-lp', or 'clustering' algorithms instead
```

## Configuration Options

```typescript
interface PartitionOptions {
  /** Prefer grouping competitors of same equipment class together vs distributing evenly */
  groupByEquipmentClass: boolean;
  /** Maximum number of subsets allowed (default: 28) */
  maxSubsets?: number;
  /** Minimum subset size (default: 2) */
  minSubsetSize?: number;
  /** Maximum subset size (default: 6) */
  maxSubsetSize?: number;
  /** Preferred subset size (default: 4) */
  preferredSubsetSize?: number;
  /** Weight for same gender preference (default: 1.0) */
  genderWeight?: number;
  /** Weight for same age category preference (default: 1.0) */
  ageCategoryWeight?: number;
  /** Weight for equipment class grouping preference (default: 1.0) */
  equipmentClassWeight?: number;
}
```

## Competitor Interface

```typescript
interface Competitor {
  id: string;
  equipmentClass: EquipmentClass; // HB, LB, TR, BHR, BBR, FSR, BBC, BL, BU, FSC, FU
  ageCategory: AgeGroup;          // C, J, YA, A, V, S
  gender: Gender;                 // F, M
  guardianId?: string;            // Reference to another competitor who is the guardian
}
```

### Equipment Classes
- **HB**: Heavy Bow
- **LB**: Light Bow  
- **TR**: Traditional Recurve
- **BHR**: Barebow Heavy Recurve
- **BBR**: Barebow Basic Recurve
- **FSR**: Freestyle Recurve
- **BBC**: Barebow Compound
- **BL**: Barebow Longbow
- **BU**: Barebow Unlimited
- **FSC**: Freestyle Compound
- **FU**: Freestyle Unlimited

### Age Groups
- **C**: Children
- **J**: Juniors
- **YA**: Young Adults
- **A**: Adults
- **V**: Veterans
- **S**: Seniors

### Gender
- **F**: Female
- **M**: Male

## Algorithm Selection

The library supports four algorithm options:

### Algorithm Options

```typescript
type Algorithm = 'mip' | 'clustering' | 'branch-and-bound' | 'auto';
```

- **`'auto'` (default)**: Runs all three algorithms and returns the result with the highest score
- **`'mip'`**: Mixed Integer Programming approach using greedy heuristic
- **`'clustering'`**: K-means clustering with constraint adjustment
- **`'branch-and-bound'`**: Systematic search with pruning

### When to Use Each Algorithm

- **Auto**: Best for production use when you want optimal results
- **MIP**: Good balance of speed and quality, handles large datasets well
- **Clustering**: Fast execution, good for real-time applications
- **Branch-and-bound**: Most thorough search, best for smaller datasets (≤48 competitors)

### Algorithm Performance Characteristics

| Algorithm | Speed | Quality | Max Competitors | Memory Usage |
|-----------|-------|---------|-----------------|--------------|
| MIP | Fast | High | 168 | Low |
| Clustering | Fastest | Good | 168 | Low |
| Branch-and-bound | Slow | Highest | ~48 | Medium |
| Auto | Slow | Highest | 168 | Medium |

## Result Structure

```typescript
interface PartitionResult {
  subsets: Competitor[][];
  score: number;
  metadata: {
    totalCompetitors: number;
    totalSubsets: number;
    averageSubsetSize: number;
    scoreBreakdown: {
      sizeScore: number;
      genderScore: number;
      ageCategoryScore: number;
      equipmentClassScore: number;
    };
  };
}
```

## Algorithm Selection

The library supports different algorithms via the `algorithm` option:

```typescript
type Algorithm = 'mip' | 'mip-lp' | 'clustering' | 'auto';

// Available algorithms:
const mipResult = await solve(competitors, { algorithm: 'mip' });        // Greedy MIP solver
const higgsResult = await solve(competitors, { algorithm: 'mip-lp' });   // HiGHS MIP solver (WebAssembly)
const clusteringResult = await solve(competitors, { algorithm: 'clustering' }); // K-means clustering
const autoResult = await solve(competitors, { algorithm: 'auto' });     // Auto-select best (default)
```

### Performance Guide

- **MIP (Greedy)**: Fast, good for most cases, handles all constraint types
- **MIP-LP (HiGHS)**: Most optimal results, slower, excellent constraint satisfaction
- **Clustering**: Fast, good for large datasets, may need constraint post-processing
- **Auto**: Runs all algorithms and returns the best result

### Special Constraints

- **≤112 competitors**: Maximum subset size automatically limited to 4 competitors
- **Guardian relationships**: Automatically preserved across all algorithms
- **Maximum 28 subsets**: Hard limit enforced by all algorithms

## Guardian Constraints

The library automatically handles guardian relationships:

```typescript
import { 
  createGuardianFamilies, 
  validateGuardianConstraints,
  validateCompetitors,
  EQUIPMENT_CLASSES,
  AGE_GROUPS 
} from 'group-planner';

// Validate competitor data before processing
const validation = validateCompetitors(competitors);
if (!validation.valid) {
  console.log('Validation errors:', validation.errors);
  return;
}

// View how competitors are grouped into families
const families = createGuardianFamilies(competitors);
console.log('Guardian families:', families);

// Validate that a solution respects guardian constraints
const guardianValidation = validateGuardianConstraints(competitors, subsets);
if (!guardianValidation.valid) {
  console.log('Guardian constraint violations:', guardianValidation.errors);
}

// Access available categories
console.log('Equipment classes:', EQUIPMENT_CLASSES);
console.log('Age groups:', AGE_GROUPS);
```

## Examples

See `src/example.ts` for complete usage examples including:
- Basic partitioning with all three algorithms
- Guardian relationship handling and validation
- Comparing equipment class grouping vs distribution strategies
- Custom scoring weights

## Development

### Setup

```bash
npm install
```

### Build

```bash
npm run build
```

### Development Mode

```bash
npm run dev
```

### Type Checking

```bash
npm run type-check
```

## Algorithm Performance

- **MIP Solver**: Fast greedy heuristic, good for large datasets
- **K-means Clustering**: Balanced approach, handles feature similarity well
- **Branch-and-bound**: Most thorough search, best for smaller datasets (<50 competitors)

## License

MIT
