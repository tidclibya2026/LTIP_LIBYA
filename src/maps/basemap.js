import L from 'leaflet';
import './basemap.css';
const base=import.meta.env.BASE_URL;
let configuration,contextPromise;
const local={id:'local',label_ar:'خلفية محلية · GIS'};
const read=async path=>{const r=await fetch(base+path);if(!r.ok)throw Error('Local map resource unavailable');return r.json();};
const config=()=>configuration||=(read('map-providers.json').catch(()=>({default_provider:'local',providers:[local]})));
const context=()=>contextPromise||=read('data/libya-context.geojson').catch(error=>{contextPromise=null;throw error;});

// Browser HTTP cache semantics remain intact. No prefetch, retry loop, proxy or UA spoofing.
// Fetch before decoding prevents even an HTTP 403 image body from becoming a visible tile.
function raster(provider,onFailure){
 const controllers=new Set();let stopped=false;
 const layer=new (L.GridLayer.extend({
  createTile(coords,done){
   const canvas=document.createElement('canvas'),size=this.getTileSize();canvas.width=size.x;canvas.height=size.y;
   const controller=new AbortController();controllers.add(controller);canvas._abort=()=>controller.abort();
   const deadline=setTimeout(()=>{if(!stopped&&!controller.signal.aborted){onFailure('Tile timeout');controller.abort();}},8000);
   const path=L.Util.template(provider.url,{z:coords.z,x:coords.x,y:coords.y});
   fetch(new URL(path,location.origin+base),{signal:controller.signal,cache:'default',credentials:'omit',referrerPolicy:'strict-origin-when-cross-origin'})
    .then(response=>{if(!response.ok)throw Error('Tile HTTP '+response.status);return response.blob();})
    .then(blob=>createImageBitmap(blob)).then(bitmap=>{if(!stopped&&!controller.signal.aborted){canvas.getContext('2d').drawImage(bitmap,0,0,size.x,size.y);done(null,canvas);}bitmap.close();})
    .catch(error=>{if(!stopped&&!controller.signal.aborted)onFailure(error.message);}).finally(()=>{clearTimeout(deadline);controllers.delete(controller);});
   return canvas;
  }
 }))({attribution:provider.attribution,maxZoom:provider.maxZoom||19,updateWhenIdle:true,updateWhenZooming:false,keepBuffer:0});
 layer.on('tileunload',event=>event.tile._abort?.());
 return {layer,stop(){stopped=true;controllers.forEach(c=>c.abort());controllers.clear();layer.remove();}};
}
export function attachBasemap(map,{fitCountry=false,countryData=null}={}){
 let alive=true,tiles=null,boundary=null,firstFit=fitCountry,failed=new Set();
 const container=map.getContainer();container.classList.add('ltip-local-map');
 if(!map.getPane('nationalContext')){map.createPane('nationalContext');map.getPane('nationalContext').style.zIndex='250';map.getPane('nationalContext').style.pointerEvents='none';}
 let current='local';const state={provider:'local',fallback:false,reason:null};
 map._ltipBasemap=state;
 const Control=L.Control.extend({onAdd(){
  const div=L.DomUtil.create('div','ltip-basemap-control');div.dir='rtl';
  const label=document.createElement('label');label.append('الخلفية ');const select=document.createElement('select');select.setAttribute('aria-label','خلفية الخريطة');select.dataset.testid='basemap-provider';label.append(select);div.append(label);
  const status=document.createElement('span');status.setAttribute('role','status');status.dataset.testid='basemap-status';div.append(status);
  L.DomEvent.disableClickPropagation(div);L.DomEvent.disableScrollPropagation(div);this.select=select;this.status=status;return div;
 }});
 const control=new Control({position:'bottomleft'}).addTo(map);
 const option=(p,disabled=false)=>{const o=document.createElement('option');o.value=p.id;o.textContent=p.label_ar;o.disabled=disabled;control.select.append(o);};option(local);
 const update=()=>{container.dataset.basemap=current;container.dataset.basemapFallback=String(state.fallback);control.select.value=current;control.status.textContent=state.fallback?'تعذر الاتصال بخلفية الخريطة؛ الطبقات المحلية مستمرة.':current==='local'?'طبقات محلية · تعمل دون إنترنت':'خلفية متصلة';boundary?.setStyle({fillOpacity:current==='local'?1:.06});map.fire('ltip:basemap',state);};
 const choose=provider=>{
  tiles?.stop();tiles=null;current=provider.id;state.provider=current;state.fallback=false;state.reason=null;
  if(current!=='local'){
   tiles=raster(provider,reason=>{if(!alive||current==='local')return;failed.add(provider.id);tiles?.stop();tiles=null;current='local';state.provider='local';state.fallback=true;state.reason=reason;for(const o of control.select.options)if(o.value===provider.id)o.disabled=true;update();});tiles.layer.addTo(map);
  }update();
 };
 config().then(settings=>{
  if(!alive)return;const providers=[local,...(settings.providers||[]).filter(p=>p.id!=='local'&&p.enabled===true&&p.policy_reviewed===true&&typeof p.url==='string'&&p.attribution&&(/^(https:\/\/|\/)/.test(p.url)))];
  providers.slice(1).forEach(p=>option(p));control.select.onchange=()=>choose(providers.find(p=>p.id===control.select.value&&!failed.has(p.id))||local);choose(providers.find(p=>p.id===settings.default_provider)||local);
 });
 const showBoundary=data=>{if(!alive)return;boundary=L.geoJSON(data,{pane:'nationalContext',interactive:false,attribution:'<a href="https://www.naturalearthdata.com/">Natural Earth</a> · حدود سياقية معممة',style:{color:'#9eafbb',weight:1.6,fillColor:'#fffdf7',fillOpacity:current==='local'?1:.06,smoothFactor:0,noClip:true}}).addTo(map);boundary.bindTooltip('ليبيا',{permanent:true,direction:'center',className:'ltip-country-label'});if(firstFit){firstFit=false;map.fitBounds(boundary.getBounds(),{padding:[24,24],animate:false});}map.fire('ltip:contextready');};
 if(countryData)showBoundary(countryData);else context().then(showBoundary).catch(()=>{if(alive){control.status.textContent='تعذر تحميل الحد السياقي المحلي؛ بيانات المواقع مستقلة.';container.dataset.contextError='true';}});
 update();
 return ()=>{alive=false;tiles?.stop();boundary?.remove();control.remove();if(map._ltipBasemap===state)delete map._ltipBasemap;};
}
