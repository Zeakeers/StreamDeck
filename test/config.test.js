const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  DEFAULT_CONFIG,
  getConfig,
  updateConfig,
  saveConfig,
  loadConfig
} = require('../src/config');

// 1. DEFAULT_CONFIG structure
assert.strictEqual(typeof DEFAULT_CONFIG.server.port, 'number');
assert.strictEqual(typeof DEFAULT_CONFIG.obs.host, 'string');
assert.strictEqual(typeof DEFAULT_CONFIG.obs.port, 'number');
assert.strictEqual(typeof DEFAULT_CONFIG.soundboard.volume, 'number');
assert.strictEqual(typeof DEFAULT_CONFIG.bgm.volume, 'number');

// 2. getConfig() returns current valid config
const cfg = getConfig();
assert.ok(cfg.server && cfg.obs && cfg.soundboard && cfg.bgm);
assert.strictEqual(typeof cfg.server.port, 'number');

// 3. updateConfig() partial deep merge
const originalVol = cfg.soundboard.volume;
const updated = updateConfig({
  soundboard: { volume: 0.95 },
  obs: { password: 'secret-test-pass' }
});

assert.strictEqual(updated.soundboard.volume, 0.95);
assert.strictEqual(updated.obs.password, 'secret-test-pass');
assert.strictEqual(getConfig().soundboard.volume, 0.95);

// Revert back
updateConfig({
  soundboard: { volume: originalVol },
  obs: { password: '' }
});
assert.strictEqual(getConfig().soundboard.volume, originalVol);

// 4. loadConfig() handles env overrides
const prevPort = process.env.PORT;
try {
  process.env.PORT = '4050';
  const loaded = loadConfig();
  assert.strictEqual(loaded.server.port, 4050);
} finally {
  if (prevPort !== undefined) {
    process.env.PORT = prevPort;
  } else {
    delete process.env.PORT;
  }
}

console.log('config tests passed.');
