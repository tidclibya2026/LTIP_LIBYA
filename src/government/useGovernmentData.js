import {useEffect, useState} from 'react';
import {makeRows, PRIVATE_PRESENTATION} from './model.js';
export default function useGovernmentData({privateMode=PRIVATE_PRESENTATION}={}) {
  const [state, setState] = useState({loading: true, error: '', data: null});
  useEffect(() => {
    const controller = new AbortController();
    const read = async path => {
      const response = await fetch(import.meta.env.BASE_URL + path, {signal: controller.signal, cache: 'no-store'});
      if (!response.ok) throw Error('تعذر تحميل بيانات الخارطة');
      return response.json();
    };
    const load = async () => {
      const [geo, enrichment, context, privateData] = await Promise.all([
        read('data/zones_141.geojson'), read('data/investment_site_enrichment.json'), read('data/libya-context.geojson'),
        PRIVATE_PRESENTATION&&privateMode ? read('private-api/presentation') : Promise.resolve(null)
      ]);
      return {geo, rows: makeRows(geo, enrichment, privateData), context, privateData, hasSelection: privateData !== null};
    };
    load().then(data => { if (!controller.signal.aborted) setState({loading: false, error: '', data}); }).catch(error => { if (!controller.signal.aborted) setState({loading: false, error: error.message, data: null}); });
    return () => controller.abort();
  }, [privateMode]);
  return state;
}
