import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, GeoJSON, CircleMarker, Tooltip, useMap } from 'react-leaflet';
import { MapPinned, Search, Layers3, Building2, Plane, Ship, Route, Info, Images } from 'lucide-react';
import 'leaflet/dist/leaflet.css';
import './App.css';

function FitZone({ feature }) {
  const map = useMap();
  useEffect(() => {
    if (!feature) return;
    import('leaflet').then(({ default: L }) => {
      const layer = L.geoJSON(feature);
      if (layer.getBounds().isValid()) map.fitBounds(layer.getBounds(), { padding: [28, 28], maxZoom: 12 });
    });
  }, [feature, map]);
  return null;
}
// Geometric proximity: city point to nearest polygon boundary, or zero if inside.
// Local equirectangular metric approximation; not a driving distance or legal survey.
function polygonRings(geometry) {
  if (!geometry) return [];
  if (geometry.type === 'Polygon') return geometry.coordinates || [];
  if (geometry.type === 'MultiPolygon') return (geometry.coordinates || []).flatMap(p => p);
  return [];
}
function insideRing(point, ring) {
  let inside = false;
  const [x, y] = point;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function polygonContains(point, geometry) {
  const polygons = geometry?.type === 'Polygon' ? [geometry.coordinates] :
    geometry?.type === 'MultiPolygon' ? geometry.coordinates : [];
  return polygons.some(poly => poly.length && insideRing(point, poly[0]) &&
    !poly.slice(1).some(hole => insideRing(point, hole)));
}
function pointPolygonKm(point, geometry) {
  if (!Array.isArray(point) || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) return Infinity;
  if (polygonContains(point, geometry)) return 0;
  const latitudeScale = 111.195;
  const longitudeScale = latitudeScale * Math.cos(point[1] * Math.PI / 180);
  let minSq = Infinity;
  for (const ring of polygonRings(geometry)) {
    for (let i = 1; i < ring.length; i++) {
      const a = ring[i - 1], b = ring[i];
      const ax = (a[0] - point[0]) * longitudeScale, ay = (a[1] - point[1]) * latitudeScale;
      const bx = (b[0] - point[0]) * longitudeScale, by = (b[1] - point[1]) * latitudeScale;
      const dx = bx - ax, dy = by - ay;
      const t = dx * dx + dy * dy ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / (dx * dx + dy * dy))) : 0;
      minSq = Math.min(minSq, (ax + t * dx) ** 2 + (ay + t * dy) ** 2);
    }
  }
  return Math.sqrt(minSq);
}
function cityName(feature, index) {
  const p = feature?.properties || {};
  return p.NAME_AR || p.AR_Name || p.name_ar || p.NAME_EN || p.EN_Name || `مدينة ${index + 1}`;
}
function FitCity({ coordinates }) {
  const map = useMap();
  useEffect(() => {
    if (coordinates?.length >= 2) map.setView([coordinates[1], coordinates[0]], Math.max(map.getZoom(), 10));
  }, [coordinates, map]);
  return null;
}
const ACCESS_LAYERS = [
  { id: 'airports', title: 'المطارات', file: 'airports_54.geojson', color: '#2879bd', type: 'point' },
  { id: 'ports', title: 'الموانئ البحرية', file: 'ports_33.geojson', color: '#0b8395', type: 'point' },
  { id: 'archPoints', title: 'المواقع الأثرية (نقاط)', file: 'archaeology_points_60.geojson', color: '#98522e', type: 'point' },
  { id: 'archPolygons', title: 'المواقع الأثرية (مضلعات)', file: 'archaeology_polygons_35.geojson', color: '#ad6e39', type: 'polygon' },
  { id: 'unesco', title: 'مواقع التراث العالمي (نقاط)', file: 'unesco_points_5.geojson', color: '#8063aa', type: 'point' },
];
function accessName(feature, index, type) {
  const p = feature?.properties || {};
  return p.NAME_AR || p.LM_Name_AR || p.AR_Name || p.NAME_ORIG || p.NAME_EN || p.LM_Name_EN || `موقع غير مسمى ${index + 1}`;
}
function accessId(feature) {
  const p = feature?.properties || {};
  return p.AIRPORT_ID || p.PORT_ID || p.NTG_ID || p.SITE_ID || p.TIDC_ENTITY_ID || 'غير متوفر';
}
const PARK_LAYERS = [
  { id: 'national', title: 'المنتزهات الوطنية', url: import.meta.env.BASE_URL + 'data/parks/FD_PARK_NATIONAL_33.geojson', color: '#21836e' },
  { id: 'public', title: 'الحدائق والمنتزهات العامة', url: import.meta.env.BASE_URL + 'data/parks/FD_PARK_PUBLIC_185.geojson', color: '#3a8cb5' },
  { id: 'theme', title: 'المنتزهات الترفيهية', url: import.meta.env.BASE_URL + 'data/parks/FD_THEME_PARK_1.geojson', color: '#a36fb5' },
];
function parkTitle(feature, index) {
  const p = feature?.properties || {};
  return p.PARK_NAME || p.NAME_AR || p.name_ar || p.NAME || p.Name || p.name ||
    `مضلع غير مسمى ${index + 1}`;
}
function label(f, index) {
  const p = f.properties || {};
  return p.name_ar || p.name || p.Name || p.NAME || p.zone_name || p.site_name || `منطقة استثمارية ${index + 1}`;
}
export default function App() {
  const [zones, setZones] = useState([]);
  const [accessData, setAccessData] = useState({});
  const [accessErrors, setAccessErrors] = useState({});
  const [accessVisible, setAccessVisible] = useState({airports:true,ports:false,archPoints:false,archPolygons:false,unesco:false});
  const [roads, setRoads] = useState(null);
  const [showRoads, setShowRoads] = useState(false);
  const [roadError, setRoadError] = useState('');
  const [selectedAccess, setSelectedAccess] = useState(null);
  const [accessQuery, setAccessQuery] = useState('');
  const [nearestLinks, setNearestLinks] = useState({});
  const [nearestTransport, setNearestTransport] = useState({});
  // LTIP_ACCESS_CLASSIFICATION_V1
  const [accessReadiness, setAccessReadiness] = useState({});
  const [readinessFilter, setReadinessFilter] = useState('all');
  const [readinessError, setReadinessError] = useState('');
  const [transportError, setTransportError] = useState('');
  const [cities, setCities] = useState([]);
  const [cityError, setCityError] = useState('');
  const [showCities, setShowCities] = useState(true);
  const [cityQuery, setCityQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState(null);
  const [parkData, setParkData] = useState({});
  const [parkErrors, setParkErrors] = useState({});
  const [visibleParks, setVisibleParks] = useState({ national: true, public: false, theme: false });
  const [selectedPark, setSelectedPark] = useState(null);
  const [showZones, setShowZones] = useState(true);
  const [sidebarMode, setSidebarMode] = useState('zones');
  const [parkQuery, setParkQuery] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [photoManifest, setPhotoManifest] = useState({});
  const [activePhoto, setActivePhoto] = useState(0);
  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'data/zone_photos.json').then(r => {
      if (!r.ok) throw Error('Photo manifest missing');
      return r.json();
    }).then(setPhotoManifest).catch(() => setPhotoManifest({}));
  }, []);
  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'data/analysis/zone_ports_roads_nearest.json')
      .then(r => {
        if (!r.ok) throw Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(data => {
        if (!data.zones || data.metadata?.result_count !== 141)
          throw Error('نتائج التحليل غير مكتملة');
        setNearestTransport(data.zones);
      })
      .catch(e => setTransportError(e.message));
  }, []);
  useEffect(() => {
    fetch(import.meta.env.BASE_URL +
      'data/analysis/zone_access_readiness_141.json')
      .then(r => {
        if (!r.ok) throw Error('HTTP ' + r.status);
        return r.json();
      })
      .then(d => {
        if (Object.keys(d.zones || {}).length !== 141)
          throw Error('Incomplete classification');
        setAccessReadiness(d.zones);
      })
      .catch(e => setReadinessError(e.message));
  }, []);
  useEffect(() => { setActivePhoto(0); }, [selected]);
  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'data/zones_141.geojson').then(r => { if (!r.ok) throw Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => setZones(d.features || [])).catch(e => setError(`تعذر تحميل طبقة المضلعات: ${e.message}`));
  }, []);
  useEffect(() => {
    let cancelled = false;
    PARK_LAYERS.forEach(async layer => {
      try {
        const response = await fetch(layer.url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
          throw new Error('ملف GeoJSON غير صالح');
        }
        if (!cancelled) setParkData(prev => ({ ...prev, [layer.id]: data }));
      } catch (err) {
        if (!cancelled) setParkErrors(prev => ({ ...prev, [layer.id]: err.message }));
      }
    });
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    fetch(import.meta.env.BASE_URL + 'data/accessibility/cities_57.geojson')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => {
        if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('GeoJSON غير صالح');
        setCities(data.features.filter(f => f.geometry?.type === 'Point' && f.geometry.coordinates?.length >= 2));
      })
      .catch(e => setCityError(`تعذر تحميل المدن: ${e.message}`));
  }, []);
  useEffect(() => {
    let cancelled = false;
    ACCESS_LAYERS.forEach(async layer => {
      try {
        const response = await fetch(import.meta.env.BASE_URL + `data/accessibility/${layer.file}`);
        if (!response.ok) throw Error(`HTTP ${response.status}`);
        const json = await response.json();
        if (json.type !== 'FeatureCollection' || !Array.isArray(json.features)) throw Error('GeoJSON غير صالح');
        if (!cancelled) setAccessData(prev => ({...prev,[layer.id]:json.features}));
      } catch(e) { if (!cancelled) setAccessErrors(prev => ({...prev,[layer.id]:e.message})); }
    });
    fetch(import.meta.env.BASE_URL + 'data/analysis/zone_airport_heritage_nearest.json')
      .then(r => {if(!r.ok) throw Error(`HTTP ${r.status}`); return r.json();})
      .then(d => {if(!cancelled) setNearestLinks(d.zones || {});})
      .catch(e => {if(!cancelled) setAccessErrors(prev => ({...prev,analysis:e.message}));});
    return () => { cancelled=true; };
  }, []);
  useEffect(() => {
    if (!showRoads || roads) return;
    const controller = new AbortController();
    fetch(import.meta.env.BASE_URL + 'data/accessibility/roads_6272.geojson', {signal:controller.signal})
      .then(r => { if (!r.ok) throw Error(`HTTP ${r.status}`); return r.json(); })
      .then(d => {
        if (d.type !== 'FeatureCollection' || !Array.isArray(d.features)) throw Error('GeoJSON غير صالح');
        setRoads(d);
        setRoadError('');
      })
      .catch(e => { if (e.name !== 'AbortError') setRoadError(`تعذر تحميل شبكة الطرق: ${e.message}`); });
    return () => controller.abort();
  }, [showRoads, roads]);
  const accessMatches = useMemo(() => ACCESS_LAYERS.flatMap(layer =>
    (accessData[layer.id] || []).map((feature,index) => ({layerId:layer.id,index,feature,name:accessName(feature,index),id:accessId(feature)})))
    .filter(item => `${item.name} ${item.id}`.toLocaleLowerCase().includes(accessQuery.trim().toLocaleLowerCase())),[accessData,accessQuery]);
  const cityMatches = useMemo(() => cities.map((feature, index) => ({ feature, index, name: cityName(feature, index) }))
    .filter(item => `${item.name} ${item.feature.properties?.NAME_EN || ''}`.toLocaleLowerCase().includes(cityQuery.trim().toLocaleLowerCase())), [cities, cityQuery]);
  const nearestCityByZone = useMemo(() => zones.map(zone => {
    let nearest = null;
    cities.forEach((city, index) => {
      const distanceKm = pointPolygonKm(city.geometry.coordinates, zone.geometry);
      if (Number.isFinite(distanceKm) && (!nearest || distanceKm < nearest.distanceKm))
        nearest = { index, name: cityName(city, index), distanceKm };
    });
    return nearest;
  }), [zones, cities]);
  const parkMatches = useMemo(() => {
    const needle = parkQuery.trim().toLocaleLowerCase();
    const items = PARK_LAYERS.flatMap(layer => (parkData[layer.id]?.features || []).map((feature, index) => ({
      layerId: layer.id, index, feature, layerTitle: layer.title,
      title: parkTitle(feature, index),
      id: String(feature.properties?.PART_ID || feature.properties?.SOURCE_KEY || feature.properties?.PARK_ID || feature.properties?.id || '')
    })));
    return needle ? items.filter(item => `${item.title} ${item.id} ${item.feature.properties?.PARK_ID || ''}`.toLocaleLowerCase().includes(needle)) : items;
  }, [parkData, parkQuery]);
  const readinessFor = (f, i) =>
    accessReadiness[String(f?.properties?.id ?? i + 1)];

  const filtered = useMemo(() =>
    zones.map((f, i) => ({ f, i, name: label(f, i) }))
      .filter(x =>
        x.name.toLowerCase().includes(query.trim().toLowerCase()) &&
        (readinessFilter === 'all' ||
          accessReadiness[String(x.f?.properties?.id ?? x.i + 1)]
            ?.geographic_access?.grade === readinessFilter)
      ),
    [zones, query, readinessFilter, accessReadiness]
  );

  const mapZones = useMemo(() =>
    zones.filter((f, i) =>
      readinessFilter === 'all' ||
      accessReadiness[String(f?.properties?.id ?? i + 1)]
        ?.geographic_access?.grade === readinessFilter
    ),
    [zones, readinessFilter, accessReadiness]
  );

  const readinessColors = {
    'مرتفع': '#21865b',
    'متوسط': '#e0a32e',
    'منخفض': '#e47737',
    'منخفض جدًا': '#c93c43'
  };
  const selectedFeature = selected === null ? null : zones[selected];
  const selectedName = selectedFeature ? label(selectedFeature, selected) : '';
  const selectedArea = selectedFeature?.properties?.area_ha_geodesic;
  const nearestCity = selected === null ? null : nearestCityByZone[selected];
  const selectedZoneKey = selectedFeature?.properties?.id ?? (selected === null ? null : selected + 1);
  const nearestAccess = selectedZoneKey === null ? null : nearestLinks[String(selectedZoneKey)];
  const selectedReadiness = selectedZoneKey === null
    ? null : accessReadiness[String(selectedZoneKey)];
  const transportResult = selectedZoneKey === null
    ? null : nearestTransport[String(selectedZoneKey)];
  const selectedAccessFeature = selectedAccess ? accessData[selectedAccess.layerId]?.[selectedAccess.index] : null;
  const selectedAccessLayer = ACCESS_LAYERS.find(l => l.id === selectedAccess?.layerId);
  const chooseAccess = (layerId,index) => {
    setSelectedAccess({layerId,index});setSidebarMode('access');setSelected(null);setSelectedPark(null);setSelectedCity(null);
    setAccessVisible(prev => ({...prev,[layerId]:true}));
  };
  const accessLink = (layerId,title) => {
    const link=nearestAccess?.[layerId];
    const feature=link && accessData[layerId]?.[link.index];
    return <><dt>{title}</dt><dd>{feature ? <button type="button" className="city-link" onClick={() => chooseAccess(layerId,link.index)}>
      {accessName(feature,link.index)} — {link.km.toLocaleString('ar-LY')} كم ↗</button> : 'قيد تحميل التحليل المكاني'}</dd></>;
  };
  const selectedCityFeature = selectedCity === null ? null : cities[selectedCity];
  const zoneId = selectedFeature?.properties?.id ?? (selected === null ? null : selected + 1);
  const photos = zoneId === null ? [] : (photoManifest[String(zoneId)] || []);
  const chooseFeature = (feature) => {
    const i = zones.indexOf(feature);
    if (i >= 0) { setSelected(i); setSelectedPark(null); setSidebarMode('zones'); setSelectedCity(null); setSelectedAccess(null); }
  };
  const choosePark = (layerId, index) => {
    setSelectedPark({ layerId, index });
    setVisibleParks(prev => ({...prev, [layerId]: true}));
    setSidebarMode('parks');
    setSelected(null); setSelectedCity(null); setSelectedAccess(null);
  };
  const chooseZone = (index) => { setSelected(index); setSelectedPark(null); setSelectedCity(null); setSelectedAccess(null); setSidebarMode('zones'); setShowZones(true); };
  const chooseCity = (index) => { setSelectedCity(index); setSidebarMode('cities'); setShowCities(true); setSelected(null); setSelectedPark(null); setSelectedAccess(null); };
  const selectedParkFeature = selectedPark
    ? parkData[selectedPark.layerId]?.features?.[selectedPark.index] : null;
  const selectedParkProps = selectedParkFeature?.properties || {};
  const selectedParkLayer = PARK_LAYERS.find(layer => layer.id === selectedPark?.layerId);
  const parkCount = PARK_LAYERS.reduce((sum, layer) => sum + (parkData[layer.id]?.features?.length || 0), 0);
  return <div className="app" dir="rtl">
    <header className="header official-header">
  <div className="gov-header-right">
    <strong>دولة ليبيا</strong>
    <span>حكومة الوحدة الوطنية</span>
  </div>
  <div className="brand">
    <span className="brand-icon"><MapPinned size={24}/></span>
    <div>
      <h1>المنصة الوطنية للاستثمار السياحي</h1>
      <p>ليبيا | الخارطة الاستثمارية الجغرافية</p>
    </div>
  </div>
  <div className="gov-header-left">
    <strong>وزارة السياحة والصناعات التقليدية</strong>
    <span>مركز المعلومات والتوثيق السياحي</span>
  </div>
</header>
    <main><section className="intro"><div><span className="eyebrow">مركز المعلومات والتوثيق السياحي · مشروع تجريبي</span><h2>خارطة فرص التنمية والاستثمار السياحي في ليبيا</h2><p>استكشاف الحدود الجغرافية الحقيقية للمناطق المستهدفة للاستثمار، تمهيدًا لربطها بالمدن والمطارات والموانئ وشبكات النقل.</p></div><div className="big-count"><strong>{zones.length || '—'}</strong><span>منطقة استثمارية</span></div></section>
    <section className="metrics"><article><Layers3/><div><strong>{zones.length || '—'}</strong><span>مناطق التنمية السياحية</span></div></article><article><Building2/><div><strong>{cities.length || "—"}</strong><span>المدن المرتبطة مكانيًا</span></div></article><article><Plane/><div><strong>{accessData.airports?.length ?? '—'}</strong><span>المطارات المسجلة</span></div></article><article><Ship/><div><strong>{accessData.ports?.length ?? "—"}</strong><span>الموانئ المسجلة</span></div></article><article><Route/><div><strong>{roads?.features?.length ?? "6,272"}</strong><span>مقاطع شبكة الطرق المسجلة</span></div></article></section>
    <section className="park-controls" aria-label="إدارة طبقات نظم المعلومات الجغرافية">
      <div className="park-controls-heading"><strong><Layers3 size={19}/> مدير الطبقات الجغرافية | GIS Layer Manager</strong><span>طبقات مستقلة · الهندسة الجغرافية هي الأساس</span></div>
      <div className="park-toggles">
        {ACCESS_LAYERS.map(layer => <label key={layer.id} className="park-toggle">
          <input type="checkbox" checked={accessVisible[layer.id]} onChange={e => setAccessVisible(prev => ({...prev,[layer.id]:e.target.checked}))}/>
          <span className="park-swatch" style={{background:layer.color}}/><span>{layer.title}</span>
          <b>{accessData[layer.id]?.length ?? '—'}</b>
        </label>)}
        <label className="park-toggle">
          <input type="checkbox" checked={showRoads} onChange={e => setShowRoads(e.target.checked)}/>
          <span className="park-swatch" style={{background:'#66788b'}}/><span>شبكة الطرق البرية</span>
          <b>{roads?.features?.length ?? '6,272'}</b>
        </label>
        <label className="park-toggle"><input type="checkbox" checked={showCities} onChange={e => setShowCities(e.target.checked)}/><span className="park-swatch" style={{background:'#c65d35'}}/><span>المدن</span><b>{cities.length || '—'}</b></label>
        <label className="park-toggle"><input type="checkbox" checked={showZones} onChange={e=>setShowZones(e.target.checked)}/><span className="park-swatch" style={{background:'#b9914b'}}/><span>مناطق الاستثمار السياحي</span><b>{zones.length || '—'}</b></label>
        {PARK_LAYERS.map(layer => <label key={layer.id} className="park-toggle">
          <input type="checkbox" checked={visibleParks[layer.id]} onChange={e=>setVisibleParks(prev=>({...prev,[layer.id]:e.target.checked}))}/>
          <span className="park-swatch" style={{background:layer.color}}/><span>{layer.title}</span><b>{parkData[layer.id]?.features?.length ?? '—'}</b>
        </label>)}
      </div>
      <div className="manager-summary">{zones.length} منطقة استثمارية · {parkCount} مضلع منتزهات وحدائق محمّل · إخفاء الطبقة لا يحذف بياناتها</div>
      {Object.keys(accessErrors).length > 0 && <div className="park-error">{Object.entries(accessErrors).map(([id,msg]) => <div key={id}>تعذر تحميل {id}: {msg}</div>)}</div>}
      {cityError && <div className="park-error">{cityError}</div>}{roadError && <div className="park-error">{roadError}</div>}
      {Object.keys(parkErrors).length > 0 && <div className="park-error">{PARK_LAYERS.filter(layer=>parkErrors[layer.id]).map(layer=><div key={layer.id}>تعذر تحميل {layer.title}: {parkErrors[layer.id]}</div>)}</div>}
    </section><section className="workspace"><aside className="sidebar"><div className="sidebar-tabs"><button type="button" className={sidebarMode==='zones'?'active':''} onClick={()=>setSidebarMode('zones')}>مناطق الاستثمار ({zones.length})</button><button type="button" className={sidebarMode==='parks'?'active':''} onClick={()=>setSidebarMode('parks')}>المنتزهات والحدائق ({parkCount})</button><button type="button" className={sidebarMode==='cities'?'active':''} onClick={()=>setSidebarMode('cities')}>المدن ({cities.length})</button><button type="button" className={sidebarMode==='access'?'active':''} onClick={()=>setSidebarMode('access')}>المطارات والموانئ والآثار</button></div><div className="search"><Search size={18}/>{sidebarMode==='zones' ? <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="ابحث باسم المنطقة..." aria-label="البحث عن منطقة"/> : sidebarMode==='parks' ? <input value={parkQuery} onChange={e=>setParkQuery(e.target.value)} placeholder="ابحث باسم المنتزه أو معرفه..." aria-label="البحث عن منتزه بالاسم أو المعرف"/> : sidebarMode==='cities' ? <input value={cityQuery} onChange={e=>setCityQuery(e.target.value)} placeholder="ابحث باسم المدينة..." aria-label="البحث عن مدينة"/> : <input value={accessQuery} onChange={e=>setAccessQuery(e.target.value)} placeholder="ابحث عن مطار أو ميناء أو موقع أثري..." aria-label="البحث عن مطار أو موقع أثري"/>}</div>{sidebarMode==='zones' && selectedFeature && <div className="zone-detail"><div className="detail-title"><strong>بطاقة المنطقة الاستثمارية</strong><button type="button" onClick={()=>setSelected(null)} aria-label="إغلاق البطاقة">×</button></div><h4>{selectedName}</h4><dl><dt>الرقم التعريفي</dt><dd>{selectedFeature.properties?.id ?? selected + 1}</dd><dt>المساحة المحسوبة</dt><dd>{typeof selectedArea === 'number' ? `${selectedArea.toLocaleString('ar-LY')} هكتار` : 'قيد الحساب'}</dd><dt>حالة التحقق</dt><dd>{selectedFeature.properties?.status || 'غير مدقق'}</dd><dt>أقرب مدينة من قاعدة GIS</dt><dd>{nearestCity ? <button type="button" className="city-link" onClick={() => chooseCity(nearestCity.index)}>{nearestCity.name} — {nearestCity.distanceKm.toFixed(2)} كم ↗</button> : 'قيد تحميل بيانات المدن'}</dd>{accessLink('airports','أقرب مطار (بصرف النظر عن حالة التشغيل)')}{accessLink('archPoints','أقرب موقع أثري نقطي')}{accessLink('archPolygons','أقرب موقع أثري مضلعي')}{accessLink('unesco','أقرب نقطة مرجعية للتراث العالمي')}<dt>مؤشر القرب الجغرافي</dt>
  <dd>{selectedReadiness?.geographic_access
    ? `${selectedReadiness.geographic_access.score} / 100 — ${selectedReadiness.geographic_access.grade}`
    : 'قيد تحميل التصنيف'}</dd>
  <dt>الجاهزية التشغيلية الفعلية</dt>
  <dd>{selectedReadiness
    ? 'غير متحققة — تحتاج إلى تقييم فني وميداني'
    : 'قيد تحميل البيانات'}</dd>
  <dt>أقرب ميناء بحري</dt>
<dd>{transportResult?.nearest_port
  ? `${transportResult.nearest_port.name} — ${transportResult.nearest_port.distance_km.toLocaleString('ar-LY')} كم`
  : transportError ? 'تعذر تحميل التحليل' : 'جار تحميل التحليل'}</dd>
<dt>معرف الميناء</dt>
<dd>{transportResult?.nearest_port?.id || 'غير متوفر'}</dd>
<dt>أقرب طريق</dt>
<dd>{transportResult?.nearest_road
  ? `${transportResult.nearest_road.name} (${transportResult.nearest_road.id})`
  : transportError ? 'تعذر تحميل التحليل' : 'جار تحميل التحليل'}</dd>
<dt>المسافة إلى الطريق</dt>
<dd>{transportResult?.nearest_road
  ? transportResult.nearest_road.intersects_zone
    ? '0 كم — يتقاطع مع المنطقة'
    : `${transportResult.nearest_road.distance_km.toLocaleString('ar-LY')} كم`
  : 'غير متوفر'}</dd></dl><small>المساحة جيوديسية تقريبية، وليست مساحة قانونية معتمدة.</small></div>}{sidebarMode==='parks' && selectedParkFeature && <div className="zone-detail park-detail">
      <div className="detail-title"><strong>بطاقة المنتزه / الحديقة</strong>
        <button type="button" onClick={() => setSelectedPark(null)} aria-label="إغلاق بطاقة المنتزه">×</button>
      </div>
      <h4>{parkTitle(selectedParkFeature, selectedPark.index)}</h4>
      <dl>
        <dt>نوع الطبقة</dt><dd>{selectedParkLayer?.title}</dd>
        <dt>معرف المضلع</dt><dd>{selectedParkProps.PART_ID || selectedParkProps.SOURCE_KEY || selectedParkProps.id || 'قيد الاستكمال'}</dd>
        <dt>معرف المنتزه</dt><dd>{selectedParkProps.PARK_ID || 'قيد الاستكمال'}</dd>
        <dt>المساحة الجيوديسية</dt><dd>{Number.isFinite(Number(selectedParkProps.AREA_HA_CALCULATED))
          && selectedParkProps.AREA_HA_CALCULATED != null
          ? `${Number(selectedParkProps.AREA_HA_CALCULATED).toLocaleString('ar-LY', {maximumFractionDigits: 4})} هكتار`
          : 'قيد الاستكمال'}</dd>
        <dt>حالة التحقق</dt><dd>{selectedParkProps.VERIFICATION || 'غير متحقق ميدانيًا'}</dd>
        <dt>البيانات الوصفية</dt><dd>{selectedParkProps.PARK_NAME || selectedParkProps.NAME_AR || selectedParkProps.name_ar || selectedParkProps.NAME || selectedParkProps.name ? 'اسم متوفر' : 'غير مكتملة — المضلع محفوظ'}</dd>
      </dl>
      <small>الهندسة الجغرافية هي الأساس. المساحة غير معتمدة قانونيًا أو مساحيًا.</small>
    </div>}
    {sidebarMode==='cities' && selectedCityFeature && <div className="zone-detail city-detail"><div className="detail-title"><strong>بطاقة المدينة</strong><button type="button" onClick={() => setSelectedCity(null)} aria-label="إغلاق بطاقة المدينة">×</button></div><h4>{cityName(selectedCityFeature, selectedCity)}</h4><dl><dt>الاسم الإنجليزي</dt><dd>{selectedCityFeature.properties?.NAME_EN || selectedCityFeature.properties?.EN_Name || 'غير متوفر'}</dd><dt>الإحداثيات</dt><dd dir="ltr">{selectedCityFeature.geometry.coordinates.slice(0,2).map(v => Number(v).toFixed(5)).join(', ')}</dd><dt>حالة التحقق</dt><dd>{selectedCityFeature.properties?.VERIFICATION || 'غير محددة'}</dd></dl><small>موقع المدينة يمثل نقطة مرجعية في قاعدة GIS، وليس حدودها الإدارية.</small></div>}
    {sidebarMode==='access' && selectedAccessFeature && <div className="zone-detail access-detail">
      <div className="detail-title"><strong>بطاقة المرفق الجغرافي</strong><button type="button" onClick={()=>setSelectedAccess(null)}>×</button></div>
      <h4>{accessName(selectedAccessFeature,selectedAccess.index)}</h4>
      <dl><dt>التصنيف</dt><dd>{selectedAccessLayer?.title}</dd>
      <dt>المعرف</dt><dd>{accessId(selectedAccessFeature)}</dd>
      <dt>حالة التحقق</dt><dd>{selectedAccessFeature.properties?.VERIFICATION || selectedAccessFeature.properties?.VERIFIED || 'غير محددة'}</dd>
      {selectedAccess.layerId==='airports' && <><dt>الحالة التشغيلية</dt><dd>{selectedAccessFeature.properties?.OP_STATUS === 'UNKNOWN' ? 'غير مؤكدة' : selectedAccessFeature.properties?.OP_STATUS || 'غير مؤكدة'}</dd></>}
      </dl><small>الموقع مستخرج من قاعدة GIS، ولا يُثبت الحالة التشغيلية أو إمكانية الزيارة.</small>
    </div>}
    <div className="zones">{sidebarMode==='zones' ? filtered.map(({ f, i, name }) => <button key={i} className={selected === i ? 'zone active' : 'zone'} onClick={()=>chooseZone(i)}><span className="zone-index">{i+1}</span><span>{name}</span><span className="arrow">←</span></button>) : sidebarMode==='parks' ? parkMatches.map(item => <button key={`${item.layerId}-${item.index}`} className={selectedPark?.layerId===item.layerId && selectedPark?.index===item.index?'zone active':'zone'} onClick={()=>choosePark(item.layerId,item.index)}><span className="park-result-dot" style={{background:PARK_LAYERS.find(x=>x.id===item.layerId)?.color}}/><span className="park-result-name">{item.title}<small>{item.id || 'معرف قيد الاستكمال'} · {item.layerTitle}</small></span><span className="arrow">←</span></button>) : sidebarMode==='cities' ? cityMatches.map(item => <button key={`city-${item.index}`} className={selectedCity===item.index?'zone active':'zone'} onClick={() => chooseCity(item.index)}><span className="park-result-dot" style={{background:'#c65d35'}}/><span className="park-result-name">{item.name}<small>{item.feature.properties?.NAME_EN || ''}</small></span><span className="arrow">←</span></button>) : accessMatches.map(item => <button key={`access-${item.layerId}-${item.index}`}
      className={selectedAccess?.layerId===item.layerId && selectedAccess?.index===item.index?'zone active':'zone'}
      onClick={()=>chooseAccess(item.layerId,item.index)}>
      <span className="park-result-dot" style={{background:ACCESS_LAYERS.find(l=>l.id===item.layerId)?.color}}/>
      <span className="park-result-name">{item.name}<small>{item.id} · {ACCESS_LAYERS.find(l=>l.id===item.layerId)?.title}</small></span><span className="arrow">←</span>
    </button>)}{sidebarMode==='parks' && parkMatches.length===0 && <p className="empty-results">لا توجد نتائج مطابقة للبحث.</p>}{sidebarMode==='cities' && cityMatches.length===0 && <p className="empty-results">لا توجد مدن مطابقة.</p>}{sidebarMode==='access' && accessMatches.length===0 && <p className="empty-results">لا توجد نتائج مطابقة.</p>}</div></aside><div className="map-panel"><div className="map-heading">
    <h3>الخارطة التفاعلية للمناطق الاستثمارية</h3>
    <span>WGS 84 · EPSG:4326</span>
  </div>
  <div style={{padding:12,display:'flex',gap:12,
    flexWrap:'wrap',alignItems:'center'}}>
    <label htmlFor="access-grade">تصنيف القرب الجغرافي:</label>
    <select id="access-grade"
      value={readinessFilter}
      onChange={e=>setReadinessFilter(e.target.value)}>
      <option value="all">جميع المناطق (141)</option>
      <option value="مرتفع">مرتفع (97)</option>
      <option value="متوسط">متوسط (35)</option>
      <option value="منخفض">منخفض (6)</option>
      <option value="منخفض جدًا">منخفض جدًا (3)</option>
    </select>
    <strong>المناطق المعروضة: {mapZones.length}</strong>
    {Object.entries(readinessColors).map(([grade,color])=>
      <span key={grade} style={{display:'inline-flex',
        alignItems:'center',gap:5}}>
        <span style={{width:12,height:12,
          background:color,borderRadius:3}}/>
        {grade}
      </span>
    )}
    {readinessError &&
      <span role="alert">خطأ تحميل التصنيف: {readinessError}</span>}
    <small>التصنيف جغرافي ولا يثبت الجاهزية التشغيلية.</small>
  </div>{error && <div className="error">{error}</div>}<MapContainer center={[27.3, 17.0]} zoom={5} className="map" scrollWheelZoom={true}><TileLayer attribution='&copy; OpenStreetMap contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>{showZones && zones.length > 0 && <GeoJSON key={`access-${readinessFilter}-${Object.keys(accessReadiness).length}`}
    data={{type:'FeatureCollection',features:mapZones}}
    style={f=>{
      const grade=accessReadiness[String(f.properties?.id)]
        ?.geographic_access?.grade;
      return {
        color:'#6d7885',
        weight:1.5,
        fillColor:readinessColors[grade] || '#183e69',
        fillOpacity:.48
      };
    }} onEachFeature={(f,layer)=>{ layer.on('click',()=>chooseFeature(f)); }} />}{showCities && cities.map((city, index) => <CircleMarker key={`city-${index}`} center={[city.geometry.coordinates[1],city.geometry.coordinates[0]]} radius={selectedCity===index?9:5} pathOptions={{color:'#8c3b21',weight:1.5,fillColor:'#d97645',fillOpacity:.85}} eventHandlers={{click:()=>chooseCity(index)}}><Tooltip direction="top">{cityName(city,index)}</Tooltip></CircleMarker>)}
{ACCESS_LAYERS.map(layer => accessVisible[layer.id] && (accessData[layer.id] || []).map((feature,index) =>
  layer.type === 'point' ? <CircleMarker key={`${layer.id}-${index}`} center={[feature.geometry.coordinates[1],feature.geometry.coordinates[0]]}
    radius={selectedAccess?.layerId===layer.id && selectedAccess?.index===index?9:5}
    pathOptions={{color:layer.color,fillColor:layer.color,fillOpacity:.9,weight:1.5}}
    eventHandlers={{click:()=>chooseAccess(layer.id,index)}}>
    <Tooltip direction="top">{accessName(feature,index)}</Tooltip></CircleMarker>
  : null))}
{ACCESS_LAYERS.filter(layer=>layer.type==='polygon' && accessVisible[layer.id] && accessData[layer.id]).map(layer =>
  <GeoJSON key={`access-poly-${layer.id}`} data={{type:'FeatureCollection',features:accessData[layer.id]}}
    style={{color:layer.color,weight:2,fillColor:layer.color,fillOpacity:.28}}
    onEachFeature={(feature,leafletLayer)=>{
      const index=accessData[layer.id].findIndex(f=>f===feature || (f.properties?.NTG_ID && f.properties.NTG_ID===feature.properties?.NTG_ID));
      leafletLayer.on('click',()=>{if(index>=0)chooseAccess(layer.id,index)});
      leafletLayer.bindTooltip(accessName(feature,index),{sticky:true});
    }}/>
)}
{showRoads && roads && <GeoJSON key="roads-network" data={roads}
  style={feature => ({color: feature.properties?.ROAD_TYPE === 'DUAL_CARRIAGEWAY' ? '#3c6e93' : '#8798a7',weight:1.4,opacity:.75})}
  onEachFeature={(feature,layer) => {
    const p = feature.properties || {};
    const name = p.NAME_AR || p.ROAD_CLASS_AR || p.ROAD_ID || 'مقطع طريق';
    layer.bindTooltip(`${name}${p.ROAD_ID ? ' — ' + p.ROAD_ID : ''}`, {sticky:true});
  }}/>} 
{selectedAccessFeature && (selectedAccessFeature.geometry.type==='Point' ?
  <FitCity coordinates={selectedAccessFeature.geometry.coordinates}/> :
  <FitZone feature={selectedAccessFeature}/>)}
{selectedCityFeature && <FitCity coordinates={selectedCityFeature.geometry.coordinates}/>}
{PARK_LAYERS.map(layer => visibleParks[layer.id] && parkData[layer.id] &&
  <GeoJSON key={`park-${layer.id}`} data={parkData[layer.id]}
    style={{color:layer.color,weight:2,fillColor:layer.color,fillOpacity:.24}}
    onEachFeature={(feature, leafletLayer) => {
      const index = parkData[layer.id].features.findIndex(candidate => candidate === feature || (
        candidate.properties?.SOURCE_KEY && candidate.properties.SOURCE_KEY === feature.properties?.SOURCE_KEY));
      leafletLayer.on('click', () => { if(index >= 0) choosePark(layer.id, index); });
      leafletLayer.bindTooltip(parkTitle(feature, index), {sticky:true, direction:'top'});
    }}/>
)}
{selectedParkFeature && <><GeoJSON key={`park-selected-${selectedPark.layerId}-${selectedPark.index}`}
  data={selectedParkFeature}
  style={{color:'#e3a02d',weight:4,fillColor:'#f1c26a',fillOpacity:.46}}/>
  <FitZone feature={selectedParkFeature}/></>}
{showZones && selectedFeature && <><GeoJSON key={`selected-${selected}`} data={selectedFeature} style={{color:'#d69c36',weight:4,fillColor:'#e7b95a',fillOpacity:.45}} eventHandlers={{click:()=>setSelected(selected)}} /><FitZone feature={selectedFeature}/></>}</MapContainer>{selectedFeature && photos.length > 0 && (<section className="zone-gallery gallery-panel" aria-label="صور المنطقة الاستثمارية"><div className="gallery-title"><Images size={17}/><strong>صور الموقع</strong><span>{photos.length} صورة</span></div>{photos.length ? <><figure><img src={import.meta.env.BASE_URL + photos[Math.min(activePhoto,photos.length-1)].src.replace(/^\/+/, '')} alt={photos[Math.min(activePhoto,photos.length-1)].alt || `صورة موثقة لمنطقة ${selectedName}`} loading="lazy" onError={e=>{e.currentTarget.style.display='none'}}/><figcaption>{photos[Math.min(activePhoto,photos.length-1)].caption || 'صورة مرفقة بالموقع'}{photos[Math.min(activePhoto,photos.length-1)].source ? ` — المصدر: ${photos[Math.min(activePhoto,photos.length-1)].source}` : ''}</figcaption></figure><div className="gallery-thumbs">{photos.map((photo,i)=><button key={`${photo.src}-${i}`} type="button" className={i===activePhoto?'active':''} onClick={()=>setActivePhoto(i)} aria-label={`عرض الصورة ${i+1}`}><img src={import.meta.env.BASE_URL + photo.src.replace(/^\/+/, '')} alt={photo.alt || `صورة ${i+1}`} loading="lazy"/></button>)}</div></> : <div className="no-photos">لم تُرفق صور موثقة لهذه المنطقة بعد. لا نعرض صورًا افتراضية قد توحي بأنها للموقع الفعلي.</div>}</section>)}<div className="map-foot"><Info size={16}/> الحدود مستوردة من ملف GIS، ولم تُعتمد مساحيًا أو قانونيًا بعد. تتطلب الخلفية الخرائطية اتصالًا بالإنترنت.</div></div></section>
    </main><footer>LTIP · المرحلة الأولى من الربط المكاني · لا تُعرض درجات استثمارية قبل التحقق من البيانات</footer>
  </div>;
}


