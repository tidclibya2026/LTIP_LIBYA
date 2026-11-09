// Public code only. Selection values are supplied at runtime by a private service.
export const PRIVATE_PRESENTATION = import.meta.env?.MODE === 'government';
export const LABELS = {
  all: 'مواقع التنمية السياحية',
  targeted: 'مواقع التنمية السياحية المستهدفة للاستثمار',
  other: 'مواقع التنمية السياحية الأخرى'
};
export function normalizeSearch(value) {
  return String(value).normalize('NFKC').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ـ/g, '').replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 1776)).replace(/[\s\-،,]+/g, ' ').trim();
}
export function makeRows(geo, enrichment, privateData = null) {
  if (geo?.type !== 'FeatureCollection' || !Array.isArray(geo.features)) throw Error('مصدر GIS غير صالح');
  const ids = new Set(geo.features.map(f => f.properties.id));
  if (ids.size !== geo.features.length) throw Error('معرف GIS مكرر');
  let targets = null;
  if (privateData) {
    const list = privateData.selection?.targetIds;
    if (!Array.isArray(list) || new Set(list).size !== list.length || list.some(id => !ids.has(id))) throw Error('قائمة المواقع المستهدفة لا تطابق GIS');
    targets = new Set(list);
  }
  return geo.features.map(feature => {
    const id = feature.properties.id, source = enrichment?.zones?.[String(id)];
    const description = source?.attributes?.find(a => a.key === 'location_description_raw')?.display_ar || '';
    const images = (source?.images || []).filter(im => /^images\/investment-sites\/SITE-\d+\/IMG-\d+\.jpg$/.test(im.src));
    return {
      zone_id: id, site_name_ar: feature.properties.name_ar,
      area_ha_source: feature.properties.area_ha_geodesic,
      targeted: targets ? targets.has(id) : null,
      geographic_group: source?.geographic_group || '', description, images,
      assessment: privateData?.selection?.assessments?.[String(id)] || null,
      geometryReviewRequired: privateData?.reviewFlags?.[String(id)]?.geometry_review_required === true
    };
  });
}
export function filterRows(rows, mode, query) {
  const q = normalizeSearch(query), numeric = /^\d+$/.test(q);
  return rows.filter(row => (mode === 'all' || mode === 'targeted' && row.targeted === true || mode === 'other' && row.targeted === false) && (!q || (numeric ? row.zone_id === Number(q) : normalizeSearch(row.site_name_ar).includes(q))));
}
export function rowStats(rows, hasSelection) {
  return {
    sites: rows.length,
    targeted: hasSelection ? rows.filter(r => r.targeted === true).length : null,
    other: hasSelection ? rows.length - rows.filter(r => r.targeted === true).length : null,
    withPhotos: rows.filter(r => r.images.some(im => im.type === 'photo')).length
  };
}
export function geometryBounds(feature) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  const visit = value => {
    if (typeof value[0] === 'number') { minX = Math.min(minX, value[0]); maxX = Math.max(maxX, value[0]); minY = Math.min(minY, value[1]); maxY = Math.max(maxY, value[1]); }
    else value.forEach(visit);
  };
  visit(feature.geometry.coordinates);
  return {minX, maxX, minY, maxY};
}
