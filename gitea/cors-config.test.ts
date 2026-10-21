import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Gitea browser Git access', () => {
  it('enables token-based cross-origin Git requests without cookie credentials', () => {
    const compose = readFileSync('docker-compose.yml', 'utf8');

    expect(compose).toMatch(
      /GITEA__repository__ACCESS_CONTROL_ALLOW_ORIGIN=\$\{GITEA_CORS_ALLOW_DOMAIN:-\*\}/
    );
  });
});
