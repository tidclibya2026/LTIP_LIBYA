import publicFiles from '../../release/public-files.json';
export const DEMO_FEEDS = { sites: 'data/zones_141.geojson', enrichment: 'data/investment_site_enrichment.json', national: 'data/parks/public/national-parks.geojson', gardens: 'data/parks/public/public-gardens.geojson', theme: 'data/parks/FD_THEME_PARK_1.geojson' };
const allowed = new Set(publicFiles);
export function buildDemoData(feeds) {
  const features = feeds.sites?.features;
  if (!Array.isArray(features) || features.length !== 141 || new Set(features.map(f => f.properties?.id)).size !== 141) throw Error('تعذر التحقق من المواقع المرجعية الـ141.');
  if (feeds.enrichment?.schema_version !== 1 || !feeds.enrichment.zones) throw Error('سجل الصور غير صالح.');
  const sites = features.map(feature => {
    const id = feature.properties.id, source = feeds.enrichment.zones[id], seen = new Set();
    if (!Number.isInteger(id) || !feature.geometry || !feature.properties.name_ar) throw Error('مرجع الموقع غير صالح.');
    const images = source?.zone_id === id && source.approval?.status === 'approved_phase2' ? (source.images || []).filter(image => {
      if (typeof image.src !== 'string' || !/^images\/investment-sites\/SITE-\d+\/IMG-\d+\.(jpg|jpeg|png|webp)$/i.test(image.src) || !allowed.has('public/' + image.src) || !/^[a-f0-9]{64}$/.test(image.sha256 || '') || seen.has(image.sha256)) return false;
      seen.add(image.sha256); return true;
    }) : [];
    return { id, name: feature.properties.name_ar, feature, images, sourceSiteId: images.length ? source.site_id : null };
  }).sort((a, b) => a.id - b.id);
  const national = feeds.national?.features, gardens = feeds.gardens?.features, theme = feeds.theme?.features;
  if (national?.length !== 33 || new Set(national.map(f => f.properties.PARK_ID)).size !== 27 || gardens?.length !== 185 || theme?.length !== 1) throw Error('تعذر التحقق من طبقات المنتزهات والحدائق.');
  return { sites, totals: { sites: sites.length, parks: 27, parts: national.length, gardens: gardens.length, theme: theme.length, images: sites.reduce((n, s) => n + s.images.length, 0), withImages: sites.filter(s => s.images.length).length, withoutImages: sites.filter(s => !s.images.length).length }, layers: [
    { name: 'المواقع الاستثمارية', count: sites.length, source: DEMO_FEEDS.sites }, { name: 'المنتزهات الوطنية', count: national.length, source: DEMO_FEEDS.national }, { name: 'الحدائق العامة', count: gardens.length, source: DEMO_FEEDS.gardens }, { name: 'المنتزهات الترفيهية', count: theme.length, source: DEMO_FEEDS.theme },
  ] };
}
export function miniMapPath(geometry) {
  const polygons = geometry?.type === 'Polygon' ? [geometry.coordinates] : geometry?.type === 'MultiPolygon' ? geometry.coordinates : [], points = polygons.flat(2);
  if (!points.length || points.some(p => !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) return '';
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]), left = Math.min(...xs), bottom = Math.min(...ys), width = Math.max(...xs) - left, height = Math.max(...ys) - bottom, scale = Math.min(264 / (width || 1), 144 / (height || 1));
  return polygons.flatMap(poly => poly.map(ring => ring.map((p, i) => `${i ? 'L' : 'M'}${(18 + (264 - width * scale) / 2 + (p[0] - left) * scale).toFixed(2)},${(18 + (144 - height * scale) / 2 + (bottom + height - p[1]) * scale).toFixed(2)}`).join(' ') + ' Z')).join(' ');
}
