const assert = require('assert');
const http = require('http');
const { Server } = require('socket.io');
const { io } = require('socket.io-client');
const EventEmitter = require('events');
const { setupSockets } = require('../src/sockets');

class MockObsManager extends EventEmitter {
  constructor() {
    super();
    this.isConnected = true;
    this.currentScene = 'Main';
    this.scenes = ['Main', 'Ending'];
    this.audioInputs = [{ name: 'Mic', muted: false }];
  }
  getState() {
    return {
      connected: this.isConnected,
      currentScene: this.currentScene,
      scenes: this.scenes,
      audioInputs: this.audioInputs,
      isStreaming: false,
      isRecording: false
    };
  }
  async setScene(name) {
    if (name === 'BadScene') throw new Error('Scene not found');
    this.currentScene = name;
    return { sceneName: name };
  }
  async toggleInputMute(name) {
    if (name === 'BadInput') throw new Error('Input not found');
    return { inputName: name, muted: true };
  }
  async toggleStream() {
    return { isStreaming: true };
  }
  async toggleRecord() {
    return { isRecording: true };
  }
  async refreshState() {
    return this.getState();
  }
  async getSceneItemList(scene) {
    if (scene === 'BadScene') throw new Error('Scene not found');
    return [{ sceneItemId: 1, sourceName: 'Display', sceneItemEnabled: true }];
  }
  async toggleSceneItem(scene, id) {
    if (id === -1) throw new Error('Item not found');
    return { sceneName: scene, sceneItemId: id, sceneItemEnabled: false };
  }
  async setSceneItemEnabled(scene, id, enabled) {
    if (id === -1) throw new Error('Item not found');
    return { sceneName: scene, sceneItemId: id, sceneItemEnabled: enabled };
  }
}

const mockObs = new MockObsManager();

const mockAudio = {
  getSounds() {
    return [{ filename: 'applause.mp3', name: 'Applause' }];
  },
  async play(file, vol) {
    return { status: 'playing' };
  },
  stopAll() {
    return { status: 'stopped' };
  }
};

const mockBgm = {
  getTracks() {
    return [{ filename: 'bgm1.mp3', name: 'Bgm 1' }];
  },
  getState() {
    return { isPlaying: false, currentTrack: null, baseVolume: 0.5 };
  },
  async play(file) {
    return { isPlaying: true, currentTrack: file };
  },
  stop() {
    return { isPlaying: false, currentTrack: null };
  },
  setVolume(vol) {
    return { baseVolume: vol };
  }
};

const mockConfigService = {
  _cfg: {
    server: { port: 3000 },
    obs: { host: '127.0.0.1', port: 4455, password: '' },
    soundboard: { volume: 0.8 },
    bgm: { volume: 0.5 }
  },
  getConfig() {
    return this._cfg;
  },
  updateConfig(p) {
    this._cfg = { ...this._cfg, ...p };
    return this._cfg;
  }
};

const server = http.createServer();
const serverIo = new Server(server, { cors: { origin: '*' } });
setupSockets(serverIo, {
  obsManager: mockObs,
  audioManager: mockAudio,
  bgmManager: mockBgm,
  configService: mockConfigService
});

(async () => {
  await new Promise((res) => server.listen(0, '127.0.0.1', res));
  const port = server.address().port;
  const client = io(`http://127.0.0.1:${port}`);

  try {
    // 1. Connection & init:state event
    const initState = await new Promise((res) => {
      client.on('init:state', res);
    });
    assert.strictEqual(initState.obs.currentScene, 'Main');
    assert.strictEqual(initState.sounds[0].filename, 'applause.mp3');
    assert.strictEqual(initState.bgm.tracks[0].filename, 'bgm1.mp3');

    // 2. obs:scene
    const sceneRes = await new Promise((res) => client.emit('obs:scene', 'Ending', res));
    assert.strictEqual(sceneRes.success, true);
    assert.strictEqual(mockObs.currentScene, 'Ending');

    // 3. obs:toggleMute
    const muteRes = await new Promise((res) => client.emit('obs:toggleMute', 'Mic', res));
    assert.strictEqual(muteRes.success, true);
    assert.strictEqual(muteRes.muted, true);

    // 4. obs:toggleStream & obs:toggleRecord
    const streamRes = await new Promise((res) => client.emit('obs:toggleStream', res));
    assert.strictEqual(streamRes.success, true);
    assert.strictEqual(streamRes.isStreaming, true);

    const recordRes = await new Promise((res) => client.emit('obs:toggleRecord', res));
    assert.strictEqual(recordRes.success, true);
    assert.strictEqual(recordRes.isRecording, true);

    // 5. obs:refresh
    const refreshRes = await new Promise((res) => client.emit('obs:refresh', res));
    assert.strictEqual(refreshRes.success, true);

    // 6. obs:getSceneItems, obs:toggleSceneItem, obs:setSceneItemEnabled
    const itemsRes = await new Promise((res) => client.emit('obs:getSceneItems', 'Main', res));
    assert.strictEqual(itemsRes.success, true);
    assert.strictEqual(itemsRes.items[0].sourceName, 'Display');

    const toggleRes = await new Promise((res) => client.emit('obs:toggleSceneItem', { sceneName: 'Main', sceneItemId: 1 }, res));
    assert.strictEqual(toggleRes.success, true);
    assert.strictEqual(toggleRes.sceneItemEnabled, false);

    const setRes = await new Promise((res) => client.emit('obs:setSceneItemEnabled', { sceneName: 'Main', sceneItemId: 1, enabled: true }, res));
    assert.strictEqual(setRes.success, true);
    assert.strictEqual(setRes.sceneItemEnabled, true);

    // 7. sound:play & sound:stop
    const soundStartedPromise = new Promise((res) => client.once('sound:started', res));
    const playRes = await new Promise((res) => client.emit('sound:play', 'applause.mp3', res));
    assert.strictEqual(playRes.success, true);
    const startedData = await soundStartedPromise;
    assert.strictEqual(startedData.filename, 'applause.mp3');

    const soundStoppedPromise = new Promise((res) => client.once('sound:stopped', res));
    const stopRes = await new Promise((res) => client.emit('sound:stop', res));
    assert.strictEqual(stopRes.success, true);
    await soundStoppedPromise;

    // 8. bgm:play, bgm:volume, bgm:stop
    const bgmPlayRes = await new Promise((res) => client.emit('bgm:play', { filename: 'bgm1.mp3', volume: 0.6 }, res));
    assert.strictEqual(bgmPlayRes.success, true);

    const bgmVolRes = await new Promise((res) => client.emit('bgm:volume', 0.4, res));
    assert.strictEqual(bgmVolRes.success, true);

    const bgmStopRes = await new Promise((res) => client.emit('bgm:stop', res));
    assert.strictEqual(bgmStopRes.success, true);

    // 9. OBS event bridges to client
    const bridgePromise = new Promise((res) => client.once('obs:sceneChanged', res));
    mockObs.emit('sceneChanged', { sceneName: 'Intermission' });
    const bridgeData = await bridgePromise;

    // 10. Negative Scenarios: Socket error callbacks
    const badSceneRes = await new Promise((res) => client.emit('obs:scene', 'BadScene', res));
    assert.ok(badSceneRes.error);

    const badMuteRes = await new Promise((res) => client.emit('obs:toggleMute', 'BadInput', res));
    assert.ok(badMuteRes.error);

    const badItemsRes = await new Promise((res) => client.emit('obs:getSceneItems', 'BadScene', res));
    assert.ok(badItemsRes.error);

    const badToggleRes = await new Promise((res) => client.emit('obs:toggleSceneItem', { sceneName: 'Main', sceneItemId: -1 }, res));
    assert.ok(badToggleRes.error);

    const badSetRes = await new Promise((res) => client.emit('obs:setSceneItemEnabled', { sceneName: 'Main', sceneItemId: -1, enabled: true }, res));
    assert.ok(badSetRes.error);
    assert.strictEqual(bridgeData.sceneName, 'Intermission');

    console.log('socket tests passed.');
  } finally {
    client.disconnect();
    server.close();
  }
})();
