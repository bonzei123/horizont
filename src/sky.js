import {
  Body,
  DefineStar,
  Equator,
  Horizon,
  Illumination,
  MoonPhase,
  Observer,
  SearchAltitude,
} from 'astronomy-engine';
import { angleDiff, bearingDeg, compassPoint, formatAltitude, formatAzimuth, formatClock, formatMag, satelliteElevationDeg } from './format.js';

const STARS = [
  [Body.Star1, 'Sirius', 6.7525, -16.716, 8.6, -1.46],
  [Body.Star2, 'Arktur', 14.261, 19.182, 37, -0.05],
  [Body.Star3, 'Wega', 18.616, 38.784, 25, 0.03],
  [Body.Star4, 'Capella', 5.278, 45.998, 43, 0.08],
  [Body.Star5, 'Prokyon', 7.655, 5.225, 11.5, 0.37],
  [Body.Star6, 'Atair', 19.846, 8.868, 17, 0.76],
  [Body.Star7, 'Beteigeuze', 5.9195, 7.407, 550, 0.5],
  [Body.Star8, 'Polarstern', 2.530, 89.264, 433, 1.98],
];

let starsReady = false;

function ensureStars() {
  if (starsReady) return;
  for (const [body, , ra, dec, lightYears] of STARS) DefineStar(body, ra, dec, lightYears);
  starsReady = true;
}

const SHOWERS = [
  { name: 'Quadrantiden', start: '01-01', end: '01-12', peak: '01-03', radiant: 'Bärenhüter, nach Mitternacht im Nordosten' },
  { name: 'Lyriden', start: '04-14', end: '04-30', peak: '04-22', radiant: 'Leier, Osten' },
  { name: 'Eta-Aquariiden', start: '04-19', end: '05-28', peak: '05-06', radiant: 'Wassermann, tief im Südosten' },
  { name: 'Delta-Aquariiden', start: '07-12', end: '08-23', peak: '07-30', radiant: 'Wassermann, Südosten' },
  { name: 'Perseiden', start: '07-17', end: '08-24', peak: '08-12', radiant: 'Perseus, Nordosten' },
  { name: 'Orioniden', start: '10-02', end: '11-07', peak: '10-21', radiant: 'Orion, Südosten' },
  { name: 'Leoniden', start: '11-06', end: '11-30', peak: '11-17', radiant: 'Löwe, Osten nach Mitternacht' },
  { name: 'Geminiden', start: '12-04', end: '12-17', peak: '12-14', radiant: 'Zwillinge, Osten' },
  { name: 'Ursiden', start: '12-17', end: '12-26', peak: '12-22', radiant: 'Kleiner Wagen, Norden' },
];

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
  ensureStars();
  const stars = STARS.map(([body, name, , , , mag]) => {
    const hor = horizontal(body, date, observer);
    return { name, azimuth: hor.azimuth, altitude: hor.altitude, mag };
  }).filter((star) => star.altitude > 8).sort((a, b) => a.mag - b.mag);

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
  const moonUp = moon.altitude > 0;
  const moonSetAt = moonUp ? nextCrossing(Body.Moon, observer, date, -1, 0) : null;
  const moonRiseAt = moonUp ? null : nextCrossing(Body.Moon, observer, date, 1, 0);

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
    stars,
    astronomicalNightAt,
    moonSetAt,
    moonRiseAt,
  };
}

function nextCrossing(body, observer, date, direction, altitude) {
  try {
    const hit = SearchAltitude(body, observer, direction, date, 2, altitude);
    return hit ? hit.date.getTime() : null;
  } catch {
    return null;
  }
}

export function nearbyBrightBodies(sky, direction, windowDeg = 18) {
  if (!sky || !Number.isFinite(direction)) return [];
  const bodies = [
    sky.moon.altitude > 5 ? { ...sky.moon, name: 'Mond', mag: -12 } : null,
    ...sky.planets,
    ...(sky.stars || []),
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

export function windDrift(weather) {
  const from = Number(weather?.wind_direction_10m);
  const speed = Number(weather?.wind_speed_10m);
  if (!Number.isFinite(from) || !Number.isFinite(speed)) return '';
  const toward = (from + 180) % 360;
  return `Wind ${Math.round(speed)} km/h aus ${formatAzimuth(from)}. Ein Ballon oder eine Himmelslaterne zieht etwa nach ${compassPoint(toward)}.`;
}

export function weatherSummary(weather, cloudLine = '') {
  if (!weather) return '';
  const vis = Number.isFinite(weather.visibility) ? `${Math.round(weather.visibility / 1000)} km Sicht` : 'Sicht unbekannt';
  const wind = windDrift(weather) || `Wind ${Math.round(weather.wind_speed_10m)} km/h`;
  const now = `Wolken ${Math.round(weather.cloud_cover)} % · ${vis} · ${Math.round(weather.temperature_2m)} °C · ${wind}`;
  return cloudLine ? `${now} ${cloudLine}` : now;
}

function monthDay(date) {
  return (date.getMonth() + 1) * 100 + date.getDate();
}

function keyOf(mmdd) {
  const [month, day] = mmdd.split('-').map(Number);
  return month * 100 + day;
}

function prettyDay(mmdd) {
  const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const [month, day] = mmdd.split('-').map(Number);
  return `${day}. ${months[month - 1]}`;
}

export function showerWatch(date = new Date()) {
  const key = monthDay(date);
  const active = SHOWERS.filter((shower) => key >= keyOf(shower.start) && key <= keyOf(shower.end));
  const upcoming = SHOWERS.filter((shower) => keyOf(shower.start) > key);
  return { active, next: upcoming[0] || SHOWERS[0] };
}

export function showerLine(date = new Date()) {
  const watch = showerWatch(date);
  if (watch.active.length) {
    const detail = watch.active
      .map((shower) => `${shower.name}, Radiant ${shower.radiant}, Höhepunkt um den ${prettyDay(shower.peak)}`)
      .join('. ');
    return `${detail}. Eine Sternschnuppe dauert unter einer Sekunde und kommt aus dieser Himmelsgegend. Ein Licht, das minutenlang steht, ist ein anderer Vorgang.`;
  }
  const next = watch.next;
  return `Gerade kein großer Strom. Als Nächstes ${next.name} ab dem ${prettyDay(next.start)}. Radiant: ${next.radiant}.`;
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
