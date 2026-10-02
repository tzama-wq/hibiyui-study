// 開発用: Firebase Realtime Database の REST 互換ミニサーバー(メモリ保存)。 node scripts/mock-db.mjs
import http from 'node:http';
const db = {};
http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  const path = decodeURIComponent(req.url.split('?')[0]).replace(/\.json$/, '').split('/').filter(Boolean);
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    let node = db;
    if (req.method === 'PUT') {
      for (const k of path.slice(0, -1)) node = node[k] = node[k] || {};
      node[path.at(-1)] = JSON.parse(body);
      res.writeHead(200); return res.end(body);
    }
    for (const k of path) node = node?.[k];
    res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(node ?? null));
  });
}).listen(8787, () => console.log('mock db http://localhost:8787'));
