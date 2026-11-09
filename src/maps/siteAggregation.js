// Presentation anchors are existing polygon vertices, never replacement GIS geometry.
export function siteAnchor(feature) {
 const vertices=[];
 const walk=v=>{if(typeof v[0]==='number')vertices.push(v);else v.forEach(walk);};
 walk(feature.geometry.coordinates);
 const xs=vertices.map(v=>v[0]),ys=vertices.map(v=>v[1]);
 const x=(Math.min(...xs)+Math.max(...xs))/2,y=(Math.min(...ys)+Math.max(...ys))/2;
 return vertices.reduce((a,b)=>(b[0]-x)**2+(b[1]-y)**2<(a[0]-x)**2+(a[1]-y)**2?b:a);
}

// Nearest-pair merges form a deterministic hierarchy. Zooming increases separation
// and stops the same hierarchy earlier. Counts partition the filtered identities.
export function aggregateSites(entries,project,radius=50) {
 const groups=entries.slice().sort((a,b)=>a.id-b.id).map(item=>{
  const p=project(item.anchor);return {ids:[item.id],x:p.x,y:p.y};
 });
 while(groups.length>1){
  let distance=radius*radius,pair=null;
  for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++){
   const d=(groups[i].x-groups[j].x)**2+(groups[i].y-groups[j].y)**2;
   if(d<distance){distance=d;pair=[i,j];}
  }
  if(!pair)break;
  const [i,j]=pair,a=groups[i],b=groups[j],n=a.ids.length+b.ids.length;
  groups[i]={ids:[...a.ids,...b.ids].sort((a,b)=>a-b),x:(a.x*a.ids.length+b.x*b.ids.length)/n,y:(a.y*a.ids.length+b.y*b.ids.length)/n};
  groups.splice(j,1);
 }
 return groups;
}
