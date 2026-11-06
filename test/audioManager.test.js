const assert = require('assert');
const path = require('path');
const AudioManager = require('../src/services/audioManager');
const BgmManager = require('../src/services/bgmManager');

const soundsDir = path.resolve(__dirname, '..', 'media', 'sounds');
const bgmDir = path.resolve(__dirname, '..', 'media', 'bgm');

// Auto-seed sample tones if directories are empty (e.g. fresh git clone)
const audio = new AudioManager(soundsDir);
if (audio.getSounds().length === 0) {
  require('../scripts/generateSounds');
  audio.invalidateCache();
}

const bgm = new BgmManager(bgmDir, 0.6);
audio.setBgmManager(bgm);
if (bgm.getTracks().length === 0) {
  require('../scripts/generateBgm');
  bgm.invalidateCache();
}

// 1. AudioManager caching and retrieval
const sounds1 = audio.getSounds();
assert.ok(Array.isArray(sounds1), 'getSounds must return array');
assert.ok(sounds1.length > 0, 'sounds folder must have items');
assert.strictEqual(audio.soundCache, sounds1, 'soundCache must be populated');

// 2. Cache invalidation
audio.invalidateCache();
assert.strictEqual(audio.soundCache, null, 'invalidateCache must clear cache');
const sounds2 = audio.getSounds();
assert.strictEqual(sounds2.length, sounds1.length, 'reloaded sounds count must match');

// 3. Duration estimator sanity check
const sampleSound = sounds1[0];
const samplePath = path.join(soundsDir, sampleSound.filename);
const dur = audio._estimateDuration(samplePath);
assert.ok(dur > 0 && dur < 60, `Estimated duration (${dur}s) must be reasonable`);

// 4. BgmManager caching and ducking
const tracks = bgm.getTracks();
assert.ok(Array.isArray(tracks), 'getTracks must return array');
assert.ok(tracks.length > 0, 'bgm folder must have items');

// 5. Volume clamping
bgm.setVolume(1.5);
assert.strictEqual(bgm.getState().baseVolume, 1.0, 'Volume must clamp to 1.0');
bgm.setVolume(-0.5);
assert.strictEqual(bgm.getState().baseVolume, 0.0, 'Volume must clamp to 0.0');

// 6. StopAll cleanup
audio.activeSoundCount = 2;
const stopResult = audio.stopAll();
assert.strictEqual(audio.activeSoundCount, 0, 'activeSoundCount must reset to 0');
assert.strictEqual(stopResult.status, 'stopped');

// 7. Missing file play guard
assert.rejects(async () => audio.play('nonexistent-audio-xyz.mp3'), /File audio tidak ditemukan/);

// 8. Rename & Delete sounds in temp directory
const fs = require('fs');
const os = require('os');
const tempAudioDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sd-audio-test-'));
const tempAudio = new AudioManager(tempAudioDir);
const testFile = 'test-horn.mp3';
fs.writeFileSync(path.join(tempAudioDir, testFile), 'audio-bytes');

try {
  assert.strictEqual(tempAudio.getSounds().length, 1);

  const renamed = tempAudio.renameSound(testFile, 'Party Horn');
  assert.strictEqual(renamed.success, true);
  assert.strictEqual(renamed.newFilename, 'Party Horn.mp3');
  assert.ok(fs.existsSync(path.join(tempAudioDir, 'Party Horn.mp3')));

  // Negative collision scenario
  fs.writeFileSync(path.join(tempAudioDir, 'other.mp3'), 'audio-bytes-2');
  assert.throws(() => tempAudio.renameSound('Party Horn.mp3', 'other'), /sudah ada/);

  assert.throws(() => tempAudio.renameSound('Party Horn.mp3', '   '), /Nama baru tidak valid/);
  assert.throws(() => tempAudio.renameSound('missing.mp3', 'Valid Name'), /tidak ditemukan/);

  const deleted = tempAudio.deleteSound('Party Horn.mp3');
  assert.strictEqual(deleted.success, true);
  assert.strictEqual(fs.existsSync(path.join(tempAudioDir, 'Party Horn.mp3')), false);
  assert.throws(() => tempAudio.deleteSound('missing.mp3'), /tidak ditemukan/);
} finally {
  fs.rmSync(tempAudioDir, { recursive: true, force: true });
}

console.log('All tests passed.');
