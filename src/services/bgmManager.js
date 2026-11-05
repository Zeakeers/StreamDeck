const fs = require('fs');
const path = require('path');
const { spawn, spawnSync, exec } = require('child_process');

class BgmManager {
  constructor(bgmDirectory = path.resolve(__dirname, '../../media/bgm'), defaultVolume = 0.5) {
    this.bgmDir = bgmDirectory;
    this.baseVolume = Math.max(0, Math.min(1, Number(defaultVolume) || 0.5));
    this.currentVolume = this.baseVolume;
    this.currentTrack = null;
    this.isPlaying = false;
    this.isDucked = false;

    this.psProcess = null;
    this.loopTimer = null;
    this.fadeTimer = null;
    this.trackCache = null;
    this.linuxPlayer = undefined;
    this.supportedExtensions = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac']);
  }

  invalidateCache() {
    this.trackCache = null;
  }

  _resolveLinuxPlayer() {
    if (this.linuxPlayer !== undefined) return this.linuxPlayer;
    const candidates = [
      { cmd: 'pw-play', args: (vol, file) => ['--volume', String(vol), file] },
      { cmd: 'paplay', args: (vol, file) => [`--volume=${Math.round(vol * 65536)}`, file] },
      { cmd: 'ffplay', args: (vol, file) => ['-nodisp', '-autoexit', '-loglevel', 'quiet', '-volume', String(Math.round(vol * 100)), file] },
      { cmd: 'play', args: (vol, file) => ['-v', String(vol), file] },
      { cmd: 'aplay', args: (_vol, file) => [file] }
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

  getTracks() {
    if (this.trackCache) {
      return this.trackCache.map(t => ({
        ...t,
        isActive: this.isPlaying && this.currentTrack === t.filename
      }));
    }

    if (!fs.existsSync(this.bgmDir)) {
      fs.mkdirSync(this.bgmDir, { recursive: true });
    }

    const files = fs.readdirSync(this.bgmDir);
    this.trackCache = files
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
          url: `/bgm/${encodeURIComponent(file)}`
        };
      });

    return this.trackCache.map(t => ({
      ...t,
      isActive: this.isPlaying && this.currentTrack === t.filename
    }));
  }

  getState() {
    return {
      isPlaying: this.isPlaying,
      currentTrack: this.currentTrack,
      baseVolume: this.baseVolume,
      currentVolume: this.currentVolume,
      isDucked: this.isDucked
    };
  }

  async play(filename) {
    const safeFilename = path.basename(filename);
    const fullPath = path.resolve(this.bgmDir, safeFilename);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`File BGM tidak ditemukan: ${safeFilename}`);
    }

    // Stop existing BGM if running
    this.stopInternal();

    this.currentTrack = safeFilename;
    this.isPlaying = true;
    this.isDucked = false;
    this.currentVolume = this.baseVolume;

    if (process.platform === 'win32') {
      const b64Path = Buffer.from(fullPath, 'utf8').toString('base64');
      const initialVol = Number(this.currentVolume || this.baseVolume || 0.5).toFixed(3);
      const script = `
Add-Type -AssemblyName presentationCore
$path = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${b64Path}'))
      $resolved = (Resolve-Path -LiteralPath $path).ProviderPath
      $p = New-Object system.windows.media.mediaplayer
      $p.Open([System.Uri]$resolved)
$p.Play()

$in = [Console]::In
while ($null -ne ($line = $in.ReadLine())) {
  $line = $line.Trim()
  if ($line.StartsWith('VOL ')) {
    try {
      $p.Volume = [double]($line.Substring(4))
    } catch {}
  } elseif ($line -eq 'LOOP') {
    try {
      if ($p.NaturalDuration.HasTimeSpan -and ($p.Position.TotalSeconds -ge ($p.NaturalDuration.TimeSpan.TotalSeconds - 0.3))) {
        $p.Position = [System.TimeSpan]::Zero
        $p.Play()
      }
    } catch {}
  } elseif ($line -eq 'STOP') {
    try {
      $p.Stop()
      $p.Close()
    } catch {}
    break
  }
}
`;
      const encoded = Buffer.from(script, 'utf16le').toString('base64');
      const ps = spawn('powershell', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.psProcess = ps;
      if (ps.stdout) ps.stdout.resume();
      if (ps.stderr) ps.stderr.resume();

      ps.on('error', (err) => {
        console.error('[BGM] PowerShell error:', err.message);
      });

      ps.on('close', () => {
        if (this.psProcess === ps) {
          this.psProcess = null;
          this.isPlaying = false;
          this.currentTrack = null;
          clearInterval(this.loopTimer);
          this.loopTimer = null;
        }
      });

      // Loop check sending clean single-line command
      this.loopTimer = setInterval(() => {
        if (this.psProcess && this.psProcess.stdin && !this.psProcess.killed) {
          try {
            this.psProcess.stdin.write("LOOP\n");
          } catch (_) {}
        }
      }, 250);
    } else {
      // Fallback for macOS / Linux (looping via child_process)
      const playLoop = () => {
        if (!this.isPlaying || this.currentTrack !== safeFilename) return;
        let p;
        if (process.platform === 'darwin') {
          const vol = this.currentVolume ?? this.baseVolume ?? 0.5;
          p = spawn('afplay', ['-v', String(vol), fullPath], { stdio: 'ignore' });
        } else {
          const player = this._resolveLinuxPlayer();
          if (!player) return;
          const vol = this.currentVolume ?? this.baseVolume ?? 0.5;
          p = spawn(player.cmd, player.args(vol, fullPath), { stdio: 'ignore' });
        }

        this.psProcess = p;
        p.on('close', () => {
          if (this.isPlaying && this.currentTrack === safeFilename) {
            playLoop();
          }
        });
      };
      playLoop();
    }

    return this.getState();
  }

  stop() {
    this.stopInternal();
    return this.getState();
  }

  stopInternal() {
    clearInterval(this.fadeTimer);
    this.fadeTimer = null;
    clearInterval(this.loopTimer);
    this.loopTimer = null;

    if (this.psProcess) {
      try {
        if (process.platform === 'win32') {
          if (this.psProcess.stdin && !this.psProcess.killed) {
            this.psProcess.stdin.write("STOP\n");
          }
          if (this.psProcess.pid) {
            exec(`taskkill /F /T /PID ${this.psProcess.pid}`, () => {});
          }
        } else {
          this.psProcess.kill('SIGKILL');
        }
      } catch (_) {}
      this.psProcess = null;
    }

    this.isPlaying = false;
    this.currentTrack = null;
    this.isDucked = false;
  }

  setVolume(vol) {
    this.baseVolume = Math.max(0, Math.min(1, Number(vol) || 0.5));
    if (this.isPlaying && !this.isDucked) {
      this.applyVolumeImmediate(this.baseVolume);
    } else if (this.isPlaying && this.isDucked) {
      const ducked = Math.max(0.03, this.baseVolume * 0.18);
      this.applyVolumeImmediate(ducked);
    }
    return this.getState();
  }

  applyVolumeImmediate(target) {
    this.currentVolume = target;
    if (process.platform === 'win32') {
      if (this.psProcess && this.psProcess.stdin && !this.psProcess.killed) {
        try {
          this.psProcess.stdin.write(`VOL ${target.toFixed(3)}\n`);
        } catch (_) {}
      }
    } else if (process.platform === 'linux' && this.psProcess?.pid) {
      const pid = this.psProcess.pid;
      const pct = Math.round(target * 100);
      exec('pactl list sink-inputs', (err, stdout) => {
        if (err || !stdout) return;
        const blocks = stdout.split(/Sink Input #(\d+)/);
        for (let i = 1; i < blocks.length; i += 2) {
          const id = blocks[i];
          const content = blocks[i + 1] || '';
          if (content.includes(`application.process.id = "${pid}"`)) {
            exec(`pactl set-sink-input-volume ${id} ${pct}%`, () => {});
            break;
          }
        }
      });
    }
  }

  fadeTo(targetVol, durationMs = 180) {
    if (!this.isPlaying || !this.psProcess) return;

    clearInterval(this.fadeTimer);
    this.fadeTimer = null;

    const startVol = this.currentVolume;
    const endVol = Math.max(0, Math.min(1, targetVol));
    const steps = 6;
    const intervalMs = Math.max(15, Math.floor(durationMs / steps));
    let stepCount = 0;

    this.fadeTimer = setInterval(() => {
      stepCount++;
      const progress = stepCount / steps;
      const current = startVol + (endVol - startVol) * progress;
      this.applyVolumeImmediate(current);

      if (stepCount >= steps) {
        clearInterval(this.fadeTimer);
        this.fadeTimer = null;
        this.applyVolumeImmediate(endVol);
      }
    }, intervalMs);
  }

  duck() {
    if (!this.isPlaying) return;
    this.isDucked = true;
    const duckedVol = Math.max(0.03, this.baseVolume * 0.18);
    this.fadeTo(duckedVol, 140);
  }

  unduck() {
    if (!this.isPlaying) return;
    this.isDucked = false;
    this.fadeTo(this.baseVolume, 240);
  }

  deleteTrack(filename) {
    const safeFilename = path.basename(filename);
    const fullPath = path.resolve(this.bgmDir, safeFilename);

    if (this.currentTrack === safeFilename) {
      this.stop();
    }

    if (!fs.existsSync(fullPath)) {
      throw new Error(`File BGM ${safeFilename} tidak ditemukan.`);
    }

    fs.unlinkSync(fullPath);
    this.invalidateCache();
    return { success: true, deleted: safeFilename };
  }

  renameTrack(oldFilename, newDisplayName) {
    const safeOldFilename = path.basename(oldFilename);
    const oldPath = path.resolve(this.bgmDir, safeOldFilename);

    if (!fs.existsSync(oldPath)) {
      throw new Error(`File ${safeOldFilename} tidak ditemukan.`);
    }

    const ext = path.extname(safeOldFilename);
    const cleanName = newDisplayName.replace(/[/\\?%*:|"<>]/g, '').trim();
    if (!cleanName) {
      throw new Error('Nama baru tidak valid.');
    }

    const newFilename = `${cleanName}${ext}`;
    const newPath = path.resolve(this.bgmDir, newFilename);

    if (oldPath.toLowerCase() !== newPath.toLowerCase() && fs.existsSync(newPath)) {
      throw new Error(`File BGM "${newFilename}" sudah ada.`);
    }

    const wasPlayingThis = this.currentTrack === safeOldFilename;
    if (wasPlayingThis) {
      this.stop();
    }

    fs.renameSync(oldPath, newPath);
    this.invalidateCache();

    if (wasPlayingThis) {
      this.play(newFilename);
    }

    return {
      success: true,
      oldFilename: safeOldFilename,
      newFilename,
      name: cleanName
    };
  }
}

module.exports = BgmManager;
