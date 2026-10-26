import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';

const require = createRequire('/tmp/zeugdb-playwright/package.json');
const { chromium, devices } = require('playwright');

const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
const giteaUrl = process.env.GITEA_URL ?? 'http://localhost:8929';
const username = process.env.GITEA_ADMIN_USERNAME ?? 'admin';
const password = process.env.GITEA_ADMIN_PASSWORD ?? 'admin123';
const repoName = `zeugdb-lfs-e2e-${Date.now()}`;
const authorization = `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;

async function giteaRequest(path, options = {}) {
  const response = await fetch(`${giteaUrl}${path}`, {
    ...options,
    headers: {
      Authorization: authorization,
      ...(options.headers ?? {})
    }
  });
  if (!response.ok) {
    throw new Error(`Gitea ${options.method ?? 'GET'} ${path}: ${response.status} ${await response.text()}`);
  }
  return response;
}

async function createTestRepository() {
  await giteaRequest('/api/v1/user/repos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: repoName, auto_init: true, default_branch: 'main' })
  });
  const typeContents = Buffer.from([
    'name: Browser LFS Test',
    'kategorie: test',
    'feld: seriennummer, text, optional'
  ].join('\n'));
  await giteaRequest(`/api/v1/repos/${username}/${repoName}/contents/types/projektor.type`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Add temporary browser smoke-test type',
      content: typeContents.toString('base64'),
      branch: 'main'
    })
  });
}

async function verifyLfsRoundTrip(assetId, sourceImage) {
  const pointerResponse = await giteaRequest(
    `/api/v1/repos/${username}/${repoName}/contents/fotos/${assetId}/photo-0.png?ref=main`
  );
  const file = await pointerResponse.json();
  const pointer = Buffer.from(file.content, 'base64').toString('utf8');
  const oid = pointer.match(/^oid sha256:([a-f0-9]{64})$/m)?.[1];
  const size = Number(pointer.match(/^size (\d+)$/m)?.[1]);
  if (!pointer.startsWith('version https://git-lfs.github.com/spec/v1') || !oid) {
    throw new Error(`Git main does not contain an LFS pointer: ${pointer}`);
  }
  if (size !== sourceImage.length) {
    throw new Error(`LFS pointer size ${size} does not match uploaded image size ${sourceImage.length}`);
  }

  const batchResponse = await giteaRequest(`/${username}/${repoName}/info/lfs/objects/batch`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/vnd.git-lfs+json',
      Accept: 'application/vnd.git-lfs+json'
    },
    body: JSON.stringify({
      operation: 'download',
      transfers: ['basic'],
      objects: [{ oid, size }]
    })
  });
  const batch = await batchResponse.json();
  const object = batch.objects?.find(candidate => candidate.oid === oid);
  if (!object || object.errors?.length || !object.actions?.download?.href) {
    throw new Error(`Gitea did not provide an LFS download action: ${JSON.stringify(object)}`);
  }
  const download = await fetch(object.actions.download.href, {
    headers: object.actions.download.header ?? {}
  });
  if (!download.ok) throw new Error(`LFS object download returned HTTP ${download.status}`);

  const roundTripImage = Buffer.from(await download.arrayBuffer());
  const roundTripOid = createHash('sha256').update(roundTripImage).digest('hex');
  if (!roundTripImage.equals(sourceImage) || roundTripOid !== oid) {
    throw new Error(`LFS round-trip mismatch: downloaded SHA-256 ${roundTripOid}, pointer OID ${oid}`);
  }
  console.log(`GIT_LFS_ROUNDTRIP_OK repo=${repoName} oid=${oid} bytes=${size}`);
}

async function runBrowserTest() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext({ ...devices['iPhone 13'] });
  const page = await context.newPage();
  const runtimeErrors = [];
  const browserLogs = [];
  page.on('pageerror', error => runtimeErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
    else browserLogs.push(`[${message.type()}] ${message.text()}`);
  });

  try {
    await page.goto(`${appUrl}/settings`, { waitUntil: 'networkidle' });
    await page.getByLabel('Git-Server URL').fill(`${giteaUrl}/${username}/${repoName}`);
    await page.getByLabel('Benutzername').fill(username);
    await page.getByLabel('Personal Access Token').fill(password);
    await page.getByRole('button', { name: 'Speichern' }).click();
    await page.getByRole('button', { name: 'Repo klonen' }).click();
    await page.waitForFunction(
      () => document.body.innerText.includes('Initialisiert: Ja'),
      { timeout: 60000 }
    );
    await page.goto(`${appUrl}/`, { waitUntil: 'networkidle' });
    const localRepoAfterNavigation = await page.evaluate(async () => {
      const { getGitRepo } = await import('/src/lib/services/git.service.ts');
      const repo = await getGitRepo();
      return {
        branch: await repo.getCurrentBranch()
      };
    });
    if (localRepoAfterNavigation.branch !== 'main') {
      throw new Error(`Git clone did not persist across page reload: ${JSON.stringify(localRepoAfterNavigation)}`);
    }
    console.log('GIT_CLONE_PERSISTED_AFTER_RELOAD branch=main');
    await page.getByRole('button', { name: 'Bearbeiten' }).click();
    try {
      await page.getByRole('button', { name: 'Sync', exact: true }).waitFor({ timeout: 30000 });
      await page.getByRole('button', { name: 'Sync', exact: true }).waitFor({ state: 'visible' });
      await page.waitForFunction(() => {
        const button = [...document.querySelectorAll('button')].find(item => item.textContent?.trim() === 'Sync');
        return button instanceof HTMLButtonElement && !button.disabled;
      }, { timeout: 30000 });
    } catch {
      throw new Error(`Could not enter edit mode: ${await page.locator('body').innerText()}`);
    }
    await page.goto(`${appUrl}/assets/new`, { waitUntil: 'networkidle' });
    const designation = `Browser LFS ${Date.now()}`;
    await page.getByLabel('Bezeichnung').fill(designation);
    await page.locator('#type').selectOption('projektor');
    await page.getByRole('button', { name: 'Erzeugen' }).click();
    await page.waitForURL(`${appUrl}/`);
    const assetLink = page.getByRole('link', { name: designation, exact: true });
    const assetHref = await assetLink.getAttribute('href');
    console.log(`CREATED_ASSET_LINK href=${assetHref}`);
    await assetLink.click();
    try {
      await page.waitForURL(url => /\/assets\/[^/]+\/?$/.test(url.pathname), { timeout: 10000 });
    } catch {
      throw new Error(`Asset link did not open its detail route: href=${assetHref}, url=${page.url()}, page=${await page.locator('body').innerText()}`);
    }

    const assetPath = new URL(page.url()).pathname;
    const assetId = assetPath.split('/').filter(Boolean).at(-1);
    if (!assetId || assetId === 'assets') {
      throw new Error(`Asset detail page did not open: ${page.url()}`);
    }
    const imageInput = page.getByLabel('Foto aufnehmen oder auswählen');
    if (await imageInput.getAttribute('capture') !== 'environment') {
      throw new Error('Mobile photo input does not request the rear camera');
    }
    if (await imageInput.getAttribute('accept') !== 'image/*') {
      throw new Error('Mobile photo input does not accept camera images');
    }

    // Supply bytes from memory as a mobile camera would; no device file is created.
    const image = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lN8AAAAASUVORK5CYII=',
      'base64'
    );
    await imageInput.setInputFiles({
      name: 'camera-capture.png',
      mimeType: 'image/png',
      buffer: image
    });
    await page.locator('img[alt="Foto 1"]').waitFor({ timeout: 30000 });
    console.log(`MOBILE_CAMERA_INPUT_OK capture=environment asset=${assetId}`);

    await page.getByRole('button', { name: 'Sync' }).click();
    try {
      await page.getByText('Read-Only', { exact: true }).waitFor({ timeout: 30000 });
    } catch {
      throw new Error(`App sync did not finish: ${await page.locator('body').innerText()}`);
    }
    const pageText = await page.locator('body').innerText();
    if (pageText.includes('✗')) throw new Error(`App sync failed: ${pageText}`);
    if (runtimeErrors.length) {
      throw new Error(`Browser runtime errors: ${runtimeErrors.join(' | ')}`);
    }
    console.log('BROWSER_SYNC_OK runtime_errors=0');
    await verifyLfsRoundTrip(assetId, image);
  } finally {
    console.log('BROWSER_CONSOLE', browserLogs.join('\n'));
    await browser.close();
  }
}

try {
  await createTestRepository();
  await runBrowserTest();
} finally {
  await giteaRequest(`/api/v1/repos/${username}/${repoName}`, { method: 'DELETE' })
    .then(() => console.log(`E2E_REPOSITORY_CLEANED_UP repo=${repoName}`))
    .catch(error => console.error(`E2E_REPOSITORY_CLEANUP_FAILED repo=${repoName}: ${error.message}`));
}
