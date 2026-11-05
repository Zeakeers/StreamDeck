#!/usr/bin/env node
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');
const { io } = require('socket.io-client');
const AudioManager = require('../lib/audioManager');
const BgmManager = require('../lib/bgmManager');

// ponytail: CLI daemon connects to cloud StreamDeck; upgrade to bidirectional OBS relay if local OBS bridging needed
const rootDir = path.resolve(__dirname, '..');
process.chdir(rootDir);

const serverUrl = process.env.STREAMDECK_SERVER || process.argv[2] || 'http://100.83.249.40:3001';
const soundsDir = path.join(rootDir, 'sounds');
const bgmDir = path.join(rootDir, 'bgm');

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
  reconnectionDelay: 2000
});

socket.on('connect', () => {
  console.log(`[Audio Daemon] Connected to ${serverUrl} (Socket ID: ${socket.id})`);
  console.log('[Audio Daemon] Ready. Audio will play through local speakers when triggered from cloud.\n');
});

socket.on('disconnect', (reason) => {
  console.warn(`[Audio Daemon] Disconnected (${reason}). Reconnecting...`);
});

socket.on('connect_error', (err) => {
  console.error(`[Audio Daemon] Connection error: ${err.message}`);
});

socket.on('sound:started', async (data) => {
  if (!data?.filename) return;
  const vol = typeof data.volume === 'number' ? data.volume : 0.8;
  console.log(`[Audio Daemon] Play SFX: ${data.filename} (Vol: ${Math.round(vol * 100)}%)`);

  await downloadIfMissing(soundsDir, data.filename, 'sounds');
  try {
    await audio.play(data.filename, vol);
  } catch (err) {
    console.error(`[Audio Daemon] Failed to play ${data.filename}:`, err.message);
  }
});

socket.on('sound:stopped', () => {
  console.log('[Audio Daemon] Stop all SFX');
  audio.stopAll();
});

socket.on('bgm:state', async (state) => {
  if (!state) return;

  if (state.isPlaying && state.currentTrack) {
    if (bgm.currentTrack !== state.currentTrack) {
      console.log(`[Audio Daemon] Play BGM: ${state.currentTrack}`);
      await downloadIfMissing(bgmDir, state.currentTrack, 'bgm');
      try {
        await bgm.play(state.currentTrack);
      } catch (err) {
        console.error(`[Audio Daemon] Failed BGM play:`, err.message);
      }
    }

    const targetVol = state.currentVolume ?? state.baseVolume ?? 0.5;
    if (state.isDucked) {
      bgm.duck();
    } else {
      bgm.setVolume(targetVol);
    }
  } else if (!state.isPlaying && bgm.isPlaying) {
    console.log('[Audio Daemon] Stop BGM');
    bgm.stop();
  }
});

process.on('SIGINT', () => {
  console.log('\n[Audio Daemon] Stopping audio...');
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
