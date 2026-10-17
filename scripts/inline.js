/**
 * Post-Build: Erzeugt ein README im build/-Ordner mit Offline-Anleitung.
 *
 * Hinweis: ES-Module benötigen immer einen HTTP-Server (file:// blockiert imports).
 * Die build/-Dateien sind 100% statisch — kein Backend nötig, nur ein einfacher
 * HTTP-Server. Jeder Browser-Support ist gegeben.
 *
 * Nutzung: node scripts/inline.js
 */
import { writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const buildDir = join(__dirname, '..', 'build');

if (!existsSync(join(buildDir, 'index.html'))) {
  console.error('Fehler: build/index.html nicht gefunden. Erst npm run build ausführen.');
  process.exit(1);
}

const readme = `# ZeugDB — Offline-PWA

Diese statischen Dateien sind die komplette App. Kein Server-Backend nötig.

## Starten

**Mit Node.js (empfohlen):**
\`
\`\`bash
# Im build/-Ordner:
npx serve .
# oder
npx http-server .
\`\`
Browser: http://localhost:3000

**Mit Python:**
\`\`\`bash
python3 -m http.server 8080
\`\`
Browser: http://localhost:8080

**Mit PHP:**
\`\`\`bash
php -S localhost:8080
\`\`

## Offline-Nutzung

Die App speichert alle Daten im Browser (IndexedDB + localStorage).
Nach dem ersten Laden funktioniert alles komplett offline.

## Kopieren auf ein anderes Gerät

Den kompletten \`build/\`-Ordner kopieren (ca. 350 KB).
Auf dem Zielgerät einen lokalen HTTP-Server starten (siehe oben).
`;

writeFileSync(join(buildDir, 'README.md'), readme);
console.log('✓ build/README.md geschrieben.');
console.log('→ App starten: npx serve build/  (oder beliebiger HTTP-Server)');
console.log('→ Alle Daten werden client-seitig gespeichert (100% offline-fähig)');

