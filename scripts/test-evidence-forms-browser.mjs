import {runEvidenceFormTests} from './evidence-form-browser-cases.mjs';
import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import net from 'node:net';
import { randomBytes } from 'node:crypto';

// Small CDP transport for Node installations whose built-in WebSocket stalls.
class CDPSocket {
  constructor(address) {
    const url = new URL(address); this.buffer = Buffer.alloc(0); this.ready = false;
    this.connection = net.connect(Number(url.port), url.hostname, () => this.connection.write(`GET ${url.pathname} HTTP/1.1\r\nHost: ${url.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${randomBytes(16).toString('base64')}\r\nSec-WebSocket-Version: 13\r\n\r\n`));
    this.connection.on('error', e => this.onerror?.(e));
    this.connection.on('data', chunk => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      if (!this.ready) { const end = this.buffer.indexOf('\r\n\r\n'); if (end < 0) return; if (!this.buffer.toString('utf8', 0, end).includes(' 101 ')) return this.onerror?.(Error('WebSocket upgrade failed')); this.buffer = this.buffer.subarray(end + 4); this.ready = true; this.onopen?.(); }
      while (this.buffer.length >= 2) {
        let length = this.buffer[1] & 127, offset = 2;
        if (length === 126) { if (this.buffer.length < 4) return; length = this.buffer.readUInt16BE(2); offset = 4; }
        else if (length === 127) { if (this.buffer.length < 10) return; length = Number(this.buffer.readBigUInt64BE(2)); offset = 10; }
        if (this.buffer.length < offset + length) return;
        const opcode = this.buffer[0] & 15; const payload = this.buffer.subarray(offset, offset + length); this.buffer = this.buffer.subarray(offset + length);
        if (opcode === 1) this.onmessage?.({ data: payload.toString() });
      }
    });
  }
  send(text) { const payload = Buffer.from(text), mask = randomBytes(4), header = Buffer.alloc(payload.length < 126 ? 2 : 4); header[0] = 129; header[1] = 128 | (payload.length < 126 ? payload.length : 126); if (payload.length >= 126) header.writeUInt16BE(payload.length, 2); const masked = Buffer.from(payload); for (let i = 0; i < masked.length; i++) masked[i] ^= mask[i % 4]; this.connection.write(Buffer.concat([header, mask, masked])); }
  close() { this.connection.destroy(); }
}

const watchdog = setTimeout(() => { console.error('Browser test timeout'); process.exit(1); }, 90000);
const profile = await mkdtemp(join(tmpdir(), 'ltip-browser-test-'));
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5198', '--strictPort'], { stdio: 'ignore', windowsHide: true });
const chrome = spawn(process.env.LTIP_TEST_BROWSER || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', ['--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--remote-allow-origins=*', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=9297', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
const delay = ms => new Promise(r => setTimeout(r, ms));
async function poll(url) { for (let i = 0; i < 100; i++) { try { const r = await fetch(url); if (r.ok) return r; } catch {} await delay(150); } throw Error('Server unavailable: ' + url); }
let socket;
try {
  await poll('http://127.0.0.1:5198/LTIP_LIBYA/'); await poll('http://127.0.0.1:9297/json/version');
  const tab = await (await fetch('http://127.0.0.1:9297/json/new?about:blank', { method: 'PUT' })).json();
  socket = new CDPSocket(tab.webSocketDebuggerUrl.replace('localhost', '127.0.0.1')); await new Promise((r, reject) => { socket.onopen = r; socket.onerror = reject; });
  let id = 0; const pending = new Map(); const errors = [];
  socket.onmessage = event => { const msg = JSON.parse(event.data); if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.text); if (msg.id) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.reject(Error(msg.error.message)); else p.resolve(msg.result); } };
  const call = (method, params = {}) => new Promise((resolve, reject) => { const next = ++id; const timer = setTimeout(() => reject(Error('CDP timeout: ' + method)), 15000); pending.set(next, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } }); socket.send(JSON.stringify({ id: next, method, params })); });
  const evaluate = async expression => { const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails)); return result.result.value; };
  console.log('Connected to browser'); await call('Runtime.enable'); await call('Page.enable');
  await runEvidenceFormTests({call,evaluate,delay});
  assert.deepEqual(errors,[]);
} finally { clearTimeout(watchdog); socket?.close(); chrome.kill(); vite.kill(); chrome.unref(); vite.unref(); }
