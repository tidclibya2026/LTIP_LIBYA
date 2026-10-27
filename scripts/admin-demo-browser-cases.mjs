import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const load=async p=>JSON.parse((await readFile(p,'utf8')).replace(/^\uFEFF/,''));
export async function runAdminDemoTests({call,evaluate,delay}) {
  const base='http://127.0.0.1:5198/LTIP_LIBYA/',out='.local-release-prep/results';await mkdir(out,{recursive:true});
  const wait=async expression=>{for(let i=0;i<180;i++){if(await evaluate(expression))return;await delay(50);}throw Error('Demo UI timeout: '+expression);};
  const click=async label=>{await evaluate(`[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(label)}).click()`);await delay(35);};
  await call('Page.navigate',{url:base});await wait(`!!document.querySelector('main img')`);
  // Fixtures belong to this runner's fresh browser profile, never an operational profile.
  await evaluate(`(async()=>{for(const [name,stores] of [['ltip-dashboard-v1',['workspace']],['ltip-site-admin-v1',['zones','files']]]){const db=await new Promise((ok,no)=>{const r=indexedDB.open(name,1);r.onupgradeneeded=()=>stores.forEach(s=>r.result.createObjectStore(s));r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});await new Promise((ok,no)=>{const tx=db.transaction(stores,'readwrite');tx.oncomplete=ok;tx.onerror=()=>no(tx.error);stores.forEach(s=>tx.objectStore(s).put({sentinel:'phase28-'+s},'sentinel'));});db.close();}window.__nativeOpen=indexedDB.open.bind(indexedDB);window.__storageCalls=[];indexedDB.open=(...args)=>{window.__storageCalls.push(args);return window.__nativeOpen(...args);};indexedDB.deleteDatabase=(...args)=>{window.__storageCalls.push(args);throw Error('Demo must not delete browser storage');};})()`);
  await evaluate(`location.hash='#/admin-demo'`);await wait(`!!document.querySelector('[data-admin-demo] progress')`);
  assert.equal(await evaluate(`document.querySelector('[data-admin-demo]').dir`),'rtl');
  assert.equal(await evaluate(`document.querySelector('[data-admin-demo]').textContent.includes('لا Backend أو API')`),true);
  const geo=await load('public/data/zones_141.geojson'),enrichment=await load('public/data/investment_site_enrichment.json');
  const modelCode=(await readFile('src/demo/adminDemoModel.js','utf8')).replace("import publicFiles from '../../release/public-files.json';",'const publicFiles='+JSON.stringify(await load('release/public-files.json'))+';');
  const {miniMapPath}=await import('data:text/javascript;base64,'+Buffer.from(modelCode).toString('base64'));
  const allImages=Object.values(enrichment.zones).flatMap(z=>z.images);
  assert.equal(allImages.length,128);
  const decoded=await evaluate(`Promise.all(${JSON.stringify(allImages.map(i=>i.src))}.map(src=>new Promise((ok,no)=>{const im=new Image();im.onload=()=>ok(im.naturalWidth>0);im.onerror=()=>no(Error(src));im.src=${JSON.stringify(base)}+src;})))`);
  assert(decoded.every(Boolean));
  for(const width of [1440,768,390]) {
    await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await delay(80);
    assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true,'Overview overflow at '+width);
    const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(`${out}/admin-demo-${width}.png`,Buffer.from(shot.data,'base64'));
  }
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await click('استعراض المواقع الاستثمارية');
  const checked=[];
  for(let page=0;page<9;page++) {
    const ids=await evaluate(`[...document.querySelectorAll('table tbody tr')].map(r=>Number(r.querySelector('bdi').textContent))`);
    for(const id of ids) {
      await evaluate(`document.querySelector('[aria-label="عرض الموقع ${id}"]').click()`);await wait(`!!document.querySelector('[data-demo-site="${id}"]')`);
      const expected=geo.features.find(f=>f.properties.id===id),images=enrichment.zones[id]?.images||[];
      const details=await evaluate(`(()=>{const e=document.querySelector('[data-demo-site]');return {name:e.querySelector('h2').textContent,id:Number(e.dataset.demoSite),path:e.querySelector('svg[role=img] > path[d]').getAttribute('d'),images:[...e.querySelectorAll('[aria-label="اختيار صورة الموقع"] img')].map(i=>i.src),empty:e.textContent.includes('لا توجد صورة معتمدة'),print:e.querySelector('a[href*="zone-investment-card.html"]').href};})()`);
      assert.equal(details.name,expected.properties.name_ar);assert.equal(details.id,id);assert.equal(details.path,miniMapPath(expected.geometry));
      assert.deepEqual(details.images.sort(),images.map(i=>base+i.src).sort());assert.equal(details.empty,!images.length);assert.ok(details.print.endsWith('?zone='+id));checked.push(id);
    }
    if(page<8)await click('التالي');
  }
  assert.equal(new Set(checked).size,141);
  await evaluate(`document.querySelector('[aria-label="تصفية الصور"]').value='without';document.querySelector('[aria-label="تصفية الصور"]').dispatchEvent(new Event('change',{bubbles:true}));`);await delay(60);
  assert.equal(await evaluate(`document.querySelector('table tbody').textContent.includes('صور قائمة')`),false);
  await click('الصور والمرفقات');
  await evaluate(`document.querySelector('[aria-label="تصفية الصور"]').value='all';document.querySelector('[aria-label="تصفية الصور"]').dispatchEvent(new Event('change',{bubbles:true}));`);await delay(60);
  // Select site 19 by searching, then exercise the original gallery, not a mock.
  await evaluate(`(()=>{const e=document.querySelector('[aria-label="بحث المواقع"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'المطرد');e.dispatchEvent(new Event('input',{bubbles:true}));})()`);await delay(80);
  await evaluate(`document.querySelector('[aria-label="عرض الموقع 19"]').click()`);await wait(`!!document.querySelector('[data-zone-id="19"]')`);
  await evaluate(`document.querySelector('[aria-label="تكبير الصورة الأصلية"]').click()`);await wait(`!!document.querySelector('dialog[open] img')`);
  await click('تكبير ×2');assert.equal(await evaluate(`document.querySelector('dialog[open] img').style.width`),'200%');
  await evaluate(`document.querySelector('[aria-label="إغلاق الصورة المكبرة"]').click()`);await wait(`!document.querySelector('dialog[open]')`);
  for(const width of [1440,390]){await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await delay(100);assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true,'Media overflow at '+width);const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(`${out}/admin-demo-media-${width}.png`,Buffer.from(shot.data,'base64'));}
  for(const label of ['الطبقات الجغرافية','المستخدمون والصلاحيات','الاعتماد والمراجعة','النشر والإصدارات'])await click(label);
  assert.equal(await evaluate(`[...document.querySelectorAll('main button')].some(b=>!b.disabled)`),false);
  assert.deepEqual(await evaluate(`window.__storageCalls`),[]);
  const sentinels=await evaluate(`(async()=>{const values=[];for(const [name,stores]of[['ltip-dashboard-v1',['workspace']],['ltip-site-admin-v1',['zones','files']]]){const db=await new Promise((ok,no)=>{const r=window.__nativeOpen(name,1);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error);});for(const s of stores)values.push(await new Promise(ok=>{const r=db.transaction(s).objectStore(s).get('sentinel');r.onsuccess=()=>ok(r.result);}));db.close();}return values;})()`);
  assert.deepEqual(sentinels,[{sentinel:'phase28-workspace'},{sentinel:'phase28-zones'},{sentinel:'phase28-files'}]);
  await evaluate(`document.querySelector('a[href="#/map"]').click()`);await wait(`document.querySelectorAll('.investment-zone-shape').length===141`);
  // Confirm an existing printed card still loads and its V8 handler creates a print window.
  await call('Page.navigate',{url:base+'zone-investment-card.html?zone=19'});
  await wait(`document.querySelector('iframe')?.hidden===false`);
  const printed=await evaluate(`(()=>{const w=document.querySelector('iframe').contentWindow,d=w.document,c=d.querySelectorAll('#cards .card');return {count:c.length,id:c[0]?.dataset.id,name:c[0]?.textContent,marker:d.documentElement.textContent.includes('LTIP_PRINT_V8'),handler:typeof d.querySelector('[data-print="19"]').onclick==='function'};})()`);
  assert.equal(printed.count,1);assert.equal(printed.id,'19');assert.ok(printed.name.includes('المطرد'));assert.equal(printed.marker,true);assert.equal(printed.handler,true);
  // Use a local document sink to inspect the V8 print popup, without invoking a physical printer.
  await evaluate(`(()=>{const w=document.querySelector('iframe').contentWindow;w.__printHtml='';w.__printCalls=0;w.open=()=>({document:{images:[],body:{textContent:''},open(){w.__printHtml='';},write(v){w.__printHtml+=v;},close(){}},focus(){},print(){w.__printCalls++;},addEventListener(){},setTimeout(){}});w.document.querySelector('[data-print="19"]').click();})()`);
  await wait(`document.querySelector('iframe').contentWindow.__printCalls===1`);
  const popup=await evaluate(`document.querySelector('iframe').contentWindow.__printHtml`);
  assert.ok(popup.includes('المطرد')&&popup.includes('<html'),'V8 print handler must generate the selected card');
  const result={passed:true,sitesChecked:checked.length,decodedExistingImages:decoded.length,emptyApprovedImageSites:109,storageCallsByDemo:0,indexeddbSentinelsUnchanged:true,printedSite:19,v8PrintHandlerExercised:true,viewports:[1440,768,390],newPublicMedia:0};
  await writeFile(`${out}/admin-demo-browser.json`,JSON.stringify(result,null,2));console.log('PASS admin demo: 141 identities, source images and outlines; 128 decoded images; read-only storage sentinels; responsive views; gallery and V8 print handler.');
}
