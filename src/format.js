export function formatDegrees(value, digits = 5) {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

export function formatLat(lat) {
  if (!Number.isFinite(lat)) return '—';
  const hemi = lat >= 0 ? 'N' : 'S';
  return `${Math.abs(lat).toFixed(5)}° ${hemi}`;
}

export function formatLon(lon) {
  if (!Number.isFinite(lon)) return '—';
  const hemi = lon >= 0 ? 'O' : 'W';
  return `${Math.abs(lon).toFixed(5)}° ${hemi}`;
}

export function decimalPair(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '';
  return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
}

export function formatAccuracy(meters) {
  if (!Number.isFinite(meters)) return 'Genauigkeit unbekannt';
  if (meters < 10) return `± ${Math.round(meters)} m`;
  if (meters < 1000) return `± ${Math.round(meters / 10) * 10} m`;
  return `± ${(meters / 1000).toFixed(1)} km`;
}

export function compassPoint(azimuth) {
  if (!Number.isFinite(azimuth)) return '—';
  const names = ['N', 'NNO', 'NO', 'ONO', 'O', 'OSO', 'SO', 'SSO', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
  const index = Math.round((((azimuth % 360) + 360) % 360) / 22.5) % 16;
  return names[index];
}

export function formatAzimuth(azimuth) {
  if (!Number.isFinite(azimuth)) return '—';
  const wrapped = ((azimuth % 360) + 360) % 360;
  return `${Math.round(wrapped)}° ${compassPoint(wrapped)}`;
}

export function formatAltitude(altitude) {
  if (!Number.isFinite(altitude)) return '—';
  const rounded = Math.round(altitude);
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}°`;
}

export function formatWhen(ts, now = Date.now()) {
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return '';
  const time = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit' }).format(date);
  const start = (value) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const diffDays = Math.round((start(new Date(now)) - start(date)) / 86_400_000);
  if (diffDays === 0) return `Heute, ${time}`;
  if (diffDays === 1) return `Gestern, ${time}`;
  return new Intl.DateTimeFormat('de-DE', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatClock(ts) {
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(ts));
}

export function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export function formatMag(mag) {
  if (!Number.isFinite(mag)) return '';
  const rounded = mag.toFixed(1);
  return mag > 0 ? `+${rounded}` : rounded;
}

export function osmLink(lat, lon, zoom = 16) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return '';
  return `https://www.openstreetmap.org/?mlat=${lat.toFixed(6)}&mlon=${lon.toFixed(6)}#map=${zoom}/${lat.toFixed(5)}/${lon.toFixed(5)}`;
}

export function angleDiff(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  const r = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function bearingDeg(lat1, lon1, lat2, lon2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2))
    - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function satelliteElevationDeg(lat, lon, satLat, satLon, satAltKm) {
  const earthKm = 6371;
  const central = haversineKm(lat, lon, satLat, satLon) / earthKm;
  const radius = earthKm + satAltKm;
  const elev = Math.atan2(Math.cos(central) - earthKm / radius, Math.sin(central));
  return (elev * 180) / Math.PI;
}
