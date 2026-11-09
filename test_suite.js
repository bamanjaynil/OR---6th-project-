const fs = require('fs');
const path = require('path');
const { buildServer } = require('./src/server');

async function runTests() {
    console.log('🧪 Starting Comprehensive Quality Assurance Test Suite for CIVICGRID...\n');
    let errors = [];

    // 1. Verify HTML Element IDs
    console.log('--- Test 1: HTML Element ID Verification ---');
    const htmlPath = path.join(__dirname, 'public', 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');

    const expectedIds = [
        'toastContainer', 'paretoTooltip', 'sidebar', 'sidebarProjectCount',
        'nav-overview', 'nav-projects', 'nav-optimization', 'nav-results', 'nav-methodology',
        'scen-standard', 'scen-tight', 'scen-green', 'scen-greedytrap',
        'backendStatusBadge', 'breadcrumbCurrent', 'topBarTitle', 'staleIndicator', 'btnDemoMode', 'btnTopRunOpt',
        'page-overview', 'page-projects', 'page-optimization', 'page-results', 'page-methodology',
        'kpiOverviewBudget', 'kpiOverviewTotalProjects', 'kpiOverviewFundedCount', 'kpiOverviewOutlay', 'kpiOverviewSlack',
        'kpiOverviewSocialValue', 'kpiOverviewAvgSROI', 'kpiOverviewUtil', 'kpiOverviewUtilBar',
        'overviewSolverBadge', 'overviewSolveTime', 'overviewNodes', 'sumCapexText', 'sumOpexText', 'sumCO2Text', 'sumPopText',
        'chartSectorAllocation', 'chartCostImpact', 'chartSelectedVsRejected',
        'projectSearchInput', 'projectSectorFilter', 'projectSortOption', 'btnViewTable', 'btnViewCards',
        'projectTableViewContainer', 'projectTableBody', 'projectCardsViewContainer',
        'sliderCapex', 'lblCapexBudget', 'lblTotalPortfolioCapex',
        'sliderOpex', 'lblOpexBudget',
        'sliderMinCO2', 'lblMinCO2',
        'sliderMinPop', 'lblMinPop',
        'chkDependencyICCC', 'chkExclusivityTransit', 'chkSectorFloor', 'chkSolarEbusDep',
        'paretoCanvas', 'solveTimeBadge', 'bbNodesExplored', 'bbPrunedBound', 'bbPrunedInfeas', 'bbIncumbents', 'bbSearchEfficiency', 'bbTraceLog',
        'resBudget', 'resOutlay', 'resSlack', 'resSocialValue', 'resRatio', 'resultsStatusBadge', 'fundedCountBadge', 'rejectedCountBadge',
        'resultsSelectedTableBody', 'resultsRejectedTableBody', 'resultsDecisionVector', 'resultsVectorBreakdown',
        'addProjectModal', 'newProjName', 'newProjSector', 'newProjCapex', 'newProjOpex', 'newProjSROI', 'newProjPop', 'newProjCO2',
        'editProjectModal', 'editProjIndex', 'editProjName', 'editProjSector', 'editProjCapex', 'editProjOpex', 'editProjSROI', 'editProjPop', 'editProjCO2'
    ];

    for (const id of expectedIds) {
        if (!html.includes(`id="${id}"`)) {
            errors.push(`Missing HTML element ID: ${id}`);
        }
    }
    if (errors.length === 0) {
        console.log(`✅ All ${expectedIds.length} required CIVICGRID HTML IDs are present.`);
    }

    // 2. Fastify Backend API Tests
    console.log('\n--- Test 2: Fastify Backend API Integration Tests ---');
    const app = await buildServer();

    // 2.1 Health Check
    const health = await app.inject({ method: 'GET', url: '/api/health' });
    if (health.statusCode !== 200 || health.json().status !== 'ok') {
        errors.push(`Health check failed: ${health.statusCode}`);
    } else {
        console.log('✅ /api/health returned 200 OK');
    }

    // 2.2 Projects List
    const projsRes = await app.inject({ method: 'GET', url: '/api/projects' });
    const projs = projsRes.json().projects;
    if (projsRes.statusCode !== 200 || !Array.isArray(projs) || projs.length < 12) {
        errors.push(`Projects list invalid: count = ${projs?.length}`);
    } else {
        console.log(`✅ /api/projects returned ${projs.length} seeded candidate projects`);
    }

    // 2.3 Create Project
    const createRes = await app.inject({
        method: 'POST',
        url: '/api/projects',
        payload: {
            name: "Automated Suite Infrastructure Project",
            sector: "Urban Mobility",
            capex: 125,
            opex: 12,
            sroiPct: 29.5,
            citizens: 7.0,
            co2: 18
        }
    });
    const created = createRes.json().project;
    if (createRes.statusCode !== 201 || !created || created.name !== "Automated Suite Infrastructure Project") {
        errors.push('Project creation failed');
    } else {
        console.log(`✅ /api/projects POST created project ID ${created.id} (${created.code})`);
    }

    // 2.4 Update Project
    const updateRes = await app.inject({
        method: 'PUT',
        url: `/api/projects/${created.id}`,
        payload: { capex: 140, sroiPct: 32 }
    });
    const updated = updateRes.json().project;
    if (updateRes.statusCode !== 200 || updated.capex !== 140 || updated.sroiPct !== 32) {
        errors.push('Project update failed');
    } else {
        console.log(`✅ /api/projects/${created.id} PUT updated parameters`);
    }

    // 2.5 Delete Project
    const delRes = await app.inject({
        method: 'DELETE',
        url: `/api/projects/${created.id}`
    });
    if (delRes.statusCode !== 200) {
        errors.push('Project delete failed');
    } else {
        console.log(`✅ /api/projects/${created.id} DELETE successfully removed test project`);
    }

    // 2.6 Reset Projects
    const resetRes = await app.inject({ method: 'POST', url: '/api/projects/reset' });
    if (resetRes.statusCode !== 200 || resetRes.json().projects.length !== 12) {
        errors.push('Project reset failed');
    } else {
        console.log(`✅ /api/projects/reset restored default 12 smart city projects`);
    }

    // 2.7 Scenarios
    const scenRes = await app.inject({ method: 'GET', url: '/api/scenarios' });
    const scens = scenRes.json().scenarios;
    if (scenRes.statusCode !== 200 || scens.length < 4) {
        errors.push('Scenarios check failed');
    } else {
        console.log(`✅ /api/scenarios returned ${scens.length} predefined scenarios`);
    }

    // 2.8 Optimization Solver
    console.log('\n--- Test 3: Operations Research ILP Engine Verification ---');
    const optRes = await app.inject({
        method: 'POST',
        url: '/api/optimize',
        payload: {
            scenarioName: "CivicGrid Standard Test",
            maxCapex: 850,
            maxOpex: 95,
            minCO2: 45,
            minPop: 15,
            depICCC: true,
            exclTransit: true,
            sectorFloor: true,
            solarEbusDep: false
        }
    });
    const optSol = optRes.json().solution;
    if (optRes.statusCode !== 200 || !optSol.feasible || optSol.bestObj <= 0) {
        errors.push('Optimization test failed');
    } else {
        console.log(`✅ /api/optimize solved standard SPV corpus: Optimal Z* = ₹${optSol.bestObj} Cr (${optSol.selectedCodes.join(', ')})`);
    }

    // 2.9 Greedy Trap Test
    const trapRes = await app.inject({
        method: 'POST',
        url: '/api/optimize',
        payload: {
            scenarioName: "Greedy Trap Test",
            maxCapex: 510,
            maxOpex: 70,
            minCO2: 30,
            minPop: 15,
            depICCC: true,
            exclTransit: true,
            sectorFloor: true,
            solarEbusDep: false
        }
    });
    const trapSol = trapRes.json().solution;
    if (trapRes.statusCode !== 200 || !trapSol.feasible) {
        errors.push('Greedy Trap test failed');
    } else {
        console.log(`✅ Greedy Trap Test: Exact ILP satisfied equity floors (₹${trapSol.bestObj} Cr)`);
    }

    // 2.10 Audit History
    const histRes = await app.inject({ method: 'GET', url: '/api/history' });
    const hist = histRes.json().history;
    if (histRes.statusCode !== 200 || !Array.isArray(hist) || hist.length === 0) {
        errors.push('Audit history retrieval failed');
    } else {
        console.log(`✅ /api/history retrieved ${hist.length} optimization audit records from SQLite`);
    }

    // 3. Standalone Downloads HTML Verification
    console.log('\n--- Test 4: Standalone Downloads HTML Verification ---');
    const standalonePath = 'C:\\Users\\Baman Jaynilkumar\\Downloads\\smart_city_ilp_capital_budgeting_optimizer.html';
    if (!fs.existsSync(standalonePath)) {
        errors.push('Standalone file missing in Downloads folder');
    } else {
        const standaloneContent = fs.readFileSync(standalonePath, 'utf8');
        if (!standaloneContent.includes('<style>') || !standaloneContent.includes('<script>')) {
            errors.push('Standalone file missing inlined styles or scripts');
        }
        if (standaloneContent.includes('fa-Graduation-cap')) {
            errors.push('FontAwesome uppercase typo found');
        }
        console.log(`✅ Standalone file in Downloads verified (${standaloneContent.length} bytes, self-contained)`);
    }

    console.log('\n========================================================');
    if (errors.length === 0) {
        console.log('🎉 ALL CIVICGRID VERIFICATION TESTS PASSED (0 ERRORS)!');
    } else {
        console.error('❌ FAILURES DETECTED:');
        errors.forEach(e => console.error('  - ' + e));
        process.exit(1);
    }
    console.log('========================================================\n');
}

runTests();
