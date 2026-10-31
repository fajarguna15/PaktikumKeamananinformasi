require('../shared/config');
const express = require('express'); const db = require('../db/db'); const zeroTrust = require('../shared/zerotrust');
const app = express(); app.use(express.json()); app.use(zeroTrust);

// Token service (di-cache sampai hampir kedaluwarsa)
let cache = { token: null, exp: 0 };
async function tokenService() {
  if (cache.token && Date.now() < cache.exp) return cache.token;
  const r = await fetch(`${process.env.GATEWAY_URL}/auth/service`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: process.env.SERVICE_CLIENT_ID, client_secret: process.env.SERVICE_CLIENT_SECRET }) });
  if (!r.ok) throw new Error('gagal mengambil token service');
  const j = await r.json(); cache = { token: j.accessToken, exp: Date.now() + (j.expiresIn - 30) * 1000 };
  return cache.token;
}
const milikDosen = (kelasId, sub) => db.prepare('SELECT 1 FROM kelas WHERE id=? AND dosen_id=?').get(kelasId, Number(sub));

app.get('/nilai', (req, res) => {
  const { role, sub } = req.auth;
  if (role === 'mahasiswa') { // lapis kedua: filter dipaksa dari token, bukan dari query
    const me = db.prepare('SELECT nim FROM users WHERE id=?').get(Number(sub));
    return res.json(db.prepare('SELECT n.id,k.nama AS kelas,n.nim,n.nilai,n.status FROM nilai n JOIN kelas k ON k.id=n.kelas_id WHERE n.nim=?').all(me.nim));
  }
  if (role === 'dosen') {
    if (!milikDosen(Number(req.query.kelas_id), sub)) return res.status(403).json({ error: 'bukan kelas yang diampu' });
    return res.json(db.prepare('SELECT id,kelas_id,nim,nilai,status FROM nilai WHERE kelas_id=?').all(Number(req.query.kelas_id)));
  }
  res.status(403).json({ error: 'role tidak berhak' });
});

app.put('/nilai/:id', (req, res) => {
  const { role, sub } = req.auth; if (role !== 'dosen') return res.status(403).json({ error: 'hanya dosen' });
  const r = db.prepare('SELECT n.*, k.dosen_id FROM nilai n JOIN kelas k ON k.id=n.kelas_id WHERE n.id=?').get(Number(req.params.id));
  if (!r) return res.status(404).json({ error: 'nilai tidak ditemukan' });
  if (r.dosen_id !== Number(sub)) return res.status(403).json({ error: 'bukan kelas yang diampu' });
  if (r.status === 'final') return res.status(409).json({ error: 'nilai sudah final' });
  const v = Number(req.body?.nilai);
  if (!Number.isFinite(v) || v < 0 || v > 100) return res.status(400).json({ error: 'nilai harus 0-100' });
  db.prepare('UPDATE nilai SET nilai=? WHERE id=?').run(v, r.id);
  res.json({ id: r.id, nilai: v, status: r.status });
});

app.post('/kelas/:id/finalisasi', async (req, res) => {
  const { role, sub } = req.auth; const kid = Number(req.params.id);
  if (role !== 'dosen' || !milikDosen(kid, sub)) return res.status(403).json({ error: 'bukan dosen pengampu kelas ini' });
  const draft = db.prepare("SELECT id FROM nilai WHERE kelas_id=? AND status='draft'").all(kid).map(r => r.id);
  db.prepare("UPDATE nilai SET status='final' WHERE kelas_id=?").run(kid);
  const items = db.prepare('SELECT nim, nilai FROM nilai WHERE kelas_id=?').all(kid);
  try { // panggilan antar-service WAJIB lewat gateway dengan token service
    const r = await fetch(`${process.env.GATEWAY_URL}/transkrip/sinkron`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await tokenService()}` },
      body: JSON.stringify({ kelas_id: kid, items }) });
    if (!r.ok) throw new Error(`sinkron ditolak (${r.status})`);
    res.json({ message: 'kelas difinalisasi dan transkrip tersinkron', kelas_id: kid, jumlah: items.length });
  } catch (e) { // rollback agar data tidak setengah jadi
    for (const id of draft) db.prepare("UPDATE nilai SET status='draft' WHERE id=?").run(id);
    res.status(502).json({ error: 'finalisasi dibatalkan: ' + e.message });
  }
});
app.listen(process.env.NILAI_PORT, () => console.log(`Service Nilai di port ${process.env.NILAI_PORT}`));
