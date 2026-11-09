import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {makeRows,filterRows,rowStats} from '../src/government/model.js';
const geo=JSON.parse(await readFile('public/data/zones_141.geojson','utf8'));
const data=JSON.parse(await readFile('public/data/investment_site_enrichment.json','utf8'));
const rows=makeRows(geo,data),stats=rowStats(rows,false);
assert.equal(rows.length,141);assert(rows.every(row=>row.targeted===null));
assert.equal(stats.targeted,null);assert.equal(stats.other,null);
assert.equal(filterRows(rows,'all','١٣')[0].zone_id,13);
assert.equal(filterRows(rows,'all','no-such-site').length,0);
// Synthetic identifiers only; actual private membership is never a test fixture here.
const ids=[900001,900002,900003];
const fixture={type:'FeatureCollection',features:ids.map(id=>({properties:{id,name_ar:'سجل اختبار '+id,area_ha_geodesic:1}}))};
for(const count of [0,1,2,3]){
 const privateRows=makeRows(fixture,{zones:{}},{selection:{targetIds:ids.slice(0,count),assessments:{}}});
 const totals=rowStats(privateRows,true);
 assert.deepEqual([totals.sites,totals.targeted,totals.other],[3,count,3-count]);
 assert.equal(filterRows(privateRows,'targeted','').length,count);
 assert.equal(filterRows(privateRows,'other','').length,3-count);
 filterRows(privateRows,'all',String(ids[0]));assert.deepEqual(rowStats(privateRows,true),totals);
}
assert.throws(()=>makeRows(fixture,{zones:{}},{selection:{targetIds:[ids[0],ids[0]]}}));
assert.throws(()=>makeRows(fixture,{zones:{}},{selection:{targetIds:[999999]}}));
console.log('PASS government frontend model: neutral public data, original count, search, synthetic dynamic membership and validation; private runtime service excluded.');
