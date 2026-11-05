const fs = require('fs');
const path = require('path');
const { DEFAULT_CONFIG } = require('./defaults');

const RUNTIME_PATH = path.resolve(__dirname, '../../config/runtime.json');
let cachedConfig = null;

function loadConfig() {
  const defaults = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

  if (process.env.PORT) defaults.server.port = parseInt(process.env.PORT, 10) || 3000;
  if (process.env.OBS_HOST) defaults.obs.host = process.env.OBS_HOST;
  if (process.env.OBS_PORT) defaults.obs.port = parseInt(process.env.OBS_PORT, 10) || 4455;
  if (process.env.OBS_PASSWORD !== undefined) defaults.obs.password = process.env.OBS_PASSWORD;

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
  try {
    const dir = path.dirname(RUNTIME_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(RUNTIME_PATH, JSON.stringify(cfg, null, 2), 'utf8');
  } catch (err) {
    console.warn('[Config] Runtime config not saved to disk (in-memory only):', err.message);
  }
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
  DEFAULT_CONFIG,
  getConfig,
  saveConfig,
  updateConfig
};
