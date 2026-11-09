import {useEffect} from 'react';
import {useMap} from 'react-leaflet';
import L from 'leaflet';
import './national-map.css';
const definitions=[['cities','المدن','cities_57.geojson'],['roads','الطرق','roads_6272.geojson'],['airports','المطارات والمهابط','airports_54.geojson'],['ports','الموانئ','ports_33.geojson']];
let cached;
export function loadGeographicContext(){
 return cached||=(Promise.all(definitions.map(async([id,,file])=>{
  const response=await fetch(import.meta.env.BASE_URL+'data/accessibility/'+file);
  if(!response.ok)throw Error('تعذر تحميل طبقات السياق');return [id,await response.json()];
 })).then(Object.fromEntries).catch(error=>{cached=null;throw error;}));
}
const name=f=>f.properties.NAME_AR||f.properties.AR_Name||f.properties.LM_Name_AR||f.properties.NAME_EN||'';
const nationalCities=new Set(['طرابلس','بنغازى','مصراتة','سرت','سبها','غدامس','الكفرة','غات','Tubruq','اجدابيا']);
const intersects=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
export default function GeographicContext(){
 const map=useMap();
 useEffect(()=>{
  let alive=true,data=null,roadLayer=null;
  const state={cities:true,roads:true,airports:true,ports:true},counts={},pointLayers=L.layerGroup().addTo(map),roadRenderer=L.canvas({pane:'geographicRoads',padding:.5});
  if(!map.getPane('geographicRoads')){map.createPane('geographicRoads');map.getPane('geographicRoads').style.zIndex='320';map.getPane('geographicRoads').style.pointerEvents='none';}
  if(!map.getPane('geographicPoints')){map.createPane('geographicPoints');map.getPane('geographicPoints').style.zIndex='450';map.getPane('geographicPoints').style.pointerEvents='none';}
  const Control=L.Control.extend({onAdd(){
   const root=L.DomUtil.create('div','ltip-context-control');root.dir='rtl';
   const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='السياق الجغرافي';summary.dataset.testid='context-control';details.append(summary);
   for(const [id,label] of definitions){const row=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=true;check.dataset.contextLayer=id;check.onchange=()=>{state[id]=check.checked;draw();};row.append(check,document.createTextNode(label));details.append(row);}
   const note=document.createElement('small');note.textContent='بيانات الأطلس · لا تثبت الحالة التشغيلية';details.append(note);root.append(details);
   L.DomEvent.disableClickPropagation(root);L.DomEvent.disableScrollPropagation(root);this.root=root;this.summary=summary;return root;
  }});
  const control=new Control({position:'topright'}).addTo(map);
  const roadDraw=()=>{
   roadLayer?.remove();roadLayer=null;
   if(!state.roads||!data){counts.roads=0;return;}
   const z=map.getZoom(),features=data.roads.features.filter(f=>f.properties.ROAD_TYPE==='DUAL_CARRIAGEWAY'||z>=7&&f.properties.ROAD_TYPE==='PAVED_ROAD');
   roadLayer=L.geoJSON({type:'FeatureCollection',features},{pane:'geographicRoads',renderer:roadRenderer,interactive:false,smoothFactor:.7,style:f=>({color:f.properties.ROAD_TYPE==='DUAL_CARRIAGEWAY'?'#bd8c43':'#9b9a8b',weight:z>=9?2.4:1.2,opacity:z>=9?.8:.55})}).addTo(map);counts.roads=features.length;
  };
  const pointsDraw=()=>{
   pointLayers.clearLayers();if(!data)return;
   const z=map.getZoom(),size=map.getSize(),blocked=[];
   for(const group of map._ltipClusterState?.groups||[]){const p=map.latLngToContainerPoint(group.latlng);blocked.push({x:p.x-23,y:p.y-23,w:46,h:46});}
   for(const node of map.getContainer().querySelectorAll('.leaflet-control')){const a=node.getBoundingClientRect(),b=map.getContainer().getBoundingClientRect();blocked.push({x:a.x-b.x-4,y:a.y-b.y-4,w:a.width+8,h:a.height+8});}
   const labels=[],symbols=[];
   for(const id of ['cities','airports','ports']){
    counts[id]=0;if(!state[id])continue;
    for(const feature of data[id].features){
     if(id==='cities'&&z<7&&!nationalCities.has(name(feature)))continue;
     const [lng,lat]=feature.geometry.coordinates,point=map.latLngToContainerPoint([lat,lng]);
     if(point.x<5||point.y<8||point.x>size.x-5||point.y>size.y-8)continue;
     if(id==='airports'&&z<7&&feature.properties.AIRPORT_CLASS!=='MAJOR_AIRPORT')continue;
     if(id==='ports'&&z<7&&feature.properties.PORT_TYPE!=='COMMERCIAL_PORT')continue;
     const collision=blocked.concat(labels,symbols).some(box=>intersects({x:point.x-10,y:point.y-10,w:20,h:20},box));
     const title=name(feature),symbol=id==='cities'?'●':id==='airports'?'✈':'⚓';
     if(!collision){
      const icon=document.createElement('span');icon.className='ltip-context-symbol '+id;icon.textContent=symbol;icon.title=title;icon.dataset.contextFeature=id;
      L.marker([lat,lng],{pane:'geographicPoints',interactive:false,keyboard:false,icon:L.divIcon({html:icon,className:'ltip-context-icon',iconSize:[20,20],iconAnchor:[10,10]})}).addTo(pointLayers);counts[id]++;
      symbols.push({x:point.x-8,y:point.y-8,w:16,h:16});
     }
     if(!title||id!=='cities'&&z<9)continue;
     const width=Math.min(170,Math.max(45,[...title].length*7.5)),height=23;
     let placement=null;
     for(const [dx,dy] of [[12,-12],[-width-12,-12],[12,12],[-width-12,12],[12,-36],[-width-12,-36],[12,36],[-width-12,36]]){
      const box={x:point.x+dx,y:point.y+dy,w:width,h:height};
      if(box.x<5||box.y<5||box.x+box.w>size.x-5||box.y+height>size.y-5||blocked.concat(labels,symbols).some(b=>intersects(box,b)))continue;
      placement={box,dx,dy};break;
     }
     if(!placement)continue;
     labels.push(placement.box);
     const label=document.createElement('span');label.className='ltip-context-label';label.textContent=title;label.dataset.contextLabel=id;label.style.width=width+'px';
     L.marker([lat,lng],{pane:'geographicPoints',interactive:false,keyboard:false,icon:L.divIcon({html:label,className:'ltip-context-label-anchor',iconSize:[width,height],iconAnchor:[-placement.dx,-placement.dy]})}).addTo(pointLayers);
    }
   }
   map._ltipContextState={loaded:true,layers:{...state},counts:{...counts},labels:labels.map(b=>({...b}))};
  };
  function draw(){if(!alive||!data)return;roadDraw();pointsDraw();}
  const moved=()=>pointsDraw();
  map.on('zoomend',draw);map.on('moveend resize ltip:clusters',moved);
  loadGeographicContext().then(value=>{if(!alive)return;data=value;map._ltipContextData=value;draw();map.fire('ltip:contextlayersready');}).catch(()=>{if(alive){control.summary.textContent='تعذر تحميل السياق';map._ltipContextState={loaded:false,error:true};}});
  return()=>{alive=false;map.off('zoomend',draw);map.off('moveend resize ltip:clusters',moved);roadLayer?.remove();pointLayers.remove();roadRenderer.remove();control.remove();delete map._ltipContextState;delete map._ltipContextData;};
 },[map]);
 return null;
}
