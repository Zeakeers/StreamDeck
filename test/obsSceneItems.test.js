const assert = require('assert');
const ObsManager = require('../src/services/obsManager');

const obs = new ObsManager();

// 1. Unconnected guard tests
assert.rejects(
  async () => obs.getSceneItemList('Scene 1'),
  /OBS belum terhubung/,
  'getSceneItemList must throw when disconnected'
);

assert.rejects(
  async () => obs.setSceneItemEnabled('Scene 1', 1, true),
  /OBS belum terhubung/,
  'setSceneItemEnabled must throw when disconnected'
);

assert.rejects(
  async () => obs.toggleSceneItem('Scene 1', 1),
  /OBS belum terhubung/,
  'toggleSceneItem must throw when disconnected'
);

// 2. Mock connected state and verify OBS WebSocket v5 requests
obs.isConnected = true;
obs.currentScene = 'Gaming';

let lastCall = null;
const mockStore = {
  enabled: false
};

obs.obs.call = async (requestType, params) => {
  lastCall = { requestType, params };
  if (requestType === 'GetSceneItemList') {
    return {
      sceneItems: [
        { sceneItemId: 10, sourceName: 'Facecam', sceneItemEnabled: true, inputKind: 'v4l2_input', isGroup: false },
        { sceneItemId: 11, sourceName: 'Alert Box', sceneItemEnabled: mockStore.enabled, inputKind: 'browser_source', isGroup: false }
      ]
    };
  }
  if (requestType === 'GetSceneItemEnabled') {
    return { sceneItemEnabled: mockStore.enabled };
  }
  if (requestType === 'SetSceneItemEnabled') {
    mockStore.enabled = params.sceneItemEnabled;
    return {};
  }
  throw new Error(`Unhandled requestType: ${requestType}`);
};

(async () => {
  // Test getSceneItemList
  const items = await obs.getSceneItemList('Gaming');
  assert.strictEqual(items.length, 2);
  assert.strictEqual(items[0].sourceName, 'Facecam');
  assert.strictEqual(items[0].sceneItemEnabled, true);
  assert.strictEqual(items[1].sourceName, 'Alert Box');
  assert.strictEqual(items[1].sceneItemEnabled, false);
  assert.strictEqual(lastCall.requestType, 'GetSceneItemList');
  assert.strictEqual(lastCall.params.sceneName, 'Gaming');

  // Test setSceneItemEnabled
  const setResult = await obs.setSceneItemEnabled('Gaming', 11, true);
  assert.strictEqual(setResult.sceneItemEnabled, true);
  assert.strictEqual(mockStore.enabled, true);
  assert.strictEqual(lastCall.requestType, 'SetSceneItemEnabled');
  assert.strictEqual(lastCall.params.sceneItemId, 11);
  assert.strictEqual(lastCall.params.sceneItemEnabled, true);

  // Test toggleSceneItem (currently true -> should become false)
  const toggleResult = await obs.toggleSceneItem('Gaming', 11);
  assert.strictEqual(toggleResult.sceneItemEnabled, false);
  assert.strictEqual(mockStore.enabled, false);

  // 3. Test event relay from OBS to obsManager
  let receivedEvent = null;
  obs.on('sceneItemEnableStateChanged', (data) => {
    receivedEvent = data;
  });

  obs.obs.emit('SceneItemEnableStateChanged', {
    sceneName: 'Gaming',
    sceneItemId: 11,
    sceneItemEnabled: true
  });

  assert.deepStrictEqual(receivedEvent, {
    sceneName: 'Gaming',
    sceneItemId: 11,
    sceneItemEnabled: true
  });

  console.log('OBS Scene Items tests passed.');
})();
