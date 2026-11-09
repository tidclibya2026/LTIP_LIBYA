export const statuses = { DRAFT: 'مسودة', REVIEW: 'قيد المراجعة', APPROVED: 'اعتماد محلي تجريبي', REJECTED: 'إعادة للتحرير' };
export const fields = {
 sites: [['municipality','البلدية'],['classification','تصنيف الموقع'],['readiness','الجاهزية الاستثمارية'],['infrastructure','البنية التحتية'],['access','الوصول'],['utilities','المرافق'],['services','الخدمات'],['risks','المخاطر'],['mapping','حالة التخريط','select','تم تخريط|خريطة عقارية|غير مثبت'],['decisionNumber','رقم قرار التخصيص السياحي'],['decisionDate','تاريخ قرار التخصيص','date'],['historicalName','اسم الموقع التاريخي'],['historicalArea','المساحة التاريخية بالهكتار','number'],['confidence','ثقة المطابقة','select','غير مثبت|مرشح للمراجعة|موثق بأدلة'],['evidence','مرجع دليل المطابقة'],['source','وثائق المصدر'],['notes','ملاحظات']],
 opportunities: [['title','عنوان الفرصة'],['siteId','الموقع المرجعي','site'],['investmentType','نوع الاستثمار السياحي'],['description','الوصف'],['cost','التكلفة التقديرية','number'],['currency','العملة','select','LYD|USD|EUR'],['components','مكونات المشروع'],['employment','العمالة المتوقعة','number'],['infrastructure','متطلبات البنية التحتية'],['readiness','الجاهزية'],['risks','المخاطر'],['source','مصدر التقييم'],['assessmentDate','تاريخ التقييم','date']],
 parks: [['title','الاسم الإداري المقترح'],['municipality','البلدية'],['administration','الجهة الإدارية'],['services','الخدمات'],['facilities','التجهيزات'],['environment','المعلومات البيئية'],['legal','الوضع القانوني'],['source','المستندات الداعمة'],['notes','ملاحظات']],
 gardens: [['title','الاسم الإداري المقترح'],['municipality','البلدية'],['administration','الجهة الإدارية'],['services','الخدمات'],['facilities','التجهيزات'],['environment','المعلومات البيئية'],['legal','الوضع القانوني'],['source','المستندات الداعمة'],['notes','ملاحظات']],
 media: [['title','عنوان الصورة'],['link','الربط المقترح','link'],['source','نسبة المصدر'],['rights','حقوق الاستخدام'],['clearance','موافقة النشر','select','غير مراجع|بحاجة إلى توثيق|موافقة موثقة محليًا'],['cover','صورة الغلاف','select','لا|نعم'],['order','ترتيب المعرض','number'],['notes','ملاحظات']],
 geometry: [['link','المعلم المرجعي','feature'],['source','مصدر الهندسة المقترحة'],['notes','سبب التغيير']]
};
export function validateRecord(row, masters) {
 if(Object.keys(row).some(k=>!['kind','id','status','values','updatedAt','image','file','proposed','importName','attachments'].includes(k)))throw Error('خصائص سجل غير مسموحة');
 if (!fields[row.kind] || typeof row.id !== 'string' || !row.id || !statuses[row.status] || !row.values || typeof row.values !== 'object') throw Error('سجل مسودة غير صالح');
 if (Object.keys(row.values).some(k => !fields[row.kind].some(f=>f[0]===k))) throw Error('حقول غير مسموحة؛ لا يمكن استيراد قيم GIS الأصلية');
 for (const [key,,type,choices] of fields[row.kind]) {
  const v=row.values[key]; if(v===undefined || v==='') continue;
  if(typeof v!=='string' || v.length>20000) throw Error('قيمة حقل غير صالحة');
  if(type==='number' && (!Number.isFinite(Number(v)) || Number(v)<0)) throw Error('الأرقام يجب أن تكون موجبة أو صفرًا');
  if(type==='select' && !choices.split('|').includes(v)) throw Error('اختيار غير صالح');
  if(type==='date' && (!/^\d{4}-\d{2}-\d{2}$/.test(v)||!Number.isFinite(Date.parse(v))||new Date(v).toISOString().slice(0,10)!==v)) throw Error('تاريخ غير صالح');
  if(['order','employment'].includes(key)&&!Number.isInteger(Number(v)))throw Error('يجب إدخال عدد صحيح');
 }
 if(['sites','parks','gardens'].includes(row.kind) && !masters[row.kind].some(r=>r.id===row.id)) throw Error('معرف مرجعي غير موجود');
 if(row.kind==='opportunities' && (!row.values.title?.trim() || !masters.sites.some(s=>s.id===row.values.siteId))) throw Error('عنوان الفرصة ومعرف GIS موجود مطلوبان');
 if(row.kind==='opportunities' && row.values.cost && !row.values.currency) throw Error('حدد عملة التكلفة');
 if(row.kind==='media' && !row.values.title?.trim()) throw Error('عنوان الصورة مطلوب');
 if(row.values.link && !Object.values(masters).flat().some(r=>r.key===row.values.link)) throw Error('رابط المعلم غير صالح');
 if(row.attachments!==undefined && (!Array.isArray(row.attachments)||row.attachments.length>20))throw Error('المرفقات غير صالحة');
 for(const a of row.attachments||[])if(typeof a.name!=='string'||!Number.isFinite(a.size)||a.size>10*1024*1024||!/^data:(application\/pdf|image\/(png|jpeg|webp));base64,[A-Za-z0-9+/=]+$/.test(a.data||''))throw Error('مرفق غير صالح');
 if(row.kind==='geometry') { if(!row.values.link) throw Error('اختر المعلم المرجعي'); validateGeoJSON(row.proposed); }
 if(row.kind==='media' && row.image && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(row.image)) throw Error('صورة غير صالحة');
 if(row.kind==='media' && row.image?.length>14000000) throw Error('الصورة تتجاوز الحد المحلي');
 if(row.kind==='media'&&(!row.image||!row.file))throw Error('اختيار صورة محلية وبياناتها مطلوب');
 if(row.kind==='media'&&row.values.cover==='نعم'&&!row.values.link)throw Error('صورة الغلاف تحتاج ربطًا صريحًا بمعلم');
 if(row.kind==='media'&&row.status==='APPROVED'&&(!row.values.source?.trim()||!row.values.rights?.trim()||row.values.clearance!=='موافقة موثقة محليًا'))throw Error('الاعتماد المحلي للصورة يحتاج مصدرًا وحقوقًا وموافقة موثقة');
 if(row.image&&row.kind!=='media'||row.proposed&&row.kind!=='geometry')throw Error('محتوى المسودة لا يطابق نوع السجل');
 if(row.kind==='geometry'&&!Object.entries(masters).filter(([k])=>k!=='opportunities').flatMap(([,v])=>v).some(r=>r.key===row.values.link))throw Error('يجب ربط الهندسة بمعلم مكاني مرجعي');
 return row;
}
export function validateGeoJSON(input) {
 if(input?.crs && !/(?:^|[:/])(?:4326|CRS84)$/i.test(input.crs.properties?.name||input.crs.name||'')) throw Error('يجب تحويل CRS إلى WGS84 / EPSG:4326 قبل الاستيراد');
 const features=input?.type==='FeatureCollection'?input.features:input?.type==='Feature'?[input]:[];
 if(!features?.length || features.length>500) throw Error('يجب إدخال 1–500 معلم GeoJSON');
 const point=p=>Array.isArray(p)&&p.length>=2&&p.every(Number.isFinite)&&Math.abs(p[0])<=180&&Math.abs(p[1])<=90;
 const ring=r=>Array.isArray(r)&&r.length>=4&&r.every(point)&&r[0].length===r.at(-1).length&&r[0].every((n,i)=>n===r.at(-1)[i]);
 for(const f of features) {
  if(f?.type!=='Feature')throw Error('كل عنصر يجب أن يكون Feature');
  const g=f.geometry,c=g?.coordinates;
  if(g?.type==='Point' ? !point(c) : g?.type==='LineString' ? !Array.isArray(c)||c.length<2||!c.every(point) : g?.type==='Polygon' ? !Array.isArray(c)||!c.length||!c.every(ring) : g?.type==='MultiPolygon' ? !Array.isArray(c)||!c.length||!c.every(p=>p.length&&p.every(ring)) : true) throw Error('هندسة غير صالحة أو غير مدعومة؛ افحص الإحداثيات وإغلاق الحلقات');
 }
 return {type:'FeatureCollection',features};
}
export function parseGeometry(text, name) {
 if(!name.toLowerCase().endsWith('.kml')) return validateGeoJSON(JSON.parse(text));
 const doc=new DOMParser().parseFromString(text,'application/xml');
 if(doc.querySelector('parsererror') || doc.documentElement.localName!=='kml') throw Error('ملف KML غير صالح');
 const all=(root,tag)=>[...root.getElementsByTagNameNS('*',tag)];
 if(all(doc,'NetworkLink').length || all(doc,'Model').length || all(doc,'Track').length) throw Error('KML يتضمن عناصر خارجية أو هندسة غير مدعومة');
 const coords=e=>e.textContent.trim().split(/\s+/).map(p=>p.split(',').map(Number));
 const features=all(doc,'Placemark').flatMap(p=>['Point','LineString','Polygon'].flatMap(type=>all(p,type).map(g=>({type:'Feature',properties:{name:all(p,'name')[0]?.textContent||''},geometry:{type,coordinates:type==='Polygon'?all(g,'LinearRing').map(r=>coords(all(r,'coordinates')[0])):type==='Point'?coords(all(g,'coordinates')[0])[0]:coords(all(g,'coordinates')[0])}}))));
 return validateGeoJSON({type:'FeatureCollection',features});
}
export const completeness = row => Math.round(fields[row.kind].filter(([k])=>row.values[k]?.trim()).length/fields[row.kind].length*100);
export function validationMasters(masters,records){return {...masters,opportunities:records.filter(r=>r.kind==='opportunities').map(r=>({key:'opportunities:'+r.id}))};}
export function geometryStats(input){const features=input?.type==='FeatureCollection'?input.features:input?[input]:[];let vertices=0;const bounds=[Infinity,Infinity,-Infinity,-Infinity];const visit=c=>{if(!Array.isArray(c))return;if(typeof c[0]==='number'){vertices++;bounds[0]=Math.min(bounds[0],c[0]);bounds[1]=Math.min(bounds[1],c[1]);bounds[2]=Math.max(bounds[2],c[0]);bounds[3]=Math.max(bounds[3],c[1]);}else c.forEach(visit);};features.forEach(f=>visit(f.geometry?.coordinates));return {features:features.length,vertices,types:[...new Set(features.map(f=>f.geometry?.type))],bounds:vertices?bounds:[]};}
export function validateWorkspace(records,masters){if(!Array.isArray(records)||records.length>5000)throw Error('عدد المسودات غير صالح');const keys=new Set(),covers=new Set(),refs=validationMasters(masters,records);for(const r of records){validateRecord(r,refs);const key=r.kind+':'+r.id;if(keys.has(key))throw Error('معرف مسودة مكرر');keys.add(key);if(r.kind==='media'&&r.values.cover==='نعم'){if(covers.has(r.values.link))throw Error('يوجد غلاف محلي للمعلم؛ ألغِ اختياره قبل تعيين غلاف آخر');covers.add(r.values.link);}}}
