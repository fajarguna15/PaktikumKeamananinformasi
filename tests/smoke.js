// Smoke test otomatis: jalankan SETELAH `npm run seed` dan `npm start`. Mengikuti checklist pengujian.
const fs = require('fs'); const path = require('path');
const G = 'http://localhost:3000', N = 'http://localhost:3001', T = 'http://localhost:3002';
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const ENV = path.join(__dirname, '..', '.env'); const envAsli = fs.readFileSync(ENV, 'utf8');
let pass = 0, gagal = 0;
const cek = (nama, kondisi, info = '') => { kondisi ? pass++ : gagal++; console.log(`${kondisi ? 'PASS' : 'FAIL'}  ${nama} ${info}`); };
const req = async (url, { method = 'GET', token, device, body, headers = {} } = {}) => {
  const h = { ...headers }; if (token) h.Authorization = `Bearer ${token}`; if (device) h['X-Device-ID'] = device;
  if (body) h['Content-Type'] = 'application/json';
  const r = await fetch(url, { method, headers: h, body: body ? JSON.stringify(body) : undefined });
  return { s: r.status, j: await r.json().catch(() => ({})) };
};
const login = async (u, p, d) => (await req(`${G}/auth/login`, { method: 'POST', device: d, body: { username: u, password: p } }));
const setJam = (a, b) => fs.writeFileSync(ENV, envAsli.replace(/ACCESS_START=.*/, `ACCESS_START=${a}`).replace(/ACCESS_END=.*/, `ACCESS_END=${b}`));

(async () => {
  try {
    setJam(0, 24);
    const bad = await login('mhs1', 'mhs123', 'DEVICE-LAIN'); cek('login device salah ditolak', bad.s === 403, bad.s);
    const pw = await login('mhs1', 'salah', 'MHS1-HP'); cek('login password salah ditolak', pw.s === 401, pw.s);
    const m1 = await login('mhs1', 'mhs123', 'MHS1-HP'); const m2 = await login('mhs2', 'mhs123', 'MHS2-HP');
    const d1 = await login('dosen1', 'dosen123', 'DSN1-LAPTOP'); const d2 = await login('dosen2', 'dosen123', 'DSN2-LAPTOP');
    const ad = await login('admin', 'admin123', 'ADMIN-PC-01');
    cek('login valid', [m1, m2, d1, d2, ad].every(x => x.s === 200));
    const tk = x => x.j.accessToken;

    let r = await req(`${N}/nilai?nim=2210001`); cek('akses langsung service tanpa secret -> 403', r.s === 403, r.s);
    r = await req(`${T}/transkrip/2210001`, { headers: { 'X-Gateway-Secret': process.env.GATEWAY_SECRET } }); cek('secret benar tanpa token -> 401', r.s === 401, r.s);
    r = await req(`${T}/transkrip/2210001`, { token: 'x.y.z', headers: { 'X-Gateway-Secret': process.env.GATEWAY_SECRET } }); cek('secret benar + token palsu -> 401', r.s === 401, r.s);
    r = await req(`${G}/nilai?nim=2210001`); cek('gateway tanpa token -> 401', r.s === 401, r.s);
    r = await req(`${G}/nilai?nim=2210001`, { token: tk(m1) }); cek('gateway tanpa X-Device-ID -> 403', r.s === 403, r.s);
    r = await req(`${G}/nilai?nim=2210001`, { token: tk(m1), device: 'MHS2-HP' }); cek('device milik user lain -> 403', r.s === 403, r.s);

    r = await req(`${G}/nilai?nim=2210001`, { token: tk(m1), device: 'MHS1-HP' }); cek('mhs lihat nilai sendiri', r.s === 200 && r.j.length === 2, r.s);
    r = await req(`${G}/nilai?nim=2210002`, { token: tk(m1), device: 'MHS1-HP' }); cek('mhs lihat nilai mhs lain -> deny', r.s === 403, r.j.reason);
    r = await req(`${G}/transkrip/2210002`, { token: tk(m1), device: 'MHS1-HP' }); cek('mhs lihat transkrip mhs lain -> deny', r.s === 403, r.j.reason);
    r = await req(`${G}/transkrip/2210001`, { token: tk(m1), device: 'MHS1-HP' }); cek('mhs lihat transkrip sendiri', r.s === 200, r.s);
    r = await req(`${G}/transkrip/2210002`, { token: tk(ad), device: 'ADMIN-PC-01' }); cek('admin lihat transkrip semua NIM', r.s === 200 && r.j.transkrip.length === 1, r.s);
    r = await req(`${G}/nilai?kelas_id=1`, { token: tk(ad), device: 'ADMIN-PC-01' }); cek('admin lihat nilai -> deny', r.s === 403, r.s);

    r = await req(`${G}/nilai?kelas_id=1`, { token: tk(d1), device: 'DSN1-LAPTOP' }); cek('dosen lihat kelas diampu', r.s === 200 && r.j.length === 3, r.s);
    r = await req(`${G}/nilai?kelas_id=2`, { token: tk(d1), device: 'DSN1-LAPTOP' }); cek('dosen lihat kelas dosen lain -> deny', r.s === 403, r.j.reason);
    r = await req(`${G}/nilai/1`, { method: 'PUT', token: tk(d1), device: 'DSN1-LAPTOP', body: { nilai: 95 } }); cek('dosen ubah nilai kelas sendiri', r.s === 200 && r.j.nilai === 95, r.s);
    r = await req(`${G}/nilai/4`, { method: 'PUT', token: tk(d1), device: 'DSN1-LAPTOP', body: { nilai: 95 } }); cek('dosen ubah nilai kelas lain -> deny', r.s === 403, r.j.reason);
    r = await req(`${G}/nilai/5`, { method: 'PUT', token: tk(d2), device: 'DSN2-LAPTOP', body: { nilai: 10 } }); cek('ubah nilai final -> deny', r.s === 403, r.j.reason);
    r = await req(`${G}/nilai/1`, { method: 'PUT', token: tk(m1), device: 'MHS1-HP', body: { nilai: 100 } }); cek('mahasiswa ubah nilai -> deny', r.s === 403, r.s);

    setJam(0, 1); // simulasi di luar jam akses
    const jam = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Jakarta' }).format(new Date());
    r = await req(`${G}/nilai/1`, { method: 'PUT', token: tk(d1), device: 'DSN1-LAPTOP', body: { nilai: 70 } });
    cek('ubah nilai di luar jam akses -> deny', Number(jam) >= 1 ? r.s === 403 : r.s === 200, r.j.reason);
    r = await req(`${G}/kelas/1/finalisasi`, { method: 'POST', token: tk(d1), device: 'DSN1-LAPTOP' });
    cek('finalisasi di luar jam akses -> deny', Number(jam) >= 1 ? r.s === 403 : r.s === 200, r.j.reason);
    setJam(0, 24);

    const svc = await req(`${G}/auth/service`, { method: 'POST', body: { client_id: 'service-nilai', client_secret: 'salah' } }); cek('token service dengan secret salah -> 401', svc.s === 401, svc.s);
    r = await req(`${G}/transkrip/sinkron`, { method: 'POST', token: tk(d1), device: 'DSN1-LAPTOP', body: { kelas_id: 1, items: [] } }); cek('token user ke /transkrip/sinkron -> deny', r.s === 403, r.j.reason);
    r = await req(`${G}/transkrip/sinkron`, { method: 'POST', token: tk(ad), device: 'ADMIN-PC-01', body: { kelas_id: 1, items: [] } }); cek('token admin ke /transkrip/sinkron -> deny', r.s === 403, r.s);

    r = await req(`${G}/kelas/2/finalisasi`, { method: 'POST', token: tk(d1), device: 'DSN1-LAPTOP' }); cek('finalisasi kelas dosen lain -> deny', r.s === 403, r.j.reason);
    r = await req(`${G}/kelas/1/finalisasi`, { method: 'POST', token: tk(d1), device: 'DSN1-LAPTOP' }); cek('finalisasi kelas sendiri + sinkron', r.s === 200, JSON.stringify(r.j));
    r = await req(`${G}/transkrip/2210001`, { token: tk(m1), device: 'MHS1-HP' }); cek('transkrip mhs terisi setelah finalisasi', r.s === 200 && r.j.transkrip.length === 1 && r.j.transkrip[0].nilai === 95, JSON.stringify(r.j));
    r = await req(`${G}/nilai/1`, { method: 'PUT', token: tk(d1), device: 'DSN1-LAPTOP', body: { nilai: 50 } }); cek('ubah nilai setelah finalisasi -> deny', r.s === 403, r.j.reason);

    r = await req(`${G}/auth/refresh`, { method: 'POST', body: { refreshToken: m1.j.refreshToken } }); cek('refresh token valid', r.s === 200 && r.j.accessToken, r.s);
    r = await req(`${G}/auth/logout`, { method: 'POST', body: { refreshToken: m1.j.refreshToken } }); cek('logout', r.s === 200, r.s);
    r = await req(`${G}/auth/refresh`, { method: 'POST', body: { refreshToken: m1.j.refreshToken } }); cek('refresh setelah logout ditolak', r.s === 401, r.j.error);
    r = await req(`${G}/hal/tidak/ada`, { token: tk(ad), device: 'ADMIN-PC-01' }); cek('endpoint tanpa kebijakan -> default deny', r.s === 403, r.s);

    const Database = require('better-sqlite3'); const db = new Database(path.join(__dirname, '..', 'db', 'nilai.db'), { readonly: true });
    const n = db.prepare('SELECT COUNT(*) c FROM audit_log').get().c; cek('audit log terisi', n > 30, `(${n} baris)`);
  } finally { fs.writeFileSync(ENV, envAsli); }
  console.log(`\nHasil: ${pass} lulus, ${gagal} gagal`); process.exit(gagal ? 1 : 0);
})();
