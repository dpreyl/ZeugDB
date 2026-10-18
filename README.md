# ZeugDB

Offline-fähige Inventar-Verwaltung als Progressive Web App (PWA).

## Architektur

- **SvelteKit 5** + TailwindCSS als Frontend-Framework
- **adapter-static** — die App wird als statische Site exportiert (keine SSR)
- **sql.js** — SQLite im Browser (IndexedDB als Persistenz)
- **isomorphic-git** — Git-Sync direkt im Browser
- **Service Worker** — Offline-Caching der App-Assets
- **localStorage** — Persistenz von Asset-Daten zwischen Sessions

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
3. Danach ist die App auch ohne Server-Verbindung nutzbar, solange der
   Browser die IndexedDB-Daten behält
4. Für Updates: einmalig mit dem Server verbinden, dann wird die neue
   Version geladen

### Statische Dateien manuell verteilen

```bash
# Build generieren
docker compose run --rm app npm run build
```

Der Ordner `build/` enthält die komplette statische App (index.html, JS,
CSS, Service Worker). Einen beliebigen HTTP-Server davor schalten:

```bash
# nginx, caddy, oder ein einfacher HTTP-Server
cd build && npx serve . -l 8080
```

**Wichtig:** Die App braucht einen HTTP-Server (nicht `file://`), da ES-Module
und Service Worker nur über HTTP funktionieren.

## Projektstruktur

```
├── docker-compose.yml    # Dev + Prod Services
├── Dockerfile            # Production (nginx)
├── Dockerfile.dev        # Entwicklung (Node + Vite)
├── gitea/                # Gitea-Konfiguration
├── src/
│   ├── lib/
│   │   ├── parser/       # .asset / .type / .comp Parser
│   │   ├── db/           # sql.js Schema + Abfragen
│   │   ├── stores/       # Svelte 5 reaktive Stores
│   │   ├── services/     # Service-Schicht (DB + Store Brücke)
│   │   ├── git/          # isomorphic-git Integration
│   │   └── fs/           # Dateisystem-Abstraktion
│   ├── routes/           # SvelteKit-Seiten
│   └── app.html          # PWA-Manifest + Service Worker
└── static/               # PWA-Assets (manifest.json, sw.js, Icons)
```

## Tests

```bash
docker compose run --rm app npm test
```

Alle Tests folgen Test-Driven Development: Tests vor Implementierung,
isolierte Unit-Tests pro Modul.
