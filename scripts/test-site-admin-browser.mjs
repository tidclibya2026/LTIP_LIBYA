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
  socket.onmessage = event => { const msg = JSON.parse(event.data); if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text); if (msg.id) { const p = pending.get(msg.id); pending.delete(msg.id); if (msg.error) p.reject(Error(msg.error.message)); else p.resolve(msg.result); } };
  const call = (method, params = {}) => new Promise((resolve, reject) => { const next = ++id; const timer = setTimeout(() => reject(Error('CDP timeout: ' + method)), 15000); pending.set(next, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } }); socket.send(JSON.stringify({ id: next, method, params })); });
  const evaluate = async expression => { const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails)); return result.result.value; };
  console.log('Connected to browser'); await call('Runtime.enable'); await call('Page.enable');
  await call('Page.navigate', { url: 'http://127.0.0.1:5198/LTIP_LIBYA/#/admin?zone_id=1' });
  for (let i = 0; i < 200; i++) { if (await evaluate(`document.querySelector('.site-admin select')?.options.length === 142`)) break; await delay(150); }
  assert.equal(await evaluate(`document.querySelector('.site-admin select')?.options.length`), 142);
  console.log('Admin loaded'); const result = await evaluate(`(async () => {
    const m = await import('/LTIP_LIBYA/src/admin/draftStore.js');
    const model = await import('/LTIP_LIBYA/public/site-admin-model.js');
    const ids = (await (await fetch('/LTIP_LIBYA/data/zones_141.geojson')).json()).features.map(f=>f.properties.id);
    const zone = model.emptyZone(ids[0]);
    const png = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7KkAAAAASUVORK5CYII='), c=>c.charCodeAt(0));
    const one = await m.prepareFile(new File([png], 'one.png', {type:'image/png'}), 'photos', zone.zone_id, []);
    const two = await m.prepareFile(new File(['%PDF-1.4\\n%%EOF'], 'two.pdf', {type:'application/pdf'}), 'aerial_maps', zone.zone_id, []);
    zone.photos.push(one.item); zone.aerial_maps.push(two.item); zone.descriptive_data.overview = 'مسودة اختبار متصفح';
    await m.saveDraft(zone, new Map([[one.item.id, one.blob],[two.item.id,two.blob]]), ids);
    if ((await m.getDrafts())[0].photos.length !== 1) throw Error('draft restoration');
    const bundle = await m.exportPackage(await m.getDrafts(), ids);
    const manifest = JSON.parse(await bundle.text());
    if (manifest.files.length !== 2) throw Error('export attachments');
    let confirmed = false;
    await m.importPackage(new File([bundle], 'bundle.json'), ids, () => {confirmed=true;return true;});
    if (!confirmed || (await m.getBlob(one.item.id)).size !== png.length) throw Error('import');
    manifest.files[0].sha256 = 'f'.repeat(64);
    let corruptRejected = false; try { await m.importPackage(new File([JSON.stringify(manifest)], 'bad.json'), ids, () => true); } catch { corruptRejected=true; }
    if (!corruptRejected) throw Error('corruption accepted');
    const estimate = navigator.storage.estimate.bind(navigator.storage);
    navigator.storage.estimate = async () => ({quota:1,usage:1});
    let quotaRejected = false; try { await m.saveDraft(zone,new Map([[one.item.id,one.blob]]),ids); } catch {quotaRejected=true;}
    navigator.storage.estimate = estimate;
    if (!quotaRejected) throw Error('quota accepted');
    window.testAttachment = one.item.id;
    return {files:2, restored:true, exported:true, imported:true, corruptRejected, quotaRejected};
  })()`);
  await call('Page.reload'); await delay(1200);
  assert.equal(await evaluate(`(async()=>{const m=await import('/LTIP_LIBYA/src/admin/draftStore.js');const z=(await m.getDrafts())[0];return z.descriptive_data.overview==='مسودة اختبار متصفح' && (await m.getBlob(z.photos[0].id)).size>0;})()`), true);
  await evaluate(`(() => { const s=document.querySelector('.site-admin select'); s.value='1'; s.dispatchEvent(new Event('change',{bubbles:true})); })()`); await delay(500);
  assert.equal(await evaluate(`document.querySelectorAll('[role=tab]').length`), 6);
  await evaluate(`document.querySelectorAll('[role=tab]')[1].click()`); await delay(400);
  assert.equal(await evaluate(`document.querySelectorAll('.admin-thumb').length`), 1);
  assert.equal(await evaluate(`document.querySelector('.admin-thumb').naturalWidth > 0`), true);
  await evaluate(`document.querySelectorAll('[role=tab]')[2].click()`); await delay(200);
  assert.equal(await evaluate(`document.querySelectorAll('.site-admin iframe').length`), 1);
  assert.equal(await evaluate(`(async()=>{
    const React=(await import('/LTIP_LIBYA/node_modules/.vite/deps/react.js')).default;
    const {createRoot}=(await import('/LTIP_LIBYA/node_modules/.vite/deps/react-dom_client.js')).default;
    const {default:Details}=await import('/LTIP_LIBYA/src/components/details/ManualSiteDetails.jsx');
    const m=await import('/LTIP_LIBYA/src/admin/draftStore.js');const z=structuredClone((await m.getDrafts())[0]);
    z.review_status='APPROVED';z.publication_clearance='PUBLIC_CLEARED';z.section_review.descriptive_data='APPROVED';z.section_review.photos='APPROVED';
    z.photos[0].title='مرفق غير معتمد يجب إخفاؤه';
    const originalFetch=window.fetch; window.fetch=async (url,...rest)=>String(url).includes('site_manual_enrichment.json')?new Response(JSON.stringify({zones:{1:z}}),{headers:{'Content-Type':'application/json'}}):originalFetch(url,...rest);
    const el=document.createElement('div');document.body.append(el);const root=createRoot(el);root.render(React.createElement(Details,{zoneId:1}));
    await new Promise(r=>setTimeout(r,250));
    const okay=el.textContent.includes('مسودة اختبار متصفح')&&!el.textContent.includes('مرفق غير معتمد يجب إخفاؤه');
    root.unmount();el.remove();window.fetch=originalFetch;return okay;
  })()`), true);
  const deleted = await evaluate(`(async()=>{const m=await import('/LTIP_LIBYA/src/admin/draftStore.js');const ids=(await(await fetch('/LTIP_LIBYA/data/zones_141.geojson')).json()).features.map(f=>f.properties.id);const z=(await m.getDrafts())[0];const id=z.photos[0].id;z.photos=[];await m.saveDraft(z,new Map(),ids);return !(await m.getBlob(id));})()`); assert.equal(deleted, true);
  const libraryResult = await evaluate(`(async()=>{
    const React=(await import('/LTIP_LIBYA/node_modules/.vite/deps/react.js')).default;
    const {createRoot}=(await import('/LTIP_LIBYA/node_modules/.vite/deps/react-dom_client.js')).default;
    const {default:Library}=await import('/LTIP_LIBYA/src/components/details/SiteDocumentLibrary.jsx');
    const load=async name=>(await fetch('/LTIP_LIBYA/data/'+name)).json();
    const [geo,enrichment,legacy,manual,planning]=await Promise.all(['zones_141.geojson','investment_site_enrichment.json','zone_photos.json','site_manual_enrichment.json','zone_planning_status_141.json'].map(load));
    const el=document.createElement('div');document.body.append(el);el.style.minHeight='100px';const root=createRoot(el);
    const sources={legacy,manual:manual.zones,loading:false,error:''};
    const render=async(id,section='photos')=>{const site=geo.features.find(f=>f.properties.id===id);root.render(React.createElement(Library,{key:id+'-'+section,zoneId:id,zoneName:site.properties.name_ar,site:enrichment.zones[id],planning:planning.zones[id],sources,initialSection:section}));await new Promise(r=>setTimeout(r,20));};
    await render(19);
    if(el.querySelectorAll('[role=tab]').length!==11)throw Error('library tabs');
    for(const [key,count] of Object.entries({photos:2,aerial_maps:1,boundary_maps:1,contour_maps:0,unclassified:1})){
      const button=el.querySelector('#library-tab-19-'+key);if(!button.textContent.includes('('+count+' ملفات)'))throw Error('count '+key);
    }
    let previews=0;
    for(const section of ['photos','aerial_maps','boundary_maps','unclassified']){
      await render(19,section);el.scrollIntoView();
      const imgs=[...el.querySelectorAll('img')];
      for(const img of imgs){img.loading='eager';await Promise.race([img.decode(),new Promise((_,reject)=>setTimeout(()=>reject(Error('image timeout')),4000))]);if(!img.naturalWidth)throw Error('image load');}
      previews+=imgs.length;
    }
    el.querySelector('[aria-label="تكبير الصورة الأصلية"]').click();await new Promise(r=>setTimeout(r,30));
    if(!document.querySelector('dialog[open]'))throw Error('enlarge');document.querySelector('[aria-label="إغلاق الصورة المكبرة"]').click();
    await render(19,'decisions');if(!el.textContent.includes('203/-7-11-2005')||!el.textContent.includes('مرجع سجل فقط'))throw Error('decision disclaimer');
    if(el.querySelector('[role=tabpanel]').querySelectorAll('a').length)throw Error('invented decision file');
    await render(19,'planning_data');if(!el.textContent.includes('مُخرَّط'))throw Error('planning');
    await render(19,'descriptive_data');if(!el.textContent.includes('بداخل مدينة الزاوية'))throw Error('source description');
    await render(19,'contour_maps');if(!el.textContent.includes('لا توجد ملفات منشورة'))throw Error('invented contours');
    for(const feature of geo.features){const id=feature.properties.id;await render(id);if(el.querySelector('[data-library-zone]').dataset.libraryZone!==String(id)||el.querySelectorAll('[role=tab]').length!==11)throw Error('site '+id);}
    root.unmount();el.remove();return {sites:141,mutridPreviews:previews,sections:11,decisionDisclaimer:true,enlargement:true};
  })()`);
  await call('Page.navigate', { url: 'http://127.0.0.1:5198/LTIP_LIBYA/#/admin?zone_id=19' });
  // Wait for the destination before reloading; a cold lazy import can outlast 200 ms.
  const waitLegacy = async () => {
    for(let i=0;i<150;i++){if(await evaluate(`document.querySelector('.site-admin select')?.value==='19'`))return;await delay(75);}
    throw Error('Legacy editor not ready: '+await evaluate(`JSON.stringify({hash:location.hash,alerts:[...document.querySelectorAll('[role=alert]')].map(e=>e.textContent)})`));
  };
  await waitLegacy();
  const legacyOrigin=await evaluate('performance.timeOrigin');await call('Page.reload');
  for(let i=0;i<150;i++){if(await evaluate(`performance.timeOrigin!==${legacyOrigin}`))break;await delay(75);}
  await waitLegacy();assert.equal(await evaluate(`document.querySelector('.site-admin select')?.value`),'19');
  console.log('PASS library browser: Mutrid categories, actual image decoding/enlargement, historical decision disclaimer, source text, empty contours, rendering all 141 sites, admin zone deep link.',libraryResult);
  await call('Page.navigate',{url:'http://127.0.0.1:5198/LTIP_LIBYA/#/map'});
  for(let i=0;i<80;i++){if(await evaluate(`document.querySelectorAll('.zones .zone').length===141`))break;await delay(100);}
  assert.equal(await evaluate(`document.querySelectorAll('.zones .zone').length`),141);
  await evaluate(`[...document.querySelectorAll('.zones .zone')].find(el=>el.querySelector('.zone-index').textContent==='19').click()`);
  for(let i=0;i<50;i++){if(await evaluate(`document.querySelector('[data-library-zone="19"] [role=tab]')?.textContent.includes('(2 ملفات)')`))break;await delay(100);}
  assert.equal(await evaluate(`document.querySelector('[data-library-zone="19"] [role=tab]').textContent.includes('(2 ملفات)')`),true);
  await evaluate(`document.querySelector('[data-library-zone="19"] a').click()`);await delay(500);
  assert.equal(await evaluate(`document.querySelector('.site-admin select').value`),'19');
  console.log('PASS actual map: 141 list entries, select Mutrid, attached library and direct admin link for zone 19.');
  assert.deepEqual(errors, []);
  console.log('PASS browser: 141-site selector, six RTL tabs, IndexedDB files+metadata, export/import actual bytes, reload restoration, thumbnail, PDF preview, corrupt package and quota rejection, deleted blob cleanup.', result);
} finally { clearTimeout(watchdog); socket?.close(); chrome.kill(); vite.kill(); chrome.unref(); vite.unref(); }
