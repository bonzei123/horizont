const DB_NAME = 'horizont';
const DB_VERSION = 1;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('sightings')) db.createObjectStore('sightings', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('sessions')) db.createObjectStore('sessions', { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function withStore(name, mode, fn) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(name, mode);
    const store = tx.objectStore(name);
    const request = fn(store);
    tx.oncomplete = () => resolve(request?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Speichern abgebrochen'));
  }));
}

export function allSightings() {
  return withStore('sightings', 'readonly', (store) => store.getAll()).then((rows) => rows || []);
}

export function allSessions() {
  return withStore('sessions', 'readonly', (store) => store.getAll()).then((rows) => rows || []);
}

export function putSighting(sighting) {
  return withStore('sightings', 'readwrite', (store) => store.put(sighting));
}

export function putSession(session) {
  return withStore('sessions', 'readwrite', (store) => store.put(session));
}

export function deleteSighting(id) {
  return withStore('sightings', 'readwrite', (store) => store.delete(id));
}

export function deleteSession(id) {
  return withStore('sessions', 'readwrite', (store) => store.delete(id));
}

export function replaceAll(sightings, sessions) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(['sightings', 'sessions'], 'readwrite');
    const sightingStore = tx.objectStore('sightings');
    const sessionStore = tx.objectStore('sessions');
    sightingStore.clear();
    sessionStore.clear();
    for (const sighting of sightings) sightingStore.put(sighting);
    for (const session of sessions) sessionStore.put(session);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  }));
}

const SETTINGS_KEY = 'horizont.settings';

export function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    const data = raw ? JSON.parse(raw) : {};
    const night = data.night === 'red' || data.night === 'day' ? data.night : 'amber';
    const manual = data.manual && Number.isFinite(data.manual.lat) && Number.isFinite(data.manual.lon)
      ? data.manual
      : null;
    const volume = Number(data.volume);
    return {
      night,
      manual,
      useManual: Boolean(data.useManual && manual),
      guide: data.guide !== false,
      tone: data.tone !== false,
      whistle: data.whistle === true,
      volume: Number.isFinite(volume) ? Math.min(1, Math.max(0.05, volume)) : 0.7,
      sinkId: typeof data.sinkId === 'string' ? data.sinkId : '',
      sinkLabel: typeof data.sinkLabel === 'string' ? data.sinkLabel : '',
      places: cleanPlaces(data.places),
      pack: cleanPack(data.pack),
    };
  } catch {
    return defaultSettings();
  }
}

function defaultSettings() {
  return {
    night: 'amber',
    manual: null,
    useManual: false,
    guide: true,
    tone: true,
    whistle: false,
    volume: 0.7,
    sinkId: '',
    sinkLabel: '',
    places: [],
    pack: {},
  };
}

function cleanPack(value) {
  if (!value || typeof value !== 'object') return {};
  const pack = {};
  for (const [key, checked] of Object.entries(value)) {
    if (typeof key === 'string' && key.length < 24 && checked === true) pack[key] = true;
  }
  return pack;
}

function cleanPlaces(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).filter((place) => place
    && typeof place.id === 'string'
    && typeof place.name === 'string'
    && place.name.trim()
    && Number.isFinite(Number(place.lat))
    && Number.isFinite(Number(place.lon))).map((place) => ({
    id: place.id,
    name: place.name.trim().slice(0, 32),
    lat: Number(place.lat),
    lon: Number(place.lon),
  }));
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({
    night: settings.night,
    manual: settings.manual,
    useManual: settings.useManual,
    guide: settings.guide,
    tone: settings.tone,
    whistle: settings.whistle,
    volume: settings.volume,
    sinkId: settings.sinkId,
    sinkLabel: settings.sinkLabel,
    places: settings.places,
    pack: settings.pack,
  }));
}
