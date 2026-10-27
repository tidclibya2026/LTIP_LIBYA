import { SECTIONS, isPublishable, safePublishedPath } from './site-admin-model.js';

export const LIBRARY_SECTIONS = {
  photos: 'الصور الفوتوغرافية', aerial_maps: 'الصور الجوية والفضائية', boundary_maps: 'خرائط الحدود',
  reference_maps: 'الخرائط المرجعية', contour_maps: 'الخرائط الكنتورية', studies: 'الدراسات', plans: 'المخططات',
  descriptive_data: 'البيانات الوصفية', planning_data: 'الوضع التخطيطي', decisions: 'قرارات إضفاء الصبغة السياحية', unclassified: 'غير مصنّف — للمراجعة',
};
export const MANUAL_CATEGORIES = {
  photos: ['photos', 'boundary_maps', 'reference_maps', 'unclassified'],
  aerial_maps: ['aerial_maps', 'boundary_maps', 'reference_maps', 'unclassified'],
  contour_maps: ['contour_maps', 'boundary_maps', 'reference_maps', 'unclassified'],
  studies_and_plans: ['studies', 'plans', 'planning_data', 'decisions', 'boundary_maps', 'reference_maps', 'unclassified'],
};
// Only explicit inventory metadata determines classification. Names and pixels are never guessed.
const originalTypes = Object.assign(Object.create(null), { photo: 'photos', aerial_satellite: 'aerial_maps', boundary: 'boundary_maps', reference_map: 'reference_maps', contour: 'contour_maps' });
export function localAssetPath(src) {
  if (typeof src !== 'string') return null;
  try {
    const path = decodeURIComponent(src.replace(/^\//, ''));
    if (!/^(images|data\/manual-assets)\//.test(path) || /[\\\u0000-\u001f?#:]/.test(path) || path.split('/').some(p => !p || p === '.' || p === '..')) return null;
    return path;
  } catch { return null; }
}
export function publishedManual(zone, id) {
  return zone?.zone_id === Number(id) && zone.review_status === 'APPROVED' && zone.publication_clearance === 'PUBLIC_CLEARED' ? zone : null;
}
export function manualCategory(item, section) {
  if (item.library_category) return MANUAL_CATEGORIES[section]?.includes(item.library_category) ? item.library_category : 'unclassified';
  if (section !== 'studies_and_plans') return section;
  return ['MASTER_PLAN', 'DETAILED_PLAN'].includes(item.document_type) ? 'plans' : item.document_type === 'OTHER' ? 'unclassified' : 'studies';
}
export function buildSiteLibrary({ zoneId, site, legacy = [], manual }) {
  const groups = Object.fromEntries(Object.keys(LIBRARY_SECTIONS).map(key => [key, []]));
  const seen = new Set();
  const add = (category, item) => {
    const path = item.src ? localAssetPath(item.src) : null;
    if (item.src && !path || path && seen.has(path)) return;
    if (path) seen.add(path);
    groups[category].push({ ...item, category, src: item.src || null });
  };
  if (site?.zone_id === Number(zoneId)) for (const item of site.images || []) add(originalTypes[item.type] || 'unclassified', {
    ...item, title: item.original_filename || item.alt || item.id, classification_source: 'نوع الملف الموثق في سجل الصور الأصلي', origin: 'original',
  });
  for (const [index, item] of legacy.entries()) add(originalTypes[item.type] || 'unclassified', {
    ...item, id: `legacy-${zoneId}-${index}`, title: item.caption || item.alt || 'ملف أرشيفي', original_filename: item.src?.split('/').pop(),
    classification_source: item.type ? 'نوع الملف الموثق في سجل الأرشيف' : 'لا يتوفر نوع موثق في سجل الأرشيف؛ يلزم المراجعة', origin: 'legacy',
  });
  const approved = publishedManual(manual, zoneId);
  if (approved) for (const section of SECTIONS) if (approved.section_review?.[section] === 'APPROVED') for (const item of approved[section] || []) {
    if (!isPublishable(item) || item.file && !safePublishedPath(item.file.src)) continue;
    add(manualCategory(item, section), { ...item, src: item.file?.src || null, original_filename: item.file?.name, alt: item.title,
      classification_source: item.library_category ? 'تصنيف موثق في الإدخال اليدوي المراجع' : 'نوع القسم / الوثيقة في الإدخال اليدوي المراجع', origin: 'manual',
    });
  }
  return { groups, manual: approved, totalFiles: Object.values(groups).flat().filter(item => item.src).length };
}
