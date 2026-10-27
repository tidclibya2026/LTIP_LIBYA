import { readFile, writeFile, mkdir, stat, rename, lstat } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { validateManifest, validateZone, SECTIONS, MAX_PACKAGE_BYTES, isPublishable, extension } from '../public/site-admin-model.js';
import { verifyBytes } from '../src/admin/draftStore.js';

export async function reviewPackage(bundle, ids) {
  validateManifest(bundle, ids);
  const files = new Map();
  for (const entry of bundle.files) {
    const bytes = Buffer.from(entry.base64, 'base64');
    if (bytes.toString('base64') !== entry.base64) throw Error('ترميز غير قياسي');
    await verifyBytes(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), entry);
    files.set(entry.id, bytes);
  }
  const zones = {};
  for (const original of bundle.zones) {
    const zone = structuredClone(original);
    if (zone.review_status !== 'APPROVED' || zone.publication_clearance !== 'PUBLIC_CLEARED') throw Error(`الموقع ${zone.zone_id}: لم يعتمد للنشر العام`);
    for (const section of ['planning_data', 'descriptive_data', ...SECTIONS]) {
      const populated = SECTIONS.includes(section) ? zone[section].length : Object.values(zone[section]).some(v => v.trim());
      if (populated && zone.section_review[section] !== 'APPROVED') throw Error(`الموقع ${zone.zone_id}: القسم ${section} غير معتمد`);
      if (SECTIONS.includes(section)) for (const item of zone[section]) {
        if (!isPublishable(item)) throw Error(`المرفق ${item.id}: يلزم عنوان ومصدر وترخيص واعتماد للنشر`);
        if (item.file) item.file.src = `data/manual-assets/zone-${zone.zone_id}/${item.id}.${extension(item.file.name)}`;
      }
    }
    validateZone(zone, ids); zones[zone.zone_id] = zone;
  }
  return { zones, files };
}
// Fail closed for symlinks: never follow a public directory into an unrelated path.
async function noSymlinks(path, root) {
  let current = resolve(path);
  while (current.startsWith(root)) {
    try { if ((await lstat(current)).isSymbolicLink()) throw Error('مسار رمزي غير مسموح: ' + current); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    if (current === root) break;
    current = dirname(current);
  }
}
export async function mergePackage(packagePath, { root = resolve(fileURLToPath(new URL('..', import.meta.url))), apply = false, publicReviewed = false } = {}) {
  const publicRoot = join(root, 'public');
  const geoBytes = await readFile(join(publicRoot, 'data/zones_141.geojson'));
  const geo = JSON.parse(geoBytes); const ids = geo.features.map(f => f.properties.id);
  if (ids.length !== 141 || new Set(ids).size !== 141) throw Error('قاعدة المواقع يجب أن تحتوي على 141 معرفًا فريدًا');
  if ((await stat(packagePath)).size > MAX_PACKAGE_BYTES) throw Error('الحزمة تتجاوز 72 ميغابايت');
  const result = await reviewPackage(JSON.parse(await readFile(packagePath, 'utf8')), ids);
  const target = join(publicRoot, 'data/site_manual_enrichment.json');
  await noSymlinks(target, resolve(root));
  const current = JSON.parse(await readFile(target, 'utf8'));
  const next = { ...current, schema_version: 1, kind: 'LTIP_PUBLISHED_SITE_ENRICHMENT', zones: { ...current.zones, ...result.zones }, updated_at: new Date().toISOString() };
  const attachmentIds = new Set();
  for (const zone of Object.values(next.zones)) {
    validateZone(zone, ids);
    for (const section of SECTIONS) for (const item of zone[section]) {
      if (attachmentIds.has(item.id)) throw Error('معرف مرفق يتعارض مع موقع منشور آخر');
      attachmentIds.add(item.id);
    }
  }
  const writes = [];
  for (const zone of Object.values(result.zones)) for (const section of SECTIONS) for (const item of zone[section]) if (item.file) {
    const path = join(publicRoot, item.file.src); await noSymlinks(path, resolve(root));
    const bytes = result.files.get(item.id);
    try { if (createHash('sha256').update(await readFile(path)).digest('hex') !== item.file.sha256) throw Error('تعارض مع ملف منشور؛ استخدم معرفًا جديدًا'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
    writes.push({ path, bytes });
  }
  if (apply) {
    if (!publicReviewed) throw Error('يلزم --public-reviewed لتأكيد مراجعة السرية وحقوق النشر للحزمة كاملة');
    // Validate everything before writing. Publish metadata last; failed copies are never linked.
    for (const { path, bytes } of writes) { await mkdir(dirname(path), { recursive: true }); await writeFile(path, bytes, { flag: 'wx' }).catch(e => { if (e.code !== 'EEXIST') throw e; }); }
    const temporary = target + '.pending'; await noSymlinks(temporary, resolve(root)); await writeFile(temporary, JSON.stringify(next, null, 2), { flag: 'wx' }); await rename(temporary, target);
  }
  if (!geoBytes.equals(await readFile(join(publicRoot, 'data/zones_141.geojson')))) throw Error('تغير ملف GIS أثناء التنفيذ');
  return { mode: apply ? 'merged' : 'dry-run', zones: Object.keys(result.zones).length, files: writes.length, site_count: ids.length };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const path = process.argv.slice(2).find(x => !x.startsWith('--'));
  if (!path) { console.error('node scripts/merge-site-package.mjs PACKAGE.json [--apply --public-reviewed]'); process.exitCode = 1; }
  else mergePackage(resolve(path), { apply: process.argv.includes('--apply'), publicReviewed: process.argv.includes('--public-reviewed') }).then(console.log).catch(e => { console.error(e.message); process.exitCode = 1; });
}
