import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {PARK_PROJECTIONS,projectParks,validatePublicParks} from './parks-public-data.mjs';
const policy=JSON.parse(readFileSync('release/parks-public-policy.json','utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const results=[];
for(const [kind,spec] of Object.entries(PARK_PROJECTIONS)) {
  const before=readFileSync(spec.source),approval=policy.layers[kind];
  assert.equal(hash(before),approval.source_sha256,'Source changed; renewed publication review required');
  const source=JSON.parse(before.toString('utf8').replace(/^\uFEFF/,''));
  const projected=projectParks(source,kind,approval);
  const row={kind,source:spec.source,source_sha256:hash(before),output:spec.output,count:projected.data.features.length,fields:spec.fields,coordinate_exceptions:projected.exceptions,display_exceptions:projected.displayExceptions};
  results.push(row);
  mkdirSync('docs/reports/github-readiness',{recursive:true});
  writeFileSync('docs/reports/github-readiness/23-parks-public-exceptions.json',JSON.stringify({approval_basis:policy.approval_basis,layers:results},null,2)+'\n');
  // A partial projection remains an exception report, never an unnoticed partial publication.
  assert.equal(projected.exceptions.length,0,'Unresolved park publication exceptions; output not updated');
  validatePublicParks(projected.data,kind,approval);
  const output=JSON.stringify(projected.data)+'\n';assert.equal(hash(output),approval.public_sha256,'Projection changed; renewed output review required');
  mkdirSync(dirname(spec.output),{recursive:true});writeFileSync(spec.output,output);
  assert(readFileSync(spec.source).equals(before),'Source was changed');
}
console.log('PASS public park projection: national 33 features/27 PARK_ID, gardens 185; exact geometry and identity copied; originals unchanged.');
