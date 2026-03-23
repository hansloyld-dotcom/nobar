# 🎬 Nobar — Nonton Bareng Real-Time

Web app nonton bareng dengan sync video real-time. Setiap orang stream video dari koneksi sendiri — jadi kalau satu orang lag, yang lain tetap lancar!

## Cara Kerja

```
Host play/pause/seek
       ↓
  WebSocket Server  ← sinyal ringan, bukan stream video
       ↓
  Semua teman terima sinyal
       ↓
  Tiap orang load video dari URL-nya sendiri
```

## Stack

- **Frontend**: React + Vite (deploy ke Vercel/Netlify)
- **Backend**: Node.js WebSocket (deploy ke Railway/Render)

---

## 🚀 Deploy: Backend (Railway) — Gratis

### 1. Buat akun Railway
Daftar di [railway.app](https://railway.app) — bisa login pakai GitHub.

### 2. Deploy backend

```bash
# Di folder backend/
railway login
railway init
railway up
```

Atau lewat GitHub:
1. Push folder `backend/` ke GitHub repo
2. Di Railway: **New Project → Deploy from GitHub repo**
3. Pilih repo, Railway otomatis detect Node.js
4. Di Settings → Environment: tambah variable `PORT=8080` (opsional, sudah ada default)
5. Copy URL yang dikasih Railway, contoh: `nobar-server-production.up.railway.app`

---

## 🚀 Deploy: Frontend (Vercel) — Gratis

### 1. Isi environment variable

```bash
# Di folder frontend/, buat file .env.local
VITE_WS_URL=wss://nobar-server-production.up.railway.app
# Ganti dengan URL Railway kamu (pakai wss://, bukan https://)
```

### 2. Deploy ke Vercel

```bash
npm install -g vercel
cd frontend/
vercel
```

Atau lewat GitHub:
1. Push folder `frontend/` ke GitHub
2. Di [vercel.com](https://vercel.com): **New Project → Import**
3. Di Settings → Environment Variables: tambah `VITE_WS_URL` = `wss://url-railway-kamu`
4. Deploy!

---

## 💻 Jalankan Lokal (Dev)

```bash
# Terminal 1 — Backend
cd backend/
npm install
npm run dev

# Terminal 2 — Frontend
cd frontend/
npm install
# Buat .env.local
echo "VITE_WS_URL=ws://localhost:8080" > .env.local
npm run dev
```

Buka http://localhost:5173

---

## Fitur

- ✅ Sync play/pause/seek real-time
- ✅ YouTube (embed dengan IFrame API)
- ✅ Video MP4/WebM/MKV direct link
- ✅ Google Drive (share link)
- ✅ Generic iframe (situs lain yang support embed)
- ✅ Auto-reconnect kalau koneksi putus
- ✅ Sync otomatis saat join room
- ✅ Host otomatis pindah kalau host keluar
- ✅ Live chat dalam room
- ✅ Daftar penonton real-time
- ✅ Tombol "Sync ke Host" kalau ketinggalan

## Cara Pakai

1. Buka link app
2. **Buat Room**: masukkan nama → klik "Buat Room" → share kode room ke teman
3. **Join**: teman masukkan nama + kode room → klik "Join Room"
4. Siapapun bisa paste link video → klik **Putar**
5. Host yang kontrol play/pause/seek, semua teman ikut sync
6. Kalau lag, teman bisa klik **🔄 Sync ke Host**

## Catatan

- **YouTube**: Sync otomatis via IFrame API
- **Google Drive**: Pastikan file sudah di-share "Anyone with link can view"
- **MP4 direct**: Harus link yang bisa diakses publik (bukan localhost)
- **Streaming site lain**: Pakai iframe embed — tidak semua site support (karena X-Frame-Options)
