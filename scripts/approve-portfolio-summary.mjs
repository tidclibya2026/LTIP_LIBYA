// Explicit scalar-only publication step. Never reads a private store or session.
import {readFile,writeFile} from 'node:fs/promises';
import {nationalSiteCount,publicPortfolioSummary,SUMMARY_STATUS,validSummaryDate} from '../src/portfolio/portfolioSummary.js';
const args=process.argv.slice(2),allowed=new Set(['--targeted','--updated-at','--approve-aggregates-only','--dry-run']);
const options={};
for(let i=0;i<args.length;i++){
 const key=args[i];if(!allowed.has(key)||Object.hasOwn(options,key))throw Error('Unknown or duplicate argument');
 if(key==='--targeted'||key==='--updated-at'){if(!args[i+1]||args[i+1].startsWith('--'))throw Error('Missing scalar argument');options[key]=args[++i];}
 else options[key]=true;
}
if(!options['--approve-aggregates-only'])throw Error('Explicit aggregate publication approval flag is required');
if(!/^\d+$/.test(options['--targeted']||'')||!validSummaryDate(options['--updated-at']))throw Error('An approved scalar count and valid update date are required');
const geo=JSON.parse(await readFile('public/data/zones_141.geojson','utf8')),total=nationalSiteCount(geo),targeted=Number(options['--targeted']);
const summary={schema_version:1,total_sites:total,targeted_sites:targeted,other_sites:total-targeted,updated_at:options['--updated-at'],publication_status:SUMMARY_STATUS};
if(!publicPortfolioSummary(summary,geo).available)throw Error('Approved aggregate does not match national GIS');
const json=JSON.stringify(summary,null,2)+'\n';
if(options['--dry-run'])process.stdout.write(json);else{await writeFile('public/data/portfolio-summary.json',json,'utf8');console.log('Updated approved aggregate summary only; review diff and run release checks before publication.');}
