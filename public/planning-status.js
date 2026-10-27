export const PLANNING_CATEGORIES = Object.freeze({ MAPPED: 'مُخرَّط', CLASSIFIED: 'مُصنَّف', UNVERIFIED: 'غير محدد' });
export const PLANNING_TITLE = 'التصنيف والوضع التخطيطي للموقع';
const unknown = 'غير متحقق';
const statuses = { YES: 'نعم', NO: 'لا', PARTIAL: 'جزئي', UNVERIFIED: unknown };
const documentTypes = { FEASIBILITY_STUDY: 'دراسة جدوى', MASTER_PLAN: 'مخطط عام', DETAILED_PLAN: 'مخطط تفصيلي', OTHER_STUDY: 'دراسة أخرى' };
const verified = evidence => evidence?.verification_status === 'VERIFIED' && evidence.source_document && evidence.locator && evidence.match_basis;
const reference = evidence => verified(evidence) && `${evidence.source_document} (${evidence.locator})`;

export function planningCategory(record) {
  return verified(record?.planning_category_evidence) && ['MAPPED', 'CLASSIFIED'].includes(record?.planning_category)
    ? record.planning_category : 'UNVERIFIED';
}

export function planningFields(record) {
  const category = planningCategory(record);
  const decision = record?.tourism_designation_decision;
  const decisionVerified = verified(decision);
  const studiesVerified = record?.verification_status === 'VERIFIED' && record?.document_references?.length > 0;
  const references = [
    reference(record?.planning_category_evidence),
    reference(decision),
    reference(record?.tourism_master_plan_evidence),
    ...(studiesVerified ? record.document_references.map(ref => `${documentTypes[ref.document_type] || ref.document_type}: ${ref.title} — ${ref.source_document} (${ref.locator})`) : []),
  ].filter(Boolean);
  return [
    ['تصنيف الموقع', PLANNING_CATEGORIES[category] + (category === 'UNVERIFIED' ? ' — غير متحقق' : category === 'CLASSIFIED' ? ' (التسمية التاريخية: محدد لغرض التخريط)' : '')],
    ['قرار إضفاء الصبغة السياحية', decisionVerified ? 'متحقق' : unknown],
    ['رقم القرار وتاريخه', decisionVerified ? `${decision.decision_number || unknown} — ${decision.decision_date || unknown}` : unknown],
    ['الجهة المصدرة', decisionVerified ? decision.issuing_authority || unknown : unknown],
    ['ضمن المخطط العام للتنمية السياحية', verified(record?.tourism_master_plan_evidence) ? statuses[record.in_tourism_master_plan] || unknown : unknown],
    ['حالة إنجاز الدراسات والمخططات', studiesVerified ? statuses[record.studies_and_plans_status] || unknown : unknown],
    ['الدراسات (ومنها دراسة الجدوى)', studiesVerified && record.study_names?.length ? record.study_names.join('، ') : unknown],
    ['المخططات العامة والتفصيلية', studiesVerified && record.plan_names?.length ? record.plan_names.join('، ') : unknown],
    ['مراجع الوثائق المتاحة', [...new Set(references)].join('؛ ') || unknown],
  ];
}

export function validatePlanningData(data) {
  const indexed = data?.schema_version === 2 && data.zones && typeof data.zones === 'object' && !Array.isArray(data.zones);
  const rows = indexed ? Object.values(data.zones) : data?.schema_version === 1 && Array.isArray(data.zones) ? data.zones : [];
  if (rows.length !== 141 || new Set(rows.map(row => row.zone_id)).size !== 141 ||
      (indexed && Object.entries(data.zones).some(([key, row]) => key !== String(row.zone_id)))) throw Error('سجل الوضع التخطيطي غير مكتمل أو مكرر');
  const required = (condition, field) => { if (!condition) throw Error(`بيانات تخطيط غير صالحة: ${field}`); };
  const historicalFields = ['historical_record_id', 'historical_number', 'site_name_raw', 'historical_group_raw', 'area_raw', 'area_ha_source', 'mapping_status_raw', 'decision_raw', 'decision_number_from_register', 'decision_date_raw', 'decision_verification', 'review_notes'];
  if (indexed) {
    required(typeof data.source_document === 'string' && data.source_document.trim(), 'source_document');
    required(/^[a-f0-9]{64}$/i.test(data.source_sha256), 'source_sha256');
    required(typeof data.generated_at === 'string' && !Number.isNaN(Date.parse(data.generated_at)), 'generated_at');
    const confirmedIds = rows.filter(row => row.gis_match_status === 'CONFIRMED').map(row => row.historical_record_id);
    required(new Set(confirmedIds).size === confirmedIds.length, 'duplicate historical_record_id');
  }
  const checkEvidence = (value, field) => {
    required(value && ['VERIFIED', 'UNVERIFIED'].includes(value.verification_status), field);
    for (const key of ['source_document', 'locator', 'match_basis']) required(value[key] === null || (typeof value[key] === 'string' && value[key].trim()), `${field}.${key}`);
    if (value.verification_status === 'VERIFIED') required(verified(value), field);
  };
  for (const row of rows) {
    required(Number.isInteger(row.zone_id) && row.zone_id > 0, 'zone_id');
    if (indexed) {
      required(['CONFIRMED', 'CANDIDATE', 'CONFLICT', 'UNMATCHED'].includes(row.gis_match_status), 'gis_match_status');
      if (row.gis_match_status === 'CONFIRMED') {
        for (const key of historicalFields) required(Object.hasOwn(row, key), key);
        required(/^HIST-MAPPED-\d{3}(?:-B)?$/.test(row.historical_record_id), 'historical_record_id');
        required(row.historical_number === null || Number.isInteger(row.historical_number), 'historical_number');
        for (const key of ['site_name_raw', 'historical_group_raw', 'area_raw', 'decision_raw', 'review_notes']) required(typeof row[key] === 'string', key);
        required(Number.isFinite(row.area_ha_source) && row.area_ha_source > 0, 'area_ha_source');
        required(row.decision_verification === (row.decision_raw.trim() ? 'REGISTER_REFERENCE_ONLY' : 'NO_DECISION_IN_REGISTER'), 'decision_verification');
        required(row.historical_match_evidence?.basis && row.historical_match_evidence?.references?.length, 'historical_match_evidence');
        required(row.tourism_designation_decision?.verification_status !== 'VERIFIED' || row.tourism_designation_decision?.source_document !== data.source_document, 'register is not legal verification');
      } else {
        required(historicalFields.every(key => !Object.hasOwn(row, key)), 'unconfirmed historical attachment');
      }
    }
    required(Object.hasOwn(PLANNING_CATEGORIES, row.planning_category), 'planning_category');
    checkEvidence(row.planning_category_evidence, 'planning_category_evidence');
    if (row.planning_category !== 'UNVERIFIED') required(verified(row.planning_category_evidence), 'planning_category evidence');
    const decision = row.tourism_designation_decision;
    checkEvidence(decision, 'tourism_designation_decision');
    for (const key of ['decision_number', 'decision_date', 'issuing_authority']) required(decision[key] === null || (typeof decision[key] === 'string' && decision[key].trim()), key);
    if (decision.decision_date !== null) required(/^\d{4}-\d{2}-\d{2}$/.test(decision.decision_date) && !Number.isNaN(Date.parse(decision.decision_date)) && new Date(decision.decision_date).toISOString().slice(0, 10) === decision.decision_date, 'decision_date');
    if (decision.verification_status === 'VERIFIED') required(decision.decision_number && decision.decision_date && decision.issuing_authority, 'verified decision');
    required(['YES', 'NO', 'UNVERIFIED'].includes(row.in_tourism_master_plan), 'in_tourism_master_plan');
    checkEvidence(row.tourism_master_plan_evidence, 'tourism_master_plan_evidence');
    if (row.in_tourism_master_plan !== 'UNVERIFIED') required(verified(row.tourism_master_plan_evidence), 'master plan evidence');
    required(['YES', 'PARTIAL', 'NO', 'UNVERIFIED'].includes(row.studies_and_plans_status), 'studies_and_plans_status');
    required(['VERIFIED', 'UNVERIFIED'].includes(row.verification_status), 'verification_status');
    for (const key of ['study_names', 'plan_names']) required(Array.isArray(row[key]) && row[key].every(name => typeof name === 'string' && name.trim()), key);
    required(Array.isArray(row.document_references), 'document_references');
    for (const ref of row.document_references) {
      required(Object.hasOwn(documentTypes, ref.document_type), 'document_type');
      for (const key of ['title', 'source_document', 'locator', 'match_basis']) required(typeof ref[key] === 'string' && ref[key].trim(), `document_references.${key}`);
    }
    if (row.studies_and_plans_status !== 'UNVERIFIED' || row.verification_status === 'VERIFIED') required(row.verification_status === 'VERIFIED' && row.document_references.length > 0, 'studies evidence');
    if (['YES', 'PARTIAL'].includes(row.studies_and_plans_status)) required(row.study_names.length + row.plan_names.length > 0, 'study/plan names');
  }
  return Object.fromEntries(rows.map(row => [String(row.zone_id), row]));
}
