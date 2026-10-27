import { readFile, writeFile, rename, lstat } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateBundle, validateRecords, assertApproved, keyOf } from '../public/admin-dashboard-model.js';
import { MAX_PACKAGE_BYTES } from '../public/site-admin-model.js';
import { verifyBytes } from '../src/admin/draftStore.js';
export async function mergeAdminPackage(input,{root=resolve(fileURLToPath(new URL('..',import.meta.url))),apply=false,publicReviewed=false}={}) {
 const path=join(root,'public/data/admin-approved-records.json');
 for(let p=dirname(path);;p=dirname(p)){if((await lstat(p)).isSymbolicLink())throw Error('مسار رمزي غير مسموح');if(p===resolve(root))break;if(dirname(p)===p)throw Error('المسار خارج المشروع');}
 const raw=await readFile(input);if(raw.length>MAX_PACKAGE_BYTES)throw Error('حزمة كبيرة جدًا');
 const bundle=JSON.parse(raw.toString('utf8').replace(/^\uFEFF/,''));const geo=JSON.parse(await readFile(join(root,'public/data/zones_141.geojson'),'utf8'));const ids=geo.features.map(f=>f.properties.id);if(ids.length!==141||new Set(ids).size!==141)throw Error('مرجع GIS غير صالح');
 await validateBundle(bundle,ids,async f=>{const b=Buffer.from(f.base64,'base64');await verifyBytes(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),f);});
 // Reject the whole package if any draft or private attachment is present.
 for(const r of bundle.records)assertApproved(r);
 let old={kind:'LTIP_ADMIN_PACKAGE',schema_version:1,records:[],files:[]};try{if((await lstat(path)).isSymbolicLink())throw Error('مسار رمزي غير مسموح');old=JSON.parse(await readFile(path,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}
 await validateBundle(old,ids,async f=>{const b=Buffer.from(f.base64,'base64');await verifyBytes(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),f);});
 for(const r of old.records)assertApproved(r);
 const records=[...old.records.filter(r=>!bundle.records.some(n=>keyOf(n)===keyOf(r))),...bundle.records.map(r=>({...r,history:[]}))];validateRecords(records,ids);
 const refs=new Set(records.flatMap(r=>r.attachments.map(a=>a.file.id)));const files=new Map(old.files.map(f=>[f.id,f]));for(const f of bundle.files)files.set(f.id,f);
 const output={kind:'LTIP_ADMIN_PACKAGE',schema_version:1,published_at:new Date().toISOString(),records,files:[...files.values()].filter(f=>refs.has(f.id))};
 await validateBundle(output,ids,async f=>{const b=Buffer.from(f.base64,'base64');await verifyBytes(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),f);});
 if(apply){if(!publicReviewed)throw Error('يلزم --public-reviewed بعد مراجعة النشر');const temp=path+'.'+crypto.randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(output,null,2),{flag:'wx'});await rename(temp,path);}
 return {mode:apply?'applied':'dry-run',records:bundle.records.length,files:bundle.files.length,path};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){mergeAdminPackage(process.argv[2],{apply:process.argv.includes('--apply'),publicReviewed:process.argv.includes('--public-reviewed')}).then(console.log).catch(e=>{console.error(e.message);process.exitCode=1;});}
