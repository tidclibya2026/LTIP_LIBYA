import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {digest,verifyPreservedBytes,EOL_PROTECTED_TEXT} from './preservation-integrity.mjs';
const load=path=>JSON.parse(readFileSync(path,'utf8').replace(/^\uFEFF/,''));
const baseline=load('docs/reports/site-library-preservation.json');
const ledger=load('release/text-preservation-eol.json');
assert.deepEqual(Object.keys(ledger.files).sort(),[...EOL_PROTECTED_TEXT].sort());
for(const path of EOL_PROTECTED_TEXT) {
 const expected=baseline[path],bytes=readFileSync(path),lf=Buffer.from(bytes.toString('utf8').replace(/\r\n/g,'\n'),'utf8');
 assert.equal(ledger.files[path].original_sha256,expected);
 assert.equal(verifyPreservedBytes(path,lf,expected,ledger),'EOL_EQUIVALENT_ORIGINAL_HASH_PROVEN');
 const crlf=Buffer.from(lf.toString('utf8').replace(/\n/g,'\r\n'),'utf8');
 assert.ok(verifyPreservedBytes(path,crlf,expected,ledger));
 assert.throws(()=>verifyPreservedBytes(path,Buffer.concat([lf,Buffer.from(' ')]),expected,ledger));
 const forged=structuredClone(ledger),changed=Buffer.concat([lf,Buffer.from('tampered')]);
 forged.files[path].lf_sha256=digest(changed);
 assert.throws(()=>verifyPreservedBytes(path,changed,expected,forged),'Changing auxiliary metadata must not replace the original baseline');
 const badBaseline=structuredClone(ledger);badBaseline.files[path].original_sha256='0'.repeat(64);
 assert.throws(()=>verifyPreservedBytes(path,lf,expected,badBaseline));
}
const binary=Buffer.from([255,216,13,10,255,217]),altered=Buffer.from([255,216,10,255,217]);
assert.equal(verifyPreservedBytes('public/images/proof.jpg',binary,digest(binary),ledger),'EXACT_ORIGINAL_BYTES');
assert.throws(()=>verifyPreservedBytes('public/images/proof.jpg',altered,digest(binary),ledger));
const source=Buffer.from('{"type":"FeatureCollection"}\r\n');
assert.throws(()=>verifyPreservedBytes('public/data/source.geojson',Buffer.from(source.toString().replace(/\r\n/g,'\n')),digest(source),ledger));
console.log('PASS preservation: original reference hashes unchanged; all 4 LF/CRLF representations proven against original bytes, mixed V8 EOL restored, non-EOL edits/forged metadata/binary or GIS normalization rejected.');
