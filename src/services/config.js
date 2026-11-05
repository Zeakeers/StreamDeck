const fs = require('fs');
const path = require('path');

const CONFIG_DIR = path.resolve(__dirname, '../../config');
const DEFAULT_PATH = path.join(CONFIG_DIR, 'default.json');
const RUNTIME_PATH = path.join(CONFIG_DIR, 'runtime.json');

let cachedConfig = null;

function loadConfig() {
  const defaults = JSON.parse(fs.readFileSync(DEFAULT_PATH, 'utf8'));
  if (fs.existsSync(RUNTIME_PATH)) {
    try {
      const runtime = JSON.parse(fs.readFileSync(RUNTIME_PATH, 'utf8'));
      cachedConfig = {
        ...defaults,
        ...runtime,
        server: { ...defaults.server, ...(runtime.server || {}) },
        obs: { ...defaults.obs, ...(runtime.obs || {}) },
        soundboard: { ...defaults.soundboard, ...(runtime.soundboard || {}) },
        bgm: { ...defaults.bgm, ...(runtime.bgm || {}) }
      };
      return cachedConfig;
    } catch (_) {}
  }
  cachedConfig = defaults;
  return cachedConfig;
}

function getConfig() {
  if (!cachedConfig) loadConfig();
  return cachedConfig;
}

function saveConfig(cfg) {
  cachedConfig = cfg;
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(RUNTIME_PATH, JSON.stringify(cfg, null, 2), 'utf8');
}

function updateConfig(partial) {
  const current = getConfig();
  const updated = {
    ...current,
    ...partial,
    server: { ...current.server, ...(partial.server || {}) },
    obs: { ...current.obs, ...(partial.obs || {}) },
    soundboard: { ...current.soundboard, ...(partial.soundboard || {}) },
    bgm: { ...current.bgm, ...(partial.bgm || {}) }
  };
  saveConfig(updated);
  return updated;
}

module.exports = {
  getConfig,
  saveConfig,
  updateConfig
};
