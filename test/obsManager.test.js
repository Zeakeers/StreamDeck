const assert = require('assert');
const ObsManager = require('../src/services/obsManager');

const obs = new ObsManager();

// 1. Initial State
const initialState = obs.getState();
assert.strictEqual(initialState.connected, false);
assert.strictEqual(initialState.currentScene, '');
assert.deepStrictEqual(initialState.scenes, []);
assert.deepStrictEqual(initialState.audioInputs, []);
assert.strictEqual(initialState.isStreaming, false);
assert.strictEqual(initialState.isRecording, false);

// 2. Disconnected guards for all actions
assert.rejects(async () => obs.setScene('Scene 1'), /OBS belum terhubung/);
assert.rejects(async () => obs.toggleInputMute('Mic'), /OBS belum terhubung/);
assert.rejects(async () => obs.toggleRecord(), /OBS belum terhubung/);
assert.rejects(async () => obs.toggleStream(), /OBS belum terhubung/);
assert.rejects(async () => obs.getSceneItemList('Scene 1'), /OBS belum terhubung/);
assert.rejects(async () => obs.setSceneItemEnabled('Scene 1', 1, true), /OBS belum terhubung/);
assert.rejects(async () => obs.toggleSceneItem('Scene 1', 1), /OBS belum terhubung/);

// Negative scenario: target scene empty when currentScene is empty
obs.isConnected = true;
obs.currentScene = '';
assert.rejects(async () => obs.getSceneItemList(''), /Scene belum dipilih atau tidak ada/);
obs.isConnected = false;

// 3. Mock OBS calls when connected
obs.isConnected = true;
obs.currentScene = 'Main';
const mockData = {
  currentProgramSceneName: 'Main',
  scenes: [{ sceneName: 'Main' }, { sceneName: 'BRB' }],
  streamActive: false,
  recordActive: false,
  inputs: [
    { inputName: 'Desktop Audio', inputKind: 'wasapi_output_capture' },
    { inputName: 'Mic/Aux', inputKind: 'wasapi_input_capture' }
  ],
  mutes: {
    'Desktop Audio': false,
    'Mic/Aux': true
  },
  sceneItems: [
    { sceneItemId: 1, sourceName: 'Camera', sceneItemEnabled: true, inputKind: 'v4l2_input', isGroup: false },
    { sceneItemId: 2, sourceName: 'Overlay', sceneItemEnabled: false, inputKind: 'image_source', isGroup: false }
  ]
};

obs.obs.call = async (requestType, params) => {
  switch (requestType) {
    case 'GetSceneList':
      return { currentProgramSceneName: mockData.currentProgramSceneName, scenes: mockData.scenes };
    case 'GetStreamStatus':
      return { outputActive: mockData.streamActive };
    case 'GetRecordStatus':
      return { outputActive: mockData.recordActive };
    case 'GetInputList':
      return { inputs: mockData.inputs };
    case 'GetInputMute':
      return { inputMuted: Boolean(mockData.mutes[params.inputName]) };
    case 'SetCurrentProgramScene':
      mockData.currentProgramSceneName = params.sceneName;
      return {};
    case 'ToggleInputMute':
      mockData.mutes[params.inputName] = !mockData.mutes[params.inputName];
      return { inputMuted: mockData.mutes[params.inputName] };
    case 'ToggleStream':
      mockData.streamActive = !mockData.streamActive;
      return { outputActive: mockData.streamActive };
    case 'ToggleRecord':
      mockData.recordActive = !mockData.recordActive;
      return { outputActive: mockData.recordActive };
    case 'GetSceneItemList':
      return { sceneItems: mockData.sceneItems };
    case 'GetSceneItemEnabled': {
      const item = mockData.sceneItems.find((i) => i.sceneItemId === params.sceneItemId);
      return { sceneItemEnabled: item ? item.sceneItemEnabled : false };
    }
    case 'SetSceneItemEnabled': {
      const item = mockData.sceneItems.find((i) => i.sceneItemId === params.sceneItemId);
      if (item) item.sceneItemEnabled = params.sceneItemEnabled;
      return {};
    }
    default:
      throw new Error(`Unexpected requestType: ${requestType}`);
  }
};

(async () => {
  // 4. refreshState()
  await obs.refreshState();
  assert.strictEqual(obs.currentScene, 'Main');
  assert.deepStrictEqual(obs.scenes, ['Main', 'BRB']);
  assert.strictEqual(obs.audioInputs.length, 2);
  assert.strictEqual(obs.audioInputs[0].name, 'Desktop Audio');
  assert.strictEqual(obs.audioInputs[0].muted, false);
  assert.strictEqual(obs.audioInputs[1].name, 'Mic/Aux');
  assert.strictEqual(obs.audioInputs[1].muted, true);

  // 5. setScene()
  const sceneRes = await obs.setScene('BRB');
  assert.strictEqual(sceneRes.sceneName, 'BRB');
  assert.strictEqual(obs.currentScene, 'BRB');

  // 6. toggleInputMute()
  const muteRes = await obs.toggleInputMute('Desktop Audio');
  assert.strictEqual(muteRes.muted, true);

  // 7. toggleStream() & toggleRecord()
  const streamRes = await obs.toggleStream();
  assert.strictEqual(streamRes.isStreaming, true);
  assert.strictEqual(obs.isStreaming, true);

  const recRes = await obs.toggleRecord();
  assert.strictEqual(recRes.isRecording, true);
  assert.strictEqual(obs.isRecording, true);

  // 8. getSceneItemList(), setSceneItemEnabled(), toggleSceneItem()
  const items = await obs.getSceneItemList('BRB');
  assert.strictEqual(items.length, 2);
  assert.strictEqual(items[0].sourceName, 'Camera');
  assert.strictEqual(items[0].sceneItemEnabled, true);

  const setRes = await obs.setSceneItemEnabled('BRB', 1, false);
  assert.strictEqual(setRes.sceneItemEnabled, false);

  const toggleRes = await obs.toggleSceneItem('BRB', 1);
  assert.strictEqual(toggleRes.sceneItemEnabled, true);

  // 9. Event emissions
  let emitted = {};
  obs.on('sceneChanged', (d) => { emitted.sceneChanged = d; });
  obs.on('recordStateChanged', (d) => { emitted.recordStateChanged = d; });
  obs.on('streamStateChanged', (d) => { emitted.streamStateChanged = d; });
  obs.on('inputMuteChanged', (d) => { emitted.inputMuteChanged = d; });
  obs.on('sceneItemEnableStateChanged', (d) => { emitted.sceneItem = d; });

  obs.obs.emit('CurrentProgramSceneChanged', { sceneName: 'Main' });
  assert.strictEqual(emitted.sceneChanged.sceneName, 'Main');
  assert.strictEqual(obs.currentScene, 'Main');

  obs.obs.emit('RecordStateChanged', { outputActive: false, outputState: 'OBS_WEBSOCKET_OUTPUT_STOPPED' });
  assert.strictEqual(emitted.recordStateChanged.active, false);

  obs.obs.emit('StreamStateChanged', { outputActive: false, outputState: 'OBS_WEBSOCKET_OUTPUT_STOPPED' });
  assert.strictEqual(emitted.streamStateChanged.active, false);

  obs.obs.emit('InputMuteStateChanged', { inputName: 'Mic/Aux', inputMuted: false });
  assert.strictEqual(emitted.inputMuteChanged.muted, false);

  obs.obs.emit('SceneItemEnableStateChanged', { sceneName: 'Main', sceneItemId: 1, sceneItemEnabled: false });
  assert.strictEqual(emitted.sceneItem.sceneItemEnabled, false);

  // 10. Connection error handling & disconnect
  const badObs = new ObsManager();
  const connRes = await badObs.connect('127.0.0.1', 9999, '');
  assert.strictEqual(connRes.success, false);
  assert.ok(typeof connRes.error === 'string');

  await obs.disconnect();
  assert.strictEqual(obs.isConnected, false);

  // 11. Negative scenario: refreshState handles OBS call failure gracefully
  obs.isConnected = true;
  obs.obs.call = async () => { throw new Error('OBS query error'); };
  await obs.refreshState();
  obs.isConnected = false;

  console.log('obsManager tests passed.');
})();
