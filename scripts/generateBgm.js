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
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buffer.writeInt16LE(Math.floor(s < 0 ? s * 0x8000 : s * 0x7FFF), 44 + i * 2);
  }
  return buffer;
}

const bgmDir = path.join(__dirname, '..', 'bgm');
if (!fs.existsSync(bgmDir)) {
  fs.mkdirSync(bgmDir, { recursive: true });
}

// Generate Lo-Fi Chill Beat Loop (8 seconds seamless loop)
{
  const sr = 44100;
  const dur = 8.0; // 8 seconds, 120 BPM = 16 beats = 4 bars
  const totalSamples = Math.floor(sr * dur);
  const samples = new Float32Array(totalSamples);
  const bpm = 120;
  const beatDur = 60 / bpm; // 0.5s per beat

  // Chords: Dm9 -> G13 -> Cmaj9 -> A7b13
  const chords = [
    [293.66, 349.23, 440.0, 523.25, 659.25], // Dm9
    [196.00, 246.94, 349.23, 440.0, 659.25], // G13
    [261.63, 329.63, 392.0, 493.88, 587.33], // Cmaj9
    [220.00, 277.18, 329.63, 415.30, 523.25]  // A7b13
  ];

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sr;
    const bar = Math.floor(t / (beatDur * 4)) % 4;
    const currentChord = chords[bar];
    const beatInBar = (t % (beatDur * 4)) / beatDur;

    // Electric Piano Chord pad
    let chordVal = 0;
    const chordAge = (t % (beatDur * 4));
    const chordEnv = Math.exp(-chordAge * 0.8) * 0.4 + 0.15;
    for (const freq of currentChord) {
      chordVal += Math.sin(2 * Math.PI * freq * t) * 0.06;
      chordVal += Math.sin(2 * Math.PI * freq * 2 * t) * 0.02;
    }
    chordVal *= chordEnv;

    // Bass line
    const rootFreq = currentChord[0] / 2;
    const bassEnv = Math.exp(-(t % beatDur) * 4);
    const bass = Math.sin(2 * Math.PI * rootFreq * t) * 0.25 * bassEnv;

    // Kick on beat 0 and 2.5
    let drum = 0;
    const beatFract = (t % (beatDur * 2)) / beatDur;
    if (beatFract < 0.15) {
      const kickT = beatFract * beatDur;
      drum += Math.sin(2 * Math.PI * (120 * Math.exp(-kickT * 25) + 40) * kickT) * 0.3 * Math.exp(-kickT * 15);
    }

    // Hi-hat every half-beat (8th notes)
    const hatT = (t % (beatDur / 2));
    if (hatT < 0.06) {
      const noise = (Math.random() * 2 - 1) * Math.exp(-hatT * 60) * 0.08;
      drum += noise;
    }

    // Snare / rim on beat 1 and 3
    const snareBeat = (t % (beatDur * 2));
    if (snareBeat >= beatDur && snareBeat < beatDur + 0.2) {
      const snareT = snareBeat - beatDur;
      const noise = (Math.random() * 2 - 1) * Math.exp(-snareT * 20) * 0.15;
      const body = Math.sin(2 * Math.PI * 180 * snareT) * Math.exp(-snareT * 25) * 0.12;
      drum += (noise + body);
    }

    samples[i] = Math.tanh(chordVal + bass + drum) * 0.7;
  }

  fs.writeFileSync(path.join(bgmDir, 'lofi-chill-loop.wav'), createWavBuffer(samples, sr));
  console.log('Sample BGM created: lofi-chill-loop.wav');
}

// Generate Energetic Stream BGM Loop (4 seconds seamless loop)
{
  const sr = 44100;
  const dur = 4.0;
  const totalSamples = Math.floor(sr * dur);
  const samples = new Float32Array(totalSamples);
  const beatDur = 60 / 128; // 128 BPM

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sr;
    const beat = t % beatDur;

    // 4-on-the-floor Kick
    let kick = 0;
    if (beat < 0.2) {
      const f = 150 * Math.exp(-beat * 35) + 45;
      kick = Math.sin(2 * Math.PI * f * beat) * 0.35 * Math.exp(-beat * 12);
    }

    // Synth arp 16th notes
    const sixteenth = (t % (beatDur / 4));
    const step = Math.floor(t / (beatDur / 4)) % 16;
    const notes = [440, 523.25, 659.25, 783.99, 880, 783.99, 659.25, 523.25, 493.88, 587.33, 739.99, 880, 987.77, 880, 739.99, 587.33];
    const synthFreq = notes[step];
    const synthEnv = Math.exp(-sixteenth * 18);
    const synth = (Math.sin(2 * Math.PI * synthFreq * t) + 0.5 * Math.sin(2 * Math.PI * synthFreq * 2 * t)) * 0.12 * synthEnv;

    // Bass
    const bassFreq = step < 8 ? 110 : 123.47;
    const bass = Math.sin(2 * Math.PI * bassFreq * t) * 0.2 * (beat < 0.25 ? 0.3 : 0.8);

    samples[i] = Math.tanh(kick + synth + bass) * 0.7;
  }

  fs.writeFileSync(path.join(bgmDir, 'gaming-synth-loop.wav'), createWavBuffer(samples, sr));
  console.log('Sample BGM created: gaming-synth-loop.wav');
}
