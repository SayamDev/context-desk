import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
try {
  const env = await fs.readFile(path.join(root, '.env'), 'utf8');
  for (const line of env.split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }
} catch {}
const port = Number(process.env.PORT || 3000);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8'};

http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/guide') {
    let body = '';
    try {
      for await (const chunk of req) {
        body += chunk;
        if (body.length > 4_000_000) throw new Error('Image is too large.');
      }
      const {image, step, question} = JSON.parse(body);
      if (!process.env.MODEL_API_KEY) return send(res, 503, {error:'Add MODEL_API_KEY to .env to enable visual guidance.'});
      if (typeof image !== 'string' || !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image)) return send(res, 400, {error:'Take a camera snapshot first.'});
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      let upstream;
      try {
        upstream = await fetch('https://api.meta.ai/v1/chat/completions', {
          method:'POST', signal:controller.signal,
          headers:{Authorization:`Bearer ${process.env.MODEL_API_KEY}`,'Content-Type':'application/json'},
          body:JSON.stringify({model:'muse-spark-1.3-contributor',max_tokens:300,messages:[
            {role:'system',content:'You are a supportive makeup application coach. Give concise, practical technique feedback only for the requested makeup step. Describe only what is visibly supported; if the image is unclear, say so. Do not infer age, identity, health, skin condition, race, or attractiveness. Do not give medical advice. Reply in 2 short sentences maximum.'},
            {role:'user',content:[{type:'text',text:`Step: ${String(step || '').slice(0,100)}. User question: ${String(question || 'What should I adjust before moving on?').slice(0,300)}`},{type:'image_url',image_url:{url:image}}]}
          ]})
        });
      } finally { clearTimeout(timeout); }
      const data = await upstream.json().catch(() => ({}));
      if (!upstream.ok) return send(res, 502, {error:data?.error?.message || 'Meta API could not complete this request.'});
      return send(res, 200, {guidance:data?.choices?.[0]?.message?.content || 'No guidance returned. Try another snapshot.'});
    } catch (error) { return send(res, 400, {error:error.name === 'AbortError' ? 'The request timed out. Try again.' : error.message}); }
  }
  if (req.method !== 'GET') return send(res, 405, {error:'Method not allowed'});
  const url = new URL(req.url, `http://${req.headers.host}`);
  const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  if (!['index.html','app.js','style.css'].includes(file)) return send(res, 404, {error:'Not found'});
  try { const contents = await fs.readFile(path.join(root, 'public', file)); res.writeHead(200, {'Content-Type':types[path.extname(file)],'Cache-Control':'no-store'}); res.end(contents); }
  catch { send(res, 404, {error:'Not found'}); }
}).listen(port, '127.0.0.1', () => console.log(`Live Makeup Assistant: http://localhost:${port}`));

function send(res, status, data) { res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}); res.end(JSON.stringify(data)); }
