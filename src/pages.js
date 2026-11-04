import { h } from './dom.js';
import {
  compassNote,
  decimalPair,
  durationPhrase,
  eyesLine,
  formatAccuracy,
  formatAltitude,
  formatAzimuth,
  formatClock,
  formatDuration,
  formatLat,
  formatLon,
  formatUtc,
  formatWhen,
  osmLink,
  skyDialPick,
  skyDialPoint,
} from './format.js';
import { outputLabel } from './audio.js';
import { PHASES, phaseRemainingMs, protocolMinutes } from './protocol.js';
import {
  BRIGHTNESS,
  ENDINGS,
  ELEVATION_PRESETS,
  KINDS,
  MOTIONS,
  NOTICED,
  SHAPES,
  SIZES,
  SOUNDS,
  STANCES,
  angleRate,
  bookSummary,
  confusionNotes,
  labelOf,
  reportGaps,
  reportText,
} from './sighting.js';
import { describeBody, issSummary, nearbyBrightBodies, showerLine, weatherSummary } from './sky.js';

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
    placesBlock(ctx),
    sky ? skyBlock(ctx, sky) : h('p', { class: 'hint' }, 'Der Himmel wird berechnet, sobald ein Ort da ist.'),
    showerBlock(),
    weatherBlock(ctx),
    issBlock(ctx),
    eyesBlock(ctx),
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
  for (const star of (sky.stars || []).filter((item) => item.mag < 1.3).slice(0, 4)) {
    rows.push(skyRow(star.name, describeBody(star)));
  }
  if (sky.stars?.some((star) => star.name === 'Polarstern')) {
    const polaris = sky.stars.find((star) => star.name === 'Polarstern');
    rows.push(h('p', { class: 'hint' }, `Polarstern steht bei ${formatAzimuth(polaris.azimuth)}, Höhe ${formatAltitude(polaris.altitude)}. Daran prüfst du den Kompass.`));
  }
  return h('section', { class: 'panel', 'data-live': 'sky' },
    h('h2', {}, 'Himmel'),
    ...rows,
  );
}

function skyRow(name, text) {
  return h('p', { class: 'sky-row' }, h('span', {}, name), h('span', {}, text));
}

function showerBlock() {
  return h('section', { class: 'panel' },
    h('h2', {}, 'Sternschnuppen'),
    h('p', {}, showerLine(new Date())),
    h('div', { class: 'row-actions' },
      h('a', { class: 'btn btn-ghost', href: 'https://www.meteoros.de/feuerkugel', target: '_blank', rel: 'noreferrer' }, 'Feuerkugel melden'),
    ),
    h('p', { class: 'hint' }, 'Eine helle Feuerkugel mit Knall nimmst du beim Arbeitskreis Meteore auf. Die GEP ist für das, was danach noch keine Sternschnuppe ist.'),
  );
}

function eyesBlock(ctx) {
  const started = ctx.eyesStarted();
  return h('section', { class: 'panel' },
    h('h2', {}, 'Augen an die Dunkelheit'),
    h('p', { 'data-live': 'eyes' }, eyesLine(started, ctx.state.clock)),
    h('div', { class: 'row-actions' },
      started
        ? h('button', { class: 'btn btn-ghost', type: 'button', onClick: ctx.stopEyes }, 'Zurücksetzen')
        : h('button', { class: 'btn btn-primary', type: 'button', onClick: ctx.startEyes }, '20 Minuten starten'),
    ),
  );
}

function weatherBlock(ctx) {
  const weather = ctx.state.weather;
  if (!weather && ctx.state.weatherError) {
    return h('p', { class: 'hint', 'data-live': 'weather' }, 'Wetter ist gerade nicht erreichbar. Die Meldung geht auch ohne.');
  }
  if (!weather) return h('p', { class: 'hint', 'data-live': 'weather' }, 'Wetter wird geladen, sobald ein Ort da ist.');
  return h('p', { class: 'panel meta-line', 'data-live': 'weather' }, weatherSummary(weather, ctx.state.cloudLine));
}

function issBlock(ctx) {
  const iss = ctx.state.issView;
  if (!iss) return h('p', { class: 'hint', 'data-live': 'iss' }, 'ISS-Lage wird nur geladen, wenn das Netz da ist.');
  return h('p', { class: 'panel meta-line', 'data-live': 'iss' }, issSummary(iss, ctx.state.issPass));
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
  return compassNote(ctx.state.heading, ctx.state.headingAbsolute);
}

function placesBlock(ctx) {
  const pos = ctx.position;
  const places = ctx.state.settings.places || [];
  return h('details', { class: 'panel fold' },
    h('summary', {}, 'Feste Plätze'),
    places.length
      ? h('div', { class: 'stack' }, ...places.map((place) => h('div', { class: 'row-actions' },
        h('button', {
          class: 'btn btn-ghost',
          type: 'button',
          onClick: () => ctx.usePlace(place),
        }, place.name),
        h('button', {
          class: 'btn btn-ghost',
          type: 'button',
          onClick: () => ctx.removePlace(place.id),
        }, 'Entfernen'),
      )))
      : h('p', { class: 'hint' }, 'Noch kein Platz. Der Balkon oder der Acker merkt sich die Koordinaten, die gerade gelten.'),
    h('form', {
      class: 'stack',
      onSubmit: (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        ctx.savePlace(String(data.get('name') || ''), pos);
        event.currentTarget.reset();
      },
    },
      field('Name', h('input', { name: 'name', type: 'text', maxlength: '32', required: true, placeholder: 'Balkon' })),
      h('button', { class: 'btn btn-primary', type: 'submit', disabled: pos ? null : true }, 'Diesen Ort merken'),
    ),
  );
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
  const gaps = h('p', { class: 'hint' });
  const paintGaps = () => {
    const missing = reportGaps(sighting);
    gaps.textContent = missing.length
      ? `Fürs Weitergeben fehlt noch: ${missing.join(', ')}.`
      : 'Ort, Richtung, Höhe, Dauer, Ende, Helligkeit und Winkelgröße sind ausgefüllt.';
  };
  const kicker = h('p', { class: 'kicker' }, sighting.described ? 'Meldung' : 'Zeitpunkt gestempelt');
  const markDescribed = () => { kicker.textContent = 'Meldung'; };
  const touch = () => {
    sighting.described = true;
    markDescribed();
    paintHints();
    paintGaps();
    save();
  };
  paintHints();
  paintGaps();
  return h('section', { class: 'screen' },
    kicker,
    h('h1', {}, formatWhen(sighting.observedAt, ctx.state.clock)),
    h('p', { class: 'hint' }, formatUtc(sighting.observedAt)),
    h('p', { class: 'lede' }, sightingPlace(sighting)),
    h('div', { class: 'row-actions' },
      h('button', { class: 'btn btn-primary', type: 'button', onClick: () => ctx.copyText(reportText(sighting, ctx.state.clock)) }, 'Bericht kopieren'),
      Number.isFinite(sighting.lat)
        ? h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => ctx.copyText(decimalPair(sighting.lat, sighting.lon)) }, 'Koordinaten kopieren')
        : null,
      h('a', { class: 'btn btn-ghost', href: 'https://www.uap-research.org/ufo-uap-meldestelle/', target: '_blank', rel: 'noreferrer' }, 'GEP-Meldestelle'),
      h('a', { class: 'btn btn-ghost', href: 'https://www.meteoros.de/feuerkugel', target: '_blank', rel: 'noreferrer' }, 'Feuerkugel'),
    ),
    gaps,
    h('form', { class: 'stack', onSubmit: (event) => event.preventDefault() },
      field('Zeugen, dich eingeschlossen', h('input', {
        type: 'number', min: '1', max: '99', value: sighting.witnesses,
        onInput: (event) => { sighting.witnesses = Number(event.target.value); touch(); },
      })),
      field('Du selbst', h('select', {
        value: sighting.stance,
        onChange: (event) => { sighting.stance = event.target.value; touch(); },
      }, h('option', { value: '', selected: sighting.stance === '' }, 'Noch offen'), options(STANCES, sighting.stance))),
      field('Zuerst bemerkt', h('select', {
        value: sighting.noticed,
        onChange: (event) => { sighting.noticed = event.target.value; touch(); },
      }, h('option', { value: '', selected: sighting.noticed === '' }, 'Noch offen'), options(NOTICED, sighting.noticed))),
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
      skyDial(ctx, sighting, touch),
      h('div', { class: 'field' },
        h('span', { class: 'field-label' }, 'Helligkeit'),
        choice(BRIGHTNESS, sighting.brightness, (id) => {
          sighting.brightness = sighting.brightness === id ? '' : id;
          touch();
          ctx.refreshReport();
        }),
      ),
      h('div', { class: 'field' },
        h('span', { class: 'field-label' }, 'Größe auf Armlänge'),
        choice(SIZES, sighting.size, (id) => {
          sighting.size = sighting.size === id ? '' : id;
          touch();
          ctx.refreshReport();
        }),
      ),
      field(`Höhe über dem Horizont · ${sighting.elevation ?? 30}°`, h('input', {
        name: 'elevation',
        type: 'range', min: '0', max: '90', step: '1', value: sighting.elevation ?? 30,
        onInput: (event) => {
          sighting.elevation = Number(event.target.value);
          event.target.parentElement.querySelector('.field-label').textContent = `Höhe über dem Horizont · ${sighting.elevation}°`;
          moveDialMark(event.target.closest('form'), sighting, ctx.state.heading);
          touch();
        },
      })),
      field('Richtung des Objekts', h('input', {
        name: 'direction',
        type: 'number', min: '0', max: '359', step: '1', value: sighting.direction ?? '', placeholder: 'Grad, 0 ist Nord',
        onInput: (event) => {
          sighting.direction = event.target.value === '' ? null : Number(event.target.value);
          moveDialMark(event.target.closest('form'), sighting, ctx.state.heading);
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
      h('div', { class: 'stack' },
        h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => ctx.addTrack(sighting) }, 'Weiteren Punkt stempeln'),
        h('p', { class: 'hint' }, rateHint(sighting) || 'Gleicher Vorgang, neue Uhrzeit. Richtung und Höhe nimmst du vom Stand jetzt. So lässt sich später die Winkeländerung angeben, nicht eine geratene Geschwindigkeit.'),
        sighting.tracks.length
          ? h('div', { class: 'stack' }, ...sighting.tracks.map((track) => h('p', { class: 'hint' }, trackLine(track))))
          : null,
      ),
      field('Dauer', h('input', {
        'data-duration': '1',
        type: 'text', value: sighting.durationMin, maxlength: '40', placeholder: 'z. B. 20 Sekunden',
        onInput: (event) => { sighting.durationMin = event.target.value; touch(); },
      })),
      h('p', { class: 'hint', 'data-live': 'watch' }, `Seit dem Stempel ${formatDuration(Math.max(0, (ctx.state.clock - sighting.observedAt) / 1000))}.`),
      h('button', {
        class: 'btn btn-ghost',
        type: 'button',
        onClick: (event) => {
          sighting.durationMin = durationPhrase(Date.now() - sighting.observedAt);
          const input = event.currentTarget.closest('form')?.querySelector('[data-duration]');
          if (input) input.value = sighting.durationMin;
          touch();
        },
      }, 'Dauer aus der Uhr übernehmen'),
      field('Wie es endete', h('select', {
        value: sighting.ending,
        onChange: (event) => { sighting.ending = event.target.value; touch(); },
      }, h('option', { value: '', selected: sighting.ending === '' }, 'Noch offen'), options(ENDINGS, sighting.ending))),
      field('Geruch', h('input', {
        type: 'text', value: sighting.smell, maxlength: '80', placeholder: 'keiner, oder schweflig, süß, verbrannt',
        onInput: (event) => { sighting.smell = event.target.value; touch(); },
      })),
      field('Geräusch', h('select', {
        value: sighting.sound,
        onChange: (event) => { sighting.sound = event.target.value; touch(); },
      }, options(SOUNDS, sighting.sound))),
      field('Schall später, in Sekunden', h('input', {
        type: 'number', min: '1', max: '180', step: '1', value: sighting.soundLag ?? '', placeholder: 'leer, wenn nichts zu hören war',
        onInput: (event) => {
          sighting.soundLag = event.target.value === '' ? null : Number(event.target.value);
          touch();
        },
      })),
      h('fieldset', { class: 'checks' },
        h('legend', {}, 'Umgebung, nur was du bemerkt hast'),
        check('Tiere wurden unruhig', sighting.effects.animals, (checked) => { sighting.effects.animals = checked; touch(); }),
        check('Motor oder Licht stotterte', sighting.effects.vehicle, (checked) => { sighting.effects.vehicle = checked; touch(); }),
        check('Handy, Funk oder Kompass spielte verrückt', sighting.effects.device, (checked) => { sighting.effects.device = checked; touch(); }),
      ),
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
      h('div', { class: 'field' },
        h('span', { class: 'field-label' }, 'Sprachmemo, bleibt auf diesem Gerät'),
        h('button', {
          class: 'btn btn-ghost',
          type: 'button',
          onClick: () => ctx.toggleMemo(sighting),
        }, ctx.state.recordingId === sighting.id ? 'Aufnahme stoppen' : 'Aufnahme starten'),
        h('p', { class: 'hint' }, 'Tippen, sprechen, nochmal tippen. Höchstens anderthalb Minuten. Die Datei geht nicht in den Export.'),
      ),
      memoBlock(sighting),
      sketchBlock(sighting, ctx),
      photoBlock(sighting),
      sighting.skyHint ? h('p', { class: 'hint' }, `Zum Zeitpunkt: ${sighting.skyHint}`) : null,
    ),
    h('div', { class: 'row-actions' },
      h('button', { class: 'btn btn-danger', type: 'button', onClick: () => ctx.removeSighting(sighting) }, 'Meldung löschen'),
    ),
  );
}

function sessionMeta(session) {
  const count = `${session.sightingIds.length} Meldungen`;
  if (session.emptySky && session.sightingIds.length === 0) return `${formatWhen(session.startedAt)} · nichts gesehen`;
  return `${formatWhen(session.startedAt)} · ${count}`;
}

function choice(list, current, onPick) {
  return h('div', { class: 'chips' }, ...list.map(([id, name]) => h('button', {
    class: `btn btn-ghost${current === id ? ' is-on' : ''}`,
    type: 'button',
    onClick: () => onPick(id),
  }, name)));
}

function trackLine(track) {
  const where = Number.isFinite(track.direction) ? formatAzimuth(track.direction) : 'ohne Richtung';
  const high = Number.isFinite(track.elevation) ? `${Math.round(track.elevation)}° hoch` : 'ohne Höhe';
  return `${formatClock(track.at)} · ${where} · ${high}`;
}

function skyDial(ctx, sighting, touch) {
  const heading = ctx.state.heading;
  const mark = skyDialPoint(sighting.direction, sighting.elevation ?? 30);
  const rose = svgEl('g', {
    'data-dial-rose': '1',
    transform: Number.isFinite(heading) ? `rotate(${-heading} 100 100)` : '',
  },
    svgEl('text', { x: '100', y: '18', 'text-anchor': 'middle', class: 'dial-label' }, 'N'),
    svgEl('text', { x: '184', y: '104', 'text-anchor': 'middle', class: 'dial-label' }, 'O'),
    svgEl('text', { x: '100', y: '190', 'text-anchor': 'middle', class: 'dial-label' }, 'S'),
    svgEl('text', { x: '16', y: '104', 'text-anchor': 'middle', class: 'dial-label' }, 'W'),
    mark ? svgEl('circle', { 'data-dial-mark': '1', cx: mark.x, cy: mark.y, r: '6', class: 'dial-mark' }) : svgEl('circle', { 'data-dial-mark': '1', cx: '100', cy: '100', r: '6', class: 'dial-mark', visibility: 'hidden' }),
  );
  return h('div', { class: 'stack' },
    h('p', { class: 'field-label' }, 'Himmel antippen'),
    svgEl('svg', {
      class: 'sky-dial',
      viewBox: '0 0 200 200',
      role: 'img',
      'aria-label': 'Himmel. Mitte ist oben, der Rand ist der Horizont.',
      onClick: (event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width) * 200;
        const y = ((event.clientY - rect.top) / rect.height) * 200;
        const pick = skyDialPick(x, y, ctx.state.heading);
        if (!pick) return;
        sighting.direction = pick.direction;
        sighting.elevation = pick.elevation;
        const form = event.currentTarget.closest('form');
        const direction = form?.querySelector('[name="direction"]');
        const elevation = form?.querySelector('[name="elevation"]');
        if (direction) direction.value = String(pick.direction);
        if (elevation) {
          elevation.value = String(pick.elevation);
          const label = elevation.closest('.field')?.querySelector('.field-label');
          if (label) label.textContent = `Höhe über dem Horizont · ${pick.elevation}°`;
        }
        moveDialMark(form, sighting, ctx.state.heading);
        touch();
      },
    },
      svgEl('circle', { cx: '100', cy: '100', r: '78', class: 'dial-rim' }),
      svgEl('circle', { cx: '100', cy: '100', r: '2', class: 'dial-zenith' }),
      rose,
    ),
    h('p', { class: 'hint' }, Number.isFinite(heading)
      ? 'Mitte ist der Zenit, der Rand der Horizont. Oben ist die Richtung, in die du schaust.'
      : 'Mitte ist der Zenit, der Rand der Horizont. Oben ist Norden, bis der Kompass läuft.'),
  );
}

function moveDialMark(form, sighting, heading) {
  const mark = form?.querySelector('[data-dial-mark]');
  const rose = form?.querySelector('[data-dial-rose]');
  if (rose) rose.setAttribute('transform', Number.isFinite(heading) ? `rotate(${-heading} 100 100)` : '');
  const point = skyDialPoint(sighting.direction, sighting.elevation);
  if (!mark || !point || !Number.isFinite(sighting.direction)) return;
  mark.setAttribute('cx', String(point.x));
  mark.setAttribute('cy', String(point.y));
  mark.removeAttribute('visibility');
}

function svgEl(name, attrs, ...children) {
  const node = document.createElementNS('http://www.w3.org/2000/svg', name);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value == null || value === false) continue;
    if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, String(value));
  }
  for (const child of children.flat()) {
    if (child) node.append(child);
  }
  return node;
}

function rateHint(sighting) {
  const rate = angleRate(sighting);
  if (rate == null) return '';
  if (rate < 0.05) return 'Zwischen erstem und letztem Punkt hat sich der Winkel kaum geändert.';
  return `Zwischen erstem und letztem Punkt etwa ${rate.toFixed(2)} °/s. Das ist die Winkeländerung, nicht eine Entfernung.`;
}

function sketchBlock(sighting, ctx) {
  const canvas = h('canvas', { class: 'sketch', width: '640', height: '360' });
  const draw = { down: false, erase: false, ink: '#e2a45c', paper: '#0e141b' };
  queueMicrotask(() => {
    if (!canvas.isConnected) return;
    const night = document.documentElement.dataset.night;
    draw.paper = night === 'day' ? '#fffaf3' : night === 'red' ? '#140606' : '#0e141b';
    draw.ink = night === 'day' ? '#241c15' : night === 'red' ? '#ffd2d2' : '#e2a45c';
    const pen = canvas.getContext('2d');
    const paintPaper = () => {
      pen.fillStyle = draw.paper;
      pen.fillRect(0, 0, canvas.width, canvas.height);
    };
    paintPaper();
    if (sighting.sketch instanceof Blob) {
      const url = URL.createObjectURL(sighting.sketch);
      const image = new Image();
      image.onload = () => {
        pen.drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
      };
      image.src = url;
    }
    const point = (event) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (event.clientX - rect.left) * (canvas.width / rect.width),
        y: (event.clientY - rect.top) * (canvas.height / rect.height),
      };
    };
    canvas.addEventListener('pointerdown', (event) => {
      draw.down = true;
      canvas.setPointerCapture(event.pointerId);
      const at = point(event);
      pen.beginPath();
      pen.moveTo(at.x, at.y);
    });
    canvas.addEventListener('pointermove', (event) => {
      if (!draw.down) return;
      const at = point(event);
      pen.strokeStyle = draw.erase ? draw.paper : draw.ink;
      pen.lineWidth = draw.erase ? 28 : 4;
      pen.lineCap = 'round';
      pen.lineJoin = 'round';
      pen.lineTo(at.x, at.y);
      pen.stroke();
    });
    const finish = () => {
      if (!draw.down) return;
      draw.down = false;
      canvas.toBlob((blob) => {
        if (!blob) return;
        sighting.sketch = blob;
        sighting.described = true;
        sighting.updatedAt = Date.now();
        ctx.persistSighting(sighting);
      }, 'image/png');
    };
    canvas.addEventListener('pointerup', finish);
    canvas.addEventListener('pointercancel', finish);
    canvas.dataset.clear = '1';
    canvas.__horizontClear = () => {
      paintPaper();
      sighting.sketch = null;
      sighting.updatedAt = Date.now();
      ctx.persistSighting(sighting);
    };
  });
  return h('div', { class: 'field' },
    h('span', { class: 'field-label' }, 'Skizze, bleibt auf diesem Gerät'),
    canvas,
    h('div', { class: 'row-actions' },
      h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => { draw.erase = false; } }, 'Stift'),
      h('button', { class: 'btn btn-ghost', type: 'button', onClick: () => { draw.erase = true; } }, 'Radierer'),
      h('button', {
        class: 'btn btn-ghost',
        type: 'button',
        onClick: () => canvas.__horizontClear?.(),
      }, 'Leeren'),
    ),
    h('p', { class: 'hint' }, 'Auch eine grobe Skizze hält Lichter und Umriss fest. Sie geht nicht in den Export.'),
  );
}

let memoUrl = null;

function memoBlock(sighting) {
  if (memoUrl) URL.revokeObjectURL(memoUrl);
  memoUrl = null;
  if (!(sighting.audio instanceof Blob)) return null;
  memoUrl = URL.createObjectURL(sighting.audio);
  return h('audio', { class: 'memo', controls: true, src: memoUrl });
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
    h('p', { class: 'hint' }, 'Eine ruhige Stimme aus der App liest jede Phase vor und geht weiter, wenn die Zeit um ist. Der Ruheton ist eine leise Stütze in Phase zwei und drei. Der Dog Whistle ist aus und für die Übung unnötig.'),
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
    session.sightingIds.length
      ? null
      : h('button', {
        class: 'btn btn-ghost btn-xl',
        type: 'button',
        onClick: () => ctx.markEmpty(session),
      }, session.emptySky ? 'Nichts gesehen, notiert' : 'Nichts gesehen'),
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
    h('p', { class: 'lede' }, `${formatWhen(session.startedAt)} bis ${formatWhen(session.endedAt)}. ${session.sightingIds.length === 0 ? (session.emptySky ? 'Nichts gesehen.' : 'Keine Sichtung gestempelt.') : `${session.sightingIds.length} Meldung${session.sightingIds.length === 1 ? '' : 'en'}.`}`),
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
    sightings.length ? h('p', { class: 'hint' }, bookSummary(sightings, ctx.state.clock)) : null,
    rows.length ? h('div', { class: 'stack' }, ...rows.map((row) => row.node)) : h('p', { class: 'lede' }, 'Eine Sichtung beginnt mit dem großen Knopf im Feld. Der Zeitpunkt wird sofort gespeichert, die Beschreibung kann warten.'),
    h('div', { class: 'row-actions' },
      h('button', { class: 'btn btn-ghost', type: 'button', onClick: ctx.exportAll, disabled: rows.length ? null : true }, 'Export'),
      h('button', { class: 'btn btn-ghost', type: 'button', onClick: ctx.pickImport }, 'Import'),
    ),
    h('p', { class: 'hint' }, 'Fotos, Skizzen und Sprachmemos bleiben beim Export außen vor. Sie liegen nur in diesem Browser. Der kopierte Bericht enthält den Text.'),
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
    h('span', { class: 'log-meta' }, sessionMeta(session)),
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
    h('p', {}, 'Die CE5-Sitzung folgt dem öffentlich beschriebenen Ablauf: sicherer Ort, ruhige und friedliche Absicht, eine kurze innere Einladung, dann schweigendes Schauen und ein Protokoll. Eine ruhige Stimme aus der App führt durch die Phasen, langsamer als die Stimme des Telefons. Fehlt die Datei, spricht das Gerät selbst. In der zweiten und dritten Phase kann ein leiser Ton mitlaufen. Der ist für dich, kein Signal an den Himmel, und er ist nicht die kommerzielle Tonfolge von CSETI. Lichtsignale und Laser sind nicht dabei. Wer einen Laser in den Himmel hält, gefährdet Luftfahrzeuge. Das ist in Deutschland strafbar.'),
    h('p', {}, 'Ein UAP-Dog-Whistle gehört nicht zur Übung. Öffentliche JavaScript-Beispiele stapeln 100 Hz mit 7,83 Hz, 432 Hz, 528 Hz, kurze Töne bei 2,5 kHz und Pings bei 17 kHz. Die Vorlage ist ein unbestätigter Beitrag, kein Messverfahren. In Horizont ist das ein Schalter und zu Beginn aus. Die Führung läuft ohne ihn. In der stillen Wache bleibt er aus, damit du den Himmel hörst.'),
    h('h2', {}, 'Was fast immer etwas Bekanntes ist'),
    h('ul', {},
      h('li', {}, 'Venus und Jupiter stehen still und sind grell. Die App zeigt, wenn sie über dem Horizont sind.'),
      h('li', {}, 'Die ISS ist ein sehr heller, gleichmäßiger Punkt und kann im Schatten der Erde einfach ausgehen.'),
      h('li', {}, 'Starlink kommt oft als Kette.'),
      h('li', {}, 'Flugzeuge blinken und halten einen Kurs, besonders in der Nähe von Flughäfen.'),
      h('li', {}, 'Linsenreflexe und Kondensstreifen bewegen sich mit der Kamera oder dem Wind, nicht frei am Himmel.'),
      h('li', {}, 'Sirius, Wega, Arktur und Capella sind die hellen Vergleichslichter. Der Polarstern prüft den Kompass.'),
      h('li', {}, 'Sternschnuppen sind kurz. Eine Feuerkugel mit Knall gehört zum Arbeitskreis Meteore.'),
      h('li', {}, 'Ein Ballon oder eine Himmelslaterne zieht mit dem Wind. Die Wetterzeile sagt, wohin.'),
    ),
    h('h2', {}, 'Augen und Film'),
    h('p', {}, 'Volle Dunkeladaption dauert etwa 20 Minuten. Weißes Licht setzt sie zurück, Rotlicht weniger. Die Uhr dafür liegt im Feld und gehört zu jedem Nachthimmel, auch ohne Sitzung.'),
    h('ul', {},
      h('li', {}, 'Horizont, Haus oder Baum ins Bild, sonst fehlt der Bezug.'),
      h('li', {}, 'Digitalen Zoom lassen. Ein Lichtpunkt wird dadurch zur Scheibe.'),
      h('li', {}, 'Belichtung nicht dauernd nachregeln.'),
      h('li', {}, 'Die Uhrzeit laut ins Video sagen und das Original behalten.'),
    ),
    h('h2', {}, 'Eine brauchbare Meldung'),
    h('p', {}, 'Uhrzeit in UTC, Ort, Blickrichtung und Höhe am Anfang und am Ende, Dauer, wie es aus dem Blick verschwand, Anzahl der Zeugen, ob du standest oder fuhrst, Winkelgröße statt einer geratenen Entfernung. Ein Foto oder eine Skizze hilft nur mit dieser Angabe. Die GEP nimmt Meldungen aus dem deutschsprachigen Raum entgegen. Horizont schickt nichts selbst weg. „Bericht kopieren“ legt denselben Text in die Zwischenablage.'),
    h('p', {}, h('a', { href: 'https://www.uap-research.org/ufo-uap-meldestelle/', target: '_blank', rel: 'noreferrer' }, 'GEP-Meldestelle öffnen')),
    h('p', {}, h('a', { href: 'https://www.meteoros.de/feuerkugel', target: '_blank', rel: 'noreferrer' }, 'Feuerkugel an den Arbeitskreis Meteore')),
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
