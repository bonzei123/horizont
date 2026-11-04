import { angleDiff, formatAzimuth, formatLat, formatLon, formatUtc, formatWhen } from './format.js';
import { createId } from './id.js';
import { windDrift } from './sky.js';

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

export const ENDINGS = [
  ['noch', 'Es war noch da, als ich wegschaute'],
  ['deckung', 'Hinter Wolke, Baum oder Haus'],
  ['horizont', 'Hinter dem Horizont'],
  ['ploetzlich', 'Plötzlich weg'],
  ['klein', 'Wurde kleiner, bis nichts mehr da war'],
];

export const NOTICED = [
  ['zufall', 'Zufällig im Blick'],
  ['suche', 'Beim absichtlichen Schauen'],
  ['geraeusch', 'Durch ein Geräusch'],
  ['person', 'Jemand anders sah es zuerst'],
];

export const STANCES = [
  ['still', 'Ich stand oder saß'],
  ['fuss', 'Ich ging'],
  ['auto', 'Ich saß in einem Fahrzeug'],
];

const BRIGHTNESS_IDS = new Set(BRIGHTNESS.map(([id]) => id));
const SIZE_IDS = new Set(SIZES.map(([id]) => id));
const ENDING_IDS = new Set(ENDINGS.map(([id]) => id));
const NOTICED_IDS = new Set(NOTICED.map(([id]) => id));
const STANCE_IDS = new Set(STANCES.map(([id]) => id));

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
    ending: ENDING_IDS.has(partial.ending) ? partial.ending : '',
    noticed: NOTICED_IDS.has(partial.noticed) ? partial.noticed : '',
    stance: STANCE_IDS.has(partial.stance) ? partial.stance : '',
    witnesses: clampCount(partial.witnesses),
    smell: stringOf(partial.smell),
    soundLag: lagSeconds(partial.soundLag),
    effects: cleanEffects(partial.effects),
    tracks: cleanTracks(partial.tracks),
    skyHint: stringOf(partial.skyHint),
    overhead: cleanLines(partial.overhead),
    weather: partial.weather && typeof partial.weather === 'object' ? partial.weather : null,
    sessionId: typeof partial.sessionId === 'string' ? partial.sessionId : null,
    photo: partial.photo instanceof Blob ? partial.photo : null,
    audio: partial.audio instanceof Blob ? partial.audio : null,
    sketch: partial.sketch instanceof Blob ? partial.sketch : null,
  };
}

function cleanEffects(value) {
  return {
    animals: Boolean(value?.animals),
    vehicle: Boolean(value?.vehicle),
    device: Boolean(value?.device),
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

function cleanLines(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((line) => typeof line === 'string' && line.trim()).slice(0, 8).map((line) => line.trim().slice(0, 180));
}

function stringOf(value) {
  return typeof value === 'string' ? value : '';
}

function lagSeconds(value) {
  if (value == null || value === '') return null;
  const number = Math.round(Number(value));
  if (!Number.isFinite(number) || number < 1) return null;
  return Math.min(180, number);
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

export function angleRate(sighting) {
  const points = [
    { at: sighting.observedAt, direction: sighting.direction },
    ...(sighting.tracks || []),
  ].filter((point) => Number.isFinite(point.at) && Number.isFinite(point.direction));
  if (points.length < 2) return null;
  const seconds = (points[points.length - 1].at - points[0].at) / 1000;
  if (seconds <= 0) return null;
  return angleDiff(points[0].direction, points[points.length - 1].direction) / seconds;
}

export function reportText(sighting, now = Date.now()) {
  const lines = [
    'Horizont-Meldung',
    `Lokal: ${formatWhen(sighting.observedAt, now)}`,
    `UTC: ${formatUtc(sighting.observedAt)}`,
  ];
  lines.push(Number.isFinite(sighting.lat)
    ? `Ort: ${formatLat(sighting.lat)}, ${formatLon(sighting.lon)}`
    : 'Ort: keine Koordinaten');
  if (sighting.skyHint) lines.push(`Himmel: ${sighting.skyHint}`);
  if (sighting.overhead?.length) {
    lines.push('In der Nähe zur Stempelzeit, Sender oder Bahn, nicht das Urteil:');
    lines.push(...sighting.overhead);
  }
  if (sighting.weather && Number.isFinite(Number(sighting.weather.cloud_cover))) {
    const drift = windDrift(sighting.weather);
    const base = `Wetter: Wolken ${Math.round(sighting.weather.cloud_cover)} %, ${Math.round(sighting.weather.temperature_2m)} °C`;
    lines.push(drift ? `${base}. ${drift}` : `${base}, Wind ${Math.round(sighting.weather.wind_speed_10m)} km/h`);
  }
  lines.push(`Objekte: ${sighting.count}`);
  lines.push(`Form: ${labelOf(SHAPES, sighting.shape)}`);
  if (sighting.color) lines.push(`Farbe: ${sighting.color}`);
  if (sighting.brightness) lines.push(`Helligkeit: ${labelOf(BRIGHTNESS, sighting.brightness)}`);
  if (sighting.size) lines.push(`Winkelgröße: ${labelOf(SIZES, sighting.size)}`);
  if (Number.isFinite(sighting.direction)) lines.push(`Richtung zu Beginn: ${formatAzimuth(sighting.direction)}`);
  if (Number.isFinite(sighting.elevation)) lines.push(`Höhe zu Beginn: ${Math.round(sighting.elevation)}° über dem Horizont`);
  const last = sighting.tracks[sighting.tracks.length - 1];
  if (last && Number.isFinite(last.direction)) lines.push(`Richtung zuletzt: ${formatAzimuth(last.direction)}`);
  if (last && Number.isFinite(last.elevation)) lines.push(`Höhe zuletzt: ${Math.round(last.elevation)}° über dem Horizont`);
  const rate = angleRate(sighting);
  if (rate != null) {
    lines.push(rate < 0.05
      ? 'Winkeländerung: kaum, zwischen erstem und letztem Punkt'
      : `Winkeländerung: ${rate.toFixed(2)} °/s zwischen erstem und letztem Punkt`);
  }
  lines.push(`Bewegung: ${labelOf(MOTIONS, sighting.motion)}`);
  if (sighting.durationMin) lines.push(`Dauer: ${sighting.durationMin}`);
  if (sighting.ending) lines.push(`Ende: ${labelOf(ENDINGS, sighting.ending)}`);
  if (sighting.noticed) lines.push(`Zuerst bemerkt: ${labelOf(NOTICED, sighting.noticed)}`);
  if (sighting.stance) lines.push(`Beobachter: ${labelOf(STANCES, sighting.stance)}`);
  lines.push(`Zeugen einschließlich dir: ${sighting.witnesses}`);
  lines.push(`Geräusch: ${labelOf(SOUNDS, sighting.sound)}`);
  if (sighting.soundLag) lines.push(`Schall: ${sighting.soundLag} s später, grob ${(sighting.soundLag / 3).toFixed(1)} km, falls es derselbe Vorgang war.`);
  if (sighting.smell) lines.push(`Geruch: ${sighting.smell}`);
  const effects = [];
  if (sighting.effects.animals) effects.push('Tiere unruhig');
  if (sighting.effects.vehicle) effects.push('Motor oder Licht stotterte');
  if (sighting.effects.device) effects.push('Handy, Funk oder Kompass spielte verrückt');
  if (effects.length) lines.push(`Umgebung: ${effects.join(', ')}`);
  if (sighting.notes) lines.push('', sighting.notes);
  lines.push('', 'Foto, Skizze und Sprachmemo liegen nur auf dem Gerät.');
  return `${lines.join('\n')}\n`;
}

export function reportGaps(sighting) {
  const gaps = [];
  if (!Number.isFinite(sighting.lat)) gaps.push('Ort');
  if (!Number.isFinite(sighting.direction)) gaps.push('Richtung am Anfang');
  if (!Number.isFinite(sighting.elevation)) gaps.push('Höhe am Anfang');
  if (!sighting.durationMin) gaps.push('Dauer');
  if (!sighting.ending) gaps.push('wie es endete');
  if (!sighting.brightness) gaps.push('Helligkeit');
  if (!sighting.size) gaps.push('Winkelgröße');
  return gaps;
}

export function bookSummary(sightings, now = Date.now()) {
  if (!sightings.length) return '';
  const year = new Date(now).getFullYear();
  const thisYear = sightings.filter((item) => new Date(item.observedAt).getFullYear() === year).length;
  const directed = sightings.filter((item) => Number.isFinite(item.direction)).length;
  const label = sightings.length === 1 ? 'Meldung' : 'Meldungen';
  return `${sightings.length} ${label} auf diesem Gerät, ${thisYear} in ${year}, ${directed} mit Richtung.`;
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
    sketch: Boolean(sighting.sketch),
  };
}

export function parseBackup(data) {
  const sightings = Array.isArray(data?.sightings) ? data.sightings : null;
  const sessions = Array.isArray(data?.sessions) ? data.sessions : null;
  if (!sightings || !sessions) {
    throw new Error('Diese Datei ist kein Horizont-Export.');
  }
  return {
    sightings: sightings.map((item) => createSighting({ ...item, photo: null, audio: null, sketch: null })),
    sessions: sessions.filter((item) => item && typeof item.id === 'string'),
  };
}
