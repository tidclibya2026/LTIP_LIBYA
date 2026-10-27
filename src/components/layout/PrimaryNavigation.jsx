import { Home, MapPinned, Layers3, List, ExternalLink } from 'lucide-react';
import styles from './OfficialLayout.module.css';

export default function PrimaryNavigation() {
  return <nav className={styles.navigation} aria-label="التنقل الرئيسي">
    <div className={styles.navigationInner}>
      <a href="#/"><Home size={16} aria-hidden="true" />الرئيسية</a>
      <a href="#/admin">إدارة بيانات المواقع</a>
      <a href="#/workspace">مساحة إدخال البيانات</a>
      <a href="#/admin-demo">العرض الإداري التجريبي</a>
      <a href="#ltip-map"><MapPinned size={16} aria-hidden="true" />الخارطة</a>
      <a href="#ltip-explorer"><List size={16} aria-hidden="true" />المناطق والمعالم</a>
      <a href="#ltip-layers"><Layers3 size={16} aria-hidden="true" />الطبقات</a>
      <a className={styles.cardsLink} href={`${import.meta.env.BASE_URL}investment-cards.html`} target="_blank" rel="noopener noreferrer">
        بطاقات الاستثمار<ExternalLink size={15} aria-hidden="true" /><span className={styles.srOnly}> — تفتح في نافذة جديدة</span>
      </a>
    </div>
  </nav>;
}
