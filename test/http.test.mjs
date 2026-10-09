import test from 'node:test';
import { request } from 'node:http';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { startHttpServer } from '../build/http.js';
import { httpOptionsFromEnv } from '../build/http-config.js';

async function connect(url, token) {
    const transport = new StreamableHTTPClientTransport(new URL(url), {
        requestInit: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
    });
    const client = new Client({ name: 'integration-test', version: '1.0.0' });
    await client.connect(transport);
    return { client, transport };
}
const call = (client, name, args = {}) => client.callTool({ name, arguments: args });
const payload = result => JSON.parse(result.content[0].text);
const block = (name, action = 'add') => ({ blockName: name, blockType: 'hero', action });
const component = (name, action = 'add') => ({ componentName: name, componentType: 'button', action });
const initialize = { jsonrpc: '2.0', id: 1, method: 'initialize', params: {
    protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'raw-test', version: '1' },
} };
async function post(url, body, headers = {}) {
    return fetch(url, { method: 'POST', headers: {
        'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers,
    }, body: JSON.stringify(body) });
}

test('concurrent clients isolate both collections; DELETE only removes its own session', async t => {
    const service = await startHttpServer({ port: 0 });
    t.after(() => service.close());
    const peers = await Promise.all(Array.from({ length: 12 }, () => connect(service.url)));
    t.after(() => Promise.all(peers.map(p => p.client.close())));
    assert.equal(service.sessionCount, 12);
    await Promise.all(peers.map(async ({ client }, i) => {
        const tools = await client.listTools();
        assert.equal(tools.tools.length, 15);
        await call(client, 'collect_selected_blocks', block(`hero-${i}`));
        await call(client, 'collect_selected_components', component(`button-${i}`));
    }));
    await Promise.all(peers.map(async ({ client }, i) => {
        assert.deepEqual(payload(await call(client, 'collect_selected_blocks', block('', 'list'))).collectedBlocks,
            [{ blockName: `hero-${i}`, blockType: 'hero' }]);
        assert.deepEqual(payload(await call(client, 'collect_selected_components', component('', 'list'))).collectedComponents,
            [{ componentName: `button-${i}`, componentType: 'button' }]);
        assert.equal((await call(client, 'get_add_command_for_items')).content[0].text,
            `npx shadcn@latest add @ss-blocks/hero-${i}`);
        assert.equal((await call(client, 'get_add_command_for_components')).content[0].text,
            `npx shadcn@latest add @ss-components/button-${i}`);
        assert.equal(payload(await call(client, 'collect_selected_blocks', block('', 'list'))).totalBlocks, 0);
    }));
    const oldId = peers[0].transport.sessionId;
    await peers[0].transport.terminateSession();
    assert.equal(service.sessionCount, 11);
    const stale = await post(service.url, { jsonrpc: '2.0', id: 2, method: 'tools/list' }, { 'mcp-session-id': oldId });
    assert.equal(stale.status, 404);
    assert.equal((await peers[1].client.listTools()).tools.length, 15);
});

test('explicit item lists remain independent even within one shared session', async t => {
    const service = await startHttpServer({ port: 0 });
    t.after(() => service.close());
    const { client } = await connect(service.url);
    t.after(() => client.close());
    const results = await Promise.all(['one', 'two'].map(item => call(client, 'get_add_command_for_items', {
        useCollectedBlocks: false, items: [`@ss-blocks/${item}`],
    })));
    assert.deepEqual(results.map(r => r.content[0].text), [
        'npx shadcn@latest add @ss-blocks/one', 'npx shadcn@latest add @ss-blocks/two',
    ]);
});

test('session limit, idle expiry, reinitialization and shutdown release resources', async t => {
    const service = await startHttpServer({ port: 0, maxSessions: 1, sessionTimeoutMs: 80 });
    t.after(() => service.close());
    const initial = await post(service.url, initialize);
    assert.equal(initial.status, 200);
    const id = initial.headers.get('mcp-session-id');
    assert.ok(id);
    assert.equal((await post(service.url, initialize)).status, 503);
    const deadline = Date.now() + 2000;
    while (service.sessionCount && Date.now() < deadline) await new Promise(r => setTimeout(r, 20));
    assert.equal(service.sessionCount, 0);
    assert.equal((await post(service.url, { jsonrpc: '2.0', id: 2, method: 'tools/list' }, { 'mcp-session-id': id })).status, 404);
    assert.equal((await post(service.url, initialize)).status, 200);
    await service.close();
    await service.close();
    assert.equal(service.sessionCount, 0);
    await assert.rejects(fetch(service.url));
});

test('auth, Host/Origin, bad bodies and methods are rejected before sessions are allocated', async t => {
    const service = await startHttpServer({ port: 0, token: 'test-only-token' });
    t.after(() => service.close());
    const auth = { Authorization: 'Bearer test-only-token' };
    assert.equal((await post(service.url, initialize)).status, 401);
    assert.equal((await post(service.url, initialize, { ...auth, Origin: 'https://example.com' })).status, 403);
    const hostStatus = await new Promise((resolve, reject) => {
        const req = request(service.url, { method: 'POST', headers: { ...auth, Host: 'attacker.example' } }, res => {
            res.resume(); resolve(res.statusCode);
        });
        req.on('error', reject); req.end();
    });
    assert.equal(hostStatus, 403);
    assert.equal((await post(service.url, { jsonrpc: '2.0', id: 2, method: 'tools/list' }, auth)).status, 400);
    assert.equal((await fetch(service.url, { method: 'PUT', headers: auth })).status, 405);
    assert.equal((await fetch(service.url, { method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: '{' })).status, 400);
    assert.equal((await post(service.url, { text: 'x'.repeat(1024 * 1024) }, auth)).status, 413);
    assert.equal(service.sessionCount, 0);
    const peer = await connect(service.url, 'test-only-token');
    t.after(() => peer.client.close());
    assert.equal((await peer.client.listTools()).tools.length, 15);
});

test('rejected initialization does not consume session capacity', async t => {
    const service = await startHttpServer({ port: 0, maxSessions: 1 });
    t.after(() => service.close());
    const res = await fetch(service.url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(initialize) });
    assert.equal(res.status, 406);
    assert.equal(service.sessionCount, 0);
    assert.equal((await post(service.url, initialize)).status, 200);
});

test('stdio still exposes the same tools without an HTTP listener', async t => {
    const transport = new StdioClientTransport({ command: process.execPath, args: ['build/index.js'], stderr: 'pipe' });
    const client = new Client({ name: 'stdio-test', version: '1' });
    t.after(() => client.close());
    await client.connect(transport);
    assert.equal((await client.listTools()).tools.length, 15);
    assert.equal((await call(client, 'install-theme', { themeName: 'Modern Minimal' })).isError, undefined);
});

test('environment configuration rejects invalid limits', () => {
    assert.equal(httpOptionsFromEnv({}).port, 38473);
    for (const value of ['0', '-1', 'abc', '1.5', 'Infinity']) {
        assert.throws(() => httpOptionsFromEnv({ MCP_HTTP_MAX_SESSIONS: value }));
    }
    assert.throws(() => httpOptionsFromEnv({ MCP_HTTP_PORT: '65536' }));
});

test('open event stream counts toward request limit and closes on idle expiry', async t => {
    const service = await startHttpServer({ port: 0, maxInFlight: 1, sessionTimeoutMs: 200 });
    t.after(() => service.close());
    const initial = await post(service.url, initialize);
    await initial.json();
    const id = initial.headers.get('mcp-session-id');
    const stream = await fetch(service.url, { headers: {
        Accept: 'text/event-stream', 'mcp-session-id': id, 'mcp-protocol-version': '2025-03-26',
    } });
    assert.equal(stream.status, 200);
    assert.equal((await post(service.url, initialize)).status, 503);
    const deadline = Date.now() + 2000;
    while (service.sessionCount && Date.now() < deadline) await new Promise(r => setTimeout(r, 20));
    assert.equal(service.sessionCount, 0);
    await stream.text();
    assert.equal((await post(service.url, initialize)).status, 200);
});

test('collection size is bounded without changing existing entries', async t => {
    const service = await startHttpServer({ port: 0 });
    t.after(() => service.close());
    const { client } = await connect(service.url);
    t.after(() => client.close());
    for (let i = 0; i < 100; i++) {
        await call(client, 'collect_selected_blocks', { blockName: `block-${i}`, blockType: `type-${i}`, action: 'add' });
    }
    const overflow = await call(client, 'collect_selected_blocks', { blockName: 'extra', blockType: 'extra', action: 'add' });
    assert.equal(overflow.isError, true);
    assert.equal(payload(await call(client, 'collect_selected_blocks', block('', 'list'))).totalBlocks, 100);
    const replacement = await call(client, 'collect_selected_blocks', { blockName: 'replacement', blockType: 'type-0', action: 'add' });
    assert.equal(payload(replacement).totalBlocks, 100);
});
