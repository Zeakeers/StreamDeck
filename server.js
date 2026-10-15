const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const ObsManager = require('./lib/obsManager');
const AudioManager = require('./lib/audioManager');
const BgmManager = require('./lib/bgmManager');
const { printServerBanner, getPrimaryIp } = require('./lib/networkUtils');

const CONFIG_PATH = path.join(__dirname, 'config.json');

// Load config
let config = {
  server: { port: 3000 },
  obs: { host: '127.0.0.1', port: 4455, password: '', autoConnect: true },
  soundboard: { volume: 0.8 },
  bgm: { volume: 0.5 }
};

if (fs.existsSync(CONFIG_PATH)) {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
    config = { ...config, ...JSON.parse(raw) };
  } catch (err) {
    console.warn('Gagal membaca config.json, menggunakan konfigurasi default.');
  }
}

function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
  } catch (err) {
    console.error('Gagal menyimpan config.json:', err.message);
  }
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' }
});

const soundsDir = path.join(__dirname, 'sounds');
const bgmDir = path.join(__dirname, 'bgm');

const bgmManager = new BgmManager(bgmDir, config.bgm?.volume || 0.5);
const audioManager = new AudioManager(soundsDir);
audioManager.setBgmManager(bgmManager);
const obsManager = new ObsManager();

function getCleanSafeFilename(originalName, defaultPrefix, targetDir) {
  let cleanName = originalName;
  try {
    cleanName = Buffer.from(originalName, 'latin1').toString('utf8');
  } catch (_) {}

  const ext = path.extname(cleanName).toLowerCase();
  let baseName = path.basename(cleanName, ext).replace(/[/\\?%*:|"<>]/g, '').trim() || defaultPrefix;
  let targetName = `${baseName}${ext}`;
  let counter = 1;
  while (fs.existsSync(path.join(targetDir, targetName))) {
    targetName = `${baseName}_${counter}${ext}`;
    counter++;
  }
  return targetName;
}

// Setup Multer for soundboard file uploads
const soundStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, soundsDir);
  },
  filename: (req, file, cb) => {
    cb(null, getCleanSafeFilename(file.originalname, 'Sound', soundsDir));
  }
});

// Setup Multer for BGM file uploads
const bgmStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, bgmDir);
  },
  filename: (req, file, cb) => {
    cb(null, getCleanSafeFilename(file.originalname, 'BGM', bgmDir));
  }
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const allowed = ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'];
  if (allowed.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Format file tidak didukung. Gunakan MP3, WAV, OGG, atau M4A.'));
  }
};

const uploadSound = multer({ storage: soundStorage, limits: { fileSize: 50 * 1024 * 1024 }, fileFilter });
const uploadBgm = multer({ storage: bgmStorage, limits: { fileSize: 100 * 1024 * 1024 }, fileFilter });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/sounds', express.static(soundsDir));
app.use('/bgm', express.static(bgmDir));

// --- API Endpoints ---
app.get('/api/status', (req, res) => {
  res.json({
    obs: obsManager.getState(),
    sounds: audioManager.getSounds(),
    bgm: {
      tracks: bgmManager.getTracks(),
      state: bgmManager.getState()
    },
    ip: getPrimaryIp(),
    config
  });
});

app.get('/api/config', (req, res) => {
  res.json(config);
});

app.post('/api/config', async (req, res) => {
  const { obs, soundboard, bgm } = req.body;
  if (obs) {
    config.obs = { ...config.obs, ...obs };
  }
  if (soundboard) {
    config.soundboard = { ...config.soundboard, ...soundboard };
  }
  if (bgm) {
    config.bgm = { ...config.bgm, ...bgm };
    if (bgm.volume !== undefined) {
      bgmManager.setVolume(bgm.volume);
    }
  }
  saveConfig();

  // Reconnect OBS with new config if requested
  if (obs) {
    await obsManager.disconnect();
    const result = await obsManager.connect(config.obs.host, config.obs.port, config.obs.password);
    return res.json({ success: true, obsResult: result, config });
  }

  res.json({ success: true, config });
});

app.post('/api/obs/connect', async (req, res) => {
  const { host, port, password } = req.body;
  const targetHost = host || config.obs.host;
  const targetPort = port || config.obs.port;
  const targetPassword = password !== undefined ? password : config.obs.password;

  const result = await obsManager.connect(targetHost, targetPort, targetPassword);
  res.json(result);
});

app.post('/api/obs/scene', async (req, res) => {
  try {
    const { sceneName } = req.body;
    await obsManager.setScene(sceneName);
    res.json({ success: true, sceneName });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/obs/toggle-mute', async (req, res) => {
  try {
    const { inputName } = req.body;
    const result = await obsManager.toggleInputMute(inputName);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/obs/toggle-stream', async (req, res) => {
  try {
    const result = await obsManager.toggleStream();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/obs/toggle-record', async (req, res) => {
  try {
    const result = await obsManager.toggleRecord();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/sounds', (req, res) => {
  res.json(audioManager.getSounds());
});

app.post('/api/sounds/upload', uploadSound.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Tidak ada file audio yang diunggah.' });
  }
  const sounds = audioManager.getSounds();
  io.emit('sounds:updated', sounds);
  res.json({ success: true, file: req.file.filename, sounds });
});

app.put('/api/sounds/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const { name } = req.body;
    const result = audioManager.renameSound(filename, name);
    const sounds = audioManager.getSounds();
    io.emit('sounds:updated', sounds);
    res.json({ success: true, result, sounds });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/sounds/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const result = audioManager.deleteSound(filename);
    const sounds = audioManager.getSounds();
    io.emit('sounds:updated', sounds);
    res.json({ success: true, result, sounds });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/sounds/play', async (req, res) => {
  try {
    const { filename, volume } = req.body;
    const vol = volume !== undefined ? volume : config.soundboard.volume;
    await audioManager.play(filename, vol);
    io.emit('sound:started', { filename });
    io.emit('bgm:state', bgmManager.getState());
    res.json({ success: true, filename });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/sounds/stop', (req, res) => {
  audioManager.stopAll();
  io.emit('sound:stopped');
  io.emit('bgm:state', bgmManager.getState());
  res.json({ success: true });
});

// --- BGM Endpoints ---
app.get('/api/bgm', (req, res) => {
  res.json({
    tracks: bgmManager.getTracks(),
    state: bgmManager.getState()
  });
});

app.post('/api/bgm/play', async (req, res) => {
  try {
    const { filename } = req.body;
    const state = await bgmManager.play(filename);
    io.emit('bgm:state', state);
    res.json({ success: true, state });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/bgm/stop', (req, res) => {
  const state = bgmManager.stop();
  io.emit('bgm:state', state);
  res.json({ success: true, state });
});

app.post('/api/bgm/volume', (req, res) => {
  const { volume } = req.body;
  if (volume !== undefined) {
    config.bgm.volume = volume;
    saveConfig();
  }
  const state = bgmManager.setVolume(volume);
  io.emit('bgm:state', state);
  res.json({ success: true, state });
});

app.post('/api/bgm/upload', uploadBgm.single('audio'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'Tidak ada file audio BGM yang diunggah.' });
  }
  const tracks = bgmManager.getTracks();
  io.emit('bgm:updated', { tracks, state: bgmManager.getState() });
  res.json({ success: true, file: req.file.filename, tracks });
});

app.put('/api/bgm/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const { name } = req.body;
    const result = bgmManager.renameTrack(filename, name);
    const tracks = bgmManager.getTracks();
    io.emit('bgm:updated', { tracks, state: bgmManager.getState() });
    res.json({ success: true, result, tracks });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/bgm/:filename', (req, res) => {
  try {
    const { filename } = req.params;
    const result = bgmManager.deleteTrack(filename);
    const tracks = bgmManager.getTracks();
    io.emit('bgm:updated', { tracks, state: bgmManager.getState() });
    res.json({ success: true, result, tracks });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- OBS Manager to Socket.io Bridge ---
obsManager.on('connected', (state) => io.emit('obs:connected', state));
obsManager.on('disconnected', (info) => io.emit('obs:disconnected', info));
obsManager.on('sceneChanged', (data) => io.emit('obs:sceneChanged', data));
obsManager.on('stateUpdated', (state) => io.emit('obs:stateUpdated', state));
obsManager.on('recordStateChanged', (data) => io.emit('obs:recordStateChanged', data));
obsManager.on('streamStateChanged', (data) => io.emit('obs:streamStateChanged', data));
obsManager.on('inputMuteChanged', (data) => io.emit('obs:inputMuteChanged', data));

// --- Socket.io Handlers ---
io.on('connection', (socket) => {
  // Send initial state upon connection
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

  socket.on('sound:play', async (data, callback) => {
    try {
      const filename = typeof data === 'string' ? data : data?.filename;
      const volume = typeof data === 'object' && data?.volume ? data.volume : config.soundboard.volume;
      await audioManager.play(filename, volume);
      io.emit('sound:started', { filename });
      if (typeof callback === 'function') callback({ success: true });
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

  socket.on('bgm:play', async (filename, callback) => {
    try {
      const state = await bgmManager.play(filename);
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
    config.bgm.volume = volume;
    saveConfig();
    const state = bgmManager.setVolume(volume);
    io.emit('bgm:state', state);
    if (typeof callback === 'function') callback({ success: true, state });
  });
});

// Periodic auto-reconnect if OBS is not connected
let reconnectInterval = null;
function startAutoReconnect() {
  if (reconnectInterval) return;
  reconnectInterval = setInterval(async () => {
    if (!obsManager.isConnected && config.obs.autoConnect) {
      await obsManager.connect(config.obs.host, config.obs.port, config.obs.password);
    }
  }, 10000);
}

// Start Server
const PORT = process.env.PORT || config.server.port || 3000;
server.listen(PORT, '0.0.0.0', async () => {
  printServerBanner(PORT);

  if (config.obs.autoConnect) {
    console.log('[OBS] Mencoba menyambung ke OBS Studio...');
    const result = await obsManager.connect(config.obs.host, config.obs.port, config.obs.password);
    if (!result.success) {
      console.log('[OBS] Tips: Buka OBS Studio -> menu "Tools" -> "WebSocket Server Settings"');
      console.log('[OBS] Server akan terus mencoba menghubungkan ulang secara otomatis setiap 10 detik.\n');
    }
    startAutoReconnect();
  }
});
