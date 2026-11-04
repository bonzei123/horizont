import { BRIDGE_SPEECH, CLOSING_SPEECH, PHASES } from './protocol.js';

let audioCtx = null;
let master = null;
let drone = null;
let whistle = null;
let whistleGen = 0;
let sinkId = '';
let token = 0;
let announced = '';
let wakeLock = null;
let statusHandler = () => {};
let volume = 0.7;

export function onGuideStatus(handler) {
  statusHandler = handler;
}

function report(text) {
  statusHandler(text);
}

export function setGuideVolume(value) {
  volume = Math.min(1, Math.max(0.05, value));
  if (master) master.gain.value = volume;
}

function ensureGraph() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return false;
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new Ctx();
    master = null;
  }
  if (!master) {
    master = audioCtx.createGain();
    master.connect(audioCtx.destination);
  }
  master.gain.value = volume;
  return true;
}

export async function unlockGuide(preferredSink = '') {
  if (!ensureGraph()) return false;
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  if (preferredSink && preferredSink !== sinkId) await applySink(preferredSink);
  await holdWake();
  return true;
}

export async function pickAudioOutput() {
  const devices = navigator.mediaDevices;
  if (!devices?.selectAudioOutput) {
    return {
      ok: false,
      reason: 'Ausgabe bleibt beim System.',
    };
  }
  try {
    const device = await devices.selectAudioOutput();
    const applied = await applySink(device.deviceId);
    if (!applied.ok) return applied;
    return { ok: true, id: device.deviceId, label: device.label || 'Ausgewählte Ausgabe' };
  } catch (error) {
    if (error?.name === 'NotAllowedError') return { ok: false, reason: 'Auswahl abgebrochen.' };
    return { ok: false, reason: 'Die Ausgabe ließ sich nicht wechseln. Es bleibt bei der Systemausgabe.' };
  }
}

async function applySink(id) {
  if (!id) return { ok: true };
  if (!ensureGraph()) return { ok: false, reason: 'Dieser Browser hat keinen Ton.' };
  if (audioCtx.state === 'suspended') await audioCtx.resume();
  if (!audioCtx || typeof audioCtx.setSinkId !== 'function') {
    return {
      ok: false,
      reason: 'Die Töne bleiben auf der Systemausgabe. Bluetooth in den Geräteeinstellungen wählen, dann gilt das auch für die Stimme.',
    };
  }
  try {
    await audioCtx.setSinkId(id);
    sinkId = id;
    return { ok: true, id };
  } catch {
    return { ok: false, reason: 'Dieses Ausgabegerät hat der Browser abgelehnt.' };
  }
}

export function outputLabel(savedLabel) {
  if (savedLabel) return `Ausgabe: ${savedLabel}. Bluetooth muss vorher gekoppelt sein.`;
  if (typeof navigator.mediaDevices?.selectAudioOutput === 'function') {
    return 'Ausgabe: Systemstandard. Mit „Ausgabe wählen“ erscheinen gekoppelte Bluetooth-Geräte.';
  }
  return 'Ausgabe folgt dem System. Bluetooth dort koppeln. Diese Seite kann kein Gerät paaren.';
}

export async function playProbe() {
  const ready = await unlockGuide();
  if (!ready) {
    report('Dieser Browser hat keinen Ton.');
    return false;
  }
  chime();
  report('Tonprobe.');
  return true;
}

export function stopGuide() {
  token += 1;
  announced = '';
  stopSpeech();
  stopDrone();
  stopWhistle();
  releaseWake();
  report('');
}

export function pauseGuide() {
  token += 1;
  stopSpeech();
  stopDrone();
  stopWhistle();
  releaseWake();
  report('');
}

export function enterPhase(session, { tone, whistle: useWhistle = false, again = false, sinkId = '' } = {}) {
  const phase = PHASES[session.phaseIndex];
  if (!phase) return;
  const key = `${session.id}:${session.phaseIndex}`;
  if (!again && announced === key) {
    applyFieldSound(session, { tone, whistle: useWhistle });
    void holdWake();
    return;
  }
  const my = ++token;
  announced = key;
  stopDrone();
  stopWhistle();
  stopSpeech();
  const ready = unlockGuide(sinkId);
  report('Spricht.');
  const spoken = speak(phase.speech, phase.id);
  void ready.then(() => { if (my === token) preloadVoice(); });
  spoken.then((heard) => {
    if (my !== token) return;
    const line = applyFieldSound(session, { tone, whistle: useWhistle, speakStatus: heard });
    if (!heard) {
      report(`Keine Stimme in diesem Browser. Der Text steht auf dem Bildschirm, der Wechsel läuft weiter. ${line}`.trim());
    }
  });
}

export function applyFieldSound(session, { tone = false, whistle: useWhistle = false, speakStatus = true } = {}) {
  const phase = session ? PHASES[session.phaseIndex] : null;
  const live = Boolean(
    phase
    && session
    && !session.pausedAt
    && !session.completed
    && announced === `${session.id}:${session.phaseIndex}`,
  );
  if (!live) {
    stopDrone();
    stopWhistle();
    return '';
  }
  if (!phase.drone) {
    stopDrone();
    stopWhistle();
    const line = phase.id === 'wache'
      ? 'Still. Du beobachtest.'
      : 'Die Stimme meldet sich, wenn die Phase um ist.';
    if (speakStatus) report(line);
    return line;
  }
  const key = announced;
  void unlockGuide().then(() => {
    if (announced !== key) return;
    if (useWhistle) {
      stopDrone();
      startWhistle();
      return;
    }
    stopWhistle();
    if (tone) startDrone();
    else stopDrone();
  });
  const line = useWhistle
    ? 'Dog Whistle an. Optional, ohne Beleg. Die Stimme meldet sich, wenn die Phase um ist.'
    : tone
      ? 'Ruheton. Er ist für dich, kein Signal. Die Stimme meldet sich, wenn die Phase um ist.'
      : 'Töne aus. Die Stimme meldet sich, wenn die Phase um ist.';
  if (speakStatus) report(line);
  return line;
}

export function finishPhase() {
  const my = ++token;
  stopDrone();
  stopWhistle();
  stopSpeech();
  bowl();
  report('Die Zeit ist um.');
  return speak(BRIDGE_SPEECH, 'bridge').then(() => my === token);
}

export function closeGuide() {
  const my = ++token;
  announced = '';
  stopDrone();
  stopWhistle();
  stopSpeech();
  bowl();
  report('Die Sitzung ist zu.');
  speak(CLOSING_SPEECH, 'closing').finally(() => {
    if (my !== token) return;
    releaseWake();
    report('');
  });
}

function bowl() {
  if (!audioCtx || !master) return;
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = 196;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.04, now + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
  osc.connect(gain).connect(master);
  osc.start(now);
  osc.stop(now + 1.9);
}

function chime() {
  if (!audioCtx || !master) return;
  const now = audioCtx.currentTime;
  const notes = [523.25, 659.25];
  for (const [index, freq] of notes.entries()) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const start = now + index * 0.12;
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.12, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 1.3);
    osc.connect(gain).connect(master);
    osc.start(start);
    osc.stop(start + 1.35);
  }
}

function startDrone() {
  if (!audioCtx || !master || drone) return;
  const osc = audioCtx.createOscillator();
  const fifth = audioCtx.createOscillator();
  const filter = audioCtx.createBiquadFilter();
  const gain = audioCtx.createGain();
  const lfo = audioCtx.createOscillator();
  const lfoGain = audioCtx.createGain();
  osc.type = 'sine';
  fifth.type = 'sine';
  osc.frequency.value = 110;
  fifth.frequency.value = 164.81;
  filter.type = 'lowpass';
  filter.frequency.value = 420;
  gain.gain.value = 0.045;
  lfo.frequency.value = 0.08;
  lfoGain.gain.value = 0.02;
  lfo.connect(lfoGain).connect(gain.gain);
  osc.connect(filter);
  fifth.connect(filter);
  filter.connect(gain).connect(master);
  osc.start();
  fifth.start();
  lfo.start();
  drone = { osc, fifth, lfo, gain };
}

export function quietTone() {
  stopDrone();
  stopWhistle();
  if (announced) report('Töne aus.');
}

function startWhistle() {
  if (!audioCtx || !master || whistle) return;
  const gen = whistleGen;
  const nodes = [];
  nodes.push(modulated(100, 7.83, 0.03, 0.018));
  nodes.push(steady(528, 'sine', 0.012));
  nodes.push(steady(432, 'triangle', 0.01));
  nodes.push(breath());
  const ping = window.setInterval(() => {
    if (gen !== whistleGen || !whistle) return;
    blip(17000, 17000, 0.05, 0.02);
  }, 3000);
  const chirp = window.setInterval(() => {
    if (gen !== whistleGen || !whistle) return;
    blip(2100, 2700, 0.18, 0.028);
  }, 10000);
  whistle = { nodes, ping, chirp };
}

function modulated(freq, rate, level, depth) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const lfo = audioCtx.createOscillator();
  const lfoGain = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.value = level;
  lfo.frequency.value = rate;
  lfoGain.gain.value = depth;
  lfo.connect(lfoGain).connect(gain.gain);
  osc.connect(gain).connect(master);
  osc.start();
  lfo.start();
  return { osc, lfo };
}

function steady(freq, type, level) {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = level;
  osc.connect(gain).connect(master);
  osc.start();
  return { osc };
}

function breath() {
  const seconds = 2;
  const buffer = audioCtx.createBuffer(1, audioCtx.sampleRate * seconds, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 700;
  const gain = audioCtx.createGain();
  gain.gain.value = 0.01;
  const lfo = audioCtx.createOscillator();
  const lfoGain = audioCtx.createGain();
  lfo.frequency.value = 0.18;
  lfoGain.gain.value = 0.008;
  lfo.connect(lfoGain).connect(gain.gain);
  source.connect(filter).connect(gain).connect(master);
  source.start();
  lfo.start();
  return { osc: source, lfo };
}

function blip(from, to, seconds, level) {
  if (!audioCtx || !master) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const now = audioCtx.currentTime;
  osc.type = 'sine';
  osc.frequency.setValueAtTime(from, now);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, now + seconds);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(level, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + seconds);
  osc.connect(gain).connect(master);
  osc.start(now);
  osc.stop(now + seconds + 0.02);
}

function stopWhistle() {
  if (!whistle) return;
  const current = whistle;
  whistle = null;
  whistleGen += 1;
  window.clearInterval(current.ping);
  window.clearInterval(current.chirp);
  for (const node of current.nodes) {
    try {
      node.osc.stop();
      node.lfo?.stop();
    } catch {
      /* already stopped */
    }
  }
}

function stopDrone() {
  if (!drone) return;
  const { osc, fifth, lfo } = drone;
  drone = null;
  try {
    osc.stop();
    fifth.stop();
    lfo.stop();
  } catch {
    /* already stopped */
  }
}

const VOICE_CLIPS = ['ort', 'kohaerenz', 'einladung', 'wache', 'abschluss', 'bridge', 'closing'];
const voiceCache = new Map();
let voiceSource = null;
let voiceDone = null;
let speechToken = 0;

export function preloadVoice() {
  if (!ensureGraph()) return;
  for (const id of VOICE_CLIPS) void loadVoice(id).catch(() => {});
}

function voiceUrl(id) {
  return `${import.meta.env.BASE_URL}voice/${id}.mp3`;
}

function loadVoice(id) {
  const cached = voiceCache.get(id);
  if (cached) return cached;
  const pending = fetch(voiceUrl(id)).then(async (response) => {
    if (!response.ok) throw new Error(String(response.status));
    const bytes = await response.arrayBuffer();
    if (!ensureGraph()) throw new Error('no audio');
    return audioCtx.decodeAudioData(bytes.slice(0));
  }).catch((error) => {
    voiceCache.delete(id);
    throw error;
  });
  voiceCache.set(id, pending);
  return pending;
}

function speak(text, clipId) {
  const mine = ++speechToken;
  cancelVoice();
  window.speechSynthesis?.cancel();
  if (!clipId) return speakSystem(text, mine);
  return playClip(clipId, mine).then((played) => {
    if (played || mine !== speechToken) return played;
    report('Die ruhige Stimme fehlt. Es spricht die Systemstimme.');
    return speakSystem(text, mine);
  });
}

function playClip(id, mine) {
  if (!ensureGraph()) return Promise.resolve(false);
  const resume = audioCtx.state === 'suspended' ? audioCtx.resume().catch(() => {}) : Promise.resolve();
  return resume.then(() => loadVoice(id)).then((buffer) => new Promise((resolve) => {
    if (mine !== speechToken || !buffer) {
      resolve(false);
      return;
    }
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(master);
    let settled = false;
    const done = (ok) => {
      if (settled) return;
      settled = true;
      if (voiceSource === source) voiceSource = null;
      if (voiceDone === done) voiceDone = null;
      resolve(ok && mine === speechToken);
    };
    source.onended = () => done(true);
    voiceSource = source;
    voiceDone = done;
    try {
      source.start();
    } catch {
      done(false);
      return;
    }
    window.setTimeout(() => done(true), buffer.duration * 1000 + 1500);
  })).catch(() => false);
}

function speakSystem(text, mine) {
  const synth = window.speechSynthesis;
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return Promise.resolve(false);
  synth.cancel();
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE';
    utterance.rate = 0.88;
    const voice = pickGermanVoice(synth.getVoices());
    if (voice) utterance.voice = voice;
    let settled = false;
    const done = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    utterance.onend = () => done(mine === speechToken);
    utterance.onerror = () => done(false);
    window.setTimeout(() => {
      if (mine !== speechToken) {
        done(false);
        return;
      }
      synth.speak(utterance);
    }, 40);
    window.setTimeout(() => done(mine === speechToken), text.length * 130 + 4000);
  });
}

function pickGermanVoice(voices) {
  return voices.find((voice) => voice.lang === 'de-DE')
    || voices.find((voice) => voice.lang?.toLowerCase().startsWith('de'))
    || null;
}

function cancelVoice() {
  const source = voiceSource;
  const done = voiceDone;
  voiceSource = null;
  voiceDone = null;
  if (source) {
    source.onended = null;
    try {
      source.stop();
    } catch {
      /* already stopped */
    }
  }
  done?.(false);
}

function stopSpeech() {
  speechToken += 1;
  window.speechSynthesis?.cancel();
  cancelVoice();
}

async function holdWake() {
  if (!navigator.wakeLock || wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch {
    wakeLock = null;
  }
}

function releaseWake() {
  const current = wakeLock;
  wakeLock = null;
  current?.release?.().catch(() => {});
}

export function guideVisibleAgain() {
  if (announced) void holdWake();
}
