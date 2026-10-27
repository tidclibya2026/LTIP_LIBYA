import { Printer } from 'lucide-react';
import styles from './ZonePrintLink.module.css';

export default function ZonePrintLink({ zoneId }) {
  if (zoneId == null || String(zoneId).trim() === '') return null;
  const params = new URLSearchParams({ zone: String(zoneId) });
  return <a className={styles.link} href={`${import.meta.env.BASE_URL}zone-investment-card.html?${params}`} target="_blank" rel="noopener noreferrer">
    <Printer size={17} aria-hidden="true" />طباعة بطاقة المنطقة
    <span className={styles.hint}>تفتح في نافذة جديدة</span>
  </a>;
}
