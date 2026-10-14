const fs = require('fs');
const path = require('path');

function createWavBuffer(samples, sampleRate = 44100) {
  const numChannels = 1;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM format
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34); // 16-bit
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.floor(s < 0 ? s * 0x8000 : s * 0x7FFF), 44 + i * 2);
  }
  return buffer;
}

const soundsDir = path.join(__dirname, '..', 'sounds');

// 1. Coin sound (8-bit style)
{
  const sr = 44100;
  const dur = 0.45;
  const totalSamples = Math.floor(sr * dur);
  const samples = new Float32Array(totalSamples);
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sr;
    const freq = t < 0.1 ? 987.77 : 1318.51; // B5 -> E6
    const env = Math.max(0, 1 - t / dur);
    // square wave
    const wave = Math.sin(2 * Math.PI * freq * t) > 0 ? 0.3 : -0.3;
    samples[i] = wave * env;
  }
  fs.writeFileSync(path.join(soundsDir, 'coin.wav'), createWavBuffer(samples, sr));
}

// 2. Success chime
{
  const sr = 44100;
  const dur = 0.8;
  const totalSamples = Math.floor(sr * dur);
  const samples = new Float32Array(totalSamples);
  const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sr;
    let val = 0;
    notes.forEach((freq, idx) => {
      const noteStart = idx * 0.1;
      if (t >= noteStart) {
        const noteT = t - noteStart;
        const env = Math.exp(-noteT * 4);
        val += 0.2 * Math.sin(2 * Math.PI * freq * noteT) * env;
      }
    });
    samples[i] = val;
  }
  fs.writeFileSync(path.join(soundsDir, 'success.wav'), createWavBuffer(samples, sr));
}

// 3. Buzzer / Wrong sound
{
  const sr = 44100;
  const dur = 0.6;
  const totalSamples = Math.floor(sr * dur);
  const samples = new Float32Array(totalSamples);
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sr;
    const freq1 = 130.81; // C3
    const freq2 = 138.59; // C#3 (dissonant)
    const env = Math.min(1, t * 20) * Math.max(0, 1 - t / dur);
    const wave = (Math.sin(2 * Math.PI * freq1 * t) + Math.sin(2 * Math.PI * freq2 * t)) * 0.25;
    // slight distortion
    samples[i] = Math.tanh(wave * 2) * env;
  }
  fs.writeFileSync(path.join(soundsDir, 'buzzer.wav'), createWavBuffer(samples, sr));
}

// 4. Notification Chime
{
  const sr = 44100;
  const dur = 0.6;
  const totalSamples = Math.floor(sr * dur);
  const samples = new Float32Array(totalSamples);
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sr;
    let val = 0;
    if (t < 0.25) {
      val = Math.sin(2 * Math.PI * 880 * t) * Math.exp(-t * 6);
    } else {
      const t2 = t - 0.2;
      val = Math.sin(2 * Math.PI * 1174.66 * t2) * Math.exp(-t2 * 5);
    }
    samples[i] = val * 0.35;
  }
  fs.writeFileSync(path.join(soundsDir, 'notification.wav'), createWavBuffer(samples, sr));
}

// 5. Airhorn blast
{
  const sr = 44100;
  const dur = 0.75;
  const totalSamples = Math.floor(sr * dur);
  const samples = new Float32Array(totalSamples);
  // Airhorn chord: approx frequencies around 466Hz (Bb4) + 622Hz (Eb5) + 783Hz
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sr;
    const env = Math.min(1, t * 40) * Math.max(0, 1 - (t / dur) ** 2);
    // saw-like rich harmonics
    const f1 = 466.16;
    const f2 = 587.33;
    const wave = (
      Math.sin(2 * Math.PI * f1 * t) * 0.4 +
      Math.sin(2 * Math.PI * f2 * t) * 0.3 +
      Math.sin(2 * Math.PI * f1 * 2 * t) * 0.2 +
      Math.sin(2 * Math.PI * f2 * 2 * t) * 0.15
    );
    samples[i] = Math.tanh(wave * 1.8) * env * 0.45;
  }
  fs.writeFileSync(path.join(soundsDir, 'airhorn.wav'), createWavBuffer(samples, sr));
}

// 6. Laser sound
{
  const sr = 44100;
  const dur = 0.35;
  const totalSamples = Math.floor(sr * dur);
  const samples = new Float32Array(totalSamples);
  let phase = 0;
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sr;
    const freq = 1800 * Math.exp(-t * 12) + 120;
    phase += (2 * Math.PI * freq) / sr;
    const env = Math.max(0, 1 - t / dur);
    samples[i] = Math.sin(phase) * env * 0.35;
  }
  fs.writeFileSync(path.join(soundsDir, 'laser.wav'), createWavBuffer(samples, sr));
}

console.log('Sample sound effects successfully generated in ' + soundsDir);
