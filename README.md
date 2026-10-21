# ZeugDB

Offline-fähige Inventar-Verwaltung als Progressive Web App (PWA).

## Architektur

- **SvelteKit 5** + TailwindCSS als Frontend-Framework
- **adapter-static** — die App wird als statische Site exportiert (keine SSR)
- **sql.js** — SQLite im Browser (IndexedDB als Persistenz)
- **isomorphic-git** — Git-Sync direkt im Browser
- **Leaflet** — Kartenkomponente für Punkte, Flächen und Routen
- **Service Worker** — Offline-Caching der App-Assets und angezeigter OSM-Kacheln
- **localStorage** — Persistenz von Asset-Daten zwischen Sessions

## Standorte und Karte

Standorte können als **Punkt**, **Raum** (mindestens drei Eckpunkte) oder
**Leitung** (mindestens zwei Wegpunkte) erfasst werden. Die Koordinaten lassen
sich manuell eingeben, über die Standortfreigabe des Browsers übernehmen oder
für jeden einzelnen Punkt auf der Karte bestimmen. Dabei wird die Karte unter
einer festen Nadel verschoben und der Ausschnitt kann zum präzisen Ausrichten
vergrößert werden; so muss die Nadel bei Touch-Eingabe nicht direkt getroffen
werden. Die Karte zeigt gespeicherte Punkte, Flächen und Leitungsverläufe an.

Für die Kartenhintergründe werden Kacheln von OpenStreetMap geladen. Bereits
angezeigte Kacheln werden entsprechend den HTTP-Cache-Angaben des Kartendienstes
lokal gespeichert (mindestens sieben Tage, wenn keine Angaben vorliegen; maximal
1.200 Kacheln), damit sie bei späteren Offline-Aufrufen verfügbar sein können.
Es werden keine Kartenausschnitte vorab heruntergeladen; der Browser kann den
lokalen Cache jederzeit zugunsten von Speicherplatz leeren. Beim ersten Aufruf eines
Kartenausschnitts ist daher eine Internetverbindung erforderlich. Die
Standortdaten selbst bleiben in der App gespeichert. Die GPS-Funktion benötigt
die Standortfreigabe und einen sicheren Browser-Kontext (HTTPS oder localhost).

## Schreibmodus

Assets, Typen und Standorte können nur im aktivierten Schreibmodus angelegt,
geändert oder gelöscht werden. Im Read-Only-Modus werden Details als Text
angezeigt statt als scheinbar editierbare Felder; bei Typen öffnet **Details
ansehen** die Feld- und Blockdefinitionen, bei Standorten die Identität, Art
und Koordinaten. Verwaltungsaktionen sind ausgeblendet. Zum Bearbeiten zuerst
oben in der App **Bearbeiten** aktivieren und anschließend bei Standorten oder
Typen den jeweiligen Bearbeiten-Schalter verwenden; Änderungen erfolgen im
Edit-Branch und werden erst mit **Sync** ins Git-Repository übertragen.

## Typen verwalten

Asset-Typen werden auf der Seite **Typen** über ein Formular erstellt und
bearbeitet. Felder und wiederholbare Bausteine lassen sich einzeln hinzufügen
und entfernen. Für jedes Feld werden Eingabetyp, Pflichtstatus und
Kennzeichnung sensibler Daten über Auswahlfelder und Schalter festgelegt.
Auswahllisten erhalten ihre Werte als einzelne Einträge; eine manuelle Eingabe
der `.type`-Dateisyntax ist dafür nicht erforderlich. Die Typ-ID wird beim
Anlegen automatisch aus dem Namen erzeugt. Die Felddefinitionen eines Typs
bestimmen die Eingabefelder beim Anlegen und Bearbeiten der zugehörigen Assets;
geerbte Felder werden ebenfalls angezeigt. Werte benutzerdefinierter Felder
werden in der `.asset`-Datei gespeichert.
## Entwicklung

### Setup

```bash
# Komplette Umgebung starten (Dev-Server + Gitea)
docker compose up
```

Die App ist unter `http://localhost:3000` erreichbar. Gitea auf `http://localhost:8929`.

### Tests & Build

```bash
# Tests ausführen
docker compose run --rm app npm test

# Production-Build
docker compose run --rm app npm run build

# Type-Check
docker compose run --rm app npm run check
```

Alle Befehle laufen isoliert im Container — keine lokale Installation nötig.

## Produktion

### Deployment auf dem Server

```bash
# Statisches Image bauen und starten
docker compose up -d production
```

Die App ist unter `http://<server-ip>:8080` erreichbar. Der nginx-Container
serviert ausschließlich statische Dateien — kein Node.js, kein Backend.

### Offline-Nutzung auf Client-Geräten

1. Browser auf `http://<server-ip>:8080` öffnen
2. App wird automatisch gecached (Service Worker)
3. Online angezeigte OpenStreetMap-Kacheln werden ebenfalls gespeichert;
   offline verfügbar sind nur Kacheln, die zuvor geladen wurden
4. Danach ist die App auch ohne Server-Verbindung nutzbar, solange der
   Browser die IndexedDB-Daten behält
5. Für Updates: einmalig mit dem Server verbinden, dann wird die neue
   Version geladen

### Karte

`src/lib/map/Karte.svelte` nimmt `locations`, `selectedId` und optional
`onLocationSelect` als Props entgegen. Punkt-Locations verwenden `lat`/`lon`,
Flächen und Routen verwenden Arrays aus `{ lat, lon }`-Punkten in `polygon`
bzw. `route`. Die Daten werden als `.location`-Dateien im Git-Repository
gespeichert. Einzelne Asset-Standorte werden dort als Punkt angelegt und dem
Asset über das Standortfeld zugewiesen. OpenStreetMap-Kacheln benötigen eine
Verbindung beim ersten Aufruf. Der Service Worker speichert nur tatsächlich
angeforderte Kacheln, beachtet deren HTTP-Cache-Fristen und begrenzt den Cache
auf 1.200 Einträge. Nicht zuvor geladene Kartenausschnitte stehen offline nicht
als Hintergrundkarte zur Verfügung.

### Statische Dateien verteilen (z. B. GitHub Pages)

```bash
# Für GitHub Pages unter https://<konto>.github.io/<repository>:
docker compose run --rm -e BASE_PATH=/repository app npm run build:pages

# Für eine Domain-Root oder einen Host ohne Unterpfad:
docker compose run --rm app npm run build:pages
```

Der Ordner `build/` enthält die fertige statische App und kann direkt als
Deployment-Artefakt hochgeladen werden. Bei GitHub Pages muss `BASE_PATH` exakt
dem Repository-Pfad mit führendem `/` entsprechen (z. B. `/zeugdb`); bei einer
User-/Organization-Site oder eigener Domain am Pfad-Root wird die Variable
weggelassen. `build:pages` erzeugt zusätzlich `404.html` für dynamische
Client-Routen und `.nojekyll`, damit GitHub Pages die `_app`-Dateien nicht
ausfiltert.

Für einen eigenen HTTP-Server genügt der normale Build:

```bash
docker compose run --rm app npm run build
```

Die Ausgabe liegt ebenfalls in `build/`. Sie muss über HTTP/HTTPS bereitgestellt
werden (nicht per `file://`), da ES-Module und Service Worker sonst blockiert
werden. Die Umgebungsvariable `BASE_PATH` kann auch für den normalen Build
gesetzt werden, wenn die App auf einem Unterpfad gehostet wird.

## Projektstruktur

```
├── docker-compose.yml    # Dev + Prod Services
├── Dockerfile            # Production (nginx)
├── Dockerfile.dev        # Entwicklung (Node + Vite)
├── gitea/                # Gitea-Konfiguration
├── src/
│   ├── lib/
│   │   ├── parser/       # .asset / .type / .comp Parser
│   │   ├── map/          # Leaflet-Kartenkomponente und Tests
│   │   ├── db/           # sql.js Schema + Abfragen
│   │   ├── stores/       # Svelte 5 reaktive Stores
│   │   ├── services/     # Service-Schicht (DB + Store Brücke)
│   │   ├── git/          # isomorphic-git Integration
│   │   └── fs/           # Dateisystem-Abstraktion
│   ├── routes/           # SvelteKit-Seiten
│   └── app.html          # PWA-Manifest + Service Worker
└── static/               # PWA-Assets (manifest.json, sw.js, tile-cache.js, Icons)
```

## Tests

```bash
docker compose run --rm app npm test
```

Alle Tests folgen Test-Driven Development: Tests vor Implementierung,
isolierte Unit-Tests pro Modul.
