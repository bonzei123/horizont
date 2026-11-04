# Horizont

Feldapp für UAP-Beobachtungen. HTML, CSS und JavaScript, ohne Konto und ohne Server. Standort, Himmel, CE5-Sitzung und Sichtungen bleiben in diesem Browser. Dieselbe gebaute Seite läuft lokal und auf GitHub Pages.

## Lokal

Node.js 20 oder neuer.

```bash
npm install
npm run dev
```

Die App liegt auf [http://127.0.0.1:43123](http://127.0.0.1:43123). Der Browser fragt nach dem Standort. Ohne Erlaubnis kannst du Koordinaten von Hand eintragen.

## Statisch bauen

```bash
npm test
npm run build
npm run preview
```

`dist/` ist die ganze App. Die Pfade sind relativ und funktionieren auf einer Unterseite wie `username.github.io/repo`.

## GitHub Pages

1. Das Repo auf GitHub legen.
2. Unter Settings → Pages als Quelle **GitHub Actions** wählen.
3. Ein Push auf `main` startet [`.github/workflows/pages.yml`](.github/workflows/pages.yml).

GPS funktioniert auf GitHub Pages, weil die Seite über HTTPS ausgeliefert wird. Lokal funktioniert es über `localhost`.

## Was drin ist

- Lage für heute Nacht: ob sich der Weg lohnt, Mond, Wolken, Kälte, Sternschnuppen, naher ISS-Pass
- Almanach: Top der Woche und Neueste aus den großen UAP-Subreddits, Presse, dazu Tage, Wellen, Stellen, Regal und Sensoren
- Handbuch: Begriffe, Gestalten aus der Literatur, Entführungsberichte, eine Chronik der oft genannten Fälle, dazu Einsatz, Zuständigkeit, Packliste und Gerät
- Laufende GPS-Koordinaten, Genauigkeit und Kopieren
- Himmel an diesem Ort: Sonne, Dämmerung, Mondphase, helle Planeten und helle Sterne zum Vergleich, dazu der Polarstern
- Laufende Sternschnuppenströme und ein Link für Feuerkugeln an den Arbeitskreis Meteore
- Wolken, Sicht und Wind, wenn Open-Meteo erreichbar ist, inklusive der Richtung, in die ein Ballon zieht
- 20 Minuten Dunkeladaption, unabhängig von einer Sitzung
- Aktuelle ISS-Lage, wenn `wheretheiss.at` erreichbar ist
- Flugzeuge in etwa 90 km über ADS-B, und die hellere Satellitengruppe von Celestrak, beide zur Stempelzeit in der Meldung
- Kompass, falls das Gerät einen hat
- Sichtung stempeln: Zeitpunkt und Ort sofort, Beschreibung danach, weitere Punkte auf derselben Meldung
- Bericht zum Kopieren mit UTC, Ende der Sichtung, Zeugen, eigener Bewegung, Geruch, Umgebung und Schallverzögerung
- Dauer aus der Uhr der Meldung, und eine Zeile, was fürs Weitergeben noch fehlt
- Skizze auf dem Gerät, Winkeländerung zwischen dem ersten und dem letzten Punkt
- Himmel antippen für Richtung und Höhe, Helligkeit gegen Bekannte, Größe auf Armlänge
- Sprachmemo an der Meldung, nur auf diesem Gerät
- Feste Plätze mit gemerkten Koordinaten
- Nächster ISS-Pass und Wolken bis zur astronomischen Nacht
- Leerer Himmel als Ergebnis einer Sitzung
- Richtungspfeil auf der eigenen Karte
- Helle Körper am Himmel, dazu Flugzeuge per ADS-B und die Celestrak-Gruppe visual, beides als Kandidat in der Meldung
- CE5-Sitzung in fünf Phasen, etwa 35 Minuten, mit ruhiger Stimme, die weiterführt, Pause und eigenem Stempel
- Ruheton in Phase zwei und drei, Ausgabe wählbar, soweit der Browser das kann
- Optionaler Dog Whistle, zu Beginn aus, nur in Phase zwei und drei
- Rotlicht für die Nachtsehschärfe, dazu Nacht- und Tagdarstellung
- Karte der eigenen Punkte
- Export und Import als JSON

Der Almanach holt beim Bauen die Feeds nach `public/news.json`: die Woche und die neuesten Beiträge aus r/UFOs, r/aliens, r/HighStrangeness, r/UAP, r/UFOscience, r/ufo und r/Experiencers, dazu Presse zu UAP. Auf dem NAS liest „Neu laden“ die Subreddits zusätzlich live über den nginx-Proxy `/api/feed/`. GitHub Pages zeigt den Stand vom letzten Build. Die Beiträge bleiben fremde Links. Die App prüft sie nicht.

Flugzeuge kommen live von `api.adsb.lol` über `/api/adsb/`. Die hellere Satellitengruppe kommt von Celestrak über `/api/tle/visual`, und wenn der Dienst nicht antwortet, aus `tle-visual.txt` vom letzten Build. Flugzeuge gibt es lokal und im NAS-Container. GitHub Pages hat keinen Proxy, dort bleibt die Flugzeugzeile leer. Die Zeile in der Meldung ist der Stand im Moment des Stempels. Ein Treffer in der Blickrichtung bleibt ein Kandidat.

Fotos, Skizzen und Sprachmemos bleiben im Browser und kommen im JSON-Export nicht mit. Der kopierte Bericht ist der Text für eine Meldestelle oder ein Forum. Die App schickt ihn nicht selbst ab. Eine Meldung an die [GEP](https://www.uap-research.org/ufo-uap-meldestelle/) schickt die App nicht selbst ab. Der Link liegt in der Meldung.

CE5 ist hier der öffentlich beschriebene Übungsrahmen: ruhige Absicht, stille Beobachtung, Protokoll. Die Führung spricht mit einer langsamen Stimme, die in der App liegt (Thorsten Müller, [Thorsten-Voice](https://www.thorsten-voice.de/), Daten unter CC0). Sie folgt der gewählten Ausgabe. Fehlt die Datei, spricht die Systemstimme. Der Ruheton ist eine leise Stütze und kein Signal, und er ist nicht die kommerzielle CSETI-Tonfolge. Der Dog Whistle ist ein zusätzlicher Schalter und zu Beginn aus. Er spielt denselben öffentlichen Stapel, den mehrere JavaScript-Beispiele erzeugen: 100 Hz mit 7,83 Hz, 432 Hz, 528 Hz, kurze Töne bei 2,5 kHz und leise Pings bei 17 kHz. Die Übung braucht ihn nicht, und die App behauptet nicht, dass er etwas am Himmel bewirkt. Laser gehören nicht dazu. Einen Laser auf ein Luftfahrzeug zu richten ist in Deutschland strafbar.

Bluetooth-Kopfhörer oder -lautsprecher zuerst im Gerät koppeln. Die Seite kann kein Gerät paaren. Wo der Browser es erlaubt, wählt „Ausgabe wählen“ die schon gekoppelte Quelle. Die ruhige Stimme und die Töne laufen darüber. Den Bildschirm während der Führung anlassen, sonst stoppt das Telefon die Wiedergabe oft mit dem Sperren.

## Auf einem NAS mit Docker

Die ZIP brauchst du nur, wenn auf dem NAS kein Git liegt. Einmal klonen, danach reicht ein Pull. Die App bleibt statisch. Der Container ist nginx mit dem gebauten `dist/`.

```bash
cd /volume1/docker
git clone https://github.com/bonzei123/horizont.git
cd horizont
sudo docker compose up -d --build
```

Update, ohne neues Archiv:

```bash
cd /volume1/docker/horizont
git pull --ff-only
sudo docker compose up -d --build
```

Dieselbe Folge steht in `deploy/update.sh`. In der Aufgabenplanung der Synology kann sie als root laufen. Danach liegt die Seite auf Port 7777 des NAS. Der Container selbst hört intern auf 8080.

GPS funktioniert im Browser nur über HTTPS. `http://` auf die NAS-Adresse, auch durch ein VPN, ist für den Browser unsicher, und er verweigert den Standort. Ein selbst signiertes Zertifikat zählt erst, wenn das Telefon es als vertrauenswürdig gespeichert hat und die Adresse genau zum Namen im Zertifikat passt. In der Systemsteuerung unter Anmeldeportal, Erweitert, Reverse Proxy die Quelle auf HTTPS legen, zum Beispiel `horizont.bonzei.eu` auf Port 443, und das Ziel auf `http://127.0.0.1:7777`. Ohne Zertifikat bleiben die Koordinaten von Hand eintragbar.

Im Vodafone-Netz zu Hause geht `horizont.bonzei.eu` oft nicht auf. Der Anschluss gibt eine Adresse, die auf die eigene öffentliche IP zeigt, nicht zurück ins Haus. Im Handynetz kommt der Weg von außen, dort geht die Seite auf. Der Reverse Proxy bleibt dabei laufen. Wer den Namen auch zu Hause im Browser haben will, legt lokal einen DNS-Eintrag an: `horizont.bonzei.eu` zeigt auf die LAN-Adresse des NAS.

Die geführte Sitzung startet auch über `http`. Vorher ist der Start dort abgebrochen, weil der Browser ohne Zertifikat `crypto.randomUUID` verweigert und die Sitzung keine Kennung bekam. Stimme und Uhr laufen danach. Das Wachhalten des Bildschirms bleibt an HTTPS gebunden, deshalb den Bildschirm anlassen.
