import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
export async function runParkMapTests({call,evaluate,delay}) {
 const wait=async expr=>{for(let i=0;i<160;i++){if(await evaluate(expr))return;await delay(50);}throw Error('Park UI timeout: '+expr);};
 const shape=(kind,count)=>wait(`document.querySelectorAll('.park-shape-${kind}').length===${count}`);
 const toggle=async kind=>{await evaluate(`document.querySelector('[data-park-toggle="${kind}"] input').click()`);await delay(50);};
 const output='.local-release-prep/results';await mkdir(output,{recursive:true});
 await wait(`document.querySelectorAll('.investment-zone-shape').length===141`);await shape('national',33);await shape('public',185);
 assert.equal(await evaluate(`document.querySelector('[data-national-count]').textContent.includes('27')&&document.querySelector('[data-national-count]').textContent.includes('33')`),true);
 await toggle('public');await shape('public',0);await shape('national',33);
 await toggle('national');await shape('national',0);assert.equal(await evaluate(`document.querySelectorAll('.investment-zone-shape').length`),141);
 await toggle('public');await shape('public',185);await toggle('national');await shape('national',33);
 await toggle('theme');await shape('theme',1);
 const colors=await evaluate(`['national','public','theme'].map(k=>document.querySelector('.park-shape-'+k).getAttribute('stroke'))`);assert.equal(new Set(colors).size,3);
 assert.equal(await evaluate(`document.querySelectorAll('[data-park-toggle] svg').length`),3);
 await evaluate(`document.querySelectorAll('.sidebar-tabs button')[1].click()`);await wait(`document.querySelectorAll('.zones .zone').length===219`);
 assert.equal(await evaluate(`document.querySelectorAll('.zones .zone .park-result-name small').length`),219);
 const cards=[];
 for(const [kind,file,key] of [['national','public/data/parks/public/national-parks.geojson','PART_ID'],['public','public/data/parks/public/public-gardens.geojson','NTG_ID'],['theme','public/data/parks/FD_THEME_PARK_1.geojson','NTG_ID']]) {
  const data=JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/,'')),id=data.features[0].properties[key];
  await evaluate(`[...document.querySelectorAll('.zones .zone')].find(e=>e.querySelector('.park-result-name small')?.textContent.startsWith(${JSON.stringify(id+' · ')})).click()`);
  await wait(`!!document.querySelector('[data-park-card="${kind}"]')`);
  const text=await evaluate(`document.querySelector('[data-park-card="${kind}"]').textContent`);
  assert.ok(text.includes(id));assert.ok(!/INTERNAL|HOLD|VERIFICATION|SOURCE_ORG|Master Plans/.test(text));
  if(kind==='national') assert.ok(text.includes('LY-PARK-001')&&text.includes('جهاز المنتزهات الوطنية'));
  if(kind==='public') assert.ok(text.includes('الحدائق العامة')&&!text.includes('معرف المنتزه الوطني'));
  cards.push({kind,id});
 }
 // Verify the actual Leaflet path click, beyond the sidebar selection.
 await evaluate(`document.querySelector('.park-shape-national').dispatchEvent(new MouseEvent('click',{bubbles:true,clientX:300,clientY:300}))`);
 await wait(`!!document.querySelector('[data-park-card="national"]')`);
 await toggle('national');await shape('national',0);assert.equal(await evaluate(`!!document.querySelector('[data-park-card=national]')`),false);await shape('public',185);
 await toggle('national');await shape('national',33);
 for(const width of [1440,390]) {
  await call('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});await delay(100);
  assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true);
  await evaluate(`document.querySelector('#ltip-layers').open=true;document.querySelector('#ltip-layers').scrollIntoView()`);
  const shot=await call('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(`${output}/parks-public-${width}.png`,Buffer.from(shot.data,'base64'));
 }
 await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await evaluate(`document.querySelectorAll('.sidebar-tabs button')[0].click()`);await wait(`document.querySelectorAll('.zones .zone').length===141`);
 const result={nationalFeatures:33,nationalParkIds:27,gardenFeatures:185,themeFeatures:1,investmentFeatures:141,independentToggleChecks:true,distinctColors:colors,cards,leafletPathClick:true,noPublicationStatesInCards:true,viewports:[1440,390]};
 await writeFile(`${output}/parks-public-browser.json`,JSON.stringify(result,null,2));console.log('PASS park map: 33/27 national + 185 gardens + 1 theme, independent toggles and colors/icons, actual Leaflet click, safe cards, 141 investment features retained.');
}
