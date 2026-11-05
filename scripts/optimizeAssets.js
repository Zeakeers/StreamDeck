const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// ponytail: ffmpeg stream copy trim; upgrade to audio-tag aware trimmer if ID3 tags need preservation
const rootDir = path.resolve(__dirname, '..');
const bgmDir = path.join(rootDir, 'media', 'bgm');
const soundsDir = path.join(rootDir, 'media', 'sounds');

function trimFile(filePath, durationSec) {
  if (!fs.existsSync(filePath)) return;
  const stat = fs.statSync(filePath);
  const tmpPath = filePath + '.tmp.mp3';

  const res = spawnSync('ffmpeg', [
    '-v', 'error',
    '-y',
    '-ss', '0',
    '-t', String(durationSec),
    '-i', filePath,
    '-c', 'copy',
    tmpPath
  ], { stdio: 'inherit' });

  if (res.status === 0 && fs.existsSync(tmpPath)) {
    fs.renameSync(tmpPath, filePath);
    const newStat = fs.statSync(filePath);
    console.log(`Trimmed ${path.basename(filePath)}: ${(stat.size / 1024 / 1024).toFixed(1)}MB -> ${(newStat.size / 1024 / 1024).toFixed(1)}MB`);
  } else {
    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
    console.error(`Failed to trim ${filePath}`);
  }
}

console.log('Optimizing BGM files (trim to single loop, ~160s)...');
const bgmFiles = fs.readdirSync(bgmDir);
for (const f of bgmFiles) {
  if (f.endsWith('.mp3')) {
    trimFile(path.join(bgmDir, f), 165);
  }
}

console.log('Optimizing long soundboard tracks...');
const soundTargets = [
  { match: 'Instrumen Sedih', dur: 22 },
  { match: 'Lagu Kemenangan', dur: 18 }
];

const soundFiles = fs.readdirSync(soundsDir);
for (const f of soundFiles) {
  const target = soundTargets.find(t => f.includes(t.match));
  if (target) {
    trimFile(path.join(soundsDir, f), target.dur);
  }
}

console.log('Asset optimization complete.');
