# DIY Stream Deck Web

Aplikasi Stream Deck modern berbasis web untuk mengubah smartphone (Android/iOS/tablet) menjadi kontroler shortcut **OBS Studio**, **Soundboard**, dan **BGM Player** melalui jaringan lokal (LAN / Wi-Fi) maupun cloud (Tailscale / VPS).

UI dirancang clean dan minimalis mengadopsi gaya antarmuka **YouTube & Instagram Dark/Light Mode** menggunakan Tailwind CSS, tanpa warna neon berlebih.

---

## Daftar Isi
- [Fitur Utama](#fitur-utama)
- [Arsitektur Proyek](#arsitektur-proyek)
- [Prasyarat Sistem](#prasyarat-sistem)
- [Panduan Instalasi & Penggunaan](#panduan-instalasi--penggunaan)
  - [Instalasi Cepat (Linux / macOS)](#1-instalasi-cepat-linux--macos)
  - [Instalasi Cepat (Windows)](#2-instalasi-cepat-windows)
  - [Opsi Docker / VPS Cloud](#3-opsi-docker--vps-cloud)
- [Penggunaan Local Audio Player (CLI Daemon)](#penggunaan-local-audio-player-cli-daemon)
  - [Di Linux / macOS](#di-linux--macos)
  - [Di Windows](#di-windows)
- [Sistem Sinkronisasi Otomatis (Auto-Sync)](#sistem-sinkronisasi-otomatis-auto-sync)
- [Pengaturan OBS Studio](#pengaturan-obs-studio)
- [Cara Penggunaan di Smartphone](#cara-penggunaan-di-smartphone)
- [Daftar Perintah (Scripts)](#daftar-perintah-scripts)
- [Struktur Folder](#struktur-folder)
- [Troubleshooting & FAQ](#troubleshooting--faq)

---

## Fitur Utama

- **Scroll-Safe Tap Interaction**: Tombol soundboard dan scene dilengkapi gesture disambiguation (`attachTapListener`). Menggeser/men-scroll layar HP tidak akan memicu suara secara tidak sengaja.
- **Zero-Latency Soundboard**: Respon instan (<15ms) berkat cache lokal in-memory dan event broadcast non-blocking via WebSocket.
- **BGM Continuous Looper & Live Volume Control**:
  - Pemutaran musik latar looping otomatis tanpa henti.
  - **Live Volume & Auto-Ducking**: Slider volume BGM terhubung real-time. Volume BGM otomatis mengecil halus (ducking) saat soundboard berbunyi, lalu kembali normal.
  - Kontrol volume native di Windows (PowerShell Media Foundation) dan Linux (PipeWire / PulseAudio `pactl`).
- **Dedicated CLI Audio Sink (`streamdeck-player`)**:
  - Audio diputar khusus melalui speaker PC lokal streamer melalui daemon CLI ringan (~25MB RAM).
  - Browser smartphone hanya bertindak sebagai kontroler tombol murni (tanpa membunyikan speaker HP).
- **Auto-Sync Media**:
  - Pre-sync otomatis saat instalasi dan saat `streamdeck-player` pertama kali dinyalakan.
  - Live auto-download saat ada file baru diunggah melalui dashboard web.
- **Dukungan Cloud & Tailscale**:
  - Server web dapat di-host di VPS / server remote (Docker).
  - Auto-detect IP Tailscale (`100.x.x.x`) dan mencetak QR Code khusus di terminal.
- **Kontrol Penuh OBS Studio**: Ganti scene real-time, toggle Mute Mic, toggle Start/Stop Streaming & Recording.
- **Optimasi Mobile / PWA**: Fullscreen mode, Screen WakeLock (mencegah layar redup), dan Haptic feedback getar.

---

## Arsitektur Proyek

```
┌─────────────────────────────────┐
│     Smartphone / Browser UI     │ (Web Controller Surface)
│  - Scenes Grid   - Soundboard   │ - Zero browser audio output
│  - BGM Looper    - Audio Mixer  │ - Touch & scroll disambiguation
└────────────────┬────────────────┘
                 │ WebSocket (Socket.IO)
┌────────────────▼────────────────┐
│   StreamDeck Core Web Server    │ (Node.js / Docker Cloud or Local)
│   - Port 3000 / 3001            │ - Manages OBS WebSocket state
│   - Express REST API & Multer   │ - Broadcasts sound & BGM events
└────────────────┬────────────────┘
                 │ WebSocket + HTTP Asset Stream
┌────────────────▼────────────────┐
│   Local Audio Player Daemon     │ (streamdeck-player CLI on PC)
│   - Windows (PowerShell WMP)    │ - In-memory pre-cached audio sink
│   - Linux (pw-play/paplay/pactl)│ - Background service / terminal runner
└─────────────────────────────────┘
```

---

## Prasyarat Sistem

1. **Node.js**: Versi 18 LTS atau 20+ ([Download Node.js](https://nodejs.org/)).
2. **OBS Studio**: Versi 28 ke atas (memiliki OBS WebSocket v5 bawaan) ([Download OBS](https://obsproject.com/)).
3. **Koneksi Jaringan**: PC dan HP terhubung ke Wi-Fi yang sama, atau terhubung via Tailscale.

---

## Panduan Instalasi & Penggunaan

### 1. Instalasi Cepat (Linux / macOS)

Jalankan script installer:
```bash
./install.sh
```
Atau langsung tentukan URL server tujuan:
```bash
./install.sh http://ip-server:3001
```

Script akan:
1. Memasang dependensi (`npm install`).
2. Mendaftarkan perintah global terminal (`streamdeck` dan `streamdeck-player`).
3. Men-sinkronkan semua file audio secara otomatis dari server.
4. Menyiapkan systemd user service `streamdeck-player.service` (opsional diaktifkan).

---

### 2. Instalasi Cepat (Windows)

1. Double-click file **`install.bat`** (atau jalankan di Command Prompt / PowerShell).
2. Masukkan URL server controller (default `http://localhost:3000` atau URL VPS).

Script akan:
1. Memasang dependensi & mendaftarkan command global Windows (`npm link`).
2. Men-download semua aset media yang ada di server ke PC lokal.
3. Menghasilkan shortcut background player:
   - **`start-player.vbs`**: Menjalankan player di latar belakang tanpa jendela CMD.
   - **`stop-player.bat`**: Menghentikan player di latar belakang.

---

### 3. Opsi Docker / VPS Cloud

Jika menjalankan server web StreamDeck di VPS / Docker:
```bash
docker compose up -d --build
```
Port default container adalah `3001` (dapat disesuaikan di `docker-compose.yml`).

---

## Penggunaan Local Audio Player (CLI Daemon)

Audio daemon bertugas menerima sinyal dari controller HP dan membunyikan soundboard/BGM langsung ke speaker PC Anda.

### Di Linux / macOS

**Opsi 1: Menjalankan di Terminal (Foreground dengan Log Real-time)**
```bash
streamdeck-player
# atau dengan URL server spesifik:
streamdeck-player http://100.83.249.40:3001
```

**Opsi 2: Menjalankan sebagai Background Service (Systemd)**
```bash
# Nyalakan service saat dibutuhkan:
systemctl --user start streamdeck-player

# Cek status / log:
systemctl --user status streamdeck-player
journalctl --user -u streamdeck-player -f

# Matikan service:
systemctl --user stop streamdeck-player

# (Opsional) Nyalakan otomatis setiap kali login:
systemctl --user enable streamdeck-player
```

---

### Di Windows

**Opsi 1: Menjalankan di Terminal (Command Prompt / PowerShell)**
Buka CMD / PowerShell di mana saja:
```cmd
streamdeck-player
REM atau dengan URL server:
streamdeck-player http://100.83.249.40:3001
```
*Tekan `Ctrl + C` untuk berhenti.*

**Opsi 2: Menjalankan di Background (Tanpa Jendela Terminal)**
1. Double-click **`start-player.vbs`** di folder project. Daemon akan berjalan di latar belakang secara hening.
2. Untuk mematikan: double-click **`stop-player.bat`**.
3. *(Opsional auto-start on boot)*: Tekan `Win + R`, ketik `shell:startup`, lalu paste shortcut `start-player.vbs` ke folder tersebut.

---

## Sistem Sinkronisasi Otomatis (Auto-Sync)

`streamdeck-player` dilengkapi mekanisme sync cerdas agar tombol pertama yang ditekan tidak mengalami delay download:

1. **Startup Pre-Sync**: Saat pertama kali terhubung ke server, daemon membandingkan katalog file server dengan folder lokal `media/sounds` dan `media/bgm`. File yang belum ada langsung di-download sebelum controller aktif digunakan.
2. **Live Upload Auto-Sync**: Saat streamer atau moderator mengunggah SFX atau BGM baru via dashboard web, daemon menerima socket broadcast (`sounds:updated` / `bgm:updated`) dan langsung mengunduh file baru tersebut di background.

---

## Pengaturan OBS Studio

Lakukan langkah ini sekali di OBS PC Anda:
1. Buka **OBS Studio**.
2. Masuk ke menu **Tools (Alat)** -> **WebSocket Server Settings**.
3. Centang **Enable WebSocket server** (Port default `4455`).
4. Pengaturan Autentikasi:
   - **Tanpa Password**: Hilangkan centang pada **Enable Authentication** -> klik **Apply/OK**.
   - **Dengan Password**: Jika dicentang, klik **Show Connect Info** untuk menyalin password. Masukkan password tersebut pada tab **Settings** di web StreamDeck, lalu klik **Hubungkan ke OBS**.

---

## Cara Penggunaan di Smartphone

1. Sambungkan HP ke jaringan Wi-Fi yang sama dengan PC (atau nyalakan Tailscale di HP).
2. Scan QR Code di terminal menggunakan kamera HP (atau buka URL server di Chrome/Safari).
3. **Mode Fullscreen**: Tekan ikon layar penuh di pojok kanan atas.
4. **Wake Lock**: Tekan ikon layar/gembok agar layar HP tetap menyala selama streaming.
5. **Navigasi Slider**: Geser layar ke kiri atau kanan untuk berpindah antara tab **Scenes** dan **Soundboard / BGM**.
6. **BGM Mode**: Beralih antara mode **SFX Soundboard** dan **BGM Looper** menggunakan toggle di atas grid audio.

---

## Daftar Perintah (Scripts)

| Perintah | Fungsi |
|---|---|
| `npm start` / `streamdeck` | Menjalankan server aplikasi StreamDeck web (`node src/main.js`) |
| `npm run player` / `streamdeck-player` | Menjalankan audio player daemon (`bin/player.js`) |
| `npm run setup:media` | Men-generate sample suara (.wav) dan BGM looper awal untuk testing |
| `npm run build:css` | Meng-compile dan minify Tailwind CSS dari `src/styles/app.css` ke `public/css/app.css` |
| `npm test` | Menjalankan unit test integration AudioManager & BgmManager |

---

## Struktur Folder

```
StreamDeck/
├── bin/
│   ├── streamdeck.js        # CLI global executable server
│   └── player.js            # Standalone audio daemon & auto-sync engine
├── media/                   # Direktori audio lokal (di-ignore oleh git)
│   ├── sounds/              # File audio Soundboard (.mp3, .wav, .ogg, dll)
│   └── bgm/                 # File musik latar BGM continuous looper
├── public/                  # Static frontend served ke browser smartphone
│   ├── css/
│   │   └── app.css          # Hasil compile minified Tailwind CSS
│   ├── js/                  # Native ES Modules
│   │   ├── app.js           # UI bootstrap, tab switcher & sliders
│   │   ├── audio.js         # Interface audio routing (CLI sink only)
│   │   ├── deck.js          # DOM renderer & gesture-safe tap listeners
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
│   │   ├── audioManager.js  # SFX playback, process caching, ducking triggers
│   │   ├── bgmManager.js    # Seamless BGM looper & platform volume engine
│   │   ├── networkUtils.js  # IP discovery & Tailscale QR generator
│   │   └── obsManager.js    # OBS WebSocket v5 EventEmitter client
│   ├── sockets/
│   │   └── index.js         # Realtime gateway & instant broadcast router
│   ├── styles/
│   │   └── app.css          # Tailwind source directives & CSS variables
│   └── main.js              # Server application entrypoint
├── test/
│   └── audioManager.test.js # Self-seeding integration test suite
├── Dockerfile               # Production container definition
├── docker-compose.yml       # Container orchestration
├── install.sh               # Linux/macOS installer & auto-sync setup
├── install.bat              # Windows installer & auto-sync setup
└── package.json
```

---

## Troubleshooting & FAQ

#### 1. HP tidak bisa membuka alamat web / loading lama
- Pastikan HP dan PC berada di satu router Wi-Fi yang sama (atau keduanya terhubung ke Tailscale yang sama).
- Periksa **Windows Firewall**: Buka *Windows Defender Firewall* -> izinkan Node.js berkomunikasi di jaringan privat/publik.

#### 2. Status OBS menampilkan "OBS Off"
- Pastikan aplikasi OBS Studio sudah terbuka di PC streamer.
- Pastikan opsi *Enable WebSocket server* di OBS Studio sudah dicentang (Port `4455`).
- Jika menggunakan password, masukkan password di tab **Settings** web StreamDeck lalu klik **Hubungkan ke OBS**.

#### 3. Suara tidak berbunyi di speaker saat tombol ditekan
- Pastikan daemon `streamdeck-player` sedang berjalan di PC Anda (di terminal atau via `start-player.vbs`).
- Periksa log terminal `streamdeck-player` untuk memastikan terhubung ke server yang benar (`Target Server : http://...`).
- Jika baru saja mengunggah file baru, periksa apakah file sudah selesai di-sync otomatis oleh player.

#### 4. Men-scroll grid di smartphone memicu suara secara tidak sengaja
- Pastikan Anda menggunakan versi terbaru. Sistem sudah dilengkapi detektor gesture (`attachTapListener`) yang memblokir pemicu suara saat layar digeser $> 8\text{px}$.
