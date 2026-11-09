import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {publicReleaseFiles,verifyArtifact} from './release-policy.mjs';
const cwd=process.cwd(),root=mkdtempSync(join(tmpdir(),'ltip-release-policy-'));
try {
 process.chdir(root);mkdirSync('release');mkdirSync('public');
 const list=p=>writeFileSync('release/public-files.json',JSON.stringify(p));
 writeFileSync('public/safe.json','{"zones":{}}');list(['public/safe.json']);assert.equal(publicReleaseFiles().length,1);
 for(const p of ['public/INTERNAL/file.json','public/HOLD.json','public/data_staging.json','public/a.bak','public/../secret.json']) {list([p]);assert.throws(()=>publicReleaseFiles());}
 for(const p of ['public/data/parks/FD_PARK_NATIONAL_33.geojson','public/data/parks/FD_PARK_PUBLIC_185.geojson']) {list([p]);assert.throws(()=>publicReleaseFiles(),/Raw park source/);}
 list(['public/safe.json']);writeFileSync('public/safe.json','{"zones":{"1":{"publication_clearance":"HOLD"}}}');assert.throws(()=>publicReleaseFiles());
 writeFileSync('public/safe.json','{"PUBLICATION_STATUS":"LEGACY_INTERNAL"}');assert.throws(()=>publicReleaseFiles());
 writeFileSync('public/safe.json','{"zones":{}}');list(['public/safe.json','public/safe.json']);assert.throws(()=>publicReleaseFiles());
 list(['public/safe.json']);
 const fixture=dir=>{mkdirSync(dir);writeFileSync(dir+'/safe.json','{"zones":{}}');writeFileSync(dir+'/index.html','ok');writeFileSync(dir+'/release-generated-files.json',JSON.stringify({schema_version:1,files:[{path:'index.html',sha256:createHash('sha256').update('ok').digest('hex')}]}));};
 fixture('dist');verifyArtifact('dist');
 fixture('extra-json');writeFileSync('extra-json/unlisted.json','{}');assert.throws(()=>verifyArtifact('extra-json'),/Unlisted output/);
 fixture('extra-js');mkdirSync('extra-js/assets');writeFileSync('extra-js/assets/injected.js','alert(1)');assert.throws(()=>verifyArtifact('extra-js'),/Unlisted output/);
 fixture('changed-html');writeFileSync('changed-html/index.html','tampered');assert.throws(()=>verifyArtifact('changed-html'),/Generated file bytes changed/);
 console.log('PASS release guard rejects restricted filenames, data classification, traversal, duplicates, unlisted JSON/JS artifacts and post-build HTML tampering.');
} finally {process.chdir(cwd);}
