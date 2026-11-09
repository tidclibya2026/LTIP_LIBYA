import { validateRecords, validateBundle, revised, keyOf, assertApproved } from '../../public/admin-dashboard-model.js';
import { prepareFile, verifyBytes } from './draftStore.js';
export { prepareFile };
const req = r => new Promise((resolve,reject) => { r.onsuccess=()=>resolve(r.result); r.onerror=()=>reject(r.error); });
async function db() { const r=indexedDB.open('ltip-dashboard-v1',1); r.onupgradeneeded=()=>r.result.createObjectStore('workspace'); return req(r); }
export async function loadWorkspace() { const d=await db(); try { return await req(d.transaction('workspace').objectStore('workspace').get('current')) || { records:[], files:[] }; } finally { d.close(); } }
export async function persistWorkspace(workspace, ids) { validateRecords(workspace.records,ids); const d=await db(); try { await new Promise((resolve,reject)=>{ const tx=d.transaction('workspace','readwrite'); tx.oncomplete=resolve; tx.onerror=tx.onabort=()=>reject(tx.error || Error('تعذر الحفظ المحلي')); tx.objectStore('workspace').put(workspace,'current'); }); } finally { d.close(); } return workspace; }
export async function saveRecord(row, staged, ids, action='SAVE') {
 const ws=await loadWorkspace(), previous=ws.records.find(r=>keyOf(r)===keyOf(row));
 if(!['SAVE','SUBMIT','APPROVE','REJECT'].includes(action)) throw Error('إجراء غير صالح');
 if(action!=='SAVE') {
  if(!previous) throw Error('احفظ المسودة أولًا');
  const allowed=action==='SUBMIT'?['DRAFT','REJECTED']:['IN_REVIEW'];
  if(!allowed.includes(previous.status)) throw Error('انتقال حالة المراجعة غير مسموح');
  const content=r=>JSON.stringify({...r,status:undefined});
  if(content(previous)!==content(row)) throw Error('احفظ التعديلات أولًا قبل تغيير حالة المراجعة');
  row={...previous,status:action==='SUBMIT'?'IN_REVIEW':action==='APPROVE'?'APPROVED':'REJECTED'};
 }
 const next=revised(previous,row,action); if(action==='APPROVE') assertApproved(next);
 ws.records=ws.records.filter(r=>keyOf(r)!==keyOf(next)).concat(next);
 const files=new Map(ws.files.map(f=>[f.id,f])); for(const [id,blob] of staged) files.set(id,{id,blob});
 const refs=new Set(ws.records.flatMap(r=>r.attachments.map(a=>a.file.id))); ws.files=[...files.values()].filter(f=>refs.has(f.id));
 for(const id of refs) if(!files.has(id)) throw Error('ملف مفقود');
 if(ws.files.reduce((s,f)=>s+f.blob.size,0)>50*1024*1024) throw Error('المرفقات تتجاوز 50 ميغابايت');
 await persistWorkspace(ws,ids); return next;
}
export async function deleteRecord(row,ids) { const ws=await loadWorkspace(); const saved=ws.records.find(r=>keyOf(r)===keyOf(row)); if(saved?.status!=='DRAFT') throw Error('الحذف متاح للمسودات فقط'); ws.records=ws.records.filter(r=>keyOf(r)!==keyOf(row)); const refs=new Set(ws.records.flatMap(r=>r.attachments.map(a=>a.file.id))); ws.files=ws.files.filter(f=>refs.has(f.id)); return persistWorkspace(ws,ids); }
const base64 = blob => new Promise((resolve,reject)=>{const reader=new FileReader(); reader.onload=()=>resolve(reader.result.split(',')[1]); reader.onerror=reject; reader.readAsDataURL(blob);});
export async function exportWorkspace(ids) { const ws=await loadWorkspace(); const files=[]; for(const r of ws.records) for(const a of r.attachments) {const blob=ws.files.find(f=>f.id===a.file.id)?.blob; if(!blob) throw Error('ملف مفقود'); await verifyBytes(await blob.arrayBuffer(),a.file); files.push({...a.file,base64:await base64(blob)}); } return {kind:'LTIP_ADMIN_PACKAGE',schema_version:1,exported_at:new Date().toISOString(),records:ws.records,files}; }
export async function importWorkspace(bundle,ids,replace) {
 const files=[]; await validateBundle(bundle,ids,async f=>{const bytes=Uint8Array.from(atob(f.base64),c=>c.charCodeAt(0)); await verifyBytes(bytes.buffer,f); files.push({id:f.id,blob:new Blob([bytes],{type:f.mime})});});
 const ws=await loadWorkspace(); if(ws.records.some(r=>bundle.records.some(n=>keyOf(n)===keyOf(r))) && !await replace()) return null;
 const merged={records:[...ws.records.filter(r=>!bundle.records.some(n=>keyOf(n)===keyOf(r))),...bundle.records],files:[...ws.files.filter(f=>!files.some(n=>n.id===f.id)),...files]};
 const refs=new Set(merged.records.flatMap(r=>r.attachments.map(a=>a.file.id))); merged.files=merged.files.filter(f=>refs.has(f.id));
 if(merged.files.reduce((s,f)=>s+f.blob.size,0)>50*1024*1024) throw Error('المرفقات تتجاوز 50 ميغابايت'); return persistWorkspace(merged,ids);
}
