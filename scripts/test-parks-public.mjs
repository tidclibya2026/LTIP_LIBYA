import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {PARK_PROJECTIONS,projectParks,validatePublicParks} from './parks-public-data.mjs';
const policy=JSON.parse(readFileSync('release/parks-public-policy.json','utf8'));
for(const [kind,spec] of Object.entries(PARK_PROJECTIONS)) {
 const publicBytes=readFileSync(spec.output),output=JSON.parse(publicBytes.toString('utf8')),approval=policy.layers[kind];
 assert.equal(createHash('sha256').update(publicBytes).digest('hex'),approval.public_sha256);validatePublicParks(output,kind,approval);
 const hasSource=existsSync(spec.source),raw=hasSource?readFileSync(spec.source):null;
 const source=hasSource?JSON.parse(raw.toString('utf8').replace(/^\uFEFF/,'')):output;
 if(hasSource) assert.equal(createHash('sha256').update(raw).digest('hex'),approval.source_sha256);
 const projected=projectParks(source,kind,approval);assert.deepEqual(output,projected.data);assert.deepEqual(projected.exceptions,[]);
 const byId=new Map(source.features.map(f=>[f.properties[spec.id],f]));
 for(const f of output.features) {
  const original=byId.get(f.properties[spec.id]);assert.deepEqual(f.geometry,original.geometry);
  for(const [k,v] of Object.entries(f.properties)) assert.deepEqual(v,original.properties[k]);
 }
 console.log(kind+': public approval/hash/schema checked; private source comparison '+(hasSource?'PASS':'not available in public-only package'));
 const missing=structuredClone(approval);missing.approved_feature_ids.shift();
 const limited=projectParks(source,kind,missing);assert.equal(limited.exceptions.length,1);assert.equal(limited.data.features.length,spec.count-1);assert.throws(()=>validatePublicParks(limited.data,kind,approval));
 const leak=structuredClone(output);leak.features[0].properties.PUBLICATION_STATUS='INTERNAL';assert.throws(()=>validatePublicParks(leak,kind,approval));
 const pii=structuredClone(source);pii.features[0].properties[kind==='national'?'PARK_NAME':'NAME_ORIG']='contact@example.test';
 assert.equal(projectParks(pii,kind,approval).exceptions.length,1);
 const geometryChanged=structuredClone(output);geometryChanged.features[0].geometry.coordinates=[];assert.throws(()=>validatePublicParks(geometryChanged,kind,approval));
}
const output=JSON.parse(readFileSync(PARK_PROJECTIONS.gardens.output,'utf8'));
const ids=new Set(output.features.map(f=>f.properties.NTG_ID));
if(existsSync(PARK_PROJECTIONS.gardens.source)) {
 const source=JSON.parse(readFileSync(PARK_PROJECTIONS.gardens.source,'utf8').replace(/^\uFEFF/,''));
 assert.equal(source.features.filter(f=>f.properties.PUBLICATION_STATUS==='LEGACY_INTERNAL'&&ids.has(f.properties.NTG_ID)).length,10);
}
console.log('PASS parks public data: frozen approval, field allowlist, 33/27 + 185, unknown-coordinate exclusion, PII and leaked-property rejection. Source/geometry comparisons are reported separately above.');
