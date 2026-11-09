import { useState } from 'react';
import { Images } from 'lucide-react';
import { buildSiteLibrary, LIBRARY_SECTIONS, localAssetPath } from '../../../public/site-library-model.js';
import { DESCRIPTIVE_FIELDS, PLANNING_FIELDS, STUDY_TYPES } from '../../../public/site-admin-model.js';
import { planningFields } from '../../../public/planning-status.js';
import InvestmentSiteGallery from './InvestmentSiteGallery.jsx';
import styles from './InvestmentSite.module.css';

const imageFile = src => /\.(jpe?g|png|webp)$/i.test(src || '');
const urlFor = src => `${import.meta.env.BASE_URL}${src.replace(/^\//, '')}`;
const metadata = { captured_at: 'تاريخ التصوير / الالتقاط', capture_date: 'تاريخ التصوير', spatial_resolution: 'الدقة المكانية', epsg: 'نظام الإحداثيات', usage_notes: 'ملاحظات الاستخدام', contour_interval_m: 'الفاصل الكنتوري بالمتر', elevation_model_source: 'مصدر الارتفاعات', scale: 'مقياس الرسم', prepared_at: 'تاريخ إعداد الخريطة', prepared_by: 'الجهة المعدة', year: 'السنة', version: 'الإصدار', study_status: 'حالة الدراسة', official_approval_status: 'الاعتماد الرسمي', notes: 'ملاحظات' };
function Fields({ values, labels }) {
  return <dl className={styles.libraryFields}>{Object.entries(labels).filter(([key]) => values?.[key]).map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{values[key]}</dd></div>)}</dl>;
}
export default function SiteDocumentLibrary({ zoneId, zoneName, site, planning, sources, initialSection = 'photos' }) {
  const [section, setSection] = useState(initialSection);
  const library = buildSiteLibrary({ zoneId, site, manual: sources.manual[zoneId], legacy: sources.legacy[zoneId] || [] });
  const items = library.groups[section];
  const images = items.filter(item => imageFile(item.src)).map(item => ({ ...item, type_label: LIBRARY_SECTIONS[section], alt: item.alt || item.title }));
  const manual = library.manual;
  const manualText = key => manual?.section_review?.[key] === 'APPROVED' ? manual[key] : {};
  const fields = planningFields(planning);
  return <section className={styles.gallery} dir="rtl" aria-label="مكتبة وثائق ووسائط الموقع الاستثماري" data-library-zone={zoneId}>
    <div className={styles.galleryHeader}><h3><Images size={20} />مكتبة وثائق ووسائط {zoneName}</h3><span>{library.totalFiles} ملفًا</span></div>
    <a className={styles.libraryAdmin} href={`#/admin?zone_id=${zoneId}`}>إضافة ملفات أو تحرير بيانات هذا الموقع</a>
    {sources.loading && <p role="status">جار تحميل مصادر المكتبة…</p>}{sources.error && <p role="alert">{sources.error}</p>}
    <div className={styles.libraryTabs} role="tablist" aria-label="أقسام مكتبة الموقع">{Object.entries(LIBRARY_SECTIONS).map(([key, label]) => <button id={`library-tab-${zoneId}-${key}`} aria-controls={`library-panel-${zoneId}`} role="tab" key={key} aria-selected={section === key} onClick={() => setSection(key)}>{label} ({library.groups[key].filter(item => item.src).length} ملفات)</button>)}</div>
    <div id={`library-panel-${zoneId}`} role="tabpanel" aria-labelledby={`library-tab-${zoneId}-${section}`}>
      <h4>{LIBRARY_SECTIONS[section]}</h4>
      {images.length > 0 && <InvestmentSiteGallery key={`${zoneId}-${section}`} site={{ zone_id: zoneId, zone_name: zoneName, media_title: LIBRARY_SECTIONS[section], images }} />}
      {items.map(item => <article className={styles.libraryRecord} key={`${item.origin}-${item.id}`} data-library-record={item.id}>
        <strong>{item.title}</strong><p>{item.description}</p><small>{item.source || 'المصدر غير مسجل'}</small>
        <p className={styles.note}>أساس التصنيف: {item.classification_source}</p>{item.secondary_type && <p className={styles.note}>التصنيف الثانوي في المصدر: {item.secondary_type}</p>}
        {item.origin === 'legacy' && <p className={styles.note}>{item.caption} — ربط أرشيفي يحتاج إلى تحقق مكاني، ولا يثبت توثيق مضلع الموقع.</p>}
        <Fields values={item} labels={metadata} />{item.document_type && <p>نوع الوثيقة: {STUDY_TYPES[item.document_type]}</p>}
        {item.rights && <p>حقوق الاستخدام: {item.rights}</p>}
        {item.src && localAssetPath(item.src) ? <><a href={urlFor(item.src)} target="_blank" rel="noreferrer">{imageFile(item.src) || /\.pdf$/i.test(item.src) ? 'عرض الملف' : 'فتح / تنزيل الملف'}</a> · <a href={urlFor(item.src)} download>تنزيل الأصل</a>{/\.pdf$/i.test(item.src) && <iframe className={styles.documentPreview} loading="lazy" sandbox="" title={item.title} src={urlFor(item.src)} />}</> : <p>وثيقة مسجلة وغير مرفوعة — لا يوجد رابط ملف منشور</p>}
      </article>)}
      {section === 'descriptive_data' && <>{site && <><Fields values={Object.fromEntries((site.attributes || []).filter(a => a.display_ar).map(a => [a.key, a.display_ar]))} labels={Object.fromEntries((site.attributes || []).map(a => [a.key, a.label]))} /><p className={styles.note}>المصدر: {site.source_document?.filename} — {site.source_document?.title}. وثيقة مصدر مسجلة، لا يتوفر لها ملف منشور. هذه بيانات مصدرية وليست نتائج GIS.</p></>}<Fields values={manualText('descriptive_data')} labels={DESCRIPTIVE_FIELDS} /></>}
      {section === 'planning_data' && <><dl className={styles.libraryFields}>{fields.filter(([label]) => ['تصنيف الموقع', 'ضمن المخطط العام للتنمية السياحية'].includes(label)).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{planning?.planning_category_evidence?.source_document && <p className={styles.note}>المصدر: {planning.planning_category_evidence.source_document} — {planning.planning_category_evidence.locator}</p>}<Fields values={manualText('planning_data')} labels={Object.fromEntries(Object.entries(PLANNING_FIELDS).filter(([key]) => !key.startsWith('decision_') && key !== 'issuing_authority'))} /></>}
      {section === 'decisions' && <><dl className={styles.libraryFields}>{fields.filter(([label]) => ['قرار إضفاء الصبغة السياحية', 'رقم القرار وتاريخه', 'الجهة المصدرة'].includes(label)).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{planning?.decision_raw && <p className={styles.note}>إشارة في السجل التاريخي: {planning.decision_raw} — مرجع سجل فقط، وليس نسخة قرار أو تحققًا من اعتماده.</p>}<Fields values={manualText('planning_data')} labels={{ decision_number: 'رقم القرار المدخل يدويًا', decision_date_raw: 'تاريخ القرار كما في المصدر', issuing_authority: 'الجهة المصدرة', source: 'المصدر اليدوي' }} /></>}
      {['studies','plans'].includes(section) && planning?.verification_status === 'VERIFIED' && planning.document_references?.filter(ref => section === 'plans' ? ['MASTER_PLAN','DETAILED_PLAN'].includes(ref.document_type) : !['MASTER_PLAN','DETAILED_PLAN'].includes(ref.document_type)).map((ref, index) => <p key={index}>{ref.title} — {ref.source_document} ({ref.locator}) — وثيقة مسجلة دون ملف منشور.</p>)}
      {!items.length && <p className={styles.note}>لا توجد ملفات منشورة في هذا القسم.{['descriptive_data','planning_data','decisions'].includes(section) ? ' قد تتوفر بيانات نصية أعلاه؛ لا تُحسب كملفات.' : ''}</p>}
      <p className={styles.note}>التصنيف حسب السجل الوصفي، دون إنشاء محتوى جديد. الصور الجوية والحدودية مراجع للمعاينة ولا تُضاف كطبقات مساحية. رفع وثيقة أو نشرها لا يثبت اعتمادها رسميًا.</p>
    </div>
  </section>;
}
