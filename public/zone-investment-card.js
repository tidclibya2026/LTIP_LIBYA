// Same-origin adapter: preserve the original V8 page and its print handlers.
const status = document.getElementById('status');
const frame = document.getElementById('card-frame');
const zoneId = new URLSearchParams(location.search).get('zone');

async function openCard() {
  if (!zoneId) throw Error('لم يُحدد معرّف المنطقة.');
  const response = await fetch(new URL('./data/zones_141.geojson', location.href));
  if (!response.ok) throw Error('تعذر التحقق من بيانات المنطقة.');
  const geo = await response.json();
  if (!geo.features.some(feature => String(feature.properties?.id) === zoneId)) {
    throw Error('معرّف المنطقة غير موجود في السجل.');
  }

  frame.addEventListener('load', () => {
    const doc = frame.contentDocument;
    const cards = doc?.getElementById('cards');
    if (!cards) { status.textContent = 'تعذر فتح صفحة البطاقة.'; return; }
    // V8 prints the original card DOM. Never rebuild its fields or print styles.
    const observer = new MutationObserver(selectCard);
    const timeout = setTimeout(() => {
      observer.disconnect();
      status.textContent = 'تعذر تجهيز البطاقة. يرجى إعادة تحميل الصفحة والمحاولة مجددًا.';
    }, 30000);
    function selectCard() {
      const items = [...cards.querySelectorAll('.card')];
      if (!items.length) {
        if (cards.textContent.trim()) {
          observer.disconnect(); clearTimeout(timeout);
          status.textContent = cards.textContent;
        }
        return;
      }
      const selected = items.find(card => card.dataset.id === zoneId);
      observer.disconnect(); clearTimeout(timeout);
      if (!selected) { status.textContent = 'تعذر العثور على بطاقة المنطقة.'; return; }
      items.forEach(card => { if (card !== selected) card.remove(); });
      const counter = doc.getElementById('counter');
      if (counter) counter.textContent = 'المعروض: ' + cards.querySelectorAll('.card').length;
      // Hide filters to prevent a re-render restoring the complete card list.
      const controls = doc.getElementById('search')?.closest('section');
      if (controls) controls.hidden = true;
      status.textContent = '';
      status.hidden = true;
      frame.hidden = false;
    }
    observer.observe(cards, { childList: true, subtree: true });
    selectCard();
  }, { once: true });
  frame.src = new URL('./investment-cards.html', location.href).href;
}

openCard().catch(error => { status.textContent = error.message; });
