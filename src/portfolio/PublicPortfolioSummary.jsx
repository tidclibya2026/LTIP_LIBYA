import {useEffect,useState} from 'react';
import {MapPinned,Target,Layers3} from 'lucide-react';
import {publicPortfolioSummary} from './portfolioSummary.js';
import s from './PublicPortfolioSummary.module.css';
const cards=[['sites','stat-visible','إجمالي مواقع التنمية السياحية',MapPinned],['targeted','stat-targeted','مواقع التنمية السياحية المستهدفة للاستثمار',Target],['other','stat-other','مواقع التنمية السياحية الأخرى',Layers3]];
export default function PublicPortfolioSummary({geo,entry=false}){
 const [state,setState]=useState({loading:true,available:false});
 useEffect(()=>{
  const controller=new AbortController();setState({loading:true,available:false});
  const read=async path=>{const response=await fetch(import.meta.env.BASE_URL+path,{signal:controller.signal,cache:'no-store'});if(!response.ok)throw Error('Unavailable');return response.json();};
  Promise.all([geo?Promise.resolve(geo):read('data/zones_141.geojson'),read('data/portfolio-summary.json')])
   .then(([national,summary])=>{if(!controller.signal.aborted)setState({loading:false,...publicPortfolioSummary(summary,national)});})
   .catch(()=>{if(!controller.signal.aborted)setState({loading:false,available:false});});
  return()=>controller.abort();
 },[geo]);
 return <section className={s.portfolio} dir="rtl" aria-labelledby="public-portfolio-heading" data-testid="public-portfolio-summary" data-status={state.loading?'loading':state.available?'available':'unavailable'}>
  <div className={s.heading}><div><p className={s.eyebrow}>المنصة الوطنية للخارطة الاستثمارية السياحية · ليبيا</p><h2 id="public-portfolio-heading">المحفظة الوطنية لمواقع التنمية السياحية</h2></div><span className={s.tag}>مؤشرات المحفظة</span></div>
  <div className={s.grid} aria-label="مؤشرات إجمالي المحفظة" aria-busy={state.loading}>
   {cards.map(([key,id,label,Icon])=><article className={`${s.card} ${key==='targeted'?s.targeted:''}`} key={key}>
    <div className={s.cardTop}><Icon size={20} strokeWidth={1.7} aria-hidden="true"/><span>{key==='sites'?'السجل الوطني':key==='targeted'?'اختيار فني':'بقية المحفظة'}</span></div>
    <strong className={s.number} data-testid={id} data-count={state.available?state[key]:undefined} aria-label={state.available?String(state[key]):'غير متوفر'}>{state.available?state[key].toLocaleString('ar-LY'):'—'}</strong><h3>{label}</h3>
   </article>)}
  </div>
  <p className={s.notice}>المواقع المستهدفة محددة وفق اختيار فني قابل للتحديث، ولا تمثل بالضرورة فرصًا معتمدة أو مطروحة للتعاقد، ولا يثبت إدراجها الجاهزية للاستثمار.</p>
  {state.loading?<p className={s.status} role="status">جار تحميل مؤشرات المحفظة…</p>:!state.available?<p className={s.unavailable} role="status" data-testid="portfolio-summary-unavailable">بيانات مؤشرات المحفظة غير متاحة حاليًا.</p>:<p className={s.status}>نشر الأعداد المجمعة فقط · آخر تحديث <time dateTime={state.updatedAt}>{state.updatedAt}</time></p>}
  {entry&&<div className={s.actions}><a href="#/portfolio">استعرض المواقع والخريطة<span aria-hidden="true"> ←</span></a><a href="#/map">الخارطة والطبقات الجغرافية</a></div>}
 </section>;
}
