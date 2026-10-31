require('../shared/config');
const express = require('express'); const db = require('../db/db'); const zeroTrust = require('../shared/zerotrust');
const app = express(); app.use(express.json()); app.use(zeroTrust);

app.get('/transkrip/:nim', (req, res) => {
  const { role, sub } = req.auth;
  if (role === 'mahasiswa') {
    const me = db.prepare('SELECT nim FROM users WHERE id=?').get(Number(sub));
    if (!me || me.nim !== req.params.nim) return res.status(403).json({ error: 'hanya transkrip sendiri' });
  } else if (role !== 'admin') return res.status(403).json({ error: 'role tidak berhak' });
  const rows = db.prepare('SELECT k.nama AS kelas, t.nilai FROM transkrip t JOIN kelas k ON k.id=t.kelas_id WHERE t.nim=?').all(req.params.nim);
  res.json({ nim: req.params.nim, transkrip: rows });
});

app.post('/transkrip/sinkron', (req, res) => {
  if (req.auth.role !== 'service') return res.status(403).json({ error: 'hanya token service' });
  const { kelas_id, items } = req.body || {};
  if (!Number.isInteger(kelas_id) || !Array.isArray(items)) return res.status(400).json({ error: 'body tidak valid' });
  const up = db.prepare('INSERT INTO transkrip(nim,kelas_id,nilai) VALUES(?,?,?) ON CONFLICT(nim,kelas_id) DO UPDATE SET nilai=excluded.nilai');
  db.transaction(() => items.forEach(i => up.run(String(i.nim), kelas_id, Number(i.nilai))))();
  res.json({ message: 'sinkron berhasil', jumlah: items.length });
});
app.listen(process.env.TRANSKRIP_PORT, () => console.log(`Service Transkrip di port ${process.env.TRANSKRIP_PORT}`));
