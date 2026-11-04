import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BRIDGE_SPEECH, CLOSING_SPEECH, PHASES } from '../src/protocol.js';

const piper = process.env.PIPER || 'piper';
const model = process.env.PIPER_MODEL;
const outDir = new URL('../public/voice/', import.meta.url);

if (!model) {
  console.error('PIPER_MODEL fehlt. Beispiel: PIPER_MODEL=/pfad/de_DE-thorsten-high.onnx node scripts/build-voice.mjs');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
const work = mkdtempSync(join(tmpdir(), 'horizont-voice-'));
const clips = [
  ...PHASES.map((phase) => [phase.id, phase.speech]),
  ['bridge', BRIDGE_SPEECH],
  ['closing', CLOSING_SPEECH],
];

for (const [id, text] of clips) {
  const wav = join(work, `${id}.wav`);
  const mp3 = new URL(`${id}.mp3`, outDir);
  const spoken = spawnSync(piper, [
    '--model', model,
    '--output_file', wav,
    '--length_scale', '1.28',
    '--sentence_silence', '0.62',
    '--noise_scale', '0.35',
    '--noise_w', '0.5',
  ], {
    input: `${text.trim()}\n`,
    stdio: ['pipe', 'inherit', 'inherit'],
    env: process.env,
  });
  if (spoken.status !== 0) process.exit(spoken.status || 1);
  const encoded = spawnSync('ffmpeg', [
    '-y', '-i', wav,
    '-af', 'adelay=180:all=1,apad=pad_dur=0.35',
    '-codec:a', 'libmp3lame', '-b:a', '80k', '-ac', '1',
    mp3.pathname,
  ], { stdio: 'inherit' });
  if (encoded.status !== 0) process.exit(encoded.status || 1);
  console.log(id);
}

rmSync(work, { recursive: true, force: true });
