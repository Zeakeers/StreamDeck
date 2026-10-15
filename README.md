# DIY Stream Deck Web (Lokal & Tanpa Domain)

Aplikasi Stream Deck berbasis web lokal untuk mengubah HP bekas (atau device kedua apapun) menjadi kontroler shortcut OBS Studio, Soundboard, dan BGM Player melalui browser jaringan lokal (LAN / Wi-Fi).

UI dirancang clean dan minimalis mengadopsi gaya antarmuka **YouTube & Instagram Dark/Light Mode** menggunakan Tailwind CSS, tanpa warna neon berlebih.

---

## Daftar Isi
- [Fitur Utama](#fitur-utama)
- [Persyaratan Sistem (Prasyarat)](#persyaratan-sistem-prasyarat)
- [Cara Instalasi di Device/PC Lain](#cara-instalasi-di-devicepc-lain)
- [Cara Menjalankan](#cara-menjalankan)
- [Pengaturan OBS Studio](#pengaturan-obs-studio)
- [Penggunaan di HP Bekas](#penggunaan-di-hp-bekas)
- [Fitur Audio & BGM Looper](#fitur-audio--bgm-looper)
- [Troubleshooting & FAQ](#troubleshooting--faq)
- [Struktur Folder](#struktur-folder)

---

## Fitur Utama

- **100% Offline / Jaringan Lokal:** Berjalan tanpa domain dan tanpa internet. Cukup satu jaringan Wi-Fi/LAN antara PC dan HP.
- **Koneksi Otomatis OBS Studio:** Terhubung via OBS WebSocket v5 bawaan OBS 28+.
- **Ganti Scene Real-time:** Deteksi scene otomatis dengan highlight scene yang sedang aktif (*program output*).
- **Audio Soundboard PC:** Diputar langsung di PC host sehingga otomatis masuk ke output stream OBS.
- **BGM Background Music Looper:**
  - Looping audio tanpa henti secara otomatis.
  - Berganti lagu seketika saat lagu lain ditekan.
  - Tombol **STOP BGM** untuk mematikan musik latar.
- **Auto-Ducking dengan Transisi Cepat:** Volume BGM mengecil secara otomatis (*fade out*) saat Soundboard dibunyikan, lalu kembali normal (*fade in*) saat Soundboard selesai.
- **Dual Volume Slider Independen:** Pengatur volume Soundboard dan BGM yang dapat digeser manual kapan saja.
- **Kelola File Langsung via Web:** Upload, ubah nama, dan hapus file Soundboard maupun BGM langsung dari layar HP tanpa buka Windows Explorer.
- **Gesture Swipe Antar-Deck:** Geser layar ke kiri atau kanan untuk berpindah antara Scenes dan Soundboard (aman, tidak kebablasan ke menu lain).
- **Light & Dark Mode:** Pilihan tema Gelap atau Terang gaya YouTube/Instagram yang tersimpan di memori HP.
- **Optimasi HP Bekas:** Screen WakeLock (mencegah layar redup otomatis), Fullscreen, dan Haptic Feedback (getar tombol).

---

## Persyaratan Sistem (Prasyarat)

Sebelum memasang di PC baru, pastikan terpasang:
1. **Node.js** (Versi 18 LTS ke atas atau v20 / v22): [Download di nodejs.org](https://nodejs.org/)
2. **OBS Studio** (Versi 28 ke atas sudah built-in WebSocket v5): [Download di obsproject.com](https://obsproject.com/)
3. **Koneksi Wi-Fi / Router Lokal:** PC dan HP harus terhubung ke Wi-Fi / hotspot yang sama.

---

## Cara Instalasi di Device/PC Lain

### Opsi A: Menggunakan Git (Direkomendasikan)
1. Buka Command Prompt (CMD) atau Terminal di PC baru.
2. Clone repository resmi:
   ```bash
   git clone https://github.com/Zeakeers/StreamDeck.git streamdeck
   cd streamdeck
   ```
3. Pasang dependency:
   ```bash
   npm install
   ```
4. *(Opsional)* Generate sample audio awal jika folder `sounds/` dan `bgm/` masih kosong:
   ```bash
   npm run gen-sounds
   node scripts/generateBgm.js
   ```
5. Daftarkan perintah shortcut global (agar bisa dipanggil cukup dengan mengetik `streamdeck`):
   ```bash
   npm link
   ```

---

### Opsi B: Pindah File Manual (Copy-Paste / Flashdisk / ZIP)
1. Copy seluruh folder project `streamdeck` ke PC baru (kecuali folder `node_modules` jika ukurannya terlalu besar).
2. Buka folder tersebut di Command Prompt (CMD):
   ```bash
   cd "C:\path\ke\folder\streamdeck"
   ```
3. Jalankan instalasi dependency:
   ```bash
   npm install
   ```
4. Daftarkan perintah shortcut global:
   ```bash
   npm link
   ```

---

## Cara Menjalankan

### Cara 1: Perintah Langsung (Bisa dari folder mana saja)
Buka CMD atau PowerShell baru, lalu ketik:
```bash
streamdeck
```

### Cara 2: Klik Ganda
Klik 2x file `start.bat` yang ada di dalam folder project.

### Cara 3: Melalui NPM
```bash
npm start
```

Terminal akan menampilkan:
- URL lokal PC (`http://localhost:3000`)
- URL jaringan untuk HP (contoh: `http://192.168.1.10:3000`)
- **QR Code interaktif** yang bisa langsung discan kamera HP.

---

## Pengaturan OBS Studio

Cukup lakukan sekali saat pertama kali di PC baru:
1. Buka **OBS Studio**.
2. Masuk ke menu **Tools (Alat)** pada bilah atas -> pilih **WebSocket Server Settings**.
3. Centang kotak **Enable WebSocket server**.
4. Port default adalah `4455`.
5. Pengaturan Autentikasi:
   - **Paling Praktis:** Hilangkan centang pada **Enable Authentication** (tanpa password) -> klik **Apply/OK**.
   - **Dengan Password:** Jika dicentang, klik **Show Connect Info** untuk melihat password. Masukkan password tersebut di tab **Setting** pada browser HP kamu lalu klik **Hubungkan ke OBS**.

---

## Penggunaan di HP Bekas

1. Sambungkan HP ke **Wi-Fi yang sama** dengan PC.
2. Buka kamera HP dan scan QR Code di terminal (atau ketik URL IP PC ke browser Chrome/Safari).
3. **Mode Layar Penuh:** Tekan ikon kotak (Fullscreen) di pojok kanan atas.
4. **Cegah Layar Tidur:** Tekan ikon gembok/layar (Wake Lock) di kanan atas agar layar HP tidak mati saat live streaming.
5. **Navigasi Geser:** Geser layar ke kiri atau kanan untuk berpindah antara tab **Scenes** dan **Soundboard**.

---

## Fitur Audio & BGM Looper

### Mengunggah Audio Baru
- **Soundboard:** Masuk ke tab Soundboard -> klik `+ Upload Audio` -> pilih file suara (`.mp3`, `.wav`, `.ogg`, `.m4a`).
- **BGM Looper:** Beralih ke sub-tab `BGM Looper` -> klik `+ Upload BGM` -> pilih file musik latar.
- Nama file dengan spasi, huruf non-alfabet (Jepang, Korea, dll.) otomatis aman diproses.

### Mengedit / Menghapus Lagu
- Klik tombol **Kelola** pada tab Soundboard atau BGM.
- Tekan ikon pensil untuk mengganti nama, atau ikon sampah untuk menghapus file.
- Tekan **Selesai** untuk kembali ke mode tombol biasa.

---

## Troubleshooting & FAQ

#### 1. "HP tidak bisa membuka alamat web / loading terus"
- Pastikan HP dan PC berada di satu router/Wi-Fi yang sama.
- Periksa Firewall Windows: Izinkan Node.js berkomunikasi di jaringan privat melalui *Windows Defender Firewall*.

#### 2. "OBS Status menampilkan OBS Off"
- Pastikan OBS Studio sudah dibuka.
- Pastikan opsi *Enable WebSocket server* di OBS sudah dicentang (Port `4455`).

#### 3. "Suara tidak terdengar saat ditekan"
- Suara sengaja diputar langsung melalui speaker/audio PC agar masuk ke Desktop Audio OBS. Pastikan volume PC Anda tidak dalam kondisi mute.

---

## Struktur Folder

```
streamdeck/
├── bin/
│   └── streamdeck.js     # Entry point command line runner
├── lib/
│   ├── audioManager.js   # Pemutar audio PC, auto-ducking & soundboard
│   ├── bgmManager.js     # Pemutar BGM continuous loop & fade engine
│   ├── networkUtils.js   # Deteksi IP lokal & QR code terminal
│   └── obsManager.js     # WebSocket client OBS v5
├── public/
│   ├── app.js            # Frontend logic & WebSocket client
│   ├── index.html        # UI Stream Deck (YouTube/Instagram style)
│   ├── tailwind.css      # Hasil compile Tailwind CSS (offline-ready)
│   ├── favicon.svg       # Favicon web
│   └── manifest.json     # PWA manifest
├── sounds/               # Direktori audio efek Soundboard
├── bgm/                  # Direktori file musik latar BGM
├── scripts/
│   ├── generateSounds.js # Generator sample suara bawaan
│   └── generateBgm.js    # Generator sample BGM bawaan
├── src/
│   └── input.css         # Source Tailwind CSS & theme tokens
├── config.json           # Konfigurasi port server & OBS
├── server.js             # Backend server Express & Socket.io
├── start.bat             # Shortcut double-click untuk Windows
├── streamdeck.cmd        # Wrapper Windows executable
├── tailwind.config.js    # Konfigurasi Tailwind CSS
└── package.json
```
