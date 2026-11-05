// Browser audio playback disabled: audio output is handled exclusively via CLI daemon (streamdeck-player)

export function isClientAudioEnabled() {
  return false;
}

export function setClientAudioEnabled() {}

export function playClientSound() {}

export function stopClientSounds() {}

export function syncClientBgm() {}

export function playBgmDirect() {}

export function stopBgmDirect() {}
