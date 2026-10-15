const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const req = createRequire(path.resolve(__dirname, '../package.json'));
const ts = req('typescript');
function load(file, overrides = {}) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', code)(id => Object.hasOwn(overrides, id) ? overrides[id] : req(id), mod, mod.exports);
  return mod.exports;
}
const columns = {
  employees: ['id', 'businessId', 'status', 'isManager'], tasks: ['id', 'businessId', 'parentTaskId', 'assignedToEmployeeId'],
  memories: ['id', 'employeeId', 'kind', 'content', 'source', 'createdAt'],
  businessMemories: ['id', 'businessId', 'kind', 'content', 'createdAt'],
  teamMemories: ['id', 'businessId', 'authorEmployeeId', 'taskId', 'kind', 'content', 'createdAt'],
  humanUsers: ['id', 'businessId', 'role'],
};
const tables = Object.fromEntries(Object.entries(columns).map(([name, keys]) => [name, {
  name, ...Object.fromEntries(keys.map(key => [key, { table: name, key }])) } ]));
const orm = {
  eq: (a, b) => ({ op: 'eq', a, b }), and: (...args) => ({ op: 'and', args }), or: (...args) => ({ op: 'or', args }),
  isNull: a => ({ op: 'eq', a, b: null }), inArray: (a, b) => ({ op: 'in', a, b }),
  desc: column => ({ column, direction: -1 }), asc: column => ({ column, direction: 1 }),
};
const value = (operand, row) => operand && operand.table ? row[operand.table]?.[operand.key] : operand;
function matches(condition, row) {
  if (!condition) return true;
  if (condition.op === 'and') return condition.args.every(c => matches(c, row));
  if (condition.op === 'or') return condition.args.some(c => matches(c, row));
  const a = value(condition.a, row), b = value(condition.b, row);
  return condition.op === 'in' ? b.includes(a) : a === b;
}
function database() {
  const now = new Date();
  const state = {
    employees: [
      { id: 'worker', businessId: 'biz', status: 'active', isManager: false },
      { id: 'manager', businessId: 'biz', status: 'active', isManager: true },
      { id: 'peer', businessId: 'biz', status: 'active', isManager: false },
      { id: 'outsider', businessId: 'other', status: 'active', isManager: false },
    ],
    tasks: [
      { id: 'parent', businessId: 'biz', parentTaskId: null, assignedToEmployeeId: 'manager' },
      { id: 'child', businessId: 'biz', parentTaskId: 'parent', assignedToEmployeeId: 'worker' },
      { id: 'sibling', businessId: 'biz', parentTaskId: 'parent', assignedToEmployeeId: 'peer' },
      { id: 'unrelated', businessId: 'other', parentTaskId: null, assignedToEmployeeId: 'outsider' },
    ],
    memories: [], businessMemories: [], teamMemories: [],
    humanUsers: [{ id: 'owner', businessId: 'biz', role: 'owner' }, { id: 'viewer', businessId: 'biz', role: 'viewer' }],
  };
  const db = { state, select(fields) {
    let rows = [], table, condition, ordering, max = Infinity;
    function result() {
      let found = rows.filter(r => matches(condition, r));
      if (ordering) found = found.sort((a, b) => {
        const x = value(ordering.column, a), y = value(ordering.column, b);
        return (x > y ? 1 : x < y ? -1 : 0) * ordering.direction;
      });
      return found.slice(0, max).map(r => fields ? Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, value(v, r)])) : r[table.name]);
    }
    return {
      from(t) { table = t; rows = state[t.name].map(r => ({ [t.name]: r })); return this; },
      innerJoin(t, predicate) { rows = rows.flatMap(r => state[t.name].map(join => ({ ...r, [t.name]: join })).filter(join => matches(predicate, join))); return this; },
      where(c) { condition = c; return this; }, orderBy(o) { ordering = o; return this; },
      limit(n) { max = n; return this; }, then(resolve, reject) { return Promise.resolve(result()).then(resolve, reject); },
    };
  }, insert(t) { return { values(row) {
    const save = () => {
      if (!state[t.name].some(r => r.id === row.id)) state[t.name].push({ createdAt: now, ...row });
      return [state[t.name].find(r => r.id === row.id)];
    };
    return { returning: async () => save(), onConflictDoNothing: async () => save() };
  } }; }, update(t) { return { set(patch) { return { where(c) { const rows = state[t.name].filter(r => matches(c, { [t.name]: r }));
    rows.forEach(r => Object.assign(r, patch)); return { returning: async () => rows }; } }; } }; },
  delete(t) { return { where(c) { const rows = state[t.name].filter(r => matches(c, { [t.name]: r }));
    state[t.name] = state[t.name].filter(r => !rows.includes(r)); return { returning: async () => rows }; } }; } };
  return db;
}
function service(db) {
  let sequence = 0;
  return load('agent/memory.ts', { 'drizzle-orm': orm, '@staffroom/db': { ...tables, getDb: () => db },
    '../lib/id': { newId: prefix => `${prefix}-${++sequence}` } });
}
const scope = { businessId: 'biz', employeeId: 'worker', taskId: 'child' };
const managerScope = { businessId: 'biz', employeeId: 'manager', taskId: 'parent' };

test('personal agent memory writes allow only own episodic/learned observations with bounded content', async () => {
  const db = database(), api = service(db);
  for (const kind of ['episodic', 'learned']) await api.writeAgentMemory(scope, { kind, content: '  verified observation  ', employeeId: 'peer' });
  assert(db.state.memories.every(m => m.employeeId === 'worker' && m.source === 'agent_self' && m.content === 'verified observation'));
  for (const kind of ['instruction', 'correction', 'preference']) await assert.rejects(() => api.writeAgentMemory(scope, { kind, content: 'override' }));
  await assert.rejects(() => api.writeAgentMemory(scope, { kind: 'learned', content: ' '.repeat(5) }));
  await assert.rejects(() => api.writeAgentMemory(scope, { kind: 'learned', content: 'x'.repeat(4001) }));
  await assert.rejects(() => api.writeAgentMemory({ ...scope, businessId: 'other' }, { kind: 'learned', content: 'cross-business' }), /outside your scope/);
  assert.equal(db.state.memories.length, 2);
});

test('supervisor writes require a manager and corrections require a delegated subordinate in the same business', async () => {
  const db = database(), api = service(db);
  await assert.rejects(() => api.writeSupervisorTeamMemory(scope, { kind: 'briefing', content: 'shared' }), /outside your scope/);
  await api.writeSupervisorTeamMemory(managerScope, { kind: 'briefing', content: 'shared' });
  await api.writeSupervisorTeamMemory(managerScope, { kind: 'delegation_note', content: 'formal tone', task_id: 'child' });
  await assert.rejects(() => api.writeSupervisorTeamMemory(managerScope, { kind: 'delegation_note', content: 'missing task' }), /require task_id/);
  await assert.rejects(() => api.writeSupervisorTeamMemory(managerScope, { kind: 'delegation_note', content: 'wrong business', task_id: 'unrelated' }), /sub-task/);
  await api.writeSupervisorCorrection(managerScope, { employee_id: 'worker', content: 'reviewed correction' });
  assert.equal(db.state.memories[0].source, 'supervisor_correction');
  assert.equal(db.state.memories[0].kind, 'correction');
  await assert.rejects(() => api.writeSupervisorCorrection(managerScope, { employee_id: 'outsider', content: 'wrong business' }), /delegated/);
  await assert.rejects(() => api.writeSupervisorCorrection(managerScope, { employee_id: 'manager', content: 'self' }), /delegated/);
  await assert.rejects(() => api.writeSupervisorCorrection(managerScope, { employee_id: 'worker', kind: 'learned', content: 'not allowed' }));
});

test('startup merges business/team/personal context without leaking another business or a sibling task note', async () => {
  const db = database(), api = service(db), now = new Date();
  db.state.businessMemories.push({ id: 'policy', businessId: 'biz', kind: 'policy', content: 'company policy', createdAt: now },
    { id: 'secret', businessId: 'other', kind: 'policy', content: 'other company secret', createdAt: now });
  for (const [id, taskId, businessId] of [['shared', null, 'biz'], ['mine', 'child', 'biz'], ['sibling', 'sibling', 'biz'], ['foreign', null, 'other']]) {
    db.state.teamMemories.push({ id, taskId, businessId, kind: taskId ? 'delegation_note' : 'briefing', content: id, createdAt: now });
  }
  for (let i = 0; i < 8; i++) db.state.memories.push({ id: `episode${i}`, employeeId: 'worker', kind: 'episodic', content: `episode ${i}`, createdAt: new Date(i * 1000) });
  db.state.memories.push({ id: 'instruction', employeeId: 'worker', kind: 'instruction', content: 'standing instruction', createdAt: new Date(0) },
    { id: 'other', employeeId: 'peer', kind: 'instruction', content: 'peer private', createdAt: now });
  const result = await api.loadMemoryContext(scope);
  assert.deepEqual(result.businessMemories.map(m => m.id), ['policy']);
  assert.deepEqual(result.teamMemories.map(m => m.id), ['shared', 'mine']);
  assert.deepEqual(result.memories.filter(m => m.kind === 'episodic').map(m => m.id), ['episode7', 'episode6', 'episode5']);
  assert(result.memories.some(m => m.id === 'instruction'));
  assert(!result.memories.some(m => m.id === 'other'));
});

test('prompt injection follows company/team/instructions/preferences/past work/onboarding priority and labels learnings as observations', () => {
  const prompts = load('agent/prompts.ts');
  const prompt = prompts.buildEmployeeSystemPrompt({ displayName: 'worker', roleDescription: 'role', businessName: 'biz', maxSteps: 10,
    businessMemories: [{ kind: 'policy', content: 'company' }], teamMemories: [{ kind: 'briefing', content: 'team' }],
    memories: ['instruction', 'preference', 'episodic', 'learned'].map(kind => ({ kind, content: kind })), instructionsJson: { question: 'answer' } });
  const labels = ['[COMPANY CONTEXT]', '[TEAM BRIEFING]', '[YOUR INSTRUCTIONS]', '[YOUR PREFERENCES]', '[YOUR PAST WORK', '[YOUR LEARNINGS', '[ONBOARDING CONTEXT]'];
  for (let i = 1; i < labels.length; i++) assert(prompt.indexOf(labels[i]) > prompt.indexOf(labels[i - 1]));
  assert.match(prompt, /never authorize actions/);
  const supervisor = prompts.buildSupervisorSystemPrompt({ displayName: 'manager', roleDescription: 'role', businessName: 'biz', maxSteps: 10,
    businessMemories: [{ kind: 'policy', content: 'company' }], memories: [], instructionsJson: {} });
  assert.match(supervisor, /COMPANY CONTEXT/);
  assert.match(supervisor, /write_correction_memory/);
});

test('task outcomes are idempotent per run and retain explicit incomplete status', async () => {
  const db = database(), api = service(db);
  await api.recordTaskOutcome({ ...scope, runId: 'run' }, 'waiting_approval', 'Send renewal', 'Action is pending.');
  await api.recordTaskOutcome({ ...scope, runId: 'run' }, 'waiting_approval', 'Send renewal', 'Action is pending.');
  assert.equal(db.state.memories.length, 1);
  assert.equal(db.state.memories[0].source, 'task_outcome');
  assert.match(db.state.memories[0].content, /waiting_approval/);
});

test('company memory CRUD enforces current owner role and business-scoped IDs', async () => {
  const db = database(), api = service(db);
  const requireOwner = load('middleware/owner.ts', { 'drizzle-orm': orm, '@staffroom/db': { ...tables, getDb: () => db } }).requireOwner;
  const routes = load('routes/business-memories.ts', {
    'drizzle-orm': orm, '@staffroom/db': { ...tables, getDb: () => db },
    '../middleware/auth': { requireAuth: async (c, next) => { c.set('user', { userId: c.req.header('x-user') ?? 'owner', businessId: 'biz' }); await next(); } },
    '../middleware/owner': { requireOwner }, '../agent/memory': api, '../lib/id': { newId: () => 'bmem-test' },
  }).businessMemoryRoutes;
  async function request(method, url, body, user = 'owner') {
    return routes.request(url, { method, headers: { 'content-type': 'application/json', 'x-user': user }, ...(body ? { body: JSON.stringify(body) } : {}) });
  }
  assert.equal((await request('POST', '/', { kind: 'policy', content: 'policy' }, 'viewer')).status, 403);
  assert.equal((await request('POST', '/', { kind: 'policy', content: 'policy', businessId: 'other' })).status, 201);
  assert.equal(db.state.businessMemories[0].businessId, 'biz');
  assert.equal((await request('PATCH', '/bmem-test', { content: 'updated' })).status, 200);
  assert.equal(db.state.businessMemories[0].content, 'updated');
  db.state.businessMemories.push({ id: 'foreign', businessId: 'other', kind: 'policy', content: 'secret', createdAt: new Date() });
  assert.equal((await request('PATCH', '/foreign', { content: 'overwrite' })).status, 404);
  assert.equal((await request('DELETE', '/foreign')).status, 404);
  assert.equal((await request('GET', '/')).status, 200);
  assert.equal((await (await request('GET', '/')).json()).data.length, 1);
  assert.equal((await request('DELETE', '/bmem-test')).status, 200);
});

function memoryRouter(file, db) {
  const api = service(db);
  const requireOwner = load('middleware/owner.ts', { 'drizzle-orm': orm, '@staffroom/db': { ...tables, getDb: () => db } }).requireOwner;
  const exports = load(file, {
    'drizzle-orm': orm, '@staffroom/db': { ...tables, getDb: () => db },
    '../middleware/auth': { requireAuth: async (c, next) => { c.set('user', { userId: c.req.header('x-user') ?? 'owner', businessId: 'biz' }); await next(); } },
    '../middleware/owner': { requireOwner }, '../agent/memory': api, '../lib/id': { newId: () => 'memory-test' },
  });
  const router = Object.values(exports)[0];
  return (method, url, body, user = 'owner') => router.request(url, {
    method, headers: { 'content-type': 'application/json', 'x-user': user }, ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

test('team owner CRUD rejects foreign task references and validates delegation notes on create/update', async () => {
  const db = database(), request = memoryRouter('routes/team-memories.ts', db);
  assert.equal((await request('POST', '/', { kind: 'briefing', content: 'brief' }, 'viewer')).status, 403);
  assert.equal((await request('POST', '/', { kind: 'delegation_note', content: 'note', taskId: 'unrelated' })).status, 404);
  assert.equal((await request('POST', '/', { kind: 'delegation_note', content: 'note' })).status, 400);
  assert.equal((await request('POST', '/', { kind: 'delegation_note', content: 'note', taskId: 'child', authorEmployeeId: 'manager' })).status, 201);
  assert.equal(db.state.teamMemories[0].authorEmployeeId, null);
  assert.equal((await request('PATCH', '/memory-test', { content: 'edited' })).status, 200);
  assert.equal(db.state.teamMemories[0].taskId, 'child');
  assert.equal((await request('PATCH', '/memory-test', { taskId: null })).status, 422);
  assert.equal((await request('PATCH', '/memory-test', { taskId: 'unrelated' })).status, 404);
  assert.equal((await request('DELETE', '/memory-test')).status, 200);
});

test('owner personal CRUD rejects foreign employees and memory IDs', async () => {
  const db = database(), request = memoryRouter('routes/employee-memories.ts', db);
  assert.equal((await request('POST', '/worker/memories', { kind: 'instruction', content: 'instruction' }, 'viewer')).status, 403);
  assert.equal((await request('POST', '/outsider/memories', { kind: 'instruction', content: 'instruction' })).status, 404);
  assert.equal((await request('POST', '/worker/memories', { kind: 'preference', content: 'preference' })).status, 201);
  assert.equal((await request('PATCH', '/worker/memories/memory-test', { content: 'updated' })).status, 200);
  assert.equal((await request('PATCH', '/peer/memories/memory-test', { content: 'stolen' })).status, 404);
  assert.equal((await request('DELETE', '/peer/memories/memory-test')).status, 404);
  assert.equal((await request('DELETE', '/worker/memories/memory-test')).status, 200);
});

test('loop records actual completion and approval pause outcomes automatically', async () => {
  for (const pending of [false, true]) {
    let task = { id: 'task', status: 'running', title: 'task title' };
    const recorded = [];
    const db = { select() { return { from() { return this; }, where: async () => [task] }; },
      update() { return { set(values) { return { where: async () => { if (values.status) task = { ...task, ...values }; } }; } }; } };
    const { runAgentLoop } = load('agent/loop.ts', {
      'drizzle-orm': orm, '@staffroom/db': { getDb: () => db, tasks: { id: 'task' }, runs: {}, employees: {} },
      '@staffroom/llm': { llm: async () => ({
        content: pending ? [{ type: 'tool_use', name: 'create_approval_request', input: {}, id: 'call' }] : [{ type: 'text', text: 'Verified completion summary' }],
        stopReason: pending ? 'tool_use' : 'end_turn', usage: { inputTokens: 1, outputTokens: 1 },
      }) }, '../lib/logger': { default: { error() {}, warn() {} } },
      './memory': { recordTaskOutcome: async (...args) => recorded.push(args) },
    });
    await runAgentLoop({ ctx: { ...scope, runId: 'run' }, llmConfig: { model: 'test', provider: 'test' },
      systemPrompt: 'prompt', tools: [], initialMessages: [], executeTool: async () => {
        task.status = 'waiting_approval'; return { status: 'waiting_for_owner_approval' };
      } });
    assert.equal(recorded.length, 1);
    assert.equal(recorded[0][1], pending ? 'waiting_approval' : 'done');
    assert.match(recorded[0][3], pending ? /completion is not confirmed/ : /Verified completion summary/);
  }
});

test('supervisor promotion copies only observations from a delegated employee into team memory', async () => {
  const db = database(), api = service(db);
  db.state.memories.push({ id: 'learning', employeeId: 'worker', kind: 'learned', content: 'reviewed learning', createdAt: new Date() },
    { id: 'foreign-learning', employeeId: 'outsider', kind: 'learned', content: 'foreign', createdAt: new Date() },
    { id: 'policy', employeeId: 'worker', kind: 'instruction', content: 'instruction', createdAt: new Date() });
  const result = await api.promoteEmployeeMemory(managerScope, { memory_id: 'learning' });
  assert.equal(result.content, 'reviewed learning');
  assert.equal(result.kind, 'outcome_summary');
  assert.equal(result.authorEmployeeId, 'manager');
  await assert.rejects(() => api.promoteEmployeeMemory(scope, { memory_id: 'learning' }), /outside your scope/);
  await assert.rejects(() => api.promoteEmployeeMemory(managerScope, { memory_id: 'foreign-learning' }), /delegated employee/);
  await assert.rejects(() => api.promoteEmployeeMemory(managerScope, { memory_id: 'policy' }), /delegated employee/);
  assert.equal(db.state.teamMemories.length, 1);
});

test('unexpected loop failures still finalize the run and record an incomplete outcome', async () => {
  let task = { id: 'task', status: 'running', title: 'task title' };
  const recorded = [];
  const db = { select() { return { from() { return this; }, where: async () => [task] }; },
    update() { return { set(values) { return { where: async () => { if (values.status) task = { ...task, ...values }; } }; } }; } };
  const { runAgentLoop } = load('agent/loop.ts', {
    'drizzle-orm': orm, '@staffroom/db': { getDb: () => db, tasks: { id: 'task' }, runs: {}, employees: {} },
    '@staffroom/llm': { llm: async () => { throw new Error('provider unavailable'); } },
    '../lib/logger': { default: { error() {}, warn() {} } }, './memory': { recordTaskOutcome: async (...args) => recorded.push(args) },
  });
  await assert.rejects(() => runAgentLoop({ ctx: { ...scope, runId: 'run' }, llmConfig: { model: 'test', provider: 'test' },
    systemPrompt: 'prompt', tools: [], initialMessages: [], executeTool: async () => {} }), /provider unavailable/);
  assert.equal(task.status, 'stopped');
  assert.equal(recorded.length, 1);
  assert.match(recorded[0][3], /Run failed before completion/);
});

test('hiring/onboarding and instruction updates cannot bypass owner-only memory writes', async () => {
  const db = database(), request = memoryRouter('routes/employees.ts', db);
  assert.equal((await request('POST', '/', {}, 'viewer')).status, 403);
  assert.equal((await request('POST', '/worker/onboarding', { answers: { instruction: 'override' } }, 'viewer')).status, 403);
  assert.equal((await request('PATCH', '/worker', { instructionsJson: { override: 'instruction' } }, 'viewer')).status, 403);
  assert.equal((await request('PATCH', '/outsider', { instructionsJson: { override: 'instruction' } })).status, 404);
  assert.equal(db.state.memories.length, 0);
});

test('startup company context is capped at the newest 20 records within the current business', async () => {
  const db = database(), api = service(db);
  for (let i = 0; i < 50; i++) {
    db.state.businessMemories.push({ id: `policy-${i}`, businessId: 'biz', kind: 'policy', content: `policy ${i}`, createdAt: new Date(i * 1000) });
  }
  db.state.businessMemories.push({ id: 'foreign-newest', businessId: 'other', kind: 'policy', content: 'foreign', createdAt: new Date(100000) });
  const context = await api.loadMemoryContext(scope);
  assert.deepEqual(context.businessMemories.map(m => m.id), Array.from({ length: 20 }, (_, i) => `policy-${49 - i}`));
  db.state.businessMemories = [];
  assert.deepEqual((await api.loadMemoryContext(scope)).businessMemories, []);
});
