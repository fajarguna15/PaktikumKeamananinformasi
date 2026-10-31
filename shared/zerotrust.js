// Middleware untuk SERVICE: tidak percaya siapa pun, termasuk request yang "terlihat" dari gateway.
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
function sama(a = '', b = '') { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && crypto.timingSafeEqual(x, y); }
module.exports = function zeroTrust(req, res, next) {
  // Lapis 1: harus datang lewat gateway
  if (!sama(req.get('X-Gateway-Secret') || '', process.env.GATEWAY_SECRET))
    return res.status(403).json({ error: 'akses langsung ke service ditolak (gateway secret salah)' });
  // Lapis 2: verifikasi ulang tanda tangan + masa berlaku token
  const m = (req.get('Authorization') || '').match(/^Bearer (.+)$/);
  if (!m) return res.status(401).json({ error: 'token tidak ada' });
  try { req.auth = jwt.verify(m[1], process.env.JWT_SECRET, { algorithms: ['HS256'] }); }
  catch { return res.status(401).json({ error: 'token tidak valid atau kedaluwarsa' }); }
  next();
};
