import {useEffect,useMemo,useRef} from 'react';
import {MapContainer,useMap} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Basemap from '../maps/Basemap.jsx';
import GeographicContext from '../maps/GeographicContext.jsx';
import {aggregateSites,siteAnchor} from '../maps/siteAggregation.js';
import '../maps/national-map.css';
import s from './GovernmentPortfolio.module.css';

function Sites({geo,rows,selectedId,onSelect}){
 const map=useMap(),layers=useRef(new Map()),select=useRef(onSelect);select.current=onSelect;
 useEffect(()=>{
  for(const f of geo.features){
   const layer=L.geoJSON(f,{smoothFactor:0,noClip:true});
   layer.eachLayer(shape=>{
    const tip=document.createElement('span');tip.textContent=`${f.properties.name_ar} · GIS ${f.properties.id}`;
    shape.bindTooltip(tip,{direction:'top',className:s.mapTooltip});shape.on('click',()=>select.current(f.properties.id));
    shape.on('add',()=>{const el=shape.getElement?.();if(!el)return;el.dataset.govZoneId=f.properties.id;el.setAttribute('tabindex','0');el.setAttribute('role','button');el.setAttribute('aria-label',tip.textContent);el.onkeydown=event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select.current(f.properties.id);}};el.onfocus=()=>shape.openTooltip();el.onblur=()=>shape.closeTooltip();});
   });layers.current.set(f.properties.id,layer);
  }
  const registry=layers.current;map._ltipSites=registry;
  return()=>{registry.forEach(layer=>layer.remove());registry.clear();if(map._ltipSites===registry)delete map._ltipSites;};
 },[map,geo]);
 useEffect(()=>{
  const byId=new Map(rows.map(r=>[r.zone_id,r]));
  layers.current.forEach((layer,id)=>{
   const row=byId.get(id);if(!row){layer.remove();return;}
   const selected=id===selectedId;
   layer.setStyle({color:selected?'#a87718':row.targeted?'#174a76':'#617e91',weight:selected?4:row.targeted?2.6:1.8,dashArray:row.targeted===false?'5 3':undefined,fillColor:selected?'#c59b4e':row.targeted?'#174a76':'#7795a7',fillOpacity:selected?.62:row.targeted?.43:.26,smoothFactor:0,noClip:true});
   if(!map.hasLayer(layer))layer.addTo(map);
  });
  const render=()=>{
   const zoom=map.getZoom(),showPolygons=zoom>=10;
   layers.current.forEach((layer,id)=>{
    const row=byId.get(id);if(!row)return;
    const selected=id===selectedId,visible=showPolygons||selected;
    layer.setStyle({opacity:visible?1:0,fillOpacity:visible?(selected?.56:row.targeted?.32:.23):0,weight:selected?5:row.targeted?2.5:1.8});
    layer.eachLayer(shape=>{const el=shape.getElement?.();if(el){el.style.pointerEvents=visible?'auto':'none';el.setAttribute('tabindex',visible?'0':'-1');el.classList.toggle('ltip-selected-boundary',selected);}});
   });
   layers.current.get(selectedId)?.bringToFront();
  };
  render();map.on('zoomend',render);return()=>map.off('zoomend',render);
 },[map,rows,selectedId,geo]);
 return null;
}
function Aggregates({geo,rows,selectedId,onSelect}){
 const map=useMap(),select=useRef(onSelect);select.current=onSelect;
 const anchors=useMemo(()=>new Map(geo.features.map(f=>[f.properties.id,siteAnchor(f)])),[geo]);
 useEffect(()=>{
  const layer=L.layerGroup().addTo(map),status=L.control({position:'bottomright'});
  status.onAdd=()=>{const el=L.DomUtil.create('div','ltip-cluster-status');el.dir='rtl';el.dataset.testid='cluster-status';status.element=el;return el;};status.addTo(map);
  const draw=()=>{
   layer.clearLayers();const zoom=map.getZoom();
   const groups=zoom<10?aggregateSites(rows.map(r=>({id:r.zone_id,anchor:anchors.get(r.zone_id)})),p=>map.project([p[1],p[0]],zoom),innerWidth<=650?68:64):[];
   const snapshot=[];
   for(const group of groups){
    const latlng=map.unproject(L.point(group.x,group.y),zoom),hasSelected=group.ids.includes(selectedId);
    const content=document.createElement('span');content.textContent=group.ids.length.toLocaleString('ar-LY');
    const marker=L.marker(latlng,{icon:L.divIcon({html:content,className:'ltip-site-cluster'+(group.ids.length===1?' is-single':''),iconSize:[44,44],iconAnchor:[22,22]}),keyboard:true,zIndexOffset:hasSelected?100:0});
    const label=group.ids.length>1?`${group.ids.length} موقعًا · اضغط لتوسيع المجموعة`:`${rows.find(r=>r.zone_id===group.ids[0]).site_name_ar} · GIS ${group.ids[0]}`;
    const tip=document.createElement('span');tip.textContent=label;marker.bindTooltip(tip,{direction:'top'});
    marker.on('add',()=>{const el=marker.getElement();el.dataset.siteCluster='true';el.dataset.count=group.ids.length;el.dataset.selected=String(hasSelected);el.setAttribute('aria-label',label);el.setAttribute('role','button');el.onkeydown=event=>{if(event.key===' '){event.preventDefault();marker.fire('click');}};});
    marker.on('click',()=>{
     if(group.ids.length===1){select.current(group.ids[0]);return;}
     const bounds=L.latLngBounds(group.ids.map(id=>{const p=anchors.get(id);return [p[1],p[0]];}));
     const fit=map.getBoundsZoom(bounds,false,L.point(70,70));map.setView(bounds.getCenter(),Math.min(12,Math.max(zoom+1,Math.min(zoom+2,fit))),{animate:false});
    });marker.addTo(layer);
    snapshot.push({ids:group.ids,count:group.ids.length,latlng:[latlng.lat,latlng.lng]});
   }
   status.element.textContent=zoom<10?'أعداد المواقع · اضغط للتكبير':'حدود المواقع الأصلية · GIS';
   map._ltipClusterState={zoom,mode:zoom<10?'aggregates':'polygons',groups:snapshot,total:rows.length,selectedId};map.fire('ltip:clusters');
  };
  draw();map.on('zoomend resize',draw);
  return()=>{map.off('zoomend resize',draw);layer.remove();status.remove();delete map._ltipClusterState;};
 },[map,anchors,rows,selectedId]);
 return null;
}
function Controller({features,context,request,visibleIds,selectedId,fullMap,cardOpen}){
 const map=useMap();
 useEffect(()=>{
  const fit=()=>{
   if(!request)return;
   const container=map.getContainer(),top=container.getBoundingClientRect().top+(fullMap?0:window.scrollY);
   const available=Math.max(innerWidth<=650?300:360,innerHeight-top-54)+'px';
   if(!fullMap&&container.style.getPropertyValue('--map-available')!==available)container.style.setProperty('--map-available',available);
   map.invalidateSize({pan:false});const feature=request.kind==='site'?features.find(f=>f.properties.id===request.zoneId):null;
   const data=feature||{type:'FeatureCollection',features:request.kind==='sites'?features.filter(f=>visibleIds.includes(f.properties.id)):(context?.features||features)};
   const bounds=L.geoJSON(data).getBounds();
   if(feature&&bounds.isValid()){
    const c=bounds.getCenter();bounds.extend([c.lat-.12,c.lng-.20]);bounds.extend([c.lat+.12,c.lng+.20]);
   }
   if(bounds.isValid())map.fitBounds(bounds,{paddingTopLeft:fullMap&&cardOpen&&innerWidth>1100?[385,26]:[26,26],paddingBottomRight:fullMap&&cardOpen&&innerWidth<=1100?[26,Math.round(innerHeight*.43)]:[26,26],maxZoom:feature?13:9,animate:false});
  };
  fit();const observer=new ResizeObserver(fit);observer.observe(map.getContainer());return()=>observer.disconnect();
 },[map,request,features,context,visibleIds,fullMap,cardOpen]);
 useEffect(()=>{
  const api={getZoom:()=>map.getZoom(),getBounds:()=>map.getBounds().toBBoxString(),getSelectedId:()=>selectedId,
   getMapId:()=>L.stamp(map),getBasemap:()=>({...map._ltipBasemap}),getAggregation:()=>structuredClone(map._ltipClusterState||null),getContext:()=>structuredClone(map._ltipContextState||null),getLayerIds:()=>[...(map._ltipSites||new Map())].filter(([,layer])=>map.hasLayer(layer)).map(([id,layer])=>({id,instance:L.stamp(layer)})),
   setView:(center,zoom)=>{map.setView(center,zoom,{animate:false});},getSelectedBounds:()=>{const layer=map._ltipSites?.get(selectedId);return layer?{site:layer.getBounds().toBBoxString(),contained:map.getBounds().contains(layer.getBounds())}:null;},
   getRenderedFeatures:()=>Object.values(map._layers).filter(layer=>layer.feature?.properties?.id&&layer.toGeoJSON&&layer.getElement).map(layer=>layer.toGeoJSON(false))};
  window.LTIPGovernmentMap=api;return()=>{if(window.LTIPGovernmentMap===api)delete window.LTIPGovernmentMap;};
 },[map,selectedId]);
 return null;
}
export default function GovernmentMap({geo,context,rows,selectedId,request,fullMap,cardOpen,onSelect}){
 const ids=useMemo(()=>rows.map(r=>r.zone_id),[rows]);
 return <MapContainer className={s.map} center={[27,17.5]} zoom={5} scrollWheelZoom zoomAnimation={false} fadeAnimation={false} markerZoomAnimation={false} attributionControl aria-label="خارطة مواقع التنمية السياحية بمضلعات GIS الأصلية">
  <Basemap context={context}/>
  <Sites geo={geo} rows={rows} selectedId={selectedId} onSelect={onSelect}/>
  <Aggregates geo={geo} rows={rows} selectedId={selectedId} onSelect={onSelect}/>
  <GeographicContext/>
  <Controller features={geo.features} context={context} request={request} visibleIds={ids} selectedId={selectedId} fullMap={fullMap} cardOpen={cardOpen}/>
 </MapContainer>;
}
