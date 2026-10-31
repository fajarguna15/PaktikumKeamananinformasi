const path = require('path'); const fs = require('fs'); const dotenv = require('dotenv');
const ENV_FILE = path.join(__dirname, '..', '.env');
dotenv.config({ path: ENV_FILE });
// Jam akses dibaca ulang dari .env setiap dipanggil, sehingga mudah didemokan tanpa restart.
function getAccess() {
  let e = process.env;
  try { e = { ...process.env, ...dotenv.parse(fs.readFileSync(ENV_FILE)) }; } catch {}
  return { start: Number(e.ACCESS_START ?? 7), end: Number(e.ACCESS_END ?? 21) };
}
function jamSekarang() {
  return Number(new Intl.DateTimeFormat('en-GB', { hour: 'numeric', hourCycle: 'h23', timeZone: 'Asia/Jakarta' }).format(new Date()));
}
function dalamJamAkses() { const { start, end } = getAccess(); const h = jamSekarang(); return h >= start && h < end; }
module.exports = { getAccess, jamSekarang, dalamJamAkses };
