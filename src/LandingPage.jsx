import styles from './LandingPage.module.css';

export default function LandingPage() {
  return <main className={styles.landing} dir="rtl" aria-label="الرئيسية — منصة LTIP LIBYA">
    <div className={styles.panorama}>
      <img
        className={styles.image}
        src={`${import.meta.env.BASE_URL}assets/branding/Libya%20Tourism%20Investment%20Panorama.png`}
        width="1672"
        height="941"
        alt="المنصة الوطنية للخارطة الاستثمارية السياحية في ليبيا — بوابة رقمية لعرض الفرص الاستثمارية والمواقع السياحية الواعدة في ليبيا. دولة ليبيا، حكومة الوحدة الوطنية، وزارة السياحة والصناعات التقليدية."
        fetchPriority="high"
      />
      <button className={styles.enter} type="button" aria-label="الدخول إلى المنصة" title="الدخول إلى المنصة" onClick={() => { window.location.hash = '/map'; }} />
    </div>
  </main>;
}
