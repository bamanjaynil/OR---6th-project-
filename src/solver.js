/**
 * Exact Branch-and-Bound 0-1 Integer Linear Programming (ILP) Solver
 * for Multi-Dimensional Capital Budgeting with Social Rate of Interest (SROI)
 */

function solveILP(projList, constraints, recordTrace = true) {
    const t0 = performance.now();
    const n = projList.length;

    // Ensure socialValue is populated
    projList.forEach(p => {
        if (!p.socialValue) {
            p.socialValue = +(p.capex * (p.sroiPct / 10)).toFixed(1);
        }
    });

    // Map project codes to array indices
    const idxByCode = {};
    projList.forEach((p, idx) => { idxByCode[p.code] = idx; });

    // Sort project indices by SROI value density (socialValue / capex) descending for tighter LP bounds
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

    // Pre-calculate remaining maximum impact sums for lookahead feasibility pruning
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

    // Continuous Dantzig LP Relaxation Knapsack Bound
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

    // Logical feasibility validation
    function checkLogicalFeasibility(x, isComplete) {
        const iP1 = idxByCode["P1"];
        const iP2 = idxByCode["P2"];
        const iP3 = idxByCode["P3"];
        const iP5 = idxByCode["P5"];
        const iP10 = idxByCode["P10"];
        const iP11 = idxByCode["P11"];

        // 1. ICCC Prerequisite: x_P5 <= x_P1 and x_P10 <= x_P1
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

        // 2. Transit Mutual Exclusivity: x_P3 + x_P11 <= 1
        if (constraints.exclTransit && iP3 !== undefined && iP11 !== undefined) {
            if (x[iP3] === 1 && x[iP11] === 1) return false;
        }

        // 3. Solar + E-Bus Synergy: x_P3 <= x_P2
        if (constraints.solarEbusDep && iP2 !== undefined && iP3 !== undefined) {
            if (x[iP3] === 1 && x[iP2] === 0) return false;
            if (x[iP3] === 1 && projList[iP2].lock === 0) return false;
        }

        // 4. Sector equity floor on complete evaluation
        if (isComplete && constraints.sectorFloor) {
            let hasWater = false;
            let hasEnergy = false;
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

    // Branch-and-Bound recursive search
    function branch(level, curCapex, curOpex, curObj, curCO2, curPop, curWaterCount, curEnergyCount) {
        nodesExplored++;

        // Budget & Resource caps pruning
        if (curCapex > constraints.maxCapex || curOpex > constraints.maxOpex) {
            prunedByInfeas++;
            return;
        }

        // Floor lookahead pruning
        if (curCO2 + remCO2[level] < constraints.minCO2 || curPop + remPop[level] < constraints.minPop) {
            prunedByInfeas++;
            return;
        }

        // Sector floor lookahead pruning
        if (constraints.sectorFloor) {
            if (curWaterCount + remWater[level] < 1 || curEnergyCount + remEnergy[level] < 1) {
                prunedByInfeas++;
                return;
            }
        }

        // Partial logical pruning
        if (!checkLogicalFeasibility(currentX, false)) {
            prunedByInfeas++;
            return;
        }

        // Leaf evaluation
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
                            msg: `[Node #${nodesExplored}] New Optimal Incumbent Z* = ₹${curObj.toFixed(1)} Cr (CAPEX: ₹${curCapex} Cr) -> {${selectedCodes}}`
                        });
                    }
                }
            } else {
                prunedByInfeas++;
            }
            return;
        }

        // LP continuous relaxation upper bound pruning
        const lpBound = computeLPBound(level, curCapex, curObj);
        if (lpBound <= bestObj + 1e-5) {
            prunedByBound++;
            if (recordTrace && prunedByBound <= 10) {
                traceLogs.push({
                    type: "bound",
                    node: nodesExplored,
                    msg: `[Node #${nodesExplored}] Pruned subtree at depth ${level}: LP Bound (₹${lpBound.toFixed(1)} Cr) ≤ Best Z* (₹${bestObj.toFixed(1)} Cr)`
                });
            }
            return;
        }

        const origIdx = sortedIndices[level];
        const proj = projList[origIdx];

        // Determine choices respecting policy locks
        let choices = [1, 0];
        if (proj.lock === 1 || proj.lock === '1') {
            choices = [1];
        } else if (proj.lock === 0 || proj.lock === '0') {
            choices = [0];
        }

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

/**
 * Greedy heuristic for benchmark comparison
 */
function solveGreedyHeuristic(projList, constraints, idxByCode) {
    const n = projList.length;
    const greedyX = new Array(n).fill(0);
    let gCapex = 0, gOpex = 0, gObj = 0, gCO2 = 0, gPop = 0;

    // First take forced projects
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

    // Rank candidate projects by SROI percentage descending
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

        if (constraints.depICCC && (p.code === "P5" || p.code === "P10") && iP1 !== undefined && greedyX[iP1] === 0) {
            continue; // Greedy skips dependent projects when backbone isn't already chosen
        }
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

module.exports = {
    solveILP,
    solveGreedyHeuristic
};
