const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(process.env.DB_PATH || path.join(__dirname, 'nilai.db'));
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
module.exports = db;
