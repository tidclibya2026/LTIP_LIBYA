import MinistryBrand from './MinistryBrand.jsx';
import PrimaryNavigation from './PrimaryNavigation.jsx';
import styles from './OfficialLayout.module.css';

export default function OfficialHeader() {
  return <header className={styles.header} dir="rtl">
    <a className={styles.skipLink} href="#ltip-map">انتقل إلى الخارطة</a>
    <div className={styles.identity}>
      <div className={styles.government}>
        <img className={styles.logo} src={`${import.meta.env.BASE_URL}assets/branding/gov-libya.png`} alt="شعار حكومة الوحدة الوطنية — دولة ليبيا" width="136" height="72" onError={event => { event.currentTarget.hidden = true; }} />
        <div className={styles.governmentText}>
          <strong>دولة ليبيا</strong>
          <span>حكومة الوحدة الوطنية</span>
        </div>
      </div>
      <div className={styles.platform}>
        <span className={styles.wordmark} lang="en" dir="ltr">LTIP LIBYA</span>
        <h1>المنصة الوطنية للاستثمار السياحي</h1>
        <p>ليبيا | الخارطة الاستثمارية الجغرافية</p>
      </div>
      <MinistryBrand />
    </div>
    <PrimaryNavigation />
  </header>;
}
