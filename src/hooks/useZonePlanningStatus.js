import { useEffect, useState } from 'react';
import { validatePlanningData } from '../../public/planning-status.js';

export default function useZonePlanningStatus() {
  const [state, setState] = useState({ zones: {}, loading: true, error: '' });
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}data/zone_planning_status_141.json`, { signal: controller.signal })
      .then(response => { if (!response.ok) throw Error(`HTTP ${response.status}`); return response.json(); })
      .then(data => setState({ zones: validatePlanningData(data), loading: false, error: '' }))
      .catch(error => {
        if (error.name !== 'AbortError') setState({ zones: {}, loading: false, error: 'تعذر تحميل الوضع التخطيطي؛ البيانات غير متحققة.' });
      });
    return () => controller.abort();
  }, []);
  return state;
}
