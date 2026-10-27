import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
const root=resolve('dist');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.geojson':'application/geo+json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.csv':'text/csv; charset=utf-8'};
createServer(async(req,res)=>{
 try {
  const url=new URL(req.url,'http://127.0.0.1');
  if(!url.pathname.startsWith('/LTIP_LIBYA/')) {res.writeHead(404).end();return;}
  const part=decodeURIComponent(url.pathname.slice('/LTIP_LIBYA/'.length)) || 'index.html';
  const file=resolve(root,part);
  if(!file.startsWith(root+sep) || !(await stat(file)).isFile()) {res.writeHead(404).end();return;}
  res.writeHead(200,{'Content-Type':mime[extname(file)] || 'application/octet-stream','Cache-Control':'no-store'}).end(await readFile(file));
 } catch {res.writeHead(404).end();}
}).listen(5198,'127.0.0.1',()=>console.log('Static Pages simulation on /LTIP_LIBYA/ (no SPA fallback)'));
