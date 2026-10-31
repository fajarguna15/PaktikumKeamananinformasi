<<<<<<< HEAD
# Sistem Nilai: Zero Trust Security

Tugas Praktikum Individu, Keamanan Informasi (KP70065004), Informatika Universitas Siliwangi.

Stack: Node.js 18+ (disarankan 20+), Express, http-proxy-middleware, jsonwebtoken, SQLite (better-sqlite3).

## Arsitektur

```
Client (curl/Postman) --> API Gateway :3000 (PEP + Policy Engine/Administrator + Audit Log)
                              |-- (allow + X-Gateway-Secret) --> Service Nilai     :3001
                              |-- (allow + X-Gateway-Secret) --> Service Transkrip :3002
Service Nilai --(finalisasi, token service, lewat gateway)--> POST /transkrip/sinkron
Database SQLite bersama: db/nilai.db
```

| File | Isi |
|---|---|
| `gateway/app.js` | PEP: verifikasi token, panggil policy, audit, proxy + `X-Gateway-Secret` |
| `gateway/auth.js` | Policy Administrator: login, refresh, logout, `/auth/service` |
| `gateway/policy.js` | Policy Engine: keputusan allow/deny (Tabel 3 + device + jam akses), default deny |
| `gateway/audit.js` | Audit log ke tabel `audit_log` dan console |
| `shared/zerotrust.js` | Middleware service: cek gateway secret + verifikasi ulang JWT |
| `shared/config.js` | Konfigurasi jam akses (dibaca ulang setiap request) |
| `service-nilai/app.js`, `service-transkrip/app.js` | Resource service |
| `tests/smoke.js` | 35 skenario pengujian otomatis |

## Cara menjalankan

```bash
npm install
cp .env.example .env        # ganti semua secret dengan nilai acak
npm run seed                # membuat db/nilai.db + data awal (bisa diulang untuk reset)
npm start                   # menjalankan gateway, service nilai, service transkrip sekaligus
npm test                    # (terminal lain) jalankan semua skenario uji
```

Alternatif jalan manual di 3 terminal: `npm run start:gateway`, `npm run start:nilai`, `npm run start:transkrip`.

## Akun dan device ID data awal

| Role | Username | Password | NIM | X-Device-ID |
|---|---|---|---|---|
| Admin | admin | admin123 | - | ADMIN-PC-01 |
| Dosen (kelas 1 Keamanan Informasi) | dosen1 | dosen123 | - | DSN1-LAPTOP |
| Dosen (kelas 2 Basis Data) | dosen2 | dosen123 | - | DSN2-LAPTOP |
| Mahasiswa | mhs1 | mhs123 | 2210001 | MHS1-HP |
| Mahasiswa | mhs2 | mhs123 | 2210002 | MHS2-HP |
| Mahasiswa | mhs3 | mhs123 | 2210003 | MHS3-HP |

Data nilai: kelas 1 (nilai id 1-3, draft), kelas 2 (id 4 draft, id 5 sudah **final** untuk demo "nilai final").

## Contoh curl

```bash
# Login (device wajib terdaftar)
curl -s -X POST localhost:3000/auth/login -H "Content-Type: application/json" -H "X-Device-ID: DSN1-LAPTOP" \
  -d '{"username":"dosen1","password":"dosen123"}'
TOKEN=<accessToken>

# Dosen lihat nilai kelasnya / ubah nilai / finalisasi
curl -s "localhost:3000/nilai?kelas_id=1" -H "Authorization: Bearer $TOKEN" -H "X-Device-ID: DSN1-LAPTOP"
curl -s -X PUT localhost:3000/nilai/1 -H "Authorization: Bearer $TOKEN" -H "X-Device-ID: DSN1-LAPTOP" \
  -H "Content-Type: application/json" -d '{"nilai":90}'
curl -s -X POST localhost:3000/kelas/1/finalisasi -H "Authorization: Bearer $TOKEN" -H "X-Device-ID: DSN1-LAPTOP"

# Mahasiswa lihat nilai / transkrip sendiri
curl -s "localhost:3000/nilai?nim=2210001" -H "Authorization: Bearer $TOKEN_MHS" -H "X-Device-ID: MHS1-HP"
curl -s localhost:3000/transkrip/2210001 -H "Authorization: Bearer $TOKEN_MHS" -H "X-Device-ID: MHS1-HP"

# Refresh dan logout
curl -s -X POST localhost:3000/auth/refresh -H "Content-Type: application/json" -d '{"refreshToken":"<refreshToken>"}'
curl -s -X POST localhost:3000/auth/logout  -H "Content-Type: application/json" -d '{"refreshToken":"<refreshToken>"}'

# Akses langsung service (harus ditolak 403; dengan secret benar tapi tanpa token -> 401)
curl -i "localhost:3001/nilai?nim=2210001"
```

## Memetakan kebutuhan ke kode (untuk video demo)

| Kebutuhan | Lokasi |
|---|---|
| 4.1 Access token JWT 10 menit (`sub`, `role`) | `gateway/auth.js` (`signUser`) |
| 4.1 Refresh token 1 hari, disimpan (hash) di DB, dicabut saat logout | `gateway/auth.js` (`/login`, `/refresh`, `/logout`) |
| 4.1 Token service 5 menit, `role: service` | `gateway/auth.js` (`/service`), dipakai `service-nilai/app.js` (`tokenService`) |
| 4.1 Gateway secret + verifikasi ulang JWT di service | `gateway/app.js` (`addSecret`), `shared/zerotrust.js` |
| 4.2 Kebijakan Tabel 3 + atribut dari DB | `gateway/policy.js` (`decide`) |
| 4.3 Device terdaftar | `gateway/policy.js` (awal `decide`), `gateway/auth.js` (`/login`) |
| 4.3 Jam akses (konfigurasi) | `shared/config.js`, `.env` (`ACCESS_START`/`ACCESS_END`) |
| 4.4 Audit log semua keputusan | `gateway/audit.js`, dipanggil dari `gateway/app.js` dan `auth.js` |
| Finalisasi memanggil Service Transkrip lewat gateway | `service-nilai/app.js` (`/kelas/:id/finalisasi`) |

## Demo jam akses

Ubah `ACCESS_START`/`ACCESS_END` di `.env` (mis. `0` dan `1`) tanpa restart. `PUT /nilai/:id` atau finalisasi akan ditolak dengan alasan "di luar jam akses". Kembalikan ke `7` dan `21` setelahnya.

## Melihat audit log

```bash
sqlite3 db/nilai.db "SELECT waktu,subjek,endpoint,device,hasil,alasan FROM audit_log ORDER BY id DESC LIMIT 20;"
```

Atau lihat baris `[AUDIT]` di console gateway.

## Catatan keamanan

- Never trust, always verify: service tetap memeriksa gateway secret dan JWT. Least privilege: default deny. Assume breach: service menolak request tanpa token valid walau datang dari jaringan internal.
- Password di-hash (bcrypt), refresh token disimpan sebagai hash SHA-256.
- Untuk produksi: HTTPS/mTLS, secret dari secret manager, dan rate limiting (di luar cakupan tugas ini).
=======
# PaktikumKeamananinformasi
>>>>>>> 8da36c18b76577c9ff3fdb9862e7774f0899452b
