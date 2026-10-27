import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildSiteLibrary, localAssetPath, LIBRARY_SECTIONS } from '../public/site-library-model.js';
import { emptyZone } from '../public/site-admin-model.js';
import { verifyPreservedBytes } from './preservation-integrity.mjs';
const load = async path => JSON.parse((await readFile(path, 'utf8')).replace(/^\uFEFF/, ''));
const [geo, enrichment, legacy, manual, preservation] = await Promise.all(['public/data/zones_141.geojson','public/data/investment_site_enrichment.json','public/data/zone_photos.json','public/data/site_manual_enrichment.json','docs/reports/site-library-preservation.json'].map(load));
const create = id => buildSiteLibrary({ zoneId: id, site: enrichment.zones[id], legacy: legacy[id] || [], manual: manual.zones[id] });
const mutrid = create(19);
assert.equal(mutrid.groups.photos.length, 2); assert.equal(mutrid.groups.aerial_maps.length, 1); assert.equal(mutrid.groups.boundary_maps.length, 1); assert.equal(mutrid.groups.unclassified.length, 1); assert.equal(mutrid.totalFiles, 5);
assert.equal(mutrid.groups.contour_maps.length, 0); assert.equal(mutrid.groups.studies.length, 0); assert.equal(mutrid.groups.plans.length, 0);
assert.deepEqual(mutrid.groups.photos.map(i => i.id), ['IMG-110','IMG-111']);
assert.equal(mutrid.groups.aerial_maps[0].id, 'IMG-112'); assert.equal(mutrid.groups.boundary_maps[0].id, 'IMG-113');
assert.equal(mutrid.groups.aerial_maps[0].secondary_type, 'reference_map');
const ids = geo.features.map(f => f.properties.id); assert.equal(ids.length, 141); const counts = Object.fromEntries(Object.keys(LIBRARY_SECTIONS).map(k=>[k,0]));
let checked = 0;
// Mutrid first, then every remaining site, even where no original enrichment exists.
for (const id of [19, ...ids.filter(id=>id!==19)]) {
  const library = create(id); const items = Object.values(library.groups).flat();
  assert.equal(new Set(items.filter(i=>i.src).map(i=>localAssetPath(i.src))).size, library.totalFiles);
  for (const [category, rows] of Object.entries(library.groups)) {
    counts[category] += rows.filter(i=>i.src).length;
    for (const item of rows) if (item.src) {
      const bytes = await readFile('public/' + localAssetPath(item.src)); assert.ok(bytes.length > 0); checked++;
      if (item.sha256) assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256);
    }
  }
  for (const original of enrichment.zones[id]?.images || []) assert.ok(items.some(item=>item.id===original.id && item.src===original.src));
  for (const original of legacy[id] || []) assert.ok(items.some(item=>localAssetPath(item.src)===localAssetPath(original.src)));
}
const unusual = buildSiteLibrary({ zoneId: 19, site: { zone_id:19, images: [{ id:'uncertain', type:'unrecognized', src:'images/example.jpg', source:'explicit unknown metadata' }] } }); assert.equal(unusual.groups.unclassified.length, 1);
assert.equal(localAssetPath('C:\\private\\file.jpg'), null); assert.equal(localAssetPath('images/%2e%2e/secret.jpg'), null); assert.equal(localAssetPath('https://untrusted.test/file.png'), null);
const zone = emptyZone(19); zone.review_status='APPROVED';zone.publication_clearance='PUBLIC_CLEARED';zone.section_review.studies_and_plans='APPROVED';
const base = {id:crypto.randomUUID(),zone_id:19,title:'وثيقة اختبار',source:'test',rights:'test',approval_status:'APPROVED',publication_clearance:'PUBLIC_CLEARED',document_type:'MASTER_PLAN'};
zone.studies_and_plans=[base];
assert.equal(buildSiteLibrary({zoneId:19,manual:zone}).groups.plans.length,1);assert.equal(buildSiteLibrary({zoneId:19,manual:zone}).totalFiles,0);
zone.studies_and_plans[0].library_category='decisions';assert.equal(buildSiteLibrary({zoneId:19,manual:zone}).groups.decisions.length,1);
zone.studies_and_plans[0].approval_status='DRAFT';assert.equal(buildSiteLibrary({zoneId:19,manual:zone}).groups.decisions.length,0);
zone.review_status='DRAFT';assert.equal(buildSiteLibrary({zoneId:19,manual:zone}).totalFiles,0);
const published = new Set(await load('release/public-files.json'));
const eolLedger=await load('release/text-preservation-eol.json');
const preservationExclusions=[],eolEquivalentFiles=[];let protectedFiles=0;
for (const [originalPath, hash] of Object.entries(preservation)) {
  const path=originalPath.replaceAll('\\','/');
  // Private source layers and obsolete backups are intentionally absent from a clean release.
  if(path.startsWith('public/') && !published.has(path)) {preservationExclusions.push(path);continue;}
  const result=verifyPreservedBytes(path,await readFile(path),hash,eolLedger);
  if(result==='EOL_EQUIVALENT_ORIGINAL_HASH_PROVEN')eolEquivalentFiles.push(path);
  protectedFiles++;
}
console.log(JSON.stringify({result:'PASS',sites:141,mutrid:{photos:2,aerial:1,boundaries:1,unclassified:1,total:5},filesVerified:checked,counts,protectedFiles,eolEquivalentFiles,preservationExclusions},null,2));
