import assert from 'node:assert/strict';

export const PARK_PROJECTIONS = {
  national: { source: 'public/data/parks/FD_PARK_NATIONAL_33.geojson', output: 'public/data/parks/public/national-parks.geojson', id: 'PART_ID', count: 33, fields: ['PARK_ID','PART_ID','PARK_NAME','PART_NO','PARTS_COUNT'] },
  gardens: { source: 'public/data/parks/FD_PARK_PUBLIC_185.geojson', output: 'public/data/parks/public/public-gardens.geojson', id: 'NTG_ID', count: 185, fields: ['NTG_ID','NAME_ORIG','PARK_TYPE'] }
};
const restrictedText = /[<>@\x00-\x1f]|https?:|[A-Za-z]:[\\/]|(?:\+?\d[\d ()-]{6,}\d)/i;
const placeholder = /يحتاج مراجعة|غير مسمى/;
function geometry(geo) {
  assert(geo && ['Polygon','MultiPolygon'].includes(geo.type),'Unexpected park geometry');
  function visit(values) {
    assert(Array.isArray(values) && values.length,'Empty coordinates');
    if(typeof values[0]==='number') {
      assert(values.length>=2 && values.every(Number.isFinite),'Invalid coordinate');
      assert(Math.abs(values[0])<=180 && Math.abs(values[1])<=90,'Coordinate out of range');
    } else values.forEach(visit);
  }
  visit(geo.coordinates);
}
export function projectParks(source, kind, approval) {
  const spec=PARK_PROJECTIONS[kind];assert(spec,'Unknown projection');
  assert.equal(source.type,'FeatureCollection');
  const approved=new Set(approval.approved_feature_ids),exceptions=[],displayExceptions=[],features=[];
  const seen=new Set();
  for(const f of source.features) {
    const p=f.properties,id=p[spec.id];assert(typeof id==='string' && !seen.has(id),'Missing or duplicate identity');seen.add(id);
    if(!approved.has(id)) {exceptions.push({id,reason:'COORDINATE_PUBLICATION_NOT_CONFIRMED'});continue;}
    geometry(f.geometry);
    const properties={};
    let unsafe=false;
    for(const field of spec.fields) {
      const value=p[field];
      if(field==='PARK_NAME'||field==='NAME_ORIG') {
        assert(value==null || typeof value==='string','Unexpected name type');
        if(!value || placeholder.test(value)) {displayExceptions.push({id,field,reason:'NAME_EMPTY_OR_REVIEW_PLACEHOLDER_OMITTED'});continue;}
        if(restrictedText.test(value)) {exceptions.push({id,reason:'IDENTIFYING_TEXT_REQUIRES_REVIEW'});unsafe=true;break;}
      }
      properties[field]=value;
    }
    if(!unsafe) features.push({type:'Feature',properties,geometry:structuredClone(f.geometry)});
  }
  for(const id of approved) assert(seen.has(id),'Approved identity absent from source: '+id);
  return {data:{type:'FeatureCollection',features},exceptions,displayExceptions};
}
export function validatePublicParks(data,kind,approval) {
  const spec=PARK_PROJECTIONS[kind];
  assert.deepEqual(Object.keys(data).sort(),['features','type']);assert.equal(data.type,'FeatureCollection');
  assert.equal(data.features.length,spec.count,'Incomplete approved park projection');
  const ids=new Set();
  for(const f of data.features) {
    assert.deepEqual(Object.keys(f).sort(),['geometry','properties','type']);assert.equal(f.type,'Feature');geometry(f.geometry);
    assert(Object.keys(f.properties).every(k=>spec.fields.includes(k)),'Non-public park property');
    const p=f.properties,id=p[spec.id];assert(typeof id==='string' && !ids.has(id),'Invalid public park identity');ids.add(id);
    for(const key of spec.fields.filter(k=>!['PARK_NAME','NAME_ORIG'].includes(k))) assert(Object.hasOwn(p,key),'Required identity property absent');
    for(const field of ['PARK_NAME','NAME_ORIG']) if(p[field]!==undefined) assert(typeof p[field]==='string' && !restrictedText.test(p[field]) && !placeholder.test(p[field]),'Unsafe public name');
    if(kind==='national') assert(/^LY-PARK-\d{3}$/.test(p.PARK_ID) && p.PART_ID===p.PARK_ID+'-P'+String(p.PART_NO).padStart(2,'0'),'National part identity mismatch');
    else assert(/^NTG_[A-Za-z0-9_]+$/.test(id) && p.PARK_TYPE==='PUBLIC_PARK','Garden identity/type mismatch');
  }
  assert.deepEqual([...ids].sort(),[...approval.approved_feature_ids].sort(),'Unapproved coordinates in public output');
  if(kind==='national') {
    const groups=new Map();for(const {properties:p} of data.features) groups.set(p.PARK_ID,[...(groups.get(p.PARK_ID)||[]),p]);
    assert.equal(groups.size,27);
    for(const parts of groups.values()) {
      assert(parts.every(p=>p.PARTS_COUNT===parts.length),'Part count mismatch');
      assert.deepEqual(parts.map(p=>p.PART_NO).sort((a,b)=>a-b),Array.from({length:parts.length},(_,i)=>i+1));
    }
  }
}
