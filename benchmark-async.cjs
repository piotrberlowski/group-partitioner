/**
 * Comprehensive async benchmark comparing implemented algorithms
 * Tests performance, quality, and scalability across different scenarios
 * Skips branch-and-bound for performance as requested
 */

const { solve, solveMIP, solveMIPWithLP, solveClustering, compareAlgorithms } = require('./dist/index.js');

// Test data generators
function generateCompetitors(count, options = {}) {
    const competitors = [];
    const equipmentClasses = ['HB', 'LB', 'TR', 'BHR', 'BBR', 'FSR', 'BBC', 'BL', 'BU', 'FSC', 'FU'];
    const ageGroups = ['C', 'J', 'YA', 'A', 'V', 'S'];
    const genders = ['M', 'F'];

    const {
        guardianRatio = 0.2,        // 20% of competitors have guardians
        maxFamilySize = 3,          // Maximum family size (guardian + dependents)
        balancedGenders = true,     // Try to balance genders
        diverseAges = true,         // Spread across age groups
        diverseEquipment = true     // Spread across equipment classes
    } = options;

    let competitorId = 1;
    let guardianCount = 0;
    const targetGuardians = Math.floor(count * guardianRatio);

    // Create guardian families first
    while (guardianCount < targetGuardians && competitorId <= count) {
        const guardianId = competitorId.toString().padStart(3, '0');
        const familySize = Math.min(maxFamilySize, Math.floor(Math.random() * 3) + 1);

        // Create guardian
        competitors.push({
            id: guardianId,
            equipmentClass: equipmentClasses[Math.floor(Math.random() * equipmentClasses.length)],
            ageCategory: diverseAges ? ['A', 'V'][Math.floor(Math.random() * 2)] : 'A',
            gender: balancedGenders ? (competitorId % 2 === 0 ? 'M' : 'F') : genders[Math.floor(Math.random() * 2)]
        });
        competitorId++;

        // Create dependents
        for (let i = 1; i < familySize && competitorId <= count; i++) {
            const dependentId = competitorId.toString().padStart(3, '0');
            competitors.push({
                id: dependentId,
                equipmentClass: diverseEquipment ?
                    equipmentClasses[Math.floor(Math.random() * equipmentClasses.length)] :
                    competitors[competitors.length - 1].equipmentClass,
                ageCategory: diverseAges ? ['C', 'J'][Math.floor(Math.random() * 2)] : 'C',
                gender: balancedGenders ? (competitorId % 2 === 0 ? 'M' : 'F') : genders[Math.floor(Math.random() * 2)],
                guardianId: guardianId
            });
            competitorId++;
        }

        guardianCount++;
    }

    // Fill remaining with individual competitors
    while (competitorId <= count) {
        const id = competitorId.toString().padStart(3, '0');
        competitors.push({
            id,
            equipmentClass: diverseEquipment ?
                equipmentClasses[(competitorId - 1) % equipmentClasses.length] :
                equipmentClasses[0],
            ageCategory: diverseAges ?
                ageGroups[Math.floor((competitorId - 1) / (equipmentClasses.length || 1)) % ageGroups.length] :
                'A',
            gender: balancedGenders ? (competitorId % 2 === 0 ? 'M' : 'F') : genders[Math.floor(Math.random() * 2)]
        });
        competitorId++;
    }

    return competitors.slice(0, count);
}

// Async benchmark runner
async function runBenchmark(name, algorithm, competitors, options = {}, iterations = 5) {
    const results = [];
    let totalTime = 0;
    let successCount = 0;

    console.log(`\n--- ${name} ---`);
    console.log(`Dataset: ${competitors.length} competitors, ${iterations} iterations`);

    for (let i = 0; i < iterations; i++) {
        try {
            const startTime = performance.now();
            const result = await algorithm(competitors, options);
            const endTime = performance.now();

            const executionTime = endTime - startTime;
            totalTime += executionTime;
            successCount++;

            results.push({
                score: result.result.score,
                executionTime: executionTime,
                totalSubsets: result.result.metadata.totalSubsets,
                averageSubsetSize: result.result.metadata.averageSubsetSize,
                algorithmUsed: result.algorithmUsed,
                scoreBreakdown: result.result.metadata.scoreBreakdown
            });

        } catch (error) {
            console.error(`  Iteration ${i + 1} failed:`, error.message);
        }
    }

    if (successCount === 0) {
        console.log('  ❌ All iterations failed');
        return null;
    }

    // Calculate statistics
    const scores = results.map(r => r.score);
    const times = results.map(r => r.executionTime);
    const subsetCounts = results.map(r => r.totalSubsets);

    const stats = {
        name,
        algorithm: results[0].algorithmUsed,
        successRate: (successCount / iterations * 100).toFixed(1),
        avgScore: (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2),
        minScore: Math.min(...scores).toFixed(2),
        maxScore: Math.max(...scores).toFixed(2),
        avgTime: (times.reduce((a, b) => a + b, 0) / times.length).toFixed(2),
        minTime: Math.min(...times).toFixed(2),
        maxTime: Math.max(...times).toFixed(2),
        avgSubsets: (subsetCounts.reduce((a, b) => a + b, 0) / subsetCounts.length).toFixed(1),
        scoreStdDev: Math.sqrt(scores.reduce((sq, n) => sq + Math.pow(n - scores.reduce((a, b) => a + b, 0) / scores.length, 2), 0) / scores.length).toFixed(2),
        timeStdDev: Math.sqrt(times.reduce((sq, n) => sq + Math.pow(n - times.reduce((a, b) => a + b, 0) / times.length, 2), 0) / times.length).toFixed(2)
    };

    console.log(`  Algorithm: ${stats.algorithm}`);
    console.log(`  Success Rate: ${stats.successRate}%`);
    console.log(`  Score: ${stats.avgScore} ± ${stats.scoreStdDev} (${stats.minScore}-${stats.maxScore})`);
    console.log(`  Time: ${stats.avgTime} ± ${stats.timeStdDev}ms (${stats.minTime}-${stats.maxTime}ms)`);
    console.log(`  Subsets: ${stats.avgSubsets} average`);

    return { stats, results };
}

// Constraint validation
function validateConstraints(competitors, result) {
    const errors = [];
    const subsets = result.result.subsets;

    // Check all competitors assigned exactly once
    const assignedIds = new Set();
    let totalAssigned = 0;

    for (const subset of subsets) {
        for (const competitor of subset) {
            if (assignedIds.has(competitor.id)) {
                errors.push(`Competitor ${competitor.id} assigned multiple times`);
            }
            assignedIds.add(competitor.id);
            totalAssigned++;
        }
    }

    if (totalAssigned !== competitors.length) {
        errors.push(`Expected ${competitors.length} assignments, got ${totalAssigned}`);
    }

    // Check subset size constraints
    for (let i = 0; i < subsets.length; i++) {
        const subset = subsets[i];
        if (subset.length < 2) {
            errors.push(`Subset ${i + 1} has ${subset.length} competitors (< 2)`);
        }
        if (subset.length > 6) {
            errors.push(`Subset ${i + 1} has ${subset.length} competitors (> 6)`);
        }
    }

    // Check guardian constraints
    for (const subset of subsets) {
        const subsetIds = new Set(subset.map(c => c.id));
        for (const competitor of subset) {
            if (competitor.guardianId && !subsetIds.has(competitor.guardianId)) {
                errors.push(`Competitor ${competitor.id} not with guardian ${competitor.guardianId}`);
            }
        }
    }

    // Check maximum subsets
    if (subsets.length > 28) {
        errors.push(`Too many subsets: ${subsets.length} (max 28)`);
    }

    return { valid: errors.length === 0, errors };
}

// Main benchmark execution
async function runAllBenchmarks() {
    console.log('🚀 ASYNC ALGORITHM BENCHMARK SUITE 🚀');
    console.log('=====================================\n');

    const algorithms = [
        { name: 'MIP (Greedy)', func: solveMIP },
        { name: 'MIP-LP (HiGHS)', func: solveMIPWithLP },
        { name: 'Clustering', func: solveClustering },
        // Skipping branch-and-bound as requested
    ];

    const testCases = [
        {
            name: 'Small Dataset (8 competitors)',
            competitors: generateCompetitors(8),
            iterations: 10
        },
        {
            name: 'Medium Dataset (24 competitors)',
            competitors: generateCompetitors(24),
            iterations: 5
        },
        {
            name: 'Large Dataset (48 competitors)',
            competitors: generateCompetitors(48),
            iterations: 3
        },
        {
            name: 'Very Large Dataset (96 competitors)',
            competitors: generateCompetitors(96),
            iterations: 2
        },
        {
            name: 'Maximum Dataset (168 competitors)',
            competitors: generateCompetitors(168),
            iterations: 1
        }
    ];

    const scenarios = [
        {
            name: 'Default Settings',
            options: {}
        },
        {
            name: 'Prefer Size 3',
            options: { preferredSubsetSize: 3 }
        },
        {
            name: 'High Gender Weight',
            options: { genderWeight: 2.0 }
        },
        {
            name: 'Distribute Equipment',
            options: { groupByEquipmentClass: false }
        }
    ];

    const allResults = [];

    for (const testCase of testCases) {
        console.log(`\n🎯 TEST CASE: ${testCase.name}`);
        console.log('='.repeat(50));

        // Show dataset characteristics
        const guardianFamilies = testCase.competitors.filter(c => c.guardianId).length;
        const genderBalance = testCase.competitors.filter(c => c.gender === 'M').length / testCase.competitors.length;
        const uniqueAges = new Set(testCase.competitors.map(c => c.ageCategory)).size;
        const uniqueEquipment = new Set(testCase.competitors.map(c => c.equipmentClass)).size;

        console.log(`Competitors: ${testCase.competitors.length}`);
        console.log(`Guardian families: ${guardianFamilies}`);
        console.log(`Gender balance: ${(genderBalance * 100).toFixed(1)}% male`);
        console.log(`Age groups: ${uniqueAges}`);
        console.log(`Equipment classes: ${uniqueEquipment}`);

        for (const scenario of scenarios) {
            console.log(`\n📊 SCENARIO: ${scenario.name}`);
            console.log('-'.repeat(30));

            const scenarioResults = [];

            for (const algorithm of algorithms) {
                const result = await runBenchmark(
                    algorithm.name,
                    algorithm.func,
                    testCase.competitors,
                    scenario.options,
                    testCase.iterations
                );

                if (result) {
                    result.stats.constraintViolations = 0; // Simplified for now
                    scenarioResults.push(result.stats);
                }
            }

            // Scenario summary
            if (scenarioResults.length > 0) {
                console.log('\n📈 SCENARIO SUMMARY:');
                const sortedByScore = [...scenarioResults].sort((a, b) => parseFloat(b.avgScore) - parseFloat(a.avgScore));
                const sortedByTime = [...scenarioResults].sort((a, b) => parseFloat(a.avgTime) - parseFloat(b.avgTime));

                console.log(`  🏆 Best Score: ${sortedByScore[0].name} (${sortedByScore[0].avgScore})`);
                console.log(`  ⚡ Fastest: ${sortedByTime[0].name} (${sortedByTime[0].avgTime}ms)`);

                allResults.push({
                    testCase: testCase.name,
                    scenario: scenario.name,
                    results: scenarioResults
                });
            }
        }
    }

    // Overall benchmark summary
    console.log('\n\n🏁 OVERALL BENCHMARK SUMMARY');
    console.log('=====================================');

    // Aggregate statistics
    const algorithmStats = {};

    for (const result of allResults) {
        for (const algoResult of result.results) {
            if (!algorithmStats[algoResult.name]) {
                algorithmStats[algoResult.name] = {
                    scores: [],
                    times: [],
                    successRates: []
                };
            }

            algorithmStats[algoResult.name].scores.push(parseFloat(algoResult.avgScore));
            algorithmStats[algoResult.name].times.push(parseFloat(algoResult.avgTime));
            algorithmStats[algoResult.name].successRates.push(parseFloat(algoResult.successRate));
        }
    }

    console.log('\n📊 Algorithm Performance Summary:');
    console.log('-'.repeat(80));
    console.log('Algorithm'.padEnd(20) + 'Avg Score'.padEnd(12) + 'Avg Time(ms)'.padEnd(15) + 'Success Rate'.padEnd(15) + 'Rating');
    console.log('-'.repeat(80));

    const algorithmRatings = [];

    for (const [name, stats] of Object.entries(algorithmStats)) {
        const avgScore = (stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length).toFixed(2);
        const avgTime = (stats.times.reduce((a, b) => a + b, 0) / stats.times.length).toFixed(2);
        const avgSuccessRate = (stats.successRates.reduce((a, b) => a + b, 0) / stats.successRates.length).toFixed(1);

        // Calculate overall rating (score weight: 40%, speed weight: 30%, reliability weight: 30%)
        const scoreRating = parseFloat(avgScore) / 50 * 40; // Normalize to 40 points max
        const speedRating = Math.max(0, (1000 - parseFloat(avgTime)) / 1000) * 30; // Faster = better
        const reliabilityRating = parseFloat(avgSuccessRate) / 100 * 30; // Higher success rate = better

        const overallRating = (scoreRating + speedRating + reliabilityRating).toFixed(1);

        console.log(
            name.padEnd(20) +
            avgScore.padEnd(12) +
            avgTime.padEnd(15) +
            `${avgSuccessRate}%`.padEnd(15) +
            `${overallRating}/100`
        );

        algorithmRatings.push({ name, rating: parseFloat(overallRating), avgScore: parseFloat(avgScore), avgTime: parseFloat(avgTime) });
    }

    // Final recommendations
    console.log('\n🎯 RECOMMENDATIONS:');
    console.log('-'.repeat(40));

    const bestOverall = algorithmRatings.sort((a, b) => b.rating - a.rating)[0];
    const fastest = algorithmRatings.sort((a, b) => a.avgTime - b.avgTime)[0];
    const bestQuality = algorithmRatings.sort((a, b) => b.avgScore - a.avgScore)[0];

    console.log(`🏆 Best Overall: ${bestOverall.name} (${bestOverall.rating}/100)`);
    console.log(`⚡ Fastest: ${fastest.name} (${fastest.avgTime}ms average)`);
    console.log(`🎯 Best Quality: ${bestQuality.name} (${bestQuality.avgScore} average score)`);

    console.log('\n📋 Use Case Recommendations:');
    console.log(`• Real-time applications: Use ${fastest.name}`);
    console.log(`• Quality-critical applications: Use ${bestQuality.name}`);
    console.log(`• General purpose: Use ${bestOverall.name}`);
    console.log(`• Note: Branch-and-bound was skipped for performance reasons`);

    console.log('\n✅ Async benchmark completed successfully!');
}

// Test the new async API first
async function testAsyncAPI() {
    console.log('🧪 TESTING ASYNC API');
    console.log('=====================\n');

    const testCompetitors = [
        { id: '001', equipmentClass: 'HB', ageCategory: 'J', gender: 'M' },
        { id: '002', equipmentClass: 'HB', ageCategory: 'J', gender: 'F' },
        { id: '003', equipmentClass: 'LB', ageCategory: 'A', gender: 'M' },
        { id: '004', equipmentClass: 'LB', ageCategory: 'A', gender: 'F' }
    ];

    try {
        console.log('Testing auto-selection...');
        const autoResult = await solve(testCompetitors);
        console.log(`✅ Auto: ${autoResult.algorithmUsed} (Score: ${autoResult.result.score})`);

        console.log('\nTesting specific algorithms...');
        const mipResult = await solve(testCompetitors, { algorithm: 'mip' });
        console.log(`✅ MIP: ${mipResult.algorithmUsed} (Score: ${mipResult.result.score})`);

        const higgsResult = await solve(testCompetitors, { algorithm: 'mip-lp' });
        console.log(`✅ HiGHS: ${higgsResult.algorithmUsed} (Score: ${higgsResult.result.score})`);

        const clusteringResult = await solve(testCompetitors, { algorithm: 'clustering' });
        console.log(`✅ Clustering: ${clusteringResult.algorithmUsed} (Score: ${clusteringResult.result.score})`);

        console.log('\nTesting comparison...');
        const { bestResult, allResults } = await compareAlgorithms(testCompetitors);
        console.log(`✅ Best from comparison: ${bestResult.algorithmUsed} (Score: ${bestResult.result.score})`);
        console.log(`✅ Compared ${allResults.length} algorithms`);

        console.log('\n🎉 All async API tests passed!\n');
        return true;

    } catch (error) {
        console.error('❌ Async API test failed:', error);
        return false;
    }
}

// Run the tests and benchmark
async function main() {
    const apiTestPassed = await testAsyncAPI();

    if (apiTestPassed) {
        await runAllBenchmarks();
    } else {
        console.log('❌ Skipping benchmark due to API test failure');
    }
}

main().catch(console.error);
