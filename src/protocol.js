import { createId } from './id.js';

export const PHASES = [
  {
    id: 'ort',
    title: 'Ort und Sicherheit',
    minutes: 3,
    lead: 'Erst der Platz, dann der Himmel.',
    drone: false,
    speech: 'Phase eins von fünf. Ort und Sicherheit. Drei Minuten. Such dir einen Platz, an dem du sein darfst und den Himmel siehst. Sag einer Person, wo du bist. Setz dich. Stell dich nicht an eine Straße. Einen Laser lässt du stecken. Wenn du sitzt, lass die drei Minuten laufen. Ich sage Bescheid, wenn es weitergeht.',
    paragraphs: [
      'CE5 ist ein Versuch, Kontakt bewusst zu beginnen, nicht ein Unfall am Nachthimmel. Die öffentliche Form der Übung kommt von Steven Greer und CSETI. Sie verspricht nichts. Sie gibt der Beobachtung einen Rahmen: ruhiger Körper, eine klare Absicht, dann nur noch schauen und aufschreiben.',
      'Such dir einen Ort, an dem du legal bist und den Himmel siehst. Sag einer Person, wo du bist. Stell dich nicht an eine Straße, nicht auf ein Gleis, nicht an einen Flugplatzzaun. Setz dich, bevor die Augen dunkeladaptiert sind.',
      'Schalte diese App auf Rot, wenn du die Nachtsehschärfe behalten willst. Einen Laser lässt du stecken. Einen Laser auf ein Luftfahrzeug zu richten ist in Deutschland strafbar, und diese App leitet das nicht an.',
    ],
  },
  {
    id: 'kohaerenz',
    title: 'Kohärente Absicht',
    minutes: 8,
    lead: 'Ein Satz, kein Wunschkonzert.',
    drone: true,
    speech: 'Phase zwei. Kohärente Absicht. Acht Minuten. Sitz bequem und spür den Boden. Atme so, dass der Bauch mitgeht. Der Satz, nur innerlich: Kontakt in Frieden, ohne Schaden, in Klarheit. Wenn der Kopf abschweift, komm zu dem Satz zurück. Es ist eine Einladung, keine Forderung. Wenn Angst kommt, brich ab und geh nach Hause. Ein leiser Ton kann jetzt mitlaufen, wenn du ihn angeschaltet hast. Er ist für dich, kein Signal an den Himmel.',
    paragraphs: [
      'Der Kern der Übung ist kein Trick. Es ist ein ruhiger, wiederholter innerer Zustand. Greer nennt das kohärentes Denken: wenig inneres Geplapper, eine friedliche Absicht, die sich nicht in Aufregung zerlegt. Ein leiser Ton aus dieser App ist nur eine Stütze für dich. Er ist kein Signal.',
      'Sitz bequem. Spür den Boden unter dir. Atme so, dass der Bauch mitgeht, ohne die Atmung zu zählen wie eine Aufgabe. Wenn der Kopf in den Tag zurückläuft, komm zu einem Satz zurück und sag ihn nur innerlich: Kontakt in Frieden, ohne Schaden, in Klarheit.',
      'Halt den Satz leicht. Es ist eine Einladung, keine Forderung und keine Beschwörung. Wenn Angst aufkommt, brich ab und geh nach Hause. Eine Sitzung, die du abbrichst, ist eine richtige Sitzung.',
    ],
  },
  {
    id: 'einladung',
    title: 'Einladung',
    minutes: 5,
    lead: 'Eine Richtung, dann die Augen auf.',
    drone: true,
    speech: 'Phase drei. Einladung. Fünf Minuten. Halt innerlich eine offene Richtung, vom Zenit oder aus einer Himmelsrichtung. Du befiehlst nichts. Dann lass das Bild los und öffne die Augen. Was zählt, ist der echte Himmel.',
    paragraphs: [
      'In der öffentlichen CE5-Beschreibung folgt auf die Stille eine einfache Vorstellung: ein offener Weg am Himmel, aus einer Himmelsrichtung oder vom Zenit. Du befiehlst nichts. Du hältst die Richtung einen Moment, dann lässt du das Bild los.',
      'Wenn ihr zu mehreren seid, spricht eine Person die Richtung leise aus. Alle anderen bleiben still. Danach wird nicht weiter geredet und nichts erklärt, solange die Wache läuft.',
      'Öffne die Augen. Der interessante Teil ist nicht die Vorstellung. Es ist das, was danach am echten Himmel steht, und das, was nicht da ist.',
    ],
  },
  {
    id: 'wache',
    title: 'Stille Wache',
    minutes: 15,
    lead: 'Schauen, stempeln, nicht hinterherrennen.',
    drone: false,
    speech: 'Phase vier. Stille Wache. Fünfzehn Minuten. Ich bleibe jetzt still, damit du den Himmel hörst. Lass den Blick langsam wandern. Was blinkt und geradeaus zieht, ist meist ein Flugzeug. Ein Punkt, der gleichmäßig läuft und dann erlischt, ist oft ein Satellit. Eine Kette von Lichtern ist oft ein Starlink-Zug. Venus und Jupiter stehen still und sind sehr hell. Wenn etwas übrig bleibt, tipp auf Sichtung. Lauf dem Licht nicht hinterher. Ein leerer Himmel ist ein Ergebnis.',
    paragraphs: [
      'Lass den Blick langsam wandern. Ein Objekt, das blinkt und Kurs auf eine Einflugschneise hält, ist meist ein Flugzeug. Ein Punkt, der gleichmäßig zieht und dann einfach erlischt, ist oft ein Satellit, der in den Erdschatten läuft. Eine Perlenkette ist oft ein Starlink-Zug. Venus und Jupiter stehen still und sind absurd hell.',
      'Wenn etwas übrig bleibt, tipp auf Sichtung. Der Zeitpunkt und der Ort werden sofort gespeichert. Die Beschreibung kann danach kommen. Lauf dem Licht nicht hinterher und fahr ihm nicht nach.',
      'Auch ein leerer Himmel wird am Ende notiert. Eine Sitzung ohne Objekt ist ein Ergebnis, kein Fehlschlag.',
    ],
  },
  {
    id: 'abschluss',
    title: 'Abschluss',
    minutes: 4,
    lead: 'Runterkommen und aufschreiben, solange es frisch ist.',
    drone: false,
    speech: 'Phase fünf. Abschluss. Vier Minuten. Beende die Absicht so schlicht, wie du sie begonnen hast. Spür den Stuhl unter dir. Schreib jetzt, was du gesehen hast, und ebenso, was nicht da war. Richtung, Höhe, Dauer, ob es blinkte, ob es geradeaus zog. Die Sitzung endet mit dieser Phase.',
    paragraphs: [
      'Beende die Absicht so schlicht, wie du sie angefangen hast. Spür wieder den Stuhl, nenn innerlich den Ort, an dem du sitzt, und mach das Licht erst dann heller, wenn du gehen kannst, ohne zu stolpern.',
      'Schreib sofort, was du gesehen hast, und ebenso, was du nicht gesehen hast. Richtung, Höhe, Dauer, ob es blinkte, ob es geradeaus zog. Die App hat den Stempel. Die Worte musst du noch selbst setzen.',
      'Eine Meldung an eine Forschungsstelle ist ein zweiter Schritt. Horizont schickt nichts von allein weg. Fotos und Koordinaten bleiben auf diesem Gerät, bis du sie exportierst.',
    ],
  },
];

export function phaseSeconds(phase) {
  return phase.minutes * 60;
}

export function protocolMinutes() {
  return PHASES.reduce((sum, phase) => sum + phase.minutes, 0);
}

export function createSession(partial = {}, now = Date.now()) {
  return {
    id: partial.id || createId(),
    startedAt: partial.startedAt ?? now,
    endedAt: partial.endedAt ?? null,
    lat: Number.isFinite(partial.lat) ? partial.lat : null,
    lon: Number.isFinite(partial.lon) ? partial.lon : null,
    accuracy: Number.isFinite(partial.accuracy) ? partial.accuracy : null,
    phaseIndex: Number.isInteger(partial.phaseIndex) ? partial.phaseIndex : 0,
    phaseStartedAt: partial.phaseStartedAt ?? now,
    pausedAt: partial.pausedAt ?? null,
    pausedMs: Number.isFinite(partial.pausedMs) ? partial.pausedMs : 0,
    notes: typeof partial.notes === 'string' ? partial.notes : '',
    sightingIds: Array.isArray(partial.sightingIds) ? partial.sightingIds.filter((id) => typeof id === 'string') : [],
    completed: Boolean(partial.completed),
    emptySky: Boolean(partial.emptySky),
  };
}

export function phaseRemainingMs(session, now = Date.now()) {
  const phase = PHASES[session.phaseIndex] || PHASES[0];
  const paused = session.pausedAt ? now - session.pausedAt : 0;
  const elapsed = now - session.phaseStartedAt - session.pausedMs - paused;
  return phaseSeconds(phase) * 1000 - elapsed;
}

export function phaseDue(session, now = Date.now()) {
  return Boolean(session) && !session.completed && !session.pausedAt && phaseRemainingMs(session, now) <= 0;
}

export const BRIDGE_SPEECH = 'Die Zeit dieser Phase ist um.';
export const CLOSING_SPEECH = 'Die Sitzung ist zu. Wenn etwas offen ist, schreib es jetzt. Ein leerer Himmel darf so stehen bleiben.';
