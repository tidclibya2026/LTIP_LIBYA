import { SCHEMA, SECTIONS, MAX_FILE_BYTES, MAX_TOTAL_BYTES, MAX_PACKAGE_BYTES, validateZone, validateManifest, validateFileInfo, sha256, safePublishedPath, extension } from '../../public/site-admin-model.js';

const DB = 'ltip-site-admin-v1';
const request = req => new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
const finished = tx => new Promise((resolve, reject) => { tx.oncomplete = resolve; tx.onabort = tx.onerror = () => reject(tx.error || Error('تعذر حفظ المعاملة')); });
export async function openStore() {
  if (!globalThis.indexedDB) throw Error('IndexedDB غير متاح؛ استخدم متصفحًا يدعمه لحفظ المسودات والمرفقات.');
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('zones', { keyPath: 'zone_id' }); req.result.createObjectStore('files', { keyPath: 'id' }); };
    req.onsuccess = () => { req.result.onversionchange = () => req.result.close(); resolve(req.result); };
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(Error('أغلق نوافذ الإدارة الأخرى ثم أعد المحاولة.'));
  });
}
export async function storageInfo() {
  if (!navigator.storage?.estimate) return { available: null };
  const estimate = await navigator.storage.estimate();
  return { available: Number.isFinite(estimate.quota) ? estimate.quota - estimate.usage : null };
}
export async function getDrafts() {
  const db = await openStore();
  try { return await request(db.transaction('zones').objectStore('zones').getAll()); } finally { db.close(); }
}
export async function getBlob(id) {
  const db = await openStore();
  try { return (await request(db.transaction('files').objectStore('files').get(id)))?.blob; } finally { db.close(); }
}
export async function verifyBytes(bytes, file) {
  if (bytes.byteLength !== file.size || await sha256(bytes) !== file.sha256) throw Error(`فشل فحص حجم أو بصمة ${file.name}`);
  const b = new Uint8Array(bytes); const ext = extension(file.name);
  const starts = (...values) => values.every((v, i) => b[i] === v);
  const text = (start, end) => new TextDecoder().decode(b.slice(start, end));
  if (ext === 'png' && !starts(137,80,78,71,13,10,26,10) || ['jpg','jpeg'].includes(ext) && !starts(255,216,255) || ext === 'pdf' && text(0,5) !== '%PDF-' || ext === 'webp' && !(text(0,4) === 'RIFF' && text(8,12) === 'WEBP') || ['tif','tiff'].includes(ext) && !(starts(73,73,42,0) || starts(77,77,0,42) || starts(73,73,43,0) || starts(77,77,0,43))) throw Error(`محتوى الملف لا يطابق امتداده: ${file.name}`);
  if (['geojson','json'].includes(ext)) {
    const geo = JSON.parse(new TextDecoder().decode(bytes));
    if (!['FeatureCollection','Feature','Polygon','MultiPolygon','LineString','MultiLineString','Point','MultiPoint','GeometryCollection'].includes(geo.type)) throw Error('ملف GeoJSON غير صالح');
  }
  if (ext === 'kml' && !/<(?:\w+:)?kml[\s>]/i.test(new TextDecoder().decode(bytes))) throw Error('ملف KML غير صالح');
}
export async function prepareFile(file, section, zoneId, existing) {
  if (file.size > MAX_FILE_BYTES) throw Error('الحد الأقصى للملف 20 ميغابايت');
  const meta = { id: crypto.randomUUID(), name: file.name, size: file.size, mime: file.type || 'application/octet-stream', sha256: '0'.repeat(64) };
  validateFileInfo(meta, section);
  const bytes = await file.arrayBuffer(); meta.sha256 = await sha256(bytes);
  if (existing.some(item => item.file?.sha256 === meta.sha256)) throw Error(`ملف مكرر داخل القسم: ${file.name}`);
  await verifyBytes(bytes, meta);
  return { item: { id: meta.id, zone_id: zoneId, title: file.name.replace(/\.[^.]+$/, ''), description: '', source: '', rights: '', approval_status: 'DRAFT', publication_clearance: 'UNREVIEWED', updated_at: new Date().toISOString(), file: meta, ...(section === 'studies_and_plans' ? { document_type: 'OTHER', study_status: 'UNVERIFIED', official_approval_status: 'UNVERIFIED' } : {}) }, blob: file };
}
async function persist(zones, blobs, allowedIds) {
  for (const zone of zones) validateZone(zone, allowedIds);
  const info = await storageInfo();
  let added = 0; for (const blob of blobs.values()) added += blob.size;
  if (added > MAX_TOTAL_BYTES || info.available !== null && added + 1024 * 1024 > info.available) throw Error('المساحة المحلية المتاحة لا تكفي؛ صدّر المسودات أو حرر مساحة.');
  const db = await openStore();
  try {
    const tx = db.transaction(['zones', 'files'], 'readwrite'); const done = finished(tx);
    // Read and write within one transaction so quota errors roll back metadata and files together.
    const files = tx.objectStore('files'); const drafts = tx.objectStore('zones');
    const list = files.getAll(); const zoneList = drafts.getAll();
    let fileRows, zoneRows;
    const write = () => {
      if (!fileRows || !zoneRows) return;
      const merged = new Map(zoneRows.map(zone => [zone.zone_id, zone]));
      for (const zone of zones) merged.set(zone.zone_id, zone);
      const attachmentIds = [...merged.values()].flatMap(zone => SECTIONS.flatMap(section => zone[section].map(item => item.id)));
      if (new Set(attachmentIds).size !== attachmentIds.length) { tx.abort(); return; }
      const referenced = new Set([...merged.values()].flatMap(zone => SECTIONS.flatMap(section => zone[section].filter(item => item.file).map(item => item.id))));
      const all = new Map(fileRows.filter(entry => referenced.has(entry.id)).map(entry => [entry.id, entry.blob]));
      for (const [id, blob] of blobs) all.set(id, blob);
      if ([...all.values()].reduce((sum, blob) => sum + blob.size, 0) > MAX_TOTAL_BYTES) { tx.abort(); return; }
      for (const zone of zones) drafts.put(zone);
      for (const entry of fileRows) if (!referenced.has(entry.id)) files.delete(entry.id);
      for (const [id, blob] of blobs) files.put({ id, blob });
    };
    list.onsuccess = () => { fileRows = list.result; write(); };
    zoneList.onsuccess = () => { zoneRows = zoneList.result; write(); };
    await done;
  } catch (error) {
    if (error.name === 'QuotaExceededError' || error.name === 'AbortError') throw Error('تعذر الحفظ: مساحة التخزين غير كافية أو أُلغيت المعاملة؛ لم تُحفظ بيانات جزئية.');
    throw error;
  } finally { db.close(); }
}
export const saveDraft = (zone, blobs, ids) => persist([zone], blobs, ids);
export async function resolveBlob(item, staged = new Map()) {
  let blob = staged.get(item.id) || await getBlob(item.id);
  if (!blob && safePublishedPath(item.file?.src)) {
    const response = await fetch(import.meta.env.BASE_URL + item.file.src);
    if (!response.ok) throw Error(`تعذر جلب الملف المنشور ${item.file.name}`);
    blob = await response.blob();
  }
  if (!blob) throw Error(`ملف المسودة مفقود: ${item.file?.name || item.title}`);
  return blob;
}
export async function exportPackage(zones, ids, staged = new Map()) {
  const files = [];
  for (const zone of zones) {
    validateZone(zone, ids);
    for (const section of SECTIONS) for (const item of zone[section]) if (item.file) {
      const blob = await resolveBlob(item, staged); await verifyBytes(await blob.arrayBuffer(), item.file);
      const base64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result.split(',')[1]); reader.onerror = reject; reader.readAsDataURL(blob); });
      const { src, ...metadata } = item.file; files.push({ ...metadata, base64 });
    }
  }
  const bundle = { schema_version: SCHEMA, kind: 'LTIP_SITE_ADMIN_PACKAGE', exported_at: new Date().toISOString(), zones, files };
  validateManifest(bundle, ids);
  return new Blob([JSON.stringify(bundle)], { type: 'application/json' });
}
export async function importPackage(file, ids, confirmReplace) {
  if (file.size > MAX_PACKAGE_BYTES) throw Error('حجم الحزمة يتجاوز 72 ميغابايت');
  const bundle = JSON.parse(await file.text()); validateManifest(bundle, ids);
  const blobs = new Map();
  for (const entry of bundle.files) {
    const raw = atob(entry.base64); const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    await verifyBytes(bytes.buffer, entry);
    blobs.set(entry.id, new Blob([bytes], { type: entry.mime }));
  }
  const existing = await getDrafts();
  const replaced = existing.filter(zone => bundle.zones.some(row => row.zone_id === zone.zone_id)).map(zone => zone.zone_id);
  if (replaced.length && !await confirmReplace(replaced)) return null;
  await persist(bundle.zones, blobs, ids);
  return bundle.zones;
}
