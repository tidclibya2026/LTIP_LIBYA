import { Fragment } from 'react';
import { planningFields, PLANNING_TITLE } from '../../../public/planning-status.js';
import styles from './InvestmentSite.module.css';

export default function ZonePlanningStatus({ record, loading, error }) {
  return <section className={styles.details} aria-label={PLANNING_TITLE}>
    <h5>{PLANNING_TITLE}</h5>
    {loading && <p role="status">جار تحميل الوضع التخطيطي…</p>}
    {error && <p role="alert">{error}</p>}
    <dl>{planningFields(record).map(([label, value]) => <Fragment key={label}><dt>{label}</dt><dd>{value}</dd></Fragment>)}</dl>
    <p className={styles.note}>صور حدود الموقع لا تثبت وجود مخطط معتمد. تصنيف الموقع وقرار الصبغة السياحية لا يثبتان الملكية أو الجاهزية التشغيلية.</p>
  </section>;
}
