import {
  state,
  haptic,
  applyTheme,
  getCurrentTheme,
  requestWakeLock,
  releaseWakeLock
} from './state.js';
import { stopBgmDirect } from './audio.js';
import {
  setSwiping,
  soundEditMode,
  toggleSoundEditMode,
  bgmEditMode,
  toggleBgmEditMode,
  renderSoundboard,
  renderBgm,
  renderMixer,
  closeRenameModal,
  confirmRename
} from './deck.js';
import { socket, initSocketListeners } from './socket.js';

// --- Theme Initialization ---
applyTheme(getCurrentTheme());

const btnThemeToggle = document.getElementById('btn-theme-toggle');
if (btnThemeToggle) {
  btnThemeToggle.addEventListener('click', () => {
    haptic(25);
    applyTheme(getCurrentTheme() === 'dark' ? 'light' : 'dark');
  });
}

const toggleLightmode = document.getElementById('toggle-lightmode');
if (toggleLightmode) {
  toggleLightmode.addEventListener('change', (e) => {
    haptic(25);
    applyTheme(e.target.checked ? 'light' : 'dark');
  });
}

// --- Fullscreen & WakeLock ---
const btnFullscreen = document.getElementById('btn-fullscreen');
if (btnFullscreen) {
  btnFullscreen.addEventListener('click', () => {
    haptic();
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  });
}

const btnWake = document.getElementById('btn-wake');
if (btnWake) {
  btnWake.addEventListener('click', () => {
    haptic();
    if (state.wakeLock) {
      releaseWakeLock();
    } else {
      requestWakeLock();
    }
  });
}

const toggleWakeLock = document.getElementById('toggle-wakelock');
if (toggleWakeLock) {
  toggleWakeLock.addEventListener('change', (e) => {
    if (e.target.checked) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }
  });
}

const toggleVibrate = document.getElementById('toggle-vibrate');
if (toggleVibrate) {
  toggleVibrate.checked = state.vibrate;
  toggleVibrate.addEventListener('change', (e) => {
    state.vibrate = e.target.checked;
    localStorage.setItem('sd_vibrate', String(state.vibrate));
  });
}


// --- Tab Navigation & Deck Slider ---
const deckSlider = document.getElementById('deck-slider');
const tabMixer = document.getElementById('tab-mixer');
const tabSettings = document.getElementById('tab-settings');
const tabButtons = document.querySelectorAll('.tab-btn');
const backButtons = document.querySelectorAll('.btn-back, .btn-back-to-deck');

let touchStartX = 0;
let touchStartY = 0;

if (deckSlider) {
  deckSlider.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    setSwiping(false);
  }, { passive: true });

  deckSlider.addEventListener('touchmove', (e) => {
    const diffX = Math.abs(e.touches[0].clientX - touchStartX);
    const diffY = Math.abs(e.touches[0].clientY - touchStartY);
    if (diffX > 10 || diffY > 10) {
      setSwiping(true);
    }
  }, { passive: true });

  deckSlider.addEventListener('touchend', () => {
    setTimeout(() => setSwiping(false), 50);
  }, { passive: true });

  let scrollDebounce = null;
  deckSlider.addEventListener('scroll', () => {
    clearTimeout(scrollDebounce);
    scrollDebounce = setTimeout(() => {
      const scrollPos = deckSlider.scrollLeft;
      const width = deckSlider.clientWidth;
      const targetIndex = Math.round(scrollPos / width);
      tabButtons.forEach((b) => {
        const name = b.getAttribute('data-tab');
        if (targetIndex === 0) {
          b.classList.toggle('active', name === 'tab-scenes');
        } else {
          const isBgm = sectionBgm && sectionBgm.style.display !== 'none';
          b.classList.toggle('active', isBgm ? name === 'tab-bgm' : name === 'tab-sounds');
        }
      });
    }, 50);
  }, { passive: true });
}

function showStandaloneView(targetView) {
  if (deckSlider) deckSlider.style.display = 'none';
  if (tabMixer) tabMixer.style.display = 'none';
  if (tabSettings) tabSettings.style.display = 'none';

  if (targetView === 'mixer' && tabMixer) {
    tabMixer.style.display = 'block';
  } else if (targetView === 'settings' && tabSettings) {
    tabSettings.style.display = 'block';
  } else if (targetView === 'deck' && deckSlider) {
    deckSlider.style.display = 'flex';
  }
}

function switchSubMode(mode) {
  if (mode === 'bgm') {
    if (btnModeBgm) btnModeBgm.classList.add('active');
    if (btnModeSoundboard) btnModeSoundboard.classList.remove('active');
    if (sectionSoundboard) sectionSoundboard.style.display = 'none';
    if (sectionBgm) sectionBgm.style.display = 'block';
    tabButtons.forEach((b) => b.classList.toggle('active', b.getAttribute('data-tab') === 'tab-bgm'));
  } else {
    if (btnModeSoundboard) btnModeSoundboard.classList.add('active');
    if (btnModeBgm) btnModeBgm.classList.remove('active');
    if (sectionSoundboard) sectionSoundboard.style.display = 'block';
    if (sectionBgm) sectionBgm.style.display = 'none';
    tabButtons.forEach((b) => b.classList.toggle('active', b.getAttribute('data-tab') === 'tab-sounds'));
  }
}

tabButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    haptic();
    const tabName = (btn.getAttribute('data-tab') || '').replace(/^tab-/, '');

    if (tabName === 'scenes') {
      showStandaloneView('deck');
      tabButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      if (deckSlider) deckSlider.scrollTo({ left: 0, behavior: 'smooth' });
    } else if (tabName === 'sounds' || tabName === 'soundboard') {
      showStandaloneView('deck');
      switchSubMode('soundboard');
      if (deckSlider) deckSlider.scrollTo({ left: deckSlider.clientWidth, behavior: 'smooth' });
    } else if (tabName === 'bgm') {
      showStandaloneView('deck');
      switchSubMode('bgm');
      if (deckSlider) deckSlider.scrollTo({ left: deckSlider.clientWidth, behavior: 'smooth' });
    } else if (tabName === 'mixer') {
      tabButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      showStandaloneView('mixer');
      renderMixer();
    } else if (tabName === 'settings') {
      tabButtons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      showStandaloneView('settings');
    }
  });
});

backButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    haptic();
    showStandaloneView('deck');
    tabButtons.forEach((b, idx) => b.classList.toggle('active', idx === 0));
    if (deckSlider) {
      deckSlider.scrollTo({ left: 0, behavior: 'smooth' });
    }
  });
});

// --- Audio Sub-Mode Switcher (Soundboard vs BGM Looper) ---
const btnModeSoundboard = document.getElementById('btn-mode-soundboard');
const btnModeBgm = document.getElementById('btn-mode-bgm');
const sectionSoundboard = document.getElementById('section-soundboard');
const sectionBgm = document.getElementById('section-bgm');

if (btnModeSoundboard && btnModeBgm) {
  btnModeSoundboard.addEventListener('click', () => {
    haptic(25);
    switchSubMode('soundboard');
  });

  btnModeBgm.addEventListener('click', () => {
    haptic(25);
    switchSubMode('bgm');
  });
}

// --- Quick Buttons ---
const quickStreamBtn = document.getElementById('quick-stream-btn');
const quickRecordBtn = document.getElementById('quick-record-btn');
const quickMuteBtn = document.getElementById('quick-mute-btn');
const btnRefreshScenes = document.getElementById('btn-refresh-scenes');

if (quickStreamBtn) {
  quickStreamBtn.addEventListener('click', () => {
    haptic(40);
    if (!state.obs.isStreaming) {
      if (!confirm('Mulai LIVE Streaming ke OBS sekarang?')) return;
    }
    socket.emit('obs:toggleStream');
  });
}

if (quickRecordBtn) {
  quickRecordBtn.addEventListener('click', () => {
    haptic(40);
    if (!state.obs.isRecording) {
      if (!confirm('Mulai Merekam (Record) di OBS sekarang?')) return;
    }
    socket.emit('obs:toggleRecord');
  });
}

if (quickMuteBtn) {
  quickMuteBtn.addEventListener('click', () => {
    haptic(40);
    const micInput = state.obs.audioInputs?.find(
      (i) => i.name.toLowerCase().includes('mic') || i.name.toLowerCase().includes('aux')
    ) || state.obs.audioInputs?.[0];
    if (micInput) socket.emit('obs:toggleMute', micInput.name);
  });
}

if (btnRefreshScenes) {
  btnRefreshScenes.addEventListener('click', () => {
    haptic();
    socket.emit('obs:refresh');
  });
}

// --- Volume Sliders & Stop Buttons ---
const soundboardVol = document.getElementById('soundboard-vol');
const volSfxVal = document.getElementById('vol-sfx-val');
const bgmVolSlider = document.getElementById('bgm-vol');
const volBgmVal = document.getElementById('vol-bgm-val');
const btnStopBgm = document.getElementById('btn-stop-bgm');
const btnStopAll = document.getElementById('btn-stop-all');

if (soundboardVol) {
  soundboardVol.addEventListener('input', (e) => {
    const pct = Math.round(e.target.value * 100);
    if (volSfxVal) volSfxVal.textContent = `${pct}%`;
  });
}

if (bgmVolSlider) {
  bgmVolSlider.addEventListener('input', (e) => {
    const vol = parseFloat(e.target.value);
    const pct = Math.round(vol * 100);
    if (volBgmVal) volBgmVal.textContent = `${pct}%`;
    socket.emit('bgm:volume', vol);
  });
}

if (btnStopBgm) {
  btnStopBgm.addEventListener('click', () => {
    haptic(40);
    stopBgmDirect();
    socket.emit('bgm:stop');
  });
}

if (btnStopAll) {
  btnStopAll.addEventListener('click', () => {
    haptic(50);
    document.querySelectorAll('.sound-playing').forEach((el) => el.classList.remove('sound-playing'));
    socket.emit('sound:stop');
    fetch('/api/sounds/stop', { method: 'POST' }).catch(() => {});
  });
}

// --- Soundboard Management ---
const btnManageSounds = document.getElementById('btn-manage-sounds');
const manageLabel = document.getElementById('manage-label');
const btnUploadSound = document.getElementById('btn-upload-sound');
const soundFileInput = document.getElementById('sound-file-input');

if (btnManageSounds) {
  btnManageSounds.addEventListener('click', () => {
    haptic(30);
    const isEditing = toggleSoundEditMode();
    btnManageSounds.classList.toggle('active', isEditing);
    if (manageLabel) manageLabel.textContent = isEditing ? 'Selesai' : 'Kelola Sound';
    renderSoundboard();
  });
}

if (btnUploadSound && soundFileInput) {
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
}

// --- BGM Management ---
const btnManageBgm = document.getElementById('btn-manage-bgm');
const manageBgmLabel = document.getElementById('manage-bgm-label');
const btnUploadBgm = document.getElementById('btn-upload-bgm');
const bgmFileInput = document.getElementById('bgm-file-input');

if (btnManageBgm) {
  btnManageBgm.addEventListener('click', () => {
    haptic(30);
    const isEditing = toggleBgmEditMode();
    btnManageBgm.classList.toggle('active', isEditing);
    if (manageBgmLabel) manageBgmLabel.textContent = isEditing ? 'Selesai' : 'Kelola BGM';
    renderBgm();
  });
}

if (btnUploadBgm && bgmFileInput) {
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
}

// --- Rename Modal Listeners ---
const renameModal = document.getElementById('rename-modal');
const renameInput = document.getElementById('rename-input');
const btnCancelRename = document.getElementById('btn-cancel-rename');
const btnConfirmRename = document.getElementById('btn-confirm-rename');

if (btnCancelRename) {
  btnCancelRename.addEventListener('click', () => {
    haptic();
    closeRenameModal();
  });
}

if (renameModal) {
  renameModal.addEventListener('click', (e) => {
    if (e.target === renameModal) closeRenameModal();
  });
}

if (btnConfirmRename) {
  btnConfirmRename.addEventListener('click', () => {
    haptic();
    confirmRename();
  });
}

if (renameInput) {
  renameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      confirmRename();
    } else if (e.key === 'Escape') {
      closeRenameModal();
    }
  });
}

// --- Settings Form (OBS Connection) ---
const obsHostInput = document.getElementById('obs-host');
const obsPortInput = document.getElementById('obs-port');
const obsPasswordInput = document.getElementById('obs-password');
const btnSaveObs = document.getElementById('btn-save-obs');

if (btnSaveObs) {
  btnSaveObs.addEventListener('click', async () => {
    haptic();
    const host = obsHostInput?.value.trim() || '127.0.0.1';
    const port = parseInt(obsPortInput?.value.trim(), 10) || 4455;
    const password = obsPasswordInput?.value || '';

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
}

// --- Bootstrap Socket Listeners ---
initSocketListeners();
