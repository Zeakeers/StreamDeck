const fs = require('fs');
const path = require('path');
const { spawn, spawnSync, exec } = require('child_process');

class AudioManager {
  constructor(soundsDirectory = path.resolve(__dirname, '../../media/sounds'), configManager = null) {
    this.soundsDir = soundsDirectory;
    this.configManager = configManager;
    this.bgmManager = null;
    this.activeProcesses = new Set();
    this.activeTimers = new Map();
    this.activeSoundCount = 0;
    this.unduckTimer = null;
    this.soundCache = null;
    this.winWorker = null;
    this.linuxPlayer = undefined;
    this.soundIdCounter = 1;
    this.supportedExtensions = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac']);
  }

  setBgmManager(bgmManager) {
    this.bgmManager = bgmManager;
  }

  invalidateCache() {
    this.soundCache = null;
  }

  getSounds() {
    if (this.soundCache) return this.soundCache;

    if (!fs.existsSync(this.soundsDir)) {
      fs.mkdirSync(this.soundsDir, { recursive: true });
    }

    const files = fs.readdirSync(this.soundsDir);
    this.soundCache = files
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return this.supportedExtensions.has(ext);
      })
      .map((file) => {
        const ext = path.extname(file);
        const baseName = path.basename(file, ext);
        const title = baseName
          .replace(/[-_]/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());

        return {
          filename: file,
          name: title,
          extension: ext.replace('.', '').toUpperCase(),
          url: `/sounds/${encodeURIComponent(file)}`
        };
      });

    return this.soundCache;
  }

  // ponytail: estimate duration from RIFF/file size; upgrade to full ID3/MPEG frame parser if variable bitrate causes ducking desync
  _estimateDuration(filePath) {
    try {
      const stat = fs.statSync(filePath);
      const fd = fs.openSync(filePath, 'r');
      const head = Buffer.alloc(44);
      fs.readSync(fd, head, 0, 44, 0);
      fs.closeSync(fd);

      if (head.toString('ascii', 0, 4) === 'RIFF') {
        const byteRate = head.readUInt32LE(28);
        if (byteRate > 0) return Math.max(0.5, stat.size / byteRate);
      }
      return Math.max(0.5, Math.min(300, stat.size / 16000));
    } catch (_) {
      return 3.0;
    }
  }

  _resolveLinuxPlayer() {
    if (this.linuxPlayer !== undefined) return this.linuxPlayer;
    const candidates = [
      { cmd: 'pw-play', args: (vol, file) => ['--volume', String(vol), file] },
      { cmd: 'paplay', args: (vol, file) => [`--volume=${Math.round(vol * 65536)}`, file] },
      { cmd: 'ffplay', args: (vol, file) => ['-nodisp', '-autoexit', '-loglevel', 'quiet', '-volume', String(Math.round(vol * 100)), file] },
      { cmd: 'play', args: (vol, file) => ['-v', String(vol), file] },
      { cmd: 'aplay', args: (vol, file) => [file] }
    ];

    for (const c of candidates) {
      try {
        const res = spawnSync('which', [c.cmd], { stdio: 'ignore' });
        if (res.status === 0) {
          this.linuxPlayer = c;
          return c;
        }
      } catch (_) {}
    }
    this.linuxPlayer = null;
    return null;
  }

  _ensureWinWorker() {
    if (process.platform !== 'win32') return null;
    if (this.winWorker && !this.winWorker.killed) return this.winWorker;

    const script = `
Add-Type -AssemblyName presentationCore
$players = @{}
$in = [Console]::In
while ($null -ne ($line = $in.ReadLine())) {
  $line = $line.Trim()
  if ($line.Length -eq 0) { continue }
  $parts = $line.Split(' ', 4)
  $cmd = $parts[0]
  if ($cmd -eq 'PLAY') {
    $id = $parts[1]
    $vol = [double]$parts[2]
    $path = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($parts[3]))
    try {
      $p = New-Object system.windows.media.mediaplayer
      $p.Open([System.Uri](Resolve-Path -LiteralPath $path).Path)
      $p.Volume = $vol
      $p.Play()
      $players[$id] = $p
    } catch {}
  } elseif ($cmd -eq 'STOP') {
    $id = $parts[1]
    if ($players.ContainsKey($id)) {
      $players[$id].Stop()
      $players[$id].Close()
      $players.Remove($id)
    }
  } elseif ($cmd -eq 'STOPALL') {
    foreach ($p in $players.Values) {
      $p.Stop()
      $p.Close()
    }
    $players.Clear()
  }
}
`;
    this.winWorker = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.winWorker.on('error', () => { this.winWorker = null; });
    this.winWorker.on('close', () => { this.winWorker = null; });
    return this.winWorker;
  }

  _onSoundEnd(soundId) {
    if (this.activeTimers.has(soundId)) {
      clearTimeout(this.activeTimers.get(soundId));
      this.activeTimers.delete(soundId);
    }

    if (process.platform === 'win32' && this.winWorker && this.winWorker.stdin && !this.winWorker.killed) {
      try {
        this.winWorker.stdin.write(`STOP ${soundId}\n`);
      } catch (_) {}
    }

    this.activeSoundCount = Math.max(0, this.activeSoundCount - 1);
    if (this.activeSoundCount === 0 && this.bgmManager) {
      clearTimeout(this.unduckTimer);
      this.unduckTimer = setTimeout(() => {
        if (this.activeSoundCount === 0 && this.bgmManager) {
          this.bgmManager.unduck();
        }
      }, 50);
    }
  }

  async play(filename, volume = 0.8) {
    const fullPath = path.resolve(this.soundsDir, filename);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File audio tidak ditemukan: ${filename}`);
    }

    const safeVolume = Math.max(0, Math.min(1, Number(volume) || 0.8));
    const soundId = `s_${Date.now()}_${this.soundIdCounter++}`;

    try {
      if (this.unduckTimer) {
        clearTimeout(this.unduckTimer);
        this.unduckTimer = null;
      }
      this.activeSoundCount++;
      if (this.bgmManager) {
        this.bgmManager.duck();
      }

      if (process.platform === 'win32') {
        const worker = this._ensureWinWorker();
        const b64 = Buffer.from(fullPath, 'utf8').toString('base64');
        worker.stdin.write(`PLAY ${soundId} ${safeVolume} ${b64}\n`);

        const durMs = Math.ceil(this._estimateDuration(fullPath) * 1000);
        const timer = setTimeout(() => this._onSoundEnd(soundId), durMs);
        this.activeTimers.set(soundId, timer);
        return { status: 'playing', file: filename, soundId };
      }

      let child;
      if (process.platform === 'darwin') {
        child = spawn('afplay', ['-v', String(safeVolume), fullPath], { stdio: 'ignore' });
      } else {
        const player = this._resolveLinuxPlayer();
        if (player) {
          child = spawn(player.cmd, player.args(safeVolume, fullPath), { stdio: 'ignore' });
        }
      }

      if (child && child.pid) {
        this.activeProcesses.add(child);
        const cleanup = () => {
          this.activeProcesses.delete(child);
          this._onSoundEnd(soundId);
        };
        child.on('close', cleanup);
        child.on('error', cleanup);
      } else {
        this._onSoundEnd(soundId);
      }

      return { status: 'playing', file: filename, soundId, pid: child?.pid };
    } catch (err) {
      this._onSoundEnd(soundId);
      console.error(`Gagal memutar audio ${filename}:`, err.message);
      throw err;
    }
  }

  stopAll() {
    if (this.unduckTimer) {
      clearTimeout(this.unduckTimer);
      this.unduckTimer = null;
    }
    for (const [id, timer] of this.activeTimers) {
      clearTimeout(timer);
    }
    this.activeTimers.clear();

    if (process.platform === 'win32' && this.winWorker && this.winWorker.stdin && !this.winWorker.killed) {
      try {
        this.winWorker.stdin.write('STOPALL\n');
      } catch (_) {}
    }

    const count = this.activeProcesses.size;
    for (const child of this.activeProcesses) {
      try {
        if (child.pid) child.kill('SIGKILL');
      } catch (_) {}
    }
    this.activeProcesses.clear();
    this.activeSoundCount = 0;

    if (this.bgmManager) {
      this.bgmManager.unduck();
    }

    return { status: 'stopped', killedCount: count };
  }

  deleteSound(filename) {
    const safeFilename = path.basename(filename);
    const fullPath = path.resolve(this.soundsDir, safeFilename);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`File ${safeFilename} tidak ditemukan.`);
    }

    fs.unlinkSync(fullPath);
    this.invalidateCache();
    return { success: true, deleted: safeFilename };
  }

  renameSound(oldFilename, newDisplayName) {
    const safeOldFilename = path.basename(oldFilename);
    const oldPath = path.resolve(this.soundsDir, safeOldFilename);

    if (!fs.existsSync(oldPath)) {
      throw new Error(`File ${safeOldFilename} tidak ditemukan.`);
    }

    const ext = path.extname(safeOldFilename);
    const cleanName = newDisplayName.replace(/[/\\?%*:|"<>]/g, '').trim();
    if (!cleanName) {
      throw new Error('Nama baru tidak valid.');
    }

    const newFilename = `${cleanName}${ext}`;
    const newPath = path.resolve(this.soundsDir, newFilename);

    if (oldPath.toLowerCase() !== newPath.toLowerCase() && fs.existsSync(newPath)) {
      throw new Error(`File dengan nama "${newFilename}" sudah ada.`);
    }

    fs.renameSync(oldPath, newPath);
    this.invalidateCache();
    return {
      success: true,
      oldFilename: safeOldFilename,
      newFilename,
      name: cleanName
    };
  }
}

module.exports = AudioManager;
