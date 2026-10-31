const fs = require('fs'); const path = require('path'); const bcrypt = require('bcryptjs');
const db = require('./db');
db.exec(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
const U = db.prepare('INSERT INTO users(id,username,nama,role,password_hash,nim) VALUES(?,?,?,?,?,?)');
const D = db.prepare('INSERT INTO devices(user_id,device_id) VALUES(?,?)');
const users = [
  [1, 'admin',  'Admin Prodi', 'admin',     'admin123', null,      'ADMIN-PC-01'],
  [2, 'dosen1', 'Dr. Budi',    'dosen',     'dosen123', null,      'DSN1-LAPTOP'],
  [3, 'dosen2', 'Dr. Siti',    'dosen',     'dosen123', null,      'DSN2-LAPTOP'],
  [4, 'mhs1',   'Andi',        'mahasiswa', 'mhs123',   '2210001', 'MHS1-HP'],
  [5, 'mhs2',   'Bela',        'mahasiswa', 'mhs123',   '2210002', 'MHS2-HP'],
  [6, 'mhs3',   'Citra',       'mahasiswa', 'mhs123',   '2210003', 'MHS3-HP'],
];
for (const [id, un, nama, role, pw, nim, dev] of users) {
  U.run(id, un, nama, role, bcrypt.hashSync(pw, 10), nim); D.run(id, dev);
}
db.prepare('INSERT INTO kelas VALUES(1,?,2)').run('Keamanan Informasi'); // dosen1
db.prepare('INSERT INTO kelas VALUES(2,?,3)').run('Basis Data');         // dosen2
const N = db.prepare('INSERT INTO nilai(kelas_id,nim,nilai,status) VALUES(?,?,?,?)');
[[1,'2210001',85,'draft'],[1,'2210002',78,'draft'],[1,'2210003',90,'draft'],
 [2,'2210001',80,'draft'],[2,'2210002',88,'final']].forEach(r => N.run(...r));
db.prepare('INSERT INTO transkrip(nim,kelas_id,nilai) VALUES(?,?,?)').run('2210002', 2, 88);
console.log('Seed selesai.');
