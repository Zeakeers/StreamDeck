const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const configService = require('./config');
const ObsManager = require('./services/obsManager');
const AudioManager = require('./services/audioManager');
const BgmManager = require('./services/bgmManager');
const { printServerBanner } = require('./services/networkUtils');
const { createApiRouter } = require('./routes/api');
const { setupSockets } = require('./sockets');

const config = configService.getConfig();
const soundsDir = path.resolve(__dirname, '../media/sounds');
const bgmDir = path.resolve(__dirname, '../media/bgm');

const bgmManager = new BgmManager(bgmDir, config.bgm?.volume || 0.5);
const audioManager = new AudioManager(soundsDir);
audioManager.setBgmManager(bgmManager);
const obsManager = new ObsManager();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.json());
app.use(express.static(path.resolve(__dirname, '../public')));
app.use('/sounds', express.static(soundsDir));
app.use('/bgm', express.static(bgmDir));

app.use('/api', createApiRouter({ obsManager, audioManager, bgmManager, configService, io }));
setupSockets(io, { obsManager, audioManager, bgmManager, configService });

let reconnectInterval = null;
function startAutoReconnect() {
  if (reconnectInterval) return;
  reconnectInterval = setInterval(async () => {
    const currentCfg = configService.getConfig();
    if (!obsManager.isConnected && currentCfg.obs.autoConnect) {
      await obsManager.connect(currentCfg.obs.host, currentCfg.obs.port, currentCfg.obs.password);
    }
  }, 10000);
}

const PORT = process.env.PORT || config.server.port || 3000;
server.listen(PORT, '0.0.0.0', async () => {
  printServerBanner(PORT);
  if (config.obs.autoConnect) {
    console.log('[OBS] Mencoba menyambung ke OBS Studio...');
    const result = await obsManager.connect(config.obs.host, config.obs.port, config.obs.password);
    if (!result.success) {
      console.log('[OBS] Server akan terus mencoba menghubungkan ulang secara otomatis setiap 10 detik.\n');
    }
    startAutoReconnect();
  }
});

module.exports = { app, server, io };
