import fs from 'node:fs';
import vm from 'node:vm';

const file = 'public/investment-cards.html';

if (!fs.existsSync(file)) {
  throw Error('ملف بطاقات الاستثمار غير موجود');
}

const original = fs.readFileSync(file, 'utf8');

if (original.includes('LTIP_PRINT_V8')) {
  console.log('V8 already installed');
  process.exit(0);
}

const scriptPattern =
  /<script\s+id="LTIP_PRINT_V7">([\s\S]*?)<\/script>/;

const match = original.match(scriptPattern);

if (!match) {
  throw Error('V7 غير موجود. لم يتم تعديل أي ملف');
}

let js = match[1];

function replaceOnce(oldText, newText, label) {
  const first = js.indexOf(oldText);

  if (first < 0 || js.indexOf(oldText, first + 1) >= 0) {
    throw Error('تعذر تعديل ' + label + ' بأمان');
  }

  js = js.replace(oldText, newText);
}

// خريطة أكبر تُظهر نطاق ليبيا بالكامل تقريبًا
replaceOnce(
  'const zoom = 4, width = 340, height = 155;',
  'const zoom = 4, width = 340, height = 220;',
  'map dimensions'
);

// مركز العرض العام لدولة ليبيا
replaceOnce(
  'const center = project(27, 17, zoom);',
  'const center = project(26.3, 17.2, zoom);',
  'map center'
);

// تحسين مظهر الصفحة والخريطة والصورة
const css = `
/* LTIP_PRINT_V8 */
@page {
  size: A4 portrait;
  margin: 10mm;
}

.sheet {
  width: 100%;
  margin: 0;
  overflow: visible;
}

.official-head {
  padding: 15px 12px;
  font-size: 15px;
  line-height: 1.75;
}

.official-head strong {
  font-size: 18px;
}

.document-title {
  font-size: 17px;
  padding: 12px;
}

.card-head {
  padding: 12px 15px;
}

.card-head h2 {
  font-size: 20px;
}

.card-head small {
  font-size: 12px;
}

.grade {
  font-size: 13px;
  padding: 7px 14px;
}

.visuals {
  grid-template-columns: minmax(0,1fr) minmax(0,1fr);
  gap: 12px;
  padding: 13px 15px;
}

.visual-title {
  font-size: 12px;
  margin-bottom: 7px;
}

.map {
  height: 220px;
  width: 340px;
  max-width: 100%;
}

.site-photo {
  height: 190px;
  object-fit: cover;
  object-position: center;
}

.photo-caption {
  font-size: 10px;
  line-height: 1.5;
  min-height: 27px;
}

.pin {
  width: 20px;
  height: 20px;
  border: 4px solid #fff;
  background: #e11d2e;
  box-shadow:
    0 0 0 3px #e11d2e,
    0 0 0 7px rgba(225,29,46,.18);
  z-index: 10;
}

.map-title {
  font-size: 10px;
  font-weight: bold;
}

.fields {
  gap: 0 15px;
  padding: 7px 15px;
}

.field {
  padding: 8px 0;
}

.field label {
  font-size: 10px;
  margin-bottom: 4px;
}

.field strong {
  font-size: 12px;
}

.note {
  font-size: 10px;
  line-height: 1.65;
  padding: 10px;
  margin: 9px 15px;
}

.official-foot {
  padding: 12px;
  font-size: 13px;
}

@media print {
  html, body {
    width: auto;
    height: auto;
    margin: 0;
    padding: 0;
  }

  .sheet {
    break-inside: avoid;
    page-break-inside: avoid;
  }

  .sheet:not(:last-child) {
    break-after: page;
    page-break-after: always;
  }

  .sheet:last-child {
    break-after: auto;
    page-break-after: auto;
  }

  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
`;

// إضافة CSS إلى نظام V7 الموجود دون إنشاء مستمع طباعة ثانٍ
const addition =
  '\n  const v8Styles = ' +
  JSON.stringify(css) +
  ';\n\n  ';

replaceOnce(
  '  function makeDocument(cards, geo, photos) {',
  addition + 'function makeDocument(cards, geo, photos) {',
  'V8 styles'
);

replaceOnce(
  "'<style>' + styles + '</style></head><body>'",
  "'<style>' + styles + v8Styles + '</style></head><body>'",
  'print stylesheet'
);

// تحديث اسم الإصدار في سجل المتصفح
replaceOnce(
  "console.log('LTIP_PRINT_V7 ACTIVE');",
  "console.log('LTIP_PRINT_V8 ACTIVE');",
  'version'
);

// التحقق من صحة JavaScript قبل تعديل الملف
new vm.Script(js, {
  filename: 'LTIP_PRINT_V8.js'
});

const updated = original.replace(
  scriptPattern,
  '<script id="LTIP_PRINT_V7">' + js + '</script>'
);

if (!updated.includes('LTIP_PRINT_V8')) {
  throw Error('V8 verification failed');
}

// حفظ نسخة احتياطية ثم كتابة الملف
fs.copyFileSync(file, file + '.before_v8.bak');
fs.writeFileSync(file, updated, 'utf8');

console.log('SUCCESS: LTIP PRINT V8 INSTALLED');
console.log('Map: 340 x 220');
console.log('Photo: 190px height');
console.log('Official header: preserved');
console.log('Official footer: preserved');
console.log('GIS and investment data: unchanged');
