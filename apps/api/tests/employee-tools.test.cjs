const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const apiRequire = createRequire(path.resolve(__dirname, '../package.json'));
const ts = apiRequire('typescript');
const source = path.resolve(__dirname, '../src/agent');
function load(file, overrides) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(source, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function('require', 'module', 'exports', code)(
    id => Object.hasOwn(overrides, id) ? overrides[id] : apiRequire(id), mod, mod.exports);
  return mod.exports;
}
const registry = load('mcp/registry.ts', {});
const drizzle = { eq: (column, value) => ({ column, value }),
  and: (...conditions) => conditions, isNull: column => ({ column, value: null }) };
const grantsTable = Object.fromEntries(['id', 'employeeId', 'businessId', 'provider', 'toolName', 'revokedAt']
  .map(k => [k, `grant.${k}`]));
const catalog = Object.fromEntries(['businessId', 'provider', 'toolName', 'description', 'inputSchema']
  .map(k => [k, `catalog.${k}`]));
function mockDb(rows) {
  const conditions = [];
  return { conditions, select() {
    return { from() { return this; }, innerJoin() { return this; },
      where(value) { conditions.push(value); return this; },
      limit: async () => rows, then: (resolve, reject) => Promise.resolve(rows).then(resolve, reject) };
  } };
}

test('injection uses configured schemas, disambiguates names, and reserves internal tools', async () => {
  const schema = { type: 'object', properties: { arbitraryField: { type: 'string' } } };
  const row = (provider, toolName) => ({ provider, toolName, description: 'discovered', inputSchema: schema });
  const db = mockDb([row('gmail', 'new_server_tool'), row('gmail', 'shared'), row('slack', 'shared'),
    row('gmail', 'finish'), row('gmail', 'provider/path.with.dots'), row('gmail', 'new_server_tool'),
    row('unknown', 'unsupported')]);
  const { buildEmployeeToolset, INTERNAL_TOOLS, SUPERVISOR_TOOLS } = load('tools.ts', {
    'drizzle-orm': drizzle, '@staffroom/db': { getDb: () => db, employeeToolGrants: grantsTable, connectorTools: catalog },
    './mcp/registry': registry,
  });
  const result = await buildEmployeeToolset('employee', 'business');
  for (const tools of [INTERNAL_TOOLS, SUPERVISOR_TOOLS]) {
    assert(!tools.some(tool => tool.name === 'read_memory'));
    assert(tools.some(tool => tool.name === 'write_memory'));
  }
  assert.equal(result.bindings.size, 5);
  assert.equal(new Set(result.tools.map(t => t.name)).size, result.tools.length);
  assert(result.tools.every(t => /^[a-zA-Z0-9_-]{1,64}$/.test(t.name)));
  assert.deepEqual(result.bindings.get('new_server_tool'), { provider: 'gmail', toolName: 'new_server_tool' });
  assert(!result.bindings.has('finish'));
  assert.deepEqual(result.tools.find(t => t.name === 'new_server_tool').input_schema, schema);
  for (const name of ['shared', 'finish', 'provider/path.with.dots']) {
    assert([...result.bindings.values()].some(b => b.toolName === name));
  }
  assert.deepEqual(db.conditions[0], [
    { column: 'grant.employeeId', value: 'employee' }, { column: 'grant.businessId', value: 'business' },
    { column: 'grant.revokedAt', value: null },
  ]);
  assert(!registry.isDiscoverableProvider('toString'));
});

function dispatcher({ granted = true, readonly = true } = {}) {
  const db = mockDb(granted ? [{ id: 'grant' }] : []);
  const calls = [], tokens = [];
  const { executeGrantedMcpTool } = load('mcp/employee-tools.ts', {
    'drizzle-orm': drizzle, '@staffroom/db': { getDb: () => db, employeeToolGrants: grantsTable, connectorTools: catalog },
    './registry': registry, './auth': { getConnectorToken: async (...args) => {
      tokens.push(args); return { accessToken: 'test-token' };
    } }, './client': {
      isMcpToolReadOnly: async () => readonly,
      callMcpTool: async args => { calls.push(args); return { arbitraryResult: 123 }; },
    },
  });
  return { execute: executeGrantedMcpTool, db, calls, tokens };
}
const binding = { provider: 'gmail', toolName: 'provider/custom_actual_name' };
const scope = { employeeId: 'employee', businessId: 'business' };

test('dispatch forwards exact provider tool name and schema arguments, scoped to the employee and business', async () => {
  const { execute, calls, tokens, db } = dispatcher();
  const args = { nested: { actualParameter: ['value'] }, pageSize: 7 };
  assert.deepEqual(await execute(binding, args, scope), { requiresApproval: false, result: { arbitraryResult: 123 } });
  assert.deepEqual(calls, [{ serverUrl: registry.MCP_REGISTRY.gmail, accessToken: 'test-token',
    toolName: binding.toolName, toolArgs: args }]);
  assert.deepEqual(tokens, [['business', 'gmail']]);
  assert.deepEqual(db.conditions[0], [
    { column: 'grant.employeeId', value: 'employee' }, { column: 'grant.businessId', value: 'business' },
    { column: 'grant.provider', value: 'gmail' }, { column: 'grant.toolName', value: binding.toolName },
    { column: 'grant.revokedAt', value: null },
  ]);
});

test('revoked/ungranted and unsupported tools never reach MCP, including after approval', async () => {
  const d = dispatcher({ granted: false });
  await assert.rejects(() => d.execute(binding, {}, scope), /Permission denied/);
  await assert.rejects(() => d.execute(binding, {}, scope, true), /Permission denied/);
  await assert.rejects(() => d.execute({ provider: 'toString', toolName: 'x' }, {}, scope), /not supported/);
  assert.equal(d.calls.length, 0);
  assert.equal(d.tokens.length, 0);
});

test('writes and unknown safety require approval; approved calls use the same dynamic dispatch', async () => {
  const d = dispatcher({ readonly: false });
  assert.deepEqual(await d.execute(binding, { actualField: 42 }, scope), { requiresApproval: true });
  assert.equal(d.calls.length, 0);
  await d.execute(binding, { actualField: 42 }, scope, true);
  assert.equal(d.calls.length, 1);
});

test('live MCP metadata handles pagination, public Google discovery, authenticated Slack, and cleanup', async () => {
  let pages = [], transports = [], closed = 0;
  class Transport { constructor(url, options) { transports.push(options); } }
  class Client { async connect() {} async close() { closed++; } async listTools() { return pages.shift(); } }
  const { isMcpToolReadOnly } = load('mcp/client.ts', {
    '@modelcontextprotocol/sdk/client/index.js': { Client },
    '@modelcontextprotocol/sdk/client/streamableHttp.js': { StreamableHTTPClientTransport: Transport },
    './registry': registry, '../../lib/logger': { default: { debug() {} } },
  });
  pages = [{ tools: [], nextCursor: 'next' }, { tools: [{ name: 'custom', annotations: { readOnlyHint: true } }] }];
  assert.equal(await isMcpToolReadOnly('gmail', 'token', 'custom'), true);
  assert(!transports[0].requestInit);
  pages = [{ tools: [{ name: 'custom' }] }];
  assert.equal(await isMcpToolReadOnly('slack', 'token', 'custom'), false);
  assert.equal(transports[1].requestInit.headers.Authorization, 'Bearer token');
  pages = [{ tools: [] }];
  await assert.rejects(() => isMcpToolReadOnly('gmail', 'token', 'gone'), /no longer available/);
  pages = [{ tools: [], nextCursor: 'repeat' }, { tools: [], nextCursor: 'repeat' }];
  await assert.rejects(() => isMcpToolReadOnly('gmail', 'token', 'custom'), /repeated/);
  assert.equal(closed, 4);
});

test('approved arguments can change but provider/tool identity cannot', async () => {
  const original = { ...binding, arguments: { value: 'original' } };
  const db = mockDb([{ executedAt: null, employeeId: 'employee', businessId: 'business', payload: original }]);
  const calls = [];
  const { executeApprovedAction } = load('actions.ts', {
    'drizzle-orm': drizzle, '@staffroom/db': { getDb: () => db, approvals: { idempotencyKey: 'key' }, tasks: {} },
    '../lib/logger': { default: { info() {} } },
    './mcp/employee-tools': { executeGrantedMcpTool: async (...args) => calls.push(args) },
  });
  const params = { approvalId: 'approval', idempotencyKey: 'key', actionType: 'mcp_tool' };
  await executeApprovedAction({ ...params, payload: { ...original, arguments: { value: 'edited' } } });
  assert.deepEqual(calls[0], [original, { value: 'edited' }, scope, true]);
  await assert.rejects(() => executeApprovedAction({ ...params, payload: { ...original, provider: 'slack' } }), /cannot be changed/);
  assert.equal(calls.length, 1);
});

test('employee loop binds arbitrary tools and creates approvals using their original provider identity', async () => {
  const inserts = [], updates = [], calls = [];
  let loop;
  const db = mockDb([]);
  db.insert = () => ({ values: async value => inserts.push(value) });
  db.update = () => ({ set: value => ({ where: async () => updates.push(value) }) });
  const bindings = new Map([['dynamic_alias', binding]]);
  const injected = [{ name: 'dynamic_alias', input_schema: { type: 'object' } }];
  const { runAsEmployee } = load('employee.ts', {
    'drizzle-orm': drizzle, '@staffroom/db': { getDb: () => db, memories: {}, approvals: {}, tasks: {} },
    '../lib/id': { newId: prefix => `${prefix}-test` },
    './tools': { buildEmployeeToolset: async () => ({ tools: injected, bindings }) },
    './mcp/employee-tools': { executeGrantedMcpTool: async (...args) => {
      calls.push(args); return { requiresApproval: true };
    } },
    './loop': { runAgentLoop: async opts => { loop = opts; } },
    './prompts': { buildEmployeeSystemPrompt: () => 'prompt' },
    './memory': { loadMemoryContext: async () => ({ memories: [], businessMemories: [], teamMemories: [] }) },
  });
  await runAsEmployee({ task: { id: 'task', title: 'title', description: 'description' },
    employee: { id: 'employee', businessId: 'business', instructionsJson: {} },
    business: { id: 'business', name: 'business' }, llmConfig: {}, demoMode: false, runId: 'run' });
  assert.strictEqual(loop.tools, injected);
  const args = { newProviderField: 'exact-value' };
  const result = await loop.executeTool('dynamic_alias', args, loop.ctx);
  assert.equal(result.status, 'waiting_for_owner_approval');
  assert.deepEqual(calls[0], [binding, args, loop.ctx]);
  assert.deepEqual(inserts[0].payloadJson, { ...binding, arguments: args });
  assert.equal(inserts[0].actionType, 'mcp_tool');
  assert.deepEqual(updates, [{ status: 'waiting_approval' }]);
  assert.match((await loop.executeTool('invented_tool', {}, loop.ctx)).error, /Unknown tool/);
  assert.match((await loop.executeTool('read_memory', {}, loop.ctx)).error, /Unknown tool/);
  assert.match((await loop.executeTool('create_approval_request', { action_type: 'invented_tool' }, loop.ctx)).error, /exact name/);
  assert.equal(inserts.length, 1);
});
