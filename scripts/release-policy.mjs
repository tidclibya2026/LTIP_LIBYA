import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { PARK_PROJECTIONS, validatePublicParks } from './parks-public-data.mjs';

const blocked = /(^|[/_. -])(internal|hold|staging|backup|pending|secret|credentials)([/_. -]|$)|\.bak$|\.zip$|\.env(?:\.|$)/i;
const credentials = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[A-Z0-9]{16}|sk-[A-Za-z0-9_-]{24,})\b/;
export const GENERATED_MANIFEST='release-generated-files.json';
const generatedPath=path=>path==='index.html'||/^assets\/[^/]+\.(js|css)$/.test(path);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function writeGeneratedManifest(directory,bundle) {
  const publicPaths=new Set(JSON.parse(readFileSync('release/public-files.json','utf8')).map(p=>p.slice(7)));
  assert(!publicPaths.has(GENERATED_MANIFEST),'Reserved artifact manifest path');
  const files=[];
  for(const item of Object.values(bundle)) {
    if(publicPaths.has(item.fileName))continue;
    assert(generatedPath(item.fileName) && !blocked.test(item.fileName),'Unexpected compiler output: '+item.fileName);
    const bytes=Buffer.from(item.type==='chunk'?item.code:item.source);
    files.push({path:item.fileName,sha256:sha(bytes)});
  }
  assert(files.some(f=>f.path==='index.html'),'Compiler index missing');
  writeFileSync(resolve(directory,GENERATED_MANIFEST),JSON.stringify({schema_version:1,files:files.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0)},null,2)+'\n');
}
function validateData(value, path) {
  if (typeof value==='string') assert(!/(^|[_ -])(INTERNAL|HOLD)([_ -]|$)/i.test(value),'Restricted data value: '+path);
  if (Array.isArray(value)) { for (const item of value) validateData(item, path); }
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (['classification','visibility','publication_clearance','status','approval_status'].includes(key.toLowerCase())) {
        assert(!['INTERNAL','HOLD'].includes(String(item).toUpperCase()), 'Restricted classification: '+path);
      }
      validateData(item, path);
    }
  }
}
export function publicReleaseFiles() {
  const list = JSON.parse(readFileSync('release/public-files.json', 'utf8'));
  assert.equal(new Set(list).size, list.length, 'Duplicate public path');
  return list.map(path => {
    assert(!Object.values(PARK_PROJECTIONS).some(spec=>spec.source===path),'Raw park source cannot enter public artifact: '+path);
    assert(path.startsWith('public/') && !path.includes('..') && !path.includes('\\') && !blocked.test(path), 'Disallowed public path: '+path);
    const bytes = readFileSync(path);
    const projection=Object.entries(PARK_PROJECTIONS).find(([,spec])=>spec.output===path);
    if(projection) {
      const approval=JSON.parse(readFileSync('release/parks-public-policy.json','utf8')).layers[projection[0]];
      assert.equal(createHash('sha256').update(bytes).digest('hex'),approval.public_sha256,'Public park bytes differ from approved projection');
      validatePublicParks(JSON.parse(bytes.toString('utf8')),projection[0],approval);
    }
    assert(!credentials.test(bytes.toString('utf8')), 'Credential pattern in '+path);
    if (/\.(geo)?json$/i.test(path)) validateData(JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,'')),path);
    return {path,bytes};
  });
}
export function verifyArtifact(directory) {
  const root=resolve(directory), approved=new Map(publicReleaseFiles().map(f=>[f.path.slice(7),f.bytes]));
  const seal=JSON.parse(readFileSync(resolve(root,GENERATED_MANIFEST),'utf8'));
  assert.deepEqual(Object.keys(seal).sort(),['files','schema_version']);assert.equal(seal.schema_version,1);assert(Array.isArray(seal.files));
  const generated=new Map();
  for(const f of seal.files) {
    assert.deepEqual(Object.keys(f).sort(),['path','sha256']);
    assert(typeof f.path==='string' && generatedPath(f.path) && !blocked.test(f.path) && !approved.has(f.path) && !generated.has(f.path),'Invalid generated manifest entry');
    assert(/^[a-f0-9]{64}$/.test(f.sha256),'Invalid generated checksum');generated.set(f.path,f.sha256);
  }
  assert(generated.has('index.html'),'Generated index not listed');
  let count=0;
  function walk(dir) {
    for (const ent of readdirSync(dir,{withFileTypes:true})) {
      const full=resolve(dir,ent.name), path=relative(root,full).split(sep).join('/');
      assert(!blocked.test(path),'Restricted output path: '+path);
      if(ent.isDirectory()) walk(full);
      else {
        assert(ent.isFile(),'Unexpected output entry: '+path);
        const bytes=readFileSync(full);
        assert(approved.has(path) || generated.has(path) || path===GENERATED_MANIFEST,'Unlisted output: '+path);
        assert(!credentials.test(bytes.toString('utf8')),'Credential pattern in output: '+path);
        if(approved.has(path)) { assert(bytes.equals(approved.get(path)),'Public file bytes changed: '+path); approved.delete(path); }
        else if(generated.has(path)) {assert.equal(sha(bytes),generated.get(path),'Generated file bytes changed: '+path);generated.delete(path);}
        count++;
      }
    }
  }
  walk(root);assert.equal(approved.size,0,'Missing public files');assert.equal(generated.size,0,'Missing compiler files');
  console.log('PASS release artifact: explicit allowlist, identical public bytes, no restricted paths or credential patterns;',count,'files');
}
if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url) && process.argv[2]) verifyArtifact(process.argv[2]);
