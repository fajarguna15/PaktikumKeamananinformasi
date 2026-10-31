require('../shared/config');
const express = require('express'); const jwt = require('jsonwebtoken');
const { createProxyMiddleware } = require('http-proxy-middleware');
const { decide } = require('./policy'); const { audit } = require('./audit'); const auth = require('./auth');

const app = express();
app.disable('x-powered-by');

// /auth/* ditangani gateway sendiri. Body parser HANYA di sini agar body untuk proxy tidak habis.
app.use('/auth', express.json(), auth);

// PEP: setiap request lain wajib lolos autentikasi + keputusan Policy Engine.
function enforce(req, res, next) {
  const path = req.path.replace(/\/+$/, '') || '/';
  const endpoint = `${req.method} ${path}`;
  const device = req.get('X-Device-ID');
  const m = (req.get('Authorization') || '').match(/^Bearer (.+)$/);
  if (!m) { audit('anonymous', endpoint, device, 'deny', 'access token tidak ada'); return res.status(401).json({ error: 'access token diperlukan' }); }
  let user;
  try { user = jwt.verify(m[1], process.env.JWT_SECRET, { algorithms: ['HS256'] }); }
  catch { audit('anonymous', endpoint, device, 'deny', 'token tidak valid atau kedaluwarsa'); return res.status(401).json({ error: 'token tidak valid atau kedaluwarsa' }); }

  const d = decide({ user, method: req.method, path, query: req.query, deviceId: device });
  audit(`${user.sub}(${user.role})`, endpoint, device, d.allow ? 'allow' : 'deny', d.reason);
  if (!d.allow) return res.status(403).json({ error: 'akses ditolak', reason: d.reason });
  next();
}
app.use(enforce);

const addSecret = { proxyReq: p => p.setHeader('X-Gateway-Secret', process.env.GATEWAY_SECRET) };
app.use(createProxyMiddleware({ target: process.env.NILAI_URL, changeOrigin: true, pathFilter: ['/nilai', '/kelas'], on: addSecret }));
app.use(createProxyMiddleware({ target: process.env.TRANSKRIP_URL, changeOrigin: true, pathFilter: '/transkrip', on: addSecret }));

app.listen(process.env.GATEWAY_PORT, () => console.log(`API Gateway (PEP) di port ${process.env.GATEWAY_PORT}`));
