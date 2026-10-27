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

Beim App-Start werden vorhandene lokale Daten geladen; es werden keine
Demo-Daten angelegt. Bekannte alte Demo-Typen und Test-Assets sowie ungenutzte
Test-Standorte werden einmalig entfernt. Die Asset-Liste liest direkt aus dem
reaktiven Store und zeigt deshalb auch Daten an, die nach dem ersten Seitenaufbau
geladen werden.

## Standorte und Karte

Standorte können als **Punkt**, **Raum** (mindestens drei Eckpunkte) oder
**Leitung** (mindestens zwei Wegpunkte) erfasst werden. Koordinaten sind optional
und können später ergänzt werden; sobald Koordinaten eingetragen werden, müssen
Punkte vollständig sein und Räume bzw. Leitungen ihre Mindestanzahl erfüllen.
Die Koordinaten lassen sich manuell eingeben, über die Standortfreigabe des Browsers übernehmen oder
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
Die Standort-ID wird beim Anlegen automatisch aus dem Namen gebildet; bei
Namensgleichheit wird eine freie Nummer angehängt. Ein übergeordneter Standort
kann aus den vorhandenen Standorten ausgewählt werden. Der eigene Standort und
seine Unterstandorte stehen dabei nicht zur Auswahl, damit keine
Selbstzuordnungen oder Zyklen entstehen.

## Schreibmodus

Assets, Typen und Standorte können nur im aktivierten Schreibmodus angelegt,
geändert oder gelöscht werden. Im Read-Only-Modus werden Details als Text
angezeigt statt als scheinbar editierbare Felder; bei Typen öffnet **Details
ansehen** die Feld- und Blockdefinitionen, bei Standorten die Identität, Art
und Koordinaten. Verwaltungsaktionen sind ausgeblendet. Zum Bearbeiten zuerst
oben in der App **Bearbeiten** aktivieren und anschließend bei Standorten oder
Typen den jeweiligen Bearbeiten-Schalter verwenden; Änderungen erfolgen im
Edit-Branch und werden erst mit **Sync** ins Git-Repository übertragen. Beim
Neuladen wird eine aktive Edit-Sitzung im selben Tab fortgesetzt. Erst nach
**Sync** oder **Verwerfen** kehrt die App in den Read-Only-Modus auf `main`
zurück. Ein neu gestarteter Edit-Modus erhält weiterhin einen eigenen Branch.

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
werden in der `.asset`-Datei gespeichert. **Kommazahl** erlaubt Werte mit
Nachkommastellen. **Bild** nimmt ein einzelnes Foto auf; **Mehrere Bilder**
ermöglicht mehrere Fotos, zum Beispiel zur Dokumentation eines Mangels. Die
Bilddateien werden über den vorhandenen Git-LFS-Workflow gespeichert.
Ungespeicherte Eingaben in Asset-, Typ- und Standortformularen werden lokal im
Browser als Entwurf gesichert und nach einem Neuladen wiederhergestellt.
Ausgewählte Bilder eines neuen Assets liegen dafür vorübergehend in IndexedDB;
nach erfolgreichem Speichern oder Abbrechen wird der Entwurf gelöscht. Die
Wiederherstellung gilt für dasselbe Browserprofil und setzt voraus, dass der
Browser seinen lokalen Speicher nicht entfernt.

Wiederverwendbare Komponenten wie Anschlüsse werden separat auf der Seite
**Typen** definiert; ihre Felder liegen in `.comp`-Dateien. Ein Asset-Typ
verweist im Typeditor nur auf eine vorhandene Komponente und legt deren
Mindest- und Höchstanzahl fest. Typen können für Komponentenfelder zusätzlich
feste Werte vorgeben, etwa `HDMI` für den Anschlusstyp aller Ports eines
HDMI-Kabels. Diese Felder werden pro Asset-Instanz vorbelegt und sind dort
schreibgeschützt; nicht festgelegte Komponentenfelder bleiben am Asset
bearbeitbar. Die übrigen Felder werden ausschließlich an der Komponente
gepflegt, erscheinen bei Assets als wiederholbare Gruppen und werden in der
`.asset`-Datei abgelegt. Der Feldtyp **Asset-Referenz** zeigt
Assets der angegebenen kompatiblen Typen einschließlich ihrer Untertypen zur
Auswahl an; ohne Typ-Einschränkung stehen alle Assets zur Verfügung.

Jedes Asset erhält unabhängig von seinem Typ eine erforderliche **Bezeichnung**.
Sie wird in der Asset-Übersicht anstelle der technischen ID angezeigt; Assets
aus älteren Repositories ohne Bezeichnung sind dort als „Ohne Bezeichnung“
markiert, bis ein Name eingetragen wird. Die Spalten Bezeichnung, Typ,
Standort und Änderungsdatum besitzen Filter: Im Spaltenkopf lassen sich die
vorhandenen Werte einzeln ein- oder ausblenden. Der Standortfilter bildet die
Standorthierarchie ab: **Auswahl leeren** und anschließend etwa „Haus 1“
auswählen, um Assets aus dem Haus und allen darunterliegenden Räumen zu sehen.
Über das Suchfeld lassen sich Assets außerdem anhand der Bezeichnung, des Typs,
des Standorts und gespeicherter Gerätedaten wie Hersteller, Modell oder
Seriennummer finden.

## Entwicklung

### Setup

```bash
# Komplette Umgebung starten (Dev-Server + Gitea)
docker compose up
```

Die App ist unter `http://localhost:3000` erreichbar. Gitea auf `http://localhost:8929`.
Der lokale Nginx-Proxy vor Gitea erlaubt die browserseitigen Git-LFS-`PUT`-
Anfragen. Diese offene CORS-Konfiguration ist nur für die lokale Entwicklung
gedacht; öffentlich erreichbare Instanzen müssen den App-Origin gezielt
freigeben.

### Lokales Asset-Repository

Beim Start legt der Service `gitea-init` in Gitea automatisch das öffentliche
Repository `admin/ZeugDB` an und befüllt es mit der minimal nötigen Struktur.
Falls Gitea bereits läuft, lässt sich die idempotente Initialisierung erneut
ausführen:

```bash
docker compose up -d gitserver gitserver-proxy
docker compose run --rm gitea-init
```

Öffne anschließend in der App **Einstellungen**. Die Repository-URL wird
standardmäßig aus dem Hostnamen der App gebildet:
`http://<hostname>:8929/admin/ZeugDB`. Bei `http://localhost:3000` ist das
`http://localhost:8929/admin/ZeugDB`. Verwende einen Gitea-Benutzernamen und
einen persönlichen Zugriffstoken mit Repository-Lese-/Schreibrechten und
wähle **Klonen**. Danach können Assets, Typen und Standorte lokal bearbeitet
und über **Sync** ins Repository übertragen werden.

Fotos lassen sich auf Mobilgeräten über **Foto aufnehmen oder auswählen**
direkt mit der Kamera erfassen. Dabei ist kein manuelles Speichern oder
Auswählen einer zuvor abgelegten Datei erforderlich. Bis zur Synchronisierung
bleibt das Bild lokal im Browser (IndexedDB) zwischengespeichert; **Sync**
überträgt es anschließend als Git-LFS-Objekt. Für eigene Gitea-Server muss der
Reverse Proxy zusätzlich Cross-Origin-`PUT`-Anfragen und die Header
`Authorization`, `Content-Type` und `Transfer-Encoding` erlauben.

Die benötigte Repo-Struktur und Dateiformate sind in
[`gitea/repo-template/REPO_SETUP.md`](gitea/repo-template/REPO_SETUP.md)
dokumentiert. Minimale Repos benötigen die Verzeichnisse `assets/`, `types/`
und `locations/`; die enthaltenen README-Dateien halten diese Verzeichnisse
beim Anlegen des Repos verfügbar. Die Beispiel-`.type`-Dateien zeigen das
Format für Typdefinitionen. Die App erzeugt Asset- und Standortdateien selbst.

Die in Docker Compose voreingestellten Zugangsdaten sind ausschließlich für
die lokale Entwicklungsumgebung gedacht und dürfen nicht für öffentlich
erreichbare Gitea-Instanzen verwendet werden. Zugangstoken gehören nur in die
App-Einstellungen, niemals in Git-Dateien.

Gitea erlaubt im lokalen Compose-Setup Browserzugriffe auf Git Smart HTTP von
anderen Origins, damit die statische App Git über HTTP(S) verwenden kann. Dafür
setzt Compose Giteas repository-spezifische `ACCESS_CONTROL_ALLOW_ORIGIN`-Regel;
die allgemeine `[cors]`-Konfiguration allein reicht für Git-Zugriffe nicht aus.
Standardmäßig ist die Origin-Regel offen (`*`). Die App authentifiziert
Git-Zugriffe mit einem persönlichen Token statt mit Cookies. Für erreichbare
Installationen sollte `GITEA_CORS_ALLOW_DOMAIN` auf genau die vertrauenswürdige
App-Origin beschränkt werden (z. B. `https://inventar.example.org`) und Gitea
anschließend neu erstellt werden:
`docker compose up -d --force-recreate gitserver`.

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
serviert ausschließlich statische Dateien — kein Node.js, kein Backend. Für
Offline-Nutzung auf LAN-Geräten den HTTPS-Endpunkt nutzen.

### Offline-Nutzung auf Client-Geräten

Service Worker funktionieren nur in sicheren Browser-Kontexten: HTTPS oder
`localhost` auf demselben Gerät. `http://<LAN-IP>:8080` ist kein sicherer
Kontext. Auf dieser Adresse kann die App online aussehen, aber der Browser kann
keine Offline-Navigation und keine installierbare PWA bereitstellen. Die
`offline-https`-Compose-Services stellen dafür lokale HTTPS-Endpunkte mit einer
Caddy-CA bereit.

Für den Zugriff von Smartphone oder anderem LAN-Gerät:

1. Setze im nicht eingecheckten `.env`-File die IP-Adresse des Docker-Hosts:

   ```dotenv
   APP_HOST=10.53.0.32
   ```

2. Starte die statische App und die HTTPS-Endpunkte:

   ```bash
   docker compose up -d --build production offline-https gitserver-proxy
   ```

   App: `https://<APP_HOST>:8443`; Git/LFS: `https://<APP_HOST>:9443`.
   Die alte HTTP-Adresse auf Port 8080 bleibt für Tests erreichbar, ist aber
   nicht für Offline-Nutzung von einem anderen Gerät geeignet.

3. Exportiere das **öffentliche** lokale CA-Zertifikat. Unter Windows
   PowerShell:

   ```powershell
   docker compose cp offline-https:/data/caddy/pki/authorities/local/root.crt "$env:TEMP\zeugdb-local-root.crt"
   ```

   Übertrage `zeugdb-local-root.crt` auf das Smartphone und installiere es als
   CA-/Benutzerzertifikat in den Sicherheitseinstellungen. Nur das öffentliche
   Zertifikat wird exportiert; der private CA-Schlüssel bleibt im Docker-Volume
   `caddy_data`. Lösche die Zertifikatsdatei nach dem Installieren wieder.

4. Öffne Chrome neu und lade `https://<APP_HOST>:8443` online. Bestätige, dass
   die Seite ohne Zertifikatswarnung lädt; so kann der Service Worker die App
   und alle SvelteKit-Routenmodule cachen. In **Einstellungen** sollte die
   Git-URL automatisch `https://<APP_HOST>:9443/admin/ZeugDB` verwenden.
   Klone das Repo auf diesem HTTPS-Ursprung, falls es dort noch nicht
   initialisiert ist.

Jeder Ursprung hat einen eigenen Browser-Speicher. Daten, die bisher unter
`http://<APP_HOST>:8080` angelegt und noch nicht synchronisiert wurden, müssen
vor dem Wechsel online synchronisiert werden. Die IndexedDB-Daten des alten
HTTP-Ursprungs werden durch den Wechsel nicht gelöscht oder automatisch
übertragen.

Danach können Assets, Typen und Standorte auch ohne WLAN lokal angelegt,
bearbeitet und gespeichert werden. Fotos bleiben bis zum nächsten Online-Sync
in IndexedDB vorgemerkt; **Sync**, **Holen**, Git/LFS-Upload und erstmaliges
Herunterladen eines LFS-Fotos benötigen weiterhin eine Verbindung zum
Git-Server. Bereits geladene Fotos und Kartenausschnitte bleiben lokal
verfügbar. Zum Installieren der PWA muss die HTTPS-Adresse ohne Zertifikats-
warnung geöffnet sein.

Der Offline-Test muss gegen die Produktionsausgabe laufen. `docker compose up`
startet den Vite-Entwicklungsserver auf Port 3000; dort ist der Service Worker
absichtlich deaktiviert, damit keine veralteten HMR-Module gecacht werden.
Lokal auf demselben Rechner kannst du `http://localhost:8080` nutzen, da
`localhost` als sicherer Browser-Kontext gilt. Auf Smartphone/LAN immer den
vertrauenswürdigen HTTPS-Endpunkt verwenden.

### Karte

`src/lib/map/Karte.svelte` nimmt `locations`, `selectedId` und optional
`onLocationSelect` als Props entgegen. Punkt-Locations verwenden `lat`/`lon`,
Flächen und Routen verwenden Arrays aus `{ lat, lon }`-Punkten in `polygon`
bzw. `route`. Die Daten werden als `.location`-Dateien im Git-Repository
gespeichert. Einzelne Asset-Standorte werden dort als Punkt angelegt und dem
Asset über das Standortfeld zugewiesen. Die zuletzt angezeigte Kartenposition
wird lokal gespeichert und beim nächsten Öffnen wiederhergestellt. Der
Koordinaten-Picker verwendet diesen Ausschnitt auch für den nächsten neu zu
setzenden Punkt, statt wieder mit der Standardansicht zu starten.
OpenStreetMap-Kacheln benötigen eine Verbindung beim ersten Aufruf. Der Service
Worker speichert nur tatsächlich angeforderte Kacheln, beachtet deren
HTTP-Cache-Fristen und begrenzt den Cache auf 1.200 Einträge. Nicht zuvor
geladene Kartenausschnitte stehen offline nicht als Hintergrundkarte zur
Verfügung.

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

### GitHub Pages mit lokalem Gitea-Datenspeicher

Der Workflow `.github/workflows/deploy-pages.yml` baut und veröffentlicht die App
bei jedem Push auf `main` automatisch unter
`https://<konto>.github.io/<repository>/`. Im GitHub-Repository muss unter
**Settings → Pages → Build and deployment → Source** `GitHub Actions` ausgewählt
sein. Der Workflow setzt den Repository-Unterpfad für den Build selbst.

GitHub Pages liefert nur die App-Oberfläche aus; Assets, Typen, Standorte und
Bilder bleiben im lokalen Gitea-Repository. In den App-Einstellungen muss als
Git-URL die LAN-Adresse des Docker-Hosts stehen, z. B.
`http://192.168.1.24:8929/admin/ZeugDB`. Der Browser des Handys muss mit demselben
LAN verbunden sein. Setze in der Projekt-`.env` außerdem
`GITEA_ROOT_URL=http://192.168.1.24:8929/`, damit von Gitea zurückgegebene
Git-LFS-URLs ebenfalls auf den Docker-Host zeigen. Starte Gitea danach neu:

```bash
docker compose up -d --force-recreate gitserver gitserver-proxy
```

Die Git-/LFS-Anfragen sind Cross-Origin-Anfragen. Der lokale Proxy erlaubt sie
für den Browserzugriff; in Chrome muss beim ersten Git-Zugriff gegebenenfalls
die Berechtigung „Lokales Netzwerk“ für die GitHub-Pages-Site erteilt werden.
Diese Chrome-Funktion benötigt eine aktuelle Version. Andere Browser können
HTTP-Zugriffe von einer HTTPS-Seite auf eine LAN-Adresse blockieren; in diesem
Fall ist für Gitea ein browserseitig vertrauenswürdiger HTTPS-Endpunkt nötig.
GitHub Pages selbst läuft über öffentlich vertrauenswürdiges HTTPS und benötigt
kein manuell installiertes Zertifikat.

Die App speichert Änderungen weiterhin lokal im Browser, wenn sie offline ist.
Gitea-Sync und noch nicht heruntergeladene LFS-Bilder benötigen eine Verbindung
zum lokalen Netzwerk. GitHub Pages ist kein Ersatz für den Git-Datenspeicher.

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
│   ├── service-worker.js # Service Worker mit Offline-Cache für alle Routen
│   └── app.html          # PWA-Manifest
└── static/               # PWA-Assets (manifest.json, Kachelcache-Helfer, Icons)
```

## Tests

```bash
docker compose run --rm app npm test
```

Alle Tests folgen Test-Driven Development: Tests vor Implementierung,
isolierte Unit-Tests pro Modul.
