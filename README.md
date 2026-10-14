# DIY Stream Deck Web (Lokal & Tanpa Domain)

Aplikasi Stream Deck berbasis web lokal untuk mengubah HP bekas menjadi kontroler shortcut OBS Studio dan Soundboard interaktif melalui browser.

---

## Fitur Utama

- **100% Berjalan di Jaringan Lokal (Offline / LAN):** Tidak perlu domain atau hosting internet. Cukup koneksi Wi-Fi yang sama antara PC dan HP.
- **Koneksi Otomatis ke OBS Studio:** Menggunakan OBS WebSocket v5 bawaan OBS 28+.
- **Ganti Scene Instan:** Tombol scene otomatis terdeteksi dari OBS dengan indikator scene aktif (glowing neon).
- **Soundboard PC Host:** Suara diputar langsung di PC melalui output audio desktop sehingga otomatis terdengar oleh penonton stream di OBS.
- **Kontrol Cepat (Quick Bar):**
  - Toggle Live Streaming
  - Toggle Rekaman (Record)
  - Toggle Mute / Unmute Mikrofon
- **Audio Mixer:** Daftar audio input OBS dan tombol mute masing-masing.
- **Optimasi HP Bekas:**
  - **Gesture Slide / Swipe (Scenes <-> Soundboard):** Geser layar ke kiri atau kanan khusus hanya untuk berpindah antara OBS Scenes dan Soundboard (tidak akan kebablasan ke Audio Mix atau Setting).
  - **Menu Terpisah untuk Audio Mix & Setting:** Menu pengaturan dan audio mixer hanya terbuka jika diklik langsung melalui tombolnya, aman dari geseran tidak sengaja.
  - **Perlindungan Anti-Salah Pencet:** Tombol STREAM dan REC kini dilengkapi dialog konfirmasi sebelum aktif.
  - Fitur **Screen Wake Lock**: Menjaga layar HP tetap menyala agar tidak mati otomatis saat streaming.
  - Mode **Layar Penuh (Fullscreen)**: Menyembunyikan address bar browser.
  - Efek Getar (Haptic Feedback) saat tombol ditekan.
  - Responsif orientasi Landscape (tampilan grid mirip Elgato Stream Deck asli) maupun Portrait.
- **QR Code di Terminal:** Cukup scan QR code dari kamera HP untuk langsung membuka controller.

---

## Cara Menjalankan

### 1. Menjalankan Server di PC
Cukup buka CMD / PowerShell dari folder mana saja, lalu ketik:
```bash
streamdeck
```
*(Bisa juga dengan klik ganda file `start.bat` atau `npm start`)*

### 2. Membuka di HP Bekas
1. Pastikan HP bekas terhubung ke **Wi-Fi yang sama** dengan PC.
2. Buka kamera atau browser di HP, lalu:
   - **Scan QR Code** yang muncul di terminal PC, ATAU
   - Ketik alamat IP yang tertera di terminal (contoh: `http://192.168.18.6:3000`).
3. Tekan ikon **Layar Penuh** (ikon kotak di pojok kanan atas) dan aktifkan **Wake Lock** (ikon matahari) agar layar HP tetap menyala.

---

## Konfigurasi OBS Studio (OBS v28 ke atas)

1. Buka **OBS Studio** di PC.
2. Klik menu **Tools (Alat)** di bilah atas -> pilih **WebSocket Server Settings (Pengaturan Server WebSocket)**.
3. Pastikan kotak **Enable WebSocket server (Aktifkan server WebSocket)** tercentang.
4. Periksa Server Port (default: `4455`).
5. Jika opsi **Enable Authentication (Aktifkan Otentikasi)** dicentang:
   - Klik tombol **Show Connect Info** untuk melihat password.
   - Buka tab **Setting** di layar Stream Deck HP kamu, lalu masukkan password tersebut dan tekan **Hubungkan ke OBS**.
   - *(Atau hilangkan centang Enable Authentication jika ingin langsung konek tanpa password di jaringan rumah).*

---

## Cara Menambah, Mengedit, dan Menghapus Soundboard

Sekarang kamu bisa mengelola soundboard **langsung dari aplikasi web (HP atau PC)**:

1. Buka tab **Soundboard** di HP / PC.
2. **Tambah / Upload Audio:**
   - Klik tombol **`+ Upload Audio`** di bagian atas tab Soundboard.
   - Pilih file audio (`.mp3`, `.wav`, `.ogg`, `.m4a`) dari galeri HP atau file PC kamu. Audio akan langsung terupload dan muncul seketika!
3. **Mengedit Nama Sound:**
   - Klik tombol **`Kelola Sound`** (tombol berubah jadi kuning).
   - Klik ikon **Pensil (Edit)** pada tombol suara yang ingin diubah.
   - Ketik nama baru, lalu klik **Simpan**.
4. **Menghapus Sound:**
   - Dalam mode **`Kelola Sound`**, klik ikon **Tempat Sampah (Hapus)** pada tombol suara yang ingin dihapus.
   - Konfirmasi hapus, file akan langsung terhapus dari soundboard.
5. Klik **`Selesai`** untuk kembali ke mode tekan tombol normal.

---

## Struktur Folder

```
streamdeck/
├── lib/
│   ├── audioManager.js   # Pemutar audio PC & pemindai folder sounds
│   ├── networkUtils.js   # Deteksi IP lokal & generator QR code
│   └── obsManager.js     # Klien OBS WebSocket v5
├── public/
│   ├── app.js            # Logika UI & WebSocket klien
│   ├── index.html        # Halaman antarmuka Stream Deck
│   ├── style.css         # Desain responsif Stream Deck
│   └── manifest.json     # Konfigurasi PWA (Add to Home Screen)
├── sounds/               # Direktori file audio soundboard
├── scripts/
│   └── generateSounds.js # Generator sample suara bawaan
├── config.json           # Konfigurasi port server & OBS
├── server.js             # Server backend Node.js
├── start.bat             # Shortcut sekali klik untuk Windows
└── package.json
```
