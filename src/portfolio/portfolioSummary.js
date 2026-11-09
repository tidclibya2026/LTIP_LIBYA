export const SUMMARY_STATUS='APPROVED_AGGREGATES_ONLY';
export const SUMMARY_KEYS=['schema_version','total_sites','targeted_sites','other_sites','updated_at','publication_status'];
export function nationalSiteCount(geo){
 if(geo?.type!=='FeatureCollection'||!Array.isArray(geo.features)||!geo.features.length)return null;
 const ids=geo.features.map(f=>f?.properties?.id);
 if(ids.some(id=>!Number.isSafeInteger(id)||id<=0)||new Set(ids).size!==ids.length)return null;
 return new Set(ids).size;
}
export function validSummaryDate(value){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const date=new Date(value+'T00:00:00Z');return Number.isFinite(+date)&&date.toISOString().slice(0,10)===value;
}
export function publicPortfolioSummary(value,geo){
 const unavailable={available:false};
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join('|')!==SUMMARY_KEYS.slice().sort().join('|'))return unavailable;
 const total=nationalSiteCount(geo);
 if(total===null||value.schema_version!==1||value.publication_status!==SUMMARY_STATUS||!validSummaryDate(value.updated_at))return unavailable;
 if(!['total_sites','targeted_sites','other_sites'].every(k=>Number.isSafeInteger(value[k])&&value[k]>=0))return unavailable;
 if(value.total_sites!==total||value.targeted_sites>total||value.other_sites!==total-value.targeted_sites)return unavailable;
 return {available:true,sites:total,targeted:value.targeted_sites,other:total-value.targeted_sites,updatedAt:value.updated_at};
}
