import { useEffect, useState } from 'react';
import { FIELDS, createRecord, completeness } from '../../public/admin-dashboard-model.js';
import { REVIEW, EXTENSIONS } from '../../public/site-admin-model.js';
import { loadWorkspace, saveRecord, prepareFile } from './dashboardStore.js';
import { getDrafts } from './draftStore.js';
import { AdminIcon, SectionIcon, StatusBadge, tabKeyboardNavigation } from './AdminVisual.jsx';
import { Save, Send, ArrowRight, UploadCloud, FileText, Download, Trash2, Info } from 'lucide-react';
import { DataFields, EvidenceFields, RecordIdentifier } from './RecordFields.jsx';
import './dashboard.css';
import './siteEditor.css';

const groups = {
 'الخرائط': { aerial_maps: 'الخرائط الجوية والفضائية', contour_maps: 'خرائط كنتورية ومساحية وحدود' },
 'الصور': { photos: 'صور الموقع الميدانية' },
 'الدراسات والمخططات': { studies_and_plans: 'الدراسات والمخططات والوثائق' },
 'الملكية والوضع العقاري': { studies_and_plans: 'الوثائق العقارية' },
 'الوضع التخطيطي والقرارات': { studies_and_plans: 'القرارات والمستندات' }
};
const categories = { photos: ['صور ميدانية'], aerial_maps: ['صور جوية', 'صور فضائية'], contour_maps: ['خرائط كنتورية', 'خرائط مساحية', 'خرائط حدود'], studies_and_plans: ['دراسة جدوى', 'مخطط عام', 'مخطط تفصيلي', 'دراسة بيئية', 'دراسة هندسية', 'وثيقة عقارية', 'قرار', 'وثيقة أخرى'] };

function FilePreview({ attachment, staged }) {
 const [url, setUrl] = useState(''), [error, setError] = useState('');
 useEffect(() => {
  let active = true, local;
  (async () => {
   const blob = staged.get(attachment.file.id) || (await loadWorkspace()).files.find(f => f.id === attachment.file.id)?.blob;
   if (blob && active) { local = URL.createObjectURL(blob); setUrl(local); }
  })().catch(e => active && setError(e.message));
  return () => { active = false; if (local) URL.revokeObjectURL(local); };
 }, [attachment.file.id, staged]);
 return <div className="site-file-preview">{error && <p role="alert">{error}</p>}{url && <>{ /\.(png|jpe?g|webp)$/i.test(attachment.file.name) && <img src={url} alt={attachment.title || attachment.file.name}/> }{ /\.pdf$/i.test(attachment.file.name) && <iframe src={url} title={attachment.title || attachment.file.name} sandbox=""/> }<a href={url} target="_blank" rel="noopener noreferrer">عرض الملف</a><a href={url} download={attachment.file.name}><Download aria-hidden="true"/>تنزيل {attachment.file.name}</a></>}</div>;
}

export default function SiteEditor({ route }) {
 const selection = route === '#/admin/sites/select';
 const match = /^#\/admin\/sites\/edit\/([1-9]\d*)$/.exec(route);
 const id = match ? Number(match[1]) : null;
 const [sites, setSites] = useState([]), [row, setRow] = useState(null), [reference, setReference] = useState(null);
 const [tab, setTab] = useState(Object.keys(FIELDS.sites)[0]), [query, setQuery] = useState('');
 const [staged, setStaged] = useState(new Map()), [dirty, setDirty] = useState(false), [busy, setBusy] = useState(true), [message, setMessage] = useState(''), [error, setError] = useState('');
 useEffect(() => {
  let active = true;
  (async () => {
   const load = async name => { const response = await fetch(import.meta.env.BASE_URL + 'data/' + name); if (!response.ok) throw Error('تعذر تحميل ' + name); return response.json(); };
   const geo = await load('zones_141.geojson');
   const ids = geo.features.map(f => f.properties.id);
   if (ids.length !== 141 || new Set(ids).size !== 141) throw Error('مرجع المواقع غير صالح');
   if (!active) return;
   setSites(geo.features.map(f => f.properties));
   if (selection) return;
   if (!ids.includes(id)) throw Error('معرف الموقع غير صالح أو غير موجود ضمن المواقع الـ141');
   const [workspace, historical, manual, enrichment, legacyDrafts, published] = await Promise.all([
    loadWorkspace(), load('zone_planning_status_141.json'), load('site_manual_enrichment.json'), load('investment_site_enrichment.json'), getDrafts(),
    (async () => { const response = await fetch(import.meta.env.BASE_URL + 'data/admin-approved-records.json'); if (response.status === 404 || response.headers.get('content-type')?.includes('text/html')) return null; if (!response.ok) throw Error('تعذر تحميل البيانات المعتمدة'); return response.json(); })()
   ]);
   if (!active) return;
   // Never seed empty inputs over an existing record or copy historical claims into a new draft.
   const saved = workspace.records.find(r => r.type === 'sites' && r.id === String(id));
   setRow(structuredClone(saved || createRecord('sites', { id })));
   setReference({ historical: historical.zones?.[id], manual: manual.zones?.[id], enrichment: enrichment.zones?.[id], legacyDraft: legacyDrafts.find(r => r.zone_id === id), approved: published?.records?.find(r => r.type === 'sites' && r.id === String(id)) });
  })().catch(e => active && setError(e.message)).finally(() => active && setBusy(false));
  return () => { active = false; };
 }, [id, selection]);
 useEffect(() => {
  const beforeUnload = e => { if (dirty) { e.preventDefault(); e.returnValue = ''; } };
  const beforeNavigate = e => { if (dirty && !confirm('توجد تعديلات غير محفوظة. هل تريد الخروج وتجاهلها؟')) e.preventDefault(); };
  window.addEventListener('beforeunload', beforeUnload);
  window.addEventListener('ltip:before-navigate', beforeNavigate);
  return () => { window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('ltip:before-navigate', beforeNavigate); };
 }, [dirty]);
 const change = next => { setRow(next); setDirty(true); setMessage(''); };
 const editField = (key, value) => change({ ...row, data: { ...row.data, [key]: value }, evidence: { ...row.evidence, [key]: { source: '', ...row.evidence[key], verification: 'UNVERIFIED', entered_at: new Date().toISOString() } } });
 const editEvidence = (key, key2, value) => change({ ...row, evidence: { ...row.evidence, [key]: { source: '', verification: 'UNVERIFIED', ...row.evidence[key], ...(key2 === 'source' ? { verification: 'UNVERIFIED' } : {}), [key2]: value, entered_at: new Date().toISOString() } } });
 const run = async action => { setBusy(true); setError(''); try { await action(); } catch (e) { setError(e.message || 'تعذر الحفظ المحلي'); } finally { setBusy(false); } };
 const save = action => run(async () => {
  if (action === 'SUBMIT' && dirty) throw Error('احفظ المسودة أولًا قبل إرسالها للمراجعة');
  const saved = await saveRecord(row, staged, sites.map(s => s.id), action);
  setRow(saved); setStaged(new Map()); setDirty(false);
  setMessage(action === 'SAVE' ? 'تم حفظ المسودة والملفات محليًا بنجاح' : 'تم إرسال السجل للمراجعة؛ لم يتم اعتماده أو نشره');
 });
 const attach = (files, section) => run(async () => {
  const attachments = [...row.attachments], blobs = new Map(staged);
  for (const file of files) {
   const prepared = await prepareFile(file, section, id, attachments.map(a => ({ file: a.file })));
   attachments.push({ file: prepared.item.file, section, title: '', description: '', source: '', rights: '', date: '', category: '', crs: '', approved: false });
   blobs.set(prepared.item.id, prepared.blob);
  }
  setStaged(blobs); change({ ...row, attachments });
 });
 const editAttachment = (fileId, key, value) => change({ ...row, attachments: row.attachments.map(a => a.file.id === fileId ? { ...a, [key]: value, approved: false } : a) });
 const site = sites.find(s => s.id === id);
 return <main className="dashboard site-entry" dir="rtl" aria-busy={busy}><aside><div className="admin-brand">LTIP <span>LIBYA</span></div><p>إدارة الاستثمار السياحي</p><nav><a href="#/admin"><AdminIcon name="home"/>الرئيسية الإدارية</a><a href="#/admin/sites"><AdminIcon name="sites"/>قائمة المواقع الاستثمارية</a><a aria-current="page" href="#/admin/sites/select"><AdminIcon name="entry"/>إدخال المواقع الاستثمارية</a><a href={id ? `#/admin?zone_id=${id}` : "#/admin"}><AdminIcon name="legacy"/>محرر المكتبة السابق</a></nav><a href="#/map">العودة إلى الخارطة</a></aside><section className="dashboard-body">
 <header><div><small className="admin-breadcrumb" aria-label="مسار التنقل"><AdminIcon name="sites"/>المواقع الاستثمارية / {selection ? 'اختيار الموقع' : 'إدخال البيانات'}</small><h1>إدخال وتحديث بيانات الموقع الاستثماري</h1>{site && <><h2>{row?.data.name?.trim()||site.name_ar||'سجل جديد'}</h2><RecordIdentifier id={String(id)} site/></>}</div><div className="admin-header-meta"><span className="local-badge">مساحة عمل محلية</span>{row && <StatusBadge status={row.status}/>}</div></header>
 <p className="admin-notice"><Info aria-hidden="true"/>البيانات تحفظ على هذا المتصفح. لا تنشر المسودات، ولا يثبت إدخال رقم قرار اعتماده القانوني. التصدير والاستيراد متاحان من لوحة الإدارة.</p>
 {error && <p className="site-error" role="alert">{error}</p>}<p className="admin-feedback" data-loading={busy} role="status" aria-live="polite">{busy ? 'جار التنفيذ…' : message}</p>
 {selection && <article className="admin-panel"><h2>اختيار موقع من السجل الجغرافي — {sites.length} موقعًا</h2><label>بحث عن موقع<input value={query} onChange={e => setQuery(e.target.value)} placeholder="اسم الموقع أو معرفه"/></label><div className="site-picker">{sites.filter(s => `${s.id} ${s.name_ar}`.includes(query)).map(s => <a key={s.id} href={`#/admin/sites/edit/${s.id}`}>{s.id} — {s.name_ar}<span>إدخال البيانات ←</span></a>)}</div></article>}
 {row && site && <>
 <section className="site-summary" aria-label="ملخص السجل"><div><span>حالة السجل</span><strong><StatusBadge status={row.status}/></strong></div><div><span>اكتمال الحقول الموثقة</span><strong>{completeness(row)}%</strong><progress aria-label="اكتمال الحقول الموثقة" max="100" value={completeness(row)}/></div><div><span>آخر حفظ</span><strong>{new Date(row.updated_at).toLocaleString('ar-LY')}</strong><small>{dirty ? 'تعديلات غير محفوظة' : 'لا توجد تعديلات غير محفوظة'}</small></div></section>
 <details className="admin-panel gis-reference"><summary><SectionIcon index={3}/>بيانات GIS الأصلية — للقراءة فقط</summary><p>المعرف والهندسة ثابتان ولا يمكن تعديلهما من هذه الشاشة. المصدر: zones_141.geojson</p><dl>{Object.entries(site).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{typeof value === 'object' ? JSON.stringify(value) : String(value ?? 'غير متوفر')}</dd></div>)}</dl></details>
 <details className="admin-panel"><summary>السجل التاريخي والمطابقات والمكتبة والمسودات السابقة — للقراءة فقط</summary><p>هذه مراجع مستقلة لم تُنسخ فوق الحقول الحالية. تبقى المسودات السابقة في مخزنها؛ يمكن تحريرها وتصديرها من <a href={`#/admin?zone_id=${id}`}>محرر المكتبة السابق لهذا الموقع</a>.</p>{Object.entries({ historical: 'الوضع التخطيطي والمطابقات التاريخية', manual: 'المكتبة المنشورة', enrichment: 'بيانات الإثراء', legacyDraft: 'مسودة المحرر السابق', approved: 'السجل المعتمد المنشور' }).map(([key, label]) => <details key={key}><summary>{label}</summary><pre>{reference?.[key] ? JSON.stringify(reference[key], null, 2) : 'لا توجد بيانات متاحة'}</pre></details>)}</details>
 <div role="tablist" onKeyDown={tabKeyboardNavigation} aria-label="أقسام إدخال الموقع">{[...Object.keys(FIELDS.sites), 'التوثيق وسجل التغييرات'].map((name, index) => <button id={`site-tab-${index}`} role="tab" aria-selected={tab === name} aria-controls="site-tab-panel" key={name} onClick={() => setTab(name)}><SectionIcon index={index}/>{index===8?'التوثيق والمراجعة':name}</button>)}</div>
 <article className="admin-panel" id="site-tab-panel" role="tabpanel" aria-labelledby={`site-tab-${[...Object.keys(FIELDS.sites), 'التوثيق وسجل التغييرات'].indexOf(tab)}`}><h2 className="section-heading"><SectionIcon index={Object.keys(FIELDS.sites).indexOf(tab)}/>{tab === 'التوثيق وسجل التغييرات' ? 'التوثيق والمراجعة' : tab}</h2><fieldset disabled={busy}>
 {FIELDS.sites[tab] && <DataFields fields={FIELDS.sites[tab]} row={row} onEdit={editField}/>}
 {tab === 'التوثيق وسجل التغييرات' && <EvidenceFields row={row} onEdit={editEvidence}/>}
 {groups[tab] && <section className="site-attachments"><h3><UploadCloud aria-hidden="true"/>المرفقات الفعلية</h3><p>20 ميغابايت للملف، و50 ميغابايت إجمالًا. تبقى المرفقات غير معتمدة حتى مراجعتها من لوحة الإدارة.</p>{Object.entries(groups[tab]).map(([section, label]) => <label key={section}>{label}<input data-upload={section} type="file" multiple accept={EXTENSIONS[section].map(ext => '.' + ext).join(',')} onChange={e => { const files = [...e.target.files]; e.target.value = ''; if (files.length) attach(files, section); }}/></label>)}{row.attachments.filter(a => Object.hasOwn(groups[tab], a.section)).map(a => <article className="field-card" data-attachment={a.file.id} key={a.file.id}><div className="attachment-heading"><FileText aria-hidden="true"/><strong>{a.file.name}<small>{a.file.name.split('.').pop().toUpperCase()} ? {(a.file.size / 1024).toFixed(1)} KB</small></strong><span className="record-badge" data-status={a.approved ? 'APPROVED' : 'DRAFT'}>{a.approved ? 'معتمد' : 'غير معتمد'}</span></div><FilePreview attachment={a} staged={staged}/><div className="field-grid">{Object.entries({ title: 'العنوان', description: 'الوصف', source: 'المصدر', date: 'التاريخ الموثق', rights: 'حقوق الاستخدام', crs: 'نظام الإحداثيات إن توفر' }).map(([key, label]) => <label key={key}>{label}<input value={a[key] || ''} maxLength={12000} onChange={e => editAttachment(a.file.id, key, e.target.value)}/></label>)}<label>نوع المرفق<select value={a.category || ''} onChange={e => editAttachment(a.file.id, 'category', e.target.value)}><option value="">غير مصنف</option>{categories[a.section].map(c => <option key={c}>{c}</option>)}</select></label></div><p>حالة المرفق: {a.approved ? 'معتمد محليًا' : 'غير معتمد'}</p><button onClick={() => { if (confirm('إزالة المرفق من المسودة؟')) change({ ...row, attachments: row.attachments.filter(x => x.file.id !== a.file.id) }); }}><Trash2 aria-hidden="true"/>إزالة من المسودة</button></article>)}</section>}
 </fieldset>{tab === 'التوثيق وسجل التغييرات' && <><p>تاريخ الإدخال: {row.created_at}</p><p>المراجع: {row.reviewer || 'لم يحدد'} — {row.review_notes || 'لا توجد ملاحظات'}</p><p>الاعتماد إجراء منفصل في قسم مراجعة واعتماد البيانات بلوحة الإدارة.</p>{row.history.slice().reverse().map((h, index) => <details key={index}><summary>{h.at} — {h.action}</summary><pre>{JSON.stringify(h.changes, null, 2)}</pre></details>)}</>}</article>
 <footer className="site-savebar"><span>{dirty ? 'تعديلات غير محفوظة' : REVIEW[row.status]}</span><button disabled={busy} onClick={() => save('SAVE')}><Save aria-hidden="true"/>حفظ مسودة</button><button disabled={busy || dirty || !['DRAFT', 'REJECTED'].includes(row.status) || !row.history.length} onClick={() => save('SUBMIT')}><Send aria-hidden="true"/>إرسال للمراجعة</button><a href="#/admin/sites"><ArrowRight aria-hidden="true"/>العودة للقائمة</a></footer>
 </>}
 </section></main>;
}
