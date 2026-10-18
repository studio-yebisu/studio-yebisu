import fs from 'node:fs/promises';

// Short, original PCM cues. The event list is shared with the picture.
export async function synthesizeWav(config, filename, sampleRate = 48000) {
  if (!Number.isFinite(config.duration) || config.duration <= 0 || config.duration > 600) throw new Error('Invalid audio duration');
  const samples = Math.round(config.duration * sampleRate);
  const pcm = new Float32Array(samples);
  for (const event of config.audioEvents || []) {
    const {time, frequency = 660, duration = 0.12, gain = 0.25} = event;
    if (![time, frequency, duration, gain].every(Number.isFinite) || time < 0 || duration <= 0 || frequency <= 0 || frequency >= sampleRate / 2 || gain < 0 || gain > 1) throw new Error('Invalid audio event');
    const start = Math.round(time * sampleRate);
    for (let j = 0; j < Math.round(duration * sampleRate) && start + j < samples; j++) {
      const t = j / sampleRate;
      const envelope = Math.min(1, t / 0.004) * Math.pow(1 - t / duration, 3);
      pcm[start + j] += gain * envelope * Math.sin(2 * Math.PI * frequency * t);
    }
  }
  const wave = Buffer.alloc(44 + samples * 2);
  wave.write('RIFF', 0); wave.writeUInt32LE(wave.length - 8, 4); wave.write('WAVEfmt ', 8);
  wave.writeUInt32LE(16, 16); wave.writeUInt16LE(1, 20); wave.writeUInt16LE(1, 22);
  wave.writeUInt32LE(sampleRate, 24); wave.writeUInt32LE(sampleRate * 2, 28);
  wave.writeUInt16LE(2, 32); wave.writeUInt16LE(16, 34); wave.write('data', 36); wave.writeUInt32LE(samples * 2, 40);
  for (let i = 0; i < samples; i++) wave.writeInt16LE(Math.round(Math.max(-1, Math.min(1, pcm[i])) * 32767), 44 + i * 2);
  await fs.writeFile(filename, wave, {flag: 'wx'});
  return {sampleRate, samples, duration: samples / sampleRate, eventCount: (config.audioEvents || []).length};
}
