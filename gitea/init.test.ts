import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveAssetTypeBlocks } from '../src/lib/components/asset-blocks.helpers';
import { parseComponent } from '../src/lib/parser/comp.parser';
import { parseType } from '../src/lib/parser/type.parser';

describe('Gitea repository initialization', () => {
  it('makes projectors inherit the shared electrical equipment fields', () => {
    const typeDir = join(process.cwd(), 'gitea/repo-template/types');
    const projector = parseType('projektor', readFileSync(join(typeDir, 'projektor.type'), 'utf8'));
    const electrical = parseType('elektrogeraet', readFileSync(join(typeDir, 'elektrogeraet.type'), 'utf8'));

    expect(projector.extends).toBe('elektrogeraet');
    expect(electrical.fields.map(field => field.name)).toContain('Seriennummer');
    expect(electrical.fields.find(field => field.name === 'Seriennummer')?.sensitiv).toBe(false);
  });

  it('does not define reserved asset metadata as regular fields in the base template', () => {
    const baseType = readFileSync(
      join(process.cwd(), 'gitea/repo-template/types/_base.type'),
      'utf8'
    );

    expect(baseType).not.toMatch(/^feld: type,/m);
    expect(baseType).not.toMatch(/^feld: bezeichnung,/m);
  });

  it('ships shared electrical inspection fields and reusable inspection history', () => {
    const typeDir = join(process.cwd(), 'gitea/repo-template/types');
    const electricalType = parseType(
      'elektrogeraet',
      readFileSync(join(typeDir, 'elektrogeraet.type'), 'utf8')
    );
    const inspection = parseComponent(
      'pruefung',
      readFileSync(join(process.cwd(), 'gitea/repo-template/components/pruefung.comp'), 'utf8')
    );

    expect(electricalType.extends).toBe('_base');
    expect(electricalType.fields.map(field => field.name)).toEqual(
      expect.arrayContaining(['Hersteller', 'Modell', 'Seriennummer', 'Inventarnummer', 'Nennspannung', 'Nennleistung'])
    );
    expect(electricalType.blocks).toEqual([{ compId: 'pruefung', min: 0, max: 50 }]);
    expect(inspection.fields.map(field => field.name)).toEqual(
      expect.arrayContaining(['Prüfdatum', 'Prüfer', 'Prüfergebnis', 'Prüfart', 'Mängel'])
    );
    expect(inspection.fields.map(field => field.name)).not.toContain('Nächster Prüftermin');
    expect(inspection.fields.find(field => field.name === 'Prüfergebnis')?.optionen)
      .toBe('Bestanden|Mangel|Nicht bestanden');
  });

  it('provides representative office, kitchen, and grounds equipment types inheriting electrical checks', () => {
    const typeDir = join(process.cwd(), 'gitea/repo-template/types');
    const expectedTypes = [
      'projektor',
      'monitor',
      'notebook',
      'desktop-pc',
      'drucker',
      'kaffeemaschine',
      'kuehlgeraet',
      'geschirrspuelmaschine',
      'kombidaempfer',
      'wasserkocher',
      'akku-schrauber',
      'rasenmaeher',
      'heckenschere',
      'hochdruckreiniger',
      'verlaengerungsleitung'
    ];
    const electricalType = parseType(
      'elektrogeraet',
      readFileSync(join(typeDir, 'elektrogeraet.type'), 'utf8')
    );

    for (const id of expectedTypes) {
      const type = parseType(id, readFileSync(join(typeDir, `${id}.type`), 'utf8'));
      expect(type.extends, id).toBe('elektrogeraet');
      expect(type.kategorie, id).toBeTruthy();
      expect(
        resolveAssetTypeBlocks(id, [electricalType, type]).map(block => block.compId),
        id
      ).toContain('pruefung');
    }
  });

  it('creates missing app-template files and is safe to run again', () => {
    const temp = mkdtempSync(join(tmpdir(), 'zeugdb-gitea-init-'));
    const bin = join(temp, 'bin');
    const template = join(temp, 'template');
    const created = join(temp, 'created-files');
    mkdirSync(bin);
    mkdirSync(join(template, 'assets'), { recursive: true });
    writeFileSync(join(template, 'README.md'), 'setup instructions\n');
    writeFileSync(join(template, 'assets', 'README.md'), 'asset format\n');
    writeFileSync(join(bin, 'curl'), `#!/bin/sh
url=""
method="GET"
authenticated="no"
while [ "$#" -gt 0 ]; do
  case "$1" in
    -X) method="$2"; shift 2 ;;
    -u) [ "$2" = "admin:test-password" ] && authenticated="yes"; shift 2 ;;
    -H|-d) shift 2 ;;
    -f|-s|-S|-fsS|-sf) shift ;;
    http://*|https://*) url="$1"; shift ;;
    *) shift ;;
  esac
done
case "$method:$url" in
  GET:*api/v1/version|GET:*api/v1/users/admin) exit 0 ;;
  GET:*api/v1/repos/admin/ZeugDB)
    [ "$authenticated" = "yes" ] && exit 0
    exit 22
    ;;
  GET:*api/v1/repos/admin/ZeugDB/contents/*)
    [ "$authenticated" = "yes" ] || exit 22
    path="\${url##*/contents/}"
    grep -Fxq "$path" "$CREATED_FILES" 2>/dev/null && exit 0
    exit 22
    ;;
  PUT:*api/v1/repos/admin/ZeugDB/contents/*)
    path="\${url##*/contents/}"
    printf '%s\\n' "$path" >> "$CREATED_FILES"
    exit 0
    ;;
esac
exit 1
`);
    const curlStub = join(bin, 'curl');
    // Make the mocked curl executable for the shell script.
    execFileSync('chmod', ['+x', curlStub]);

    const run = () => execFileSync('sh', [join(process.cwd(), 'gitea/init.sh')], {
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        GITEA_TEMPLATE_DIR: template,
        GITEA_CREATED_FILES: created,
        GITEA_ADMIN_USERNAME: 'admin',
        GITEA_ADMIN_PASSWORD: 'test-password',
        GITEA_REPO_NAME: 'ZeugDB',
        CREATED_FILES: created
      },
      encoding: 'utf8'
    });

    try {
      expect(run()).toContain('Gitea initialization complete');
      expect(readFileSync(created, 'utf8').trim().split('\n').sort()).toEqual([
        'README.md',
        'assets/README.md'
      ]);

      expect(run()).toContain('Gitea initialization complete');
      expect(readFileSync(created, 'utf8').trim().split('\n')).toHaveLength(2);
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
  });
});
