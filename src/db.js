const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DB_PATH = path.join(__dirname, '..', 'smart_city.db');

const INITIAL_PROJECTS = [
    {
        code: "P1",
        name: "Integrated Command & Control Centre (ICCC) & City Fiber",
        sector: "Digital Governance",
        capex: 115,
        opex: 14,
        sroi_pct: 24.5,
        citizens: 18.0,
        co2: 6,
        lock: "auto",
        note: "Foundational Core Backbone (Prerequisite for P5 & P10)"
    },
    {
        code: "P2",
        name: "Smart Solar Rooftop & Municipal Microgrid Network (45 MW)",
        sector: "Clean Energy",
        capex: 160,
        opex: 8,
        sroi_pct: 26.8,
        citizens: 6.5,
        co2: 38,
        lock: "auto",
        note: "High decarbonization & municipal tariff savings"
    },
    {
        code: "P3",
        name: "100% Electric Bus Fleet (250 E-Buses) & Fast-Charging Depots",
        sector: "Urban Mobility",
        capex: 240,
        opex: 26,
        sroi_pct: 28.5,
        citizens: 11.5,
        co2: 46,
        lock: "auto",
        note: "Mutually exclusive with P11 (Diesel/CNG BRT)"
    },
    {
        code: "P4",
        name: "24x7 SCADA Water Supply & Smart Ultrasonic Metering",
        sector: "Water & Sanitation",
        capex: 195,
        opex: 15,
        sroi_pct: 27.2,
        citizens: 14.0,
        co2: 9,
        lock: "auto",
        note: "Reduces Non-Revenue Water (NRW) from 42% to 15%"
    },
    {
        code: "P5",
        name: "AI-Driven Intelligent Traffic Management System (ITMS)",
        sector: "Urban Mobility",
        capex: 85,
        opex: 11,
        sroi_pct: 33.0,
        citizens: 16.5,
        co2: 18,
        lock: "auto",
        note: "Requires P1 (ICCC) to process adaptive signal feeds"
    },
    {
        code: "P6",
        name: "Automated Solid Waste Biomethanation & RFID Fleet Tracking",
        sector: "Water & Sanitation",
        capex: 130,
        opex: 18,
        sroi_pct: 25.0,
        citizens: 15.0,
        co2: 29,
        lock: "auto",
        note: "Eliminates open landfill methane emissions"
    },
    {
        code: "P7",
        name: "City-Wide LED Smart Street Lighting & CCMS Dimming",
        sector: "Clean Energy",
        capex: 65,
        opex: 5,
        sroi_pct: 31.5,
        citizens: 19.0,
        co2: 21,
        lock: "auto",
        note: "High SROI & women's pedestrian safety enhancement"
    },
    {
        code: "P8",
        name: "Transit-Oriented Affordable Rental Housing & Slum Upgradation",
        sector: "Social Infrastructure",
        capex: 210,
        opex: 12,
        sroi_pct: 23.0,
        citizens: 4.8,
        co2: 5,
        lock: "auto",
        note: "High social equity impact; capital intensive"
    },
    {
        code: "P9",
        name: "Multi-Modal Transit Hub & Non-Motorized Cycling Corridors",
        sector: "Urban Mobility",
        capex: 145,
        opex: 13,
        sroi_pct: 25.8,
        citizens: 9.2,
        co2: 16,
        lock: "auto",
        note: "Last-mile integration with Metro & Railway Junction"
    },
    {
        code: "P10",
        name: "Urban Flood Early Warning LiDAR & Stormwater Sensor Grid",
        sector: "Climate Resilience",
        capex: 75,
        opex: 7,
        sroi_pct: 30.2,
        citizens: 12.0,
        co2: 3,
        lock: "auto",
        note: "Requires P1 (ICCC) for real-time flood gate actuation"
    },
    {
        code: "P11",
        name: "Dedicated Grade-Separated CNG/Diesel BRT Corridor",
        sector: "Urban Mobility",
        capex: 185,
        opex: 24,
        sroi_pct: 21.5,
        citizens: 10.0,
        co2: 8,
        lock: "auto",
        note: "Mutually exclusive with P3 (100% Electric Bus Fleet)"
    },
    {
        code: "P12",
        name: "Smart Tele-Medicine Dispensaries & Digital Classroom Network",
        sector: "Social Infrastructure",
        capex: 55,
        opex: 9,
        sroi_pct: 29.4,
        citizens: 8.5,
        co2: 2,
        lock: "auto",
        note: "Low CAPEX human-capital multiplier across municipal wards"
    }
];

const INITIAL_SCENARIOS = [
    {
        name: "standard",
        description: "Standard Smart City SPV Corpus (₹850 Cr)",
        max_capex: 850,
        max_opex: 95,
        min_co2: 45,
        min_pop: 15,
        dep_iccc: 1,
        excl_transit: 1,
        sector_floor: 1,
        solar_ebus_dep: 0
    },
    {
        name: "tight",
        description: "Tight Municipal Budget (₹450 Cr)",
        max_capex: 450,
        max_opex: 55,
        min_co2: 25,
        min_pop: 12,
        dep_iccc: 1,
        excl_transit: 1,
        sector_floor: 1,
        solar_ebus_dep: 0
    },
    {
        name: "green",
        description: "Green Climate Bonds Mandate (Min 95 kT CO₂/yr)",
        max_capex: 780,
        max_opex: 85,
        min_co2: 95,
        min_pop: 18,
        dep_iccc: 1,
        excl_transit: 1,
        sector_floor: 1,
        solar_ebus_dep: 1
    },
    {
        name: "greedytrap",
        description: "Greedy Trap Demonstration (B&B beats greedy heuristic)",
        max_capex: 510,
        max_opex: 70,
        min_co2: 30,
        min_pop: 15,
        dep_iccc: 1,
        excl_transit: 1,
        sector_floor: 1,
        solar_ebus_dep: 0
    }
];

function computeSocialValue(capex, sroiPct) {
    return +(capex * (sroiPct / 10)).toFixed(1);
}

let dbInstance = null;

function getDb() {
    if (!dbInstance) {
        dbInstance = new DatabaseSync(DB_PATH);
        initDb(dbInstance);
    }
    return dbInstance;
}

function initDb(db) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            code TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            sector TEXT NOT NULL,
            capex REAL NOT NULL,
            opex REAL NOT NULL,
            sroi_pct REAL NOT NULL,
            social_value REAL NOT NULL,
            citizens REAL NOT NULL,
            co2 REAL NOT NULL,
            lock TEXT DEFAULT 'auto',
            note TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS scenarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            description TEXT,
            max_capex REAL NOT NULL,
            max_opex REAL NOT NULL,
            min_co2 REAL NOT NULL,
            min_pop REAL NOT NULL,
            dep_iccc INTEGER DEFAULT 1,
            excl_transit INTEGER DEFAULT 1,
            sector_floor INTEGER DEFAULT 1,
            solar_ebus_dep INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS optimization_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            scenario_name TEXT,
            max_capex REAL,
            max_opex REAL,
            min_co2 REAL,
            min_pop REAL,
            feasible INTEGER,
            optimal_value REAL,
            selected_projects TEXT,
            nodes_explored INTEGER,
            solve_time_ms REAL
        );
    `);

    // Check if projects table is populated
    const countRow = db.prepare('SELECT COUNT(*) as count FROM projects').get();
    if (countRow.count === 0) {
        seedProjects(db);
    }

    // Check if scenarios table is populated
    const scenCount = db.prepare('SELECT COUNT(*) as count FROM scenarios').get();
    if (scenCount.count === 0) {
        seedScenarios(db);
    }
}

function seedProjects(db) {
    const insert = db.prepare(`
        INSERT INTO projects (code, name, sector, capex, opex, sroi_pct, social_value, citizens, co2, lock, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const p of INITIAL_PROJECTS) {
        const sVal = computeSocialValue(p.capex, p.sroi_pct);
        insert.run(p.code, p.name, p.sector, p.capex, p.opex, p.sroi_pct, sVal, p.citizens, p.co2, p.lock, p.note);
    }
}

function seedScenarios(db) {
    const insert = db.prepare(`
        INSERT INTO scenarios (name, description, max_capex, max_opex, min_co2, min_pop, dep_iccc, excl_transit, sector_floor, solar_ebus_dep)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const s of INITIAL_SCENARIOS) {
        insert.run(s.name, s.description, s.max_capex, s.max_opex, s.min_co2, s.min_pop, s.dep_iccc, s.excl_transit, s.sector_floor, s.solar_ebus_dep);
    }
}

// Database helper functions
function getAllProjects() {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM projects ORDER BY id ASC').all();
    return rows.map(r => ({
        id: r.id,
        code: r.code,
        name: r.name,
        sector: r.sector,
        capex: Number(r.capex),
        opex: Number(r.opex),
        sroiPct: Number(r.sroi_pct),
        socialValue: Number(r.social_value),
        citizens: Number(r.citizens),
        co2: Number(r.co2),
        lock: r.lock === '1' ? 1 : (r.lock === '0' ? 0 : 'auto'),
        note: r.note
    }));
}

function getProjectById(id) {
    const db = getDb();
    const r = db.prepare('SELECT * FROM projects WHERE id = ?').get(id);
    if (!r) return null;
    return {
        id: r.id,
        code: r.code,
        name: r.name,
        sector: r.sector,
        capex: Number(r.capex),
        opex: Number(r.opex),
        sroiPct: Number(r.sroi_pct),
        socialValue: Number(r.social_value),
        citizens: Number(r.citizens),
        co2: Number(r.co2),
        lock: r.lock === '1' ? 1 : (r.lock === '0' ? 0 : 'auto'),
        note: r.note
    };
}

function createProject(data) {
    const db = getDb();
    const existing = db.prepare('SELECT MAX(id) as maxId FROM projects').get();
    const nextNum = (existing && existing.maxId ? existing.maxId : 0) + 1;
    const code = data.code || `P${nextNum}`;
    const name = data.name || `Custom Project ${nextNum}`;
    const sector = data.sector || 'Digital Governance';
    const capex = Number(data.capex) || 100;
    const opex = Number(data.opex) || 10;
    const sroiPct = Number(data.sroiPct || data.sroi_pct) || 25;
    const socialValue = computeSocialValue(capex, sroiPct);
    const citizens = Number(data.citizens) || 5;
    const co2 = Number(data.co2) || 10;
    const lock = data.lock === 1 || data.lock === '1' ? '1' : (data.lock === 0 || data.lock === '0' ? '0' : 'auto');
    const note = data.note || 'User-created custom project';

    const info = db.prepare(`
        INSERT INTO projects (code, name, sector, capex, opex, sroi_pct, social_value, citizens, co2, lock, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(code, name, sector, capex, opex, sroiPct, socialValue, citizens, co2, lock, note);

    return getProjectById(Number(info.lastInsertRowid));
}

function updateProject(id, data) {
    const db = getDb();
    const curr = getProjectById(id);
    if (!curr) return null;

    const capex = data.capex !== undefined ? Number(data.capex) : curr.capex;
    const opex = data.opex !== undefined ? Number(data.opex) : curr.opex;
    const sroiPct = data.sroiPct !== undefined ? Number(data.sroiPct) : curr.sroiPct;
    const socialValue = computeSocialValue(capex, sroiPct);
    const name = data.name !== undefined ? data.name : curr.name;
    const sector = data.sector !== undefined ? data.sector : curr.sector;
    const citizens = data.citizens !== undefined ? Number(data.citizens) : curr.citizens;
    const co2 = data.co2 !== undefined ? Number(data.co2) : curr.co2;
    const lock = data.lock !== undefined ? (data.lock === 1 || data.lock === '1' ? '1' : (data.lock === 0 || data.lock === '0' ? '0' : 'auto')) : String(curr.lock);
    const note = data.note !== undefined ? data.note : curr.note;

    db.prepare(`
        UPDATE projects
        SET name = ?, sector = ?, capex = ?, opex = ?, sroi_pct = ?, social_value = ?, citizens = ?, co2 = ?, lock = ?, note = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(name, sector, capex, opex, sroiPct, socialValue, citizens, co2, lock, note, id);

    return getProjectById(id);
}

function deleteProject(id) {
    const db = getDb();
    const info = db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    return info.changes > 0;
}

function resetProjects() {
    const db = getDb();
    db.exec('DELETE FROM projects');
    seedProjects(db);
    return getAllProjects();
}

function getAllScenarios() {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM scenarios ORDER BY id ASC').all();
    return rows.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        maxCapex: Number(r.max_capex),
        maxOpex: Number(r.max_opex),
        minCO2: Number(r.min_co2),
        minPop: Number(r.min_pop),
        depICCC: Boolean(r.dep_iccc),
        exclTransit: Boolean(r.excl_transit),
        sectorFloor: Boolean(r.sector_floor),
        solarEbusDep: Boolean(r.solar_ebus_dep)
    }));
}

function saveScenario(data) {
    const db = getDb();
    const existing = db.prepare('SELECT id FROM scenarios WHERE name = ?').get(data.name);
    if (existing) {
        db.prepare(`
            UPDATE scenarios
            SET description = ?, max_capex = ?, max_opex = ?, min_co2 = ?, min_pop = ?, dep_iccc = ?, excl_transit = ?, sector_floor = ?, solar_ebus_dep = ?
            WHERE id = ?
        `).run(
            data.description || '',
            Number(data.maxCapex),
            Number(data.maxOpex),
            Number(data.minCO2),
            Number(data.minPop),
            data.depICCC ? 1 : 0,
            data.exclTransit ? 1 : 0,
            data.sectorFloor ? 1 : 0,
            data.solarEbusDep ? 1 : 0,
            existing.id
        );
        return { id: existing.id, ...data };
    } else {
        const info = db.prepare(`
            INSERT INTO scenarios (name, description, max_capex, max_opex, min_co2, min_pop, dep_iccc, excl_transit, sector_floor, solar_ebus_dep)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            data.name,
            data.description || '',
            Number(data.maxCapex),
            Number(data.maxOpex),
            Number(data.minCO2),
            Number(data.minPop),
            data.depICCC ? 1 : 0,
            data.exclTransit ? 1 : 0,
            data.sectorFloor ? 1 : 0,
            data.solarEbusDep ? 1 : 0
        );
        return { id: Number(info.lastInsertRowid), ...data };
    }
}

function logOptimizationRun(runData) {
    const db = getDb();
    const selectedJson = JSON.stringify(runData.selectedProjects || []);
    db.prepare(`
        INSERT INTO optimization_runs (scenario_name, max_capex, max_opex, min_co2, min_pop, feasible, optimal_value, selected_projects, nodes_explored, solve_time_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        runData.scenarioName || 'Custom',
        Number(runData.maxCapex || 0),
        Number(runData.maxOpex || 0),
        Number(runData.minCO2 || 0),
        Number(runData.minPop || 0),
        runData.feasible ? 1 : 0,
        Number(runData.optimalValue || 0),
        selectedJson,
        Number(runData.nodesExplored || 0),
        Number(runData.solveTimeMs || 0)
    );
}

function getOptimizationHistory(limit = 20) {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM optimization_runs ORDER BY id DESC LIMIT ?').all(limit);
    return rows.map(r => ({
        id: r.id,
        timestamp: r.timestamp,
        scenarioName: r.scenario_name,
        maxCapex: Number(r.max_capex),
        maxOpex: Number(r.max_opex),
        minCO2: Number(r.min_co2),
        minPop: Number(r.min_pop),
        feasible: Boolean(r.feasible),
        optimalValue: Number(r.optimal_value),
        selectedProjects: JSON.parse(r.selected_projects || '[]'),
        nodesExplored: Number(r.nodes_explored),
        solveTimeMs: Number(r.solve_time_ms)
    }));
}

module.exports = {
    computeSocialValue,
    getAllProjects,
    getProjectById,
    createProject,
    updateProject,
    deleteProject,
    resetProjects,
    getAllScenarios,
    saveScenario,
    logOptimizationRun,
    getOptimizationHistory
};
