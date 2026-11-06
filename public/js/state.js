// StreamDeck State & Device Utilities

export const state = {
  obs: {
    connected: false,
    currentScene: '',
    scenes: [],
    audioInputs: [],
    isStreaming: false,
    isRecording: false
  },
  customSources: (() => {
    try {
      return JSON.parse(localStorage.getItem('sd_custom_sources') || '[]');
    } catch (_) {
      return [];
    }
  })(),
  sounds: [],
  bgm: {
    tracks: [],
    state: {
      isPlaying: false,
      currentTrack: null,
      baseVolume: 0.5,
      currentVolume: 0.5,
      isDucked: false
    }
  },
  config: {
    obs: { host: '127.0.0.1', port: 4455, password: '' },
    soundboard: { volume: 0.8 },
    bgm: { volume: 0.5 }
  },
  vibrate: localStorage.getItem('sd_vibrate') !== 'false',
  wakeLock: null
};

export function haptic(ms = 25) {
  if (state.vibrate && 'vibrate' in navigator) {
    try {
      navigator.vibrate(ms);
    } catch (_) {}
  }
}

export function saveCustomSources(sources) {
  state.customSources = sources;
  try {
    localStorage.setItem('sd_custom_sources', JSON.stringify(sources));
  } catch (_) {}
}

let currentTheme = localStorage.getItem('sd_theme') || 'dark';

export function applyTheme(theme) {
  currentTheme = theme;
  localStorage.setItem('sd_theme', theme);

  const themeIconSun = document.getElementById('theme-icon-sun');
  const themeIconMoon = document.getElementById('theme-icon-moon');
  const toggleLightmode = document.getElementById('toggle-lightmode');

  if (theme === 'light') {
    document.documentElement.classList.add('light');
    document.documentElement.classList.remove('dark');
    if (themeIconSun) themeIconSun.classList.add('hidden');
    if (themeIconMoon) themeIconMoon.classList.remove('hidden');
    if (toggleLightmode) toggleLightmode.checked = true;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#ffffff');
  } else {
    document.documentElement.classList.remove('light');
    document.documentElement.classList.add('dark');
    if (themeIconSun) themeIconSun.classList.remove('hidden');
    if (themeIconMoon) themeIconMoon.classList.add('hidden');
    if (toggleLightmode) toggleLightmode.checked = false;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#0f0f0f');
  }
}

export function getCurrentTheme() {
  return currentTheme;
}

export async function requestWakeLock() {
  const btnWake = document.getElementById('btn-wake');
  const toggleWakeLock = document.getElementById('toggle-wakelock');
  if ('wakeLock' in navigator) {
    try {
      state.wakeLock = await navigator.wakeLock.request('screen');
      if (btnWake) btnWake.classList.add('active');
      if (toggleWakeLock) toggleWakeLock.checked = true;
      state.wakeLock.addEventListener('release', () => {
        state.wakeLock = null;
        if (btnWake) btnWake.classList.remove('active');
        if (toggleWakeLock) toggleWakeLock.checked = false;
      });
    } catch (err) {
      console.warn('Wake Lock gagal:', err);
    }
  }
}

export function releaseWakeLock() {
  const btnWake = document.getElementById('btn-wake');
  const toggleWakeLock = document.getElementById('toggle-wakelock');
  if (state.wakeLock) {
    state.wakeLock.release().catch(() => {});
    state.wakeLock = null;
    if (btnWake) btnWake.classList.remove('active');
    if (toggleWakeLock) toggleWakeLock.checked = false;
  }
}
