// Client Browser Audio Playback Engine

let clientAudioEnabled = localStorage.getItem('sd_client_audio') !== 'false';
const activeClientAudios = new Set();
let clientBgmAudio = null;

export function isClientAudioEnabled() {
  return clientAudioEnabled;
}

export function setClientAudioEnabled(enabled) {
  clientAudioEnabled = !!enabled;
  localStorage.setItem('sd_client_audio', String(clientAudioEnabled));
  if (!clientAudioEnabled && clientBgmAudio) {
    clientBgmAudio.pause();
    clientBgmAudio = null;
  }
}

export function playClientSound(data) {
  if (!clientAudioEnabled || !data?.filename) return;

  const url = data.url || `/sounds/${encodeURIComponent(data.filename)}`;
  const audio = new Audio(url);
  const vol = typeof data.volume === 'number' ? data.volume : 0.8;
  audio.volume = Math.max(0, Math.min(1, vol));

  audio.play().catch((err) => {
    console.warn('[Audio] Autoplay blocked by browser (interact with page first):', err.message);
  });

  activeClientAudios.add(audio);
  audio.onended = () => activeClientAudios.delete(audio);
  audio.onerror = () => activeClientAudios.delete(audio);
}

export function stopClientSounds() {
  for (const audio of activeClientAudios) {
    try {
      audio.pause();
      audio.currentTime = 0;
    } catch (_) {}
  }
  activeClientAudios.clear();
}

export function syncClientBgm(bgmState) {
  if (!clientAudioEnabled) {
    if (clientBgmAudio) {
      clientBgmAudio.pause();
      clientBgmAudio = null;
    }
    return;
  }

  if (bgmState?.isPlaying && bgmState?.currentTrack) {
    const trackUrl = `/bgm/${encodeURIComponent(bgmState.currentTrack)}`;
    const targetVol = Math.max(0, Math.min(1, bgmState.currentVolume ?? bgmState.baseVolume ?? 0.5));

    if (!clientBgmAudio || clientBgmAudio.getAttribute('data-track') !== bgmState.currentTrack) {
      if (clientBgmAudio) {
        clientBgmAudio.pause();
      }
      clientBgmAudio = new Audio(trackUrl);
      clientBgmAudio.setAttribute('data-track', bgmState.currentTrack);
      clientBgmAudio.loop = true;
      clientBgmAudio.volume = targetVol;
      clientBgmAudio.play().catch((err) => {
        console.warn('[BGM] Autoplay blocked by browser:', err.message);
      });
    } else {
      clientBgmAudio.volume = targetVol;
    }
  } else {
    if (clientBgmAudio) {
      clientBgmAudio.pause();
      clientBgmAudio = null;
    }
  }
}
