const fastify = require('fastify')({ logger: true });
const path = require('node:path');
const cors = require('@fastify/cors');
const fastifyStatic = require('@fastify/static');

const db = require('./db');
const solver = require('./solver');

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';

async function buildServer() {
    // Enable CORS for all origins so HTML works via file:// or any host
    await fastify.register(cors, {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    });

    // Serve static files from 'public' directory
    await fastify.register(fastifyStatic, {
        root: path.join(__dirname, '..', 'public'),
        prefix: '/'
    });

    // Health Check
    fastify.get('/api/health', async () => {
        return {
            status: 'ok',
            service: 'Smart City Fastify ILP Backend',
            database: 'SQLite (node:sqlite)',
            timestamp: new Date().toISOString()
        };
    });

    // Projects CRUD
    fastify.get('/api/projects', async () => {
        return {
            success: true,
            projects: db.getAllProjects()
        };
    });

    fastify.post('/api/projects', async (request, reply) => {
        const body = request.body || {};
        try {
            const newProj = db.createProject(body);
            return reply.code(201).send({ success: true, project: newProj });
        } catch (err) {
            fastify.log.error(err);
            return reply.code(400).send({ success: false, error: err.message });
        }
    });

    fastify.put('/api/projects/:id', async (request, reply) => {
        const id = Number(request.params.id);
        const body = request.body || {};
        try {
            const updated = db.updateProject(id, body);
            if (!updated) {
                return reply.code(404).send({ success: false, error: 'Project not found' });
            }
            return { success: true, project: updated };
        } catch (err) {
            fastify.log.error(err);
            return reply.code(400).send({ success: false, error: err.message });
        }
    });

    fastify.delete('/api/projects/:id', async (request, reply) => {
        const id = Number(request.params.id);
        const deleted = db.deleteProject(id);
        if (!deleted) {
            return reply.code(404).send({ success: false, error: 'Project not found' });
        }
        return { success: true, message: `Project ${id} deleted` };
    });

    fastify.post('/api/projects/reset', async () => {
        const resetList = db.resetProjects();
        return { success: true, projects: resetList };
    });

    // Scenarios Endpoints
    fastify.get('/api/scenarios', async () => {
        return {
            success: true,
            scenarios: db.getAllScenarios()
        };
    });

    fastify.post('/api/scenarios', async (request, reply) => {
        const body = request.body;
        if (!body || !body.name) {
            return reply.code(400).send({ success: false, error: 'Scenario name is required' });
        }
        const saved = db.saveScenario(body);
        return { success: true, scenario: saved };
    });

    // Optimization Solver Endpoint
    fastify.post('/api/optimize', async (request, reply) => {
        const body = request.body || {};
        const constraints = {
            maxCapex: Number(body.maxCapex ?? 850),
            maxOpex: Number(body.maxOpex ?? 95),
            minCO2: Number(body.minCO2 ?? 45),
            minPop: Number(body.minPop ?? 15),
            depICCC: body.depICCC !== undefined ? Boolean(body.depICCC) : true,
            exclTransit: body.exclTransit !== undefined ? Boolean(body.exclTransit) : true,
            sectorFloor: body.sectorFloor !== undefined ? Boolean(body.sectorFloor) : true,
            solarEbusDep: body.solarEbusDep !== undefined ? Boolean(body.solarEbusDep) : false
        };

        const projList = (body.projects && Array.isArray(body.projects))
            ? body.projects
            : db.getAllProjects();

        const result = solver.solveILP(projList, constraints, true);

        // Log optimization run to SQLite database for audit trail
        try {
            db.logOptimizationRun({
                scenarioName: body.scenarioName || 'Studio Live',
                maxCapex: constraints.maxCapex,
                maxOpex: constraints.maxOpex,
                minCO2: constraints.minCO2,
                minPop: constraints.minPop,
                feasible: result.feasible,
                optimalValue: result.bestObj,
                selectedProjects: result.selectedCodes,
                nodesExplored: result.nodesExplored,
                solveTimeMs: result.solveTimeMs
            });
        } catch (dbErr) {
            fastify.log.warn('Could not log optimization run: ' + dbErr.message);
        }

        return {
            success: true,
            solution: result
        };
    });

    // Optimization Runs History
    fastify.get('/api/history', async (request) => {
        const limit = Number(request.query?.limit || 20);
        return {
            success: true,
            history: db.getOptimizationHistory(limit)
        };
    });

    return fastify;
}

if (require.main === module) {
    buildServer().then(server => {
        server.listen({ port: PORT, host: HOST }, (err, address) => {
            if (err) {
                server.log.error(err);
                process.exit(1);
            }
            console.log(`\n========================================================`);
            console.log(`🚀 Smart City Capital Budgeting Fastify Server Running!`);
            console.log(`📍 Web App & API available at: http://localhost:${PORT}`);
            console.log(`🗄️ Database: SQLite (smart_city.db initialized)`);
            console.log(`========================================================\n`);
        });
    });
}

module.exports = { buildServer };
