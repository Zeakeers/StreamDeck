const assert = require('assert');
const http = require('http');
const express = require('express');
const { createApiRouter } = require('../src/routes/api');

// Mock dependencies
const mockObs = {
  isConnected: true,
  currentScene: 'Gaming',
  getState() {
    return {
      connected: this.isConnected,
      currentScene: this.currentScene,
      scenes: ['Gaming', 'Chatting'],
      audioInputs: [{ name: 'Mic', muted: false }]
    };
  },
  async connect(host, port, pass) {
    return { success: true };
  },
  async disconnect() {},
  async setScene(name) {
    if (name === 'Invalid') throw new Error('Scene tidak ada');
    this.currentScene = name;
    return { sceneName: name };
  },
  async toggleInputMute(name) {
    if (name === 'Invalid') throw new Error('Input tidak ada');
    return { inputName: name, muted: true };
  },
  async toggleStream() {
    return { isStreaming: true };
  },
  async toggleRecord() {
    return { isRecording: true };
  },
  async getSceneItemList(sceneName) {
    if (sceneName === 'Invalid') throw new Error('Scene tidak ada');
    return [{ sceneItemId: 5, sourceName: 'Webcam', sceneItemEnabled: true }];
  },
  async toggleSceneItem(sceneName, id) {
    if (id === -1) throw new Error('Item tidak ada');
    return { sceneName, sceneItemId: id, sceneItemEnabled: false };
  },
  async setSceneItemEnabled(sceneName, id, enabled) {
    if (id === -1) throw new Error('Item tidak ada');
    return { sceneName, sceneItemId: id, sceneItemEnabled: enabled };
  }
};

const mockAudio = {
  soundsDir: '/tmp',
  getSounds() {
    return [{ filename: 'beep.mp3', name: 'Beep' }];
  },
  async play(filename, vol) {
    return { status: 'playing', file: filename };
  },
  stopAll() {
    return { status: 'stopped', count: 1 };
  },
  renameSound(oldName, newName) {
    if (!newName || !newName.trim()) throw new Error('Nama baru tidak valid.');
    return { success: true, newFilename: `${newName}.mp3` };
  },
  deleteSound(filename) {
    if (filename === 'missing.mp3') throw new Error('File tidak ditemukan.');
    return { success: true, deleted: filename };
  }
};

const mockBgm = {
  bgmDir: '/tmp',
  getTracks() {
    return [{ filename: 'loop.mp3', name: 'Loop' }];
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
  },
  renameTrack(oldName, newName) {
    if (!newName || !newName.trim()) throw new Error('Nama baru tidak valid.');
    return { success: true, newFilename: `${newName}.mp3` };
  },
  deleteTrack(file) {
    if (file === 'missing.mp3') throw new Error('File tidak ditemukan.');
    return { success: true, deleted: file };
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
  updateConfig(partial) {
    this._cfg = { ...this._cfg, ...partial };
    return this._cfg;
  }
};

const mockIo = {
  emit() {}
};

const app = express();
app.use(express.json());
app.use('/api', createApiRouter({
  obsManager: mockObs,
  audioManager: mockAudio,
  bgmManager: mockBgm,
  configService: mockConfigService,
  io: mockIo
}));

const server = http.createServer(app);

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: '127.0.0.1',
      port: addr.port,
      path: `/api${path}`,
      method,
      headers: {
        ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {})
      }
    }, (res) => {
      let data = '';
      res.on('data', (c) => data += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (_) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

(async () => {
  await new Promise((res) => server.listen(0, '127.0.0.1', res));

  try {
    // 1. GET /status & /config
    const st = await request('GET', '/status');
    assert.strictEqual(st.status, 200);
    assert.strictEqual(st.body.obs.currentScene, 'Gaming');
    assert.strictEqual(st.body.sounds.length, 1);

    const cfg = await request('GET', '/config');
    assert.strictEqual(cfg.status, 200);
    assert.strictEqual(cfg.body.server.port, 3000);

    // 2. POST /config
    const cfgPost = await request('POST', '/config', { soundboard: { volume: 0.9 } });
    assert.strictEqual(cfgPost.status, 200);
    assert.strictEqual(cfgPost.body.config.soundboard.volume, 0.9);

    // 3. OBS routes
    const conn = await request('POST', '/obs/connect', { host: '127.0.0.1', port: 4455 });
    assert.strictEqual(conn.status, 200);
    assert.strictEqual(conn.body.success, true);

    const scene = await request('POST', '/obs/scene', { sceneName: 'Chatting' });
    assert.strictEqual(scene.status, 200);
    assert.strictEqual(scene.body.sceneName, 'Chatting');

    const mute = await request('POST', '/obs/toggle-mute', { inputName: 'Mic' });
    assert.strictEqual(mute.status, 200);
    assert.strictEqual(mute.body.muted, true);

    const stream = await request('POST', '/obs/toggle-stream');
    assert.strictEqual(stream.status, 200);
    assert.strictEqual(stream.body.isStreaming, true);

    const rec = await request('POST', '/obs/toggle-record');
    assert.strictEqual(rec.status, 200);
    assert.strictEqual(rec.body.isRecording, true);

    const items = await request('GET', '/obs/scenes/Gaming/items');
    assert.strictEqual(items.status, 200);
    assert.strictEqual(items.body.items[0].sourceName, 'Webcam');

    const toggleSrc = await request('POST', '/obs/toggle-source', { sceneName: 'Gaming', sceneItemId: 5 });
    assert.strictEqual(toggleSrc.status, 200);
    assert.strictEqual(toggleSrc.body.sceneItemEnabled, false);

    const setSrc = await request('POST', '/obs/set-source', { sceneName: 'Gaming', sceneItemId: 5, enabled: true });
    assert.strictEqual(setSrc.status, 200);
    assert.strictEqual(setSrc.body.sceneItemEnabled, true);

    // 4. Soundboard routes
    const sounds = await request('GET', '/sounds');
    assert.strictEqual(sounds.status, 200);
    assert.strictEqual(sounds.body.length, 1);

    const playSound = await request('POST', '/sounds/play', { filename: 'beep.mp3', volume: 0.8 });
    assert.strictEqual(playSound.status, 200);
    assert.strictEqual(playSound.body.success, true);
    assert.strictEqual(playSound.body.filename, 'beep.mp3');

    const stopSounds = await request('POST', '/sounds/stop');
    assert.strictEqual(stopSounds.status, 200);
    assert.strictEqual(stopSounds.body.success, true);

    const renameSound = await request('PUT', '/sounds/beep.mp3', { name: 'Boop' });
    assert.strictEqual(renameSound.status, 200);
    assert.strictEqual(renameSound.body.result.newFilename, 'Boop.mp3');

    const deleteSound = await request('DELETE', '/sounds/beep.mp3');
    assert.strictEqual(deleteSound.status, 200);
    assert.strictEqual(deleteSound.body.result.deleted, 'beep.mp3');

    // 5. BGM routes
    const bgms = await request('GET', '/bgm');
    assert.strictEqual(bgms.status, 200);
    assert.strictEqual(bgms.body.tracks.length, 1);

    const playBgm = await request('POST', '/bgm/play', { filename: 'loop.mp3' });
    assert.strictEqual(playBgm.status, 200);
    assert.strictEqual(playBgm.body.state.currentTrack, 'loop.mp3');

    const stopBgm = await request('POST', '/bgm/stop');
    assert.strictEqual(stopBgm.status, 200);
    assert.strictEqual(stopBgm.body.state.isPlaying, false);

    const volBgm = await request('POST', '/bgm/volume', { volume: 0.7 });
    assert.strictEqual(volBgm.status, 200);
    assert.strictEqual(volBgm.body.state.baseVolume, 0.7);

    const renameBgm = await request('PUT', '/bgm/loop.mp3', { name: 'Chill' });
    assert.strictEqual(renameBgm.status, 200);
    assert.strictEqual(renameBgm.body.result.newFilename, 'Chill.mp3');

    const deleteBgm = await request('DELETE', '/bgm/loop.mp3');
    assert.strictEqual(deleteBgm.status, 200);
    assert.strictEqual(deleteBgm.body.result.deleted, 'loop.mp3');

    // 6. Negative Scenarios: 400 Bad Request
    const badScene = await request('POST', '/obs/scene', { sceneName: 'Invalid' });
    assert.strictEqual(badScene.status, 400);
    assert.ok(badScene.body.error);

    const badMute = await request('POST', '/obs/toggle-mute', { inputName: 'Invalid' });
    assert.strictEqual(badMute.status, 400);

    const badItems = await request('GET', '/obs/scenes/Invalid/items');
    assert.strictEqual(badItems.status, 400);

    const badToggleSrc = await request('POST', '/obs/toggle-source', { sceneName: 'Gaming', sceneItemId: -1 });
    assert.strictEqual(badToggleSrc.status, 400);

    const badSetSrc = await request('POST', '/obs/set-source', { sceneName: 'Gaming', sceneItemId: -1, enabled: true });
    assert.strictEqual(badSetSrc.status, 400);

    const emptyUpload = await request('POST', '/sounds/upload');
    assert.strictEqual(emptyUpload.status, 400);

    const badRenameSound = await request('PUT', '/sounds/beep.mp3', { name: '  ' });
    assert.strictEqual(badRenameSound.status, 400);

    const badDeleteSound = await request('DELETE', '/sounds/missing.mp3');
    assert.strictEqual(badDeleteSound.status, 400);

    const badRenameBgm = await request('PUT', '/bgm/loop.mp3', { name: '  ' });
    assert.strictEqual(badRenameBgm.status, 400);

    const badDeleteBgm = await request('DELETE', '/bgm/missing.mp3');
    assert.strictEqual(badDeleteBgm.status, 400);

    console.log('API routes tests passed.');
  } finally {
    server.close();
  }
})();
