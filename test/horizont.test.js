import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {
  angleDiff,
  bearingDeg,
  compassPoint,
  destination,
  formatLat,
  formatLon,
  compassNote,
  durationPhrase,
  formatUtc,
  haversineKm,
  satelliteElevationDeg,
  skyDialPick,
} from '../src/format.js';
import { createId } from '../src/id.js';
import { PHASES, createSession, phaseDue, phaseRemainingMs, protocolMinutes } from '../src/protocol.js';
import {
  confusionNotes,
  createSighting,
  parseBackup,
  angleRate,
  bookSummary,
  reportGaps,
  reportText,
  toBackup,
} from '../src/sighting.js';
import { editionLabel, onThisDay } from '../src/almanac.js';
import { fieldBriefing } from '../src/briefing.js';
import { parseFeed, selectPosts } from '../src/feeds.js';
import { CHAPTERS } from '../src/reference.js';
import { cloudSpan, moonIllumination, moonPhaseName, nextIssPass, showerWatch, skySnapshot, sunBand, windDrift } from '../src/sky.js';

test('coordinates and compass points', () => {
  assert.equal(formatLat(52.52), '52.52000° N');
  assert.equal(formatLat(-33.8), '33.80000° S');
  assert.equal(formatLon(13.4), '13.40000° O');
  assert.equal(formatLon(-0.1), '0.10000° W');
  assert.equal(compassPoint(0), 'N');
  assert.equal(compassPoint(90), 'O');
  assert.equal(compassPoint(180), 'S');
  assert.equal(compassPoint(270), 'W');
  assert.equal(compassPoint(359), 'N');
});

test('angle difference wraps around north', () => {
  assert.equal(angleDiff(10, 350), 20);
  assert.equal(angleDiff(0, 180), 180);
});

test('haversine and satellite elevation', () => {
  const berlinToHamburg = haversineKm(52.52, 13.405, 53.55, 10.0);
  assert.ok(berlinToHamburg > 250 && berlinToHamburg < 280);
  const overhead = satelliteElevationDeg(52.5, 13.4, 52.5, 13.4, 420);
  assert.ok(overhead > 80);
  const far = satelliteElevationDeg(52.5, 13.4, 0, 13.4, 420);
  assert.ok(far < 0);
  const east = bearingDeg(52, 13, 52, 14);
  assert.ok(east > 80 && east < 100);
});

test('sun bands and moon phase names', () => {
  assert.equal(sunBand(12).id, 'tag');
  assert.equal(sunBand(-3).id, 'buergerlich');
  assert.equal(sunBand(-9).id, 'nautisch');
  assert.equal(sunBand(-15).id, 'astro');
  assert.equal(sunBand(-30).label, 'Astronomische Nacht');
  assert.equal(moonPhaseName(0), 'Neumond');
  assert.equal(moonPhaseName(90), 'zunehmender Halbmond');
  assert.equal(moonPhaseName(180), 'Vollmond');
  assert.equal(moonPhaseName(270), 'abnehmender Halbmond');
  assert.ok(Math.abs(moonIllumination(0)) < 0.001);
  assert.ok(Math.abs(moonIllumination(180) - 1) < 0.001);
});

test('Berlin is in astronomical night on a November evening', () => {
  const sky = skySnapshot(52.52, 13.405, 40, new Date('2026-11-03T21:00:00Z'));
  assert.equal(sky.sun.band.id, 'nacht');
  assert.ok(sky.sun.altitude < -18);
  assert.ok(sky.planets.length >= 0);
  assert.equal(typeof sky.moon.phaseName, 'string');
  assert.ok(sky.moonSetAt || sky.moonRiseAt);
  const polaris = sky.stars.find((star) => star.name === 'Polarstern');
  assert.ok(polaris.altitude > 45 && polaris.altitude < 60);
  assert.ok(sky.stars.some((star) => star.name === 'Sirius' || star.name === 'Wega' || star.name === 'Capella'));
});

test('the night briefing says whether to go out', () => {
  const open = {
    sun: { altitude: -30 },
    moon: { altitude: -5, illumination: 0.05, phaseName: 'Neumond' },
    moonRiseAt: Date.parse('2026-11-05T02:00:00Z'),
  };
  const go = fieldBriefing({
    sky: open,
    weather: { cloud_cover: 10, temperature_2m: -2 },
    now: Date.parse('2026-11-04T21:00:00Z'),
  });
  assert.equal(go.tone, 'go');
  assert.equal(go.title, 'Brauchbare Nacht');
  assert.ok(go.lines.some((line) => line.includes('Innentasche')));
  assert.ok(go.lines.some((line) => line.includes('Orioniden')));
  const socked = fieldBriefing({
    sky: open,
    weather: { cloud_cover: 95, temperature_2m: 8 },
    now: Date.parse('2026-11-04T21:00:00Z'),
  });
  assert.equal(socked.tone, 'stay');
  const day = fieldBriefing({
    sky: { sun: { altitude: 20 }, moon: { altitude: -2, illumination: 0, phaseName: 'Neumond' }, astronomicalNightAt: Date.parse('2026-11-04T20:00:00Z') },
    now: Date.parse('2026-11-04T12:00:00Z'),
  });
  assert.equal(day.tone, 'wait');
  assert.equal(day.title, 'Tag');
  const moonlit = fieldBriefing({
    sky: { sun: { altitude: -25 }, moon: { altitude: 40, illumination: 0.9, phaseName: 'Vollmond' }, moonSetAt: Date.parse('2026-11-05T03:00:00Z') },
    weather: { cloud_cover: 10, temperature_2m: 8 },
    now: Date.parse('2026-11-04T22:00:00Z'),
  });
  assert.equal(moonlit.title, 'Nacht mit hellem Mond');
  assert.equal(fieldBriefing({ now: Date.parse('2026-11-04T22:00:00Z') }).title, 'Ohne Ort kein Lagebild');
});

test('the almanac knows Arnold day and a reddit feed parses', () => {
  const arnold = onThisDay(new Date(2026, 5, 24));
  assert.ok(arnold.some((item) => item.title === 'Kenneth Arnold'));
  const greifswald = onThisDay(new Date(2026, 7, 24));
  assert.ok(greifswald.some((item) => item.title === 'Greifswald'));
  assert.match(editionLabel(new Date(2026, 10, 4)), /2026/);
  const posts = parseFeed(`<feed><entry><title>Licht über der Werft</title><link href="https://www.reddit.com/r/UFOs/comments/abc/licht/"/><category term="UFOs"/><published>2026-11-04T08:00:00Z</published></entry></feed>`, { kind: 'reddit' });
  assert.equal(posts[0].source, 'r/UFOs');
  assert.equal(posts[0].title, 'Licht über der Werft');
  const bundle = { week: posts, fresh: [], press: [{ title: 'Amt', href: 'https://example.test/a', source: 'Google News', kind: 'press', at: null, thumb: '' }] };
  assert.equal(selectPosts(bundle, 'week', 'r/UFOs').length, 1);
  assert.equal(selectPosts(bundle, 'press', 'alle')[0].source, 'Google News');
});

test('the handbook covers the literature without a personal questionnaire', () => {
  const titles = CHAPTERS.map((chapter) => chapter.title).join(' ');
  assert.match(titles, /Gestalten/);
  assert.match(titles, /Entführungsberichte/);
  const text = JSON.stringify(CHAPTERS);
  assert.match(text, /Kenneth Arnold/);
  assert.match(text, /Greifswald/);
  assert.match(text, /Petit-Rechain/);
  assert.match(text, /keinen Entführungsbogen/);
});

test('meteor showers and wind drift stay local', () => {
  const november = showerWatch(new Date(2026, 10, 4, 12));
  assert.ok(november.active.some((shower) => shower.name === 'Orioniden'));
  const august = showerWatch(new Date(2026, 7, 12, 22));
  assert.ok(august.active.some((shower) => shower.name === 'Perseiden'));
  const september = showerWatch(new Date(2026, 8, 1, 12));
  assert.equal(september.active.length, 0);
  assert.equal(september.next.name, 'Orioniden');
  const drift = windDrift({ wind_direction_10m: 270, wind_speed_10m: 12 });
  assert.match(drift, /aus 270° W/);
  assert.match(drift, /nach O/);
});

test('a report names its gaps, the clock and a sound lag', () => {
  const fresh = createSighting();
  assert.ok(reportGaps(fresh).includes('Ort'));
  assert.ok(reportGaps(fresh).includes('Dauer'));
  assert.equal(durationPhrase(45_000), '45 Sekunden');
  assert.equal(durationPhrase(180_000), '3 Minuten');
  const heard = createSighting({
    lat: 52.5,
    lon: 13.4,
    direction: 20,
    elevation: 30,
    durationMin: '2 Minuten',
    ending: 'horizont',
    brightness: 'stern',
    size: 'punkt',
    soundLag: 9,
    weather: { cloud_cover: 20, temperature_2m: 4, wind_speed_10m: 12, wind_direction_10m: 270 },
  });
  assert.equal(reportGaps(heard).length, 0);
  const text = reportText(heard);
  assert.match(text, /Schall: 9 s später, grob 3\.0 km/);
  assert.match(text, /nach O/);
  assert.match(bookSummary([heard], Date.parse('2026-06-01T12:00:00Z')), /1 Meldung/);
  assert.match(compassNote(12, true), /magnetisch/);
});

test('ids keep working when the page is not a secure context', () => {
  assert.match(createId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  const desc = Object.getOwnPropertyDescriptor(crypto, 'randomUUID');
  Object.defineProperty(crypto, 'randomUUID', { value: undefined, configurable: true, writable: true });
  try {
    const session = createSession();
    const sighting = createSighting();
    assert.match(session.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.match(sighting.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.notEqual(session.id, sighting.id);
  } finally {
    if (desc) Object.defineProperty(crypto, 'randomUUID', desc);
    else delete crypto.randomUUID;
  }
});

test('sighting keeps a stamped moment and safe defaults', () => {
  const sighting = createSighting({ lat: 52.5, lon: 13.4, heading: 20, count: 0, shape: 'nope' }, 1000);
  assert.equal(sighting.observedAt, 1000);
  assert.equal(sighting.count, 1);
  assert.equal(sighting.shape, 'punkt');
  assert.equal(sighting.described, false);
  assert.equal(sighting.lat, 52.5);
});

test('confusion notes mention aircraft, satellites and a bright planet', () => {
  const notes = confusionNotes(
    { blink: true, straight: true, train: true },
    [{ name: 'Venus' }],
  );
  assert.equal(notes.length, 4);
  assert.match(notes[0], /Flugzeug/);
  assert.match(notes[3], /Venus/);
});

test('backup round trip drops photos and rejects junk', () => {
  const sighting = createSighting({ id: 's1', notes: 'hell', photo: new Blob(['x']) });
  const backup = toBackup([sighting], [{ id: 'c1' }], '2026-11-03T00:00:00.000Z');
  assert.equal(backup.sightings[0].photo, true);
  assert.equal(backup.sightings[0].audio, false);
  const parsed = parseBackup(backup);
  assert.equal(parsed.sightings[0].notes, 'hell');
  assert.equal(parsed.sightings[0].photo, null);
  assert.equal(parsed.sessions[0].id, 'c1');
  assert.throws(() => parseBackup({ app: 'horizont' }), /Horizont-Export/);
});

test('sky dial, direction ray and sighting details stay explicit', () => {
  const north = skyDialPick(100, 22, 0);
  assert.equal(north.elevation, 0);
  assert.equal(north.direction, 0);
  const zenith = skyDialPick(100, 100, 20);
  assert.equal(zenith.elevation, 90);
  const east = destination(52, 13, 90, 2000);
  assert.ok(east.lon > 13);
  assert.ok(Math.abs(east.lat - 52) < 0.02);
  const sighting = createSighting({
    brightness: 'planet',
    size: 'muenze',
    tracks: [{ at: 50, direction: 10, elevation: 20 }, { at: 'nope' }],
    audio: new Blob(['a']),
  });
  assert.equal(sighting.brightness, 'planet');
  assert.equal(sighting.size, 'muenze');
  assert.equal(sighting.tracks.length, 1);
  assert.equal(sighting.audio.size, 1);
  assert.equal(createSighting({ brightness: 'nope' }).brightness, '');
  assert.equal(createSession({ emptySky: true }).emptySky, true);
});

test('cloud span and the next ISS pass', () => {
  const line = cloudSpan(
    ['2026-11-04T20:00', '2026-11-04T21:00', '2026-11-04T23:00'],
    [10, 40, 90],
    Date.parse('2026-11-04T22:00:00Z'),
    0,
    Date.parse('2026-11-04T20:30:00Z'),
  );
  assert.match(line, /10–40/);
  assert.match(line, /astronomischen Nacht/);
  const pass = nextIssPass([
    { timestamp: 1000, latitude: 0, longitude: 0, altitude: 420, visibility: 'daylight' },
    { timestamp: 1060, latitude: 10, longitude: 0, altitude: 420, visibility: 'daylight' },
    { timestamp: 1120, latitude: 50, longitude: 0, altitude: 420, visibility: 'eclipsed' },
  ], 52, 0, 1000 * 1000);
  assert.ok(pass);
  assert.equal(pass.lit, false);
  assert.ok(pass.maxElevation > 10);
});

test('a copied report carries utc, ending and angular rate', () => {
  assert.equal(formatUtc(Date.parse('2026-11-04T18:30:00Z')), '2026-11-04 18:30 UTC');
  const sighting = createSighting({
    observedAt: Date.parse('2026-11-04T18:30:00Z'),
    lat: 52.5,
    lon: 13.4,
    direction: 10,
    elevation: 20,
    witnesses: 2,
    ending: 'ploetzlich',
    stance: 'still',
    effects: { animals: true },
    tracks: [{ at: Date.parse('2026-11-04T18:30:10Z'), direction: 40, elevation: 20 }],
    sketch: new Blob(['s']),
  });
  const text = reportText(sighting, Date.parse('2026-11-04T19:00:00Z'));
  assert.match(text, /2026-11-04 18:30 UTC/);
  assert.match(text, /Plötzlich weg/);
  assert.match(text, /Zeugen einschließlich dir: 2/);
  assert.match(text, /Tiere unruhig/);
  assert.match(text, /°\/s/);
  assert.ok(angleRate(sighting) > 2);
  const backup = toBackup([sighting], []);
  assert.equal(backup.sightings[0].sketch, true);
  assert.equal(parseBackup(backup).sightings[0].sketch, null);
});

test('calm voice clips cover every spoken line', () => {
  const ids = [...PHASES.map((phase) => phase.id), 'bridge', 'closing'];
  for (const id of ids) {
    const file = `public/voice/${id}.mp3`;
    assert.ok(fs.existsSync(file), file);
    assert.ok(fs.statSync(file).size > 8000, file);
  }
});

test('CE5 protocol has five phases and a running clock', () => {
  assert.equal(PHASES.length, 5);
  assert.equal(protocolMinutes(), 35);
  const session = {
    phaseIndex: 0,
    phaseStartedAt: 0,
    pausedAt: null,
    pausedMs: 0,
  };
  assert.equal(phaseRemainingMs(session, 1000), PHASES[0].minutes * 60 * 1000 - 1000);
  assert.equal(phaseDue(session, 1000), false);
  assert.equal(phaseDue(session, PHASES[0].minutes * 60 * 1000), true);
  assert.equal(phaseDue({ ...session, pausedAt: 1 }, PHASES[0].minutes * 60 * 1000), false);
  assert.equal(phaseDue(null, 0), false);
  assert.deepEqual(PHASES.filter((phase) => phase.drone).map((phase) => phase.id), ['kohaerenz', 'einladung']);
  for (const phase of PHASES) assert.ok(phase.speech.length > 40, phase.id);
});
