const fs = require('fs');
const path = require('path');
const { spawn, exec } = require('child_process');

class AudioManager {
  constructor(soundsDirectory, configManager = null) {
    this.soundsDir = soundsDirectory;
    this.configManager = configManager;
    this.bgmManager = null;
    this.activeProcesses = new Set();
    this.activeSoundCount = 0;
    this.unduckTimer = null;
    this.supportedExtensions = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac']);
  }

  setBgmManager(bgmManager) {
    this.bgmManager = bgmManager;
  }

  getSounds() {
    if (!fs.existsSync(this.soundsDir)) {
      fs.mkdirSync(this.soundsDir, { recursive: true });
    }

    const files = fs.readdirSync(this.soundsDir);
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
          url: `/sounds/${encodeURIComponent(file)}`
        };
      });
  }

  async play(filename, volume = 0.8) {
    const fullPath = path.resolve(this.soundsDir, filename);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`File audio tidak ditemukan: ${filename}`);
    }

    const safeVolume = Math.max(0, Math.min(1, Number(volume) || 0.8));
    const normalizedPath = fullPath.replace(/\\/g, '/');

    try {
      // Trigger instant auto-ducking on BGM
      if (this.unduckTimer) {
        clearTimeout(this.unduckTimer);
        this.unduckTimer = null;
      }
      this.activeSoundCount++;
      if (this.bgmManager) {
        this.bgmManager.duck();
      }

      let child;
      if (process.platform === 'win32') {
        const b64 = Buffer.from(fullPath, 'utf16le').toString('base64');
        const script = `Add-Type -AssemblyName presentationCore; $raw = [System.Convert]::FromBase64String('${b64}'); $path = [System.Text.Encoding]::Unicode.GetString($raw); $player = New-Object system.windows.media.mediaplayer; $player.open([System.Uri](Resolve-Path -LiteralPath $path).Path); $player.Volume = ${safeVolume}; $player.Play(); Start-Sleep 1; Start-Sleep -s $player.NaturalDuration.TimeSpan.TotalSeconds; Exit;`;
        child = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
          windowsHide: true,
          stdio: 'ignore'
        });
      } else if (process.platform === 'darwin') {
        child = spawn('afplay', ['-v', String(safeVolume), fullPath], { stdio: 'ignore' });
      } else {
        child = spawn('play', ['-v', String(safeVolume), fullPath], { stdio: 'ignore' });
      }

      if (child && child.pid) {
        this.activeProcesses.add(child);
        let cleaned = false;
        const cleanup = () => {
          if (cleaned) return;
          cleaned = true;
          this.activeProcesses.delete(child);
          this.activeSoundCount = Math.max(0, this.activeSoundCount - 1);

          // If no more soundboard sounds are playing, smoothly restore BGM volume
          if (this.activeSoundCount === 0 && this.bgmManager) {
            this.unduckTimer = setTimeout(() => {
              if (this.activeSoundCount === 0 && this.bgmManager) {
                this.bgmManager.unduck();
              }
            }, 50);
          }
        };
        child.on('close', cleanup);
        child.on('exit', cleanup);
        child.on('error', cleanup);
      }

      return { status: 'playing', file: filename, pid: child?.pid };
    } catch (err) {
      console.error(`Gagal memutar audio ${filename}:`, err.message);
      throw err;
    }
  }

  stopAll() {
    if (this.unduckTimer) {
      clearTimeout(this.unduckTimer);
      this.unduckTimer = null;
    }
    this.activeSoundCount = 0;

    const count = this.activeProcesses.size;
    for (const child of this.activeProcesses) {
      try {
        if (child.pid) {
          if (process.platform === 'win32') {
            exec(`taskkill /F /T /PID ${child.pid}`, () => {});
          } else {
            child.kill('SIGKILL');
          }
        }
      } catch (_) {}
    }
    this.activeProcesses.clear();

    // Immediately restore BGM volume if it was ducked
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
    return {
      success: true,
      oldFilename: safeOldFilename,
      newFilename,
      name: cleanName
    };
  }
}

module.exports = AudioManager;
