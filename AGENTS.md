# ZeugDB – Umsetzungsvorgaben (verbindlich)

Diese Datei enthält verbindliche Regeln, die bei jeder Implementierungssession gelten.
Keine Ausnahme ohne explizite Genehmigung des Entwicklers.

---

## 1. Test-Driven Development

### Prinzip
Tests schreiben, **bevor** die Implementierung entsteht. Der Test definiert die
Schnittstelle, die Implementation erfüllt ihn.

### Regeln
- **Jede neue Funktion** bekommt mindestens einen Test, der das erwartete
  Verhalten beschreibt (Happy Path + mindestens ein Edge Case).
- **Tests vor Code:** Schreibe den failing-Test zuerst, dann die minimale
  Implementierung, die ihn bestanden lässt (Red → Green → Refactor).
- **Abdeckung:** Jede öffentliche Funktion, jeder Parser, jede Serialisierung
  und jede Konvertierung hat eine Testabdeckung. Ziel: keine toten code paths.
- **Test-Dateien:** Benenne Tests parallel zur Quelle: `src/lib/foo.ts` →
  `src/lib/foo.test.ts`. Nutze `vitest` als Testframework.
- **CI-Gate:** Ein Commit, der Tests bricht, wird nicht gemerged.
- **Snapshot-Tests:** Nutze Snapshots für strukturierte Outputs (z. B. YAML-
  Parsing, Git-Diff-Generierung), um unbeabsichtigte Formatänderungen zu
  erkennen.
- **Unit-Tests isoliert:** Jede Test-Datei testet genau ein Modul. Keine
  Integrationstests in Unit-Tests.

### Framework-Setup
- **vitest** für Unit- und Integrationstests
- **@testing-library/svelte** für Svelte-Komponenten-Tests
- **msw** (Mock Service Worker) zum Mocken von Git-API- und GitHub-API-
  Anfragen in Tests

---

## 2. Kleine Quelldateien

### Prinzip
Eine Quelldatei ist zu groß, wenn man sie nicht mehr komplett im Kopf
halten kann. Das Limit liegt bei **~500 Zeilen pro Datei**.

### Regeln
- **Harte Obergrenze:** Keine Quelldatei überschreitet 500 Zeilen (inklusive
  Kommentare, Leerzeilen, Tests). Überschreitung → Refaktorierung in
  Untermodule.
- **Eine Responsibility pro Datei:** Eine Datei implementiert genau einen
  klar benennbaren Baustein (z. B. `parser.ts` parst, `validator.ts`
  validiert, `writer.ts` schreibt).
- **Keine God-Modules:** Wenn eine Datei mehr als 3 öffentliche Funktionen
  mit unterschiedlicher Semantik hat, ist sie Kandidat für das Aufteilen.
- **Verzeichnisstruktur spiegelt Domäne:** Gruppen zusammengehöriger
  Module in Unterverzeichnissen (`src/lib/git/`, `src/lib/crypto/`,
  `src/lib/sync/`), nicht in flachen Listen.
- **Import-Clutter vermeiden:** Wenn eine Datei mehr als 15 Imports hat,
  ist der Scope wahrscheinlich zu breit.

---

## 3. Docker als einzige Laufzeitumgebung

### Prinzip
Nichts wird lokal auf der Maschine installiert. Alles, was eine externe
Abhängigkeit oder Infrastruktur benötigt, läuft in Docker.

### Regeln
- **Keine globalen npm-Pakete:** Kein `npm install -g`, kein `pnpm add -g`.
  Alle Dependencies leben im `package.json` und werden via `docker run`
  oder `docker compose up` bereitgestellt.
- **Docker Compose als Single Source of Truth:** Die Datei `docker-compose.yml`
  definiert alle Services (App, Git-Server, Datenbank, LFS-Storage).
- **Dockerfile für die App:** Die SvelteKit-App baut in einem eigenen
  Docker-Image. Kein lokaler Node.js auf dem Host nötig.
- **Git-Server in Docker:** Für Entwicklung und Tests läuft ein Git-Server
  (z. B. Gitea oder git-http-backend) im Container.
- **Volumes für Persistenz:** Git-Repos und SQLite-Datenbanken landen auf
  Docker-Volumes, nicht im Host-Dateisystem.
- **Strukturierte Service-Trennung:** Jeder Service hat sein eigenes
  Dockerfile oder Image-Referenz. Kein All-in-One-Image.
- **Port-Konfiguration:** Alle Exposed-Ports sind in `docker-compose.yml`
  dokumentiert und konfliktfrei.

### Entwicklung
- `docker compose up` startet die komplette Entwicklungsumgebung
- Tests laufen via `docker compose run --rm app npm test`
- Lints laufen via `docker compose run --rm app npm run lint`
- Der Developer öffnet `http://localhost:<port>` im Browser

---

## Vererbung

Diese Regeln gelten für **alle** nachfolgenden Dateien, Commits und
Implementierungen in diesem Projekt. Ein AGENT.md in einem Unterverzeichnis
der überschreibt diese Regeln nur für dessen Dateien — eine Lockerung
der Vorgaben erfordert explizite Genehmigung.

---

## Checkliste pro Task

Bevor eine Aufgabe als abgeschlossen gilt:
- [ ] Tests geschrieben und bestanden
- [ ] Keine Datei > 500 Zeilen
- [ ] Docker-Setup funktioniert (`docker compose up`)
- [ ] Keine lokalen Installationen erforderlich
- [ ] Dokumentation aktualisiert

---

*Letzte Änderung: 2025-06-20*
