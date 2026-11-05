# DIY Stream Deck Web

Aplikasi Stream Deck modern berbasis web untuk mengubah smartphone (Android/iOS/tablet) menjadi kontroler shortcut **OBS Studio**, **Soundboard**, dan **BGM Player** melalui jaringan lokal (LAN / Wi-Fi) maupun cloud (Tailscale / VPS).

UI dirancang clean dan minimalis mengadopsi gaya antarmuka **YouTube & Instagram Dark/Light Mode** menggunakan Tailwind CSS, tanpa warna neon berlebih.

---

## Daftar Isi
- [Fitur Utama](#fitur-utama)
- [Arsitektur Proyek](#arsitektur-proyek)
- [Prasyarat Sistem](#prasyarat-sistem)
- [Panduan Instalasi](#panduan-instalasi)
  - [Opsi 1: Menjalankan Langsung di PC Lokal (Node.js)](#opsi-1-menjalankan-langsung-di-pc-lokal-nodejs)
  - [Opsi 2: Menjalankan dengan Docker / Docker Compose](#opsi-2-menjalankan-dengan-docker--docker-compose)
  - [Opsi 3: Deploy di Cloud / VPS + Local Audio Player](#opsi-3-deploy-di-cloud--vps--local-audio-player)
- [Pengaturan OBS Studio](#pengaturan-obs-studio)
- [Cara Penggunaan di Smartphone](#cara-penggunaan-di-smartphone)
- [Daftar Perintah (Scripts)](#daftar-perintah-scripts)
- [Struktur Folder](#struktur-folder)
- [Troubleshooting & FAQ](#troubleshooting--faq)

---

## Fitur Utama

- **Zero-Latency Soundboard**: Respon instan (<15ms) berkat event broadcast non-blocking dan pointerdown trigger.
- **BGM Continuous Looper**:
  - Pemutaran musik latar otomatis looping tanpa henti.
  - **Auto-Ducking**: Volume BGM otomatis mengecil saat Soundboard ditekan, dan kembali normal saat selesai.
  - Kontrol volume independen untuk Soundboard & BGM.
- **Dukungan Cloud & Remote**:
  - Dapat di-deploy di VPS / Server Docker.
  - Auto-detect IP Tailscale (`100.x.x.x`) dan mencetak QR Code khusus Tailscale di terminal.
  - Dilengkapi daemon audio lokal (`bin/player.js`) agar server di cloud dapat membunyikan speaker PC lokal.
  - Toggle audio browser (`sd_client_audio`) untuk memutar suara langsung di speaker HP jika diinginkan.
- **Kontrol Penuh OBS Studio**: Ganti scene real-time, toggle Mute Mic, toggle Start/Stop Streaming & Recording.
- **Manajemen Media Langsung via Web**: Upload, rename, dan delete file audio langsung dari HP.
- **Optimasi HP Bekas**: Mendukung Fullscreen, Screen WakeLock (mencegah layar redup), dan Haptic feedback (getar).

---

## Arsitektur Proyek

Sistem menggunakan arsitektur modular yang memisahkan tanggung jawab:
- **`src/main.js`**: Server bootstrap minimalis (Express + Socket.IO).
- **`src/config/`**: Sistem konfigurasi dinamis dengan in-code defaults (tanpa ketergantungan file statis).
- **`src/services/`**: Domain services (`audioManager`, `bgmManager`, `obsManager`, `networkUtils`).
- **`src/routes/`** & **`src/sockets/`**: Endpoint REST API dan gateway WebSocket.
- **`public/js/`**: Frontend ES Modules modern (`state.js`, `audio.js`, `deck.js`, `socket.js`, `app.js`).
- **`media/`**: Penyimpanan runtime file audio (`media/sounds/` & `media/bgm/`) yang terisolasi dari git repo.

---

## Prasyarat Sistem

1. **Node.js**: Versi 18 LTS atau 20+ ([Download Node.js](https://nodejs.org/)).
2. **OBS Studio**: Versi 28 ke atas (sudah memiliki OBS WebSocket v5 bawaan) ([Download OBS](https://obsproject.com/)).
3. **Koneksi Jaringan**: PC dan HP terhubung ke Wi-Fi yang sama, atau terhubung via Tailscale.

---

## Panduan Instalasi

### Opsi 1: Menjalankan Langsung di PC Lokal (Node.js)

1. **Clone repository**:
   ```bash
   git clone https://github.com/Zeakeers/StreamDeck.git streamdeck
   cd streamdeck
   ```

2. **Pasang dependensi**:
   ```bash
   npm install
   ```

3. **Generate sample suara & BGM awal**:
   *(File media sengaja di-ignore agar repo tetap ringan < 2MB)*
   ```bash
   npm run setup:media
   ```

4. **Jalankan server**:
   ```bash
   npm start
   ```

5. Terminal akan menampilkan URL lokal (`http://localhost:3000`), URL LAN Wi-Fi, dan QR Code untuk discan dari HP.

---

### Opsi 2: Menjalankan dengan Docker / Docker Compose

1. **Clone & masuk ke folder**:
   ```bash
   git clone https://github.com/Zeakeers/StreamDeck.git streamdeck
   cd streamdeck
   npm run setup:media
   ```

2. **Jalankan via Docker Compose**:
   ```bash
   docker compose up -d --build
   ```

3. Server akan berjalan di port `3001` (dapat dikonfigurasi lewat environment variable `STREAMDECK_PORT`).

---

### Opsi 3: Deploy di Cloud / VPS + Local Audio Player

Jika StreamDeck di-host di Cloud Server (misal `http://mc-server:3001` atau `http://100.83.249.40:3001`):

1. **Jalankan container StreamDeck di server cloud**:
   ```bash
   docker compose up -d
   ```

2. **Buka HP**: Akses URL web controller di browser HP Anda.

3. **Jalankan Daemon Player di PC Lokal Anda** (agar suara soundboard tetap berbunyi di speaker PC / OBS Anda):
   ```bash
   node bin/player.js http://ip-server-cloud:3001
   ```
   *Daemon ini otomatis mendownload aset yang belum ada dan memutar audio dengan latensi sub-15ms via cache memori.*

---

## Pengaturan OBS Studio

Lakukan langkah ini sekali di PC Anda:
1. Buka **OBS Studio**.
2. Masuk ke menu **Tools (Alat)** -> **WebSocket Server Settings**.
3. Centang **Enable WebSocket server**.
4. Port default adalah `4455`.
5. Pengaturan Autentikasi:
   - **Tanpa Password**: Hilangkan centang pada **Enable Authentication** -> klik **Apply/OK**.
   - **Dengan Password**: Jika dicentang, klik **Show Connect Info** untuk menyalin password. Masukkan password tersebut pada tab **Settings** di web StreamDeck, lalu klik **Hubungkan ke OBS**.

---

## Cara Penggunaan di Smartphone

1. Sambungkan HP ke jaringan Wi-Fi yang sama dengan PC (atau nyalakan Tailscale di HP).
2. Scan QR Code di terminal menggunakan kamera HP (atau buka URL yang tertera di Chrome/Safari).
3. **Mode Fullscreen**: Tekan ikon layar penuh di pojok kanan atas.
4. **Wake Lock**: Tekan ikon gembok/layar agar layar HP tetap menyala tanpa mati otomatis.
5. **Navigasi Slider**: Geser layar ke kiri atau kanan untuk berpindah antara tab **Scenes** dan **Soundboard**.
6. **Tema**: Pilih Dark Mode atau Light Mode sesuai selera.

---

## Daftar Perintah (Scripts)

| Perintah | Fungsi |
|---|---|
| `npm start` | Menjalankan server aplikasi (`node src/main.js`) |
| `npm run setup:media` | Men-generate sample suara (.wav) dan BGM looper awal |
| `npm run build:css` | Meng-compile file Tailwind CSS dari `src/styles/app.css` ke `public/css/app.css` |
| `npm test` | Menjalankan unit test AudioManager & BgmManager |
| `npm run player` | Menjalankan background audio daemon (`bin/player.js`) |

---

## Struktur Folder

```
StreamDeck/
├── bin/
│   ├── streamdeck.js        # CLI global executable
│   └── player.js            # Standalone audio daemon (cloud receiver)
├── media/                   # Direktori audio lokal (di-ignore oleh git)
│   ├── sounds/              # File audio Soundboard (.mp3, .wav, .ogg, dll)
│   └── bgm/                 # File musik latar BGM continuous looper
├── public/                  # Static frontend served ke browser
│   ├── css/
│   │   └── app.css          # Hasil compile minified Tailwind CSS
│   ├── js/                  # Native ES Modules
│   │   ├── app.js           # Main UI bootstrap & event wiring
│   │   ├── audio.js         # Client browser HTML5 Audio engine
│   │   ├── deck.js          # DOM renderer (Scenes, Soundboard, BGM, Mixer)
│   │   ├── socket.js        # Socket.IO client gateway & event dispatcher
│   │   └── state.js         # Reactive state, theme, haptic, & wakelock
│   ├── favicon.svg          # Favicon
│   ├── index.html           # Single-page application entrypoint
│   └── manifest.json        # PWA configuration
├── scripts/
│   ├── generateSounds.js    # Generator suara PCM WAV matematis
│   ├── generateBgm.js       # Generator musik lo-fi WAV loop
│   └── optimizeAssets.js    # FFmpeg auto-trim tool
├── src/
│   ├── config/              # Dynamic config layer & in-code defaults
│   │   ├── defaults.js      # Base settings (port, obs, volume)
│   │   └── index.js         # Config getter, updater, & env overlay
│   ├── routes/
│   │   └── api.js           # Express REST endpoints & Multer upload
│   ├── services/            # Pure domain services
│   │   ├── audioManager.js  # Host playback, ducking, & process cache
│   │   ├── bgmManager.js    # Seamless BGM looper & volume engine
│   │   ├── networkUtils.js  # IP discovery & Tailscale QR generator
│   │   └── obsManager.js    # OBS WebSocket v5 EventEmitter client
│   ├── sockets/
│   │   └── index.js         # Realtime gateway & instant broadcast router
│   ├── styles/
│   │   └── app.css          # Tailwind source directives & CSS variables
│   └── main.js              # Application entrypoint
├── test/
│   └── audioManager.test.js # Self-seeding integration test suite
├── Dockerfile               # Production container definition
├── docker-compose.yml       # Container orchestration
├── install.sh               # Linux/macOS installer & auto-sync
├── install.bat              # Windows installer & auto-sync
└── package.json
```

---

## Troubleshooting & FAQ

#### 1. HP tidak bisa membuka alamat web / loading lama
- Pastikan HP dan PC berada di satu router Wi-Fi yang sama (atau keduanya terhubung ke Tailscale yang sama).
- Periksa **Windows Firewall**: Buka *Windows Defender Firewall* -> izinkan Node.js berkomunikasi di jaringan privat/publik.

#### 2. Status OBS menampilkan "OBS Off"
- Pastikan aplikasi OBS Studio sudah terbuka di PC.
- Pastikan opsi *Enable WebSocket server* di OBS Studio sudah dicentang (Port `4455`).
- Jika menggunakan password, masukkan password di tab **Settings** web StreamDeck lalu klik **Hubungkan ke OBS**.

#### 3. Suara tidak berbunyi di speaker
- Jika menggunakan server lokal: pastikan volume speaker PC Anda aktif.
- Jika menggunakan server cloud (VPS): jalankan `node bin/player.js http://url-cloud` di PC lokal Anda, atau aktifkan toggle **Audio Client** pada tab Settings di browser HP.
