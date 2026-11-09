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

const watchdog = setTimeout(() => { console.error('Browser test timeout'); process.exit(1); }, 120000);
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
  await call('Page.navigate', { url: 'http://127.0.0.1:5198/LTIP_LIBYA/#/admin' });

  for(let i=0;i<300;i++){if(await evaluate(`document.querySelector('.stat-grid strong')?.textContent==='141'`))break;await delay(100);}
  assert.equal(await evaluate(`document.querySelector('.stat-grid strong').textContent`),'141');
  const result=await evaluate(`(async()=>{
    const m=await import('/LTIP_LIBYA/src/admin/dashboardStore.js');
    const model=await import('/LTIP_LIBYA/public/admin-dashboard-model.js');
    const ids=(await(await fetch('/LTIP_LIBYA/data/zones_141.geojson')).json()).features.map(f=>f.properties.id);
    const check=(ok,msg)=>{if(!ok)throw Error(msg);};
    const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7KkAAAAASUVORK5CYII='),c=>c.charCodeAt(0));
    for(const type of Object.keys(model.TYPES)){
      let r=model.createRecord(type,{id:ids[0]});r.data.name='?????? '+type;r.evidence.name={source:'???? ????????',verification:'VERIFIED'};
      const f=await m.prepareFile(new File([png],type+'.png',{type:'image/png'}),'photos',0,[]);
      r.attachments=[{file:f.item.file,section:'photos',source:'????',rights:'????? ??????',approved:true}];
      if(type==='opportunities')r.zone_ids=[ids[0],ids[1]];
      r=await m.saveRecord(r,new Map([[f.item.id,f.blob]]),ids);check(r.status==='DRAFT','save draft');
      r.data.name+=' ????';r=await m.saveRecord(r,new Map(),ids);check(r.history.length===2,'history');
      check((await m.loadWorkspace()).records.find(x=>model.keyOf(x)===model.keyOf(r)).data.name===r.data.name,'restore');
      const b=await m.exportWorkspace(ids);check(b.files.length>0,'actual files export');await m.importWorkspace(b,ids,()=>true);
      if(type==='parks'){r.data.legal_basis='???? ???????';r.data.official_source='???? ???? ???????';for(const k of ['legal_basis','official_source'])r.evidence[k]={source:'????',verification:'VERIFIED'};}
      r.reviewer='????? ??????';r.review_notes='?????? ??????';r.public_clearance=true;r=await m.saveRecord(r,new Map(),ids);
      r.status='IN_REVIEW';r=await m.saveRecord(r,new Map(),ids,'SUBMIT');r.status='APPROVED';r=await m.saveRecord(r,new Map(),ids,'APPROVE');
      r.data.name+=' TEST_ADMIN_PRIVATE';r=await m.saveRecord(r,new Map(),ids);check(r.status==='DRAFT','edit invalidates approval');
    }
    let rejectedTransition=false;const draft=(await m.loadWorkspace()).records[0];try{await m.saveRecord({...draft,status:'APPROVED'},new Map(),ids,'APPROVE');}catch{rejectedTransition=true;}check(rejectedTransition,'approval bypass rejection');
    const b=await m.exportWorkspace(ids);check(b.records.length===4&&b.files.length===4,'four independent registries');
    const duplicate=structuredClone(b);duplicate.records.push(duplicate.records[0]);let rejected=false;try{await m.importWorkspace(duplicate,ids,()=>true);}catch{rejected=true;}check(rejected,'duplicate rejection');
    const alias=structuredClone(b);alias.records.find(r=>r.type==='sites').id='0'+ids[0];rejected=false;try{await m.importWorkspace(alias,ids,()=>true);}catch{rejected=true;}check(rejected,'canonical GIS id rejection');
    const falseApproval=structuredClone(b);falseApproval.records[0].status='APPROVED';falseApproval.records[0].reviewer='';rejected=false;try{await m.importWorkspace(falseApproval,ids,()=>true);}catch{rejected=true;}check(rejected,'unverified imported approval rejection');
    const corrupt=structuredClone(b);corrupt.files[0].base64='A'.repeat(corrupt.files[0].base64.length);rejected=false;try{await m.importWorkspace(corrupt,ids,()=>true);}catch{rejected=true;}check(rejected,'corrupt rejection');
    const bad=structuredClone(b);bad.records.find(r=>r.type==='opportunities').zone_ids=[9999];rejected=false;try{await m.importWorkspace(bad,ids,()=>true);}catch{rejected=true;}check(rejected,'relationship rejection');
    for(const r of (await m.loadWorkspace()).records)await m.deleteRecord(r,ids);check((await m.loadWorkspace()).records.length===0,'delete drafts');await m.importWorkspace(b,ids,()=>true);return {records:b.records.length,files:b.files.length};
  })()`);
  await call('Page.reload');await delay(900);
  await evaluate(`document.querySelectorAll('nav button')[2].click()`);await delay(200);
  assert.equal(await evaluate(`document.querySelectorAll('tbody tr').length`),1);
  await evaluate(`document.querySelectorAll('tbody button')[1].click()`);await delay(200);
  assert.equal(await evaluate(`document.querySelector('.editor fieldset').disabled`),true);
  await evaluate(`document.querySelectorAll('nav button')[1].click()`);await delay(200);
  assert.equal(await evaluate(`document.querySelectorAll('tbody tr').length`),141);
  // Exercise the real React input and save controls for every registry.
  for(const index of [1,2,3,4]) {
    await evaluate(`document.querySelectorAll('.dashboard nav button')[${index}].click()`);await delay(100);
    if(index===1) await evaluate(`document.querySelector('tbody button').click()`);
    else await evaluate(`document.querySelector('.admin-toolbar button').click()`);
    await delay(100);
    await evaluate(`(()=>{const input=document.querySelector('.editor [data-field=name]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'?????? ????? ?? ???????');input.dispatchEvent(new Event('input',{bubbles:true}));})()`);await delay(100);
    await evaluate(`document.querySelector('.admin-actions button').click()`);await delay(250);
    assert.equal(await evaluate(`document.querySelector('.editor [data-field=name]').value`),'?????? ????? ?? ???????');
    assert.equal(await evaluate(`document.querySelector('.editor').textContent.includes('??????? ??? ??????')`),false);
  }
  console.log('PASS actual React forms: Arabic input and draft save in all four registries.');
  await call('Page.navigate',{url:'http://127.0.0.1:5198/LTIP_LIBYA/#/map'});
  for(let i=0;i<100;i++){if(await evaluate(`document.querySelectorAll('.zones .zone').length===141`))break;await delay(100);}
  assert.equal(await evaluate(`document.querySelectorAll('.zones .zone').length`),141);
  assert.equal(await evaluate(`document.body.textContent.includes('TEST_ADMIN_PRIVATE')`),false);
  assert.deepEqual(errors,[]);
  console.log('PASS dashboard browser: all four registries create/edit/save/restore/export/import, real attachments, review and approval, invalidation, history, corrupt/duplicate/link rejection, RTL dashboard, preview, reload, 141 map sites and draft isolation.',result);
} finally { clearTimeout(watchdog); socket?.close(); chrome.kill(); vite.kill(); chrome.unref(); vite.unref(); }
