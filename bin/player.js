#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { io } = require('socket.io-client');
const AudioManager = require('../src/services/audioManager');
const BgmManager = require('../src/services/bgmManager');

const rootDir = path.resolve(__dirname, '..');
process.chdir(rootDir);

const nonFlagArgs = process.argv.slice(2).filter((arg) => !arg.startsWith('--'));
const serverUrl = process.env.STREAMDECK_SERVER || nonFlagArgs[0] || 'http://100.83.249.40:3001';
const isSyncOnly = process.argv.includes('--sync-only');

const soundsDir = path.join(rootDir, 'media', 'sounds');
const bgmDir = path.join(rootDir, 'media', 'bgm');

if (!fs.existsSync(soundsDir)) fs.mkdirSync(soundsDir, { recursive: true });
if (!fs.existsSync(bgmDir)) fs.mkdirSync(bgmDir, { recursive: true });

const localSounds = new Set(fs.readdirSync(soundsDir));
const localBgm = new Set(fs.readdirSync(bgmDir));

const audio = new AudioManager(soundsDir);
const bgm = new BgmManager(bgmDir);
audio.setBgmManager(bgm);

function downloadFile(dir, filename, subpath) {
  return new Promise((resolve) => {
    const fullPath = path.join(dir, filename);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).size > 0) {
      return resolve(fullPath);
    }

    const fileUrl = `${serverUrl.replace(/\/$/, '')}/${subpath}/${encodeURIComponent(filename)}`;
    const client = fileUrl.startsWith('https') ? https : http;

    const dest = fs.createWriteStream(fullPath);
    const req = client.get(fileUrl, (res) => {
      if (res.statusCode !== 200) {
        dest.close(() => fs.unlink(fullPath, () => {}));
        return resolve(null);
      }
      res.pipe(dest);
      dest.on('finish', () => {
        dest.close(() => resolve(fullPath));
      });
      dest.on('error', () => {
        fs.unlink(fullPath, () => {});
        resolve(null);
      });
    });

    req.on('error', () => {
      fs.unlink(fullPath, () => {});
      resolve(null);
    });

    req.setTimeout(12000, () => {
      req.destroy();
      fs.unlink(fullPath, () => {});
      resolve(null);
    });
  });
}

let isSyncing = false;
let isInitialSyncDone = false;

async function syncAll(soundsList = [], bgmList = []) {
  if (isSyncing) return;
  isSyncing = true;

  const currentDiskSounds = new Set(fs.existsSync(soundsDir) ? fs.readdirSync(soundsDir) : []);
  const currentDiskBgm = new Set(fs.existsSync(bgmDir) ? fs.readdirSync(bgmDir) : []);

  const missingSounds = (soundsList || [])
    .map((s) => (typeof s === 'string' ? s : s?.filename))
    .filter((name) => name && !currentDiskSounds.has(name));

  const missingBgm = (bgmList || [])
    .map((b) => (typeof b === 'string' ? b : b?.filename))
    .filter((name) => name && !currentDiskBgm.has(name));

  const totalMissing = missingSounds.length + missingBgm.length;

  if (totalMissing === 0) {
    if (!isInitialSyncDone) {
      isInitialSyncDone = true;
      console.log(`[Sync] All assets up to date (${currentDiskSounds.size} sounds, ${currentDiskBgm.size} BGM cached).`);
      console.log('[Sync] Ready for zero-delay instant playback.\n');
    }
    isSyncing = false;
    if (isSyncOnly) {
      socket.close();
      process.exit(0);
    }
    return;
  }

  console.log(`[Sync] Detected ${totalMissing} new/missing asset(s) to sync from server...`);
  let downloadedCount = 0;

  for (const soundName of missingSounds) {
    downloadedCount++;
    process.stdout.write(`[Sync] [${downloadedCount}/${totalMissing}] Fetching SFX: ${soundName}... `);
    const result = await downloadFile(soundsDir, soundName, 'sounds');
    if (result) {
      localSounds.add(soundName);
      console.log('OK');
    } else {
      console.log('FAILED');
    }
  }

  for (const bgmName of missingBgm) {
    downloadedCount++;
    process.stdout.write(`[Sync] [${downloadedCount}/${totalMissing}] Fetching BGM: ${bgmName}... `);
    const result = await downloadFile(bgmDir, bgmName, 'bgm');
    if (result) {
      localBgm.add(bgmName);
      console.log('OK');
    } else {
      console.log('FAILED');
    }
  }

  audio.invalidateCache();
  bgm.invalidateCache();
  isInitialSyncDone = true;
  console.log(`[Sync] Sync complete. ${totalMissing} asset(s) ready for instant playback.\n`);
  isSyncing = false;

  if (isSyncOnly) {
    socket.close();
    process.exit(0);
  }
}

console.log('='.repeat(54));
console.log('   STREAMDECK LOCAL AUDIO DAEMON (CLOUD RECEIVER)   ');
console.log('='.repeat(54));
console.log(` Target Server : ${serverUrl}`);
if (isSyncOnly) {
  console.log(' Mode          : Pre-sync only (download assets & exit)');
}
console.log(' Connecting to cloud controller...');
console.log('='.repeat(54));

const socket = io(serverUrl, {
  reconnection: !isSyncOnly,
  reconnectionDelay: 1000,
  transports: ['websocket']
});

if (isSyncOnly) {
  setTimeout(() => {
    console.warn('[Sync] Pre-sync timeout reached. Continuing installation.');
    socket.close();
    process.exit(0);
  }, 15000);
}

socket.on('connect', () => {
  console.log(`[Audio Daemon] Connected to ${serverUrl} (Socket ID: ${socket.id})`);
  console.log('[Sync] Requesting asset catalog from server...');
});

socket.on('disconnect', (reason) => {
  if (!isSyncOnly) {
    console.warn(`[Audio Daemon] Disconnected (${reason}). Reconnecting...`);
  }
});

socket.on('connect_error', (err) => {
  console.error(`[Audio Daemon] Connection error: ${err.message}`);
  if (isSyncOnly) {
    console.warn('[Sync] Cannot reach server during pre-sync. Daemon will sync on launch.');
    socket.close();
    process.exit(0);
  }
});

// Initial asset catalog sync on connection
socket.on('init:state', (data) => {
  if (data?.sounds || data?.bgm?.tracks) {
    syncAll(data.sounds || [], data.bgm?.tracks || []);
  }
});

// Live upload event from website: soundboard
socket.on('sounds:updated', (sounds) => {
  console.log('[Sync] Soundboard updated on website. Checking for new uploads...');
  syncAll(sounds || [], []);
});

// Live upload event from website: BGM looper
socket.on('bgm:updated', (data) => {
  console.log('[Sync] BGM catalog updated on website. Checking for new uploads...');
  syncAll([], data?.tracks || []);
});

socket.on('sound:started', (data) => {
  if (!data?.filename) return;
  const vol = typeof data.volume === 'number' ? data.volume : 0.8;
  console.log(`[Audio Daemon] ${new Date().toISOString()} -> Play SFX: ${data.filename} (Vol: ${Math.round(vol * 100)}%)`);

  if (localSounds.has(data.filename)) {
    audio.play(data.filename, vol).catch(console.error);
    return;
  }

  downloadFile(soundsDir, data.filename, 'sounds').then((fullPath) => {
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

  const targetVol = typeof state.currentVolume === 'number'
    ? state.currentVolume
    : (typeof state.baseVolume === 'number' ? state.baseVolume : 0.5);

  if (state.isPlaying && state.currentTrack) {
    bgm.baseVolume = targetVol;
    if (bgm.currentTrack !== state.currentTrack) {
      if (localBgm.has(state.currentTrack)) {
        bgm.play(state.currentTrack).catch(console.error);
      } else {
        downloadFile(bgmDir, state.currentTrack, 'bgm').then((fullPath) => {
          if (fullPath) {
            localBgm.add(state.currentTrack);
            bgm.play(state.currentTrack).catch(console.error);
          }
        });
      }
    }

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
