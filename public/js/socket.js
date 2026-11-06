import { state, saveCustomSources } from './state.js';
import {
  setSocket,
  updateObsStatusUI,
  updateBgmUI,
  renderScenes,
  renderCustomSources,
  syncCustomSources,
  renderSoundboard,
  renderBgm,
  renderMixer
} from './deck.js';
import {
  playClientSound,
  stopClientSounds,
  syncClientBgm
} from './audio.js';

export const socket = io();
setSocket(socket);

export function initSocketListeners() {
  const obsHostInput = document.getElementById('obs-host');
  const obsPortInput = document.getElementById('obs-port');
  const obsPasswordInput = document.getElementById('obs-password');
  const soundboardVol = document.getElementById('soundboard-vol');
  const volSfxVal = document.getElementById('vol-sfx-val');
  const bgmVolSlider = document.getElementById('bgm-vol');
  const volBgmVal = document.getElementById('vol-bgm-val');

  socket.on('init:state', (data) => {
    if (data.obs) state.obs = { ...state.obs, ...data.obs };
    if (data.sounds) state.sounds = data.sounds;
    if (data.bgm) {
      if (data.bgm.tracks) state.bgm.tracks = data.bgm.tracks;
      if (data.bgm.state) state.bgm.state = data.bgm.state;
    }
    if (data.config) {
      state.config = data.config;
      if (obsHostInput) obsHostInput.value = data.config.obs?.host || '127.0.0.1';
      if (obsPortInput) obsPortInput.value = data.config.obs?.port || 4455;
      if (obsPasswordInput) obsPasswordInput.value = data.config.obs?.password || '';
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
    renderCustomSources();
    syncCustomSources(socket);
  });

  socket.on('obs:connected', (obsState) => {
    state.obs = { ...state.obs, ...obsState, connected: true };
    updateObsStatusUI();
    renderScenes();
    renderMixer();
    renderCustomSources();
    syncCustomSources(socket);
  });

  socket.on('obs:disconnected', () => {
    state.obs.connected = false;
    state.obs.scenes = [];
    state.obs.audioInputs = [];
    updateObsStatusUI();
    renderScenes();
    renderMixer();
    renderCustomSources();
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
    renderCustomSources();
    syncCustomSources(socket);
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

  socket.on('obs:sceneItemEnableStateChanged', (data) => {
    if (!data) return;
    let changed = false;
    state.customSources.forEach((cs) => {
      if (cs.sceneName === data.sceneName && Number(cs.sceneItemId) === Number(data.sceneItemId)) {
        if (cs.enabled !== data.sceneItemEnabled) {
          cs.enabled = data.sceneItemEnabled;
          changed = true;
        }
      }
    });
    if (changed) {
      saveCustomSources(state.customSources);
      renderCustomSources();
    }
  });

  socket.on('sound:started', (data) => {
    const btn = document.querySelector(`[data-sound="${data.filename}"]`);
    if (btn) {
      btn.classList.add('sound-playing');
      setTimeout(() => btn.classList.remove('sound-playing'), 450);
    }
    playClientSound(data);
  });

  socket.on('sound:stopped', () => {
    document.querySelectorAll('.sound-playing').forEach((el) => el.classList.remove('sound-playing'));
    stopClientSounds();
  });

  socket.on('sounds:updated', (sounds) => {
    state.sounds = sounds;
    renderSoundboard();
  });

  socket.on('bgm:state', (bgmState) => {
    state.bgm.state = bgmState;
    updateBgmUI();
    renderBgm();
    syncClientBgm(bgmState);
  });

  socket.on('bgm:updated', (data) => {
    if (data.tracks) state.bgm.tracks = data.tracks;
    if (data.state) state.bgm.state = data.state;
    updateBgmUI();
    renderBgm();
  });
}
