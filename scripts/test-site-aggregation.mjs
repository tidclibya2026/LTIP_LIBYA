import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {aggregateSites,siteAnchor} from '../src/maps/siteAggregation.js';
const bytes=await readFile('public/data/zones_141.geojson');
const geo=JSON.parse(bytes),entries=geo.features.map(f=>({id:f.properties.id,anchor:siteAnchor(f)}));
assert.equal(new Set(entries.map(e=>e.id)).size,141);
for(const f of geo.features){const vertices=[];const walk=v=>typeof v[0]==='number'?vertices.push(v):v.forEach(walk);walk(f.geometry.coordinates);assert(vertices.some(v=>v[0]===siteAnchor(f)[0]&&v[1]===siteAnchor(f)[1]));}
const project=(p,z)=>({x:(p[0]+180)/360*256*2**z,y:(1-Math.log(Math.tan(Math.PI/4+p[1]*Math.PI/360))/Math.PI)/2*256*2**z});
let previous=0;const zoomCounts=[];
for(const z of [3,4,5,6,7,8,9,10,12,16]){
 const groups=aggregateSites(entries,p=>project(p,z),50);
 assert.deepEqual(groups.flatMap(g=>g.ids).sort((a,b)=>a-b),entries.map(e=>e.id).sort((a,b)=>a-b));
 assert(groups.length>=previous);previous=groups.length;
 for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++)assert(Math.hypot(groups[i].x-groups[j].x,groups[i].y-groups[j].y)>=50-1e-8);
 zoomCounts.push([z,groups.length]);
}
for(const subset of [[],entries.slice(0,1),entries.filter(e=>e.id%3===0)])assert.deepEqual(aggregateSites(subset,p=>project(p,5)).flatMap(g=>g.ids).sort((a,b)=>a-b),subset.map(e=>e.id).sort((a,b)=>a-b));
assert(bytes.equals(await readFile('public/data/zones_141.geojson')));
console.log('PASS 141 original vertex anchors, exact identity partition, progressive splitting, nonoverlapping groups, empty/one/filtered results; original GIS bytes unchanged.',JSON.stringify(zoomCounts));
