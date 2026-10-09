import test from 'node:test';
import { request } from 'node:http';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { startHttpServer } from '../build/http.js';

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

test('external bind requires credentials and explicit hosts, and enforces them', async t => {
    await assert.rejects(startHttpServer({ port: 0, host: '0.0.0.0' }));
    await assert.rejects(startHttpServer({ port: 0, host: '0.0.0.0', token: 'test' }));
    await assert.rejects(startHttpServer({ port: 0, host: '0.0.0.0', token: ' ', allowedHosts: ['mcp.example.com'] }));
    const service = await startHttpServer({ port: 0, host: '0.0.0.0', token: 'test', allowedHosts: ['mcp.example.com'] });
    t.after(() => service.close());
    const url = service.url.replace('0.0.0.0', '127.0.0.1');
    async function withHost(host, token) {
        return new Promise((resolve, reject) => {
            const req = request(url, { method: 'POST', headers: {
                Host: host, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
                Accept: 'application/json, text/event-stream',
            } }, res => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
            req.on('error', reject); req.end(JSON.stringify(initialize));
        });
    }
    assert.equal(await withHost('mcp.example.com', 'test'), 200);
    assert.equal(await withHost('mcp.example.com', 'wrong'), 401);
    assert.equal(await withHost('other.example.com', 'test'), 403);
    assert.equal(service.sessionCount, 1);

});
