import {
  applyFieldSound,
  closeGuide,
  enterPhase,
  finishPhase,
  guideVisibleAgain,
  onGuideStatus,
  outputLabel,
  pauseGuide,
  pickAudioOutput,
  playProbe,
  preloadVoice,
  setGuideVolume,
  stopGuide,
  unlockGuide,
} from './audio.js';
import { h } from './dom.js';
import {
  formatAccuracy,
  formatAzimuth,
  formatDuration,
  formatLat,
  formatLon,
} from './format.js';
import { destroyMap, mountMap, placeYou } from './map.js';
import {
  renderCe5,
  renderFeld,
  renderLog,
  renderMapPage,
  renderReport,
  renderSession,
  renderWissen,
} from './pages.js';
import { createId } from './id.js';
import { PHASES, createSession, phaseDue, phaseRemainingMs } from './protocol.js';
import { createSighting, parseBackup, toBackup } from './sighting.js';
import { cloudSpan, issSummary, issView, nextIssPass, skyHint, skySnapshot, weatherSummary } from './sky.js';
import * as db from './store.js';

const NIGHTS = ['amber', 'red', 'day'];
const NIGHT_LABEL = { amber: 'Nacht', red: 'Rotlicht', day: 'Tag' };
const THEME_COLOR = { amber: '#0e141b', red: '#120404', day: '#f4efe6' };
const NAV = [
  ['#/', 'Feld', 'feld'],
  ['#/ce5', 'CE5', 'ce5'],
  ['#/log', 'Logbuch', 'log'],
  ['#/karte', 'Karte', 'karte'],
  ['#/wissen', 'Wissen', 'wissen'],
];

const state = {
  settings: db.loadSettings(),
  sightings: [],
  sessions: [],
  geoStatus: 'idle',
  position: null,
  heading: null,
  headingAbsolute: false,
  sky: null,
  weather: null,
  weatherError: false,
  iss: null,
  issView: null,
  issPass: undefined,
  cloudLine: '',
  recordingId: '',
  route: parseRoute(),
  clock: Date.now(),
  guideStatus: '',
};

let geoWatch = 0;
let toastTimer = 0;
let saveTimer = 0;
let weatherKey = '';
let weatherAt = 0;
let skyAt = 0;
let memoTimer = 0;

const ctx = {
  state,
  get position() { return activePosition(); },
  openSession,
  requestGeo: startGeo,
  useGps,
  setManual,
  copyText,
  stampAndOpen,
  persistSighting,
  persistSession,
  removeSighting,
  removeSession,
  startSession,
  togglePause,
  advancePhase,
  setGuide,
  setTone,
  setWhistle,
  setVolume,
  pickOutput,
  probeTone,
  repeatPhase,
  attachPhoto,
  toggleMemo,
  addTrack,
  savePlace,
  usePlace,
  removePlace,
  markEmpty,
  refreshReport: render,
  exportAll,
  pickImport,
  enableCompass,
  mountMap: (frame) => mountMap(frame, {
    position: activePosition(),
    sightings: state.sightings,
    onSelect: (id) => { location.hash = `#/melden/${id}`; },
  }),
};

function parseRoute() {
  const parts = (location.hash.replace(/^#/, '') || '/').split('/').filter(Boolean);
  const head = parts[0] || 'feld';
  if (head === 'melden') return { name: 'melden', id: parts[1] || null };
  if (head === 'ce5' && parts[1] === 'sitzung') return { name: 'sitzung', id: parts[2] || null };
  if (head === 'ce5') return { name: 'ce5' };
  if (head === 'log') return { name: 'log' };
  if (head === 'karte') return { name: 'karte' };
  if (head === 'wissen') return { name: 'wissen' };
  return { name: 'feld' };
}

function activePosition() {
  if (state.settings.useManual && state.settings.manual) {
    return {
      lat: state.settings.manual.lat,
      lon: state.settings.manual.lon,
      accuracy: null,
      altitude: null,
      source: 'manual',
    };
  }
  if (state.position) return { ...state.position, source: 'gps' };
  return null;
}

function openSession() {
  return state.sessions
    .filter((session) => !session.completed)
    .sort((a, b) => b.startedAt - a.startedAt)[0] || null;
}

function applyNight() {
  const night = state.settings.night;
  document.documentElement.dataset.night = night;
  document.documentElement.style.colorScheme = night === 'day' ? 'light' : 'dark';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = THEME_COLOR[night];
  const button = document.querySelector('#night');
  if (button) {
    button.textContent = NIGHT_LABEL[night];
    button.setAttribute('aria-label', `Darstellung: ${NIGHT_LABEL[night]}. Wechseln.`);
  }
}

function cycleNight() {
  const index = NIGHTS.indexOf(state.settings.night);
  state.settings.night = NIGHTS[(index + 1) % NIGHTS.length];
  db.saveSettings(state.settings);
  applyNight();
}

function toast(message) {
  const node = document.querySelector('#toast');
  if (!node) return;
  node.textContent = message;
  node.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.classList.remove('is-visible'), 3400);
}

function ask({ title, text, ok, danger = false, merge = false }) {
  const dialog = document.querySelector('#confirm');
  dialog.querySelector('#confirm-title').textContent = title;
  dialog.querySelector('#confirm-text').textContent = text;
  const confirm = dialog.querySelector('#confirm-ok');
  confirm.textContent = ok;
  confirm.className = danger ? 'btn btn-danger' : 'btn btn-primary';
  dialog.querySelector('#confirm-merge').hidden = !merge;
  return new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue || 'cancel'), { once: true });
    dialog.showModal();
  });
}

function buildShell() {
  const app = h('div', { class: 'app' },
    h('header', { class: 'topbar' },
      h('a', { class: 'brand', href: '#/' },
        h('span', { class: 'mark', 'aria-hidden': 'true' }, 'H'),
        h('span', { class: 'brand-text' },
          h('span', { class: 'brand-name' }, 'Horizont'),
          h('span', { class: 'brand-tag' }, 'UAP-Feldprotokoll'),
        ),
      ),
      h('button', { id: 'night', class: 'btn btn-ghost', type: 'button', onClick: cycleNight }, NIGHT_LABEL[state.settings.night]),
    ),
    h('main', { id: 'main' }),
    h('nav', { class: 'nav', 'aria-label': 'Bereiche' },
      ...NAV.map(([href, label, key]) => h('a', { href, dataset: { nav: key } }, label)),
    ),
  );
  const dialog = h('dialog', { id: 'confirm', 'aria-labelledby': 'confirm-title' },
    h('form', { method: 'dialog', class: 'dialog-card' },
      h('h2', { id: 'confirm-title' }, ''),
      h('p', { id: 'confirm-text' }, ''),
      h('div', { class: 'row-actions' },
        h('button', { class: 'btn btn-ghost', type: 'submit', value: 'cancel' }, 'Abbrechen'),
        h('button', { id: 'confirm-merge', class: 'btn btn-ghost', type: 'submit', value: 'merge', hidden: true }, 'Zusammenführen'),
        h('button', { id: 'confirm-ok', class: 'btn btn-danger', type: 'submit', value: 'ok' }, 'Löschen'),
      ),
    ),
  );
  document.body.replaceChildren(
    h('a', { class: 'skip', href: '#main' }, 'Zum Inhalt'),
    app,
    h('div', { id: 'toast', class: 'toast', role: 'status', 'aria-live': 'polite' }),
    dialog,
    h('input', {
      id: 'import-file',
      type: 'file',
      accept: 'application/json,.json',
      hidden: true,
      onChange: (event) => {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (file) void importFile(file);
      },
    }),
  );
  applyNight();
}

function setNav() {
  const key = ['sitzung', 'ce5'].includes(state.route.name)
    ? 'ce5'
    : ['melden', 'feld'].includes(state.route.name)
      ? 'feld'
      : state.route.name;
  for (const link of document.querySelectorAll('[data-nav]')) {
    if (link.dataset.nav === key) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

function render() {
  state.route = parseRoute();
  if (state.route.name !== 'karte') destroyMap();
  const main = document.querySelector('#main');
  const titles = {
    feld: 'Horizont',
    melden: 'Meldung — Horizont',
    ce5: 'CE5 — Horizont',
    sitzung: 'Sitzung — Horizont',
    log: 'Logbuch — Horizont',
    karte: 'Karte — Horizont',
    wissen: 'Wissen — Horizont',
  };
  document.title = titles[state.route.name] || 'Horizont';
  let page;
  if (state.route.name === 'melden') page = renderReport(ctx, state.sightings.find((item) => item.id === state.route.id));
  else if (state.route.name === 'ce5') page = renderCe5(ctx);
  else if (state.route.name === 'sitzung') page = renderSession(ctx, state.sessions.find((item) => item.id === state.route.id));
  else if (state.route.name === 'log') page = renderLog(ctx);
  else if (state.route.name === 'karte') page = renderMapPage(ctx);
  else if (state.route.name === 'wissen') page = renderWissen();
  else page = renderFeld(ctx);
  main.replaceChildren(page);
  setNav();
  if (state.route.name === 'ce5' || state.route.name === 'sitzung') preloadVoice();
}

function canRebuild() {
  const tag = document.activeElement?.tagName;
  return tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT';
}

function updateLive() {
  state.clock = Date.now();
  const pos = activePosition();
  const lat = document.querySelector('[data-live="lat"]');
  if (state.route.name === 'feld' && pos && !lat && canRebuild()) {
    render();
    return;
  }
  if (state.route.name === 'feld' && state.sky && !document.querySelector('[data-live="sky"]') && canRebuild()) {
    render();
    return;
  }
  if (lat && pos) lat.textContent = formatLat(pos.lat);
  const lon = document.querySelector('[data-live="lon"]');
  if (lon && pos) lon.textContent = formatLon(pos.lon);
  const acc = document.querySelector('[data-live="acc"]');
  if (acc && pos) {
    const parts = [formatAccuracy(pos.accuracy)];
    if (Number.isFinite(pos.altitude)) parts.push(`${Math.round(pos.altitude)} m Höhe`);
    if (pos.source === 'manual') parts.unshift('von Hand');
    acc.textContent = parts.join(' · ');
  }
  const status = document.querySelector('[data-live="status"]');
  if (status) {
    const labels = {
      idle: 'GPS wartet',
      watching: 'Suche den Standort',
      live: 'GPS live',
      denied: 'Standort blockiert',
      unavailable: 'Kein GPS in diesem Browser',
      insecure: 'GPS braucht HTTPS',
      manual: 'Handkoordinaten',
    };
    const key = state.settings.useManual ? 'manual' : state.geoStatus;
    status.textContent = labels[key] || labels.idle;
    status.className = `pill pill-${key}`;
  }
  const heading = document.querySelector('[data-live="heading"]');
  if (heading) heading.textContent = formatAzimuth(state.heading);
  const headingNote = document.querySelector('[data-live="heading-note"]');
  if (headingNote) {
    headingNote.textContent = !Number.isFinite(state.heading)
      ? 'Viele Laptops haben keinen Kompass. Auf dem Telefon fragt das System nach.'
      : state.headingAbsolute
        ? 'Gerätekompass.'
        : 'Ungefähre Richtung. Das Gerät liefert keinen absoluten Kompass.';
  }
  const weather = document.querySelector('[data-live="weather"]');
  if (weather) weather.textContent = weatherText();
  const iss = document.querySelector('[data-live="iss"]');
  if (iss) iss.textContent = issText();
  const remain = document.querySelector('[data-live="remain"]');
  const session = state.sessions.find((item) => item.id === state.route.id);
  if (remain && session && !session.completed) {
    const ms = phaseRemainingMs(session, state.clock);
    remain.textContent = formatDuration(Math.abs(ms) / 1000);
    remain.classList.toggle('is-over', ms < 0);
    const note = document.querySelector('[data-live="remain-note"]');
    if (note) {
      const phase = PHASES[session.phaseIndex];
      note.textContent = session.pausedAt ? 'Pausiert' : ms < 0 ? 'Die Zeit dieser Phase ist um.' : phase.lead;
    }
  }
  if (state.route.name === 'karte') placeYou(pos);
  const running = openSession();
  if (state.settings.guide && phaseDue(running, state.clock)) void handoff(running);
}

function weatherText() {
  if (state.weather) return weatherSummary(state.weather, state.cloudLine);
  if (state.weatherError) return 'Wetter ist gerade nicht erreichbar. Die Meldung geht auch ohne.';
  return 'Wetter wird geladen, sobald ein Ort da ist.';
}

function issText() {
  if (!state.issView) return 'ISS-Lage wird nur geladen, wenn das Netz da ist.';
  return issSummary(state.issView, state.issPass);
}

function startGeo() {
  if (!window.isSecureContext) {
    state.geoStatus = 'insecure';
    updateLive();
    return;
  }
  if (!navigator.geolocation) {
    state.geoStatus = 'unavailable';
    updateLive();
    return;
  }
  if (geoWatch) navigator.geolocation.clearWatch(geoWatch);
  state.geoStatus = 'watching';
  updateLive();
  geoWatch = navigator.geolocation.watchPosition(
    (pos) => {
      state.position = {
        lat: pos.coords.latitude,
        lon: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        altitude: pos.coords.altitude,
        timestamp: pos.timestamp,
      };
      state.geoStatus = 'live';
      void refreshContext();
      updateLive();
    },
    (error) => {
      state.geoStatus = error.code === 1 ? 'denied' : 'unavailable';
      updateLive();
    },
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
  );
}

function stopGeo() {
  if (geoWatch) navigator.geolocation.clearWatch(geoWatch);
  geoWatch = 0;
}

function useGps() {
  state.settings.useManual = false;
  db.saveSettings(state.settings);
  startGeo();
  render();
}

function setManual(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    toast('Diese Koordinaten ergeben keinen Ort.');
    return;
  }
  state.settings.manual = { lat, lon };
  state.settings.useManual = true;
  db.saveSettings(state.settings);
  stopGeo();
  void refreshContext();
  render();
  toast('Handkoordinaten aktiv.');
}

async function copyText(text) {
  if (!text) return;
  try {
    await navigator.clipboard.writeText(text);
    toast('Kopiert.');
  } catch {
    toast('Kopieren hat der Browser blockiert.');
  }
}

async function refreshContext() {
  const pos = activePosition();
  if (!pos) return;
  const now = Date.now();
  if (!state.sky || now - skyAt > 30000) {
    state.sky = skySnapshot(pos.lat, pos.lon, pos.altitude || 0, new Date());
    skyAt = now;
  }
  const key = `${pos.lat.toFixed(2)},${pos.lon.toFixed(2)}`;
  if (key !== weatherKey || now - weatherAt > 600000) {
    weatherKey = key;
    try {
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.searchParams.set('latitude', pos.lat.toFixed(4));
      url.searchParams.set('longitude', pos.lon.toFixed(4));
      url.searchParams.set('current', 'temperature_2m,cloud_cover,visibility,wind_speed_10m');
      url.searchParams.set('hourly', 'cloud_cover');
      url.searchParams.set('forecast_hours', '12');
      url.searchParams.set('timezone', 'auto');
      const response = await fetch(url);
      if (!response.ok) throw new Error('weather');
      const data = await response.json();
      state.weather = data.current;
      state.cloudLine = cloudSpan(
        data.hourly?.time,
        data.hourly?.cloud_cover,
        state.sky?.astronomicalNightAt,
        data.utc_offset_seconds || 0,
      );
      state.weatherError = false;
      weatherAt = Date.now();
    } catch {
      state.weatherError = true;
    }
  }
  if (now - (state.issAt || 0) > 20000) {
    state.issAt = now;
    try {
      const response = await fetch('https://api.wheretheiss.at/v1/satellites/25544');
      if (!response.ok) throw new Error('iss');
      state.iss = await response.json();
      state.issView = issView(pos.lat, pos.lon, state.iss);
    } catch {
      state.issView = state.iss ? issView(pos.lat, pos.lon, state.iss) : null;
    }
  } else if (state.iss) {
    state.issView = issView(pos.lat, pos.lon, state.iss);
  }
  void refreshPass(pos);
  updateLive();
}

async function refreshPass(pos) {
  const key = `${pos.lat.toFixed(1)},${pos.lon.toFixed(1)}`;
  if (state.issPassKey === key && Date.now() - (state.issPassAt || 0) < 600000) return;
  state.issPassKey = key;
  state.issPassAt = Date.now();
  try {
    const start = Math.floor(Date.now() / 1000);
    const stamps = Array.from({ length: 180 }, (_, index) => start + index * 120);
    const url = `https://api.wheretheiss.at/v1/satellites/25544/positions?timestamps=${stamps.join(',')}&units=kilometers`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('pass');
    const pass = nextIssPass(await response.json(), pos.lat, pos.lon);
    if (pass) {
      const sky = skySnapshot(pos.lat, pos.lon, pos.altitude || 0, new Date(pass.peak));
      pass.dark = sky.sun.altitude < -6;
    }
    state.issPass = pass;
  } catch {
    if (state.issPass === undefined) state.issPass = null;
  }
}

async function enableCompass() {
  try {
    const Orientation = window.DeviceOrientationEvent;
    if (Orientation && typeof Orientation.requestPermission === 'function') {
      const result = await Orientation.requestPermission();
      if (result !== 'granted') {
        toast('Der Kompass bleibt aus.');
        return;
      }
    }
    window.addEventListener('deviceorientationabsolute', onHeading);
    window.addEventListener('deviceorientation', onHeading);
    toast('Kompass eingeschaltet, falls das Gerät einen hat.');
  } catch {
    toast('Der Kompass lässt sich hier nicht einschalten.');
  }
}

function onHeading(event) {
  let heading = null;
  let absolute = false;
  if (typeof event.webkitCompassHeading === 'number' && !Number.isNaN(event.webkitCompassHeading)) {
    heading = event.webkitCompassHeading;
    absolute = true;
  } else if (typeof event.alpha === 'number' && !Number.isNaN(event.alpha)) {
    heading = (360 - event.alpha) % 360;
    absolute = Boolean(event.absolute);
  }
  if (heading == null) return;
  state.heading = heading;
  state.headingAbsolute = absolute;
  const node = document.querySelector('[data-live="heading"]');
  if (node) node.textContent = formatAzimuth(heading);
  const rose = document.querySelector('[data-dial-rose]');
  if (rose) rose.setAttribute('transform', `rotate(${-heading} 100 100)`);
}

async function stamp(sessionId = null) {
  const pos = activePosition();
  const sighting = createSighting({
    lat: pos?.lat,
    lon: pos?.lon,
    accuracy: pos?.accuracy,
    altitude: pos?.altitude,
    heading: state.heading,
    skyHint: skyHint(state.sky),
    weather: state.weather,
    sessionId,
    kind: sessionId ? 'ce5' : 'unklar',
  });
  await db.putSighting(sighting);
  state.sightings.push(sighting);
  if (sessionId) {
    const session = state.sessions.find((item) => item.id === sessionId);
    if (session && !session.sightingIds.includes(sighting.id)) {
      session.sightingIds = [...session.sightingIds, sighting.id];
      await db.putSession(session);
    }
  }
  toast(pos ? 'Zeitpunkt und Ort gespeichert.' : 'Zeitpunkt gespeichert. Koordinaten fehlen noch.');
  return sighting;
}

async function stampAndOpen(sessionId = null) {
  const sighting = await stamp(sessionId);
  location.hash = `#/melden/${sighting.id}`;
}

function persistSighting(sighting) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    db.putSighting(sighting).catch(() => toast('Speichern fehlgeschlagen.'));
  }, 180);
}

function persistSession(session) {
  db.putSession(session).catch(() => toast('Speichern fehlgeschlagen.'));
}

async function removeSighting(sighting) {
  const answer = await ask({
    title: 'Meldung löschen',
    text: 'Zeitpunkt und Beschreibung werden von diesem Gerät entfernt.',
    ok: 'Löschen',
    danger: true,
  });
  if (answer !== 'ok') return;
  await db.deleteSighting(sighting.id);
  state.sightings = state.sightings.filter((item) => item.id !== sighting.id);
  for (const session of state.sessions) {
    if (session.sightingIds.includes(sighting.id)) {
      session.sightingIds = session.sightingIds.filter((id) => id !== sighting.id);
      await db.putSession(session);
    }
  }
  location.hash = '#/log';
  toast('Meldung gelöscht.');
}

async function removeSession(session) {
  const answer = await ask({
    title: 'Sitzung löschen',
    text: 'Die Sitzung wird entfernt. Meldungen, die du darin gestempelt hast, bleiben im Logbuch.',
    ok: 'Löschen',
    danger: true,
  });
  if (answer !== 'ok') return;
  await db.deleteSession(session.id);
  state.sessions = state.sessions.filter((item) => item.id !== session.id);
  location.hash = '#/log';
}

let handoffKey = '';

function startSession() {
  setGuideVolume(state.settings.volume);
  const pos = activePosition();
  const session = createSession({
    lat: pos?.lat ?? null,
    lon: pos?.lon ?? null,
    accuracy: pos?.accuracy ?? null,
  });
  state.sessions.push(session);
  void db.putSession(session);
  try {
    if (state.settings.guide) enterPhase(session, soundOpts());
    else void unlockGuide(state.settings.sinkId);
  } catch {
    toast('Die Führung konnte den Ton nicht starten. Der Ablauf läuft trotzdem.');
  }
  location.hash = `#/ce5/sitzung/${session.id}`;
}

function soundOpts(extra = {}) {
  return {
    tone: state.settings.tone,
    whistle: state.settings.whistle,
    sinkId: state.settings.sinkId,
    ...extra,
  };
}

async function handoff(session) {
  const key = `${session.id}:${session.phaseIndex}`;
  if (handoffKey === key) return;
  handoffKey = key;
  const last = session.phaseIndex >= PHASES.length - 1;
  const still = last ? true : await finishPhase();
  const current = state.sessions.find((item) => item.id === session.id);
  if (!still || !current || current.completed || current.pausedAt || current.phaseIndex !== session.phaseIndex) return;
  await advancePhase(current, { guided: true });
}

async function togglePause(session) {
  const now = Date.now();
  if (session.pausedAt) {
    session.pausedMs += now - session.pausedAt;
    session.pausedAt = null;
    if (state.settings.guide) enterPhase(session, soundOpts());
  } else {
    session.pausedAt = now;
    pauseGuide();
  }
  await db.putSession(session);
  render();
}

async function advancePhase(session, { guided = false } = {}) {
  if (!guided) handoffKey = `${session.id}:${session.phaseIndex}`;
  if (session.phaseIndex >= PHASES.length - 1) {
    session.completed = true;
    session.endedAt = Date.now();
  } else {
    session.phaseIndex += 1;
    session.phaseStartedAt = Date.now();
    session.pausedMs = 0;
    session.pausedAt = null;
  }
  await db.putSession(session);
  if (session.completed) {
    if (state.settings.guide) closeGuide();
    else stopGuide();
  } else if (state.settings.guide) {
    enterPhase(session, soundOpts());
  }
  if (state.route.name === 'sitzung' && state.route.id === session.id) {
    if (canRebuild() || session.completed) render();
    else patchPhase(session);
  }
}

function patchPhase(session) {
  const phase = PHASES[session.phaseIndex];
  if (!phase) return;
  const kicker = document.querySelector('#main .kicker');
  if (kicker) kicker.textContent = `Phase ${session.phaseIndex + 1} von ${PHASES.length}`;
  const title = document.querySelector('#main h1');
  if (title) title.textContent = phase.title;
}

function setGuide(value) {
  state.settings.guide = value;
  db.saveSettings(state.settings);
  const start = document.querySelector('.big-actions .btn-primary');
  if (start && state.route.name === 'ce5') start.textContent = value ? 'Geführt starten' : 'Sitzung starten';
  if (!value) stopGuide();
  else {
    const session = openSession();
    if (session && !session.pausedAt) enterPhase(session, soundOpts({ again: true }));
  }
}

function setTone(value) {
  state.settings.tone = value;
  db.saveSettings(state.settings);
  applyFieldSound(openSession(), { tone: value, whistle: state.settings.whistle });
}

function setWhistle(value) {
  state.settings.whistle = value;
  db.saveSettings(state.settings);
  applyFieldSound(openSession(), { tone: state.settings.tone, whistle: value });
}

function setVolume(value) {
  state.settings.volume = value;
  db.saveSettings(state.settings);
  setGuideVolume(value);
}

async function pickOutput() {
  const result = await pickAudioOutput();
  if (!result.ok) {
    toast(result.reason);
    return;
  }
  state.settings.sinkId = result.id || '';
  state.settings.sinkLabel = result.label || '';
  db.saveSettings(state.settings);
  const node = document.querySelector('[data-live="sink"]');
  if (node) node.textContent = outputLabel(state.settings.sinkLabel);
  toast(`Ausgabe: ${state.settings.sinkLabel}`);
}

async function probeTone() {
  setGuideVolume(state.settings.volume);
  const ok = await playProbe();
  if (!ok) toast('Dieser Browser hat keinen Ton.');
}

function repeatPhase(session) {
  state.settings.guide = true;
  db.saveSettings(state.settings);
  enterPhase(session, soundOpts({ again: true }));
}

function toggleMemo(sighting) {
  if (state.memoRecorder) {
    state.memoRecorder.stop();
    return;
  }
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
    toast('Die Aufnahme braucht eine https-Adresse.');
    return;
  }
  navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
    const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
    const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks = [];
    recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data); };
    recorder.onstop = () => {
      clearTimeout(memoTimer);
      stream.getTracks().forEach((track) => track.stop());
      state.memoRecorder = null;
      state.recordingId = '';
      const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
      if (blob.size < 800) {
        toast('Die Aufnahme war zu kurz.');
        render();
        return;
      }
      if (blob.size > 2.5 * 1024 * 1024) {
        toast('Die Aufnahme ist zu groß.');
        render();
        return;
      }
      sighting.audio = blob;
      sighting.described = true;
      sighting.updatedAt = Date.now();
      db.putSighting(sighting).catch(() => toast('Speichern fehlgeschlagen.'));
      render();
      toast('Sprachmemo gespeichert, nur auf diesem Gerät.');
    };
    state.memoRecorder = recorder;
    state.recordingId = sighting.id;
    recorder.start();
    memoTimer = window.setTimeout(() => { if (recorder.state === 'recording') recorder.stop(); }, 90000);
    render();
  }).catch(() => toast('Das Mikrofon bleibt zu.'));
}

function addTrack(sighting) {
  sighting.tracks = [...sighting.tracks, {
    at: Date.now(),
    direction: sighting.direction,
    elevation: sighting.elevation,
  }].slice(-12);
  sighting.described = true;
  sighting.updatedAt = Date.now();
  db.putSighting(sighting).catch(() => toast('Speichern fehlgeschlagen.'));
  render();
  toast('Weiterer Punkt gestempelt.');
}

function savePlace(name, pos) {
  const clean = String(name || '').trim().slice(0, 32);
  if (!clean || !pos || !Number.isFinite(pos.lat)) {
    toast('Ohne Ort lässt sich kein Platz merken.');
    return;
  }
  const places = (state.settings.places || []).filter((place) => place.name !== clean);
  places.unshift({ id: createId(), name: clean, lat: pos.lat, lon: pos.lon });
  state.settings.places = places.slice(0, 8);
  db.saveSettings(state.settings);
  render();
  toast(`${clean} gemerkt.`);
}

function usePlace(place) {
  setManual(place.lat, place.lon);
}

function removePlace(id) {
  state.settings.places = (state.settings.places || []).filter((place) => place.id !== id);
  db.saveSettings(state.settings);
  render();
}

function markEmpty(session) {
  session.emptySky = true;
  db.putSession(session).catch(() => toast('Speichern fehlgeschlagen.'));
  render();
  toast('Leerer Himmel notiert.');
}

async function attachPhoto(sighting, file, input) {
  if (!file) return;
  if (file.size > 4 * 1024 * 1024) {
    toast('Das Foto ist größer als 4 MB.');
    if (input) input.value = '';
    return;
  }
  sighting.photo = file;
  sighting.described = true;
  sighting.updatedAt = Date.now();
  await db.putSighting(sighting);
  toast('Foto gespeichert, nur auf diesem Gerät.');
  render();
}

function exportAll() {
  const backup = toBackup(state.sightings, state.sessions);
  const blob = new Blob([`${JSON.stringify(backup, null, 2)}\n`], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const day = new Date();
  const stamp = [day.getFullYear(), String(day.getMonth() + 1).padStart(2, '0'), String(day.getDate()).padStart(2, '0')].join('-');
  link.href = url;
  link.download = `horizont-${stamp}.json`;
  link.click();
  URL.revokeObjectURL(url);
  toast('Export gespeichert. Fotos sind nicht enthalten.');
}

function pickImport() {
  document.querySelector('#import-file').click();
}

async function importFile(file) {
  if (file.size > 5 * 1024 * 1024) {
    toast('Die Datei ist größer als 5 MB.');
    return;
  }
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    toast('Die Datei ist kein gültiges JSON.');
    return;
  }
  let incoming;
  try {
    incoming = parseBackup(data);
  } catch (error) {
    toast(error.message || 'Diese Datei ist kein Horizont-Export.');
    return;
  }
  if (state.sightings.length || state.sessions.length) {
    const answer = await ask({
      title: 'Logbuch importieren',
      text: 'Ersetzen tauscht das Logbuch auf diesem Gerät aus. Zusammenführen behält vorhandene Einträge und nimmt neue dazu.',
      ok: 'Ersetzen',
      merge: true,
    });
    if (answer !== 'ok' && answer !== 'merge') return;
    if (answer === 'merge') {
      const sightings = new Map(state.sightings.map((item) => [item.id, item]));
      const sessions = new Map(state.sessions.map((item) => [item.id, item]));
      for (const item of incoming.sightings) sightings.set(item.id, item);
      for (const item of incoming.sessions) sessions.set(item.id, item);
      incoming = { sightings: [...sightings.values()], sessions: [...sessions.values()] };
    }
  }
  await db.replaceAll(incoming.sightings, incoming.sessions);
  state.sightings = incoming.sightings;
  state.sessions = incoming.sessions;
  render();
  toast('Import fertig.');
}

function onHashChange() {
  if (state.memoRecorder && state.recordingId && !location.hash.includes(state.recordingId)) {
    state.memoRecorder.stop();
  }
  const next = parseRoute();
  if (next.name === 'melden' && !next.id) {
    void stampAndOpen(openSession()?.id || null);
    return;
  }
  state.route = next;
  render();
}

async function boot() {
  buildShell();
  try {
    state.sightings = await db.allSightings();
    state.sessions = await db.allSessions();
  } catch {
    toast('Das Logbuch dieses Browsers ließ sich nicht öffnen.');
  }
  window.addEventListener('hashchange', onHashChange);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') guideVisibleAgain();
  });
  onGuideStatus((text) => {
    state.guideStatus = text;
    const node = document.querySelector('[data-live="guide"]');
    if (node) node.textContent = text;
  });
  setGuideVolume(state.settings.volume);
  setInterval(updateLive, 1000);
  setInterval(() => { skyAt = 0; void refreshContext(); }, 60000);
  if (state.settings.useManual) void refreshContext();
  else startGeo();
  if (state.route.name === 'melden' && !state.route.id) {
    await stampAndOpen(openSession()?.id || null);
    return;
  }
  render();
}

boot();
