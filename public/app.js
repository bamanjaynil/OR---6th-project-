/**
 * CIVICGRID — Smart City Infrastructure Investment Optimizer
 * Modern Dark Smart-City Controller & OR Analytics Engine
 */

// Application State
let projects = [];
let lastSolution = null;
let activePage = 'overview';
let projectViewMode = 'table';
let isBackendConnected = false;
let isStale = false;
let demoMode = false;
let currentScenario = 'standard';
let paretoPointsCache = [];

// Chart instances
let chartSectorAllocation = null;
let chartCostImpact = null;
let chartSelectedVsRejected = null;

// Sector Color Palette
const SECTOR_PALETTE = {
    "Digital Governance":   { fill: "#38bdf8", stroke: "#0284c7", pill: "pill-cyan" },
    "Clean Energy":         { fill: "#10b981", stroke: "#059669", pill: "pill-emerald" },
    "Urban Mobility":       { fill: "#818cf8", stroke: "#6366f1", pill: "pill-indigo" },
    "Water & Sanitation":   { fill: "#22d3ee", stroke: "#0891b2", pill: "pill-cyan" },
    "Climate Resilience":   { fill: "#f59e0b", stroke: "#d97706", pill: "pill-amber" },
    "Social Infrastructure":{ fill: "#f43f5e", stroke: "#e11d48", pill: "pill-rose" }
};

// Default Canonical Smart City Dataset (NITI Aayog / MoHUA Framework)
const CANONICAL_PROJECTS = [
    {
        id: 1,
        code: "P1",
        name: "Integrated Command & Control Centre (ICCC) & City Fiber",
        sector: "Digital Governance",
        capex: 115,
        opex: 14,
        sroiPct: 24.5,
        citizens: 18.0,
        co2: 6,
        lock: "auto",
        note: "Foundational Digital Backbone (Prerequisite for P5 & P10)"
    },
    {
        id: 2,
        code: "P2",
        name: "Smart Solar Rooftop & Municipal Microgrid Network (45 MW)",
        sector: "Clean Energy",
        capex: 160,
        opex: 8,
        sroiPct: 26.8,
        citizens: 6.5,
        co2: 38,
        lock: "auto",
        note: "High decarbonization & peak municipal tariff savings"
    },
    {
        id: 3,
        code: "P3",
        name: "100% Electric Bus Fleet (250 E-Buses) & Fast-Charging Depots",
        sector: "Urban Mobility",
        capex: 240,
        opex: 26,
        sroiPct: 28.5,
        citizens: 11.5,
        co2: 46,
        lock: "auto",
        note: "Mutually exclusive with P11 (CNG/Diesel BRT Corridor)"
    },
    {
        id: 4,
        code: "P4",
        name: "24x7 SCADA Water Supply & Smart Ultrasonic Metering",
        sector: "Water & Sanitation",
        capex: 195,
        opex: 15,
        sroiPct: 27.2,
        citizens: 14.0,
        co2: 9,
        lock: "auto",
        note: "Reduces Non-Revenue Water (NRW) from 42% to 15%"
    },
    {
        id: 5,
        code: "P5",
        name: "AI-Driven Intelligent Traffic Management System (ITMS)",
        sector: "Urban Mobility",
        capex: 85,
        opex: 11,
        sroiPct: 33.0,
        citizens: 16.5,
        co2: 18,
        lock: "auto",
        note: "Requires P1 (ICCC) to process adaptive signal feeds"
    },
    {
        id: 6,
        code: "P6",
        name: "Automated Solid Waste Biomethanation & RFID Fleet Tracking",
        sector: "Water & Sanitation",
        capex: 130,
        opex: 18,
        sroiPct: 25.0,
        citizens: 15.0,
        co2: 29,
        lock: "auto",
        note: "Eliminates open landfill methane emissions"
    },
    {
        id: 7,
        code: "P7",
        name: "City-Wide LED Smart Street Lighting & CCMS Dimming",
        sector: "Clean Energy",
        capex: 65,
        opex: 5,
        sroiPct: 31.5,
        citizens: 19.0,
        co2: 21,
        lock: "auto",
        note: "High SROI & women's pedestrian night safety"
    },
    {
        id: 8,
        code: "P8",
        name: "Transit-Oriented Affordable Rental Housing & Slum Upgradation",
        sector: "Social Infrastructure",
        capex: 210,
        opex: 12,
        sroiPct: 23.0,
        citizens: 4.8,
        co2: 5,
        lock: "auto",
        note: "High social equity impact; capital intensive"
    },
    {
        id: 9,
        code: "P9",
        name: "Multi-Modal Transit Hub & Non-Motorized Cycling Corridors",
        sector: "Urban Mobility",
        capex: 145,
        opex: 13,
        sroiPct: 25.8,
        citizens: 9.2,
        co2: 16,
        lock: "auto",
        note: "Last-mile integration with Metro & Railway Junction"
    },
    {
        id: 10,
        code: "P10",
        name: "Urban Flood Early Warning LiDAR & Stormwater Sensor Grid",
        sector: "Climate Resilience",
        capex: 75,
        opex: 7,
        sroiPct: 30.2,
        citizens: 12.0,
        co2: 3,
        lock: "auto",
        note: "Requires P1 (ICCC) for real-time flood gate actuation"
    },
    {
        id: 11,
        code: "P11",
        name: "Dedicated Grade-Separated CNG/Diesel BRT Corridor",
        sector: "Urban Mobility",
        capex: 185,
        opex: 24,
        sroiPct: 21.5,
        citizens: 10.0,
        co2: 8,
        lock: "auto",
        note: "Mutually exclusive with P3 (100% Electric Bus Fleet)"
    },
    {
        id: 12,
        code: "P12",
        name: "Smart Tele-Medicine Dispensaries & Digital Classroom Network",
        sector: "Social Infrastructure",
        capex: 55,
        opex: 9,
        sroiPct: 29.4,
        citizens: 8.5,
        co2: 2,
        lock: "auto",
        note: "Low CAPEX human-capital multiplier across municipal wards"
    }
];

function computeSocialValue(capex, sroiPct) {
    return +(capex * (sroiPct / 10)).toFixed(1);
}

// API Client Helper
function getApiBase() {
    if (window.location.protocol.startsWith('http')) {
        return window.location.origin + '/api';
    }
    return 'http://localhost:3000/api';
}

const api = {
    async checkHealth() {
        try {
            const res = await fetch(`${getApiBase()}/health`, { method: 'GET', headers: { 'Accept': 'application/json' } });
            if (res.ok) {
                const data = await res.json();
                return data.status === 'ok';
            }
        } catch (e) {
            // Server offline
        }
        return false;
    },
    async getProjects() {
        const res = await fetch(`${getApiBase()}/projects`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data.projects || [];
    },
    async createProject(projectData) {
        const res = await fetch(`${getApiBase()}/projects`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(projectData)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data.project;
    },
    async updateProject(id, projectData) {
        const res = await fetch(`${getApiBase()}/projects/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(projectData)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data.project;
    },
    async deleteProject(id) {
        const res = await fetch(`${getApiBase()}/projects/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return true;
    },
    async resetProjects() {
        const res = await fetch(`${getApiBase()}/projects/reset`, { method: 'POST' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data.projects || [];
    },
    async optimize(payload) {
        const res = await fetch(`${getApiBase()}/optimize`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return data.solution;
    }
};

// Check Backend Connectivity
async function checkBackendConnection() {
    const isOnline = await api.checkHealth();
    isBackendConnected = isOnline;
    const badge = document.getElementById('backendStatusBadge');
    if (badge) {
        if (isOnline) {
            badge.className = "pill pill-cyan cursor-pointer";
            badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span> Fastify + SQLite Online`;
            badge.title = "Connected to Fastify server & smart_city.db";
        } else {
            badge.className = "pill pill-neutral cursor-pointer";
            badge.innerHTML = `<span class="w-1.5 h-1.5 rounded-full bg-slate-500"></span> Standalone Mode`;
            badge.title = "Fastify backend offline. Running local client solver.";
        }
    }
    return isOnline;
}

// Load Projects from DB or Fallback
async function loadProjects() {
    const connected = await checkBackendConnection();
    if (connected) {
        try {
            const list = await api.getProjects();
            if (list && list.length > 0) {
                projects = list;
                projects.forEach(p => { p.socialValue = computeSocialValue(p.capex, p.sroiPct); });
                updateSidebarCount();
                return;
            }
        } catch (e) {
            console.warn('Could not load from backend, using canonical fallback:', e);
        }
    }
    projects = JSON.parse(JSON.stringify(CANONICAL_PROJECTS));
    projects.forEach(p => { p.socialValue = computeSocialValue(p.capex, p.sroiPct); });
    updateSidebarCount();
}

function updateSidebarCount() {
    const el = document.getElementById('sidebarProjectCount');
    if (el) el.textContent = projects.length;
}

// Navigation Router
function navigateTo(pageId) {
    activePage = pageId;

    // Hide all pages, show target
    document.querySelectorAll('.page-view').forEach(p => p.classList.add('hidden'));
    const target = document.getElementById(`page-${pageId}`);
    if (target) target.classList.remove('hidden');

    // Update nav links active class
    document.querySelectorAll('.nav-link').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`nav-${pageId}`);
    if (activeBtn) activeBtn.classList.add('active');

    // Update Top bar breadcrumb & title
    const breadcrumb = document.getElementById('breadcrumbCurrent');
    const title = document.getElementById('topBarTitle');

    const meta = {
        overview: { breadcrumb: "Overview", title: "Executive Overview & Impact Summary" },
        projects: { breadcrumb: "Projects", title: "Infrastructure Project Management Studio" },
        optimization: { breadcrumb: "Optimization", title: "Operations Research 0-1 ILP Workspace" },
        results: { breadcrumb: "Results & Insights", title: "Optimal Portfolio Insights & Analysis" },
        methodology: { breadcrumb: "Methodology", title: "Academic Mathematical Model & Formulation" }
    };

    if (meta[pageId]) {
        if (breadcrumb) breadcrumb.textContent = meta[pageId].breadcrumb;
        if (title) title.textContent = meta[pageId].title;
    }

    if (pageId === 'overview') {
        setTimeout(renderOverviewCharts, 50);
    } else if (pageId === 'optimization') {
        setTimeout(drawParetoChart, 60);
    }

    triggerKaTeX();
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('hidden');
    }
}

// Get Active Constraints
function getActiveConstraints() {
    return {
        maxCapex: parseFloat(document.getElementById('sliderCapex').value) || 850,
        maxOpex: parseFloat(document.getElementById('sliderOpex').value) || 95,
        minCO2: parseFloat(document.getElementById('sliderMinCO2').value) || 45,
        minPop: parseFloat(document.getElementById('sliderMinPop').value) || 15,
        depICCC: document.getElementById('chkDependencyICCC').checked,
        exclTransit: document.getElementById('chkExclusivityTransit').checked,
        sectorFloor: document.getElementById('chkSectorFloor').checked,
        solarEbusDep: document.getElementById('chkSolarEbusDep').checked
    };
}

// Client-Side Branch & Bound Solver (Dual-Engine Fallback)
function solveILPLocal(projList, constraints, recordTrace = true) {
    const t0 = performance.now();
    const n = projList.length;

    projList.forEach(p => {
        p.socialValue = computeSocialValue(p.capex, p.sroiPct);
    });

    const idxByCode = {};
    projList.forEach((p, idx) => { idxByCode[p.code] = idx; });

    const sortedIndices = projList.map((_, idx) => idx).sort((a, b) => {
        const denB = projList[b].capex > 0 ? (projList[b].socialValue / projList[b].capex) : 0;
        const denA = projList[a].capex > 0 ? (projList[a].socialValue / projList[a].capex) : 0;
        return denB - denA;
    });

    let bestObj = -1;
    let bestSelection = new Array(n).fill(0);
    let nodesExplored = 0;
    let prunedByBound = 0;
    let prunedByInfeas = 0;
    let incumbentsFound = 0;
    const traceLogs = [];

    const remCO2 = new Array(n + 1).fill(0);
    const remPop = new Array(n + 1).fill(0);
    const remWater = new Array(n + 1).fill(0);
    const remEnergy = new Array(n + 1).fill(0);

    for (let k = n - 1; k >= 0; k--) {
        const origIdx = sortedIndices[k];
        const canPick = projList[origIdx].lock !== 0;
        remCO2[k] = remCO2[k + 1] + (canPick ? projList[origIdx].co2 : 0);
        remPop[k] = remPop[k + 1] + (canPick ? projList[origIdx].citizens : 0);
        remWater[k] = remWater[k + 1] + (canPick && projList[origIdx].sector === "Water & Sanitation" ? 1 : 0);
        remEnergy[k] = remEnergy[k + 1] + (canPick && projList[origIdx].sector === "Clean Energy" ? 1 : 0);
    }

    function computeLPBound(level, curCapex, curObj) {
        let remBudget = Math.max(0, constraints.maxCapex - curCapex);
        let bound = curObj;
        for (let k = level; k < n; k++) {
            const idx = sortedIndices[k];
            const p = projList[idx];
            if (p.lock === 0) continue;
            if (p.capex <= remBudget) {
                remBudget -= p.capex;
                bound += p.socialValue;
            } else if (p.capex > 0) {
                bound += p.socialValue * (remBudget / p.capex);
                break;
            }
        }
        return bound;
    }

    function checkLogicalFeasibility(x, isComplete) {
        const iP1 = idxByCode["P1"];
        const iP2 = idxByCode["P2"];
        const iP3 = idxByCode["P3"];
        const iP5 = idxByCode["P5"];
        const iP10 = idxByCode["P10"];
        const iP11 = idxByCode["P11"];

        if (constraints.depICCC && iP1 !== undefined) {
            if (iP5 !== undefined) {
                if (x[iP5] === 1 && x[iP1] === 0) return false;
                if (x[iP5] === 1 && projList[iP1].lock === 0) return false;
            }
            if (iP10 !== undefined) {
                if (x[iP10] === 1 && x[iP1] === 0) return false;
                if (x[iP10] === 1 && projList[iP1].lock === 0) return false;
            }
        }

        if (constraints.exclTransit && iP3 !== undefined && iP11 !== undefined) {
            if (x[iP3] === 1 && x[iP11] === 1) return false;
        }

        if (constraints.solarEbusDep && iP2 !== undefined && iP3 !== undefined) {
            if (x[iP3] === 1 && x[iP2] === 0) return false;
            if (x[iP3] === 1 && projList[iP2].lock === 0) return false;
        }

        if (isComplete && constraints.sectorFloor) {
            let hasWater = false, hasEnergy = false;
            for (let i = 0; i < n; i++) {
                if (x[i] === 1) {
                    if (projList[i].sector === "Water & Sanitation") hasWater = true;
                    if (projList[i].sector === "Clean Energy") hasEnergy = true;
                }
            }
            if (!hasWater || !hasEnergy) return false;
        }

        return true;
    }

    const currentX = new Array(n).fill(-1);

    function branch(level, curCapex, curOpex, curObj, curCO2, curPop, curWaterCount, curEnergyCount) {
        nodesExplored++;

        if (curCapex > constraints.maxCapex || curOpex > constraints.maxOpex) {
            prunedByInfeas++;
            return;
        }

        if (curCO2 + remCO2[level] < constraints.minCO2 || curPop + remPop[level] < constraints.minPop) {
            prunedByInfeas++;
            return;
        }

        if (constraints.sectorFloor) {
            if (curWaterCount + remWater[level] < 1 || curEnergyCount + remEnergy[level] < 1) {
                prunedByInfeas++;
                return;
            }
        }

        if (!checkLogicalFeasibility(currentX, false)) {
            prunedByInfeas++;
            return;
        }

        if (level === n) {
            if (curCO2 >= constraints.minCO2 &&
                curPop >= constraints.minPop &&
                checkLogicalFeasibility(currentX, true)) {
                if (curObj > bestObj) {
                    bestObj = curObj;
                    bestSelection = [...currentX];
                    incumbentsFound++;
                    if (recordTrace) {
                        const selectedCodes = projList.filter((_, i) => currentX[i] === 1).map(p => p.code).join(",");
                        traceLogs.push({
                            type: "incumbent",
                            node: nodesExplored,
                            msg: `[Node #${nodesExplored}] Incumbent Z* = ₹${curObj.toFixed(1)} Cr (CAPEX: ₹${curCapex} Cr) -> {${selectedCodes}}`
                        });
                    }
                }
            } else {
                prunedByInfeas++;
            }
            return;
        }

        const lpBound = computeLPBound(level, curCapex, curObj);
        if (lpBound <= bestObj + 1e-5) {
            prunedByBound++;
            if (recordTrace && prunedByBound <= 10) {
                traceLogs.push({
                    type: "bound",
                    node: nodesExplored,
                    msg: `[Node #${nodesExplored}] Pruned depth ${level}: LP Bound (₹${lpBound.toFixed(1)} Cr) ≤ Incumbent Z* (₹${bestObj.toFixed(1)} Cr)`
                });
            }
            return;
        }

        const origIdx = sortedIndices[level];
        const proj = projList[origIdx];

        let choices = [1, 0];
        if (proj.lock === 1 || proj.lock === '1') choices = [1];
        else if (proj.lock === 0 || proj.lock === '0') choices = [0];

        const isWater = proj.sector === "Water & Sanitation" ? 1 : 0;
        const isEnergy = proj.sector === "Clean Energy" ? 1 : 0;

        for (const val of choices) {
            currentX[origIdx] = val;
            if (val === 1) {
                branch(
                    level + 1,
                    curCapex + proj.capex,
                    curOpex + proj.opex,
                    curObj + proj.socialValue,
                    curCO2 + proj.co2,
                    curPop + proj.citizens,
                    curWaterCount + isWater,
                    curEnergyCount + isEnergy
                );
            } else {
                branch(
                    level + 1,
                    curCapex,
                    curOpex,
                    curObj,
                    curCO2,
                    curPop,
                    curWaterCount,
                    curEnergyCount
                );
            }
        }
        currentX[origIdx] = -1;
    }

    branch(0, 0, 0, 0, 0, 0, 0, 0);

    const solveTimeMs = +(performance.now() - t0).toFixed(2);
    const rootLPBound = computeLPBound(0, 0, 0);
    const greedy = solveGreedyHeuristic(projList, constraints, idxByCode);

    return {
        feasible: bestObj >= 0,
        bestObj: bestObj >= 0 ? +bestObj.toFixed(1) : 0,
        selection: bestSelection,
        selectedCodes: projList.filter((_, i) => bestSelection[i] === 1).map(p => p.code),
        nodesExplored,
        prunedByBound,
        prunedByInfeas,
        incumbentsFound,
        totalSpace: Math.pow(2, n),
        solveTimeMs,
        rootLPBound: +rootLPBound.toFixed(1),
        traceLogs,
        greedy
    };
}

// Client Greedy Heuristic
function solveGreedyHeuristic(projList, constraints, idxByCode) {
    const n = projList.length;
    const greedyX = new Array(n).fill(0);
    let gCapex = 0, gOpex = 0, gObj = 0, gCO2 = 0, gPop = 0;

    for (let i = 0; i < n; i++) {
        if (projList[i].lock === 1 || projList[i].lock === '1') {
            greedyX[i] = 1;
            gCapex += projList[i].capex;
            gOpex += projList[i].opex;
            gObj += projList[i].socialValue;
            gCO2 += projList[i].co2;
            gPop += projList[i].citizens;
        }
    }

    const candidates = projList
        .map((p, i) => ({ p, i }))
        .filter(item => item.p.lock === 'auto' || item.p.lock === undefined)
        .sort((a, b) => b.p.sroiPct - a.p.sroiPct);

    for (const { p, i } of candidates) {
        if (gCapex + p.capex > constraints.maxCapex) continue;
        if (gOpex + p.opex > constraints.maxOpex) continue;

        const iP1 = idxByCode["P1"];
        const iP2 = idxByCode["P2"];
        const iP3 = idxByCode["P3"];
        const iP11 = idxByCode["P11"];

        if (constraints.depICCC && (p.code === "P5" || p.code === "P10") && iP1 !== undefined && greedyX[iP1] === 0) continue;
        if (constraints.exclTransit && p.code === "P11" && iP3 !== undefined && greedyX[iP3] === 1) continue;
        if (constraints.exclTransit && p.code === "P3" && iP11 !== undefined && greedyX[iP11] === 1) continue;
        if (constraints.solarEbusDep && p.code === "P3" && iP2 !== undefined && greedyX[iP2] === 0) continue;

        greedyX[i] = 1;
        gCapex += p.capex;
        gOpex += p.opex;
        gObj += p.socialValue;
        gCO2 += p.co2;
        gPop += p.citizens;
    }

    let hasWater = false, hasEnergy = false;
    for (let i = 0; i < n; i++) {
        if (greedyX[i] === 1) {
            if (projList[i].sector === "Water & Sanitation") hasWater = true;
            if (projList[i].sector === "Clean Energy") hasEnergy = true;
        }
    }

    const meetsFloors = gCO2 >= constraints.minCO2 &&
                        gPop >= constraints.minPop &&
                        (!constraints.sectorFloor || (hasWater && hasEnergy)) &&
                        gCapex <= constraints.maxCapex &&
                        gOpex <= constraints.maxOpex;

    return {
        selection: greedyX,
        obj: +gObj.toFixed(1),
        capex: gCapex,
        opex: gOpex,
        meetsFloors
    };
}

// Execute Optimization with Animated State
async function executeOptimizationWithLoading() {
    const btn = document.getElementById('btnTopRunOpt');
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Solving ILP...`;
        btn.disabled = true;
    }

    await runOptimization(true);

    if (btn) {
        btn.innerHTML = origHtml;
        btn.disabled = false;
    }
}

// Master Optimization Controller
async function runOptimization(notify = false) {
    const constraints = getActiveConstraints();
    let sol = null;

    if (isBackendConnected) {
        try {
            sol = await api.optimize({
                scenarioName: currentScenario,
                ...constraints,
                projects
            });
        } catch (e) {
            console.warn('Backend optimize call failed, falling back to local solver:', e);
        }
    }

    if (!sol) {
        sol = solveILPLocal(projects, constraints, true);
    }

    lastSolution = sol;
    setStale(false);

    // Update all views
    updateOverviewKPIs(sol, constraints);
    renderProjectTableAndCards();
    renderOverviewCharts();
    renderResultsPage(sol, constraints);
    renderOptimizationWorkspace(sol, constraints);

    if (activePage === 'optimization') {
        drawParetoChart();
    }

    triggerKaTeX();

    if (notify) {
        if (sol.feasible) {
            showToast(`Optimal 0-1 ILP Solved in ${sol.solveTimeMs} ms — Net Social Value: ₹${sol.bestObj.toFixed(1)} Cr`, 'cyan');
        } else {
            showToast(`Infeasible Constraints: Relax budget or reduce minimum target floors.`, 'rose');
        }
    }
}

// Stale State Tracking
function setStale(stale) {
    isStale = stale;
    const el = document.getElementById('staleIndicator');
    if (el) {
        if (stale) el.classList.remove('hidden');
        else el.classList.add('hidden');
    }
}

function onConstraintChange() {
    const c = getActiveConstraints();
    document.getElementById('lblCapexBudget').textContent = `₹${c.maxCapex} Cr`;
    document.getElementById('lblOpexBudget').textContent = `₹${c.maxOpex} Cr/yr`;
    document.getElementById('lblMinCO2').textContent = `${c.minCO2} kT CO₂/yr`;
    document.getElementById('lblMinPop').textContent = `${c.minPop.toFixed(1)} Lakhs`;

    setStale(true);
    runOptimization(false);
}

// Update Overview Dashboard KPIs
function updateOverviewKPIs(sol, constraints) {
    let selCapex = 0, selOpex = 0, selCO2 = 0, selPop = 0, selCount = 0, weightedSROI = 0;

    if (sol.feasible) {
        projects.forEach((p, i) => {
            if (sol.selection[i] === 1) {
                selCapex += p.capex;
                selOpex += p.opex;
                selCO2 += p.co2;
                selPop += p.citizens;
                selCount++;
                weightedSROI += p.capex * p.sroiPct;
            }
        });
    }

    const avgSROI = selCapex > 0 ? (weightedSROI / selCapex) : 0;
    const utilPct = Math.min(100, (selCapex / constraints.maxCapex) * 100);
    const slack = Math.max(0, constraints.maxCapex - selCapex);

    // KPI 1: Budget
    document.getElementById('kpiOverviewBudget').textContent = `₹${constraints.maxCapex} Cr`;

    // KPI 2: Total Projects
    document.getElementById('kpiOverviewTotalProjects').textContent = projects.length;

    // KPI 3: Funded Subset
    document.getElementById('kpiOverviewFundedCount').textContent = sol.feasible ? `${selCount} / ${projects.length}` : '0 Funded';

    // KPI 4: Capital Outlay & Slack
    document.getElementById('kpiOverviewOutlay').textContent = `₹${selCapex} Cr`;
    document.getElementById('kpiOverviewSlack').textContent = `Slack: ₹${slack} Cr`;

    // KPI 5: Social Value & SROI
    document.getElementById('kpiOverviewSocialValue').textContent = sol.feasible ? `₹${sol.bestObj.toFixed(1)} Cr` : 'Infeasible';
    document.getElementById('kpiOverviewAvgSROI').textContent = `Weighted SROI: ${avgSROI.toFixed(1)}%`;

    // KPI 6: Utilization %
    document.getElementById('kpiOverviewUtil').textContent = `${utilPct.toFixed(1)}%`;
    document.getElementById('kpiOverviewUtilBar').style.width = `${utilPct}%`;

    // Summary Strip
    document.getElementById('overviewSolveTime').textContent = `${sol.solveTimeMs} ms`;
    document.getElementById('overviewNodes').textContent = sol.nodesExplored;
    document.getElementById('sumCapexText').textContent = `₹${selCapex} Cr (${utilPct.toFixed(1)}%)`;
    document.getElementById('sumOpexText').textContent = `₹${selOpex} Cr / ₹${constraints.maxOpex} Cr/yr`;
    document.getElementById('sumCO2Text').textContent = `${selCO2} kT CO₂/yr`;
    document.getElementById('sumPopText').textContent = `${selPop.toFixed(1)} Lakh Citizens`;

    const solverBadge = document.getElementById('overviewSolverBadge');
    if (sol.feasible) {
        solverBadge.className = 'pill pill-emerald text-[10px]';
        solverBadge.textContent = 'Proven Global Optimum';
    } else {
        solverBadge.className = 'pill pill-rose text-[10px]';
        solverBadge.textContent = 'Infeasible Constraints';
    }
}

// Render Project Management (Table & Cards)
function renderProjectTableAndCards() {
    const tbody = document.getElementById('projectTableBody');
    const cardsContainer = document.getElementById('projectCardsViewContainer');
    if (!tbody) return;

    const query = (document.getElementById('projectSearchInput')?.value || '').toLowerCase().trim();
    const sectorFilter = document.getElementById('projectSectorFilter')?.value || 'ALL';
    const sortOption = document.getElementById('projectSortOption')?.value || 'ID_ASC';

    // Filter projects
    let list = projects.map((p, idx) => ({ p, idx }));

    if (query) {
        list = list.filter(({ p }) => p.name.toLowerCase().includes(query) || p.code.toLowerCase().includes(query) || (p.note || '').toLowerCase().includes(query));
    }
    if (sectorFilter !== 'ALL') {
        list = list.filter(({ p }) => p.sector === sectorFilter);
    }

    // Sort projects
    list.sort((a, b) => {
        if (sortOption === 'CAPEX_DESC') return b.p.capex - a.p.capex;
        if (sortOption === 'CAPEX_ASC') return a.p.capex - b.p.capex;
        if (sortOption === 'SROI_DESC') return b.p.sroiPct - a.p.sroiPct;
        if (sortOption === 'SOCIAL_DESC') return b.p.socialValue - a.p.socialValue;
        return a.p.id - b.p.id;
    });

    let tableHtml = '';
    let cardsHtml = '';

    list.forEach(({ p, idx }) => {
        const isSelected = lastSolution && lastSolution.feasible && lastSolution.selection[idx] === 1;
        const style = SECTOR_PALETTE[p.sector] || SECTOR_PALETTE["Digital Governance"];

        // Table Row HTML
        tableHtml += `
        <tr class="${isSelected ? 'row-selected' : ''}">
            <td class="font-mono font-bold ${isSelected ? 'text-cyan-400' : 'text-slate-500'}">
                ${p.code}
            </td>
            <td>
                <div class="font-semibold ${isSelected ? 'text-white' : 'text-slate-300'}">${p.name}</div>
                <div class="flex flex-wrap items-center gap-2 mt-1">
                    <span class="pill ${style.pill} text-[10px]">${p.sector}</span>
                    <span class="text-[11px] text-slate-500">${p.note || ''}</span>
                </div>
            </td>
            <td class="text-right font-mono font-semibold text-white">₹${p.capex} Cr</td>
            <td class="text-right font-mono text-indigo-300">₹${p.opex} Cr</td>
            <td class="text-right font-mono text-amber-300">${p.sroiPct}%</td>
            <td class="text-right font-mono font-bold ${isSelected ? 'text-cyan-300' : 'text-slate-400'}">
                ₹${p.socialValue.toFixed(1)} Cr
            </td>
            <td class="text-right font-mono text-[11px] text-slate-300">
                <span>${p.citizens}L</span> • <span class="text-emerald-400">${p.co2}kT</span>
            </td>
            <td class="text-center">
                <select onchange="updateProjectLock(${idx}, this.value)"
                    class="clean-input text-[11px] font-mono py-1 px-2 ${p.lock !== 'auto' ? 'border-amber-500/60 text-amber-300' : 'text-slate-300'}">
                    <option value="auto" ${p.lock === 'auto' ? 'selected' : ''}>Auto</option>
                    <option value="1" ${p.lock === 1 || p.lock === '1' ? 'selected' : ''}>Force x=1</option>
                    <option value="0" ${p.lock === 0 || p.lock === '0' ? 'selected' : ''}>Force x=0</option>
                </select>
            </td>
            <td class="text-center">
                ${isSelected
                    ? `<span class="pill pill-emerald"><i class="fa-solid fa-check text-[10px]"></i> Funded</span>`
                    : `<span class="pill pill-neutral text-slate-500">Unfunded</span>`
                }
            </td>
            <td class="text-center">
                <div class="flex items-center justify-center gap-1.5">
                    <button onclick="openEditProjectModal(${idx})" class="text-slate-400 hover:text-cyan-400 p-1" title="Edit project">
                        <i class="fa-solid fa-pen text-xs"></i>
                    </button>
                    <button onclick="deleteProjectAction(${idx})" class="text-slate-400 hover:text-rose-400 p-1" title="Delete project">
                        <i class="fa-solid fa-trash-can text-xs"></i>
                    </button>
                </div>
            </td>
        </tr>`;

        // Card Grid HTML
        cardsHtml += `
        <div class="glass-panel p-4 flex flex-col justify-between ${isSelected ? 'border-cyan-500/50 shadow-cyan-500/10' : ''}">
            <div>
                <div class="flex items-start justify-between gap-2 mb-2">
                    <span class="font-mono text-xs font-bold text-cyan-400">${p.code}</span>
                    <span class="pill ${style.pill} text-[10px]">${p.sector}</span>
                </div>
                <h4 class="font-bold text-sm text-white leading-snug">${p.name}</h4>
                <p class="text-[11px] text-slate-400 mt-1 line-clamp-2">${p.note || 'Candidate smart infrastructure project'}</p>
            </div>

            <div class="mt-4 pt-3 border-t border-slate-800/80 space-y-2 text-xs">
                <div class="flex justify-between font-mono">
                    <span class="text-slate-400">CAPEX: <strong class="text-white">₹${p.capex} Cr</strong></span>
                    <span class="text-slate-400">OPEX: <strong class="text-indigo-300">₹${p.opex} Cr/yr</strong></span>
                </div>
                <div class="flex justify-between font-mono">
                    <span class="text-slate-400">SROI Rate: <strong class="text-amber-300">${p.sroiPct}%</strong></span>
                    <span class="text-slate-400">Net Social: <strong class="text-cyan-300">₹${p.socialValue.toFixed(1)} Cr</strong></span>
                </div>
                <div class="flex items-center justify-between pt-2 border-t border-slate-800/50">
                    <div class="flex items-center gap-2">
                        ${isSelected
                            ? `<span class="pill pill-emerald text-[10px]"><i class="fa-solid fa-check"></i> Funded (x=1)</span>`
                            : `<span class="pill pill-neutral text-[10px]">Unfunded (x=0)</span>`
                        }
                    </div>
                    <div class="flex items-center gap-2">
                        <button onclick="openEditProjectModal(${idx})" class="btn-secondary text-[10px] py-1 px-2">Edit</button>
                        <button onclick="deleteProjectAction(${idx})" class="text-slate-500 hover:text-rose-400 p-1"><i class="fa-solid fa-trash-can"></i></button>
                    </div>
                </div>
            </div>
        </div>`;
    });

    tbody.innerHTML = tableHtml || `<tr><td colspan="10" class="py-8 text-center text-slate-500">No projects match the search filter.</td></tr>`;
    if (cardsContainer) cardsContainer.innerHTML = cardsHtml;
}

function applyProjectFilters() {
    renderProjectTableAndCards();
}

function setProjectViewMode(mode) {
    projectViewMode = mode;
    const tableContainer = document.getElementById('projectTableViewContainer');
    const cardsContainer = document.getElementById('projectCardsViewContainer');
    const btnTable = document.getElementById('btnViewTable');
    const btnCards = document.getElementById('btnViewCards');

    if (mode === 'table') {
        tableContainer?.classList.remove('hidden');
        cardsContainer?.classList.add('hidden');
        btnTable?.classList.add('bg-cyan-500/20', 'text-cyan-300');
        btnCards?.classList.remove('bg-cyan-500/20', 'text-cyan-300');
    } else {
        tableContainer?.classList.add('hidden');
        cardsContainer?.classList.remove('hidden');
        btnCards?.classList.add('bg-cyan-500/20', 'text-cyan-300');
        btnTable?.classList.remove('bg-cyan-500/20', 'text-cyan-300');
    }
}

// Update Policy Lock
async function updateProjectLock(idx, val) {
    projects[idx].lock = val === 'auto' ? 'auto' : parseInt(val, 10);
    setStale(true);

    if (isBackendConnected && projects[idx].id) {
        try {
            await api.updateProject(projects[idx].id, { lock: projects[idx].lock });
        } catch (e) {
            console.warn('Failed to sync lock to backend:', e);
        }
    }

    runOptimization(true);
}

// Modal Handlers: Add Project
function openAddProjectModal() {
    const modal = document.getElementById('addProjectModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeAddProjectModal() {
    const modal = document.getElementById('addProjectModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

async function handleFormSubmitAddProject(e) {
    e.preventDefault();
    const name = document.getElementById('newProjName').value.trim();
    const sector = document.getElementById('newProjSector').value;
    const capex = parseFloat(document.getElementById('newProjCapex').value);
    const opex = parseFloat(document.getElementById('newProjOpex').value);
    const sroiPct = parseFloat(document.getElementById('newProjSROI').value);
    const citizens = parseFloat(document.getElementById('newProjPop').value);
    const co2 = parseFloat(document.getElementById('newProjCO2').value);

    if (!name || isNaN(capex) || capex <= 0 || isNaN(opex) || opex < 0 || isNaN(sroiPct) || sroiPct <= 0) {
        alert('Please fill all required project parameters with valid positive numbers.');
        return;
    }

    const nextId = projects.length + 1;
    const newProjData = {
        code: `P${nextId}`,
        name,
        sector,
        capex,
        opex,
        sroiPct,
        socialValue: computeSocialValue(capex, sroiPct),
        citizens: isNaN(citizens) ? 5 : citizens,
        co2: isNaN(co2) ? 10 : co2,
        lock: "auto",
        note: "Custom municipal initiative"
    };

    if (isBackendConnected) {
        try {
            const created = await api.createProject(newProjData);
            if (created) {
                projects.push(created);
                closeAddProjectModal();
                updateSidebarCount();
                showToast(`Project ${created.code} added to SQLite database & re-optimized`, 'cyan');
                setStale(false);
                runOptimization(true);
                return;
            }
        } catch (err) {
            console.warn('Backend creation failed, adding locally:', err);
        }
    }

    newProjData.id = nextId;
    projects.push(newProjData);
    closeAddProjectModal();
    updateSidebarCount();
    showToast(`Project ${newProjData.code} added to portfolio & re-optimized`, 'cyan');
    setStale(false);
    runOptimization(true);
}

// Modal Handlers: Edit Project
function openEditProjectModal(idx) {
    const p = projects[idx];
    if (!p) return;

    document.getElementById('editProjIndex').value = idx;
    document.getElementById('editProjName').value = p.name;
    document.getElementById('editProjSector').value = p.sector;
    document.getElementById('editProjCapex').value = p.capex;
    document.getElementById('editProjOpex').value = p.opex;
    document.getElementById('editProjSROI').value = p.sroiPct;
    document.getElementById('editProjPop').value = p.citizens;
    document.getElementById('editProjCO2').value = p.co2;

    const modal = document.getElementById('editProjectModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

function closeEditProjectModal() {
    const modal = document.getElementById('editProjectModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
}

async function handleFormSubmitEditProject(e) {
    e.preventDefault();
    const idx = parseInt(document.getElementById('editProjIndex').value, 10);
    const p = projects[idx];
    if (!p) return;

    const name = document.getElementById('editProjName').value.trim();
    const sector = document.getElementById('editProjSector').value;
    const capex = parseFloat(document.getElementById('editProjCapex').value);
    const opex = parseFloat(document.getElementById('editProjOpex').value);
    const sroiPct = parseFloat(document.getElementById('editProjSROI').value);
    const citizens = parseFloat(document.getElementById('editProjPop').value);
    const co2 = parseFloat(document.getElementById('editProjCO2').value);

    if (!name || isNaN(capex) || capex <= 0 || isNaN(opex) || opex < 0 || isNaN(sroiPct) || sroiPct <= 0) {
        alert('Please specify valid positive numbers.');
        return;
    }

    p.name = name;
    p.sector = sector;
    p.capex = capex;
    p.opex = opex;
    p.sroiPct = sroiPct;
    p.socialValue = computeSocialValue(capex, sroiPct);
    p.citizens = citizens;
    p.co2 = co2;

    if (isBackendConnected && p.id) {
        try {
            await api.updateProject(p.id, {
                name, sector, capex, opex, sroiPct, socialValue: p.socialValue, citizens, co2
            });
        } catch (err) {
            console.warn('Backend update failed:', err);
        }
    }

    closeEditProjectModal();
    showToast(`Updated ${p.code}: ${p.name}`, 'cyan');
    setStale(false);
    runOptimization(true);
}

// Delete Project Action
async function deleteProjectAction(idx) {
    const p = projects[idx];
    if (!p) return;

    if (!confirm(`Are you sure you want to delete ${p.code}: "${p.name}"?`)) return;

    if (isBackendConnected && p.id) {
        try {
            await api.deleteProject(p.id);
        } catch (e) {
            console.warn('Backend delete failed:', e);
        }
    }

    projects.splice(idx, 1);
    updateSidebarCount();
    showToast(`Deleted ${p.code} from portfolio`, 'amber');
    setStale(false);
    runOptimization(true);
}

// Reset Default Projects
async function resetDefaultConstraints() {
    if (isBackendConnected) {
        try {
            const list = await api.resetProjects();
            if (list) projects = list;
        } catch (e) {
            console.warn('Backend reset failed, using local canonical:', e);
            projects = JSON.parse(JSON.stringify(CANONICAL_PROJECTS));
        }
    } else {
        projects = JSON.parse(JSON.stringify(CANONICAL_PROJECTS));
    }
    projects.forEach(p => { p.socialValue = computeSocialValue(p.capex, p.sroiPct); });
    updateSidebarCount();
    applyScenario('standard');
    showToast('Restored default Smart City portfolio (12 projects)', 'cyan');
}

// Preset Scenario Manager
function applyScenario(name) {
    currentScenario = name;
    projects.forEach(p => { p.lock = "auto"; });

    document.querySelectorAll('.scenario-pill').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`scen-${name}`);
    if (activeBtn) activeBtn.classList.add('active');

    if (name === 'standard') {
        document.getElementById('sliderCapex').value = 850;
        document.getElementById('sliderOpex').value = 95;
        document.getElementById('sliderMinCO2').value = 45;
        document.getElementById('sliderMinPop').value = 15;
        document.getElementById('chkDependencyICCC').checked = true;
        document.getElementById('chkExclusivityTransit').checked = true;
        document.getElementById('chkSectorFloor').checked = true;
        document.getElementById('chkSolarEbusDep').checked = false;
        showToast("Loaded Scenario: Standard Smart City SPV Corpus (₹850 Cr)", "cyan");
    } else if (name === 'tight') {
        document.getElementById('sliderCapex').value = 450;
        document.getElementById('sliderOpex').value = 55;
        document.getElementById('sliderMinCO2').value = 25;
        document.getElementById('sliderMinPop').value = 12;
        document.getElementById('chkDependencyICCC').checked = true;
        document.getElementById('chkExclusivityTransit').checked = true;
        document.getElementById('chkSectorFloor').checked = true;
        document.getElementById('chkSolarEbusDep').checked = false;
        showToast("Loaded Scenario: Tight Municipal Budget (₹450 Cr)", "amber");
    } else if (name === 'green') {
        document.getElementById('sliderCapex').value = 780;
        document.getElementById('sliderOpex').value = 85;
        document.getElementById('sliderMinCO2').value = 95;
        document.getElementById('sliderMinPop').value = 18;
        document.getElementById('chkDependencyICCC').checked = true;
        document.getElementById('chkExclusivityTransit').checked = true;
        document.getElementById('chkSectorFloor').checked = true;
        document.getElementById('chkSolarEbusDep').checked = true;
        showToast("Loaded Scenario: Green Climate Bonds Mandate (Min 95 kT CO₂/yr)", "emerald");
    } else if (name === 'greedytrap') {
        document.getElementById('sliderCapex').value = 510;
        document.getElementById('sliderOpex').value = 70;
        document.getElementById('sliderMinCO2').value = 30;
        document.getElementById('sliderMinPop').value = 15;
        document.getElementById('chkDependencyICCC').checked = true;
        document.getElementById('chkExclusivityTransit').checked = true;
        document.getElementById('chkSectorFloor').checked = true;
        document.getElementById('chkSolarEbusDep').checked = false;
        showToast("Greedy Trap Active: See how Exact ILP satisfies sector equity while Greedy fails!", "amber");
    }

    onConstraintChange();
}

// Toggle Demo Mode
function toggleDemoMode() {
    demoMode = !demoMode;
    const txt = document.getElementById('demoModeText');
    const btn = document.getElementById('btnDemoMode');
    if (demoMode) {
        txt.textContent = "Demo Mode: On";
        btn.classList.add('border-cyan-400', 'text-cyan-300');
        showToast("Demo Mode Activated: Academic Presentation Sequence", "indigo");
    } else {
        txt.textContent = "Demo Mode: Off";
        btn.classList.remove('border-cyan-400', 'text-cyan-300');
        showToast("Demo Mode Deactivated", "neutral");
    }
}

// Render Overview Dynamic Charts using Chart.js
function renderOverviewCharts() {
    if (typeof Chart === 'undefined') return;

    // 1. Sector Allocation Donut Chart
    const sectorCanvas = document.getElementById('chartSectorAllocation');
    if (sectorCanvas) {
        const sectorSums = {};
        projects.forEach((p, idx) => {
            if (lastSolution && lastSolution.feasible && lastSolution.selection[idx] === 1) {
                sectorSums[p.sector] = (sectorSums[p.sector] || 0) + p.capex;
            }
        });

        const labels = Object.keys(sectorSums).length > 0 ? Object.keys(sectorSums) : ["No Funded Projects"];
        const data = Object.keys(sectorSums).length > 0 ? Object.values(sectorSums) : [1];
        const colors = labels.map(l => (SECTOR_PALETTE[l] ? SECTOR_PALETTE[l].fill : "#38bdf8"));

        if (chartSectorAllocation) chartSectorAllocation.destroy();
        chartSectorAllocation = new Chart(sectorCanvas, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: colors,
                    borderColor: '#070d1e',
                    borderWidth: 2,
                    hoverOffset: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#94a3b8', font: { family: 'Inter', size: 10 }, boxWidth: 10 }
                    },
                    tooltip: {
                        callbacks: {
                            label: function (ctx) {
                                return ` ₹${ctx.parsed} Cr (${ctx.label})`;
                            }
                        }
                    }
                },
                cutout: '65%'
            }
        });
    }

    // 2. Cost vs Impact Scatter/Bar Chart
    const costImpactCanvas = document.getElementById('chartCostImpact');
    if (costImpactCanvas) {
        const labels = projects.map(p => p.code);
        const capexData = projects.map(p => p.capex);
        const socialData = projects.map(p => p.socialValue);

        if (chartCostImpact) chartCostImpact.destroy();
        chartCostImpact = new Chart(costImpactCanvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'CAPEX (₹ Cr)',
                        data: capexData,
                        backgroundColor: 'rgba(56, 189, 248, 0.4)',
                        borderColor: '#38bdf8',
                        borderWidth: 1,
                        borderRadius: 4
                    },
                    {
                        label: 'Social Value (₹ Cr)',
                        data: socialData,
                        backgroundColor: 'rgba(129, 140, 248, 0.5)',
                        borderColor: '#818cf8',
                        borderWidth: 1,
                        borderRadius: 4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 10 } }, grid: { display: false } },
                    y: { ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: 'rgba(148,163,184,0.1)' } }
                },
                plugins: {
                    legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 10 }, boxWidth: 10 } }
                }
            }
        });
    }

    // 3. Selected vs Rejected Comparison Chart
    const selRejCanvas = document.getElementById('chartSelectedVsRejected');
    if (selRejCanvas) {
        let selCapex = 0, rejCapex = 0, selSocial = 0, rejSocial = 0;
        projects.forEach((p, idx) => {
            if (lastSolution && lastSolution.feasible && lastSolution.selection[idx] === 1) {
                selCapex += p.capex;
                selSocial += p.socialValue;
            } else {
                rejCapex += p.capex;
                rejSocial += p.socialValue;
            }
        });

        if (chartSelectedVsRejected) chartSelectedVsRejected.destroy();
        chartSelectedVsRejected = new Chart(selRejCanvas, {
            type: 'bar',
            data: {
                labels: ['Funded (x=1)', 'Rejected (x=0)'],
                datasets: [
                    {
                        label: 'CAPEX (₹ Cr)',
                        data: [selCapex, rejCapex],
                        backgroundColor: ['#10b981', '#64748b'],
                        borderRadius: 6
                    },
                    {
                        label: 'Social Value (₹ Cr)',
                        data: [selSocial, rejSocial],
                        backgroundColor: ['#22d3ee', '#334155'],
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { ticks: { color: '#94a3b8', font: { family: 'Inter', size: 11 } }, grid: { display: false } },
                    y: { ticks: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 10 } }, grid: { color: 'rgba(148,163,184,0.1)' } }
                },
                plugins: {
                    legend: { labels: { color: '#94a3b8', font: { family: 'Inter', size: 10 }, boxWidth: 10 } }
                }
            }
        });
    }
}

// Render Results & Insights Page
function renderResultsPage(sol, constraints) {
    if (!sol) return;

    let selCapex = 0, selCount = 0;
    if (sol.feasible) {
        projects.forEach((p, i) => {
            if (sol.selection[i] === 1) {
                selCapex += p.capex;
                selCount++;
            }
        });
    }

    const slack = Math.max(0, constraints.maxCapex - selCapex);

    document.getElementById('resBudget').textContent = `₹${constraints.maxCapex} Cr`;
    document.getElementById('resOutlay').textContent = `₹${selCapex} Cr`;
    document.getElementById('resSlack').textContent = `₹${slack} Cr`;
    document.getElementById('resSocialValue').textContent = sol.feasible ? `₹${sol.bestObj.toFixed(1)} Cr` : 'Infeasible';
    document.getElementById('resRatio').textContent = `${selCount} / ${projects.length} (${Math.round((selCount / projects.length) * 100)}%)`;

    const statusBadge = document.getElementById('resultsStatusBadge');
    if (sol.feasible) {
        statusBadge.textContent = 'PROVEN GLOBAL OPTIMUM';
        statusBadge.className = 'pill pill-emerald text-xs';
    } else {
        statusBadge.textContent = 'INFEASIBLE SET OF CONSTRAINTS';
        statusBadge.className = 'pill pill-rose text-xs';
    }

    document.getElementById('fundedCountBadge').textContent = `${selCount} Funded`;
    document.getElementById('rejectedCountBadge').textContent = `${projects.length - selCount} Rejected`;

    // Populate Selected Projects Table
    const selectedTbody = document.getElementById('resultsSelectedTableBody');
    let selRows = '';
    projects.forEach((p, idx) => {
        if (sol.feasible && sol.selection[idx] === 1) {
            selRows += `
            <tr class="row-selected">
                <td class="font-mono font-bold text-cyan-400">${p.code}</td>
                <td class="font-medium text-white">${p.name}</td>
                <td><span class="pill pill-cyan text-[10px]">${p.sector}</span></td>
                <td class="text-right font-mono text-white">₹${p.capex} Cr</td>
                <td class="text-right font-mono text-amber-300">${p.sroiPct}%</td>
                <td class="text-right font-mono font-bold text-emerald-400">₹${p.socialValue.toFixed(1)} Cr</td>
            </tr>`;
        }
    });
    selectedTbody.innerHTML = selRows || `<tr><td colspan="6" class="text-center py-6 text-slate-500">No projects funded under current constraints.</td></tr>`;

    // Populate Rejected Projects Table
    const rejectedTbody = document.getElementById('resultsRejectedTableBody');
    let rejRows = '';
    projects.forEach((p, idx) => {
        if (!sol.feasible || sol.selection[idx] === 0) {
            let reason = "Exceeded budget ceiling under knapsack density";
            if (p.lock === 0 || p.lock === '0') reason = "Policy lock override (Force x=0)";
            else if (constraints.exclTransit && (p.code === 'P11' && sol.selection[projects.findIndex(x => x.code === 'P3')] === 1)) {
                reason = "Mutually exclusive with funded Electric Bus Fleet (P3)";
            } else if (constraints.depICCC && (p.code === 'P5' || p.code === 'P10') && sol.selection[projects.findIndex(x => x.code === 'P1')] === 0) {
                reason = "Requires unselected ICCC backbone (P1)";
            }

            rejRows += `
            <tr>
                <td class="font-mono text-slate-400">${p.code}</td>
                <td class="text-slate-300 text-xs">${p.name}</td>
                <td class="text-right font-mono text-slate-400">₹${p.capex} Cr</td>
                <td class="text-xs text-slate-400 italic">${reason}</td>
            </tr>`;
        }
    });
    rejectedTbody.innerHTML = rejRows || `<tr><td colspan="4" class="text-center py-6 text-slate-500">All projects successfully funded!</td></tr>`;

    // Mathematical Decision Vector x*
    const vectorStr = `x* = [ ${sol.feasible ? sol.selection.join(', ') : new Array(projects.length).fill(0).join(', ')} ]`;
    document.getElementById('resultsDecisionVector').textContent = vectorStr;

    // Vector pill breakdown
    const breakdownContainer = document.getElementById('resultsVectorBreakdown');
    breakdownContainer.innerHTML = projects.map((p, idx) => {
        const val = sol.feasible ? sol.selection[idx] : 0;
        return `<span class="pill ${val === 1 ? 'pill-emerald' : 'pill-neutral'}">${p.code}=${val}</span>`;
    }).join(' ');
}

// Render Optimization Workspace Diagnostics
function renderOptimizationWorkspace(sol, constraints) {
    document.getElementById('solveTimeBadge').textContent = `${sol.solveTimeMs} ms`;
    document.getElementById('bbNodesExplored').textContent = sol.nodesExplored;
    document.getElementById('bbPrunedBound').textContent = sol.prunedByBound;
    document.getElementById('bbPrunedInfeas').textContent = sol.prunedByInfeas;
    document.getElementById('bbIncumbents').textContent = sol.incumbentsFound;

    const pctPruned = Math.max(0, (1 - (sol.nodesExplored / (2 * sol.totalSpace))) * 100);
    document.getElementById('bbSearchEfficiency').textContent = `${pctPruned.toFixed(1)}% Search Space Pruned`;

    const traceBox = document.getElementById('bbTraceLog');
    let logHtml = `<div class="text-cyan-400 font-bold">[Root Node #1] Continuous Dantzig Knapsack LP Upper Bound = ₹${sol.rootLPBound.toFixed(2)} Cr</div>`;
    sol.traceLogs.forEach(entry => {
        const color = entry.type === 'incumbent' ? 'text-emerald-400 font-semibold' : 'text-slate-400';
        logHtml += `<div class="${color}">${entry.msg}</div>`;
    });
    logHtml += `<div class="text-amber-300 pt-1 border-t border-slate-800">[Terminated] Global Integer Optimum verified after ${sol.nodesExplored} subproblem nodes (${sol.solveTimeMs} ms).</div>`;
    traceBox.innerHTML = logHtml;
}

// Draw Pareto Sensitivity Frontier Canvas
function drawParetoChart() {
    const canvas = document.getElementById('paretoCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const container = canvas.parentElement;
    const rect = container.getBoundingClientRect();

    if (rect.width <= 0 || rect.height <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const W = rect.width;
    const H = rect.height;
    ctx.clearRect(0, 0, W, H);

    const baseConstraints = getActiveConstraints();
    const budgets = [];
    for (let b = 150; b <= 1650; b += 50) budgets.push(b);

    paretoPointsCache = budgets.map(b => {
        const c = { ...baseConstraints, maxCapex: b };
        const res = solveILPLocal(projects, c, false);
        return {
            budget: b,
            ilpObj: res.feasible ? res.bestObj : 0,
            greedyObj: res.greedy.meetsFloors ? res.greedy.obj : 0,
            feasible: res.feasible
        };
    });

    const padL = 65, padR = 25, padT = 25, padB = 40;
    const plotW = W - padL - padR;
    const plotH = H - padT - padB;

    if (plotW <= 0 || plotH <= 0) return;

    const maxY = Math.max(...paretoPointsCache.map(p => p.ilpObj), 500) * 1.1;
    const minX = 150, maxX = 1650;

    const toX = b => padL + ((b - minX) / (maxX - minX)) * plotW;
    const toY = v => padT + plotH - (v / maxY) * plotH;

    // Grid lines
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
    ctx.lineWidth = 1;
    ctx.font = '10px JetBrains Mono, monospace';
    ctx.fillStyle = '#64748b';

    for (let i = 0; i <= 5; i++) {
        const val = (maxY / 5) * i;
        const y = toY(val);
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(W - padR, y);
        ctx.stroke();
        ctx.fillText(`₹${Math.round(val)}Cr`, 8, y + 3);
    }

    for (let b = 200; b <= 1600; b += 200) {
        const x = toX(b);
        ctx.beginPath();
        ctx.moveTo(x, padT);
        ctx.lineTo(x, H - padB);
        ctx.stroke();
        ctx.fillText(`₹${b}`, x - 16, H - 14);
    }

    // Draw Greedy Heuristic Curve (Muted Amber Dashed)
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    paretoPointsCache.forEach((pt, idx) => {
        const x = toX(pt.budget);
        const y = toY(pt.greedyObj);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw Exact ILP Curve (Electric Cyan)
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    paretoPointsCache.forEach((pt, idx) => {
        const x = toX(pt.budget);
        const y = toY(pt.ilpObj);
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Subtle Cyan Area Glow under ILP Curve
    const grad = ctx.createLinearGradient(0, padT, 0, H - padB);
    grad.addColorStop(0, 'rgba(34, 211, 238, 0.25)');
    grad.addColorStop(1, 'rgba(34, 211, 238, 0.0)');
    ctx.fillStyle = grad;
    ctx.lineTo(toX(maxX), H - padB);
    ctx.lineTo(toX(minX), H - padB);
    ctx.closePath();
    ctx.fill();

    // Active Budget Vertical Marker
    const curB = baseConstraints.maxCapex;
    const curVal = lastSolution && lastSolution.feasible ? lastSolution.bestObj : 0;
    const cx = toX(curB);
    const cy = toY(curVal);

    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, padT);
    ctx.lineTo(cx, H - padB);
    ctx.stroke();

    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 10px JetBrains Mono, monospace';
    ctx.fillText(`Active: ₹${curB}Cr → Z*=₹${curVal.toFixed(0)}Cr`, Math.min(cx + 8, W - 220), Math.max(cy - 8, 20));
}

// Canvas Click & Hover Listeners
function setupParetoCanvasListeners() {
    const canvas = document.getElementById('paretoCanvas');
    const tooltip = document.getElementById('paretoTooltip');
    if (!canvas) return;

    canvas.addEventListener('click', function (e) {
        const rect = this.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const padL = 65, padR = 25;
        const plotW = rect.width - padL - padR;
        if (clickX < padL || clickX > rect.width - padR) return;
        const ratio = (clickX - padL) / plotW;
        const rawBudget = 150 + ratio * (1650 - 150);
        const snapped = Math.round(rawBudget / 10) * 10;
        document.getElementById('sliderCapex').value = snapped;
        onConstraintChange();
    });

    canvas.addEventListener('mousemove', function (e) {
        if (!tooltip || paretoPointsCache.length === 0) return;
        const rect = this.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const padL = 65, padR = 25;
        const plotW = rect.width - padL - padR;
        if (mouseX < padL || mouseX > rect.width - padR) {
            tooltip.style.display = 'none';
            return;
        }
        const ratio = (mouseX - padL) / plotW;
        const budget = 150 + ratio * (1650 - 150);
        let closest = paretoPointsCache[0];
        let minDist = Infinity;
        for (const pt of paretoPointsCache) {
            const dist = Math.abs(pt.budget - budget);
            if (dist < minDist) {
                minDist = dist;
                closest = pt;
            }
        }
        tooltip.style.display = 'block';
        tooltip.style.left = `${e.clientX + 14}px`;
        tooltip.style.top = `${e.clientY - 28}px`;
        tooltip.innerHTML = `<strong>Budget: ₹${closest.budget} Cr</strong><br><span style="color:#22d3ee">Exact ILP: ₹${closest.ilpObj.toFixed(1)} Cr</span><br><span style="color:#f59e0b">Greedy: ₹${closest.greedyObj.toFixed(1)} Cr</span>`;
    });

    canvas.addEventListener('mouseleave', function () {
        if (tooltip) tooltip.style.display = 'none';
    });
}

// Code & CSV Export Functions
function exportCSV() {
    let csv = "Code,Project_Name,Sector,CAPEX_Cr,OPEX_Cr,SROI_Pct,Social_Value_Cr,Citizens_Lakhs,CO2_kT,Policy_Lock,ILP_Decision\n";
    projects.forEach((p, i) => {
        const sel = lastSolution && lastSolution.feasible ? lastSolution.selection[i] : 0;
        const cleanName = `"${p.name.replace(/"/g, '""')}"`;
        csv += `${p.code},${cleanName},"${p.sector}",${p.capex},${p.opex},${p.sroiPct},${p.socialValue},${p.citizens},${p.co2},${p.lock},${sel}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = "civicgrid_smart_city_optimal_portfolio.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast("Exported Optimal Portfolio to CSV", "emerald");
}

// Toast Notifications
function showToast(message, color = 'cyan') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    const toast = document.createElement('div');
    const colorClasses = {
        cyan: 'border-cyan-400 bg-slate-900/95 text-cyan-200 shadow-cyan-500/20',
        emerald: 'border-emerald-400 bg-slate-900/95 text-emerald-200 shadow-emerald-500/20',
        amber: 'border-amber-400 bg-slate-900/95 text-amber-200 shadow-amber-500/20',
        rose: 'border-rose-400 bg-slate-900/95 text-rose-200 shadow-rose-500/20',
        neutral: 'border-slate-600 bg-slate-900/95 text-slate-300'
    };
    toast.className = `p-3 rounded-xl border border-l-4 shadow-xl text-xs font-medium flex items-center gap-2.5 transition-all duration-300 ${colorClasses[color] || colorClasses.cyan}`;
    toast.innerHTML = `<i class="fa-solid fa-circle-info"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 250);
    }, 3200);
}

// KaTeX Math Typesetting Trigger
function triggerKaTeX() {
    if (typeof renderMathInElement === 'function') {
        try {
            renderMathInElement(document.body, {
                delimiters: [
                    { left: '$$', right: '$$', display: true },
                    { left: '$', right: '$', display: false }
                ],
                throwOnError: false
            });
        } catch (e) {
            console.debug('KaTeX render note:', e);
        }
    }
}

// Escape key to close modals
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeAddProjectModal();
        closeEditProjectModal();
    }
});

// Resize listener
window.addEventListener('resize', () => {
    if (activePage === 'overview') renderOverviewCharts();
    else if (activePage === 'optimization') drawParetoChart();
});

// Initial boot
window.addEventListener('DOMContentLoaded', async () => {
    await loadProjects();
    setupParetoCanvasListeners();
    runOptimization(false);
    setTimeout(triggerKaTeX, 200);
});
