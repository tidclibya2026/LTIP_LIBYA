import assert from 'node:assert/strict';

export async function runEditorTests({ call, evaluate, delay }) {
 const base = 'http://127.0.0.1:5198/LTIP_LIBYA/';
 const waitFor = async (expression, attempts = 100) => { for (let i = 0; i < attempts; i++) { if (await evaluate(expression)) return; await delay(75); } throw Error('UI timeout: ' + expression); };
 const reload = async () => { const origin = await evaluate('performance.timeOrigin'); await call('Page.reload'); await waitFor(`performance.timeOrigin!==${origin}`); };
 const input = async (selector, value) => {
  await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await delay(60);
 };
 const clickText = async text => { await evaluate(`[...document.querySelectorAll('button,a')].find(el=>el.textContent===${JSON.stringify(text)}).click()`); await delay(100); };
 await call('Page.navigate', { url: base + '#/admin/sites/edit/19' });
 await waitFor(`!!document.querySelector('[data-field=name]')`, 400);
 assert.equal(await evaluate(`document.querySelector('h1').textContent`), 'إدخال وتحديث بيانات الموقع الاستثماري');
 assert.equal(await evaluate(`document.querySelector('.site-id').textContent`), 'zone_id: 19');
 assert.equal(await evaluate(`document.querySelectorAll('[role=tab]').length`), 9);
 assert.equal(await evaluate(`document.querySelector('.gis-reference').textContent.includes('المطرد')`), true);
 assert.equal(await evaluate(`document.querySelector('.gis-reference').querySelectorAll('input,textarea').length`), 0);
 // Seed an existing field and history in the very same administration workspace.
 await evaluate(`(async()=>{const m=await import('/LTIP_LIBYA/src/admin/dashboardStore.js');const model=await import('/LTIP_LIBYA/public/admin-dashboard-model.js');const ids=(await(await fetch('/LTIP_LIBYA/data/zones_141.geojson')).json()).features.map(f=>f.properties.id);let r=model.createRecord('sites',{id:19});r.data.ownership='Existing documented value';r.evidence.ownership={source:'Existing source',verification:'UNVERIFIED'};await m.saveRecord(r,new Map(),ids);})()`);
 await reload(); await waitFor(`!!document.querySelector('[data-field=name]')`);
 await input('[data-field=name]', 'المطرد — اختبار إدخال');
 await clickText('التوثيق والمراجعة');
 await input('[data-source=name]', 'مصدر اختبار محلي');
 await clickText('البيانات الأساسية');
 await input('[data-field=description]', 'وصف محفوظ من الشاشة المستقلة');
 await clickText('حفظ مسودة'); await waitFor(`document.querySelector('[role=status]').textContent.includes('بنجاح')`);
 await reload(); await waitFor(`document.querySelector('[data-field=name]')?.value==='المطرد — اختبار إدخال'`);
 await clickText('الملكية والوضع العقاري');
 assert.equal(await evaluate(`document.querySelector('[data-field=ownership]').value`), 'Existing documented value');
 // Every tab opens a real panel; no tab click changes the route.
 for (let index = 0; index < 9; index++) {
  await evaluate(`document.querySelectorAll('[role=tab]')[${index}].click()`); await delay(30);
  assert.equal(await evaluate(`document.querySelectorAll('[role=tab][aria-selected=true]').length`), 1);
 }
 await clickText('الصور');
 await evaluate(`(()=>{const bytes=Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j7KkAAAAASUVORK5CYII='),c=>c.charCodeAt(0));const files=new DataTransfer();files.items.add(new File([bytes],'photo.png',{type:'image/png'}));files.items.add(new File([new Uint8Array([...bytes,0])],'photo-two.png',{type:'image/png'}));const el=document.querySelector('[data-upload=photos]');el.files=files.files;el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await waitFor(`document.querySelectorAll('[data-attachment]').length===2`);
 await input('[data-attachment] input', 'صورة المطرد الميدانية');
 await clickText('حفظ مسودة'); await waitFor(`document.querySelector('[role=status]').textContent.includes('بنجاح')`);
 await reload(); await waitFor(`!!document.querySelector('[data-field=name]')`); await clickText('الصور');
 await waitFor(`document.querySelectorAll('[data-attachment] img').length===2`);
 assert.equal(await evaluate(`document.querySelector('[data-attachment] input').value`), 'صورة المطرد الميدانية');
 await waitFor(`[...document.querySelectorAll('[data-attachment] img')].every(img=>img.naturalWidth>0)`);
 await clickText('الخرائط');
 await evaluate(`(()=>{const files=new DataTransfer();files.items.add(new File(['%PDF-1.4\\n%%EOF'],'map.pdf',{type:'application/pdf'}));const el=document.querySelector('[data-upload=contour_maps]');el.files=files.files;el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
 await waitFor(`!!document.querySelector('[data-attachment] iframe')`);
 await clickText('حفظ مسودة');await waitFor(`document.querySelector('[role=status]').textContent.includes('بنجاح')`);
 const exported = await evaluate(`(async()=>{const m=await import('/LTIP_LIBYA/src/admin/dashboardStore.js');const ids=(await(await fetch('/LTIP_LIBYA/data/zones_141.geojson')).json()).features.map(f=>f.properties.id);const b=await m.exportWorkspace(ids);await m.importWorkspace(b,ids,()=>true);return {files:b.files.length,title:b.records[0].attachments[0].title,ownership:b.records[0].data.ownership,history:b.records[0].history.length,status:b.records[0].status};})()`);
 assert.equal(exported.files, 3);assert.equal(exported.title, 'صورة المطرد الميدانية');assert.equal(exported.ownership, 'Existing documented value');assert.ok(exported.history >= 4);assert.equal(exported.status,'DRAFT');
 await clickText('إرسال للمراجعة');await waitFor(`document.querySelector('.site-summary').textContent.includes('قيد المراجعة')`);
 // Simulate quota/storage failure and check the visible error without losing edits.
 await clickText('البيانات الأساسية'); await input('[data-field=description]', 'تعديل محفوظ في الذاكرة');
 await evaluate(`window.originalOpen=indexedDB.open.bind(indexedDB);indexedDB.open=()=>{throw new Error('Simulated storage failure');}`);
 await clickText('حفظ مسودة'); await waitFor(`document.querySelector('[role=alert]')?.textContent.includes('Simulated storage failure')`);
 await evaluate(`indexedDB.open=window.originalOpen`);
 assert.equal(await evaluate(`document.querySelector('[data-field=description]').value`), 'تعديل محفوظ في الذاكرة');
 // Cancel hash navigation, then save and traverse actual browser history.
 await evaluate(`window.confirm=()=>false;document.querySelector('.site-savebar a').click()`); await delay(150);
 assert.equal(await evaluate(`location.hash`), '#/admin/sites/edit/19');
 await clickText('حفظ مسودة');await waitFor(`document.querySelector('[role=status]').textContent.includes('بنجاح')`);
 await clickText('العودة للقائمة');await waitFor(`document.querySelectorAll('tbody tr').length===141`);
 assert.equal(await evaluate(`document.querySelectorAll('.site-entry-link').length`),141);
 await evaluate(`history.back()`);await waitFor(`!!document.querySelector('[data-field=name]')`);
 assert.equal(await evaluate(`location.hash`),'#/admin/sites/edit/19');
 await evaluate(`history.forward()`);await waitFor(`document.querySelectorAll('tbody tr').length===141`);
 await clickText('إضافة بيانات موقع');await waitFor(`document.querySelectorAll('.site-picker a').length===141`);
 await input('.admin-panel input', 'المطرد');
 assert.equal(await evaluate(`document.querySelector('.site-picker a').getAttribute('href')`),'#/admin/sites/edit/19');
 await evaluate(`document.querySelector('.site-picker a').click()`);await waitFor(`!!document.querySelector('[data-field=name]')`);
 assert.equal(await evaluate(`document.querySelector('[data-field=name]').value`),'المطرد — اختبار إدخال');
 await call('Emulation.setDeviceMetricsOverride',{width:1024,height:768,deviceScaleFactor:1,mobile:false});
 assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true);
 assert.equal(await evaluate(`Math.round(document.querySelector('.site-savebar').getBoundingClientRect().bottom)===innerHeight`),true);
 await call('Emulation.setDeviceMetricsOverride',{width:768,height:1024,deviceScaleFactor:1,mobile:false});
 assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true);
 await input('[data-field=description]','تعديل غير محفوظ لاختبار الرجوع');
 await evaluate(`window.confirm=()=>false;history.back()`);await delay(150);
 assert.equal(await evaluate(`location.hash`),'#/admin/sites/edit/19');
 assert.equal(await evaluate(`document.querySelector('[data-field=description]').value`),'تعديل غير محفوظ لاختبار الرجوع');
 await evaluate(`window.confirm=()=>true`);
 await call('Page.navigate',{url:base+'#/admin/sites/edit/9999'});await waitFor(`!!document.querySelector('[role=alert]')`);
 assert.equal(await evaluate(`!!document.querySelector('[data-field=name]')`),false);
 console.log('PASS standalone site editor: direct zone 19 route, 9 tabs, read-only GIS/history, shared drafts, preservation of existing values/history, Arabic inputs, multiple real images and PDF, metadata, export/import, review separation, reload, visible storage errors, canceled dirty navigation, back/forward, 141-site picker and invalid ID.');
}
