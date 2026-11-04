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

export function compassNote(heading, absolute) {
  const magnetic = ' Der Kompass ist magnetisch. In Mitteleuropa weicht er um wenige Grad von geografisch Nord ab.';
  if (!Number.isFinite(heading)) return `Viele Laptops haben keinen Kompass. Auf dem Telefon fragt das System nach.${magnetic}`;
  if (!absolute) return `Ungefähre Richtung. Das Gerät liefert keinen absoluten Kompass.${magnetic}`;
  return `Gerätekompass, ${compassPoint(heading)}.${magnetic}`;
}

export function durationPhrase(ms) {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return seconds === 1 ? '1 Sekunde' : `${seconds} Sekunden`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return minutes === 1 ? '1 Minute' : `${minutes} Minuten`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourLabel = hours === 1 ? '1 Stunde' : `${hours} Stunden`;
  if (!rest) return hourLabel;
  return `${hourLabel} ${rest} Minuten`;
}

export const EYES_MS = 20 * 60 * 1000;

export function eyesLine(startedAt, now = Date.now()) {
  if (!startedAt) return 'Volle Anpassung dauert ungefähr 20 Minuten. Weißes Licht setzt sie zurück. Das Rotlicht der App lässt sie eher in Ruhe.';
  const left = startedAt + EYES_MS - now;
  if (left <= 0) return 'Die 20 Minuten sind um. Weißes Licht setzt die Anpassung zurück.';
  return `Noch ${formatDuration(left / 1000)}. Weißes Licht setzt die Anpassung zurück.`;
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

export function formatUtc(ts) {
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return '';
  const text = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'UTC',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
  return `${text} UTC`;
}

export function formatClock(ts) {
  return new Intl.DateTimeFormat('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date(ts));
}

export function formatAgo(ts, now = Date.now()) {
  if (!Number.isFinite(ts)) return '';
  const minutes = Math.round((now - ts) / 60000);
  if (minutes < 1) return 'gerade eben';
  if (minutes < 60) return minutes === 1 ? 'vor einer Minute' : `vor ${minutes} Minuten`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return hours === 1 ? 'vor einer Stunde' : `vor ${hours} Stunden`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'gestern';
  if (days < 14) return `vor ${days} Tagen`;
  return new Intl.DateTimeFormat('de-DE', { day: 'numeric', month: 'short' }).format(new Date(ts));
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

export function destination(lat, lon, bearing, meters) {
  const radius = 6371000;
  const delta = meters / radius;
  const theta = (bearing * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(delta) + Math.cos(lat1) * Math.sin(delta) * Math.cos(theta));
  const lon2 = lon1 + Math.atan2(
    Math.sin(theta) * Math.sin(delta) * Math.cos(lat1),
    Math.cos(delta) - Math.sin(lat1) * Math.sin(lat2),
  );
  return {
    lat: (lat2 * 180) / Math.PI,
    lon: (((lon2 * 180) / Math.PI + 540) % 360) - 180,
  };
}

export function skyDialPick(x, y, heading, radius = 78, center = 100) {
  const dx = x - center;
  const dy = y - center;
  const dist = Math.hypot(dx, dy);
  if (dist > radius + 8) return null;
  const clamped = Math.min(dist, radius);
  const elevation = Math.round(Math.max(0, Math.min(90, 90 * (1 - clamped / radius))));
  const offset = (Math.atan2(dx, -dy) * 180) / Math.PI;
  const facing = Number.isFinite(heading) ? heading : 0;
  const direction = Math.round((facing + offset + 360) % 360) % 360;
  return { direction, elevation };
}

export function skyDialPoint(direction, elevation, radius = 78, center = 100) {
  if (!Number.isFinite(direction) || !Number.isFinite(elevation)) return null;
  const offset = (direction * Math.PI) / 180;
  const reach = (1 - Math.max(0, Math.min(90, elevation)) / 90) * radius;
  return {
    x: center + Math.sin(offset) * reach,
    y: center - Math.cos(offset) * reach,
  };
}

export function satelliteElevationDeg(lat, lon, satLat, satLon, satAltKm) {
  const earthKm = 6371;
  const central = haversineKm(lat, lon, satLat, satLon) / earthKm;
  const radius = earthKm + satAltKm;
  const elev = Math.atan2(Math.cos(central) - earthKm / radius, Math.sin(central));
  return (elev * 180) / Math.PI;
}
