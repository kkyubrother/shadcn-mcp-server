import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { readFile } from 'node:fs/promises';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

test('HTTP CLI serves 24 clients without child processes and exits on SIGTERM', { timeout: 15000 }, async t => {
    const reservation = createServer();
    await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
    const port = reservation.address().port;
    await new Promise(resolve => reservation.close(resolve));
    const child = spawn(process.execPath, ['build/index.js', '--transport=streamable-http'], {
        env: { ...process.env, MCP_HTTP_PORT: String(port), MCP_HTTP_TOKEN: '', API_KEY: '', EMAIL: '',
            MCP_HTTP_MAX_SESSIONS: '64', MCP_HTTP_MAX_IN_FLIGHT: '64', MCP_HTTP_SESSION_TIMEOUT_MS: '600000' },
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    t.after(() => { if (child.exitCode === null) child.kill('SIGKILL'); });
    const exited = new Promise((resolve, reject) => {
        child.once('exit', (code, signal) => resolve({ code, signal }));
        child.once('error', reject);
    });
    await new Promise((resolve, reject) => {
        let logs = '';
        const timer = setTimeout(() => reject(new Error('HTTP CLI startup timeout')), 5000);
        child.once('exit', () => { clearTimeout(timer); reject(new Error('HTTP CLI exited before ready')); });
        child.stderr.on('data', chunk => {
            logs += chunk.toString();
            if (logs.includes('Streamable HTTP listening')) { clearTimeout(timer); resolve(); }
        });
    });
    const peers = [];
    t.after(() => Promise.all(peers.map(p => p.client.close())));
    await Promise.all(Array.from({ length: 24 }, async () => {
        const client = new Client({ name: 'cli-test', version: '1' });
        const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`));
        peers.push({ client, transport });
        await client.connect(transport);
        assert.equal((await client.listTools()).tools.length, 15);
    }));
    if (process.platform === 'linux') {
        const children = await readFile(`/proc/${child.pid}/task/${child.pid}/children`, 'utf8');
        assert.equal(children.trim(), '');
        const status = await readFile(`/proc/${child.pid}/status`, 'utf8');
        t.diagnostic(`24 connected clients; child processes: 0; ${status.match(/^VmRSS:.*$/m)?.[0]}`);
    }
    child.kill('SIGTERM');
    const exit = await exited;
    assert.deepEqual(exit, { code: 0, signal: null });
});
