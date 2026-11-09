# Smart City Capital Budgeting & SROI ILP Optimizer

A decision-support system for Smart City Special Purpose Vehicles (SPVs) to optimize multi-million dollar public capital rationing decisions under fiscal, environmental, and technological constraints using **Exact 0-1 Integer Linear Programming (ILP)**.

---

## Architecture Overview

1. **Fastify Backend (`src/server.js`)**:
   - High-throughput Node.js microservice (`localhost:3000`).
   - CORS-enabled RESTful API supporting live browser interaction and standalone HTML clients.
   - Serves frontend static assets from `public/`.

2. **SQLite Database (`src/db.js` -> `smart_city.db`)**:
   - Zero-configuration, zero-dependency embedded database via Node 24's native `node:sqlite`.
   - Persists candidate projects, scenario definitions, policy overrides, and an audit trail of optimization runs.

3. **Operations Research ILP Engine (`src/solver.js` & client-side `public/app.js`)**:
   - Exact Branch-and-Bound algorithm with Dantzig continuous knapsack LP-relaxation upper bounding.
   - Enforces technological prerequisite dependencies ($x_j \le x_k$), corridor mutual exclusivity ($x_p + x_q \le 1$), and sectoral equity mandates.
   - Dual-solver architecture: server-side solver with fallback client-side solver for resilient offline usage.

4. **Sleek Minimalist Frontend (`public/index.html`, `public/styles.css`, `public/app.js`)**:
   - Clean, architectural, simplistic styling (slate/zinc palette, zero neon glow halation or AI gradients).
   - Real-time Pareto Sensitivity Frontier with HTML5 Canvas (interactive click & hover tooltips).
   - Mathematical typesetting powered by KaTeX.
   - Code generators for standard CPLEX/Gurobi `.LP` files, reproducible Python `PuLP` scripts, and CSV exports.

---

## Quick Start

### 1. Launch the Fastify Server
```bash
npm start
```
The application will be live at: **[http://localhost:3000](http://localhost:3000)**

### 2. Run Test Suite
```bash
npm test
```
Verifies all 87 HTML elements, REST API endpoints, database CRUD operations, and mathematical solver consistency.

### 3. Rebuild Standalone HTML File
```bash
npm run build:standalone
```
Syncs the inlined standalone file at `C:\Users\Baman Jaynilkumar\Downloads\smart_city_ilp_capital_budgeting_optimizer.html`.
