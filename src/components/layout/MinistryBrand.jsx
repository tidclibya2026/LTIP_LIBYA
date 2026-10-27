import styles from './OfficialLayout.module.css';

export default function MinistryBrand() {
  return <div className={styles.ministry}>
    <img
      className={styles.logo}
      src={`${import.meta.env.BASE_URL}assets/branding/logo.png.png`}
      alt="شعار وزارة السياحة والصناعات التقليدية"
      width="136"
      height="72"
      onError={event => { event.currentTarget.hidden = true; }}
    />
    <div className={styles.ministryText}>
      <strong>وزارة السياحة والصناعات التقليدية</strong>
      <span>مركز المعلومات والتوثيق السياحي</span>
    </div>
  </div>;
}
