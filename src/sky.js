import {
  Body,
  Equator,
  Horizon,
  Illumination,
  MoonPhase,
  Observer,
  SearchAltitude,
} from 'astronomy-engine';
import { angleDiff, bearingDeg, formatAltitude, formatAzimuth, formatMag, satelliteElevationDeg } from './format.js';

const PLANETS = [
  [Body.Mercury, 'Merkur'],
  [Body.Venus, 'Venus'],
  [Body.Mars, 'Mars'],
  [Body.Jupiter, 'Jupiter'],
  [Body.Saturn, 'Saturn'],
];

export function sunBand(altitude) {
  if (altitude >= 0) return { id: 'tag', label: 'Tag' };
  if (altitude >= -6) return { id: 'buergerlich', label: 'Bürgerliche Dämmerung' };
  if (altitude >= -12) return { id: 'nautisch', label: 'Nautische Dämmerung' };
  if (altitude >= -18) return { id: 'astro', label: 'Astronomische Dämmerung' };
  return { id: 'nacht', label: 'Astronomische Nacht' };
}

export function moonPhaseName(phase) {
  const p = ((phase % 360) + 360) % 360;
  if (p < 22.5 || p >= 337.5) return 'Neumond';
  if (p < 67.5) return 'zunehmende Sichel';
  if (p < 112.5) return 'zunehmender Halbmond';
  if (p < 157.5) return 'zunehmender Mond';
  if (p < 202.5) return 'Vollmond';
  if (p < 247.5) return 'abnehmender Mond';
  if (p < 292.5) return 'abnehmender Halbmond';
  return 'abnehmende Sichel';
}

export function moonIllumination(phase) {
  return (1 - Math.cos((phase * Math.PI) / 180)) / 2;
}

function horizontal(body, date, observer) {
  const eq = Equator(body, date, observer, true, true);
  return Horizon(date, observer, eq.ra, eq.dec, 'normal');
}

export function skySnapshot(lat, lon, heightMeters = 0, date = new Date()) {
  const observer = new Observer(lat, lon, Number.isFinite(heightMeters) ? heightMeters : 0);
  const sun = horizontal(Body.Sun, date, observer);
  const moon = horizontal(Body.Moon, date, observer);
  const phase = MoonPhase(date);
  const planets = PLANETS.map(([body, name]) => {
    const hor = horizontal(body, date, observer);
    const illum = Illumination(body, date);
    return {
      id: body,
      name,
      azimuth: hor.azimuth,
      altitude: hor.altitude,
      mag: illum.mag,
    };
  })
    .filter((planet) => planet.altitude > 0)
    .sort((a, b) => a.mag - b.mag);

  let astronomicalNightAt = null;
  if (sun.altitude > -18) {
    const hit = SearchAltitude(Body.Sun, observer, -1, date, 2, -18);
    astronomicalNightAt = hit ? hit.date.getTime() : null;
  }

  return {
    at: date.getTime(),
    sun: {
      altitude: sun.altitude,
      azimuth: sun.azimuth,
      band: sunBand(sun.altitude),
    },
    moon: {
      altitude: moon.altitude,
      azimuth: moon.azimuth,
      phase,
      phaseName: moonPhaseName(phase),
      illumination: moonIllumination(phase),
    },
    planets,
    astronomicalNightAt,
  };
}

export function nearbyBrightBodies(sky, direction, windowDeg = 18) {
  if (!sky || !Number.isFinite(direction)) return [];
  const bodies = [
    sky.moon.altitude > 5 ? { ...sky.moon, name: 'Mond', mag: -12 } : null,
    ...sky.planets,
  ].filter(Boolean);
  return bodies.filter((body) => body.mag < 1 && angleDiff(body.azimuth, direction) <= windowDeg);
}

export function skyHint(sky) {
  if (!sky) return '';
  const bright = sky.planets.filter((planet) => planet.mag < 0).slice(0, 2);
  const parts = [sky.sun.band.label];
  if (sky.moon.altitude > 0) parts.push(`Mond ${sky.moon.phaseName}`);
  if (bright.length) parts.push(bright.map((planet) => planet.name).join(' und ') + ' über dem Horizont');
  return parts.join(' · ');
}

export function describeBody(body) {
  const mag = body.mag != null && body.name !== 'Mond' ? `, ${formatMag(body.mag)} mag` : '';
  return `${formatAzimuth(body.azimuth)}, Höhe ${formatAltitude(body.altitude)}${mag}`;
}

export function issView(lat, lon, iss) {
  if (!iss || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const elevation = satelliteElevationDeg(lat, lon, iss.latitude, iss.longitude, iss.altitude);
  const azimuth = bearingDeg(lat, lon, iss.latitude, iss.longitude);
  return {
    elevation,
    azimuth,
    visible: elevation > 0,
    altitudeKm: iss.altitude,
  };
}
