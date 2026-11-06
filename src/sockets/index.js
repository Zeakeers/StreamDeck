function setupSockets(io, { obsManager, audioManager, bgmManager, configService }) {
  // OBS to Socket.io bridge
  obsManager.on('connected', (state) => io.emit('obs:connected', state));
  obsManager.on('disconnected', (info) => io.emit('obs:disconnected', info));
  obsManager.on('sceneChanged', (data) => io.emit('obs:sceneChanged', data));
  obsManager.on('stateUpdated', (state) => io.emit('obs:stateUpdated', state));
  obsManager.on('recordStateChanged', (data) => io.emit('obs:recordStateChanged', data));
  obsManager.on('streamStateChanged', (data) => io.emit('obs:streamStateChanged', data));
  obsManager.on('inputMuteChanged', (data) => io.emit('obs:inputMuteChanged', data));
  obsManager.on('sceneItemEnableStateChanged', (data) => io.emit('obs:sceneItemEnableStateChanged', data));

  io.on('connection', (socket) => {
    const config = configService.getConfig();
    socket.emit('init:state', {
      obs: obsManager.getState(),
      sounds: audioManager.getSounds(),
      bgm: {
        tracks: bgmManager.getTracks(),
        state: bgmManager.getState()
      },
      config
    });

    socket.on('obs:scene', async (sceneName, callback) => {
      try {
        await obsManager.setScene(sceneName);
        if (typeof callback === 'function') callback({ success: true });
      } catch (err) {
        if (typeof callback === 'function') callback({ error: err.message });
      }
    });

    socket.on('obs:toggleMute', async (inputName, callback) => {
      try {
        const res = await obsManager.toggleInputMute(inputName);
        if (typeof callback === 'function') callback({ success: true, ...res });
      } catch (err) {
        if (typeof callback === 'function') callback({ error: err.message });
      }
    });

    socket.on('obs:toggleStream', async (callback) => {
      try {
        const res = await obsManager.toggleStream();
        if (typeof callback === 'function') callback({ success: true, ...res });
      } catch (err) {
        if (typeof callback === 'function') callback({ error: err.message });
      }
    });

    socket.on('obs:toggleRecord', async (callback) => {
      try {
        const res = await obsManager.toggleRecord();
        if (typeof callback === 'function') callback({ success: true, ...res });
      } catch (err) {
        if (typeof callback === 'function') callback({ error: err.message });
      }
    });

    socket.on('obs:refresh', async (callback) => {
      await obsManager.refreshState();
      if (typeof callback === 'function') callback({ success: true, state: obsManager.getState() });
    });

    socket.on('obs:getSceneItems', async (sceneName, callback) => {
      try {
        const items = await obsManager.getSceneItemList(sceneName);
        if (typeof callback === 'function') callback({ success: true, items });
      } catch (err) {
        if (typeof callback === 'function') callback({ error: err.message });
      }
    });

    socket.on('obs:toggleSceneItem', async (data, callback) => {
      try {
        const { sceneName, sceneItemId } = data || {};
        const res = await obsManager.toggleSceneItem(sceneName, sceneItemId);
        io.emit('obs:sceneItemEnableStateChanged', res);
        if (typeof callback === 'function') callback({ success: true, ...res });
      } catch (err) {
        if (typeof callback === 'function') callback({ error: err.message });
      }
    });

    socket.on('obs:setSceneItemEnabled', async (data, callback) => {
      try {
        const { sceneName, sceneItemId, enabled } = data || {};
        const res = await obsManager.setSceneItemEnabled(sceneName, sceneItemId, enabled);
        io.emit('obs:sceneItemEnableStateChanged', res);
        if (typeof callback === 'function') callback({ success: true, ...res });
      } catch (err) {
        if (typeof callback === 'function') callback({ error: err.message });
      }
    });

    socket.on('sound:play', async (data, callback) => {
      try {
        const cfg = configService.getConfig();
        const filename = typeof data === 'string' ? data : data?.filename;
        const volume = typeof data === 'object' && data?.volume !== undefined ? data.volume : (cfg.soundboard?.volume || 0.8);

        // Immediate broadcast to all clients (<0.5ms)
        io.emit('sound:started', {
          filename,
          volume,
          url: `/sounds/${encodeURIComponent(filename)}`
        });
        if (typeof callback === 'function') callback({ success: true });

        // Non-blocking server host playback
        audioManager.play(filename, volume).catch(() => {});
      } catch (err) {
        if (typeof callback === 'function') callback({ error: err.message });
      }
    });

    socket.on('sound:stop', (callback) => {
      audioManager.stopAll();
      io.emit('sound:stopped');
      io.emit('bgm:state', bgmManager.getState());
      if (typeof callback === 'function') callback({ success: true });
    });

    socket.on('bgm:play', async (data, callback) => {
      try {
        const filename = typeof data === 'string' ? data : data?.filename;
        const vol = typeof data === 'object' && typeof data?.volume === 'number' ? data.volume : undefined;
        if (vol !== undefined) {
          bgmManager.setVolume(vol);
          configService.updateConfig({ bgm: { volume: vol } });
        }
        let state;
        try {
          state = await bgmManager.play(filename);
        } catch (bgmErr) {
          bgmManager.currentTrack = filename;
          bgmManager.isPlaying = true;
          state = bgmManager.getState();
        }
        io.emit('bgm:state', state);
        if (typeof callback === 'function') callback({ success: true, state });
      } catch (err) {
        if (typeof callback === 'function') callback({ error: err.message });
      }
    });

    socket.on('bgm:stop', (callback) => {
      const state = bgmManager.stop();
      io.emit('bgm:state', state);
      if (typeof callback === 'function') callback({ success: true, state });
    });

    socket.on('bgm:volume', (volume, callback) => {
      const volNum = Math.max(0, Math.min(1, Number(volume) || 0.5));
      configService.updateConfig({ bgm: { volume: volNum } });
      const state = bgmManager.setVolume(volNum);
      io.emit('bgm:state', state);
      if (typeof callback === 'function') callback({ success: true, state });
    });
  });
}

module.exports = { setupSockets };
