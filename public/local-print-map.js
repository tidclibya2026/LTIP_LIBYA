// Additive local print adapter. The historical V8 HTML and reference hashes stay intact.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function rings(geometry){return geometry.type==='Polygon'?geometry.coordinates:geometry.type==='MultiPolygon'?geometry.coordinates.flat():[];}
export function localMapSVG(country,site){
 const countryRings=rings(country.geometry),siteRings=rings(site.geometry),width=340,height=220;
 const drawing=(paths,x,y,w,h,color,fill)=>{
  const pairs=paths.flat();if(!pairs.length)return '';
  const project=([lon,lat])=>[lon,Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))*180/Math.PI];
  const points=pairs.map(project),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);const minX=Math.min(...xs),maxY=Math.max(...ys),dx=Math.max(...xs)-minX,dy=maxY-Math.min(...ys),scale=Math.min((w-16)/(dx||1),(h-16)/(dy||1));
  const px=x+(w-dx*scale)/2,py=y+(h-dy*scale)/2;
  const path=rs=>rs.map(r=>r.map((p,i)=>{const [a,b]=project(p);return (i?'L':'M')+(px+(a-minX)*scale).toFixed(3)+','+(py+(maxY-b)*scale).toFixed(3);}).join(' ')+' Z').join(' ');
  return {path:path(paths),project:p=>{const [a,b]=project(p);return [px+(a-minX)*scale,py+(maxY-b)*scale];},markup:`<path d="${path(paths)}" fill="${fill}" stroke="${color}" stroke-width="1.5" fill-rule="evenodd"/>`};
 };
 const national=drawing(countryRings,0,0,190,height,'#9aabb8','#fffdf7'),siteZoom=drawing(siteRings,198,27,136,155,'#a87718','#d7b66e');
 const overlay=siteRings.map(r=>'<path d="'+r.map((p,i)=>{const [x,y]=national.project(p);return (i?'L':'M')+x.toFixed(3)+','+y.toFixed(3);}).join(' ')+' Z" fill="#174a76" stroke="#174a76" stroke-width="2"/>').join('');
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="ليبيا ومضلع الموقع الأصلي"><rect width="340" height="220" fill="#e3edf2"/>${national.markup}${overlay}<rect x="197" y="22" width="139" height="167" fill="#fff" stroke="#bdcdd7"/>${siteZoom.markup}<text x="265" y="15" text-anchor="middle" font-size="10">GIS ${esc(site.properties.id)}</text><text x="94" y="207" text-anchor="middle" font-size="10">ليبيا · Natural Earth</text><text x="265" y="205" text-anchor="middle" font-size="9">مضلع الموقع · نطاق مستقل</text></svg>`;
}
async function printCards(event){
 const button=event.target.closest?.('[data-print], #printAll');if(!button||!document.querySelector('#LTIP_PRINT_V7'))return;
 event.preventDefault();event.stopImmediatePropagation();
 const cards=button.matches('[data-print]')?[button.closest('.card')]:[...document.querySelectorAll('#cards .card')];
 const win=window.open('','_blank','width=950,height=850');if(!win){alert('يرجى السماح بفتح نافذة الطباعة');return;}
 win.document.write('<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>بطاقات المواقع</title><body><p role="status">جار إعداد البطاقات المحلية...</p></body></html>');win.document.close();
 try{
  const base=new URL('./',location.href);
  const read=async path=>{const response=await fetch(new URL(path,base));if(!response.ok)throw Error('Local print data unavailable');return response.json();};
  const [geo,context,enrichment]=await Promise.all([read('data/zones_141.geojson'),read('data/libya-context.geojson'),read('data/investment_site_enrichment.json')]);
  const sheets=cards.filter(Boolean).map(card=>{
   const id=Number(card.dataset.id),site=geo.features.find(f=>f.properties.id===id);if(!site)throw Error('Unknown GIS id');
   const photo=enrichment.zones?.[id]?.images?.find(im=>im.type==='photo'&&/^images\/investment-sites\/SITE-\d+\/IMG-\d+\.jpg$/.test(im.src));
   const image=photo?`<img class="site-photo" src="${esc(new URL(photo.src,base))}" alt="${esc(photo.alt||'صورة الموقع الأصلية')}">`:'<p class="missing">لا توجد صورة موثقة</p>';
   const planning=card.querySelector('.planning-status')?.innerHTML||'';
   return `<section class="sheet" data-print-site="${id}"><header>وزارة السياحة والصناعات التقليدية · ليبيا<h1>المنصة الوطنية للخارطة الاستثمارية السياحية في ليبيا</h1></header><div class="card-head">${card.querySelector('.card-head')?.innerHTML||''}</div><div class="visuals"><div>${localMapSVG(context.features[0],site)}<small>GIS الأصلي · WGS84 / EPSG:4326. حد ليبيا سياقي معمّم 1:110m؛ لا يمثل حدًا قانونيًا مصدقًا.</small></div><div>${image}</div></div><div class="fields">${card.querySelector('.fields')?.innerHTML||''}</div><div class="note">${card.querySelector('.note')?.innerHTML||''}</div><p class="note">تصنيفات القرب الجغرافي لا تمثل تقييمًا استثماريًا أو إثبات جاهزية تشغيلية.</p><section class="planning">${planning}</section></section>`;
  }).join('');
  win.document.open();win.document.write(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>بطاقات مواقع التنمية السياحية</title><style>@page{size:A4;margin:10mm}*{box-sizing:border-box}body{font:13px/1.8 Tahoma,Arial;color:#102f50;margin:0}header{background:#102f50;color:white;text-align:center;padding:12px;border-bottom:3px solid #c59b4e}h1{font-size:17px;margin:5px}h2{font-size:18px}.sheet{border:1px solid #d4dfe7;break-after:page;padding-bottom:12px}.sheet:last-child{break-after:auto}.card-head{padding:10px 14px}.visuals,.fields{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px 14px}.visuals>div{min-width:0}svg{width:100%;height:220px}.site-photo{width:100%;height:220px;object-fit:contain}.field{border-bottom:1px solid #e0e7ed;padding:6px;overflow-wrap:anywhere}.field label{display:block;color:#526a7d;font-size:11px}.note,.planning{margin:8px 14px}.planning{break-before:page}.planning:empty{display:none}.missing{padding:60px 10px;background:#f4f7fa;text-align:center}small{font-size:9px}.grade{padding:5px;border:1px solid #c59b4e}@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.field{break-inside:avoid}}</style><body data-local-vector-print>${sheets}</body></html>`);win.document.close();
  await Promise.all([...win.document.images].map(image=>image.decode().catch(()=>{})));
  if(!win.closed){win.focus();win.print();}
 }catch{if(!win.closed){win.document.body.replaceChildren();const p=win.document.createElement('p');p.setAttribute('role','alert');p.textContent='تعذر إعداد الخريطة المحلية للطباعة. لم تُطلب بلاطات خارجية؛ أعد المحاولة بعد التحقق من البيانات المحلية.';win.document.body.append(p);}}
}
if(typeof window!=='undefined'&&typeof document!=='undefined')window.addEventListener('click',event=>{void printCards(event);},true);
