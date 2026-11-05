#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { io } = require('socket.io-client');
const AudioManager = require('../src/services/audioManager');
const BgmManager = require('../src/services/bgmManager');

// ponytail: CLI daemon connects to cloud StreamDeck; upgrade to bidirectional OBS relay if local OBS bridging needed
const rootDir = path.resolve(__dirname, '..');
process.chdir(rootDir);

const serverUrl = process.env.STREAMDECK_SERVER || process.argv[2] || 'http://100.83.249.40:3001';
const soundsDir = path.join(rootDir, 'media', 'sounds');
const bgmDir = path.join(rootDir, 'media', 'bgm');

const localSounds = new Set(fs.existsSync(soundsDir) ? fs.readdirSync(soundsDir) : []);
const localBgm = new Set(fs.existsSync(bgmDir) ? fs.readdirSync(bgmDir) : []);

const audio = new AudioManager(soundsDir);
const bgm = new BgmManager(bgmDir);
audio.setBgmManager(bgm);

function downloadIfMissing(dir, filename, subpath) {
  return new Promise((resolve) => {
    const fullPath = path.join(dir, filename);
    if (fs.existsSync(fullPath)) return resolve(fullPath);

    const fileUrl = `${serverUrl.replace(/\/$/, '')}/${subpath}/${encodeURIComponent(filename)}`;
    const client = fileUrl.startsWith('https') ? https : http;

    console.log(`[Audio Daemon] Fetching missing asset: ${filename}`);
    const dest = fs.createWriteStream(fullPath);
    client.get(fileUrl, (res) => {
      if (res.statusCode !== 200) {
        fs.unlink(fullPath, () => {});
        return resolve(null);
      }
      res.pipe(dest);
      dest.on('finish', () => {
        dest.close();
        audio.invalidateCache();
        bgm.invalidateCache();
        resolve(fullPath);
      });
    }).on('error', () => {
      fs.unlink(fullPath, () => {});
      resolve(null);
    });
  });
}

console.log('='.repeat(54));
console.log('   STREAMDECK LOCAL AUDIO DAEMON (CLOUD RECEIVER)   ');
console.log('='.repeat(54));
console.log(` Target Server : ${serverUrl}`);
console.log(' Connecting to cloud controller...');
console.log('='.repeat(54));

const socket = io(serverUrl, {
  reconnection: true,
  reconnectionDelay: 1000,
  transports: ['websocket'] // Force WebSocket transport (skip polling negotiation, saves ~150ms handshake)
});

socket.on('connect', () => {
  console.log(`[Audio Daemon] Connected to ${serverUrl} (Socket ID: ${socket.id})`);
  console.log('[Audio Daemon] Ready. Zero-latency in-memory cache enabled.\n');
});

socket.on('disconnect', (reason) => {
  console.warn(`[Audio Daemon] Disconnected (${reason}). Reconnecting...`);
});

socket.on('connect_error', (err) => {
  console.error(`[Audio Daemon] Connection error: ${err.message}`);
});

socket.on('sound:started', (data) => {
  if (!data?.filename) return;
  const vol = typeof data.volume === 'number' ? data.volume : 0.8;
  console.log(`[Audio Daemon] ${new Date().toISOString()} -> Play SFX: ${data.filename} (Vol: ${Math.round(vol * 100)}%)`);
  if (localSounds.has(data.filename)) {
    // Instant zero-delay memory playback (<1ms)
    audio.play(data.filename, vol).catch(console.error);
    return;
  }

  downloadIfMissing(soundsDir, data.filename, 'sounds').then((fullPath) => {
    if (fullPath) {
      localSounds.add(data.filename);
      audio.play(data.filename, vol).catch(console.error);
    }
  });
});

socket.on('sound:stopped', () => {
  audio.stopAll();
});

socket.on('bgm:state', (state) => {
  if (!state) return;

  if (state.isPlaying && state.currentTrack) {
    if (bgm.currentTrack !== state.currentTrack) {
      if (localBgm.has(state.currentTrack)) {
        bgm.play(state.currentTrack).catch(console.error);
      } else {
        downloadIfMissing(bgmDir, state.currentTrack, 'bgm').then((fullPath) => {
          if (fullPath) {
            localBgm.add(state.currentTrack);
            bgm.play(state.currentTrack).catch(console.error);
          }
        });
      }
    }

    const targetVol = state.currentVolume ?? state.baseVolume ?? 0.5;
    if (state.isDucked) {
      bgm.duck();
    } else {
      bgm.setVolume(targetVol);
    }
  } else if (!state.isPlaying && bgm.isPlaying) {
    bgm.stop();
  }
});

process.on('SIGINT', () => {
  audio.stopAll();
  bgm.stop();
  socket.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  audio.stopAll();
  bgm.stop();
  socket.close();
  process.exit(0);
});
