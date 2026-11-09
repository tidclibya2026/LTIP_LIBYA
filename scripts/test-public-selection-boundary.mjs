import {readFile,readdir} from 'node:fs/promises';
import {resolve,relative,extname} from 'node:path';
import assert from 'node:assert/strict';
const root = resolve(process.argv[2] || '.'), gis = JSON.parse(await readFile('public/data/zones_141.geojson','utf8'));
const valid = new Set(gis.features.map(f => f.properties.id)), findings = [];
const excluded = new Set(['.git','node_modules','dist','.local-release-prep']);
let scanned = 0;
function records(value, file) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach(v => records(v, file)); return; }
  if (['nominated_55_member','remaining_86_member','local_review_only'].some(key => Object.hasOwn(value,key))) findings.push(file+': local portfolio field');
  for (const key of ['targetIds','targetedIds','selected_target_ids','addedIds','removedIds']) if (Array.isArray(value[key]) && value[key].some(id => valid.has(id))) findings.push(file+': real selection values');
  Object.values(value).forEach(v => records(v, file));
}
async function walk(dir) {
  for (const entry of await readdir(dir,{withFileTypes:true})) {
    const full = resolve(dir,entry.name), file = relative(root,full).replaceAll('\\','/');
    if (entry.isDirectory()) { if (!excluded.has(entry.name)) await walk(full); continue; }
    if (!entry.isFile()) { findings.push(file+': unsupported filesystem entry'); continue; }
    if (/^(?:selection-working|private-config).*\.json$|^portfolio-141\.json$/i.test(entry.name)) findings.push(file+': private record path');
    if (!['.json','.geojson','.js','.mjs','.jsx','.ts','.tsx','.html','.css','.md','.yml','.yaml'].includes(extname(full))) continue;
    scanned++; const text = (await readFile(full,'utf8')).replace(/^\uFEFF/,'');
    if (['.json','.geojson'].includes(extname(full))) { try { records(JSON.parse(text),file); } catch (error) { findings.push(file+': invalid JSON'); } }
    if (/\b(?:nominated_55_member|remaining_86_member)\s*["']?\s*[:=]\s*(?:true|false)/.test(text)) findings.push(file+': literal private membership');
    for (const match of text.matchAll(/(?:targetIds|targetedIds|selected_target_ids|addedIds|removedIds)["']?\s*[:=]\s*\[([\d,\s]+)\]/g)) if (match[1].split(',').map(x=>Number(x.trim())).some(id=>valid.has(id))) findings.push(file+': embedded real selection array');
  }
}
await walk(root);assert.deepEqual(findings,[],'Private selection data must never enter public source or artifacts');
console.log(`PASS public selection boundary: ${scanned} text files; no local portfolio payload, real selection arrays or private record paths.`);
