import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const json=async path=>JSON.parse((await readFile(path,'utf8')).replace(/^\uFEFF/,''));
const policy=await json('release/public-files.json');
const code=(await readFile('src/demo/adminDemoModel.js','utf8')).replace("import publicFiles from '../../release/public-files.json';",'const publicFiles='+JSON.stringify(policy)+';');
const {DEMO_FEEDS,buildDemoData,miniMapPath}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const feeds=Object.fromEntries(await Promise.all(Object.entries(DEMO_FEEDS).map(async([key,path])=>[key,await json('public/'+path)])));
const before=JSON.stringify(feeds),result=buildDemoData(feeds);
assert.deepEqual(result.totals,{sites:141,parks:27,parts:33,gardens:185,theme:1,images:128,withImages:32,withoutImages:109});
assert.equal(JSON.stringify(feeds),before);
assert(result.sites.every(s=>miniMapPath(s.feature.geometry).startsWith('M')));
const repeated=structuredClone(feeds);repeated.sites.features[0]=repeated.sites.features[1];assert.throws(()=>buildDemoData(repeated));
const key=Object.keys(feeds.enrichment.zones)[0];
for(const src of ['images/unapproved.jpg','../source.jpg','https://example.test/photo.jpg','data/manual-assets/unapproved.jpg']) {
  const forged=structuredClone(feeds);forged.enrichment.zones[key].images[0].src=src;
  assert.equal(buildDemoData(forged).totals.images,127);
}
const wrong=structuredClone(feeds);wrong.enrichment.zones[key].zone_id=-1;assert.equal(buildDemoData(wrong).sites.find(s=>s.id===Number(key)).images.length,0);
const unapproved=structuredClone(feeds);unapproved.enrichment.zones[key].approval.status='DRAFT';assert.equal(buildDemoData(unapproved).sites.find(s=>s.id===Number(key)).images.length,0);
const duplicate=structuredClone(feeds);duplicate.enrichment.zones[key].images.push(duplicate.enrichment.zones[key].images[0]);assert.equal(buildDemoData(duplicate).totals.images,128);
console.log('PASS demo model: 141 sites; 27/33 parks; 185 gardens; 1 theme; 128 inherited release images; unapproved paths, wrong identities and drafts excluded; no source mutation.');
