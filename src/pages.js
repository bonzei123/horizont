import { h } from './dom.js';
import {
  compassPoint,
  decimalPair,
  formatAccuracy,
  formatAltitude,
  formatAzimuth,
  formatClock,
  formatDuration,
  formatLat,
  formatLon,
  formatMag,
  formatWhen,
  osmLink,
} from './format.js';
import { outputLabel } from './audio.js';
import { PHASES, phaseRemainingMs, protocolMinutes } from './protocol.js';
import {
  ELEVATION_PRESETS,
  KINDS,
  MOTIONS,
  SHAPES,
  SOUNDS,
  confusionNotes,
  labelOf,
} from './sighting.js';
import { describeBody, nearbyBrightBodies } from './sky.js';

function field(label, control) {
  return h('label', { class: 'field' }, h('span', { class: 'field-label' }, label), control);
}

function options(list, value) {
  return list.map(([id, name]) => h('option', { value: id, selected: id === value }, name));
}

export function renderFeld(ctx) {
  const pos = ctx.position;
  const sky = ctx.state.sky;
  const running = ctx.openSession();
  return h('section', { class: 'screen' },
    h('p', { class: 'kicker' }, 'Feld'),
    h('h1', {}, 'Was über dir steht, und wo du stehst.'),
    statusBlock(ctx),
    pos ? coordBlock(ctx, pos) : h('div', { class: 'panel empty-panel' },
      h('h2', {}, ctx.state.geoStatus === 'insecure' ? 'Standort braucht HTTPS' : 'Noch kein Ort'),
      h('p', {}, ctx.state.geoStatus === 'insecure'
        ? 'Der Browser gibt GPS nur über eine https-Adresse frei, deren Zertifikat dieses Gerät akzeptiert. http:// über VPN zählt nicht. Trag die Koordinaten unten von Hand ein, oder öffne die App über das Zertifikat.'
        : 'Ohne Standort kannst du trotzdem einen Zeitpunkt stempeln. Die Koordinaten trägst du danach von Hand ein oder erlaubst GPS.'),
      ctx.state.geoStatus === 'insecure' ? null : h('div', { class: 'row-actions' },
        h('button', { class: 'btn btn-primary', type: 'button', onClick: ctx.requestGeo }, 'Standort erlauben'),
      ),
    ),
    manualBlock(ctx),
    sky ? skyBlock(ctx, sky) : h('p', { class: 'hint' }, 'Der Himmel wird berechnet, sobald ein Ort da ist.'),
    weatherBlock(ctx),
    issBlock(ctx),
    compassBlock(ctx),
    h('div', { class: 'big-actions' },
      h('button', { class: 'btn btn-primary btn-xl', type: 'button', onClick: () => ctx.stampAndOpen() }, 'Sichtung melden'),
      h('a', { class: 'btn btn-ghost btn-xl', href: running ? `#/ce5/sitzung/${running.id}` : '#/ce5' }, running ? 'Sitzung läuft' : 'CE5-Sitzung'),
    ),
    latestBlock(ctx),
  );
}

function statusBlock(ctx) {
  const labels = {
    idle: 'GPS wartet',
    watching: 'Suche den Standort',
    live: 'GPS live',
    denied: 'Standort blockiert',
    unavailable: 'Kein GPS in diesem Browser',
    insecure: 'GPS braucht HTTPS',
    manual: 'Handkoordinaten',
  };
  const key = ctx.state.settings.useManual ? 'manual' : ctx.state.geoStatus;
  return h('p', { class: `pill pill-${key}`, 'data-live': 'status' }, labels[key] || labels.idle);
}

function coordBlock(ctx, pos) {
  return h('div', { class: 'coords' },
    h('p', { class: 'coord' },
      h('span', { class: 'coord-label' }, 'Breite'),
      h('span', { class: 'coord-value', 'data-live': 'lat' }, formatLat(pos.lat)),
    ),
    h('p', { class: 'coord' },
      h('span', { class: 'coord-label' }, 'Länge'),
      h('span', { class: 'coord-value', 'data-live': 'lon' }, formatLon(pos.lon)),
    ),
    h('p', { class: 'meta-line', 'data-live': 'acc' }, accuracyLine(pos)),
    h('div', { class: 'row-actions' },
      h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => ctx.copyText(decimalPair(pos.lat, pos.lon)) }, 'Kopieren'),
      h('a', { class: 'btn btn-ghost', href: osmLink(pos.lat, pos.lon), target: '_blank', rel: 'noreferrer' }, 'Karte extern'),
      h('a', { class: 'btn btn-ghost', href: '#/karte' }, 'Eigene Karte'),
    ),
  );
}

function accuracyLine(pos) {
  const parts = [formatAccuracy(pos.accuracy)];
  if (Number.isFinite(pos.altitude)) parts.push(`${Math.round(pos.altitude)} m Höhe`);
  if (pos.source === 'manual') parts.unshift('von Hand');
  return parts.join(' · ');
}

function manualBlock(ctx) {
  const manual = ctx.state.settings.manual || { lat: '', lon: '' };
  return h('details', { class: 'panel fold' },
    h('summary', {}, 'Koordinaten von Hand'),
    h('form', {
      class: 'stack',
      onSubmit: (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        ctx.setManual(Number(data.get('lat')), Number(data.get('lon')));
      },
    },
      field('Breite', h('input', { name: 'lat', type: 'number', step: '0.000001', required: true, value: manual.lat ?? '', inputmode: 'decimal' })),
      field('Länge', h('input', { name: 'lon', type: 'number', step: '0.000001', required: true, value: manual.lon ?? '', inputmode: 'decimal' })),
      h('div', { class: 'row-actions' },
        h('button', { class: 'btn btn-primary', type: 'submit' }, 'Diese Koordinaten nutzen'),
        ctx.state.settings.useManual
          ? h('button', { class: 'btn btn-ghost', type: 'button', onClick: ctx.useGps }, 'Zurück zu GPS')
          : null,
      ),
    ),
  );
}

function skyBlock(ctx, sky) {
  const rows = [];
  rows.push(skyRow('Sonne', `${formatAltitude(sky.sun.altitude)} · ${sky.sun.band.label}`));
  if (sky.astronomicalNightAt && sky.sun.band.id !== 'nacht') {
    rows.push(h('p', { class: 'hint' }, `Astronomische Nacht um ${formatClock(sky.astronomicalNightAt)}.`));
  }
  if (sky.moon.altitude > -2) {
    rows.push(skyRow('Mond', `${describeBody({ ...sky.moon, name: 'Mond' })} · ${sky.moon.phaseName}, ${Math.round(sky.moon.illumination * 100)} %`));
  } else {
    rows.push(skyRow('Mond', `${sky.moon.phaseName}, unter dem Horizont`));
  }
  for (const planet of sky.planets.slice(0, 4)) rows.push(skyRow(planet.name, describeBody(planet)));
  if (!sky.planets.length) rows.push(h('p', { class: 'hint' }, 'Keiner der hellen Planeten steht gerade über dem Horizont.'));
  return h('section', { class: 'panel', 'data-live': 'sky' },
    h('h2', {}, 'Himmel'),
    ...rows,
  );
}

function skyRow(name, text) {
  return h('p', { class: 'sky-row' }, h('span', {}, name), h('span', {}, text));
}

function weatherBlock(ctx) {
  const weather = ctx.state.weather;
  if (!weather && ctx.state.weatherError) {
    return h('p', { class: 'hint', 'data-live': 'weather' }, 'Wetter ist gerade nicht erreichbar. Die Meldung geht auch ohne.');
  }
  if (!weather) return h('p', { class: 'hint', 'data-live': 'weather' }, 'Wetter wird geladen, sobald ein Ort da ist.');
  const vis = Number.isFinite(weather.visibility) ? `${Math.round(weather.visibility / 1000)} km Sicht` : 'Sicht unbekannt';
  return h('p', { class: 'panel meta-line', 'data-live': 'weather' },
    `Wolken ${Math.round(weather.cloud_cover)} % · ${vis} · ${Math.round(weather.temperature_2m)} °C · Wind ${Math.round(weather.wind_speed_10m)} km/h`,
  );
}

function issBlock(ctx) {
  const iss = ctx.state.issView;
  if (!iss) return h('p', { class: 'hint', 'data-live': 'iss' }, 'ISS-Lage wird nur geladen, wenn das Netz da ist.');
  const text = iss.visible
    ? `ISS über dem Horizont, ${formatAzimuth(iss.azimuth)}, Höhe ${formatAltitude(iss.elevation)}.`
    : 'ISS ist gerade unter dem Horizont.';
  return h('p', { class: 'panel meta-line', 'data-live': 'iss' }, text);
}

function compassBlock(ctx) {
  const heading = ctx.state.heading;
  return h('div', { class: 'panel compass' },
    h('div', {},
      h('h2', {}, 'Blickrichtung'),
      h('p', { class: 'coord-value', 'data-live': 'heading' }, formatAzimuth(heading)),
      h('p', { class: 'hint', 'data-live': 'heading-note' }, headingNote(ctx)),
    ),
    h('button', { class: 'btn btn-ghost', type: 'button', onClick: ctx.enableCompass }, 'Kompass aktivieren'),
  );
}

function headingNote(ctx) {
  if (!Number.isFinite(ctx.state.heading)) return 'Viele Laptops haben keinen Kompass. Auf dem Telefon fragt das System nach.';
  if (!ctx.state.headingAbsolute) return 'Ungefähre Richtung. Das Gerät liefert keinen absoluten Kompass.';
  return `Gerätekompass, ${compassPoint(ctx.state.heading)}.`;
}

function latestBlock(ctx) {
  const latest = [...ctx.state.sightings].sort((a, b) => b.observedAt - a.observedAt)[0];
  if (!latest) return h('p', { class: 'hint' }, 'Noch keine Sichtung auf diesem Gerät.');
  return h('a', { class: 'panel log-item', href: `#/melden/${latest.id}` },
    h('span', { class: 'log-title' }, latest.described ? labelOf(SHAPES, latest.shape) : 'Nur Zeitpunkt'),
    h('span', { class: 'log-meta' }, formatWhen(latest.observedAt)),
  );
}

export function renderReport(ctx, sighting) {
  if (!sighting) {
    return h('section', { class: 'screen' },
      h('h1', {}, 'Diese Meldung liegt hier nicht.'),
      h('a', { class: 'btn btn-ghost', href: '#/log' }, 'Zum Logbuch'),
    );
  }
  const hints = h('div', { class: 'hint-stack' });
  const paintHints = () => {
    const bodies = nearbyBrightBodies(ctx.state.sky, sighting.direction);
    hints.replaceChildren(...confusionNotes(sighting, bodies).map((text) => h('p', {}, text)));
  };
  const save = () => {
    sighting.updatedAt = Date.now();
    ctx.persistSighting(sighting);
  };
  const touch = () => {
    sighting.described = true;
    markDescribed();
    paintHints();
    save();
  };
  paintHints();
  const kicker = h('p', { class: 'kicker' }, sighting.described ? 'Meldung' : 'Zeitpunkt gestempelt');
  const markDescribed = () => { kicker.textContent = 'Meldung'; };
  return h('section', { class: 'screen' },
    kicker,
    h('h1', {}, formatWhen(sighting.observedAt, ctx.state.clock)),
    h('p', { class: 'lede' }, sightingPlace(sighting)),
    h('div', { class: 'row-actions' },
      Number.isFinite(sighting.lat)
        ? h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => ctx.copyText(decimalPair(sighting.lat, sighting.lon)) }, 'Koordinaten kopieren')
        : null,
      h('a', { class: 'btn btn-ghost', href: 'https://www.uap-research.org/ufo-uap-meldestelle/', target: '_blank', rel: 'noreferrer' }, 'GEP-Meldestelle'),
    ),
    h('form', { class: 'stack', onSubmit: (event) => event.preventDefault() },
      field('Anzahl', h('input', {
        type: 'number', min: '1', max: '99', value: sighting.count,
        onInput: (event) => { sighting.count = Number(event.target.value); touch(); },
      })),
      field('Form', h('select', {
        value: sighting.shape,
        onChange: (event) => { sighting.shape = event.target.value; touch(); },
      }, options(SHAPES, sighting.shape))),
      field('Farbe', h('input', {
        type: 'text', value: sighting.color, maxlength: '80', placeholder: 'weiß, orange, wechselnd',
        onInput: (event) => { sighting.color = event.target.value; touch(); },
      })),
      field('Bewegung', h('select', {
        value: sighting.motion,
        onChange: (event) => { sighting.motion = event.target.value; touch(); },
      }, options(MOTIONS, sighting.motion))),
      field(`Höhe über dem Horizont · ${sighting.elevation ?? 30}°`, h('input', {
        type: 'range', min: '0', max: '90', step: '1', value: sighting.elevation ?? 30,
        onInput: (event) => {
          sighting.elevation = Number(event.target.value);
          event.target.parentElement.querySelector('.field-label').textContent = `Höhe über dem Horizont · ${sighting.elevation}°`;
          touch();
        },
      })),
      field('Richtung des Objekts', h('input', {
        type: 'number', min: '0', max: '359', step: '1', value: sighting.direction ?? '', placeholder: 'Grad, 0 ist Nord',
        onInput: (event) => {
          sighting.direction = event.target.value === '' ? null : Number(event.target.value);
          touch();
        },
      })),
      Number.isFinite(ctx.state.heading)
        ? h('button', {
          class: 'btn btn-ghost',
          type: 'button',
          onClick: (event) => {
            sighting.direction = Math.round(ctx.state.heading);
            event.currentTarget.closest('form').querySelector('input[placeholder="Grad, 0 ist Nord"]').value = String(sighting.direction);
            touch();
          },
        }, 'Richtung vom Kompass übernehmen')
        : null,
      h('div', { class: 'chips' }, ...ELEVATION_PRESETS.map((deg) => h('button', {
        class: 'btn btn-ghost',
        type: 'button',
        onClick: (event) => {
          sighting.elevation = deg;
          const range = event.currentTarget.closest('form').querySelector('input[type="range"]');
          range.value = String(deg);
          range.parentElement.querySelector('.field-label').textContent = `Höhe über dem Horizont · ${deg}°`;
          touch();
        },
      }, `${deg}°`))),
      field('Dauer', h('input', {
        type: 'text', value: sighting.durationMin, maxlength: '40', placeholder: 'z. B. 20 Sekunden',
        onInput: (event) => { sighting.durationMin = event.target.value; touch(); },
      })),
      field('Geräusch', h('select', {
        value: sighting.sound,
        onChange: (event) => { sighting.sound = event.target.value; touch(); },
      }, options(SOUNDS, sighting.sound))),
      h('fieldset', { class: 'checks' },
        h('legend', {}, 'Verwechslung prüfen'),
        check('Blinkte', sighting.blink, (checked) => { sighting.blink = checked; touch(); }),
        check('Zog gleichmäßig geradeaus', sighting.straight, (checked) => { sighting.straight = checked; touch(); }),
        check('Mehrere Lichter wie eine Kette', sighting.train, (checked) => { sighting.train = checked; touch(); }),
      ),
      h('div', { class: 'panel' }, h('h2', {}, 'Einordnung, kein Urteil'), hints),
      field('Deine Einordnung', h('select', {
        value: sighting.kind,
        onChange: (event) => { sighting.kind = event.target.value; touch(); },
      }, options(KINDS, sighting.kind))),
      field('Notiz', h('textarea', {
        rows: '6', maxlength: '8000', value: sighting.notes, placeholder: 'Was hast du genau gesehen? Was hast du ausgeschlossen?',
        onInput: (event) => { sighting.notes = event.target.value; touch(); },
      })),
      h('div', { class: 'field' },
        h('span', { class: 'field-label' }, 'Foto, bleibt auf diesem Gerät'),
        h('label', { class: 'btn btn-ghost file-btn' },
          'Foto wählen',
          h('input', {
            type: 'file',
            accept: 'image/*',
            onChange: (event) => ctx.attachPhoto(sighting, event.target.files?.[0], event.target),
          }),
        ),
        h('p', { class: 'hint' }, sighting.photo instanceof Blob
          ? 'Das Foto liegt in diesem Browser, höchstens 4 MB.'
          : 'Höchstens 4 MB. Es wird nicht mit exportiert.'),
      ),
      photoBlock(sighting),
      sighting.skyHint ? h('p', { class: 'hint' }, `Zum Zeitpunkt: ${sighting.skyHint}`) : null,
    ),
    h('div', { class: 'row-actions' },
      h('button', { class: 'btn btn-danger', type: 'button', onClick: () => ctx.removeSighting(sighting) }, 'Meldung löschen'),
    ),
  );
}

function sightingPlace(sighting) {
  if (!Number.isFinite(sighting.lat)) return 'Ohne Koordinaten. Du kannst sie im Feld von Hand setzen und eine neue Meldung machen, oder diese Notiz so behalten.';
  return `${formatLat(sighting.lat)} · ${formatLon(sighting.lon)} · ${formatAccuracy(sighting.accuracy)}`;
}

function check(label, checked, onChange) {
  return h('label', { class: 'check' },
    h('input', {
      type: 'checkbox',
      checked,
      onChange: (event) => onChange(event.target.checked),
    }),
    h('span', {}, label),
  );
}

let photoUrl = null;

function photoBlock(sighting) {
  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoUrl = null;
  if (!(sighting.photo instanceof Blob)) return null;
  photoUrl = URL.createObjectURL(sighting.photo);
  return h('img', { class: 'photo', alt: 'Foto zur Sichtung', src: photoUrl });
}

function audioPanel(ctx) {
  return h('div', { class: 'panel stack' },
    h('h2', {}, 'Führung'),
    h('p', { class: 'hint' }, 'Die Stimme liest jede Phase vor und geht weiter, wenn die Zeit um ist. Der Ruheton ist eine leise Stütze in Phase zwei und drei. Der Dog Whistle ist aus und für die Übung unnötig.'),
    audioControls(ctx),
  );
}

function audioControls(ctx) {
  const settings = ctx.state.settings;
  return h('div', { class: 'stack' },
    check('Stimme und automatischer Wechsel', settings.guide, ctx.setGuide),
    check('Ruheton in Phase zwei und drei', settings.tone, ctx.setTone),
    check('Dog Whistle, optional', settings.whistle, ctx.setWhistle),
    h('p', { class: 'hint' }, 'Der Whistle bleibt aus, bis du ihn anschaltest. Dann spielt er nur in Phase zwei und drei, und der Ruheton schweigt. Es ist der öffentliche Stapel aus JavaScript-Beispielen: 100 Hz mit 7,83 Hz, 432 Hz, 528 Hz, kurze Töne bei 2,5 kHz und leise Pings bei 17 kHz. Dafür gibt es keinen Beleg. 17 kHz hören oft noch Kinder und Tiere.'),
    field('Lautstärke', h('input', {
      type: 'range', min: '0.15', max: '1', step: '0.05', value: settings.volume,
      onInput: (event) => ctx.setVolume(Number(event.target.value)),
    })),
    h('div', { class: 'row-actions' },
      h('button', { class: 'btn btn-ghost', type: 'button', onClick: ctx.pickOutput }, 'Ausgabe wählen'),
      h('button', { class: 'btn btn-ghost', type: 'button', onClick: ctx.probeTone }, 'Tonprobe'),
    ),
    h('p', { class: 'hint', 'data-live': 'sink' }, outputLabel(settings.sinkLabel)),
  );
}

export function renderCe5(ctx) {
  return h('section', { class: 'screen' },
    h('p', { class: 'kicker' }, 'CE5'),
    h('h1', {}, 'Eine Sitzung, kein Versprechen.'),
    h('p', { class: 'lede' }, `Fünf Phasen, zusammen etwa ${protocolMinutes()} Minuten. Die Stimme führt dich hindurch und wechselt von selbst, wenn die Zeit um ist. Kontakt ist das Ziel der Übung, nicht ihr Ergebnis.`),
    h('ol', { class: 'phase-list' }, ...PHASES.map((phase, index) => h('li', {},
      h('span', { class: 'phase-index' }, String(index + 1).padStart(2, '0')),
      h('span', {},
        h('strong', {}, phase.title),
        h('span', { class: 'log-meta' }, `${phase.minutes} Minuten · ${phase.lead}`),
      ),
    ))),
    audioPanel(ctx),
    h('div', { class: 'big-actions' },
      h('button', { class: 'btn btn-primary btn-xl', type: 'button', onClick: ctx.startSession }, ctx.state.settings.guide ? 'Geführt starten' : 'Sitzung starten'),
      h('a', { class: 'btn btn-ghost btn-xl', href: '#/wissen' }, 'Hintergrund lesen'),
    ),
    h('div', { class: 'panel prose' },
      h('h2', {}, 'Vor dem Start'),
      h('ul', {},
        h('li', {}, 'Du bist an diesem Ort erlaubt, und jemand weiß, wo du bist.'),
        h('li', {}, 'Du stellst dich nicht an eine Straße und läufst keinem Licht hinterher.'),
        h('li', {}, 'Kein Laser. Auf Luftfahrzeuge gerichtet ist das in Deutschland strafbar.'),
        h('li', {}, 'Rotes Licht schont die Augen. Der Schalter sitzt oben.'),
        h('li', {}, 'Bluetooth zuerst im Gerät koppeln. Die Seite kann kein Headset selbst paaren.'),
        h('li', {}, 'Lass den Bildschirm an. Ohne HTTPS hält das Telefon ihn nicht von allein wach, und manche Geräte stoppen dann die Stimme.'),
      ),
    ),
  );
}

export function renderSession(ctx, session) {
  if (!session) {
    return h('section', { class: 'screen' },
      h('h1', {}, 'Diese Sitzung gibt es hier nicht.'),
      h('a', { class: 'btn btn-ghost', href: '#/ce5' }, 'Zur Übung'),
    );
  }
  if (session.completed) return renderFinishedSession(ctx, session);
  const phase = PHASES[session.phaseIndex];
  const remain = phaseRemainingMs(session, ctx.state.clock);
  return h('section', { class: 'screen' },
    h('p', { class: 'kicker' }, `Phase ${session.phaseIndex + 1} von ${PHASES.length}`),
    h('h1', {}, phase.title),
    h('p', { class: 'timer', 'data-live': 'remain' }, formatDuration(Math.abs(remain) / 1000)),
    h('p', { class: 'hint', 'data-live': 'remain-note' }, session.pausedAt ? 'Pausiert' : remain < 0 ? 'Die Zeit dieser Phase ist um.' : phase.lead),
    h('p', { class: 'hint', 'data-live': 'guide' }, ctx.state.guideStatus || ''),
    h('div', { class: 'prose' }, ...phase.paragraphs.map((text) => h('p', {}, text))),
    h('div', { class: 'row-actions' },
      h('button', {
        class: 'btn btn-ghost',
        type: 'button',
        onClick: () => ctx.togglePause(session),
      }, session.pausedAt ? 'Weiterlaufen' : 'Pause'),
      h('button', {
        class: 'btn btn-primary',
        type: 'button',
        onClick: () => ctx.advancePhase(session),
      }, session.phaseIndex === PHASES.length - 1 ? 'Sitzung abschließen' : 'Nächste Phase'),
      ctx.state.settings.guide
        ? h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => ctx.repeatPhase(session) }, 'Nochmal ansagen')
        : null,
    ),
    h('details', { class: 'panel fold' },
      h('summary', {}, 'Ton und Ausgabe'),
      audioControls(ctx),
    ),
    h('button', { class: 'btn btn-primary btn-xl', type: 'button', onClick: () => ctx.stampAndOpen(session.id) }, 'Sichtung melden'),
    field('Notiz zur Sitzung', h('textarea', {
      rows: '4',
      value: session.notes,
      onInput: (event) => {
        session.notes = event.target.value;
        ctx.persistSession(session);
      },
    })),
    session.sightingIds.length
      ? h('div', { class: 'stack' },
        h('h2', {}, 'Gestempelt in dieser Sitzung'),
        ...session.sightingIds.map((id) => {
          const sighting = ctx.state.sightings.find((item) => item.id === id);
          if (!sighting) return null;
          return h('a', { class: 'panel log-item', href: `#/melden/${id}` },
            h('span', { class: 'log-title' }, formatClock(sighting.observedAt)),
            h('span', { class: 'log-meta' }, sighting.described ? labelOf(SHAPES, sighting.shape) : 'Noch ohne Beschreibung'),
          );
        }),
      )
      : null,
  );
}

function renderFinishedSession(ctx, session) {
  return h('section', { class: 'screen' },
    h('p', { class: 'kicker' }, 'Abgeschlossen'),
    h('h1', {}, 'Die Sitzung ist zu.'),
    h('p', { class: 'lede' }, `${formatWhen(session.startedAt)} bis ${formatWhen(session.endedAt)}. ${session.sightingIds.length === 0 ? 'Keine Sichtung gestempelt.' : `${session.sightingIds.length} Meldung${session.sightingIds.length === 1 ? '' : 'en'}.`}`),
    session.notes ? h('div', { class: 'panel prose' }, h('p', {}, session.notes)) : h('p', { class: 'hint' }, 'Ohne Notiz. Ein leerer Himmel darf so stehen bleiben.'),
    h('div', { class: 'stack' }, ...session.sightingIds.map((id) => h('a', { class: 'btn btn-ghost', href: `#/melden/${id}` }, 'Meldung öffnen'))),
    h('div', { class: 'row-actions' },
      h('a', { class: 'btn btn-primary', href: '#/ce5' }, 'Neue Sitzung'),
      h('button', { class: 'btn btn-danger', type: 'button', onClick: () => ctx.removeSession(session) }, 'Sitzung löschen'),
    ),
  );
}

export function renderLog(ctx) {
  const sightings = [...ctx.state.sightings].sort((a, b) => b.observedAt - a.observedAt);
  const sessions = [...ctx.state.sessions].sort((a, b) => b.startedAt - a.startedAt);
  const rows = [
    ...sightings.map((item) => ({ at: item.observedAt, node: sightingRow(item) })),
    ...sessions.map((item) => ({ at: item.startedAt, node: sessionRow(item) })),
  ].sort((a, b) => b.at - a.at);
  return h('section', { class: 'screen' },
    h('p', { class: 'kicker' }, 'Logbuch'),
    h('h1', {}, rows.length ? 'Was dieses Gerät behalten hat.' : 'Das Logbuch ist leer.'),
    rows.length ? h('div', { class: 'stack' }, ...rows.map((row) => row.node)) : h('p', { class: 'lede' }, 'Eine Sichtung beginnt mit dem großen Knopf im Feld. Der Zeitpunkt wird sofort gespeichert, die Beschreibung kann warten.'),
    h('div', { class: 'row-actions' },
      h('button', { class: 'btn btn-ghost', type: 'button', onClick: ctx.exportAll, disabled: rows.length ? null : true }, 'Export'),
      h('button', { class: 'btn btn-ghost', type: 'button', onClick: ctx.pickImport }, 'Import'),
    ),
    h('p', { class: 'hint' }, 'Fotos bleiben beim Export außen vor. Sie liegen nur in diesem Browser.'),
  );
}

function sightingRow(sighting) {
  return h('a', { class: 'panel log-item', href: `#/melden/${sighting.id}` },
    h('span', { class: 'log-title' }, sighting.described ? labelOf(SHAPES, sighting.shape) : 'Nur Zeitpunkt'),
    h('span', { class: 'log-meta' }, `${formatWhen(sighting.observedAt)} · ${labelOf(KINDS, sighting.kind)}`),
  );
}

function sessionRow(session) {
  return h('a', { class: 'panel log-item', href: `#/ce5/sitzung/${session.id}` },
    h('span', { class: 'log-title' }, session.completed ? 'CE5-Sitzung' : 'CE5 läuft noch'),
    h('span', { class: 'log-meta' }, `${formatWhen(session.startedAt)} · ${session.sightingIds.length} Meldungen`),
  );
}

export function renderMapPage(ctx) {
  const located = ctx.state.sightings.filter((item) => Number.isFinite(item.lat)).length;
  const frame = h('div', { class: 'map-frame', id: 'map' });
  queueMicrotask(() => {
    if (!frame.isConnected) return;
    ctx.mountMap(frame);
  });
  return h('section', { class: 'screen screen-map' },
    h('div', { class: 'map-copy' },
      h('p', { class: 'kicker' }, 'Karte'),
      h('h1', {}, located
        ? `${located} ${located === 1 ? 'Punkt' : 'Punkte'} auf diesem Gerät`
        : 'Noch kein Punkt auf der Karte'),
    ),
    frame,
    h('p', { class: 'hint' }, 'Bernstein sind deine Meldungen. Türkis bist du, der Kreis drumherum ist die GPS-Ungenauigkeit.'),
  );
}

export function renderWissen() {
  return h('section', { class: 'screen prose-page' },
    h('p', { class: 'kicker' }, 'Wissen'),
    h('h1', {}, 'Ein Rahmen für eine unklare Beobachtung.'),
    h('p', {}, 'UAP heißt unidentified anomalous phenomenon: etwas am Himmel, das du im Moment nicht zuordnen kannst. Das alte Wort UFO meint dasselbe und trägt mehr Mythos mit. Horizont behandelt beides als Beobachtung, nicht als Beweis.'),
    h('h2', {}, 'Die Hynek-Skala'),
    h('p', {}, 'J. Allen Hynek sortierte Berichte nach Nähe und Spur, nicht nach einer Erklärung. Nachtlicht, Tagesscheibe, Radar und Sicht zugleich, dann die nahen Begegnungen: nur gesehen, mit physikalischer Wirkung, mit einer beschriebenen Gestalt. CE5 steht nicht in dieser Skala. Den Begriff hat Steven Greer später für einen von Menschen begonnenen Kontaktversuch gesetzt.'),
    h('h2', {}, 'Was die Übung ist'),
    h('p', {}, 'Die CE5-Sitzung folgt dem öffentlich beschriebenen Ablauf: sicherer Ort, ruhige und friedliche Absicht, eine kurze innere Einladung, dann schweigendes Schauen und ein Protokoll. Eine Stimme führt durch die Phasen. In der zweiten und dritten Phase kann ein leiser Ton mitlaufen. Der ist für dich, kein Signal an den Himmel, und er ist nicht die kommerzielle Tonfolge von CSETI. Lichtsignale und Laser sind nicht dabei. Wer einen Laser in den Himmel hält, gefährdet Luftfahrzeuge. Das ist in Deutschland strafbar.'),
    h('p', {}, 'Ein UAP-Dog-Whistle gehört nicht zur Übung. Öffentliche JavaScript-Beispiele stapeln 100 Hz mit 7,83 Hz, 432 Hz, 528 Hz, kurze Töne bei 2,5 kHz und Pings bei 17 kHz. Die Vorlage ist ein unbestätigter Beitrag, kein Messverfahren. In Horizont ist das ein Schalter und zu Beginn aus. Die Führung läuft ohne ihn. In der stillen Wache bleibt er aus, damit du den Himmel hörst.'),
    h('h2', {}, 'Was fast immer etwas Bekanntes ist'),
    h('ul', {},
      h('li', {}, 'Venus und Jupiter stehen still und sind grell. Die App zeigt, wenn sie über dem Horizont sind.'),
      h('li', {}, 'Die ISS ist ein sehr heller, gleichmäßiger Punkt und kann im Schatten der Erde einfach ausgehen.'),
      h('li', {}, 'Starlink kommt oft als Kette.'),
      h('li', {}, 'Flugzeuge blinken und halten einen Kurs, besonders in der Nähe von Flughäfen.'),
      h('li', {}, 'Linsenreflexe und Kondensstreifen bewegen sich mit der Kamera oder dem Wind, nicht frei am Himmel.'),
    ),
    h('h2', {}, 'Eine brauchbare Meldung'),
    h('p', {}, 'Uhrzeit, Ort, Blickrichtung, Höhe über dem Horizont, Dauer, Anzahl, ob es blinkte, ob der Kurs gerade war, und was du schon ausgeschlossen hast. Ein Foto hilft nur mit dieser Angabe. Die GEP nimmt Meldungen aus dem deutschsprachigen Raum entgegen.'),
    h('p', {}, h('a', { href: 'https://www.uap-research.org/ufo-uap-meldestelle/', target: '_blank', rel: 'noreferrer' }, 'GEP-Meldestelle öffnen')),
    h('h2', {}, 'Was Horizont nicht tut'),
    h('p', {}, 'Nichts verlässt das Gerät, außer du exportierst eine Datei oder öffnest einen externen Link. Es gibt keine gemeinsame Karte, keine Flugzeug-Radarlage und keine Vorhersage aller Satellitenpässe. Dafür bräuchte es ein Backend und laufend neue Bahndaten. Die eigene Meldung, der eigene Himmel und die eigene Sitzung gehen auch ohne Netz, sobald die Seite geladen ist.'),
  );
}

export function liveNodes() {
  return {
    status: document.querySelector('[data-live="status"]'),
    lat: document.querySelector('[data-live="lat"]'),
    lon: document.querySelector('[data-live="lon"]'),
    acc: document.querySelector('[data-live="acc"]'),
    heading: document.querySelector('[data-live="heading"]'),
    headingNote: document.querySelector('[data-live="heading-note"]'),
    remain: document.querySelector('[data-live="remain"]'),
    remainNote: document.querySelector('[data-live="remain-note"]'),
    weather: document.querySelector('[data-live="weather"]'),
    iss: document.querySelector('[data-live="iss"]'),
  };
}
