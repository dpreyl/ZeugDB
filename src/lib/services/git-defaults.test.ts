import { describe, expect, it } from 'vitest';
import { getDefaultGitConfigUrl } from './git-defaults';

describe('getDefaultGitConfigUrl', () => {
  it('uses the current browser host for the local Gitea service', () => {
    expect(getDefaultGitConfigUrl('192.168.1.24')).toBe(
      'http://192.168.1.24:8929/admin/ZeugDB'
    );
  });

  it('falls back to localhost outside a browser', () => {
    expect(getDefaultGitConfigUrl()).toBe('http://localhost:8929/admin/ZeugDB');
  });
});
