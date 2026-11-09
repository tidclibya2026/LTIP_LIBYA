import { useEffect, useState } from 'react';
export default function useSiteLibrarySources() {
  const [state, setState] = useState({ manual: {}, legacy: {}, loading: true, error: '' });
  useEffect(() => {
    const controller = new AbortController();
    const names = ['site_manual_enrichment.json', 'zone_photos.json'];
    Promise.allSettled(names.map(async name => { const response = await fetch(`${import.meta.env.BASE_URL}data/${name}`, { signal: controller.signal }); if (!response.ok) throw Error(name); return response.json(); }))
      .then(results => { if (controller.signal.aborted) return; setState({ manual: results[0].status === 'fulfilled' ? results[0].value.zones || {} : {}, legacy: results[1].status === 'fulfilled' ? results[1].value : {}, loading: false, error: results.some(r => r.status === 'rejected') ? 'تعذر تحميل بعض مصادر المكتبة؛ قد تكون الأعداد غير مكتملة.' : '' }); });
    return () => controller.abort();
  }, []);
  return state;
}
