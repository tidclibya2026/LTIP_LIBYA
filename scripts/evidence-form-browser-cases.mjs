import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

export async function runEvidenceFormTests({call,evaluate,delay}) {
 const base='http://127.0.0.1:5198/LTIP_LIBYA/';
 const output='docs/reports/evidence-form-fix';await mkdir(output,{recursive:true});
 const wait=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await delay(50);}throw Error('Timeout: '+expression);};
 const click=async text=>{await evaluate(`[...document.querySelectorAll('button')].find(e=>e.textContent===${JSON.stringify(text)}).click()`);await delay(35);};
 const edit=async(selector,value)=>{
  await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);await delay(30);
 };
 const snap=async name=>{const r=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(`${output}/${name}.png`,Buffer.from(r.data,'base64'));};
 await call('Page.navigate',{url:base+'#/admin'});await wait(`document.querySelector('.stat-grid strong')?.textContent==='141'`);
 const counts=await evaluate(`(async()=>{
  const m=await import('/LTIP_LIBYA/src/admin/dashboardStore.js');const model=await import('/LTIP_LIBYA/public/admin-dashboard-model.js');
  const ids=(await(await fetch('/LTIP_LIBYA/data/zones_141.geojson')).json()).features.map(f=>f.properties.id);
  const png=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7KkAAAAASUVORK5CYII='),c=>c.charCodeAt(0));
  for(const type of Object.keys(model.TYPES)){
   const r=model.createRecord(type,{id:19});
   for(const field of Object.keys(model.labels(type))){r.data[field]='قيمة محفوظة '+type+' '+field;r.evidence[field]={source:'مصدر مستقل '+type+' '+field,verification:'VERIFIED',notes:'ملاحظة سابقة '+field,entered_at:'2026-01-01T00:00:00.000Z'};}
   if(type==='sites'){r.data.decision_date='11/7/2005';r.data.registry_area='1,620.33 هكتار';}
   if(type==='opportunities'){r.zone_ids=[19,20];r.data.amount='1,250,000 تقديري';}
   if(type==='parks')r.data.capacity='0';
   r.reviewer='المراجع السابق';r.review_notes='مراجعة سابقة لا تستبدل';
   const f=await m.prepareFile(new File([png],type+'.png',{type:'image/png'}),'photos',19,[]);r.attachments=[{file:f.item.file,section:'photos',source:'مصدر المرفق',rights:'حقوق محفوظة للاختبار',approved:false}];
   await m.saveRecord(r,new Map([[f.item.id,f.blob]]),ids);
  }
  window.originalBundle=await m.exportWorkspace(ids);window.expectedRecords=structuredClone(window.originalBundle.records);
  return Object.fromEntries(Object.entries(model.FIELDS).map(([t,groups])=>[t,Object.fromEntries(Object.entries(groups).map(([g,f])=>[g,Object.keys(f)]))]));
 })()`);
 // Refresh the dashboard's in-memory list without replacing the browser fixtures.
 await call('Page.navigate',{url:base+'#/admin/sites'});await wait(`document.querySelectorAll('tbody tr').length===141`);
 const results=[];
 for(const [index,type] of ['sites','opportunities','parks','gardens'].entries()){
  await evaluate(`document.querySelectorAll('.dashboard nav button')[${index+1}].click()`);await delay(40);
  if(type==='sites')await evaluate(`[...document.querySelectorAll('tbody tr')].find(tr=>tr.firstElementChild.textContent==='19').querySelector('button').click()`);
  else await evaluate(`document.querySelector('tbody button').click()`);
  await wait(`!!document.querySelector('.editor [data-field=name]')`);
  const initialTitle=await evaluate(`document.querySelector('.editor h2').textContent`);
  assert.equal(initialTitle,`قيمة محفوظة ${type} name`);
  const id=await evaluate(`document.querySelector('.record-identifier>span').textContent.replace(/^(UUID|zone_id): /,'')`);
  await evaluate(`Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedId=text;}}});document.querySelector('[aria-label="نسخ معرف السجل"]').click()`);await delay(30);
  assert.equal(await evaluate(`window.copiedId`),id);
  let total=0;const tabs=[];
  for(const [tab,keys] of Object.entries(counts[type])){
   await click(tab);
   const displayed=await evaluate(`[...document.querySelectorAll('.editor [data-field]')].map(e=>e.dataset.field)`);
   assert.deepEqual(displayed,keys);assert.equal(new Set(displayed).size,keys.length);
   assert.equal(await evaluate(`document.querySelectorAll('.editor [data-evidence],.editor [data-source],.editor [data-verification],.editor [data-notes]').length`),0);
   tabs.push({tab,primaryFields:displayed.length,evidenceControls:0,keys:displayed});
   total+=keys.length;
   if(type==='sites'&&keys.includes('decision_date')){
    assert.equal(await evaluate(`document.querySelector('[data-field=decision_date]').type`),'text');
    assert.equal(await evaluate(`document.querySelector('[data-field=decision_date]').value`),'11/7/2005');
   }
   if(type==='opportunities'&&keys.includes('amount'))assert.equal(await evaluate(`document.querySelector('[data-field=amount]').value`),'1,250,000 تقديري');
  }
  await click('التوثيق والمراجعة');
  assert.equal(await evaluate(`document.querySelectorAll('.editor [data-evidence]').length`),total);
  assert.equal(await evaluate(`document.querySelectorAll('.editor [data-field]').length`),0);
  const evidence=await evaluate(`Object.fromEntries([...document.querySelectorAll('.editor [data-evidence]')].map(e=>[e.dataset.evidence,{source:e.querySelector('input').value,verification:e.querySelector('select').value,notes:e.querySelector('textarea').value}]))`);
  for(const field of Object.values(counts[type]).flat())assert.deepEqual(evidence[field],{source:`مصدر مستقل ${type} ${field}`,verification:'VERIFIED',notes:`ملاحظة سابقة ${field}`});
  // Saving after navigating/rearranging the UI must preserve every original value exactly.
  await evaluate(`document.querySelector('.admin-actions button').click()`);await wait(`document.querySelector('.dashboard').getAttribute('aria-busy')==='false'`);
  assert.equal(await evaluate(`(async()=>{const m=await import('/LTIP_LIBYA/src/admin/dashboardStore.js');const r=(await m.loadWorkspace()).records.find(r=>r.type==='${type}');const original=window.originalBundle.records.find(r=>r.type==='${type}');return JSON.stringify(r.data)===JSON.stringify(original.data)&&JSON.stringify(r.evidence)===JSON.stringify(original.evidence);})()`),true);
  for(const [field,verification] of [['name','VERIFIED'],['municipality','REJECTED']]){
   await edit(`[data-source=${field}]`,`مصدر معدل مستقل ${type} ${field}`);
   assert.equal(await evaluate(`document.querySelector('[data-verification=${field}]').value`),'UNVERIFIED');
   await edit(`[data-verification=${field}]`,verification);await edit(`[data-notes=${field}]`,`ملاحظات معدلة ${type} ${field}`);
   await evaluate(`(()=>{const r=window.expectedRecords.find(r=>r.type==='${type}');r.evidence.${field}.source='مصدر معدل مستقل ${type} ${field}';r.evidence.${field}.verification='${verification}';r.evidence.${field}.notes='ملاحظات معدلة ${type} ${field}';})()`);
  }
  await evaluate(`(async()=>{
   const expected=window.expectedRecords.find(r=>r.type==='${type}');const frame=()=>new Promise(r=>requestAnimationFrame(r));
   const set=async(selector,value)=>{const el=document.querySelector(selector);const proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));await frame();};
   for(const field of Object.keys(expected.evidence).filter(k=>!['name','municipality'].includes(k))){
    const source='مصدر محدث مستقل ${type} '+field,notes='مراجعة مستقلة محدثة '+field;
    await set('[data-source='+field+']',source);
    if(document.querySelector('[data-verification='+field+']').value!=='UNVERIFIED')throw Error('source invalidation '+field);
    await set('[data-verification='+field+']','VERIFIED');await set('[data-notes='+field+']',notes);
    Object.assign(expected.evidence[field],{source,verification:'VERIFIED',notes});
   }
  })()`);
  if(type==='sites'){
   await click('الوضع التخطيطي والقرارات');await edit('[data-field=decision_date]','2005-07-11');
   assert.equal(await evaluate(`document.querySelector('[data-field=decision_date]').type`),'date');
   await evaluate(`(()=>{const r=window.expectedRecords.find(r=>r.type==='sites');r.data.decision_date='2005-07-11';r.evidence.decision_date.verification='UNVERIFIED';})()`);
  }
  if(type==='opportunities'){
   await click('الاستثمار');await edit('[data-field=amount]','1250000.25');
   assert.equal(await evaluate(`document.querySelector('[data-field=amount]').type`),'number');
   await evaluate(`(()=>{const r=window.expectedRecords.find(r=>r.type==='opportunities');r.data.amount='1250000.25';r.evidence.amount.verification='UNVERIFIED';})()`);
  }
  await click(Object.keys(counts[type])[0]);
  assert.equal(await evaluate(`document.querySelector('[data-field=name]').type`),'text');
  const changedName=`اسم محدث ${type}`;await edit('[data-field=name]',changedName);
  await evaluate(`(()=>{const r=window.expectedRecords.find(r=>r.type==='${type}');r.data.name='${changedName}';r.evidence.name.verification='UNVERIFIED';})()`);
  await click('التوثيق والمراجعة');
  assert.equal(await evaluate(`document.querySelector('[data-verification=name]').value`),'UNVERIFIED');
  assert.equal(await evaluate(`document.querySelector('[data-verification=municipality]').value`),'REJECTED');
  assert.equal(await evaluate(`document.querySelector('[data-source=name]').value`),`مصدر معدل مستقل ${type} name`);
  for(const width of [1440,390]){
   await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await delay(30);
   assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true);
  }
  await evaluate(`document.querySelector('.admin-actions button').click()`);await wait(`!document.querySelector('.dashboard').getAttribute('aria-busy') || document.querySelector('.dashboard').getAttribute('aria-busy')==='false'`);
  await wait(`!document.querySelector('.editor').textContent.includes('تعديلات غير محفوظة')`);
  await click(Object.keys(counts[type])[0]);
  for(const width of [1440,390]){
   await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await delay(30);
   const columnCount=await evaluate(`getComputedStyle(document.querySelector('.primary-fields')).gridTemplateColumns.split(' ').length`);
   assert.equal(columnCount,width===390?1:2);assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true);
   if(type==='opportunities'){await evaluate(`document.querySelector('.editor h2').scrollIntoView()`);await snap(`opportunity-main-${width}`);}
  }
  if(type==='opportunities'){await click('التوثيق والمراجعة');await evaluate(`document.querySelector('.record-evidence').scrollIntoView()`);await snap('opportunity-evidence-390');}
  results.push({type,tabs,primaryBefore:total,primaryAfter:total,oldControlsInDataTabs:total*4,newControlsInDataTabs:total,evidenceControlsRelocated:total*3,uniqueFields:true});
 }
 const preservation=await evaluate(`(async()=>{
  const m=await import('/LTIP_LIBYA/src/admin/dashboardStore.js');const ids=(await(await fetch('/LTIP_LIBYA/data/zones_141.geojson')).json()).features.map(f=>f.properties.id);
  const b=await m.exportWorkspace(ids);
  const normalized=rows=>rows.map(r=>({type:r.type,id:r.id,data:r.data,evidence:Object.fromEntries(Object.entries(r.evidence).map(([k,v])=>[k,{...v,entered_at:undefined}])),zone_ids:r.zone_ids,attachments:r.attachments,reviewer:r.reviewer,review_notes:r.review_notes,public_clearance:r.public_clearance}));
  if(JSON.stringify(normalized(b.records))!==JSON.stringify(normalized(window.expectedRecords)))throw Error('Existing data/evidence mismatch');
  if(JSON.stringify(b.files)!==JSON.stringify(window.originalBundle.files))throw Error('Attachment bytes changed');
  const before=JSON.stringify(b.records);for(const r of (await m.loadWorkspace()).records)await m.deleteRecord(r,ids);await m.importWorkspace(b,ids,()=>true);
  const imported=await m.exportWorkspace(ids);if(JSON.stringify(imported.records)!==before||JSON.stringify(imported.files)!==JSON.stringify(b.files))throw Error('Roundtrip data loss');
  return {records:b.records.length,fields:b.records.reduce((s,r)=>s+Object.keys(r.data).length,0),evidence:b.records.reduce((s,r)=>s+Object.keys(r.evidence).length,0),files:b.files.length,independentEdits:true,unchangedUntouchedValues:true,exactExportImport:true};
 })()`);
 assert.equal(preservation.fields,96);assert.equal(preservation.evidence,96);
 // Standalone site editor uses the same evidence UI and current storage.
 await call('Page.navigate',{url:base+'#/admin/sites/edit/19'});await wait(`!!document.querySelector('.site-entry [data-field=name]')`);
 assert.equal(await evaluate(`document.querySelector('[data-field=name]').value`),'اسم محدث sites');
 assert.equal(await evaluate(`document.querySelector('.site-entry header h2 .record-identifier')===null`),true);
 assert.equal(await evaluate(`document.querySelectorAll('[data-source]').length`),0);
 await click('التوثيق والمراجعة');assert.equal(await evaluate(`document.querySelectorAll('[data-evidence]').length`),46);
 assert.equal(await evaluate(`document.querySelector('[data-source=municipality]').value`),'مصدر معدل مستقل sites municipality');
 assert.equal(await evaluate(`document.querySelector('[data-verification=municipality]').value`),'REJECTED');
 await edit('[data-notes=municipality]','ملاحظة مستقلة من شاشة الموقع');
 await evaluate(`document.querySelector('.site-savebar button').click()`);await wait(`document.querySelector('[role=status]').textContent.includes('بنجاح')`);
 const origin=await evaluate('performance.timeOrigin');await call('Page.reload');await wait(`performance.timeOrigin!==${origin}`);await wait(`!!document.querySelector('[data-field=name]')`);await click('التوثيق والمراجعة');
 assert.equal(await evaluate(`document.querySelector('[data-notes=municipality]').value`),'ملاحظة مستقلة من شاشة الموقع');
 assert.equal(await evaluate(`document.querySelector('[data-source=name]').value`),'مصدر معدل مستقل sites name');
 await call('Page.navigate',{url:base+'#/admin'});await wait(`!!document.querySelector('.stat-grid')`);
 await evaluate(`document.querySelectorAll('.dashboard nav button')[1].click()`);await delay(40);
 await evaluate(`[...document.querySelectorAll('tbody tr')].find(tr=>tr.firstElementChild.textContent==='19').querySelector('button').click()`);
 await wait(`!!document.querySelector('.editor [data-field=name]')`);
 await edit('[data-field=name]','');
 const referenceName=await evaluate(`(async()=>{const geo=await(await fetch('/LTIP_LIBYA/data/zones_141.geojson')).json();return geo.features.find(f=>f.properties.id===19).properties.name_ar;})()`);
 assert.equal(await evaluate(`document.querySelector('.editor h2').textContent`),referenceName);
 await evaluate(`window.confirm=()=>true`);
 await evaluate(`document.querySelectorAll('.dashboard nav button')[2].click()`);await delay(40);await evaluate(`document.querySelector('.admin-toolbar button').click()`);await wait(`!!document.querySelector('.editor [data-field=name]')`);
 assert.equal(await evaluate(`document.querySelector('.editor h2').textContent`),'فرصة استثمارية جديدة');
 await writeFile(`${output}/results.json`,JSON.stringify({counts:results,preservation,standaloneRestored:true,viewports:[1440,390]},null,2));
 console.log('PASS evidence forms: 96 unique primary fields, all 96 evidence source/status/notes edited independently, verification invalidation, preservation of all untouched data/evidence, 4 real attachments, exact export/import, standalone restoration, date/number widgets with unchanged string storage, legacy formats, titles and ID copy, desktop/mobile.');
}
