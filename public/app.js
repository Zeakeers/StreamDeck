// Stream Deck Client Application
const socket = io();

// State
let state = {
  obs: {
    connected: false,
    currentScene: '',
    scenes: [],
    audioInputs: [],
    isStreaming: false,
    isRecording: false
  },
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

// DOM Elements
const obsStatusBadge = document.getElementById('obs-status');
const obsStatusText = document.getElementById('obs-status-text');
const btnFullscreen = document.getElementById('btn-fullscreen');
const btnWake = document.getElementById('btn-wake');
const toggleVibrate = document.getElementById('toggle-vibrate');
const toggleWakeLock = document.getElementById('toggle-wakelock');
const btnThemeToggle = document.getElementById('btn-theme-toggle');
const themeIconSun = document.getElementById('theme-icon-sun');
const themeIconMoon = document.getElementById('theme-icon-moon');
const toggleLightmode = document.getElementById('toggle-lightmode');

const quickStreamBtn = document.getElementById('quick-stream-btn');
const quickRecordBtn = document.getElementById('quick-record-btn');
const quickMuteBtn = document.getElementById('quick-mute-btn');
const streamLabel = document.getElementById('stream-label');
const recordLabel = document.getElementById('record-label');
const muteLabel = document.getElementById('mute-label');

const scenesGrid = document.getElementById('scenes-grid');
const scenesEmpty = document.getElementById('scenes-empty');
const btnRefreshScenes = document.getElementById('btn-refresh-scenes');

// Audio Sub-Mode Switcher
const btnModeSoundboard = document.getElementById('btn-mode-soundboard');
const btnModeBgm = document.getElementById('btn-mode-bgm');
const sectionSoundboard = document.getElementById('section-soundboard');
const sectionBgm = document.getElementById('section-bgm');
const bgmActiveDot = document.getElementById('bgm-active-dot');

// BGM Status Card & Controls
const bgmStatusBar = document.getElementById('bgm-status-bar');
const bgmCurrentTitle = document.getElementById('bgm-current-title');
const bgmStatusBadge = document.getElementById('bgm-status-badge');
const btnStopBgm = document.getElementById('btn-stop-bgm');
const bgmVolSlider = document.getElementById('bgm-vol');
const volBgmVal = document.getElementById('vol-bgm-val');
const soundboardVol = document.getElementById('soundboard-vol');
const volSfxVal = document.getElementById('vol-sfx-val');

// Soundboard Elements
const soundsGrid = document.getElementById('sounds-grid');
const soundsEmpty = document.getElementById('sounds-empty');
const btnStopAll = document.getElementById('btn-stop-all');
const btnManageSounds = document.getElementById('btn-manage-sounds');
const manageLabel = document.getElementById('manage-label');
const btnUploadSound = document.getElementById('btn-upload-sound');
const soundFileInput = document.getElementById('sound-file-input');

// BGM Grid & Management Elements
const bgmGrid = document.getElementById('bgm-grid');
const bgmEmpty = document.getElementById('bgm-empty');
const btnManageBgm = document.getElementById('btn-manage-bgm');
const manageBgmLabel = document.getElementById('manage-bgm-label');
const btnUploadBgm = document.getElementById('btn-upload-bgm');
const bgmFileInput = document.getElementById('bgm-file-input');

// Modal Elements
const renameModal = document.getElementById('rename-modal');
const renameInput = document.getElementById('rename-input');
const btnCancelRename = document.getElementById('btn-cancel-rename');
const btnConfirmRename = document.getElementById('btn-confirm-rename');

let soundEditMode = false;
let bgmEditMode = false;
let currentRenamingItem = null;
let currentRenamingType = 'sound'; // 'sound' | 'bgm'

const audioList = document.getElementById('audio-list');
const mixerEmpty = document.getElementById('mixer-empty');

const obsHostInput = document.getElementById('obs-host');
const obsPortInput = document.getElementById('obs-port');
const obsPasswordInput = document.getElementById('obs-password');
const btnSaveObs = document.getElementById('btn-save-obs');

// Haptic feedback
function haptic(ms = 25) {
  if (state.vibrate && 'vibrate' in navigator) {
    try {
      navigator.vibrate(ms);
    } catch (_) {}
  }
}

// Light Mode & Dark Mode Manager (YouTube / Instagram Themes)
let currentTheme = localStorage.getItem('sd_theme') || 'dark';

function applyTheme(theme) {
  currentTheme = theme;
  localStorage.setItem('sd_theme', theme);

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

// Initialize theme immediately
applyTheme(currentTheme);

if (btnThemeToggle) {
  btnThemeToggle.addEventListener('click', () => {
    haptic(25);
    applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
  });
}

if (toggleLightmode) {
  toggleLightmode.addEventListener('change', (e) => {
    haptic(25);
    applyTheme(e.target.checked ? 'light' : 'dark');
  });
}

// Wake Lock (Keep screen on)
async function requestWakeLock() {
  if ('wakeLock' in navigator) {
    try {
      state.wakeLock = await navigator.wakeLock.request('screen');
      btnWake.classList.add('active');
      toggleWakeLock.checked = true;
      state.wakeLock.addEventListener('release', () => {
        state.wakeLock = null;
        btnWake.classList.remove('active');
        toggleWakeLock.checked = false;
      });
    } catch (err) {
      console.warn('Wake Lock gagal:', err);
    }
  }
}

function releaseWakeLock() {
  if (state.wakeLock) {
    state.wakeLock.release().catch(() => {});
    state.wakeLock = null;
    btnWake.classList.remove('active');
    toggleWakeLock.checked = false;
  }
}

// Fullscreen toggle
btnFullscreen.addEventListener('click', () => {
  haptic();
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
});

btnWake.addEventListener('click', () => {
  haptic();
  if (state.wakeLock) {
    releaseWakeLock();
  } else {
    requestWakeLock();
  }
});

toggleWakeLock.addEventListener('change', (e) => {
  if (e.target.checked) {
    requestWakeLock();
  } else {
    releaseWakeLock();
  }
});

toggleVibrate.checked = state.vibrate;
toggleVibrate.addEventListener('change', (e) => {
  state.vibrate = e.target.checked;
  localStorage.setItem('sd_vibrate', state.vibrate);
});

// Tab Navigation & 2-Slide Deck Slider (HANYA Scenes & Soundboard)
const deckSlider = document.getElementById('deck-slider');
const tabMixer = document.getElementById('tab-mixer');
const tabSettings = document.getElementById('tab-settings');
const tabButtons = Array.from(document.querySelectorAll('.tab-btn'));
const backButtons = document.querySelectorAll('.btn-back-to-deck');

let isSwiping = false;
let touchStartX = 0;
let touchStartY = 0;

// Track touch gestures in deck slider to prevent misclicking buttons while swiping
deckSlider.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  isSwiping = false;
}, { passive: true });

deckSlider.addEventListener('touchmove', (e) => {
  const dx = Math.abs(e.touches[0].clientX - touchStartX);
  const dy = Math.abs(e.touches[0].clientY - touchStartY);
  if (dx > 10 || dy > 10) {
    isSwiping = true;
  }
}, { passive: true });

deckSlider.addEventListener('touchend', () => {
  setTimeout(() => {
    isSwiping = false;
  }, 100);
}, { passive: true });

function setActiveTabButton(targetTabId) {
  tabButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-tab') === targetTabId);
  });
}

function showDeckSlide(index) {
  tabMixer.style.display = 'none';
  tabSettings.style.display = 'none';
  deckSlider.style.display = 'flex';

  const targetX = index === 0 ? 0 : deckSlider.clientWidth;
  deckSlider.scrollTo({
    left: targetX,
    behavior: 'smooth'
  });
  setActiveTabButton(index === 0 ? 'tab-scenes' : 'tab-sounds');
}

function showStandaloneView(viewElement, tabId) {
  deckSlider.style.display = 'none';
  tabMixer.style.display = 'none';
  tabSettings.style.display = 'none';

  viewElement.style.display = 'block';
  setActiveTabButton(tabId);
}

// Tab button click handlers
tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    haptic();
    const targetTab = btn.getAttribute('data-tab');

    if (targetTab === 'tab-scenes') {
      showDeckSlide(0);
    } else if (targetTab === 'tab-sounds') {
      showDeckSlide(1);
    } else if (targetTab === 'tab-mixer') {
      showStandaloneView(tabMixer, 'tab-mixer');
    } else if (targetTab === 'tab-settings') {
      showStandaloneView(tabSettings, 'tab-settings');
    }
  });
});

// Back buttons on standalone views
backButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    haptic();
    showDeckSlide(0);
  });
});

// Audio Sub-Mode Switcher (Soundboard vs BGM Looper)
if (btnModeSoundboard && btnModeBgm) {
  btnModeSoundboard.addEventListener('click', () => {
    haptic(25);
    btnModeSoundboard.classList.add('active');
    btnModeBgm.classList.remove('active');
    sectionSoundboard.style.display = 'block';
    sectionBgm.style.display = 'none';
  });

  btnModeBgm.addEventListener('click', () => {
    haptic(25);
    btnModeBgm.classList.add('active');
    btnModeSoundboard.classList.remove('active');
    sectionBgm.style.display = 'block';
    sectionSoundboard.style.display = 'none';
  });
}

// Update active tab indicator when user slides between Scenes and Soundboard
let scrollDebounce = null;
deckSlider.addEventListener('scroll', () => {
  clearTimeout(scrollDebounce);
  scrollDebounce = setTimeout(() => {
    const width = deckSlider.clientWidth || window.innerWidth;
    const currentIdx = Math.round(deckSlider.scrollLeft / width);
    setActiveTabButton(currentIdx === 0 ? 'tab-scenes' : 'tab-sounds');
  }, 50);
}, { passive: true });

// Update Top Bar & Quick Buttons
function updateObsStatusUI() {
  const isConn = state.obs.connected;
  obsStatusBadge.classList.toggle('connected', isConn);
  obsStatusText.textContent = isConn ? 'OBS Aktif' : 'OBS Off';

  // Quick Stream
  if (state.obs.isStreaming) {
    quickStreamBtn.classList.add('active-stream');
    streamLabel.textContent = 'LIVE';
  } else {
    quickStreamBtn.classList.remove('active-stream');
    streamLabel.textContent = 'STREAM';
  }

  // Quick Record
  if (state.obs.isRecording) {
    quickRecordBtn.classList.add('active-record');
    recordLabel.textContent = 'REC ON';
  } else {
    quickRecordBtn.classList.remove('active-record');
    recordLabel.textContent = 'REC';
  }

  // Quick Mute (Look for primary mic)
  const micInput = state.obs.audioInputs.find(
    (i) => i.name.toLowerCase().includes('mic') || i.name.toLowerCase().includes('aux')
  ) || state.obs.audioInputs[0];

  if (micInput && micInput.muted) {
    quickMuteBtn.classList.add('active-muted');
    muteLabel.textContent = 'MUTED';
  } else {
    quickMuteBtn.classList.remove('active-muted');
    muteLabel.textContent = 'MIC';
  }
}

// Render Scenes Grid
function renderScenes() {
  scenesGrid.innerHTML = '';
  const scenes = state.obs.scenes || [];

  if (!state.obs.connected || scenes.length === 0) {
    scenesEmpty.style.display = 'block';
    return;
  }
  scenesEmpty.style.display = 'none';

  scenes.forEach((sceneName) => {
    const isActive = sceneName === state.obs.currentScene;
    const key = document.createElement('div');
    key.className = `deck-key ${isActive ? 'scene-active' : ''}`;
    key.setAttribute('data-scene', sceneName);

    key.innerHTML = `
      <div class="deck-key-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="3" width="20" height="14" rx="2"></rect>
          <line x1="8" y1="21" x2="16" y2="21"></line>
          <line x1="12" y1="17" x2="12" y2="21"></line>
        </svg>
      </div>
      <div class="deck-key-label">${sceneName}</div>
      ${isActive ? '<span class="deck-key-badge">ACTIVE</span>' : ''}
    `;

    key.addEventListener('click', () => {
      if (isSwiping) return;
      haptic(35);
      socket.emit('obs:scene', sceneName);
    });

    scenesGrid.appendChild(key);
  });
}

// Render Soundboard Grid
function renderSoundboard() {
  soundsGrid.innerHTML = '';
  const sounds = state.sounds || [];

  if (sounds.length === 0) {
    soundsEmpty.style.display = 'block';
    return;
  }
  soundsEmpty.style.display = 'none';

  sounds.forEach((sound) => {
    const key = document.createElement('div');
    key.className = `deck-key sound-key ${soundEditMode ? 'is-editing' : ''}`;
    key.setAttribute('data-sound', sound.filename);

    let toolsHtml = '';
    if (soundEditMode) {
      toolsHtml = `
        <div class="deck-key-edit-tools">
          <button class="btn-key-tool btn-tool-edit" title="Edit Nama">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="btn-key-tool btn-tool-delete" title="Hapus Sound">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;
    }

    key.innerHTML = `
      ${toolsHtml}
      <div class="deck-key-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
        </svg>
      </div>
      <div class="deck-key-label">${sound.name}</div>
      <span class="deck-key-badge">${sound.extension}</span>
    `;

    // Click handler for card
    key.addEventListener('click', (e) => {
      if (isSwiping) return;
      // If clicked tool buttons, don't trigger sound
      if (e.target.closest('.btn-key-tool')) return;

      if (soundEditMode) {
        haptic(30);
        openRenameModal(sound, 'sound');
      } else {
        haptic(30);
        key.classList.add('sound-playing');
        setTimeout(() => key.classList.remove('sound-playing'), 450);

        const vol = parseFloat(soundboardVol.value) || 0.8;
        socket.emit('sound:play', { filename: sound.filename, volume: vol });
      }
    });

    if (soundEditMode) {
      const btnEdit = key.querySelector('.btn-tool-edit');
      const btnDelete = key.querySelector('.btn-tool-delete');

      if (btnEdit) {
        btnEdit.addEventListener('click', (e) => {
          e.stopPropagation();
          haptic(30);
          openRenameModal(sound, 'sound');
        });
      }

      if (btnDelete) {
        btnDelete.addEventListener('click', (e) => {
          e.stopPropagation();
          haptic(40);
          deleteSound(sound);
        });
      }
    }

    soundsGrid.appendChild(key);
  });
}

// Update BGM Top Status & Live Indicator
function updateBgmUI() {
  const bgmState = state.bgm.state || {};
  const isPlaying = !!bgmState.isPlaying;
  const isDucked = !!bgmState.isDucked;
  const currentTrack = bgmState.currentTrack;

  if (bgmStatusBar) {
    bgmStatusBar.classList.toggle('is-playing', isPlaying);
  }
  if (bgmActiveDot) {
    bgmActiveDot.style.display = isPlaying ? 'inline-block' : 'none';
  }

  if (isPlaying && currentTrack) {
    const trackObj = (state.bgm.tracks || []).find((t) => t.filename === currentTrack);
    const title = trackObj ? trackObj.name : currentTrack;
    bgmCurrentTitle.textContent = `BGM: ${title}`;

    if (isDucked) {
      bgmStatusBadge.textContent = 'DUCKED';
      bgmStatusBadge.className = 'bgm-badge badge-ducked';
    } else {
      bgmStatusBadge.textContent = 'LOOPING';
      bgmStatusBadge.className = 'bgm-badge badge-looping';
    }
    btnStopBgm.style.display = 'inline-flex';
  } else {
    bgmCurrentTitle.textContent = 'BGM: Tidak Ada';
    bgmStatusBadge.textContent = 'OFF';
    bgmStatusBadge.className = 'bgm-badge';
    btnStopBgm.style.display = 'none';
  }

  // Sync BGM slider
  if (bgmState.baseVolume !== undefined && bgmVolSlider) {
    bgmVolSlider.value = bgmState.baseVolume;
    if (volBgmVal) {
      volBgmVal.textContent = `${Math.round(bgmState.baseVolume * 100)}%`;
    }
  }
}

// Render BGM Grid
function renderBgm() {
  if (!bgmGrid) return;
  bgmGrid.innerHTML = '';
  const tracks = state.bgm.tracks || [];

  if (tracks.length === 0) {
    if (bgmEmpty) bgmEmpty.style.display = 'block';
    return;
  }
  if (bgmEmpty) bgmEmpty.style.display = 'none';

  tracks.forEach((track) => {
    const isCurrentLooping = state.bgm.state.isPlaying && state.bgm.state.currentTrack === track.filename;
    const key = document.createElement('div');
    key.className = `deck-key bgm-key ${isCurrentLooping ? 'is-looping' : ''} ${bgmEditMode ? 'is-editing' : ''}`;
    key.setAttribute('data-bgm', track.filename);

    let toolsHtml = '';
    if (bgmEditMode) {
      toolsHtml = `
        <div class="deck-key-edit-tools">
          <button class="btn-key-tool btn-tool-edit" title="Edit Nama BGM">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="btn-key-tool btn-tool-delete" title="Hapus BGM">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;
    }

    key.innerHTML = `
      ${toolsHtml}
      <div class="deck-key-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 18V5l12-2v13"></path>
          <circle cx="6" cy="18" r="3"></circle>
          <circle cx="18" cy="16" r="3"></circle>
        </svg>
      </div>
      <div class="deck-key-label">${track.name}</div>
      <span class="deck-key-badge">${isCurrentLooping ? 'LOOPING' : track.extension}</span>
    `;

    key.addEventListener('click', (e) => {
      if (isSwiping) return;
      if (e.target.closest('.btn-key-tool')) return;

      if (bgmEditMode) {
        haptic(30);
        openRenameModal(track, 'bgm');
      } else {
        haptic(35);
        if (isCurrentLooping) {
          socket.emit('bgm:stop');
        } else {
          socket.emit('bgm:play', track.filename);
        }
      }
    });

    if (bgmEditMode) {
      const btnEdit = key.querySelector('.btn-tool-edit');
      const btnDelete = key.querySelector('.btn-tool-delete');
      if (btnEdit) {
        btnEdit.addEventListener('click', (e) => {
          e.stopPropagation();
          haptic(30);
          openRenameModal(track, 'bgm');
        });
      }
      if (btnDelete) {
        btnDelete.addEventListener('click', (e) => {
          e.stopPropagation();
          haptic(40);
          deleteBgm(track);
        });
      }
    }

    bgmGrid.appendChild(key);
  });
}

// Render Audio Mixer
function renderMixer() {
  audioList.innerHTML = '';
  const inputs = state.obs.audioInputs || [];

  if (!state.obs.connected || inputs.length === 0) {
    mixerEmpty.style.display = 'block';
    return;
  }
  mixerEmpty.style.display = 'none';

  inputs.forEach((input) => {
    const item = document.createElement('div');
    item.className = 'audio-item';

    item.innerHTML = `
      <div class="audio-item-info">
        <svg viewBox="0 0 24 24" class="w-5 h-5 flex-shrink-0 ${input.muted ? 'text-red-400' : 'text-neutral-300'}" fill="none" stroke="currentColor" stroke-width="2">
          ${input.muted
            ? '<line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line>'
            : '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line>'
          }
        </svg>
        <div>
          <div class="audio-item-title">${input.name}</div>
          <div class="audio-item-kind">${input.kind || 'Audio Input'}</div>
        </div>
      </div>
      <button class="btn-mute-toggle ${input.muted ? 'is-muted' : ''}">
        ${input.muted ? 'MUTED' : 'UNMUTE'}
      </button>
    `;

    const btn = item.querySelector('.btn-mute-toggle');
    btn.addEventListener('click', () => {
      haptic(30);
      socket.emit('obs:toggleMute', input.name);
    });

    audioList.appendChild(item);
  });
}

// Quick Button Event Handlers (Dengan perlindungan konfirmasi)
quickStreamBtn.addEventListener('click', () => {
  haptic(40);
  if (!state.obs.isStreaming) {
    if (!confirm('Mulai LIVE Streaming ke OBS sekarang?')) return;
  }
  socket.emit('obs:toggleStream');
});

quickRecordBtn.addEventListener('click', () => {
  haptic(40);
  if (!state.obs.isRecording) {
    if (!confirm('Mulai Merekam (Record) di OBS sekarang?')) return;
  }
  socket.emit('obs:toggleRecord');
});

quickMuteBtn.addEventListener('click', () => {
  haptic(40);
  const micInput = state.obs.audioInputs.find(
    (i) => i.name.toLowerCase().includes('mic') || i.name.toLowerCase().includes('aux')
  ) || state.obs.audioInputs[0];

  if (micInput) {
    socket.emit('obs:toggleMute', micInput.name);
  }
});

btnRefreshScenes.addEventListener('click', () => {
  haptic();
  socket.emit('obs:refresh');
});

// Soundboard & BGM Volume Controls
soundboardVol.addEventListener('input', (e) => {
  const pct = Math.round(e.target.value * 100);
  if (volSfxVal) volSfxVal.textContent = `${pct}%`;
});

bgmVolSlider.addEventListener('input', (e) => {
  const vol = parseFloat(e.target.value);
  const pct = Math.round(vol * 100);
  if (volBgmVal) volBgmVal.textContent = `${pct}%`;
  socket.emit('bgm:volume', vol);
});

btnStopBgm.addEventListener('click', () => {
  haptic(40);
  socket.emit('bgm:stop');
});

btnStopAll.addEventListener('click', () => {
  haptic(50);
  document.querySelectorAll('.sound-playing').forEach(el => el.classList.remove('sound-playing'));
  socket.emit('sound:stop');
  fetch('/api/sounds/stop', { method: 'POST' }).catch(() => {});
});

// Soundboard Management Handlers
btnManageSounds.addEventListener('click', () => {
  haptic(30);
  soundEditMode = !soundEditMode;
  btnManageSounds.classList.toggle('active', soundEditMode);
  manageLabel.textContent = soundEditMode ? 'Selesai' : 'Kelola Sound';
  renderSoundboard();
});

btnUploadSound.addEventListener('click', () => {
  haptic(30);
  soundFileInput.click();
});

soundFileInput.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const originalBtnText = btnUploadSound.innerHTML;
  btnUploadSound.disabled = true;
  btnUploadSound.textContent = 'Mengunggah...';

  const formData = new FormData();
  formData.append('audio', file);

  try {
    const res = await fetch('/api/sounds/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (!res.ok) {
      alert(`Gagal upload: ${data.error || 'Terjadi kesalahan'}`);
    } else {
      soundFileInput.value = '';
    }
  } catch (err) {
    alert(`Error upload: ${err.message}`);
  } finally {
    btnUploadSound.disabled = false;
    btnUploadSound.innerHTML = originalBtnText;
  }
});

// BGM Management Handlers
btnManageBgm.addEventListener('click', () => {
  haptic(30);
  bgmEditMode = !bgmEditMode;
  btnManageBgm.classList.toggle('active', bgmEditMode);
  manageBgmLabel.textContent = bgmEditMode ? 'Selesai' : 'Kelola BGM';
  renderBgm();
});

btnUploadBgm.addEventListener('click', () => {
  haptic(30);
  bgmFileInput.click();
});

bgmFileInput.addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const originalBtnText = btnUploadBgm.innerHTML;
  btnUploadBgm.disabled = true;
  btnUploadBgm.textContent = 'Mengunggah...';

  const formData = new FormData();
  formData.append('audio', file);

  try {
    const res = await fetch('/api/bgm/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (!res.ok) {
      alert(`Gagal upload BGM: ${data.error || 'Terjadi kesalahan'}`);
    } else {
      bgmFileInput.value = '';
    }
  } catch (err) {
    alert(`Error upload BGM: ${err.message}`);
  } finally {
    btnUploadBgm.disabled = false;
    btnUploadBgm.innerHTML = originalBtnText;
  }
});

function openRenameModal(item, type = 'sound') {
  currentRenamingItem = item;
  currentRenamingType = type;
  renameInput.value = item.name;
  const modalTitle = renameModal.querySelector('.modal-title');
  if (modalTitle) {
    modalTitle.textContent = type === 'bgm' ? 'Ganti Nama BGM' : 'Ganti Nama Sound';
  }
  renameModal.style.display = 'flex';
  setTimeout(() => {
    renameInput.focus();
    renameInput.select();
  }, 100);
}

function closeRenameModal() {
  currentRenamingItem = null;
  renameModal.style.display = 'none';
}

btnCancelRename.addEventListener('click', () => {
  haptic();
  closeRenameModal();
});

renameModal.addEventListener('click', (e) => {
  if (e.target === renameModal) closeRenameModal();
});

btnConfirmRename.addEventListener('click', async () => {
  haptic();
  const newName = renameInput.value.trim();
  if (!newName) {
    alert('Nama tidak boleh kosong.');
    return;
  }
  if (!currentRenamingItem) return;

  btnConfirmRename.disabled = true;
  btnConfirmRename.textContent = 'Menyimpan...';

  const endpoint = currentRenamingType === 'bgm'
    ? `/api/bgm/${encodeURIComponent(currentRenamingItem.filename)}`
    : `/api/sounds/${encodeURIComponent(currentRenamingItem.filename)}`;

  try {
    const res = await fetch(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName })
    });
    const data = await res.json();
    if (!res.ok) {
      alert(`Gagal mengubah nama: ${data.error || 'Terjadi kesalahan'}`);
    } else {
      closeRenameModal();
    }
  } catch (err) {
    alert(`Error: ${err.message}`);
  } finally {
    btnConfirmRename.disabled = false;
    btnConfirmRename.textContent = 'Simpan';
  }
});

renameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    btnConfirmRename.click();
  } else if (e.key === 'Escape') {
    closeRenameModal();
  }
});

async function deleteSound(sound) {
  if (!confirm(`Hapus sound "${sound.name}"? File ini akan dihapus secara permanen.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/sounds/${encodeURIComponent(sound.filename)}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok) {
      alert(`Gagal menghapus: ${data.error || 'Terjadi kesalahan'}`);
    }
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

async function deleteBgm(track) {
  if (!confirm(`Hapus BGM "${track.name}"? File ini akan dihapus secara permanen.`)) {
    return;
  }

  try {
    const res = await fetch(`/api/bgm/${encodeURIComponent(track.filename)}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok) {
      alert(`Gagal menghapus BGM: ${data.error || 'Terjadi kesalahan'}`);
    }
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

// Settings Form Handlers
btnSaveObs.addEventListener('click', async () => {
  haptic();
  const host = obsHostInput.value.trim() || '127.0.0.1';
  const port = parseInt(obsPortInput.value.trim(), 10) || 4455;
  const password = obsPasswordInput.value;

  btnSaveObs.disabled = true;
  btnSaveObs.textContent = 'Menghubungkan...';

  try {
    const res = await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ obs: { host, port, password } })
    });
    const data = await res.json();
    if (data.obsResult && !data.obsResult.success) {
      alert(`Koneksi OBS Gagal: ${data.obsResult.error}`);
    }
  } catch (err) {
    alert(`Error: ${err.message}`);
  } finally {
    btnSaveObs.disabled = false;
    btnSaveObs.textContent = 'Hubungkan ke OBS';
  }
});

// Socket.io Event Listeners
socket.on('init:state', (data) => {
  if (data.obs) state.obs = { ...state.obs, ...data.obs };
  if (data.sounds) state.sounds = data.sounds;
  if (data.bgm) {
    if (data.bgm.tracks) state.bgm.tracks = data.bgm.tracks;
    if (data.bgm.state) state.bgm.state = data.bgm.state;
  }
  if (data.config) {
    state.config = data.config;
    obsHostInput.value = data.config.obs?.host || '127.0.0.1';
    obsPortInput.value = data.config.obs?.port || 4455;
    obsPasswordInput.value = data.config.obs?.password || '';
    if (data.config.soundboard?.volume !== undefined && soundboardVol) {
      soundboardVol.value = data.config.soundboard.volume;
      if (volSfxVal) volSfxVal.textContent = `${Math.round(data.config.soundboard.volume * 100)}%`;
    }
    if (data.config.bgm?.volume !== undefined && bgmVolSlider) {
      bgmVolSlider.value = data.config.bgm.volume;
      if (volBgmVal) volBgmVal.textContent = `${Math.round(data.config.bgm.volume * 100)}%`;
    }
  }

  updateObsStatusUI();
  updateBgmUI();
  renderScenes();
  renderSoundboard();
  renderBgm();
  renderMixer();
});

socket.on('obs:connected', (obsState) => {
  state.obs = { ...state.obs, ...obsState, connected: true };
  updateObsStatusUI();
  renderScenes();
  renderMixer();
});

socket.on('obs:disconnected', () => {
  state.obs.connected = false;
  state.obs.scenes = [];
  state.obs.audioInputs = [];
  updateObsStatusUI();
  renderScenes();
  renderMixer();
});

socket.on('obs:sceneChanged', (data) => {
  state.obs.currentScene = data.sceneName;
  renderScenes();
});

socket.on('obs:stateUpdated', (obsState) => {
  state.obs = { ...state.obs, ...obsState };
  updateObsStatusUI();
  renderScenes();
  renderMixer();
});

socket.on('obs:streamStateChanged', (data) => {
  state.obs.isStreaming = data.active;
  updateObsStatusUI();
});

socket.on('obs:recordStateChanged', (data) => {
  state.obs.isRecording = data.active;
  updateObsStatusUI();
});

socket.on('obs:inputMuteChanged', (data) => {
  const target = state.obs.audioInputs.find((i) => i.name === data.inputName);
  if (target) {
    target.muted = data.muted;
  }
  updateObsStatusUI();
  renderMixer();
});

socket.on('sound:started', (data) => {
  const btn = document.querySelector(`[data-sound="${data.filename}"]`);
  if (btn) {
    btn.classList.add('sound-playing');
    setTimeout(() => btn.classList.remove('sound-playing'), 450);
  }
});

socket.on('sound:stopped', () => {
  document.querySelectorAll('.sound-playing').forEach((el) => el.classList.remove('sound-playing'));
});

socket.on('sounds:updated', (sounds) => {
  state.sounds = sounds;
  renderSoundboard();
});

socket.on('bgm:state', (bgmState) => {
  state.bgm.state = bgmState;
  updateBgmUI();
  renderBgm();
});

socket.on('bgm:updated', (data) => {
  if (data.tracks) state.bgm.tracks = data.tracks;
  if (data.state) state.bgm.state = data.state;
  updateBgmUI();
  renderBgm();
});
