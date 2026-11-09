import {useEffect, useMemo, useState} from 'react';
import useGovernmentData from './useGovernmentData.js';
import {filterRows} from './model.js';
import {GovernmentHeader} from './GovernmentPortfolio.jsx';
import s from './GovernmentPortfolio.module.css';
export default function PrivateSelectionAdmin() {
  const state = useGovernmentData();
  const [selection, setSelection] = useState(null), [targets, setTargets] = useState(new Set()), [query, setQuery] = useState(''), [message, setMessage] = useState(''), [saving, setSaving] = useState(false);
  useEffect(() => { if (state.data) { const record = state.data.privateData.selection; setSelection(record); setTargets(new Set(record.targetIds)); } }, [state.data]);
  const rows = useMemo(() => state.data ? filterRows(state.data.rows, 'all', query) : [], [state.data, query]);
  const dirty = selection && (targets.size !== selection.targetIds.length || selection.targetIds.some(id => !targets.has(id)));
  const send = async command => {
    setSaving(true); setMessage('');
    try {
      const response = await fetch(import.meta.env.BASE_URL + 'private-api/selection', {method:'POST',headers:{'Content-Type':'application/json','X-LTIP-Session':state.data.privateData.session},body:JSON.stringify({...command,expectedRevision:selection.revision})});
      const result = await response.json(); if (!response.ok) throw Error(result.error || 'تعذر الحفظ');
      setSelection(result.selection); setTargets(new Set(result.selection.targetIds)); setMessage('تم حفظ سجل العمل الخاص. لم تُنشر البيانات.');
    } catch (error) { setMessage(error.message); }
    finally { setSaving(false); }
  };
  const review = form => ({reviewer:form.get('reviewer'), document_ref:form.get('document_ref'), reviewed_at:form.get('reviewed_at')});
  return <div className={s.shell} dir="rtl"><div className={s.frame}><GovernmentHeader/>
    <section className={s.adminIntro}><h2>إدارة الاختيار الفني للمواقع</h2><p>سجل عمل خاص للإضافة والإزالة وتوثيق مراجعة الإدارة المختصة. تغيير الاختيارات يلغي حالة المراجعة السابقة، ولا يمنح إتاحة عامة للبيانات.</p><a href="#/government">العودة إلى العرض الحكومي</a></section>
    {state.error && <p role="alert">{state.error}</p>}{state.loading && <p role="status">جار تحميل سجل العمل…</p>}
    {selection && <>
      <p role="status" data-testid="selection-admin-message">{message}</p><div className={s.adminActions}><strong data-testid="working-target-count">{targets.size} موقعًا مستهدفًا</strong><span>إصدار السجل: <bdi data-testid="selection-revision">{selection.revision}</bdi></span><span>{selection.review ? 'مراجعة موثقة في سجل العمل' : 'المراجعة لم تُسجّل'}</span><button data-testid="save-selection" disabled={saving || !dirty} onClick={() => send({action:'set-targets',targetIds:[...targets]})}>حفظ الاختيارات</button>{dirty && <span>احفظ تغييرات الاختيار قبل توثيق المراجعة أو القرار.</span>}</div>
      <div className={s.adminGrid}>
        <section className={s.panel}><div className={s.panelHead}><h3>قائمة المواقع</h3><input aria-label="البحث في إدارة الاختيار" placeholder="اسم الموقع أو معرف GIS" value={query} onChange={event => setQuery(event.target.value)}/></div><div className={s.adminSites}>{rows.map(row => <label key={row.zone_id}><input type="checkbox" data-target-id={row.zone_id} checked={targets.has(row.zone_id)} onChange={event => setTargets(previous => {const next = new Set(previous);event.target.checked ? next.add(row.zone_id) : next.delete(row.zone_id);return next;})}/><span>{row.site_name_ar}</span><bdi>GIS {row.zone_id}</bdi></label>)}</div></section>
        <div>
          <form className={`${s.panel} ${s.adminForm}`} data-testid="selection-review-form" onSubmit={event => {event.preventDefault();send({action:'record-review',review:review(new FormData(event.currentTarget))});}}><h3>تسجيل مراجعة الاختيارات</h3><p>يسجل المرجع والمراجع دون تحويل سجل العمل إلى بيانات عامة.</p><label>المراجع المخول<input name="reviewer" required/></label><label>مرجع قرار المراجعة<input name="document_ref" required/></label><label>تاريخ المراجعة<input name="reviewed_at" type="date" required/></label><button disabled={saving || dirty}>تسجيل المراجعة</button></form>
          <form className={`${s.panel} ${s.adminForm}`} data-testid="selection-approval-form" onSubmit={event => {event.preventDefault();send({action:'record-approval',approval:review(new FormData(event.currentTarget))});}}><h3>تسجيل قرار الإدارة المختصة</h3><p>يتاح بعد توثيق المراجعة. تسجيل القرار لا يغير نطاق الإتاحة الخاصة.</p><label>المسؤول المخول<input name="reviewer" required/></label><label>مرجع القرار<input name="document_ref" required/></label><label>تاريخ القرار<input name="reviewed_at" type="date" required/></label><button disabled={saving || dirty || selection.selection_status !== 'REVIEWED'}>تسجيل القرار</button></form>
          <form className={`${s.panel} ${s.adminForm}`} data-testid="assessment-form" onSubmit={event => {event.preventDefault();const form = new FormData(event.currentTarget);send({action:'record-assessment',zoneId:Number(form.get('zone_id')),assessment:{...review(form),source_status:'APPROVED_SOURCE',score:form.get('score') === '' ? null : Number(form.get('score')),classification:form.get('classification') || null}});}}><h3>تسجيل نتيجة من مصدر تقييم مؤهل</h3><p>لا تُحتسب درجات جديدة. تُنقل النتيجة كما وردت في مرجعها مع توثيق مسؤولية التسجيل.</p><label>الموقع<select name="zone_id" required>{state.data.rows.map(row => <option key={row.zone_id} value={row.zone_id}>{row.site_name_ar} · GIS {row.zone_id}</option>)}</select></label><label>درجة MCDA الواردة في المرجع<input name="score" type="number" min="0" max="100" step="any"/></label><label>التصنيف الوارد في المرجع<select name="classification"><option value="">غير متوفر</option>{['A','B','C'].map(value => <option key={value}>{value}</option>)}</select></label><label>المراجع المخول<input name="reviewer" required/></label><label>مرجع التقييم<input name="document_ref" required/></label><label>تاريخ المراجعة<input name="reviewed_at" type="date" required/></label><label><input type="checkbox" required/>أؤكد أن النتيجة مدونة في المرجع المحدد وأنني مخول بتسجيلها.</label><button disabled={saving}>تسجيل نتيجة موثقة</button></form>
        </div>
      </div>
    </>}
  </div></div>;
}
