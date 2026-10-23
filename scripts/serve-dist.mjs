import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';

export async function serveDist(directory = 'dist', listen = {}) {
  const root = resolve(directory);
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.pdf': 'application/pdf', '.woff2': 'font/woff2' };
  const server = createServer(async (req, res) => {
    try {
      let path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      path = path.replace(/^\/jev-presentation(?=\/|$)/, '');
      const file = resolve(root, '.' + (path.endsWith('/') ? path + 'index.html' : path));
      if (!file.startsWith(root + sep)) { res.writeHead(403).end(); return; }
      const data = await readFile(file);
      res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream' }).end(data);
    } catch { res.writeHead(404).end('Not found'); }
  });
  await new Promise(resolve => server.listen({ port: 0, host: '127.0.0.1', ...listen }, resolve));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => new Promise(resolve => server.close(resolve)) };
}
