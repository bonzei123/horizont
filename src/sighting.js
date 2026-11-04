import { createId } from './id.js';

export const SHAPES = [
  ['punkt', 'Lichtpunkt'],
  ['scheibe', 'Scheibe'],
  ['dreieck', 'Dreieck'],
  ['kugel', 'Kugel'],
  ['zylinder', 'Zigarre oder Zylinder'],
  ['formation', 'Formation'],
  ['wechselnd', 'Form wechselte'],
  ['andere', 'Etwas anderes'],
];

export const MOTIONS = [
  ['still', 'Stand am Himmel'],
  ['linear', 'Gleichmäßig geradeaus'],
  ['kurve', 'Bogen oder Kurve'],
  ['wechsel', 'Richtungswechsel'],
  ['schnell', 'Plötzlich schnell'],
  ['puls', 'Helligkeit pulsierte'],
  ['stieg', 'Stieg oder fiel'],
];

export const SOUNDS = [
  ['keins', 'Nichts gehört'],
  ['brummen', 'Brummen'],
  ['zischen', 'Zischen'],
  ['knall', 'Knall'],
  ['unsicher', 'Unsicher'],
];

export const KINDS = [
  ['unklar', 'Noch unklar'],
  ['bekannt', 'Eher ein bekanntes Objekt'],
  ['nl', 'Licht in der Nacht'],
  ['tag', 'Bei Tageslicht gesehen'],
  ['ce1', 'Nah und deutlich, ohne Spur'],
  ['ce2', 'Mit Spur, Wirkung oder Fotoeffekt'],
  ['ce5', 'Während einer CE5-Sitzung'],
];

export const ELEVATION_PRESETS = [5, 15, 30, 45, 70, 90];

export const BRIGHTNESS = [
  ['schwach', 'Schwächer als ein Stern'],
  ['stern', 'Wie ein heller Stern'],
  ['planet', 'Wie Venus oder Jupiter'],
  ['iss', 'Wie die ISS'],
  ['grell', 'Noch heller'],
];

export const SIZES = [
  ['punkt', 'Punkt'],
  ['muenze', 'Münzgroß auf Armlänge'],
  ['mond', 'Mondgroß'],
];

const BRIGHTNESS_IDS = new Set(BRIGHTNESS.map(([id]) => id));
const SIZE_IDS = new Set(SIZES.map(([id]) => id));

const SHAPE_IDS = new Set(SHAPES.map(([id]) => id));
const MOTION_IDS = new Set(MOTIONS.map(([id]) => id));
const SOUND_IDS = new Set(SOUNDS.map(([id]) => id));
const KIND_IDS = new Set(KINDS.map(([id]) => id));

export function labelOf(list, id) {
  return list.find(([key]) => key === id)?.[1] || id || '—';
}

export function createSighting(partial = {}, now = Date.now()) {
  return {
    id: partial.id || createId(),
    createdAt: partial.createdAt ?? now,
    updatedAt: partial.updatedAt ?? now,
    observedAt: partial.observedAt ?? now,
    described: Boolean(partial.described),
    lat: finiteOrNull(partial.lat),
    lon: finiteOrNull(partial.lon),
    accuracy: finiteOrNull(partial.accuracy),
    altitude: finiteOrNull(partial.altitude),
    heading: finiteOrNull(partial.heading),
    direction: finiteOrNull(partial.direction),
    elevation: finiteOrNull(partial.elevation),
    count: clampCount(partial.count),
    shape: SHAPE_IDS.has(partial.shape) ? partial.shape : 'punkt',
    color: stringOf(partial.color),
    motion: MOTION_IDS.has(partial.motion) ? partial.motion : 'linear',
    sound: SOUND_IDS.has(partial.sound) ? partial.sound : 'keins',
    durationMin: stringOf(partial.durationMin),
    blink: Boolean(partial.blink),
    straight: Boolean(partial.straight),
    train: Boolean(partial.train),
    notes: stringOf(partial.notes),
    kind: KIND_IDS.has(partial.kind) ? partial.kind : 'unklar',
    brightness: BRIGHTNESS_IDS.has(partial.brightness) ? partial.brightness : '',
    size: SIZE_IDS.has(partial.size) ? partial.size : '',
    tracks: cleanTracks(partial.tracks),
    skyHint: stringOf(partial.skyHint),
    weather: partial.weather && typeof partial.weather === 'object' ? partial.weather : null,
    sessionId: typeof partial.sessionId === 'string' ? partial.sessionId : null,
    photo: partial.photo instanceof Blob ? partial.photo : null,
    audio: partial.audio instanceof Blob ? partial.audio : null,
  };
}

function cleanTracks(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).map((track) => ({
    at: Number(track?.at),
    direction: finiteOrNull(track?.direction),
    elevation: finiteOrNull(track?.elevation),
  })).filter((track) => Number.isFinite(track.at));
}

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function stringOf(value) {
  return typeof value === 'string' ? value : '';
}

function clampCount(value) {
  const number = Math.round(Number(value));
  if (!Number.isFinite(number) || number < 1) return 1;
  return Math.min(99, number);
}

export function confusionNotes(sighting, brightBodies = []) {
  const notes = [];
  if (sighting.blink) notes.push('Blinkende Lichter gehören oft zu Flugzeugen.');
  if (sighting.straight) notes.push('Ein ruhiger, gerader Zug über den Himmel gehört oft zu einem Satelliten.');
  if (sighting.train) notes.push('Eine Perlenkette im gleichen Kurs ist oft ein Starlink-Zug.');
  for (const body of brightBodies) {
    notes.push(`${body.name} steht in dieser Richtung und ist hell genug, um für ein Objekt gehalten zu werden.`);
  }
  if (!notes.length) notes.push('Nichts an den angekreuzten Merkmalen zeigt klar auf Flugzeug, Satellit oder einen hellen Planeten.');
  return notes;
}

export function toBackup(sightings, sessions, exportedAt = new Date().toISOString()) {
  return {
    app: 'horizont',
    version: 1,
    exportedAt,
    sightings: sightings.map(publicSighting),
    sessions,
  };
}

export function publicSighting(sighting) {
  return {
    ...sighting,
    photo: Boolean(sighting.photo),
    audio: Boolean(sighting.audio),
  };
}

export function parseBackup(data) {
  const sightings = Array.isArray(data?.sightings) ? data.sightings : null;
  const sessions = Array.isArray(data?.sessions) ? data.sessions : null;
  if (!sightings || !sessions) {
    throw new Error('Diese Datei ist kein Horizont-Export.');
  }
  return {
    sightings: sightings.map((item) => createSighting({ ...item, photo: null, audio: null })),
    sessions: sessions.filter((item) => item && typeof item.id === 'string'),
  };
}
