import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Gitea browser Git access', () => {
  it('enables token-based cross-origin Git requests without cookie credentials', () => {
    const compose = readFileSync('docker-compose.yml', 'utf8');

    expect(compose).toMatch(
      /GITEA__server__ROOT_URL=\$\{GITEA_ROOT_URL:-http:\/\/localhost:8929\/\}/
    );
    expect(compose).toMatch(
      /GITEA__repository__ACCESS_CONTROL_ALLOW_ORIGIN=\$\{GITEA_CORS_ALLOW_DOMAIN:-\*\}/
    );
    expect(compose).toMatch(/GITEA__cors__ENABLED=true/);
    expect(compose).toMatch(/GITEA__cors__ALLOW_DOMAIN=\$\{GITEA_CORS_ALLOW_DOMAIN:-\*\}/);
    expect(compose).toMatch(/GITEA__cors__METHODS=GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS/);
    expect(compose).toMatch(/GITEA__cors__HEADERS=Authorization,Content-Type,Accept,Origin,Transfer-Encoding/);
  });

  it('routes local browser requests through a proxy that permits Git LFS PUT preflights', () => {
    const compose = readFileSync('docker-compose.yml', 'utf8');
    const proxy = readFileSync('gitea/nginx.conf', 'utf8');

    expect(compose).toMatch(/gitserver-proxy:/);
    expect(compose).toMatch(/"8929:80"/);
    expect(compose).toMatch(/depends_on:\s+- gitserver\s+- gitserver-proxy/);
    expect(proxy).toMatch(/Access-Control-Allow-Methods[^;]*PUT/);
    expect(proxy).toMatch(/Access-Control-Allow-Headers[^;]*Authorization/);
    expect(proxy).toMatch(/proxy_pass http:\/\/gitserver:3000/);
    expect(proxy).toMatch(/proxy_set_header X-Forwarded-Proto \$http_x_forwarded_proto/);
  });
});
