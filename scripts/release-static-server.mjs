import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
export function createPublicServer(root = resolve('dist')) {
root=resolve(root);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.geojson':'application/geo+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.csv':'text/csv; charset=utf-8'};
return createServer(async(req,res)=>{
 try {
  const url=new URL(req.url,'http://127.0.0.1');
  if(!['GET','HEAD'].includes(req.method)||!url.pathname.startsWith('/LTIP_LIBYA/')) {res.writeHead(404).end();return;}
  const part=decodeURIComponent(url.pathname.slice('/LTIP_LIBYA/'.length)) || 'index.html';
  const file=resolve(root,part);
  if(!file.startsWith(root+sep) || !(await stat(file)).isFile()) {res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':mime[extname(file)] || 'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}).end(req.method==='HEAD'?undefined:await readFile(file));
 } catch {res.writeHead(404).end();}
});
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
 const port=Number(process.env.LTIP_STATIC_PORT||5198);
 createPublicServer().listen(port,'127.0.0.1',()=>console.log(`Static Pages simulation: http://127.0.0.1:${port}/LTIP_LIBYA/`));
}
