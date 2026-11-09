import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {runParkMapTests} from './parks-public-browser-cases.mjs';
export async function runReleaseTests({call,evaluate,delay,production}) {
 const base='http://127.0.0.1:5198/LTIP_LIBYA/';
 const wait=async expr=>{for(let i=0;i<160;i++){if(await evaluate(expr))return;await delay(50);}throw Error('UI timeout '+expr);};
 const click=async text=>{await evaluate(`[...document.querySelectorAll('button,a')].find(x=>x.textContent===${JSON.stringify(text)}).click()`);await delay(40);};
 const input=async(sel,value)=>{await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});const p=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);await delay(15);};
 const navigate=async id=>{await evaluate(`location.hash='#/admin/sites/edit/${id}'`);await wait(`document.querySelector('.site-id')?.textContent==='zone_id: ${id}' && !!document.querySelector('[data-field=name]') && document.querySelector('main')?.getAttribute('aria-busy')==='false'`);};
 const save=async()=>{await click('حفظ مسودة');await wait(`document.querySelector('[role=status]').textContent.includes('بنجاح')`);};
 const workspace=()=>evaluate(`(async()=>{const d=await new Promise((r,j)=>{const q=indexedDB.open('ltip-dashboard-v1',1);q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});try{return await new Promise((r,j)=>{const q=d.transaction('workspace').objectStore('workspace').get('current');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});}finally{d.close();}})()`);
 await call('Page.navigate',{url:base});await wait(`!!document.querySelector('main img')`);
 const icon=await evaluate(`document.querySelector('link[rel=icon]').href`);
 assert.ok(icon.endsWith('/LTIP_LIBYA/assets/branding/logo.png.png'));
 const iconResponse=await evaluate(`(async()=>{const r=await fetch(${JSON.stringify(icon)});return {status:r.status,type:r.headers.get('content-type')};})()`);
 assert.equal(iconResponse.status,200,JSON.stringify(iconResponse));assert.ok(iconResponse.type.startsWith('image/'),JSON.stringify(iconResponse));
 assert.equal(await evaluate(`(async()=>(await indexedDB.databases()).length)()`),0);
 const publicFiles=JSON.parse(await readFile('release/public-files.json','utf8'));
 const images=publicFiles.filter(p=>/\.(png|jpe?g)$/i.test(p));
 const decoded=await evaluate(`(async()=>{const paths=${JSON.stringify(images.map(p=>p.slice(7)))};let cursor=0,passed=0;await Promise.all(Array.from({length:6},async()=>{while(cursor<paths.length){const path=paths[cursor++];await new Promise((r,j)=>{const img=new Image();const timer=setTimeout(()=>j(Error('Image timeout '+path)),15000);img.onload=()=>{clearTimeout(timer);img.naturalWidth>0?r():j(Error('Empty image '+path));};img.onerror=()=>{clearTimeout(timer);j(Error('Image failed '+path));};img.src=${JSON.stringify(base)}+path;});passed++;}}));return passed;})()`);
 assert.equal(decoded,images.length);
 const gisPaths=publicFiles.filter(p=>p.endsWith('.geojson')).map(p=>p.slice(7));
 const layers=await evaluate(`(async()=>{const out=[];for(const path of ${JSON.stringify(gisPaths)}){const r=await fetch(${JSON.stringify(base)}+path);if(!r.ok)throw Error(path);const d=await r.json();if(d.type!=='FeatureCollection')throw Error(path);out.push({path,count:d.features.length});}return out;})()`);
 console.log('PASS decoded published images:',decoded,'GIS layers:',layers.length);
 await evaluate(`location.hash='#/map'`);await wait(`document.querySelectorAll('.zones .zone').length===141`);await wait(`!!document.querySelector('.leaflet-overlay-pane path')`);
 await runParkMapTests({call,evaluate,delay});
 const geo=JSON.parse(await readFile('public/data/zones_141.geojson','utf8'));
 for(const [index,f] of geo.features.entries()) {
  const id=f.properties.id;
  await evaluate(`[...document.querySelectorAll('.zones .zone')].find(e=>e.querySelector('.zone-index')?.textContent==='${id}').click()`);
  await wait(`!!document.querySelector('[data-library-zone="${id}"]')`);
  assert.equal(await evaluate(`document.querySelectorAll('[data-library-zone="${id}"] [role=tab]').length`),11);
  if((index+1)%35===0)console.log('Map libraries checked:',index+1);
 }
 for(const [index,f] of geo.features.entries()) {
  await navigate(f.properties.id);
  assert.equal(await evaluate(`document.querySelector('header h2').textContent`),f.properties.name_ar);
  assert.equal(await evaluate(`document.querySelectorAll('[role=tab]').length`),9);
  assert.equal(await evaluate(`document.querySelector('.gis-reference').querySelectorAll('input,textarea').length`),0);
  if((index+1)%35===0)console.log('Editors checked:',index+1);
 }
 await navigate(2);await input('[data-field=name]','سجل حارس للاختبار المعزول');await save();
 const guard=JSON.stringify((await workspace()).records);
 await navigate(1);const expected={};
 for(let i=0;i<8;i++) {
  await evaluate(`document.querySelectorAll('[role=tab]')[${i}].click()`);await delay(25);
  const fields=await evaluate(`[...document.querySelectorAll('[data-field]')].map(e=>({key:e.dataset.field,type:e.type,max:e.maxLength}))`);
  for(const f of fields){assert.equal(f.max,12000);expected[f.key]=f.type==='date'?'2026-10-22':'اختبار معزول '+f.key;await input(`[data-field="${f.key}"]`,expected[f.key]);}
 }
 await click('التوثيق والمراجعة');
 for(const key of Object.keys(expected)) {await input(`[data-source="${key}"]`,'مصدر معزول '+key);await input(`[data-notes="${key}"]`,'ملاحظة معزولة');await input(`[data-verification="${key}"]`,'VERIFIED');}
 await save();
 async function upload(tab,section,name,kind) {
  await click(tab);
  await evaluate(`(()=>{const bytes=${kind==='image'?"Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7KkAAAAASUVORK5CYII='),c=>c.charCodeAt(0))":"new TextEncoder().encode('%PDF-1.4\\n%%EOF')"};const d=new DataTransfer();d.items.add(new File([bytes],${JSON.stringify(name)},{type:${JSON.stringify(kind==='image'?'image/png':'application/pdf')}}));const e=document.querySelector('[data-upload=${section}]');e.files=d.files;e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await wait(`document.querySelectorAll('[data-attachment]').length===1`);await save();
 }
 await upload('الصور','photos','isolated.png','image');await upload('الخرائط','contour_maps','isolated-map.pdf','pdf');
 await call('Page.reload');await wait(`document.querySelector('[data-field=name]')?.value===${JSON.stringify(expected.name)}`);
 for(let i=0;i<8;i++) {await evaluate(`document.querySelectorAll('[role=tab]')[${i}].click()`);await delay(20);for(const f of await evaluate(`[...document.querySelectorAll('[data-field]')].map(e=>({key:e.dataset.field,value:e.value}))`))assert.equal(f.value,expected[f.key]);}
 await click('التوثيق والمراجعة');
 for(const key of Object.keys(expected)) {assert.equal(await evaluate(`document.querySelector('[data-source="${key}"]').value`),'مصدر معزول '+key);assert.equal(await evaluate(`document.querySelector('[data-verification="${key}"]').value`),'VERIFIED');}
 await click('الصور');await wait(`document.querySelector('[data-attachment] img')?.naturalWidth>0`);
 await evaluate(`(()=>{const d=new DataTransfer();d.items.add(new File(['bad'],'blocked.exe'));const e=document.querySelector('[data-upload=photos]');e.files=d.files;e.dispatchEvent(new Event('change',{bubbles:true}));})()`);await wait(`!!document.querySelector('[role=alert]')`);
 assert.equal(await evaluate(`document.querySelectorAll('[data-attachment]').length`),1);
 await click('الخرائط');await wait(`!!document.querySelector('[data-attachment] iframe')`);
 const ws=await workspace();assert.equal(JSON.stringify(ws.records.filter(r=>r.id!=='1')),guard);assert.equal(ws.files.length,2);
 const saved=ws.records.find(r=>r.id==='1');assert.equal(saved.status,'DRAFT');assert.equal(saved.public_clearance,false);
 await input('[data-field=map_source]','تعديل غير محفوظ');assert.equal(await evaluate(`document.querySelectorAll('.site-savebar button')[1].disabled`),true);
 await save();await call('Page.reload');await wait(`!!document.querySelector('[data-field=name]')`);
 for(const width of [1440,768,390]) {await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true);}
 await call('Page.navigate',{url:base+'#/admin/sites/edit/9999'});await wait(`!!document.querySelector('[role=alert]')`);assert.equal(await evaluate(`!!document.querySelector('[data-field=name]')`),false);
 const details={production,sites:141,editorRoutes:141,mapLibraries:141,decodedImages:decoded,gisLayers:layers,site1Fields:Object.keys(expected).length,evidenceFields:Object.keys(expected).length,site2Unchanged:true,restoredAttachments:2,favicon:icon,viewports:[1440,768,390]};
 await mkdir('.local-release-prep/results',{recursive:true});await writeFile(`.local-release-prep/results/browser-${production?'pages':'dev'}.json`,JSON.stringify(details,null,2));
 console.log('PASS 141 sites and libraries, all site 1 fields/Evidence restored, real PNG/PDF, validation, isolated site 2 preservation and responsive viewports.');
}
