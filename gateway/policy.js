// Policy Engine: memutuskan allow/deny dari token + atribut database + konteks. Default deny.
const db = require('../db/db'); const { dalamJamAkses, getAccess } = require('../shared/config');
const allow = () => ({ allow: true, reason: 'sesuai kebijakan' });
const deny = reason => ({ allow: false, reason });
const luarJam = () => { const a = getAccess(); return deny(`di luar jam akses (${a.start}.00-${a.end}.00 WIB)`); };

function decide({ user, method, path, query, deviceId }) {
  const role = user.role, uid = Number(user.sub);

  // Verifikasi konteks: device terdaftar (hanya untuk user, bukan service)
  if (role !== 'service') {
    if (!deviceId) return deny('header X-Device-ID tidak ada');
    if (!db.prepare('SELECT 1 FROM devices WHERE user_id=? AND device_id=?').get(uid, deviceId))
      return deny('device tidak terdaftar untuk user ini');
  }

  // POST /transkrip/sinkron : hanya token service
  if (method === 'POST' && path === '/transkrip/sinkron')
    return role === 'service' ? allow() : deny('endpoint khusus token service');
  if (role === 'service') return deny('token service hanya boleh ke /transkrip/sinkron');

  let m;
  // GET /nilai : mahasiswa = nilai sendiri, dosen = kelas yang diampu
  if (method === 'GET' && path === '/nilai') {
    if (role === 'mahasiswa') {
      const me = db.prepare('SELECT nim FROM users WHERE id=?').get(uid);
      if (!query.nim) return deny('parameter nim wajib untuk mahasiswa');
      return query.nim === me.nim ? allow() : deny('mahasiswa hanya boleh melihat nilai miliknya');
    }
    if (role === 'dosen') {
      if (!query.kelas_id) return deny('parameter kelas_id wajib untuk dosen');
      const k = db.prepare('SELECT dosen_id FROM kelas WHERE id=?').get(Number(query.kelas_id));
      if (!k) return deny('kelas tidak ditemukan');
      return k.dosen_id === uid ? allow() : deny('bukan kelas yang diampu');
    }
    return deny('role tidak berhak melihat nilai');
  }

  // PUT /nilai/:id : dosen, kelas diampu, belum final, jam akses
  if (method === 'PUT' && (m = path.match(/^\/nilai\/(\d+)$/))) {
    if (role !== 'dosen') return deny('hanya dosen yang boleh mengubah nilai');
    const r = db.prepare('SELECT n.status, k.dosen_id FROM nilai n JOIN kelas k ON k.id=n.kelas_id WHERE n.id=?').get(Number(m[1]));
    if (!r) return deny('data nilai tidak ditemukan');
    if (r.dosen_id !== uid) return deny('bukan kelas yang diampu');
    if (r.status === 'final') return deny('nilai sudah final');
    return dalamJamAkses() ? allow() : luarJam();
  }

  // POST /kelas/:id/finalisasi : dosen, kelas diampu, jam akses
  if (method === 'POST' && (m = path.match(/^\/kelas\/(\d+)\/finalisasi$/))) {
    if (role !== 'dosen') return deny('hanya dosen yang boleh finalisasi');
    const k = db.prepare('SELECT dosen_id FROM kelas WHERE id=?').get(Number(m[1]));
    if (!k) return deny('kelas tidak ditemukan');
    if (k.dosen_id !== uid) return deny('bukan kelas yang diampu');
    return dalamJamAkses() ? allow() : luarJam();
  }

  // GET /transkrip/:nim : mahasiswa = NIM sendiri, admin = semua
  if (method === 'GET' && (m = path.match(/^\/transkrip\/([\w-]+)$/))) {
    if (role === 'admin') return allow();
    if (role === 'mahasiswa') {
      const me = db.prepare('SELECT nim FROM users WHERE id=?').get(uid);
      return me.nim === m[1] ? allow() : deny('mahasiswa hanya boleh melihat transkrip sendiri');
    }
    return deny('role tidak berhak melihat transkrip');
  }

  return deny('tidak ada kebijakan untuk endpoint ini (default deny)');
}
module.exports = { decide };
