import { state, haptic } from './state.js';
import { playBgmDirect, stopBgmDirect } from './audio.js';

export let isSwiping = false;
export function setSwiping(val) { isSwiping = val; }

export let soundEditMode = false;
export function toggleSoundEditMode() {
  soundEditMode = !soundEditMode;
  return soundEditMode;
}

export let bgmEditMode = false;
export function toggleBgmEditMode() {
  bgmEditMode = !bgmEditMode;
  return bgmEditMode;
}

let socketRef = null;
export function setSocket(s) { socketRef = s; }

export function attachTapListener(element, callback) {
  let startX = 0;
  let startY = 0;
  let isMoved = false;

  element.addEventListener('pointerdown', (e) => {
    startX = e.clientX;
    startY = e.clientY;
    isMoved = false;
  }, { passive: true });

  element.addEventListener('pointermove', (e) => {
    if (!isMoved && (Math.abs(e.clientX - startX) > 8 || Math.abs(e.clientY - startY) > 8)) {
      isMoved = true;
    }
  }, { passive: true });

  element.addEventListener('pointercancel', () => {
    isMoved = true;
  });

  element.addEventListener('click', (e) => {
    if (isMoved || isSwiping) return;
    callback(e);
  });
}

// --- Rename Modal State ---
let currentRenamingItem = null;
let currentRenamingType = 'sound';

export function openRenameModal(item, type = 'sound') {
  currentRenamingItem = item;
  currentRenamingType = type;
  const renameModal = document.getElementById('rename-modal');
  const renameInput = document.getElementById('rename-input');
  if (!renameModal || !renameInput) return;

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

export function closeRenameModal() {
  currentRenamingItem = null;
  const renameModal = document.getElementById('rename-modal');
  if (renameModal) renameModal.style.display = 'none';
}

export async function confirmRename() {
  const renameInput = document.getElementById('rename-input');
  const btnConfirmRename = document.getElementById('btn-confirm-rename');
  if (!renameInput || !btnConfirmRename || !currentRenamingItem) return;

  const newName = renameInput.value.trim();
  if (!newName) {
    alert('Nama tidak boleh kosong.');
    return;
  }

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
}

export async function deleteSound(sound) {
  if (!confirm(`Hapus sound "${sound.name}"? File ini akan dihapus secara permanen.`)) return;
  try {
    const res = await fetch(`/api/sounds/${encodeURIComponent(sound.filename)}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) alert(`Gagal menghapus: ${data.error || 'Terjadi kesalahan'}`);
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

export async function deleteBgm(track) {
  if (!confirm(`Hapus BGM "${track.name}"? File ini akan dihapus secara permanen.`)) return;
  try {
    const res = await fetch(`/api/bgm/${encodeURIComponent(track.filename)}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) alert(`Gagal menghapus BGM: ${data.error || 'Terjadi kesalahan'}`);
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

// --- Top Bar & Quick Buttons ---
export function updateObsStatusUI() {
  const obsStatusBadge = document.getElementById('obs-status');
  const obsStatusText = document.getElementById('obs-status-text');
  const quickStreamBtn = document.getElementById('quick-stream-btn');
  const quickRecordBtn = document.getElementById('quick-record-btn');
  const quickMuteBtn = document.getElementById('quick-mute-btn');
  const streamLabel = document.getElementById('stream-label');
  const recordLabel = document.getElementById('record-label');
  const muteLabel = document.getElementById('mute-label');

  const isConn = state.obs.connected;
  if (obsStatusBadge) obsStatusBadge.classList.toggle('connected', isConn);
  if (obsStatusText) obsStatusText.textContent = isConn ? 'OBS Aktif' : 'OBS Off';

  if (quickStreamBtn && streamLabel) {
    if (state.obs.isStreaming) {
      quickStreamBtn.classList.add('active-stream');
      streamLabel.textContent = 'LIVE';
    } else {
      quickStreamBtn.classList.remove('active-stream');
      streamLabel.textContent = 'STREAM';
    }
  }

  if (quickRecordBtn && recordLabel) {
    if (state.obs.isRecording) {
      quickRecordBtn.classList.add('active-record');
      recordLabel.textContent = 'REC ON';
    } else {
      quickRecordBtn.classList.remove('active-record');
      recordLabel.textContent = 'REC';
    }
  }

  const micInput = state.obs.audioInputs?.find(
    (i) => i.name.toLowerCase().includes('mic') || i.name.toLowerCase().includes('aux')
  ) || state.obs.audioInputs?.[0];

  if (quickMuteBtn && muteLabel) {
    if (micInput && micInput.muted) {
      quickMuteBtn.classList.add('active-muted');
      muteLabel.textContent = 'MUTED';
    } else {
      quickMuteBtn.classList.remove('active-muted');
      muteLabel.textContent = 'MIC';
    }
  }
}

// --- Render Scenes Grid ---
export function renderScenes() {
  const scenesGrid = document.getElementById('scenes-grid');
  const scenesEmpty = document.getElementById('scenes-empty');
  if (!scenesGrid) return;
  scenesGrid.innerHTML = '';
  const scenes = state.obs.scenes || [];

  if (!state.obs.connected || scenes.length === 0) {
    if (scenesEmpty) scenesEmpty.style.display = 'block';
    return;
  }
  if (scenesEmpty) scenesEmpty.style.display = 'none';

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

    attachTapListener(key, () => {
      haptic(35);
      if (socketRef) socketRef.emit('obs:scene', sceneName);
    });

    scenesGrid.appendChild(key);
  });
}

// --- Render Soundboard Grid ---
export function renderSoundboard() {
  const soundsGrid = document.getElementById('sounds-grid');
  const soundsEmpty = document.getElementById('sounds-empty');
  const soundboardVol = document.getElementById('soundboard-vol');
  if (!soundsGrid) return;
  soundsGrid.innerHTML = '';
  const sounds = state.sounds || [];

  if (sounds.length === 0) {
    if (soundsEmpty) soundsEmpty.style.display = 'block';
    return;
  }
  if (soundsEmpty) soundsEmpty.style.display = 'none';

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

    attachTapListener(key, (e) => {
      if (e.target.closest('.btn-key-tool')) return;
      if (soundEditMode) {
        haptic(30);
        openRenameModal(sound, 'sound');
      } else {
        haptic(30);
        key.classList.add('sound-playing');
        setTimeout(() => key.classList.remove('sound-playing'), 450);

        const vol = parseFloat(soundboardVol?.value) || 0.8;
        if (socketRef) socketRef.emit('sound:play', { filename: sound.filename, volume: vol });
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

// --- Render BGM UI & Grid ---
export function updateBgmUI() {
  const bgmStatusBar = document.getElementById('bgm-status-bar');
  const bgmActiveDot = document.getElementById('bgm-active-dot');
  const bgmCurrentTitle = document.getElementById('bgm-current-title');
  const bgmStatusBadge = document.getElementById('bgm-status-badge');
  const btnStopBgm = document.getElementById('btn-stop-bgm');
  const bgmVolSlider = document.getElementById('bgm-vol');
  const volBgmVal = document.getElementById('vol-bgm-val');

  const bgmState = state.bgm.state || {};
  const isPlaying = !!bgmState.isPlaying;
  const isDucked = !!bgmState.isDucked;
  const currentTrack = bgmState.currentTrack;

  if (bgmStatusBar) bgmStatusBar.classList.toggle('is-playing', isPlaying);
  if (bgmActiveDot) bgmActiveDot.style.display = isPlaying ? 'inline-block' : 'none';

  if (isPlaying && currentTrack) {
    const trackObj = (state.bgm.tracks || []).find((t) => t.filename === currentTrack);
    const title = trackObj ? trackObj.name : currentTrack;
    if (bgmCurrentTitle) bgmCurrentTitle.textContent = `BGM: ${title}`;

    if (bgmStatusBadge) {
      if (isDucked) {
        bgmStatusBadge.textContent = 'DUCKED';
        bgmStatusBadge.className = 'bgm-badge badge-ducked';
      } else {
        bgmStatusBadge.textContent = 'LOOPING';
        bgmStatusBadge.className = 'bgm-badge badge-looping';
      }
    }
    if (btnStopBgm) btnStopBgm.style.display = 'inline-flex';
  } else {
    if (bgmCurrentTitle) bgmCurrentTitle.textContent = 'BGM: Tidak Ada';
    if (bgmStatusBadge) {
      bgmStatusBadge.textContent = 'OFF';
      bgmStatusBadge.className = 'bgm-badge';
    }
    if (btnStopBgm) btnStopBgm.style.display = 'none';
  }

  if (bgmState.baseVolume !== undefined && bgmVolSlider && document.activeElement !== bgmVolSlider) {
    bgmVolSlider.value = bgmState.baseVolume;
    if (volBgmVal) volBgmVal.textContent = `${Math.round(bgmState.baseVolume * 100)}%`;
  }
}

export function renderBgm() {
  const bgmGrid = document.getElementById('bgm-grid');
  const bgmEmpty = document.getElementById('bgm-empty');
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

    attachTapListener(key, (e) => {
      if (e.target.closest('.btn-key-tool')) return;
      if (bgmEditMode) {
        haptic(30);
        openRenameModal(track, 'bgm');
      } else {
        haptic(35);
        if (isCurrentLooping) {
          stopBgmDirect();
          if (socketRef) socketRef.emit('bgm:stop');
        } else {
          const bgmVolSlider = document.getElementById('bgm-vol');
          const vol = parseFloat(bgmVolSlider?.value) || 0.5;
          playBgmDirect(track.filename, vol);
          if (socketRef) socketRef.emit('bgm:play', { filename: track.filename, volume: vol });
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

// --- Render Audio Mixer ---
export function renderMixer() {
  const audioList = document.getElementById('audio-list');
  const mixerEmpty = document.getElementById('mixer-empty');
  if (!audioList) return;
  audioList.innerHTML = '';
  const inputs = state.obs.audioInputs || [];

  if (!state.obs.connected || inputs.length === 0) {
    if (mixerEmpty) mixerEmpty.style.display = 'block';
    return;
  }
  if (mixerEmpty) mixerEmpty.style.display = 'none';

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
      if (socketRef) socketRef.emit('obs:toggleMute', input.name);
    });

    audioList.appendChild(item);
  });
}
