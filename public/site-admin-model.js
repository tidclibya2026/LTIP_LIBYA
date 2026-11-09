// Shared, dependency-free data contract used by the browser and local Node merger.
export const SCHEMA = 1;
export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 50 * 1024 * 1024;
export const MAX_PACKAGE_BYTES = 72 * 1024 * 1024;
export const SECTIONS = ['photos', 'aerial_maps', 'contour_maps', 'studies_and_plans'];
export const EXTENSIONS = {
  photos: ['jpg', 'jpeg', 'png', 'webp'],
  aerial_maps: ['jpg', 'jpeg', 'png', 'pdf', 'tif', 'tiff'],
  contour_maps: ['jpg', 'jpeg', 'png', 'pdf', 'geojson', 'json', 'kml', 'tif', 'tiff'],
  studies_and_plans: ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx', 'odt', 'txt'],
};
export const REVIEW = { DRAFT: 'مسودة', IN_REVIEW: 'قيد المراجعة', APPROVED: 'معتمد للنشر', REJECTED: 'مرفوض' };
export const STUDY_TYPES = { FEASIBILITY: 'دراسة جدوى', MASTER_PLAN: 'مخطط عام', DETAILED_PLAN: 'مخطط تفصيلي', ENVIRONMENTAL: 'دراسة بيئية', ENGINEERING: 'دراسة هندسية', MARKET: 'دراسة سوق', INVESTMENT: 'دراسة استثمارية', OTHER: 'وثيقة أخرى' };
export const DESCRIPTIVE_FIELDS = {
  overview: 'الوصف العام للموقع', geographic_location: 'الموقع الجغرافي حسب المصادر', administrative_location: 'الموقع الإداري حسب المصادر',
  current_tourism_use: 'الاستعمال السياحي الحالي', proposed_tourism_use: 'الاستعمال السياحي المقترح', terrain: 'طبيعة الأرض والتضاريس',
  access_and_roads: 'سهولة الوصول والطرق', electricity: 'الكهرباء', water: 'المياه', sewage: 'الصرف الصحي', telecommunications: 'الاتصالات',
  nearby_services: 'المرافق والخدمات القريبة', surrounding_attractions: 'المعالم السياحية والبيئية المحيطة', constraints: 'القيود البيئية والعمرانية والتنظيمية', technical_notes: 'ملاحظات فنية إضافية', source: 'مصدر البيانات الوصفية',
};
export const PLANNING_FIELDS = { site_name: 'اسم الموقع في المصدر', area_ha_source: 'المساحة المصدرية بالهكتار', planning_category: 'حالة التخريط', decision_number: 'رقم قرار الصبغة السياحية', decision_date_raw: 'تاريخ القرار كما في المصدر', issuing_authority: 'الجهة المصدرة', source: 'مرجع البيانات التخطيطية' };
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function requireValue(condition, message) { if (!condition) throw Error(message); }
export function safeFilename(name) {
  requireValue(typeof name === 'string' && name.length > 0 && name.length <= 120 && !/[\\/:*?"<>|\u0000-\u001f\u007f]/.test(name) && !name.startsWith('.') && !/[. ]$/.test(name) && !/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name), 'اسم الملف غير صالح');
  return name;
}
export const extension = name => name.split('.').pop().toLowerCase();
export function validateFileInfo(file, section) {
  safeFilename(file?.name);
  requireValue(uuid.test(file.id), 'معرف ملف غير صالح');
  requireValue(EXTENSIONS[section]?.includes(extension(file.name)), 'صيغة الملف غير مدعومة في هذا القسم');
  requireValue(Number.isSafeInteger(file.size) && file.size > 0 && file.size <= MAX_FILE_BYTES, 'حجم الملف غير صالح أو يتجاوز 20 ميغابايت');
  requireValue(/^[a-f0-9]{64}$/.test(file.sha256), 'بصمة الملف غير صالحة');
  requireValue(typeof file.mime === 'string' && file.mime.length < 150, 'نوع الملف غير صالح');
}
export const sha256 = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
export function emptyZone(zoneId) {
  return { zone_id: zoneId, planning_data: {}, photos: [], aerial_maps: [], contour_maps: [], descriptive_data: {}, studies_and_plans: [], review_status: 'DRAFT', publication_clearance: 'UNREVIEWED', section_review: {}, updated_at: new Date().toISOString() };
}
export function validateZone(zone, allowedIds) {
  requireValue(zone && Number.isInteger(zone.zone_id) && allowedIds.includes(zone.zone_id), 'معرف الموقع غير موجود في قاعدة GIS');
  requireValue(Object.hasOwn(REVIEW, zone.review_status) && ['UNREVIEWED', 'PUBLIC_CLEARED', 'PRIVATE'].includes(zone.publication_clearance), 'حالة مراجعة الموقع غير صالحة');
  requireValue(typeof zone.updated_at === 'string' && !Number.isNaN(Date.parse(zone.updated_at)), 'تاريخ تحديث الموقع غير صالح');
  for (const key of ['planning_data', 'descriptive_data', 'section_review']) requireValue(zone[key] && typeof zone[key] === 'object' && !Array.isArray(zone[key]), 'بنية بيانات القسم غير صالحة');
  for (const [section, status] of Object.entries(zone.section_review)) requireValue(['planning_data', 'descriptive_data', ...SECTIONS].includes(section) && Object.hasOwn(REVIEW, status), 'حالة مراجعة القسم غير صالحة');
  for (const [key, fields] of [['planning_data', PLANNING_FIELDS], ['descriptive_data', DESCRIPTIVE_FIELDS]]) {
    for (const [field, value] of Object.entries(zone[key])) requireValue(Object.hasOwn(fields, field) && typeof value === 'string' && value.length <= 12000 && !/\u0000/.test(value), 'حقل نصي غير صالح أو طويل جدًا');
  }
  const ids = new Set();
  for (const section of SECTIONS) {
    requireValue(Array.isArray(zone[section]) && zone[section].length <= 100, 'عدد المرفقات غير صالح');
    const hashes = new Set();
    for (const item of zone[section]) {
      requireValue(uuid.test(item.id) && !ids.has(item.id) && item.zone_id === zone.zone_id, 'معرف مرفق مكرر أو ارتباط غير صالح'); ids.add(item.id);
      requireValue(Object.hasOwn(REVIEW, item.approval_status) && ['UNREVIEWED', 'PUBLIC_CLEARED', 'PRIVATE'].includes(item.publication_clearance), 'حالة مراجعة المرفق غير صالحة');
      requireValue(typeof item.updated_at === 'string' && !Number.isNaN(Date.parse(item.updated_at)), 'تاريخ تحديث المرفق غير صالح');
      for (const [key, value] of Object.entries(item)) {
        requireValue(!['__proto__', 'prototype', 'constructor'].includes(key), 'اسم حقل غير صالح');
        if (typeof value === 'string') requireValue(value.length <= 12000 && !/\u0000/.test(value), 'نص المرفق طويل جدًا');
        else requireValue(['zone_id', 'file'].includes(key), 'قيمة حقل مرفق غير صالحة');
      }
      if (item.file) {
        validateFileInfo(item.file, section);
        requireValue(item.file.id === item.id && !hashes.has(item.file.sha256), 'ملف مكرر داخل القسم'); hashes.add(item.file.sha256);
      } else requireValue(section === 'studies_and_plans', 'هذا القسم يتطلب ملفًا فعليًا');
      if (section === 'studies_and_plans') requireValue(Object.hasOwn(STUDY_TYPES, item.document_type), 'نوع الدراسة غير صالح');
    }
  }
  return zone;
}
export function validateManifest(bundle, allowedIds) {
  requireValue(bundle?.schema_version === SCHEMA && bundle.kind === 'LTIP_SITE_ADMIN_PACKAGE' && Array.isArray(bundle.zones) && bundle.zones.length <= 141 && Array.isArray(bundle.files), 'بنية حزمة الاستيراد غير صالحة');
  requireValue(new Set(bundle.zones.map(z => z.zone_id)).size === bundle.zones.length, 'مواقع مكررة في الحزمة');
  const references = new Map();
  const attachmentIds = new Set();
  for (const zone of bundle.zones) {
    validateZone(zone, allowedIds);
    for (const section of SECTIONS) for (const item of zone[section]) {
      requireValue(!attachmentIds.has(item.id), 'معرف مرفق مكرر عبر المواقع'); attachmentIds.add(item.id);
      if (item.file) references.set(item.file.id, { file: item.file, zone_id: zone.zone_id, section });
    }
  }
  requireValue(bundle.files.length === references.size, 'ملفات ناقصة أو ملفات زائدة في الحزمة');
  const seen = new Set(); let total = 0;
  for (const entry of bundle.files) {
    const ref = references.get(entry.id);
    requireValue(ref && !seen.has(entry.id), 'معرف ملف مجهول أو مكرر'); seen.add(entry.id);
    for (const key of ['name', 'size', 'sha256', 'mime']) requireValue(entry[key] === ref.file[key], 'بيانات الملف لا تطابق مرجع المرفق');
    requireValue(typeof entry.base64 === 'string' && entry.base64.length === 4 * Math.ceil(entry.size / 3) && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(entry.base64), 'ترميز الملف غير صالح');
    total += entry.size;
  }
  requireValue(total <= MAX_TOTAL_BYTES, 'إجمالي الملفات يتجاوز 50 ميغابايت');
  return references;
}
export function isPublishable(item) { return item.approval_status === 'APPROVED' && item.publication_clearance === 'PUBLIC_CLEARED' && item.source?.trim() && item.rights?.trim() && item.title?.trim(); }
export function safePublishedPath(src) { return typeof src === 'string' && /^data\/manual-assets\/zone-\d+\/[a-f0-9-]+\.[a-z0-9]+$/i.test(src); }
export function completion(zone, section) {
  if (section === 'planning_data' || section === 'descriptive_data') {
    const keys = Object.keys(section === 'planning_data' ? PLANNING_FIELDS : DESCRIPTIVE_FIELDS);
    return `${keys.filter(key => zone[section][key]?.trim()).length}/${keys.length}`;
  }
  return zone[section].length ? `${zone[section].filter(item => item.title?.trim() && item.source?.trim() && item.rights?.trim()).length}/${zone[section].length}` : 'لا توجد بيانات';
}
