const assert = require('assert');

// Setup mock browser globals before importing ES module
const store = new Map();
global.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear()
};

let lastVibration = null;
Object.defineProperty(globalThis.navigator, 'vibrate', {
  value: (ms) => {
    lastVibration = ms;
    return true;
  },
  configurable: true
});

global.document = {
  getElementById: () => null,
  querySelector: () => null,
  documentElement: {
    classList: {
      add: () => {},
      remove: () => {}
    }
  }
};

(async () => {
  const {
    state,
    haptic,
    applyTheme,
    getCurrentTheme,
    saveCustomSources
  } = await import('../public/js/state.js');

  // 1. Initial State
  assert.strictEqual(state.obs.connected, false);
  assert.ok(Array.isArray(state.customSources));

  // 2. haptic()
  haptic(45);
  assert.strictEqual(lastVibration, 45);

  // 3. saveCustomSources()
  const custom = [{ sceneName: 'Scene 1', sceneItemId: 10, sourceName: 'Cam', enabled: true }];
  saveCustomSources(custom);
  assert.deepStrictEqual(state.customSources, custom);
  assert.strictEqual(global.localStorage.getItem('sd_custom_sources'), JSON.stringify(custom));

  // 4. theme
  applyTheme('light');
  assert.strictEqual(getCurrentTheme(), 'light');
  assert.strictEqual(global.localStorage.getItem('sd_theme'), 'light');

  applyTheme('dark');
  assert.strictEqual(getCurrentTheme(), 'dark');
  assert.strictEqual(global.localStorage.getItem('sd_theme'), 'dark');

  console.log('clientState tests passed.');
})();
