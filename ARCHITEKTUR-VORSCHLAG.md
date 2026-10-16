# KiA Gerätemanagement – Architektur-Vorschlag

## Projektübersicht

System zur Verwaltung von Geräten, Verkabelungen, Verteilern und Zubehör für **Kirche im Aufbruch**.

| Parameter | Wert |
|---|---|
| Nutzer | ~10 Mitarbeiter |
| Assets | paar hundert Einträge |
| Internet | sehr schlecht – **Offline-first zwingend** |
| Plattform | Browser, keine Installation (PWA) |
| Hosting | kein Self-Hosting, nur SaaS |

---

## Anforderungen (Prio 1 / MVP)

1. **Assets verwalten** – anlegen, bearbeiten, löschen, über Vorlagen gesteuert
2. **Vorlagen anlegen** – konfigurierbare Felder (Text, Zahl, Datum, Dropdown, …)
3. **Standort-Hierarchie** – Organisationen → Standorte → Räume
4. **Verknüpfungen** – Assets miteinander verbinden (z. B. Kabel zwischen Geräten)
5. **Bilder** – Typenschild-Fotos, Zustand-Dokumentation (ab MVP)
6. **Suche / Filter** – nach Inventarnummer, Seriennummer, Raum, Volltext
7. **Offline-Betrieb** – alles funktioniert lokal, Sync wenn Internet verfügbar
8. **Sync mit Konflikt-UI** – bei Konflikten: Side-by-Side Vergleich, manuelle Auflösung pro Feld
9. **Zweistufiger Zugriff** – Standardzugriff (alle Daten) + erweiterter Zugriff (sensible Felder, client-seitig verschlüsselt)
10. **Keine manuellen Schritte außerhalb der PWA** – kein GitHub-Website-Auftritt nötig

### Spätere Stufen (nicht MVP)

- CSV/Excel-Import (existierende Daten)
- Export (CSV, PDF-Inventarliste, Garantie-Übersichten)
- KI-Typenschild-Erkennung
- Garantie-Erinnerungen
- GitHub OAuth-Login (Device Flow) statt manueller PAT-Erstellung

---

## Architektur-Prinzipien

- **Local-first** – jeder Client hat eine vollständige lokale Kopie der Daten
- **Git als Sync-Protokoll** – Dateien im Git-Repo, Sync via push/pull
- **SQLite als lokale Abfrage-Engine** – indizierte Suche, relationale Queries
- **Branch-pro-Edit-Session** – Anzeige auf `main`, Bearbeiten auf eigenem Branch
- **Alles in der PWA** – kein manueller Eingriff auf GitHub nötig

---

## Technologie-Stack

| Schicht | Technologie | Begründung |
|---|---|---|
| Frontend | SvelteKit + TypeScript | Modern, kompiles zu kleinem JS, exzellente PWA-Unterstützung |
| UI-Framework | Svelte + Tailwind CSS | Reaktiv, klein, gut für Formulare und Tabellen |
| Lokale DB | op-sqlite (SQLite Wasm) | Vollwertige SQL-DB im Browser, Indizes, JOINs |
| Git-Client | isomorphic-git | Pure-JS Git im Browser, keine native Abhängigkeit |
| Git LFS | @riboseinc/isogit-lfs | LFS-Upload/Download für Bilder, GitHub-kompatibel, v0.2.0 browser-ready |
| Datei-System | LightningFS (IndexedDB) | Virtuelles FS für isomorphic-git im Browser |
| Sync-Remote | GitHub (SaaS) | Kostenlos, zuverlässig, kein Self-Hosting |
| Verschlüsselung | Web Crypto API | Client-seitige AES-GCM für sensible Felder |
| PWA | Vite PWA Plugin | Service Worker, Offline-Cache, Install-Fenster |

### Bundle-Größe (geschätzt, compressed)

| Komponente | Größe |
|---|---|
| isomorphic-git | ~500 KB |
| @riboseinc/isogit-lfs | ~50 KB |
| @aws-crypto/sha256-universal | ~200 KB |
| op-sqlite | ~150 KB |
| **Gesamt** | **~900 KB** |

> Hinweis: Beim ersten Laden mit schlechtem Internet spürbar. Danach lokal cached.

---

## Datenmodell

### Prinzip

Alle Felder folgen demselben Format: eine Zeile = ein Feld, `key: value`.
Direkte Felder und Block-Felder sind strukturell identisch – der Key trägt die Hierarchie.

- **Direktes Feld:** `hersteller: Sony`
- **Block-Feld:** `port[1].kabel: c8d9e0f1-...`
- **Block-Feld:** `stromanschluss[1].spannung: 230`

Keine zwei Klassen von Feldern. Git-Konflikte werden pro Zeile (= pro Feld) erkannt.

### Git-Repo Struktur

```
kia-geraete/
├── .gitattributes              # LFS-Regeln (*.jpg, *.png, etc. filter=lfs)
├── assets/
│   ├── a3f2b1c0-4e8d-9f1a-2b3c-d4e5f6a7b8c9.asset
│   ├── b7e4d9a1-5f9e-0g2b-3c4d-e5f6a7b8c9d0.asset
│   └── ...
├── types/
│   ├── projektor.type
│   ├── hdmi-kabel.type
│   ├── patchpanel.type
│   └── ...
├── components/
│   ├── port.comp
│   ├── kabelende.comp
│   ├── stromanschluss.comp
│   ├── garantie.comp
│   ├── netzwerkanschluss.comp
│   └── ...
├── locations/
│   ├── 7f3a2b1c-4e8d-9f1a-2b3c-d4e5f6a7b8c9.location
│   └── ...
└── fotos/
    ├── a3f2b1c0_typenschild.jpg   # LFS
    ├── a3f2b1c0_zustand.jpg       # LFS
    └── ...
```

### Komponenten (wiederverwendbare Bausteine)

Komponenten definieren Felder, die in verschiedenen Gerätetypen wiederverwendet werden.
Jede Komponente steht in einer eigenen Datei unter `components/`.

```
# components/port.comp
name: Port
feld: name, text, pflicht
feld: kabel, asset_ref, optional
```

```
# components/stromanschluss.comp
name: Stromanschluss
feld: spannung, number, optional
feld: stromstaerke, number, optional
feld: leistung, number, optional
feld: steckertyp, dropdown, schuko|c13|c19|c7, optional
```

```
# components/garantie.comp
name: Garantie
feld: bis, date, optional
feld: haendler, text, optional
feld: kassenbon, text, optional   # Dateiname in fotos/, kommasepariert bei mehreren
```

```
# components/kabelende.comp
name: Kabelende
feld: port, text, pflicht
feld: gerät, asset_ref, optional
```

```
# components/netzwerkanschluss.comp
name: Netzwerkanschluss
feld: ip, text, optional
feld: mac, text, optional
feld: protokoll, dropdown, ethernet|wifi|vpn, optional
```

### Basis-Vorlage

Die Basis-Vorlage definiert die Felder, die **alle** Assets gemein haben –
Identifikation, Zustand, Metadaten. Jeder Typ erbt diese Felder, sie müssen
nicht in jedem Typ wiederholt werden.

```
# types/_base.type
name: Basis
kategorie: intern

feld: id, uuid, pflicht
feld: type, text, pflicht
feld: location, asset_ref, optional
feld: erstellt, datetime, pflicht
feld: geaendert, datetime, pflicht
feld: hersteller, text, optional
feld: modell, text, optional
feld: seriennummer, text, optional
feld: inventarnummer, text, optional
feld: zustand, dropdown, neu|einwandfrei|defekt|in_reparatur|verschrottet, pflicht
feld: notizen, textarea, optional
feld: passwort, text, optional, sensitiv
feld: fotos, text, optional

> `type` referenziert den Dateiname der Typ-Vorlage ohne `.type`-Endung (z. B. `projektor` für `types/projektor.type`).
> `location` referenziert die UUID einer Location-Datei. `fotos` ist eine kommaseparierte Liste von Dateinamen in `fotos/`.

block: stromanschluss, 0, 5
block: port, 0, 50
block: garantie, 0, 3
block: netzwerkanschluss, 0, 5
```

### Typ-Vorlagen (Asset Types)

Ein Typ erbt die Basis-Vorlage und fügt nur **typ-spezifische** Felder und Komponenten hinzu.
Jedes Feld muss in einer Vorlage definiert sein. Individuelle, ad-hoc Felder an einem einzelnen Asset sind nicht vorgesehen – eine Vorlage zu erstellen ist der normale Weg, wenn ein Feld fehlt.

```
# types/projektor.type
extends: _base
name: Projektor
kategorie: gerät
icon: projector

# nur typ-spezifische Felder; Basis-Felder werden geerbt
feld: auflösung, dropdown, 1080p|4k|laser, optional
feld: helligkeit, number, optional   # in Lumen

block: port, 0, 10   # erweitert den Basis-Bereich (0-50 gilt als Maximum)
```

```
# types/hdmi-kabel.type
extends: _base
name: HDMI-Kabel
kategorie: kabel
icon: cable

feld: laenge, number, optional   # in cm

block: kabelende, 2, 2   # Kabel haben immer genau 2 Enden
```

### Asset-Datei (konkretes Gerät)

Jede Zeile ist ein Feld. Direkte Felder und Block-Felder sind strukturell identisch.
Der Key `block[instanz].feld` zeigt die Hierarchie.
Die PWA validiert beim Speichern, dass jedes Feld in der Vorlage (einschließlich geerbter Felder) definiert ist.

```
id: a3f2b1c0-4e8d-9f1a-2b3c-d4e5f6a7b8c9
type: projektor
location: 7f3a2b1c-4e8d-9f1a-2b3c-d4e5f6a7b8c9
erstellt: 2025-01-15T10:30:00Z
geaendert: 2025-06-20T14:22:00Z
hersteller: Sony
modell: VPL-FHZ50
seriennummer: S123456789
inventarnummer: DEV-2024-0042
zustand: einwandfrei
auflösung: 4k
helligkeit: 5000
stromanschluss[1].spannung: 230
stromanschluss[1].stromstaerke: 2.5
stromanschluss[1].leistung: 575
stromanschluss[1].steckertyp: schuko
port[1].name: HDMI OUT 1
port[1].kabel: c8d9e0f1-6a7b-8c9d-0e1f-2a3b4c5d6e7f
port[2].name: HDMI OUT 2
port[2].kabel:
port[3].name: USB
port[3].kabel:
garantie[1].bis: 2027-03-15
garantie[1].haendler: IT-Shop Berlin
fotos: a3f2b1c0_typenschild.jpg,a3f2b1c0_zustand.jpg
```

### Verknüpfungen (Geräte ↔ Kabel)

Geräte haben Ports, an die Kabel angesteckt werden können. Kabel haben zwei Enden, jedes mit einem Port.
Die Verbindung ist bidirektional: der Port am Gerät speichert die ID des Kabels, der Port am Kabel speichert die ID des Geräts.

```
# Geräte – Port HDMI OUT 1 hat Kabel c8d9e0f1-... angesteckt
port[1].name: HDMI OUT 1
port[1].kabel: c8d9e0f1-6a7b-8c9d-0e1f-2a3b4c5d6e7f

# Kabel – Ende A ist am Projektor a3f2b1c0-... angesteckt
kabelende[1].port: HDMI A
kabelende[1].gerät: a3f2b1c0-4e8d-9f1a-2b3c-d4e5f6a7b8c9

# Kabel – Ende B ist an der Beamerwand b7e4d9a1-... angesteckt
kabelende[2].port: HDMI B
kabelende[2].gerät: b7e4d9a1-5f9e-0g2b-3c4d-e5f6a7b8c9d0
```

**Pfadsuche:** Gerät A, Port X → Kabel-ID → Kabelende → Gerät B, Port Y.
Oder: Kabel → Kabelende A → Gerät A, Port X und Kabelende B → Gerät B, Port Y.

### Location-Datei

```
id: 7f3a2b1c-4e8d-9f1a-2b3c-d4e5f6a7b8c9
name: Berlin – Raum 101
eltern: 1a2b3c4d-5e6f-7g8h-9i0j-k1l2m3n4o5p6
lat: 52.5200
lon: 13.4050
```

> `location` im Asset referenziert immer eine Location-ID. GPS-Koordinaten statt freiem Text.

---

## Sync-Architektur

### Gesamtprinzip

```
┌─────────────────────────────────────────────────────────┐
│                  PWA (Browser)                           │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │  SvelteKit UI                                     │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │  SQLite (lokal, indiziert)                        │  │
│  │  → Suche, Filter, Relationen, UI-Datenquelle       │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Git-Repo (lokal, isomorphic-git + LightningFS)    │  │
│  │  → Sync-Protokoll, Konflikt-Erkennung, Quelle      │  │
│  │  → LFS-Blobs via isogit-lfs                       │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Sync-Layer                                       │  │
│  │  1. Git pull → Diffs erkennen                     │  │
│  │  2. Geänderte Dateien parsen → SQLite aktualisieren│  │
│  │  3. Lokale Änderungen commit → push               │  │
│  │  4. LFS-Blobs upload/download via isogit-lfs      │  │
│  │  5. Konflikte → UI                                │  │
│  └───────────────────────────────────────────────────┘  │
└──────────────────────┬──────────────────────────────────┘
                       │ HTTPS
                       ▼
          ┌────────────────────────────┐
          │   GitHub (SaaS)            │
          │   + GitHub LFS Storage     │
          │   Kein Self-Hosting        │
          └────────────────────────────┘
```

### Edit-Session Flow (Branch-basiert)

```
┌─────────────────────────────────────────────────────────┐
│  1. PWA öffnen → main branch lesen (Anzeige-Modus)      │
│     → SQLite aus main-Zustand befüllen                  │
│                                                         │
│  2. "Bearbeiten" klicken                                │
│     → Branch wird angelegt: z.B. `edit/dpreyl-20250620` │
│     (optional: Benutzer gibt Namen vor)                 │
│     → Lokale SQLite kopiert vom main-Zustand            │
│                                                         │
│  3. Asset bearbeiten → "Speichern"                      │
│     → 1 Commit im Branch (1 Asset = 1 Commit)           │
│     → Sofort lokal sichtbar in SQLite + UI              │
│     → Bilder: LFS-Upload → Pointer-Commit               │
│                                                         │
│  4. "Sync" klicken                                      │
│     → Branch auf Remote pushen                          │
│     → Per GitHub API: squash-merge in main              │
│     → Bei Konflikt: PWA lädt Konflikte, zeigt UI        │
│     → Nutzer löst pro Feld → erneut push + merge        │
│                                                         │
│  5. "Fertig" → Branch löschen, zurück zu main           │
│     → git checkout main → git pull → SQLite refresh     │
└─────────────────────────────────────────────────────────┘
```

### Konflikt-Handling

Pro-Feld-Konflikte dank Zeilen-format:

```
hersteller: Sony
modell: VPL-FHZ50
<<<<<<< HEAD
zustand: defekt
=======
zustand: in_reparatur
>>>>>>> remote
inventarnummer: DEV-2024-0042
```

PWA parst die Markups und zeigt:

```
Konflikt bei Asset "Projektor Sony VPL-FHZ50" (DEV-2024-0042)
┌──────────┬──────────────┬───────────────┐
│ Feld     │ Lokal        │ Remote        │
├──────────┼──────────────┼───────────────┤
│ zustand  │ defekt       │ in_reparatur  │ ◄ Nutzer klickt gewünschte Version | beide ablehnen & manuell eingeben
└──────────┴──────────────┴───────────────┘
```

### Auto-Merge via GitHub API

Keine manuellen Schritte auf GitHub. Die PWA löst den Merge per API aus:

1. Branch pushen (isomorphic-git)
2. `POST /repos/{owner}/{repo}/merges` mit `base=main`, `head=edit/...`
3. Bei Erfolg: Branch lokal + remote löschen
4. Bei Konflikt: Dateien laden, Konflikt-UI zeigen, Auflösung pushen, erneut mergen

**Authentifizierung:** Jeder Nutzer legt auf GitHub einen eigenen Fine-Grained Personal Access Token an und hinterlegt diesen in den PWA-Einstellungen. Damit ist jede Git-Änderung einer verifizierten Identität zugeordnet, und bei Departure lässt sich der Token eines Einzelnen deaktivieren, ohne andere Nutzer zu beeinträchtigen.

---

## Zwei-Stufiger Zugriff

### Standardzugriff

Der Git-Zugriff erfolgt über den individuellen GitHub PAT (siehe Authentifizierung). Der zwei-stufige Zugriff regelt ausschließlich, welche **Datenfelder** sichtbar sind:

- Alle Assets sichtbar
- Alle nicht-sensitiven Felder bearbeitbar
- Bilder, Suche, Filter, Verknüpfungen

### Erweiterter Zugriff (zusätzliches Passwort)

- Zusätzlich: sensitive Felder (Passwörter, IP-Konfiguration, …)
- Markiert in der Typ-Datei mit `sensitiv`

### Implementierung

Sensitive Felder werden **client-seitig verschlüsselt** (AES-GCM via Web Crypto API):

```
passwort: ENC[AESGCM;base64:kJxp...==]  # verschlüsselt
```

- Schlüssel = Hash des erweiterten Passworts (PBKDF2)
- Ohne Passwort sind die Daten auf dem Gerät selbst nicht lesbar
- Nicht nur UI-Verstecken, sondern Datenbankebene
- Verschlüsselte Daten werden normal in Git sync't (als Text)

---

## Sicherheit

### Authentifizierung

Jeder Nutzer verwendet einen eigenen **GitHub Fine-Grained Personal Access Token**. Der Token wird in den PWA-Einstellungen hinterlegt und ist nur lokal auf dem jeweiligen Gerät gespeichert. Jede Git-Änderung ist damit einer verifizierten Identität zugeordnet.

**Vorteile:**
- Bei Departure: Einzelnen Token auf GitHub deaktivieren — kein Zugriff mehr, ohne andere zu beeinträchtigen
- Scope-Beschränkung: Read-Only-Token für Nutzer ohne Schreibrechte möglich
- GitHub Audit-Logs: Nachvollziehbar, welcher Account wann was getan hat

### Keine Ende-zu-Ende-Verschlüsselung (absichtlich)

Die Asset-Daten liegen im Git-Repo als Klartext. Eine Ende-zu-Ende-Verschlüsselung wurde bewusst nicht gewählt, weil sie die Git-Funktionalität zerstört:

- **Git-Diffs wären unlesbar:** Jede Änderung eines verschlüsselten Feldes erzeugt einen komplett neuen Kryptotext-String. Diffs zeigen keinen menschlichen Kontext mehr.
- **Konfliktlösung unmöglich:** Git kann verschlüsselte Werte nicht vergleichen. Parallele Änderungen desselben Assets würden immer Konflikte produzieren, selbst wenn beide denselben Wert geschrieben haben.
- **Suche und Wartbarkeit verloren:** `git grep`, manuelle Reparatur von Asset-Dateien, visuelle Review — alles nur auf Klartext möglich.

**Schutz stattdessen in Schichten:**

| Schicht | Maßnahme | Risiko |
|---|---|---|
| Gerät | Device Encryption (BitLocker / FileVault) | Physischer Diebstahl |
| Transport | HTTPS zu GitHub API + LFS | Mitlesen auf der Leitung |
| Hosting | GitHub Private Repo + SOC2/ISO27001 | Provider-Insider |
| Felder | Zwei-stufige Verschlüsselung (sensible Felder) | Kompromittiertes Gerät |

Für ~10 vertrauenswürdige Mitarbeiter ist dieser Schutz ausreichend. Die Attraktivität der Daten für einen externen Angreifer ist gering, und die echten Risiken (Geräteverlust, unsichere Verbindung) werden durch die vorhandenen Schichten abgedeckt.

### Token-Speicherung

Der PAT wird im Browser-Speicher abgelegt. Eine XSS-Schwachstelle in der PWA würde theoretisch den Token preisgeben. Daher:
- SvelteKit bietet built-in XSS-Protection
- CSP-Header (Content Security Policy) werden gesetzt
- Der Token hat nur den minimal nötigen Scope (Repo-Read/Write, keine Org-Admin-Rechte)

---

## SQLite-Schema (lokaler Index)

```sql
-- Assets (Meta-Daten, gespiegelt aus Git)
CREATE TABLE assets (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  location TEXT REFERENCES locations(id),
  erstellt TEXT,
  geaendert TEXT,
);

-- Indizes
CREATE INDEX idx_assets_type ON assets(type);
CREATE INDEX idx_assets_location ON assets(location);
CREATE INDEX idx_assets_geaendert ON assets(geaendert);

-- Alle Felder eines Assets – direkt und Block-Felder einheitlich
-- path: 'hersteller' (direkt) oder 'port[1].kabel' (Block)
CREATE TABLE asset_fields (
  asset_id TEXT NOT NULL,
  path TEXT NOT NULL,     -- Feld-Pfad, z.B. 'hersteller' oder 'port[1].kabel'
  value TEXT,
  PRIMARY KEY (asset_id, path),
  FOREIGN KEY (asset_id) REFERENCES assets(id)
);

-- Indizes für häufige Queries
CREATE INDEX idx_af_path ON asset_fields(path);
CREATE INDEX idx_af_value ON asset_fields(value);

-- Volltext-Suche über alle Asset-Felder (gespiegelt aus asset_fields)
CREATE VIRTUAL TABLE asset_fields_fts USING fts5 (
  asset_id, path, value
);

-- Vorlagen (aus Git types/)
-- extends: NULL = _base selbst; '_base' = erbt von Basis; anderer Wert = erbt von Typ
CREATE TABLE asset_types (
  id TEXT PRIMARY KEY,    -- Dateiname ohne .type
  name TEXT NOT NULL,
  extends TEXT REFERENCES asset_types(id),  -- Vererbungskette
  kategorie TEXT,
  icon TEXT
);

-- Feld-Definitionen pro Vorlage (aus types/*.type + components/*.comp)
CREATE TABLE type_fields (
  type_id TEXT NOT NULL,
  nr INTEGER NOT NULL,       -- Reihenfolge im Formular
  name TEXT NOT NULL,
  art TEXT NOT NULL,         -- text, number, dropdown, textarea, boolean, date
  optionen TEXT,             -- pipe-getrennt bei dropdown: 'neu|einwandfrei|defekt'
  pflicht INTEGER DEFAULT 0,
  sensitiv INTEGER DEFAULT 0,
  PRIMARY KEY (type_id, nr),
  FOREIGN KEY (type_id) REFERENCES asset_types(id)
);

-- Komponenten (aus Git components/)
CREATE TABLE components (
  id TEXT PRIMARY KEY,    -- Dateiname ohne .comp
  name TEXT NOT NULL
);

-- Typ-Komponenten-Zuordnung (welche Blöcke hat jeder Typ)
CREATE TABLE type_blocks (
  type_id TEXT NOT NULL,
  comp_id TEXT NOT NULL,
  min INTEGER DEFAULT 0,
  max INTEGER DEFAULT 1,
  PRIMARY KEY (type_id, comp_id),
  FOREIGN KEY (type_id) REFERENCES asset_types(id),
  FOREIGN KEY (comp_id) REFERENCES components(id)
);

-- Standorte (aus Git locations/)
CREATE TABLE locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  eltern TEXT REFERENCES locations(id),
  lat REAL,
  lon REAL
);

-- Verknüpfungen (abgeleitet aus asset_fields: port[%].kabel am Gerät, kabelende[%].gerät am Kabel)
CREATE TABLE relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kabel_id TEXT NOT NULL,
  kabelende_nr INTEGER NOT NULL,
  gerat_id TEXT NOT NULL,
  gerat_port TEXT NOT NULL,
  FOREIGN KEY (kabel_id) REFERENCES assets(id),
  FOREIGN KEY (gerat_id) REFERENCES assets(id)
);
CREATE INDEX idx_rel_kabel ON relationships(kabel_id);
CREATE INDEX idx_rel_gerat ON relationships(gerat_id);
```

### Beispiel-Queries

```sql
-- Alle Projektoren im Raum 101
SELECT * FROM assets
  WHERE type = 'projektor'
  AND location = '7f3a2b1c-...';

-- Alle Geräte mit Kabel an Port
SELECT DISTINCT af.asset_id FROM asset_fields af
  WHERE af.path LIKE 'port[%].kabel' AND af.value != '';

-- Welches Kabel steckt an Port 1 des Projektors?
SELECT value FROM asset_fields 
  WHERE asset_id = 'a3f2b1c0-...' AND path = 'port[1].kabel';

-- Spannung > 230V (CAST für numerischer Vergleich)
SELECT asset_id FROM asset_fields 
  WHERE path LIKE 'stromanschluss[%].spannung'
  AND CAST(value AS REAL) > 230;

-- Volltext-Suche: "Sony" (über asset_fields)
SELECT DISTINCT af.asset_id FROM asset_fields af
  INNER JOIN asset_fields_fts fts ON fts.asset_id = af.asset_id
  WHERE asset_fields_fts MATCH 'Sony';
```

---

## Projektstruktur

```
kia-geraetemanagement/
├── src/
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema.ts           # SQLite-Schema + Migrationen
│   │   │   └── queries.ts          # Abfrage-Helfer, FTS-Suche
│   │   ├── git/
│   │   │   ├── repo.ts             # isomorphic-git Initialisierung
│   │   │   ├── pushpull.ts         # Push/Pull
│   │   │   ├── lfs.ts              # isogit-lfs Wrapper
│   │   │   └── mirror.ts           # Git → SQLite Spiegelung
│   │   ├── sync/
│   │   │   ├── branch.ts           # Edit-Session Branch-Logik
│   │   │   ├── merge.ts            # Auto-Merge via GitHub API
│   │   │   └── conflicts.ts        # Konflikt-Erkennung + Parsing
│   │   ├── crypto/
│   │   │   └── sensitive.ts        # AES-GCM Verschlüsselung
│   │   ├── components/
│   │   │   ├── assets/
│   │   │   ├── types/
│   │   │   ├── locations/
│   │   │   ├── sync/
│   │   │   └── ui/                 # Tabelle, Formular, Suche
│   │   └── stores/                 # Svelte Stores
│   ├── routes/
│   │   ├── +layout.svelte          # PWA-Layout, Sync-Status
│   │   ├── +page.svelte            # Dashboard
│   │   ├── assets/+page.svelte     # Asset-Liste
│   │   ├── assets/[id]/+page.svelte
│   │   ├── assets/new/+page.svelte
│   │   ├── types/+page.svelte
│   │   ├── locations/+page.svelte
│   │   ├── conflicts/+page.svelte  # Konflikt-Auflösung
│   │   └── settings/+page.svelte   # Token, Passwörter, Sync
│   ├── app.d.ts
│   └── app.html
├── static/
│   └── icons/                      # PWA-Icons
├── vite.config.ts
├── svelte.config.js
├── tailwind.config.ts
├── package.json
└── README.md
```

---

## Offene Fragen

1. **GitHub-Organisation:** Unter welchem GitHub-Account/Org liegt das Repo?
2. **LFS-Verbrauch:** Bilder-Volumen schätzen – GitHub LFS ist ab 1GB/Monat (private Repos) kostenpflichtig.
3. **Bundle-Größe:** ~900KB initial – akzeptabel bei schlechtem Internet? Code-Splitting kann helfen.
4. **Erster Sync:** Initiales Klonen des Repos auf einem neuen Gerät – bei schlechtem Internet problematisch.

---

## Alternativen (nicht gewählt)

| Alternative | Grund für Ablehnung |
|---|---|
| **CouchDB + PouchDB** | Kein stabiler SaaS-Anbieter (Cloudant 2024 abgeschaltet). Bei Geräte-Diebstahl alle Daten lesbar (IndexedDB Klartext). Konfliktlösung mit `_revisions` mühsam. |
| **ElectricSQL** | Sync-Engine out-of-the-box, aber proprietär, kein Audit-Trail, Last-write-wins statt manueller Konfliktlösung, Vendor-Lock-in zu Startup |
| **Reine Git-Blobs (ohne SQLite)** | Keine indizierte Suche, keine relationale Queries |
| **P2P-Sync via WebRTC** | Zu komplex, cross-Network nicht zuverlässig |
| **Bilder im Git-Repo (kein LFS)** | Repo wird bei vielen Bildern langsam und groß |
| **Bilder in externem Service** | Zusätzliche Abhängigkeit, Sync-Konsistenzproblem |

---

## Recherche-Quellen

- [isomorphic-git](https://isomorphic-git.org) – Pure-JS Git im Browser
- [@riboseinc/isogit-lfs](https://github.com/riboseinc/isogit-lfs) – LFS-Helfer für isomorphic-git (v0.2.0, browser-ready)
- [GitHub LFS API Spec](https://github.com/git-lfs/git-lfs/blob/master/docs/spec.md) – LFS-Protokoll
- [GitHub REST API CORS](https://docs.github.com/en/rest/using-the-rest-api/using-cors-and-jsonp-to-make-cross-origin-requests) – CORS-Unterstützung
- [GitHub LFS Endpoint CORS](https://github.com/git-lfs/git-lfs/issues/3763) – `Access-Control-Allow-Origin: *` bestätigt
- [op-sqlite](https://github.com/evanw/op-sqlite) – SQLite Wasm für Browser
- [LightningFS](https://isomorphic-git.org/docs/en/fs) – Virtuelles FS für isomorphic-git

---

*Dokument erstellt als Architektur-Vorschlag – noch nicht final.*