import {lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {MapPinned, Search, Images, Maximize, Minimize, LocateFixed, Presentation, X, ChevronRight, ChevronLeft, PanelRightClose, PanelRightOpen} from 'lucide-react';
import GovernmentMap from './GovernmentMap.jsx';
import useGovernmentData from './useGovernmentData.js';
import {filterRows, geometryBounds, LABELS, PRIVATE_PRESENTATION, rowStats} from './model.js';
import InvestmentSiteGallery from '../components/details/InvestmentSiteGallery.jsx';
import s from './GovernmentPortfolio.module.css';
import PublicPortfolioSummary from '../portfolio/PublicPortfolioSummary.jsx';
const PrivateSelectionAdmin = PRIVATE_PRESENTATION ? lazy(() => import('./PrivateSelectionAdmin.jsx')) : null;
const n = value => Number(value).toLocaleString('ar-LY');
export function GovernmentHeader({privateMode=PRIVATE_PRESENTATION}) {
  return <header className={s.header}>
    <div className={s.identity}><div className={s.titleGroup}><span className={s.logoSlot}/><div>
      <p className={s.eyebrow}>وزارة السياحة والصناعات التقليدية · ليبيا</p>
      <h1>المنصة الوطنية للخارطة الاستثمارية السياحية في ليبيا</h1>
    </div></div><span className={s.wordmark} dir="ltr">LTIP<br/>LIBYA</span></div>
    <nav className={s.govLinks} aria-label="تنقل المنصة"><a href="#/">الرئيسية</a><a href="#/portfolio">المحفظة الوطنية</a><a href="#/map">خارطة المنصة</a>{privateMode && <a href="#/government/manage">إدارة الاختيار</a>}</nav>
  </header>;
}
function Metric({value, label, id, emphasis = false}) {
  return <article className={`${s.metric} ${emphasis ? s.emphasis : ''}`}><strong data-testid={id} data-count={value}>{n(value)}</strong><h3>{label}</h3></article>;
}
function SiteCard({row, geo, privateMode, onClose, onFocus}) {
  const bounds = row ? geometryBounds(geo.features.find(f => f.properties.id === row.zone_id)) : null;
  const photos = row?.images.filter(im => im.type === 'photo').length || 0;
  return <>
    <div className={s.detailHead}><button className={s.cardClose} aria-label="طي بطاقة الموقع" onClick={onClose}><X size={16}/></button>
      <p className={s.eyebrow}>بطاقة الموقع</p><h2 data-testid="site-title">{row?.site_name_ar || 'اختر موقعًا من القائمة أو الخريطة'}</h2>
      {row && <><bdi className={s.gisCode}>GIS {row.zone_id}</bdi>{privateMode && <span className={s.badge}>{row.targeted ? LABELS.targeted : LABELS.other}</span>}</>}
    </div>
    {!row ? <p className={s.empty}>اختر الموقع لاستعراض بيانات GIS والصور والمعلومات المتاحة.</p> : <div className={s.detailBody} data-testid="site-details" data-zone-id={row.zone_id}>
      <dl className={s.meta}><dt>المساحة وفق بيانات GIS</dt><dd><bdi>{row.area_ha_source}</bdi> هكتار</dd><dt>مجموعة المصدر</dt><dd>{row.geographic_group || 'غير متوفر'}</dd>
        {privateMode && <><dt>الاستهداف الاستثماري</dt><dd>{row.targeted ? LABELS.targeted : LABELS.other}</dd></>}
        <dt>حالة استكمال البيانات</dt><dd>{row.description && photos ? 'معلومات وصور متاحة؛ استكمال الأدلة يحتاج مراجعة' : 'بيانات أو صور تحتاج استكمالًا'}</dd>
      </dl>
      <p className={s.note}>المساحة موردة من GIS دون إعادة حساب، ولا تمثل مساحة قانونية مصدقة. مجموعة المصدر ليست إثباتًا لحدود بلدية حالية.</p>
      <button data-testid="card-focus-map" onClick={onFocus}><LocateFixed size={16}/>موقعه على الخريطة</button>
      <details><summary>إحداثيات نطاق مضلع الموقع</summary><p className={s.note}>نطاق المضلع الأصلي، وليس مدخل الموقع.</p><bdi dir="ltr">N {bounds.minY}–{bounds.maxY}<br/>E {bounds.minX}–{bounds.maxX}</bdi></details>
      <section className={s.section}><h3>المعلومات المتاحة</h3><p className={s.description}>{row.description || 'لا يتوفر وصف موثق ضمن بيانات هذا الموقع.'}</p></section>
      <section className={s.section}><h3>حالة تقييم MCDA</h3><div className={s.assessment}>
        {row.assessment ? <><strong>نتيجة موثقة وفق المصدر المسجل</strong><span>MCDA: <bdi>{row.assessment.score ?? 'غير متوفر'}</bdi> · A/B/C: <bdi>{row.assessment.classification ?? 'غير متوفر'}</bdi></span><p>{row.assessment.document_ref}</p></> : <><strong>بيانات التقييم الاستثماري غير متوفرة في هذا السجل</strong><span data-testid="official-null-values">MCDA: غير متوفر · A/B/C: غير متوفر</span></>}
      </div></section>
      {row.geometryReviewRequired && <p className={s.warning} data-testid="geometry-warning">تنبيه مراجعة هندسية من المصدر · GIS <bdi>{row.zone_id}</bdi>. المضلع الأصلي محفوظ.</p>}
      <section className={s.section}><h3><Images size={18}/>الصور والوسائط</h3><p className={s.mediaScope}>{n(photos)} صورة فوتوغرافية في السجل المتاح. الخرائط والصور الفضائية مراجع مصورة منفصلة.</p>
        {!photos && <p className={s.noPhoto} data-testid="no-verified-photo">لا توجد صورة موثقة</p>}
        {!!row.images.length && <InvestmentSiteGallery key={row.zone_id} site={{zone_id: row.zone_id, zone_name: row.site_name_ar, images: row.images, media_title: 'وسائط الموقع'}}/>}
      </section>
    </div>}
  </>;
}
function Portfolio({data}) {
  const [mode, setMode] = useState('all'), [query, setQuery] = useState(''), [selectedId, setSelectedId] = useState(null);
  const [government, setGovernment] = useState(false), [fullMap, setFullMap] = useState(false), [collapsed, setCollapsed] = useState(false), [showPhotos, setShowPhotos] = useState(false), [filtersOpen, setFiltersOpen] = useState(false);
  const [fit, setFit] = useState({kind:'country', token:0});
  const sequence = useRef(0), priorCollapse = useRef(false), modeButton = useRef(null), fullButton = useRef(null), closeButton = useRef(null), workspace = useRef(null), card = useRef(null);
  const visible = useMemo(() => filterRows(data.rows, mode, query), [data.rows, mode, query]);
  const stats = useMemo(() => rowStats(visible, data.hasSelection), [visible, data.hasSelection]);
  const totals = useMemo(() => rowStats(data.rows, data.hasSelection), [data]);
  const selected = visible.find(row => row.zone_id === selectedId) || null;
  const requestFit = useCallback((kind, zoneId) => setFit({kind, zoneId, token:++sequence.current}), []);
  const select = useCallback(id => { setSelectedId(id); setCollapsed(false); requestFit('site', id); requestAnimationFrame(() => { if (card.current) card.current.scrollTop = 0; }); }, [requestFit]);
  const move = useCallback(step => {
    if (!visible.length) return;
    const index = visible.findIndex(row => row.zone_id === selectedId);
    select(visible[index < 0 ? (step > 0 ? 0 : visible.length - 1) : (index + step + visible.length) % visible.length].zone_id);
  }, [visible, selectedId, select]);
  useEffect(() => {
    if (visible.length === 1 && selectedId !== visible[0].zone_id) select(visible[0].zone_id);
    else if (selectedId !== null && !visible.some(row => row.zone_id === selectedId)) { setSelectedId(null); requestFit(visible.length ? 'sites' : 'country'); }
  }, [visible, selectedId, select, requestFit]);
  const exitFull = useCallback(() => { setFullMap(false); setCollapsed(priorCollapse.current); requestAnimationFrame(() => fullButton.current?.focus({preventScroll:true})); }, []);
  const exitGovernment = useCallback(() => { setGovernment(false); requestAnimationFrame(() => modeButton.current?.focus({preventScroll:true})); }, []);
  const toggleFull = () => { if (fullMap) return exitFull(); priorCollapse.current = collapsed; setCollapsed(true); setFullMap(true); requestAnimationFrame(() => workspace.current?.focus({preventScroll:true})); };
  useEffect(() => { if (!fullMap) return; const previous = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = previous; }; }, [fullMap]);
  useEffect(() => {
    const key = event => {
      if (document.querySelector('dialog[open]')) return;
      if (event.key === 'Escape') { if (fullMap) { event.preventDefault(); exitFull(); } else if (government) { event.preventDefault(); exitGovernment(); } return; }
      if (!government || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.target.closest('input,textarea,select,[contenteditable=true]')) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); move(event.key === 'ArrowLeft' ? 1 : -1); }
    };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [government, fullMap, move, exitFull, exitGovernment]);
  useEffect(() => {
    const api = {getState:() => ({mode, query, selectedId:selected?.zone_id ?? null, hasSelection:data.hasSelection, visibleIds:visible.map(row => row.zone_id), stats, totals, government, fullMap, collapsed})};
    window.LTIPGovernment = api; return () => { if (window.LTIPGovernment === api) delete window.LTIPGovernment; };
  }, [mode, query, selected, data.hasSelection, visible, stats, totals, government, fullMap, collapsed]);
  const changeMode = next => { setMode(next); requestFit('sites'); };
  const showAll = next => { setMode(next); setQuery(''); requestFit('sites'); };
  const photos = visible.flatMap(row => row.images.filter(im => im.type === 'photo').map(image => ({row, image})));
  return <div className={`${s.shell} ${government ? s.governmentMode : ''} ${fullMap ? s.fullMap : ''}`} dir="rtl" data-government-portfolio data-private-presentation={data.hasSelection}>
    <div className={s.frame}><GovernmentHeader privateMode={data.hasSelection}/>
      {data.hasSelection&&<div className={s.presentationBar}><div><span className={s.liveDot}/><strong>{government ? 'العرض الحكومي' : 'خارطة مواقع التنمية السياحية'}</strong><span className={s.presentationHint}>{government ? 'السهم الأيسر: التالي · الأيمن: السابق · Escape للخروج' : 'المواقع والبيانات الجغرافية والصور في مساحة واحدة'}</span></div>
        <button ref={modeButton} data-testid="government-mode" aria-pressed={government} onClick={() => government ? exitGovernment() : setGovernment(true)}>{government ? <X size={18}/> : <Presentation size={18}/>} {government ? 'إنهاء العرض الحكومي' : 'العرض الحكومي'}</button>
      </div>}
      {data.hasSelection && <details className={s.selectionNote} data-testid="selection-scope"><summary>سياق اختيار المواقع</summary><p>اختيار فني أولي لإعداد العرض الحكومي وإظهار إمكانات المنصة. تتولى الإدارة المختصة لاحقًا مراجعة المواقع المستهدفة واعتمادها وتحديث العدد والاختيارات حسب اختصاصها.</p></details>}
      {!data.hasSelection&&<PublicPortfolioSummary geo={data.geo}/>}
      <div className={`${s.controls} ${filtersOpen ? s.filtersOpen : ''}`}>
        {data.hasSelection && <><button className={s.filterToggle} data-testid="toggle-filters" aria-expanded={filtersOpen} aria-controls="portfolio-filters" onClick={() => setFiltersOpen(v => !v)}>التصفية</button>
          <div id="portfolio-filters" className={s.tabs} role="group" aria-label="تصفية المواقع">{[['all', LABELS.all, totals.sites], ['targeted', LABELS.targeted, totals.targeted], ['other', LABELS.other, totals.other]].map(([key, label, count]) => <button key={key} data-testid={`filter-${key}`} aria-pressed={mode === key} onClick={() => changeMode(key)}>{label}<b>{n(count)}</b></button>)}</div></>}
        <label className={s.search}><Search size={18}/><span className={s.srOnly}>البحث بالاسم أو معرف GIS</span><input type="search" data-testid="government-search" value={query} onChange={event => setQuery(event.target.value)} placeholder="ابحث باسم الموقع أو معرف GIS"/></label><span className={s.resultCount} role="status" aria-live="polite" data-testid="filter-results" data-count={visible.length}>{data.hasSelection?'نتائج التصفية الحالية:':'نتائج البحث الحالية:'} <b>{n(visible.length)}</b></span>
      </div>
      {data.hasSelection&&<section className={`${s.metrics} ${s.primaryMetrics}`} aria-label="مؤشرات إجمالي المحفظة">
        <Metric value={totals.sites} label={LABELS.all} id="stat-visible"/>
        {data.hasSelection ? <><Metric value={totals.targeted} label={LABELS.targeted} id="stat-targeted" emphasis/><Metric value={totals.other} label={LABELS.other} id="stat-other"/></> : null}
      </section>}
      <p className={s.scopeNote}>إجمالي المحفظة ثابت؛ نتائج البحث والتصفية مستقلة. بيانات GIS والصور لا تثبت الجاهزية التشغيلية.</p>
      <main className={`${s.layout} ${collapsed ? s.collapsed : ''}`}><div>
        <section className={`${s.panel} ${s.mapPanel}`} ref={workspace} tabIndex={-1} data-testid="map-workspace">
          <div className={s.panelHead}><h2><MapPinned size={19}/>خارطة مواقع التنمية السياحية <span className={s.badge} data-testid="map-count" data-count={visible.length}>{n(visible.length)} موقعًا</span></h2>
            <div className={s.mapTools}>
              <button data-testid="fit-country" onClick={() => requestFit('country')}><LocateFixed size={15}/>{data.context ? 'التركيز على ليبيا' : 'نطاق مواقع التنمية السياحية'}</button>
              <button ref={fullButton} data-testid="full-map" aria-pressed={fullMap} onClick={toggleFull}>{fullMap ? <Minimize size={16}/> : <Maximize size={16}/>} {fullMap ? 'إنهاء العرض الكامل' : 'عرض كامل'}</button>
              <details className={s.mapExtras} onClick={event => { if(event.target.closest("button")) event.currentTarget.open = false; }}><summary>أدوات الخريطة</summary><div>
              <button data-testid="show-all-sites" onClick={() => showAll('all')}>عرض جميع المواقع</button>
              {data.hasSelection && <button data-testid="show-targeted-sites" onClick={() => showAll('targeted')}>المواقع المستهدفة للاستثمار</button>}
              <button data-testid="fit-visible" disabled={!visible.length} onClick={() => requestFit('sites')}>نطاق النتائج</button>
              {selected && <button data-testid="fit-selected" onClick={() => requestFit('site', selected.zone_id)}>الموقع المحدد</button>}
              <button ref={closeButton} data-testid="toggle-details" aria-expanded={!collapsed} aria-controls="government-site-card" onClick={() => setCollapsed(v => !v)}>{collapsed ? <PanelRightOpen size={16}/> : <PanelRightClose size={16}/>} {collapsed ? 'إظهار بطاقة الموقع' : 'طي بطاقة الموقع'}</button>
              </div></details>
            </div>
          </div>
          <div className={s.siteNavigator} aria-label="التنقل بين المواقع"><button data-testid="previous-site" disabled={!visible.length} onClick={() => move(-1)}><ChevronRight size={16}/>السابق</button>
            <label><span className={s.srOnly}>اختيار الموقع المعروض</span><select data-testid="site-picker" value={selected?.zone_id ?? ''} onChange={event => { if (event.target.value) select(Number(event.target.value)); }}><option value="">اختر موقعًا · {n(visible.length)} نتيجة</option>{visible.map(row => <option key={row.zone_id} value={row.zone_id}>{row.site_name_ar} — GIS {row.zone_id}</option>)}</select></label>
            <button data-testid="next-site" disabled={!visible.length} onClick={() => move(1)}>التالي<ChevronLeft size={16}/></button><span className={s.srOnly} role="status" aria-live="polite">{selected ? `${selected.site_name_ar} · GIS ${selected.zone_id}` : 'اختر موقعًا'}</span>
          </div>
          <GovernmentMap geo={data.geo} context={data.context} rows={visible} selectedId={selected?.zone_id ?? null} request={fit} fullMap={fullMap} cardOpen={!collapsed} onSelect={select}/>
          <div className={s.mapLegend}>{data.hasSelection && <><span><i className={s.nomKey}/>{LABELS.targeted}</span><span><i className={s.remainingKey}/>{LABELS.other}</span></>}<span><i className={s.selectedKey}/>الموقع المحدد</span><small>الأعداد تجمع المواقع للعرض؛ تتكشف المضلعات الأصلية عند التكبير. بيانات الأطلس لا تثبت الحالة التشغيلية.{data.context && ' حد ليبيا السياقي معمّم من Natural Earth.'}</small></div>
        </section>
        <section className={`${s.panel} ${s.listPanel}`}><div className={s.panelHead}><h2>دليل مواقع التنمية السياحية</h2><span role="status" aria-live="polite" data-testid="list-count" data-count={visible.length}>{n(visible.length)} نتيجة من {n(totals.sites)}</span>{selected && <button className={s.mobileDetailsButton} onClick={() => card.current?.scrollIntoView({block:'start'})}>بطاقة الموقع</button>}</div>
          <div className={s.tableScroll}><table><thead><tr><th scope="col">GIS</th><th scope="col">الموقع</th><th scope="col">المساحة هكتار</th>{data.hasSelection && <th scope="col">الاستهداف الاستثماري</th>}<th scope="col">الصور</th></tr></thead><tbody>
            {visible.map(row => <tr key={row.zone_id} data-government-row={row.zone_id} data-selected={selected?.zone_id === row.zone_id}><td><bdi>{row.zone_id}</bdi></td><td><button data-select-id={row.zone_id} onClick={() => select(row.zone_id)}>{row.site_name_ar}</button></td><td><bdi>{row.area_ha_source}</bdi></td>{data.hasSelection && <td>{row.targeted ? LABELS.targeted : LABELS.other}</td>}<td>{row.images.some(im => im.type === 'photo') ? 'صور فوتوغرافية متاحة' : 'لا توجد صورة موثقة'}</td></tr>)}
            {!visible.length && <tr><td colSpan={data.hasSelection ? 5 : 4} className={s.empty}>لا توجد نتائج مطابقة. جرّب الاسم أو معرف GIS.</td></tr>}
          </tbody></table></div>
        </section>
      </div><article id="government-site-card" className={`${s.panel} ${s.details}`} hidden={collapsed} ref={card} aria-label="البطاقة الاستثمارية للموقع"><SiteCard row={selected} geo={data.geo} privateMode={data.hasSelection} onClose={() => { setCollapsed(true); closeButton.current?.focus({preventScroll:true}); }} onFocus={() => { requestFit('site', selected.zone_id); workspace.current?.scrollIntoView({block:'start'}); }}/></article></main>
      <section className={`${s.panel} ${s.photoPanel}`} aria-label="معرض الصور الفوتوغرافية"><div className={s.panelHead}><h2><Images size={19}/>معرض الصور</h2><span>{n(photos.length)} صورة ضمن النتائج</span><button data-testid="toggle-photos" aria-expanded={showPhotos} onClick={() => setShowPhotos(v => !v)}>{showPhotos ? 'إخفاء المعرض' : 'عرض المعرض'}</button></div>
        {showPhotos && <div className={s.photoGrid} data-testid="photo-gallery">{photos.map(({row, image}) => <button key={image.id} data-photo-site={row.zone_id} onClick={() => { select(row.zone_id); card.current?.scrollIntoView({block:'start'}); }}><img src={import.meta.env.BASE_URL + image.src} alt={image.alt} loading="lazy" width={180} height={120}/><strong>{row.site_name_ar} · <bdi>GIS {row.zone_id}</bdi></strong></button>)}{!photos.length && <p className={s.empty}>لا توجد صورة موثقة ضمن النتائج الحالية.</p>}</div>}
      </section>
      <footer className={s.footer}>المنصة الوطنية للخارطة الاستثمارية السياحية · ليبيا</footer>
    </div>
  </div>;
}
export default function GovernmentPortfolio({route}) {
  const privateMode=PRIVATE_PRESENTATION&&!route.startsWith('#/portfolio');
  const state = useGovernmentData({privateMode});
  if (privateMode && route.startsWith('#/government/manage')) return <Suspense fallback={<p role="status" dir="rtl">جار تحميل إدارة الاختيار…</p>}><PrivateSelectionAdmin/></Suspense>;
  if (state.loading || state.error) return <div className={s.shell} dir="rtl"><div className={s.frame}><GovernmentHeader privateMode={privateMode}/>{state.error ? <section role="alert" className={s.error}><h2>تعذر تحميل بيانات الخارطة</h2><p>{state.error}</p><p>لا تُعرض أعداد بديلة أو نتائج افتراضية.</p></section> : <p role="status" className={s.loading}>جار تحميل مواقع التنمية السياحية…</p>}</div></div>;
  return <Portfolio data={state.data}/>;
}
