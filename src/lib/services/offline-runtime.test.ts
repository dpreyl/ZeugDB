import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('offline runtime deployment', () => {
  it('does not leave a service worker placeholder visible in the built app document', () => {
    const appTemplate = readFileSync('src/app.html', 'utf8');

    expect(appTemplate).not.toContain('%sveltekit.serviceWorker.register%');
    expect(() => readFileSync('src/service-worker.js', 'utf8')).not.toThrow();
  });

  it('provides HTTPS for trusted offline use from other devices on the LAN', () => {
    const compose = readFileSync('docker-compose.yml', 'utf8');
    const caddyfile = readFileSync('caddy/Caddyfile', 'utf8');

    expect(compose).toMatch(/offline-https:\s*\n\s*image:\s*caddy:2-alpine/);
    expect(compose).toMatch(/"8443:8443"/);
    expect(compose).toMatch(/"9443:9443"/);
    expect(compose).toMatch(/caddy_data:\/data/);
    expect(caddyfile).toContain('{$APP_HOST}:8443');
    expect(caddyfile).toContain('{$APP_HOST}:9443');
    expect(caddyfile).toContain('tls internal');
    expect(caddyfile).toContain('reverse_proxy production:80');
    expect(caddyfile).toContain('reverse_proxy gitserver-proxy:80');
  });

  it('deploys a static GitHub Pages artifact using the repository base path', () => {
    const workflow = readFileSync('.github/workflows/deploy-pages.yml', 'utf8');

    expect(workflow).toContain('actions/configure-pages');
    expect(workflow).toContain('actions/upload-pages-artifact');
    expect(workflow).toContain('actions/deploy-pages');
    expect(workflow).toContain('BASE_PATH');
    expect(workflow).toContain('repo_name="${GITHUB_REPOSITORY#*/}"');
    expect(workflow).toContain('${GITHUB_REPOSITORY_OWNER}.github.io');
    expect(workflow).toContain('npm run build:pages');
  });
});
