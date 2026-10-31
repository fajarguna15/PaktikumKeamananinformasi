// Policy Administrator: login, refresh, logout, token service
const router = require('express').Router();
const jwt = require('jsonwebtoken'); const bcrypt = require('bcryptjs'); const crypto = require('crypto');
const db = require('../db/db'); const { audit } = require('./audit');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const now = () => Math.floor(Date.now() / 1000);
const dev = req => req.get('X-Device-ID');
const fail = (req, res, subj, code, alasan) => { audit(subj, `${req.method} ${req.originalUrl}`, dev(req), 'deny', alasan); return res.status(code).json({ error: alasan }); };
const ok = (req, subj, alasan) => audit(subj, `${req.method} ${req.originalUrl}`, dev(req), 'allow', alasan);
const signUser = u => jwt.sign({ sub: String(u.id), role: u.role }, process.env.JWT_SECRET, { expiresIn: '10m', algorithm: 'HS256' });

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE username=?').get(String(username || ''));
  if (!u || !bcrypt.compareSync(String(password || ''), u.password_hash)) return fail(req, res, username || 'anonymous', 401, 'kredensial salah');
  if (!db.prepare('SELECT 1 FROM devices WHERE user_id=? AND device_id=?').get(u.id, dev(req) || ''))
    return fail(req, res, `${u.username}(${u.role})`, 403, 'device tidak terdaftar');
  const refreshToken = crypto.randomBytes(48).toString('hex');
  db.prepare('INSERT INTO refresh_tokens(user_id,token_hash,expires_at) VALUES(?,?,?)').run(u.id, sha(refreshToken), now() + 86400);
  ok(req, `${u.username}(${u.role})`, 'login berhasil');
  res.json({ accessToken: signUser(u), refreshToken, expiresIn: 600 });
});

function cekRefresh(req) {
  const rt = db.prepare('SELECT * FROM refresh_tokens WHERE token_hash=?').get(sha(String((req.body || {}).refreshToken || '')));
  if (!rt) return { err: 'refresh token tidak dikenal' };
  if (rt.revoked) return { err: 'refresh token sudah dicabut' };
  if (rt.expires_at < now()) return { err: 'refresh token kedaluwarsa' };
  return { rt };
}

router.post('/refresh', (req, res) => {
  const { rt, err } = cekRefresh(req); if (err) return fail(req, res, 'anonymous', 401, err);
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(rt.user_id);
  ok(req, `${u.username}(${u.role})`, 'refresh berhasil');
  res.json({ accessToken: signUser(u), expiresIn: 600 });
});

router.post('/logout', (req, res) => {
  const { rt, err } = cekRefresh(req); if (err) return fail(req, res, 'anonymous', 401, err);
  db.prepare('UPDATE refresh_tokens SET revoked=1 WHERE id=?').run(rt.id);
  ok(req, `user#${rt.user_id}`, 'logout, refresh token dicabut');
  res.json({ message: 'logout berhasil' });
});

router.post('/service', (req, res) => {
  const { client_id, client_secret } = req.body || {};
  const a = Buffer.from(String(client_secret || '')), b = Buffer.from(process.env.SERVICE_CLIENT_SECRET);
  if (client_id !== process.env.SERVICE_CLIENT_ID || a.length !== b.length || !crypto.timingSafeEqual(a, b))
    return fail(req, res, client_id || 'anonymous', 401, 'client id/secret salah');
  const token = jwt.sign({ sub: client_id, role: 'service' }, process.env.JWT_SECRET, { expiresIn: '5m', algorithm: 'HS256' });
  ok(req, `${client_id}(service)`, 'token service diterbitkan');
  res.json({ accessToken: token, expiresIn: 300 });
});

module.exports = router;
