const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

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

function createApiRouter({ obsManager, audioManager, bgmManager, configService, io }) {
  const router = express.Router();
  const soundsDir = audioManager.soundsDir;
  const bgmDir = bgmManager.bgmDir;

  const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed = ['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac'];
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Format file tidak didukung. Gunakan MP3, WAV, OGG, atau M4A.'));
    }
  };

  const uploadSound = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, soundsDir),
      filename: (req, file, cb) => cb(null, getCleanSafeFilename(file.originalname, 'Sound', soundsDir))
    }),
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter
  });

  const uploadBgm = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, bgmDir),
      filename: (req, file, cb) => cb(null, getCleanSafeFilename(file.originalname, 'BGM', bgmDir))
    }),
    limits: { fileSize: 100 * 1024 * 1024 },
    fileFilter
  });

  // Status & Config
  router.get('/status', (req, res) => {
    const { getPrimaryIp } = require('../services/networkUtils');
    res.json({
      obs: obsManager.getState(),
      sounds: audioManager.getSounds(),
      bgm: {
        tracks: bgmManager.getTracks(),
        state: bgmManager.getState()
      },
      ip: getPrimaryIp(),
      config: configService.getConfig()
    });
  });

  router.get('/config', (req, res) => {
    res.json(configService.getConfig());
  });

  router.post('/config', async (req, res) => {
    const { obs, soundboard, bgm } = req.body;
    const partial = {};
    if (obs) partial.obs = obs;
    if (soundboard) partial.soundboard = soundboard;
    if (bgm) {
      partial.bgm = bgm;
      if (bgm.volume !== undefined) bgmManager.setVolume(bgm.volume);
    }
    const updated = configService.updateConfig(partial);

    if (obs) {
      await obsManager.disconnect();
      const result = await obsManager.connect(updated.obs.host, updated.obs.port, updated.obs.password);
      return res.json({ success: true, obsResult: result, config: updated });
    }

    res.json({ success: true, config: updated });
  });

  // OBS Control
  router.post('/obs/connect', async (req, res) => {
    const cfg = configService.getConfig();
    const { host, port, password } = req.body;
    const targetHost = host || cfg.obs.host;
    const targetPort = port || cfg.obs.port;
    const targetPassword = password !== undefined ? password : cfg.obs.password;

    const result = await obsManager.connect(targetHost, targetPort, targetPassword);
    res.json(result);
  });

  router.post('/obs/scene', async (req, res) => {
    try {
      const { sceneName } = req.body;
      await obsManager.setScene(sceneName);
      res.json({ success: true, sceneName });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/obs/toggle-mute', async (req, res) => {
    try {
      const { inputName } = req.body;
      const result = await obsManager.toggleInputMute(inputName);
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/obs/toggle-stream', async (req, res) => {
    try {
      const result = await obsManager.toggleStream();
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/obs/toggle-record', async (req, res) => {
    try {
      const result = await obsManager.toggleRecord();
      res.json({ success: true, ...result });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  // Sounds
  router.get('/sounds', (req, res) => {
    res.json(audioManager.getSounds());
  });

  router.post('/sounds/upload', uploadSound.single('audio'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Tidak ada file audio yang diunggah.' });
    }
    audioManager.invalidateCache();
    const sounds = audioManager.getSounds();
    io.emit('sounds:updated', sounds);
    res.json({ success: true, file: req.file.filename, sounds });
  });

  router.put('/sounds/:filename', (req, res) => {
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

  router.delete('/sounds/:filename', (req, res) => {
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

  router.post('/sounds/play', async (req, res) => {
    try {
      const { filename, volume } = req.body;
      const cfg = configService.getConfig();
      const vol = volume !== undefined ? volume : (cfg.soundboard?.volume || 0.8);
      io.emit('sound:started', {
        filename,
        volume: vol,
        url: `/sounds/${encodeURIComponent(filename)}`
      });
      audioManager.play(filename, vol).catch(() => {});
      io.emit('bgm:state', bgmManager.getState());
      res.json({ success: true, filename });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/sounds/stop', (req, res) => {
    audioManager.stopAll();
    io.emit('sound:stopped');
    io.emit('bgm:state', bgmManager.getState());
    res.json({ success: true });
  });

  // BGM
  router.get('/bgm', (req, res) => {
    res.json({
      tracks: bgmManager.getTracks(),
      state: bgmManager.getState()
    });
  });

  router.post('/bgm/play', async (req, res) => {
    try {
      const { filename } = req.body;
      let state;
      try {
        state = await bgmManager.play(filename);
      } catch (bgmErr) {
        bgmManager.currentTrack = filename;
        bgmManager.isPlaying = true;
        state = bgmManager.getState();
      }
      io.emit('bgm:state', state);
      res.json({ success: true, state });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/bgm/stop', (req, res) => {
    const state = bgmManager.stop();
    io.emit('bgm:state', state);
    res.json({ success: true, state });
  });

  router.post('/bgm/volume', (req, res) => {
    const { volume } = req.body;
    if (volume !== undefined) {
      configService.updateConfig({ bgm: { volume } });
    }
    const state = bgmManager.setVolume(volume);
    io.emit('bgm:state', state);
    res.json({ success: true, state });
  });

  router.post('/bgm/upload', uploadBgm.single('audio'), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: 'Tidak ada file audio BGM yang diunggah.' });
    }
    bgmManager.invalidateCache();
    const tracks = bgmManager.getTracks();
    io.emit('bgm:updated', { tracks, state: bgmManager.getState() });
    res.json({ success: true, file: req.file.filename, tracks });
  });

  router.put('/bgm/:filename', (req, res) => {
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

  router.delete('/bgm/:filename', (req, res) => {
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

  return router;
}

module.exports = { createApiRouter };
