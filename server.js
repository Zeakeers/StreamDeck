const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

const ObsManager = require('./lib/obsManager');
const AudioManager = require('./lib/audioManager');
const { printServerBanner, getPrimaryIp } = require('./lib/networkUtils');

const CONFIG_PATH = path.join(__dirname, 'config.json');

// Load config
let config = {
  server: { port: 3000 },
  obs: { host: '127.0.0.1', port: 4455, password: '', autoConnect: true },
  soundboard: { volume: 0.8 }
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
const audioManager = new AudioManager(soundsDir);
const obsManager = new ObsManager();

// Setup Multer for soundboard file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, soundsDir);
  },
  filename: (req, file, cb) => {
    const originalExt = path.extname(file.originalname).toLowerCase();
    const baseName = path.basename(file.originalname, originalExt).replace(/[/\\?%*:|"<>]/g, '').trim() || 'Sound';
    let targetName = `${baseName}${originalExt}`;
    let counter = 1;
    while (fs.existsSync(path.join(soundsDir, targetName))) {
      targetName = `${baseName}_${counter}${originalExt}`;
      counter++;
    }
    cb(null, targetName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'];
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Format file tidak didukung. Gunakan MP3, WAV, OGG, atau M4A.'));
    }
  }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/sounds', express.static(soundsDir));

// --- API Endpoints ---
app.get('/api/status', (req, res) => {
  res.json({
    obs: obsManager.getState(),
    sounds: audioManager.getSounds(),
    ip: getPrimaryIp(),
    config
  });
});

app.get('/api/config', (req, res) => {
  res.json(config);
});

app.post('/api/config', async (req, res) => {
  const { obs, soundboard } = req.body;
  if (obs) {
    config.obs = { ...config.obs, ...obs };
  }
  if (soundboard) {
    config.soundboard = { ...config.soundboard, ...soundboard };
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

app.post('/api/sounds/upload', upload.single('audio'), (req, res) => {
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
    res.json({ success: true, filename });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/sounds/stop', (req, res) => {
  audioManager.stopAll();
  io.emit('sound:stopped');
  res.json({ success: true });
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
    if (typeof callback === 'function') callback({ success: true });
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
