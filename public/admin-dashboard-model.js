import { REVIEW, validateFileInfo, MAX_TOTAL_BYTES, MAX_PACKAGE_BYTES } from './site-admin-model.js';
export const TYPES = { sites: 'المواقع الاستثمارية', opportunities: 'الفرص الاستثمارية', parks: 'المنتزهات الوطنية', gardens: 'المنتزهات والحدائق' };
const group = text => Object.fromEntries(text.split('|').map(v => v.split(':')));
export const FIELDS = {
 sites: {
 'التعريف': group('name:الاسم الرسمي|historical_name:الاسم التاريخي|english_name:الاسم الإنجليزي|region:المنطقة الإدارية|municipality:البلدية|registry_area:المساحة حسب السجل ووحدتها'),
 'التخطيط والعقار': group('mapping:حالة التخريط|classification:التصنيف|uses:الاستعمالات|decision_number:رقم القرار|decision_date:تاريخ القرار|issuer:الجهة المصدرة|decision_source:مصدر القرار|legal_verification:حالة التحقق القانوني|ownership:نوع الملكية|affiliation:جهة التبعية|property_documents:المستندات العقارية|property_constraints:القيود العقارية|property_verification:حالة التحقق العقاري'),
 'الخصائص الفنية': group('terrain:التضاريس|access:الوصول|roads:الطرق|water:المياه|electricity:الكهرباء|sewage:الصرف الصحي|telecom:الاتصالات|services:المرافق والخدمات'),
 'الاستثمار': group('activity:النشاط السياحي المقترح|development:إمكانات التطوير|constraints:القيود|priority:الأولوية|readiness:الجاهزية الاستثمارية|readiness_criteria:معايير الجاهزية الموثقة') },
 opportunities: {'التعريف': group('name:اسم الفرصة|description:وصف المشروع|activity:النشاط والقطاع السياحي|municipality:البلدية|region:المنطقة|area:المساحة المطلوبة ووحدتها'), 'الاستثمار': group('amount:حجم الاستثمار التقديري|currency:العملة|partnership:نموذج الاستثمار والشراكة|issuer:الجهة الطارحة|stage:مرحلة المشروع|offering:حالة الطرح|feasibility:دراسات الجدوى|infrastructure:المرافق والبنية التحتية|risks:المخاطر والقيود')},
 parks: {'التعريف': group('name:الاسم العربي|english_name:الاسم الإنجليزي|classification:التصنيف الرسمي|municipality:البلدية|location:الموقع|area:المساحة ووحدتها|coordinates:الإحداثيات والحدود|layer_id:معرف الطبقة الموثق|layer_source:مصدر ربط الطبقة'), 'الحماية والتطوير': group('legal_basis:قرار الإنشاء والسند القانوني|official_source:المصدر الرسمي للتصنيف|supervisor:الجهة المشرفة|nature:الخصائص الطبيعية والتنوع البيولوجي|activities:الأنشطة المسموحة|constraints:القيود|services:الخدمات والمرافق|access:الوصول والطرق|capacity:الطاقة الاستيعابية الموثقة|management:خطط الإدارة والحماية|investment:فرص الاستثمار والتطوير')},
 gardens: {'التعريف': group('name:الاسم|facility_type:نوع المرفق|city:المدينة|municipality:البلدية|area:المساحة ووحدتها|location:الموقع الجغرافي'), 'التشغيل والتطوير': group('owner:الجهة المالكة حسب الوثائق|operator:الجهة المشغلة حسب الوثائق|operation:حالة التشغيل|services:المرافق والخدمات|activities:الأنشطة الترفيهية|access:سهولة الوصول|capacity:الطاقة الاستيعابية|needs:الاحتياجات التطويرية|investment:فرص الاستثمار')}
};
// The editor and dashboard share the same fields and package contract.
FIELDS.sites = {
 'البيانات الأساسية': group('name:اسم الموقع الرسمي|historical_name:الاسم التاريخي|english_name:الاسم الإنجليزي|municipality:البلدية|region:المنطقة|registry_area:المساحة حسب السجل ووحدتها|description:وصف الموقع'),
 'الوضع التخطيطي والقرارات': group('mapping:حالة التخريط|classification:التصنيف|uses:الاستعمالات|decision_number:رقم قرار إضفاء الصبغة السياحية|decision_date:تاريخ القرار|issuer:الجهة المصدرة|legal_verification:حالة التحقق القانوني|decision_source:مصدر القرار|planning_notes:ملاحظات التخطيط والقرارات'),
 'الملكية والوضع العقاري': group('ownership:نوع الملكية|affiliation:جهة التبعية|property_status:الوضع العقاري|property_constraints:القيود العقارية|property_documents:الوثائق العقارية|property_verification:حالة التحقق العقاري'),
 'الخرائط': group('map_crs:نظام الإحداثيات|map_source:مصدر الخرائط'),
 'الصور': {},
 'البيانات الوصفية': group('terrain:التضاريس|access:الوصول|roads:الطرق|electricity:الكهرباء|water:المياه|sewage:الصرف الصحي|telecom:الاتصالات|services:الخدمات|activity:الأنشطة السياحية المقترحة'),
 'الدراسات والمخططات': group('feasibility:دراسات الجدوى|master_plan:المخطط العام|detailed_plan:المخطط التفصيلي|environmental_study:الدراسات البيئية|engineering_study:الدراسات الهندسية|study_approval:حالة اعتماد الدراسات وسندها'),
 'الجاهزية الاستثمارية': group('potential_opportunities:الفرص المحتملة|requirements:المتطلبات|development:إمكانات التطوير|constraints:القيود|priority:الأولوية|readiness:حالة الجاهزية|readiness_criteria:معايير ومصدر تقييم الجاهزية الموثقة')
};
export const labels = type => Object.assign({}, ...Object.values(FIELDS[type]));
export const keyOf = row => `${row.type}:${row.id}`;
export function createRecord(type, zone) { return { type, id: type === 'sites' ? String(zone.id) : crypto.randomUUID(), data: {}, evidence: {}, zone_ids: [], attachments: [], status: 'DRAFT', history: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString(), reviewer: '', review_notes: '', public_clearance: false }; }
export function completeness(row) { const keys = Object.keys(labels(row.type)); return Math.round(keys.filter(k => row.data[k]?.trim() && row.evidence[k]?.source?.trim()).length / keys.length * 100); }
const require = (ok, text) => { if (!ok) throw Error(text); };
export function validateRecords(rows, ids) {
 require(Array.isArray(rows) && rows.length <= 5000, 'بنية السجلات غير صالحة'); const seen = new Set(), files = new Set();
 for (const r of rows) {
  require(r && Object.hasOwn(TYPES, r.type) && typeof r.id === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(r.id), 'معرف سجل غير صالح');
  require(!seen.has(keyOf(r)), 'معرف سجل مكرر'); seen.add(keyOf(r));
  require(r.type !== 'sites' || ids.includes(Number(r.id)) && String(Number(r.id)) === r.id, 'الموقع غير موجود في GIS أو معرفه غير قياسي');
  require(Object.hasOwn(REVIEW, r.status) && Array.isArray(r.zone_ids) && new Set(r.zone_ids).size === r.zone_ids.length && r.zone_ids.every(id => ids.includes(id)), 'حالة أو علاقة موقع غير صالحة');
  require(r.type === 'opportunities' || r.zone_ids.length === 0, 'الربط بالمواقع مخصص للفرص');
  require(r.data && !Array.isArray(r.data) && r.evidence && !Array.isArray(r.evidence) && Array.isArray(r.history) && r.history.length <= 10000 && Array.isArray(r.attachments), 'بنية السجل غير صالحة');
  require(typeof r.reviewer === 'string' && typeof r.review_notes === 'string' && typeof r.public_clearance === 'boolean' && [r.created_at,r.updated_at].every(v => typeof v === 'string' && Number.isFinite(Date.parse(v))), 'بيانات التوثيق غير صالحة');
  for (const [k,v] of Object.entries(r.data)) require(Object.hasOwn(labels(r.type), k) && typeof v === 'string' && v.length <= 12000, 'حقل غير صالح');
  for (const [k,v] of Object.entries(r.evidence)) require(Object.hasOwn(labels(r.type), k) && v && typeof v.source === 'string' && v.source.length <= 12000 && (v.notes === undefined || typeof v.notes === 'string' && v.notes.length <= 12000) && ['UNVERIFIED','VERIFIED','REJECTED'].includes(v.verification), 'توثيق غير صالح');
  for (const a of r.attachments) {
   validateFileInfo(a.file, a.section); require(!files.has(a.file.id), 'معرف مرفق مكرر'); files.add(a.file.id);
   require(typeof a.source === 'string' && typeof a.rights === 'string' && typeof a.approved === 'boolean', 'توثيق المرفق ناقص');
   for (const key of ['title','description','date','category','crs']) require(a[key] === undefined || typeof a[key] === 'string' && a[key].length <= 12000, 'بيانات وصف المرفق غير صالحة');
  }
  if (r.status === 'APPROVED') assertApproved(r);
 }
 return rows;
}
export function assertApproved(r) {
 require(r.status === 'APPROVED' && r.public_clearance === true && r.reviewer?.trim() && r.review_notes?.trim(), 'يلزم اعتماد المراجع وتصريح النشر وملاحظات المراجعة');
 require(r.data.name?.trim(), 'اسم السجل مطلوب للاعتماد');
 for (const [k,v] of Object.entries(r.data)) if (v.trim()) require(r.evidence[k]?.source?.trim() && r.evidence[k]?.verification === 'VERIFIED', 'كل معلومة مدخلة تتطلب مصدرًا وتحققًا قبل الاعتماد');
 require(r.type !== 'parks' || r.data.official_source?.trim() && r.data.legal_basis?.trim(), 'تصنيف المنتزه الوطني يتطلب مصدرًا رسميًا وسندًا قانونيًا');
 require(!r.data.layer_id?.trim() || r.data.layer_source?.trim(), 'معرف الطبقة يتطلب مصدر ربط موثق');
 require(!r.data.readiness?.trim() || r.data.readiness_criteria?.trim(), 'الجاهزية تتطلب معايير موثقة');
 for (const a of r.attachments) require(a.approved === true && a.source.trim() && a.rights.trim(), 'المرفقات تتطلب مصدرًا وحقوق نشر واعتمادًا مستقلًا');
}
export function revised(previous, next, action = 'SAVE') {
 const row = structuredClone(next); const at = new Date().toISOString();
 if (action === 'SAVE') row.status = 'DRAFT';
 row.updated_at = at;
 row.history = [...(previous?.history || []), { at, action, changes: Object.keys(row).filter(k => !['history','updated_at'].includes(k) && JSON.stringify(previous?.[k]) !== JSON.stringify(row[k])).map(field => ({ field, before: previous?.[field] ?? null, after: row[field] })) }];
 return row;
}
export async function validateBundle(bundle, ids, verify) {
 require(bundle?.kind === 'LTIP_ADMIN_PACKAGE' && bundle.schema_version === 1 && Array.isArray(bundle.files), 'حزمة إدارة غير صالحة'); validateRecords(bundle.records, ids);
 const refs = new Map(bundle.records.flatMap(r => r.attachments.map(a => [a.file.id, a]))); const seen = new Set(); let total = 0;
 require(refs.size === bundle.files.length, 'ملفات زائدة أو ناقصة');
 for (const f of bundle.files) {
  const ref = refs.get(f.id); require(ref && !seen.has(f.id), 'معرف ملف مجهول أو مكرر'); seen.add(f.id);
  for (const k of ['name','size','mime','sha256']) require(f[k] === ref.file[k], 'الملف لا يطابق المرجع');
  require(typeof f.base64 === 'string' && f.base64.length === 4 * Math.ceil(f.size / 3) && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(f.base64), 'ترميز ملف غير صالح');
  total += f.size; require(total <= MAX_TOTAL_BYTES, 'الحزمة تتجاوز 50 ميغابايت'); await verify(f);
 }
 require(JSON.stringify(bundle).length <= MAX_PACKAGE_BYTES, 'الحزمة كبيرة جدًا'); return bundle;
}
