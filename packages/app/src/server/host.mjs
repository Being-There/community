import { createServer } from 'node:http';
// Host behind an operator-configured HTTPS reverse proxy. No request-derived origin.
export function createNodeRequestListener({ handle, appOrigin, allowedHost = new URL(appOrigin).host }) {
  return async (req, res) => {
    try {
      if (req.headers.host !== allowedHost || !req.url?.startsWith('/') || req.url.startsWith('//')) { res.writeHead(421); res.end(); return; }
      // Request rejects userinfo/invalid URLs. Only a fixed configured origin is trusted.
      const request = new Request(new URL(req.url, appOrigin), { method: req.method, headers: req.headers,
        ...(!['GET', 'HEAD'].includes(req.method) ? { body: req, duplex: 'half' } : {}) });
      const response = await handle(request);
      res.statusCode = response.status;
      for (const [name, value] of response.headers) if (name !== 'set-cookie') res.setHeader(name, value);
      if (response.headers.getSetCookie().length) res.setHeader('set-cookie', response.headers.getSetCookie());
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch { res.writeHead(503, { 'Cache-Control': 'no-store', 'Content-Type': 'text/plain' }); res.end('Service unavailable'); }
  };
}
export function createNodeHost(options) { return createServer(createNodeRequestListener(options)); }
