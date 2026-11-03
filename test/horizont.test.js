import assert from 'node:assert/strict';
import test from 'node:test';
import {
  angleDiff,
  bearingDeg,
  compassPoint,
  formatLat,
  formatLon,
  haversineKm,
  satelliteElevationDeg,
} from '../src/format.js';
import { createId } from '../src/id.js';
import { PHASES, createSession, phaseDue, phaseRemainingMs, protocolMinutes } from '../src/protocol.js';
import {
  confusionNotes,
  createSighting,
  parseBackup,
  toBackup,
} from '../src/sighting.js';
import { moonIllumination, moonPhaseName, skySnapshot, sunBand } from '../src/sky.js';

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
  const parsed = parseBackup(backup);
  assert.equal(parsed.sightings[0].notes, 'hell');
  assert.equal(parsed.sightings[0].photo, null);
  assert.equal(parsed.sessions[0].id, 'c1');
  assert.throws(() => parseBackup({ app: 'horizont' }), /Horizont-Export/);
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
