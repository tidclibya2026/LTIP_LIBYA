import { useEffect, useState } from 'react';

export default function useInvestmentSiteEnrichment() {
  const [state, setState] = useState({ zones: {}, loading: true, error: '' });
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}data/investment_site_enrichment.json`, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then(data => {
        if (data.schema_version !== 1 || !data.zones || Object.entries(data.zones).some(([id, site]) =>
          String(site.zone_id) !== id || site.approval?.status !== 'approved_phase2')) {
          throw new Error('سجل المواقع غير صالح');
        }
        setState({ zones: data.zones, loading: false, error: '' });
      })
      .catch(error => {
        if (error.name !== 'AbortError') setState({ zones: {}, loading: false, error: 'تعذر تحميل بيانات المواقع الاستثمارية' });
      });
    return () => controller.abort();
  }, []);
  return state;
}
