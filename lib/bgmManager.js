const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');

class BgmManager {
  constructor(bgmDirectory, defaultVolume = 0.5) {
    this.bgmDir = bgmDirectory;
    this.baseVolume = Math.max(0, Math.min(1, Number(defaultVolume) || 0.5));
    this.currentVolume = this.baseVolume;
    this.currentTrack = null;
    this.isPlaying = false;
    this.isDucked = false;

    this.psProcess = null;
    this.loopTimer = null;
    this.fadeTimer = null;
    this.supportedExtensions = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac']);
  }

  getTracks() {
    if (!fs.existsSync(this.bgmDir)) {
      fs.mkdirSync(this.bgmDir, { recursive: true });
    }

    const files = fs.readdirSync(this.bgmDir);
    return files
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
          url: `/bgm/${encodeURIComponent(file)}`,
          isActive: this.isPlaying && this.currentTrack === file
        };
      });
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

    const normalizedPath = fullPath.replace(/\\/g, '/');

    if (process.platform === 'win32') {
      const ps = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', '-'], {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.psProcess = ps;

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

      const b64Path = Buffer.from(fullPath, 'utf16le').toString('base64');
      const initialVol = this.baseVolume.toFixed(2);
      const initScript = `
Add-Type -AssemblyName presentationCore
$b64 = '${b64Path}'
$raw = [System.Convert]::FromBase64String($b64)
$path = [System.Text.Encoding]::Unicode.GetString($raw)
$p = New-Object system.windows.media.mediaplayer
$p.Open([System.Uri](Resolve-Path -LiteralPath $path).Path)
$p.Volume = ${initialVol}
$p.Play()
`;
      ps.stdin.write(initScript);

      // Loop checker every 250ms
      this.loopTimer = setInterval(() => {
        if (this.psProcess && this.psProcess.stdin && !this.psProcess.killed) {
          try {
            this.psProcess.stdin.write(`
if ($p.NaturalDuration.HasTimeSpan -and ($p.Position.TotalSeconds -ge ($p.NaturalDuration.TimeSpan.TotalSeconds - 0.25))) {
    $p.Position = [System.TimeSpan]::Zero
    $p.Play()
}
`);
          } catch (_) {}
        }
      }, 250);
    } else {
      // Fallback for macOS / Linux (looping via child_process)
      const playLoop = () => {
        if (!this.isPlaying || this.currentTrack !== safeFilename) return;
        const cmd = process.platform === 'darwin' ? 'afplay' : 'play';
        const p = spawn(cmd, [fullPath], { stdio: 'ignore' });
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
    if (this.fadeTimer) {
      clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }

    if (this.psProcess) {
      try {
        if (process.platform === 'win32' && this.psProcess.pid) {
          exec(`taskkill /F /T /PID ${this.psProcess.pid}`, () => {});
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
    if (this.psProcess && this.psProcess.stdin && !this.psProcess.killed) {
      try {
        this.psProcess.stdin.write(`$p.Volume = ${target.toFixed(3)}\n`);
      } catch (_) {}
    }
  }

  fadeTo(targetVol, durationMs = 180) {
    if (!this.isPlaying || !this.psProcess) return;

    if (this.fadeTimer) {
      clearInterval(this.fadeTimer);
      this.fadeTimer = null;
    }

    const startVol = this.currentVolume;
    const endVol = Math.max(0, Math.min(1, targetVol));
    const steps = 6;
    const intervalMs = Math.max(15, Math.floor(durationMs / steps));
    let stepCount = 0;

    this.fadeTimer = setInterval(() => {
      stepCount++;
      const progress = stepCount / steps;
      // Linear ease
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
    // Fast fade out ducking (~140ms)
    this.fadeTo(duckedVol, 140);
  }

  unduck() {
    if (!this.isPlaying) return;
    this.isDucked = false;
    // Smooth fade in recovery (~240ms)
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
