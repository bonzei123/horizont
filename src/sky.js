import {
  Body,
  Equator,
  Horizon,
  Illumination,
  MoonPhase,
  Observer,
  SearchAltitude,
} from 'astronomy-engine';
import { angleDiff, bearingDeg, formatAltitude, formatAzimuth, formatClock, formatMag, satelliteElevationDeg } from './format.js';

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

export function cloudSpan(times, covers, until, offsetSeconds = 0, now = Date.now()) {
  const night = Number.isFinite(until) && until > now;
  const end = night ? until : now + 4 * 60 * 60 * 1000;
  const rows = [];
  const stamps = Array.isArray(times) ? times : [];
  const values = Array.isArray(covers) ? covers : [];
  for (let i = 0; i < stamps.length; i += 1) {
    const at = Date.parse(`${stamps[i]}Z`) - offsetSeconds * 1000;
    const cover = Number(values[i]);
    if (!Number.isFinite(at) || !Number.isFinite(cover)) continue;
    if (at < now - 30 * 60 * 1000) continue;
    if (at > end) break;
    rows.push(cover);
  }
  if (!rows.length) return '';
  const min = Math.round(Math.min(...rows));
  const max = Math.round(Math.max(...rows));
  const when = night ? 'Bis zur astronomischen Nacht' : 'In den nächsten Stunden';
  if (min === max) return `${when} etwa ${min} % Wolken.`;
  return `${when} ${min}–${max} % Wolken.`;
}

export function nextIssPass(rows, lat, lon, now = Date.now(), minElevation = 10) {
  const points = (Array.isArray(rows) ? rows : [])
    .map((row) => {
      const at = Number(row.timestamp) > 10_000_000_000 ? Number(row.timestamp) : Number(row.timestamp) * 1000;
      return {
        at,
        elevation: satelliteElevationDeg(lat, lon, Number(row.latitude), Number(row.longitude), Number(row.altitude)),
        azimuth: bearingDeg(lat, lon, Number(row.latitude), Number(row.longitude)),
        eclipsed: row.visibility === 'eclipsed',
      };
    })
    .filter((point) => Number.isFinite(point.at) && Number.isFinite(point.elevation))
    .sort((a, b) => a.at - b.at);
  const runs = [];
  let run = [];
  for (const point of points) {
    if (point.elevation >= minElevation) run.push(point);
    else if (run.length) {
      runs.push(run);
      run = [];
    }
  }
  if (run.length) runs.push(run);
  const upcoming = runs.find((item) => item[item.length - 1].at >= now);
  if (!upcoming) return null;
  const peak = upcoming.reduce((best, point) => (point.elevation > best.elevation ? point : best), upcoming[0]);
  const lit = upcoming.filter((point) => !point.eclipsed).length >= Math.ceil(upcoming.length / 2);
  return {
    start: upcoming[0].at,
    end: upcoming[upcoming.length - 1].at,
    peak: peak.at,
    maxElevation: peak.elevation,
    riseAzimuth: upcoming[0].azimuth,
    peakAzimuth: peak.azimuth,
    lit,
  };
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

export function weatherSummary(weather, cloudLine = '') {
  if (!weather) return '';
  const vis = Number.isFinite(weather.visibility) ? `${Math.round(weather.visibility / 1000)} km Sicht` : 'Sicht unbekannt';
  const now = `Wolken ${Math.round(weather.cloud_cover)} % · ${vis} · ${Math.round(weather.temperature_2m)} °C · Wind ${Math.round(weather.wind_speed_10m)} km/h`;
  return cloudLine ? `${now}. ${cloudLine}` : now;
}

export function issSummary(view, pass) {
  if (!view) return '';
  const now = view.visible
    ? `ISS über dem Horizont, ${formatAzimuth(view.azimuth)}, Höhe ${formatAltitude(view.elevation)}.`
    : 'ISS ist gerade unter dem Horizont.';
  if (pass === undefined) return `${now} Nächster Pass wird gesucht, wenn das Netz da ist.`;
  if (!pass) return `${now} In den nächsten Stunden kein Pass über 10°.`;
  const minutes = Math.max(1, Math.round((pass.end - pass.start) / 60000));
  const light = pass.lit
    ? 'Die Station steht in der Sonne.'
    : 'Die Station ist im Erdschatten und bleibt dunkel.';
  const sky = pass.dark === false ? ' Bei dir ist es dann hell.' : pass.dark ? ' Bei dir ist es dann dunkel.' : '';
  return `${now} Nächster Pass um ${formatClock(pass.peak)}, aus ${formatAzimuth(pass.riseAzimuth)}, Höhe ${Math.round(pass.maxElevation)}°, etwa ${minutes} Minuten. ${light}${sky}`;
}
