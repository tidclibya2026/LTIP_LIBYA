import styles from './OfficialLayout.module.css';

export default function OfficialFooter() {
  return <footer className={styles.footer} dir="rtl">
    <p><bdi>LTIP LIBYA</bdi> · وزارة السياحة والصناعات التقليدية · مركز المعلومات والتوثيق السياحي</p>
    <p>مؤشر القرب الجغرافي لا يثبت الجاهزية التشغيلية أو جاهزية المنطقة للاستثمار.</p>
  </footer>;
}
