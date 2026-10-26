import { describe, expect, it } from 'vitest';
import { getDefaultGitConfigUrl } from './git-defaults';

describe('getDefaultGitConfigUrl', () => {
  it('uses the current browser host for the local Gitea service', () => {
    expect(getDefaultGitConfigUrl('192.168.1.24')).toBe(
      'http://192.168.1.24:8929/admin/ZeugDB'
    );
  });

  it('uses the local HTTPS Git proxy when the app is served over HTTPS', () => {
    expect(getDefaultGitConfigUrl('192.168.1.24', 'https:')).toBe(
      'https://192.168.1.24:9443/admin/ZeugDB'
    );
  });

  it('does not mistake the GitHub Pages host for the local Gitea server', () => {
    expect(getDefaultGitConfigUrl('dpreyl.github.io', 'https:')).toBe('');
  });

  it('does not assume an arbitrary public custom domain is the Gitea host', () => {
    expect(getDefaultGitConfigUrl('zeugdb.example.org', 'https:')).toBe('');
  });

  it('falls back to localhost outside a browser', () => {
    expect(getDefaultGitConfigUrl()).toBe('http://localhost:8929/admin/ZeugDB');
  });
});
