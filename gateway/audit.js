const db = require('../db/db');
const ins = db.prepare('INSERT INTO audit_log(waktu,subjek,endpoint,device,hasil,alasan) VALUES(?,?,?,?,?,?)');
exports.audit = (subjek, endpoint, device, hasil, alasan) => {
  const waktu = new Date().toISOString();
  ins.run(waktu, String(subjek), endpoint, device || null, hasil, alasan);
  console.log(`[AUDIT] ${waktu} | ${subjek} | ${endpoint} | ${device || '-'} | ${hasil.toUpperCase()} | ${alasan}`);
};
