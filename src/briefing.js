import { formatClock } from './format.js';
import { showerWatch } from './sky.js';

export const PACK = [
  ['warm', 'Warme Schicht, Mütze, Handschuhe'],
  ['sitz', 'Sitz oder Decke'],
  ['tee', 'Etwas Warmes zu trinken'],
  ['akku', 'Powerbank, Akku in der Innentasche'],
  ['rot', 'Rotlicht, oder die App auf Rot'],
  ['glas', 'Fernglas, falls du eins hast'],
  ['bescheid', 'Jemandem sagen, wo du bist und wann du zurück bist'],
  ['original', 'Filme und Fotos nicht gleich beschneiden'],
];

export function fieldBriefing({ sky, weather, pass, now = Date.now() } = {}) {
  const extra = [];
  const shower = showerWatch(new Date(now));
  if (shower.active.length) {
    const names = shower.active.map((item) => item.name).join(' und ');
    extra.push(`${names} laufen. Ein kurzer Strich aus dem Radianten ist eine Sternschnuppe.`);
  }
  const temp = Number(weather?.temperature_2m);
  if (Number.isFinite(temp) && temp <= 5) {
    extra.push(`${Math.round(temp)} °C. Der Akku gehört in die Innentasche, Kälte leert ihn schnell.`);
  }
  if (pass && Number.isFinite(pass.peak) && pass.peak > now && pass.peak - now < 4 * 60 * 60 * 1000) {
    extra.push(`ISS um ${formatClock(pass.peak)}, Höhe etwa ${Math.round(pass.maxElevation)}°.`);
  }
  if (!sky) {
    return {
      tone: 'wait',
      title: 'Ohne Ort kein Lagebild',
      lines: ['Mit Koordinaten sagt die Lage, ob sich der Weg lohnt.', ...extra],
    };
  }

  const cloud = Number.isFinite(Number(weather?.cloud_cover)) ? Number(weather.cloud_cover) : null;
  const night = sky.sun.altitude <= -18;
  const moonLine = moonSentence(sky);
  const cloudLine = cloud == null ? 'Wolken gerade ohne Angabe.' : `Wolken ${Math.round(cloud)} %.`;

  if (cloud != null && cloud >= 85) {
    return {
      tone: 'stay',
      title: 'Dichte Wolken',
      lines: [`${cloudLine} Für den Himmel lohnt der Weg gerade wenig.`, moonLine, ...extra],
    };
  }
  if (sky.sun.altitude > 0) {
    const when = sky.astronomicalNightAt ? `Astronomische Nacht ab ${formatClock(sky.astronomicalNightAt)}.` : 'Die Nacht liegt noch vor dir.';
    return { tone: 'wait', title: 'Tag', lines: [when, moonLine, ...extra] };
  }
  if (!night) {
    const when = sky.astronomicalNightAt ? `Astronomische Nacht ab ${formatClock(sky.astronomicalNightAt)}.` : 'Es wird dunkler.';
    return { tone: 'wait', title: 'Dämmerung', lines: [when, moonLine, ...extra] };
  }
  const moonBright = sky.moon.altitude > 5 && sky.moon.illumination >= 0.4;
  if (moonBright) {
    return { tone: 'wait', title: 'Nacht mit hellem Mond', lines: [moonLine, cloudLine, ...extra] };
  }
  if (cloud != null && cloud >= 55) {
    return { tone: 'wait', title: 'Lücken möglich', lines: [cloudLine, moonLine, ...extra] };
  }
  return { tone: 'go', title: 'Brauchbare Nacht', lines: [moonLine, cloudLine, ...extra] };
}

function moonSentence(sky) {
  const bright = sky.moon.altitude > 5 && sky.moon.illumination >= 0.4;
  if (bright && sky.moonSetAt) return `Heller Mond bis etwa ${formatClock(sky.moonSetAt)}. Schwache Lichter gehen darin unter.`;
  if (bright) return 'Heller Mond. Schwache Lichter gehen darin unter.';
  if (sky.moon.altitude > 5) return `Mond ${sky.moon.phaseName}. Schmal genug, dass schwache Lichter sichtbar bleiben.`;
  if (sky.moonRiseAt) return `Der Mond stört gerade nicht. Aufgang etwa ${formatClock(sky.moonRiseAt)}.`;
  return 'Der Mond stört gerade nicht.';
}
