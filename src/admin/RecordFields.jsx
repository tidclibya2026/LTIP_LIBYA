import { useState } from 'react';
import { Copy } from 'lucide-react';
import { FIELDS } from '../../public/admin-dashboard-model.js';

// Presentation only. All values still enter the existing handlers as strings.
const longFields = new Set(['description','planning_notes','property_documents','property_constraints','development','constraints','readiness_criteria','potential_opportunities','requirements','feasibility','master_plan','detailed_plan','environmental_study','engineering_study','infrastructure','risks','legal_basis','nature','management','investment','needs']);
export function fieldInputType(field, value = '') {
 if (field === 'decision_date' && (!value || /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value)) return 'date';
 if (['amount','capacity'].includes(field) && (!value || /^-?\d+(?:\.\d+)?$/.test(value))) return 'number';
 return longFields.has(field) ? 'textarea' : 'text';
}
export function DataFields({ fields, row, onEdit }) {
 return <div className="field-grid primary-fields">{Object.entries(fields).map(([field,label]) => {
  const type = fieldInputType(field, row.data[field]);
  const props = { 'data-field': field, value: row.data[field] || '', placeholder: 'غير مكتمل', maxLength: 12000, onChange: e => onEdit(field,e.target.value) };
  return <label className="primary-field" key={field}>{label}{type === 'textarea' ? <textarea {...props}/> : <input {...props} type={type} {...(type === 'number' ? { step: 'any' } : {})}/>}</label>;
 })}</div>;
}
export function EvidenceFields({ row, onEdit }) {
 return <section className="record-evidence" aria-label="توثيق الحقول الأصلية"><p>مصدر وتحقق وملاحظات مستقلة لكل حقل. تعديل قيمة الحقل أو مصدره يلغي التحقق وفق الآلية الحالية.</p>{Object.entries(FIELDS[row.type]).filter(([,fields]) => Object.keys(fields).length).map(([group,fields]) => <section className="evidence-group" key={group}><h3>{group}</h3><div className="evidence-list">{Object.entries(fields).map(([field,label]) => <section className="evidence-row" data-evidence={field} key={field}><h4>{label}</h4><div className="evidence-controls"><label>مصدر المعلومة<input type="text" data-source={field} maxLength={12000} value={row.evidence[field]?.source || ''} onChange={e => onEdit(field,'source',e.target.value)}/></label><label>حالة التحقق<select data-verification={field} value={row.evidence[field]?.verification || 'UNVERIFIED'} onChange={e => onEdit(field,'verification',e.target.value)}><option value="UNVERIFIED">غير متحقق</option><option value="VERIFIED">تم التحقق من المصدر</option><option value="REJECTED">مرفوض</option></select></label><label>ملاحظات المراجع للحقل<textarea data-notes={field} maxLength={12000} value={row.evidence[field]?.notes || ''} onChange={e => onEdit(field,'notes',e.target.value)}/></label></div>{row.evidence[field]?.entered_at && <small>{row.evidence[field].entered_at}</small>}</section>)}</div></section>)}</section>;
}
export function RecordIdentifier({ id, site = false }) {
 const [message,setMessage] = useState('');
 const copy = async () => { try { await navigator.clipboard.writeText(id); setMessage('تم النسخ'); } catch { setMessage('تعذر النسخ؛ يمكنك تحديد المعرف ونسخه يدويًا'); } };
 return <span className="record-identifier"><span className={site ? 'site-id' : 'record-uuid'} dir="ltr">{site ? 'zone_id: ' : 'UUID: '}{id}</span><button type="button" onClick={copy} aria-label="نسخ معرف السجل"><Copy aria-hidden="true"/>نسخ المعرف</button><small aria-live="polite">{message}</small></span>;
}
