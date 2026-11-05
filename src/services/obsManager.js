const { OBSWebSocket } = require('obs-websocket-js');
const EventEmitter = require('events');

class ObsManager extends EventEmitter {
  constructor() {
    super();
    this.obs = new OBSWebSocket();
    this.isConnected = false;
    this.currentScene = '';
    this.scenes = [];
    this.audioInputs = [];
    this.isStreaming = false;
    this.isRecording = false;
    this.reconnectTimer = null;
    this.lastConfig = { host: '127.0.0.1', port: 4455, password: '' };

    this.setupListeners();
  }

  setupListeners() {
    this.obs.on('Identified', async () => {
      this.isConnected = true;
      console.log('[OBS] Terhubung ke OBS Studio!');
      await this.refreshState();
      this.emit('connected', this.getState());
    });

    this.obs.on('ConnectionClosed', (error) => {
      if (this.isConnected) {
        console.log('[OBS] Koneksi terputus ke OBS:', error?.message || 'OBS ditutup');
      }
      this.isConnected = false;
      this.scenes = [];
      this.currentScene = '';
      this.emit('disconnected', { message: error?.message || 'Disconnected' });
    });

    this.obs.on('CurrentProgramSceneChanged', (data) => {
      this.currentScene = data.sceneName;
      this.emit('sceneChanged', { sceneName: data.sceneName });
    });

    this.obs.on('SceneCreated', () => this.refreshState());
    this.obs.on('SceneRemoved', () => this.refreshState());
    this.obs.on('SceneNameChanged', () => this.refreshState());

    this.obs.on('RecordStateChanged', (data) => {
      this.isRecording = data.outputActive;
      this.emit('recordStateChanged', {
        active: data.outputActive,
        state: data.outputState
      });
    });

    this.obs.on('StreamStateChanged', (data) => {
      this.isStreaming = data.outputActive;
      this.emit('streamStateChanged', {
        active: data.outputActive,
        state: data.outputState
      });
    });

    this.obs.on('InputMuteStateChanged', (data) => {
      this.emit('inputMuteChanged', {
        inputName: data.inputName,
        muted: data.inputMuted
      });
    });
  }

  async connect(host = '127.0.0.1', port = 4455, password = '') {
    this.lastConfig = { host, port, password };
    const address = `ws://${host}:${port}`;
    console.log(`[OBS] Menghubungkan ke ${address}...`);

    try {
      await this.obs.connect(address, password || undefined, {
        rpcVersion: 1
      });
      return { success: true };
    } catch (err) {
      this.isConnected = false;
      console.warn(`[OBS] Gagal terhubung ke OBS: ${err.message}`);
      return {
        success: false,
        error: err.message || 'Tidak dapat terhubung ke OBS WebSocket. Pastikan OBS menyala.'
      };
    }
  }

  async disconnect() {
    if (this.reconnectTimer) {
      clearInterval(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.isConnected) {
      await this.obs.disconnect();
    }
    this.isConnected = false;
  }

  async refreshState() {
    if (!this.isConnected) return;
    try {
      const sceneList = await this.obs.call('GetSceneList');
      this.currentScene = sceneList.currentProgramSceneName;
      // In OBS WebSocket v5, scene items have sceneName
      this.scenes = (sceneList.scenes || []).map((s) => s.sceneName || s);

      // Get streaming and recording status
      try {
        const streamStatus = await this.obs.call('GetStreamStatus');
        this.isStreaming = streamStatus.outputActive;
      } catch (_) {
        this.isStreaming = false;
      }

      try {
        const recordStatus = await this.obs.call('GetRecordStatus');
        this.isRecording = recordStatus.outputActive;
      } catch (_) {
        this.isRecording = false;
      }

      // Get audio inputs
      try {
        const inputList = await this.obs.call('GetInputList');
        const inputs = [];
        for (const input of inputList.inputs || []) {
          // Check if input has volume/mute capabilities
          try {
            const muteInfo = await this.obs.call('GetInputMute', { inputName: input.inputName });
            inputs.push({
              name: input.inputName,
              kind: input.inputKind,
              muted: muteInfo.inputMuted
            });
          } catch (_) {
            // Not an audio input or does not support mute
          }
        }
        this.audioInputs = inputs;
      } catch (_) {
        this.audioInputs = [];
      }

      this.emit('stateUpdated', this.getState());
    } catch (err) {
      console.warn('[OBS] Gagal me-refresh state:', err.message);
    }
  }

  getState() {
    return {
      connected: this.isConnected,
      currentScene: this.currentScene,
      scenes: this.scenes,
      audioInputs: this.audioInputs,
      isStreaming: this.isStreaming,
      isRecording: this.isRecording
    };
  }

  async setScene(sceneName) {
    if (!this.isConnected) throw new Error('OBS belum terhubung');
    await this.obs.call('SetCurrentProgramScene', { sceneName });
    this.currentScene = sceneName;
    return { sceneName };
  }

  async toggleInputMute(inputName) {
    if (!this.isConnected) throw new Error('OBS belum terhubung');
    const res = await this.obs.call('ToggleInputMute', { inputName });
    return { inputName, muted: res.inputMuted };
  }

  async toggleRecord() {
    if (!this.isConnected) throw new Error('OBS belum terhubung');
    const res = await this.obs.call('ToggleRecord');
    this.isRecording = res.outputActive;
    return { isRecording: res.outputActive };
  }

  async toggleStream() {
    if (!this.isConnected) throw new Error('OBS belum terhubung');
    const res = await this.obs.call('ToggleStream');
    this.isStreaming = res.outputActive;
    return { isStreaming: res.outputActive };
  }
}

module.exports = ObsManager;
