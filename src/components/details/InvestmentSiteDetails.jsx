import styles from './InvestmentSite.module.css';

export default function InvestmentSiteDetails({ site, loading, error }) {
  if (!site) return <p className={styles.note} role="status">{loading ? 'جار تحميل بيانات الموقع المصدرية…' : error || 'لم تُعتمد بيانات مصدرية إضافية لهذه المنطقة بعد.'}</p>;
  return <section className={styles.details} aria-label="بيانات الموقع من الملفات المصدرية" data-site-id={site.site_id}>
    <h5>بيانات الموقع من الملفات المصدرية</h5>
    <dl>
      <dt>المساحة الواردة في المصدر</dt>
      <dd data-testid="source-area">{site.source_area.ar_original_ha ? <><bdi>{site.source_area.ar_original_ha}</bdi> هكتار</> : 'غير متوفر في المصدر'}
        <small>{site.source_area.source} — الشريحة {site.source_area.slide}</small>
      </dd>
      {site.source_area.en_original_ha !== site.source_area.ar_original_ha && <><dt>المساحة في النص الإنجليزي</dt><dd><bdi>{site.source_area.en_original_ha || 'غير متوفر'}</bdi> هكتار</dd></>}
      <dt>اسم الموقع في المصدر</dt><dd>{site.source_name}</dd>
      <dt>المجموعة المصدرية</dt><dd>{site.geographic_group}</dd>
    </dl>
    <p className={styles.note}>المساحة المصدرية منفصلة عن المساحة المحسوبة من GeoJSON. بيانات الوصف والخدمات كما وردت في الملف الأصلي.</p>
    <details className={styles.disclosure}>
      <summary>الوصف والخدمات في المصدر</summary>
      <dl>{site.attributes.map(attribute => <div className={styles.attribute} key={attribute.key}>
        <dt>{attribute.label}</dt><dd>{attribute.display_ar || 'غير متوفر في المصدر'}</dd>
      </div>)}</dl>
      <small>المصدر: {site.source_document.filename} — {site.source_document.title}. الأنشطة المحلية لا تعني استخدامات استثمارية معتمدة.</small>
      {site.warnings.length > 0 && <div className={styles.warnings}><strong>ملاحظات جودة المصدر</strong><ul>{site.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></div>}
    </details>
  </section>;
}
