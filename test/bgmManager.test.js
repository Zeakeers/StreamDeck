const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');
const BgmManager = require('../src/services/bgmManager');

// Setup temporary BGM folder
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sd-bgm-test-'));
const sampleTrack = 'sample-loop.mp3';
fs.writeFileSync(path.join(tempDir, sampleTrack), 'ID3-dummy-audio-content');

const bgm = new BgmManager(tempDir, 0.5);

try {
  // 1. getState()
  const st = bgm.getState();
  assert.strictEqual(st.isPlaying, false);
  assert.strictEqual(st.currentTrack, null);
  assert.strictEqual(st.baseVolume, 0.5);
  assert.strictEqual(st.currentVolume, 0.5);
  assert.strictEqual(st.isDucked, false);

  // 2. getTracks() & caching
  const tracks = bgm.getTracks();
  assert.strictEqual(tracks.length, 1);
  assert.strictEqual(tracks[0].filename, sampleTrack);
  assert.strictEqual(tracks[0].extension, 'MP3');
  assert.strictEqual(tracks[0].name, 'Sample Loop');
  assert.strictEqual(tracks[0].isActive, false);

  // Cached retrieval
  assert.strictEqual(bgm.trackCache.length, 1);
  bgm.invalidateCache();
  assert.strictEqual(bgm.trackCache, null);
  assert.strictEqual(bgm.getTracks().length, 1);

  // 3. Volume controls & clamping
  bgm.setVolume(0.8);
  assert.strictEqual(bgm.baseVolume, 0.8);
  assert.strictEqual(bgm.currentVolume, 0.8);

  bgm.setVolume(2.0);
  assert.strictEqual(bgm.baseVolume, 1.0);

  bgm.setVolume(-1.0);
  // 4. Ducking & unducking
  bgm.isPlaying = true;
  bgm.setVolume(0.8);
  bgm.duck(0.25);
  assert.strictEqual(bgm.isDucked, true);

  bgm.unduck();
  assert.strictEqual(bgm.isDucked, false);
  bgm.isPlaying = false;
  assert.strictEqual(bgm.isDucked, false);
  assert.strictEqual(bgm.currentVolume, 0.8);

  // 5. Missing track error
  assert.rejects(async () => bgm.play('nonexistent.mp3'), /File BGM tidak ditemukan/);

  // 6. Stop
  bgm.currentTrack = sampleTrack;
  bgm.isPlaying = true;
  const stopState = bgm.stop();
  assert.strictEqual(stopState.isPlaying, false);
  assert.strictEqual(stopState.currentTrack, null);

  // 7. Rename track
  const renameResult = bgm.renameTrack(sampleTrack, 'Chill Beat');
  assert.strictEqual(renameResult.success, true);
  assert.strictEqual(renameResult.newFilename, 'Chill Beat.mp3');
  assert.ok(fs.existsSync(path.join(tempDir, 'Chill Beat.mp3')));

  // Negative collision scenario
  fs.writeFileSync(path.join(tempDir, 'other-bgm.mp3'), 'dummy-bgm');
  assert.throws(() => bgm.renameTrack('Chill Beat.mp3', 'other-bgm'), /sudah ada/);

  // Invalid rename empty
  assert.throws(() => bgm.renameTrack('Chill Beat.mp3', '   '), /Nama baru tidak valid/);

  // Rename non-existent
  assert.throws(() => bgm.renameTrack('missing.mp3', 'Something'), /tidak ditemukan/);

  // 8. Delete track
  const delResult = bgm.deleteTrack('Chill Beat.mp3');
  assert.strictEqual(delResult.success, true);
  assert.strictEqual(delResult.deleted, 'Chill Beat.mp3');
  assert.strictEqual(fs.existsSync(path.join(tempDir, 'Chill Beat.mp3')), false);

  // Delete non-existent
  assert.throws(() => bgm.deleteTrack('missing.mp3'), /tidak ditemukan/);

  console.log('bgmManager tests passed.');
} finally {
  // Cleanup temp folder
  fs.rmSync(tempDir, { recursive: true, force: true });
}
