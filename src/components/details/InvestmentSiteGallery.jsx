import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Images, Maximize2, X } from 'lucide-react';
import styles from './InvestmentSite.module.css';

const assetUrl = image => `${import.meta.env.BASE_URL}${image.src.replace(/^\/+/, '')}`;
const imageType = image => ({ photo: 'صورة الموقع', aerial_satellite: 'صورة فضائية', reference_map: 'خريطة مرجعية', boundary: 'حدود الموقع' }[image.type] || image.type_label);
const typeOrder = { photo: 0, aerial_satellite: 1, reference_map: 2, boundary: 3 };

function OriginalImage({ image, enlarged = false }) {
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const img = <img className={enlarged ? styles.enlarged : styles.original} src={assetUrl(image)} alt={image.alt}
      data-image-type={image.type}
      style={enlarged && zoom !== 1 ? { width: zoom === 'native' ? image.width : `${zoom * 100}%`, height: 'auto', maxWidth: 'none' } : undefined}
      width={image.width} height={image.height} loading={enlarged ? 'eager' : 'lazy'} decoding="async"
      onError={() => setFailed(true)} />;
  if (failed) return <p className={styles.imageError} role="status">تعذر تحميل الصورة الأصلية: {image.original_filename}</p>;
  if (!enlarged) return img;
  return <><div className={styles.zoomControls} aria-label="مقياس عرض الصورة">
    <button type="button" aria-pressed={zoom === 1} onClick={() => setZoom(1)}>ملاءمة الصورة</button>
    <button type="button" aria-pressed={zoom === 'native'} onClick={() => setZoom('native')}>الحجم الأصلي</button>
    <button type="button" aria-pressed={zoom === 2} onClick={() => setZoom(2)}>تكبير ×2</button>
    <button type="button" aria-pressed={zoom === 3} onClick={() => setZoom(3)}>تكبير ×3</button>
  </div><p className={styles.note}>كبّر الصورة ثم مرّر داخلها لقراءة التفاصيل. الوضوح محدود بدقة الأصل.</p>
    <div key={zoom} className={styles.zoomViewport} tabIndex={0} aria-label="الصورة المكبرة — مرّر لاستعراض التفاصيل" dir="ltr">{img}</div></>;
}

export default function InvestmentSiteGallery({ site }) {
  const images = [...site.images].sort((a, b) => (typeOrder[a.type] ?? 4) - (typeOrder[b.type] ?? 4));
  const [active, setActive] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const dialog = useRef(null);
  const expandButton = useRef(null);
  const image = images[active];
  const move = step => setActive(index => (index + step + images.length) % images.length);

  useEffect(() => {
    if (expanded) dialog.current?.showModal();
    else dialog.current?.close();
  }, [expanded]);
  const close = () => { setExpanded(false); expandButton.current?.focus(); };
  const navigation = <div className={styles.navigation}>
    <button type="button" aria-label="الصورة السابقة" disabled={images.length < 2} onClick={() => move(-1)}><ChevronRight size={18} />السابقة</button>
    <span role="status" aria-live="polite">{active + 1} / {images.length} — {image?.type_label}</span>
    <button type="button" aria-label="الصورة التالية" disabled={images.length < 2} onClick={() => move(1)}>التالية<ChevronLeft size={18} /></button>
  </div>;
  if (!image) return null;
  return <section className={styles.gallery} aria-label="صور الموقع الأصلية" data-zone-id={site.zone_id}>
    <div className={styles.galleryHeader}><h3><Images size={20} />{site.media_title || `صور ${site.zone_name}`}</h3><span>{images.length} ملفات مصورة</span></div>
    <figure className={styles.figure}>
      <button ref={expandButton} className={styles.imageButton} type="button" onClick={() => setExpanded(true)} aria-label="تكبير الصورة الأصلية">
        <OriginalImage key={image.id} image={image} /><span className={styles.zoom}><Maximize2 size={16} />تكبير الصورة</span>
      </button>
      <figcaption><strong>{image.type_label}</strong> — {image.original_filename}<small>{image.source}</small></figcaption>
    </figure>
    <div className={styles.choices} aria-label="اختيار صورة الموقع">{images.map((item, index) =>
      <button key={item.id} type="button" aria-pressed={active === index} onClick={() => setActive(index)} aria-label={`عرض الصورة ${index + 1}: ${imageType(item)}`}>
        <img src={assetUrl(item)} alt={item.alt} width={item.width} height={item.height} loading="lazy" decoding="async" />
        <span>{imageType(item)}</span>
      </button>)}</div>
    {navigation}
    <p className={styles.note}>المصدر والتاريخ حسب سجل كل ملف. الخرائط والصور الحدودية مراجع مصورة؛ لا تثبت دقة الإسناد الجغرافي.</p>
    {createPortal(<dialog ref={dialog} className={styles.dialog} dir="rtl" aria-labelledby="investment-image-title"
      onCancel={event => { event.preventDefault(); close(); }} onClose={close}
      onClick={event => { if (event.target === event.currentTarget) close(); }}
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); close(); }
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); move(event.key === 'ArrowLeft' ? 1 : -1); }
      }}>
      {expanded && <><div className={styles.dialogHeader}><h2 id="investment-image-title">{site.zone_name} — {image.type_label}</h2>
        <button type="button" aria-label="إغلاق الصورة المكبرة" onClick={close} autoFocus><X size={22} /></button></div>
        <OriginalImage key={image.id} image={image} enlarged />{navigation}<p className={styles.note}>{image.original_filename} — {image.source}</p></>}
    </dialog>, document.body)}
  </section>;
}
