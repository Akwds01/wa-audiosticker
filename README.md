# 🎨 Bot Audiosticker — XCPT

Bot WhatsApp untuk bikin **Audio Sticker** (stiker bersuara dengan ikon speaker 🔊) langsung dari media yang dikirim di chat.

## Fitur
- **Audio Sticker Native** — stiker asli WA bersuara, waveform + ikon speaker, tanpa API eksternal
- Media yang didukung: gambar, GIF, stiker, video (mp4) + audio mp3/ogg/m4a/voice note
- Stiker yang **sudah ada** bisa diberi suara: reply stiker dengan `!as` setelah audio disimpan
- Metadata pack & author: **XCPT** (ubah di `config.js`)
- Auto-reconnect, retry kirim 3x, perintah tanpa prefix juga dikenali

## Struktur
```
├── bot.js                        # Menu utama: koneksi WA, pairing, routing pesan
├── config.js                     # ⚙️ SEMUA konfigurasi (pack/author, prefix)
├── features/
│   └── audiosticker-native.js    # Fitur: audio sticker native (ogg opus + exif + proto patch)
└── lib/
    └── net-fix.js                # Fix jaringan: paksa IPv4 (anti happy-eyeballs timeout)
```

## Cara Pakai
1. `!as` + kirim/reply audio (mp3/ogg/m4a/VN) → 🎵 audio disimpan
2. Kirim/reply gambar, GIF, stiker → 🔊 audio sticker langsung terkirim
3. Urutan boleh dibalik; tanpa `!as` juga bisa (media langsung dikenali)
4. `!menu` — bantuan

## Menjalankan
```bash
npm install
node bot.js 628xxxxxxxxxx   # akan muncul PAIRING CODE, masukkan di WA → Perangkat Tertaut
```

## Konfigurasi
Semua pengaturan ada di **`config.js`** — kode pairing, nama pack/author, durasi audio maksimal, prefix perintah.

## Catatan
- Audio dikonversi otomatis ke OGG Opus 48kHz mono (butuh `ffmpeg`)
- Sesi audio tersimpan di memori; hilang jika bot restart
- `auth/` berisi kredensial sesi — jangan dibagikan & jangan di-commit
