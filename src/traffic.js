import {
  degreesToRadians,
  ecfToLookAngles,
  eciToEcf,
  gstime,
  propagate,
  radiansToDegrees,
  twoline2satrec,
} from 'satellite.js';
import { angleDiff, bearingDeg, formatAzimuth, haversineKm, satelliteElevationDeg } from './format.js';

export function readCraft(observer, row) {
  const lat = Number(row?.lat);
  const lon = Number(row?.lon);
  if (!observer || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const feet = row.alt_baro === 'ground' ? 0 : Number(row.alt_geom ?? row.alt_baro);
  if (!Number.isFinite(feet) || feet < 200) return null;
  const elevation = satelliteElevationDeg(observer.lat, observer.lon, lat, lon, feet * 0.0003048);
  if (elevation < 5) return null;
  const callsign = String(row.flight || '').trim();
  return {
    kind: 'flugzeug',
    callsign: callsign || String(row.hex || 'ohne Rufzeichen'),
    type: String(row.t || '').trim(),
    azimuth: bearingDeg(observer.lat, observer.lon, lat, lon),
    elevation,
    distanceKm: haversineKm(observer.lat, observer.lon, lat, lon),
    altM: feet * 0.3048,
  };
}

export function visibleCraft(observer, rows) {
  return (Array.isArray(rows) ? rows : [])
    .map((row) => readCraft(observer, row))
    .filter(Boolean)
    .sort((a, b) => b.elevation - a.elevation)
    .slice(0, 8);
}

export function parse3le(text) {
  const lines = String(text || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const records = [];
  for (let i = 0; i < lines.length - 2; i += 1) {
    if (!lines[i + 1].startsWith('1 ') || !lines[i + 2].startsWith('2 ')) continue;
    records.push({ name: lines[i], line1: lines[i + 1], line2: lines[i + 2] });
    i += 2;
  }
  return records;
}

export function visibleSats(observer, records, date = new Date()) {
  if (!observer || !records?.length) return [];
  const look = {
    longitude: degreesToRadians(observer.lon),
    latitude: degreesToRadians(observer.lat),
    height: Number(observer.altitude) > 0 ? observer.altitude / 1000 : 0,
  };
  const found = [];
  for (const record of records) {
    let satrec;
    try {
      satrec = twoline2satrec(record.line1, record.line2);
    } catch {
      continue;
    }
    const pv = propagate(satrec, date);
    if (!pv?.position) continue;
    const gmst = gstime(date);
    const ecf = eciToEcf(pv.position, gmst);
    const angles = ecfToLookAngles(look, ecf);
    const elevation = radiansToDegrees(angles.elevation);
    if (elevation < 10) continue;
    found.push({
      kind: 'satellit',
      name: record.name.replace(/\s+/g, ' ').trim(),
      azimuth: (radiansToDegrees(angles.azimuth) + 360) % 360,
      elevation,
    });
  }
  return found.sort((a, b) => b.elevation - a.elevation).slice(0, 8);
}

export function overheadLines(craft, sats, direction) {
  const near = (item) => !Number.isFinite(direction) || angleDiff(item.azimuth, direction) <= 18;
  const picked = [
    ...(craft || []).filter(near).slice(0, 3),
    ...(sats || []).filter(near).slice(0, 3),
  ];
  return picked.map((item) => (item.kind === 'flugzeug'
    ? `Flugzeug ${item.callsign}${item.type ? `, ${item.type}` : ''}, ${formatAzimuth(item.azimuth)}, ${Math.round(item.elevation)}° hoch, ${Math.round(item.distanceKm)} km, ${Math.round(item.altM)} m`
    : `Satellit ${item.name}, ${formatAzimuth(item.azimuth)}, ${Math.round(item.elevation)}° hoch`));
}
