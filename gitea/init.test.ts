import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Gitea repository initialization', () => {
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
