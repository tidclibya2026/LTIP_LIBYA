import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export const EOL_PROTECTED_TEXT = new Set([
 'public/data/investment_site_enrichment.json',
 'public/data/zone_photos.json',
 'public/investment-cards.html',
 'upgrade_print_v8.mjs'
]);
export const digest = bytes => createHash('sha256').update(bytes).digest('hex');

// The original baseline remains authoritative. EOL metadata cannot authorize new content:
// the reconstructed historical bytes must still hash to that unchanged baseline.
export function verifyPreservedBytes(path, bytes, expectedHash, eolLedger) {
 if(digest(bytes)===expectedHash) return 'EXACT_ORIGINAL_BYTES';
 assert(EOL_PROTECTED_TEXT.has(path),'Original changed: '+path);
 const entry=eolLedger.files[path];assert(entry,'Missing historical EOL evidence: '+path);
 assert.equal(entry.original_sha256,expectedHash,'Historical baseline mismatch: '+path);
 const text=bytes.toString('utf8');assert(Buffer.from(text,'utf8').equals(bytes),'Invalid UTF-8: '+path);
 assert(!text.includes('\0'),'Binary data cannot use text EOL evidence');
 const lf=text.replace(/\r\n/g,'\n');
 assert.equal(digest(Buffer.from(lf,'utf8')),entry.lf_sha256,'Non-EOL content changed: '+path);
 const count=(lf.match(/\n/g)||[]).length;assert.equal(count,entry.lf_count,'Line count changed: '+path);
 let reconstructed;
 if(entry.layout==='all-crlf') reconstructed=lf.replace(/\n/g,'\r\n');
 else {
  assert.equal(entry.layout,'selected-crlf');assert(Array.isArray(entry.crlf_lines));
  const selected=new Set(entry.crlf_lines);
  assert.equal(selected.size,entry.crlf_lines.length);
  assert([...selected].every(n=>Number.isInteger(n)&&n>=1&&n<=count),'Invalid EOL positions');
  let line=0;reconstructed=lf.replace(/\n/g,()=>selected.has(++line)?'\r\n':'\n');
 }
 assert.equal(digest(Buffer.from(reconstructed,'utf8')),expectedHash,'Historical bytes cannot be reconstructed: '+path);
 return 'EOL_EQUIVALENT_ORIGINAL_HASH_PROVEN';
}
