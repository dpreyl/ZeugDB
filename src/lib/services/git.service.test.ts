import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  loadGitConfig,
  saveGitConfig,
  type GitConfig
} from './git.service';

describe('git.service — Konfiguration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('gibt null zurück, wenn keine Konfiguration gespeichert ist', () => {
    expect(loadGitConfig()).toBeNull();
  });

  it('liest eine gespeicherte Konfiguration', () => {
    const config: GitConfig = {
      url: 'http://example.com/repo.git',
      username: 'testuser',
      token: 'secret-token'
    };
    saveGitConfig(config);
    expect(loadGitConfig()).toEqual(config);
  });

  it('überschreibt eine bestehende Konfiguration', () => {
    const config1: GitConfig = {
      url: 'http://old.com/repo.git',
      username: 'olduser',
      token: 'old-token'
    };
    saveGitConfig(config1);
    const config2: GitConfig = {
      url: 'http://new.com/repo.git',
      username: 'newuser',
      token: 'new-token'
    };
    saveGitConfig(config2);
    expect(loadGitConfig()).toEqual(config2);
  });

  it('gibt null bei korrupten Daten zurück', () => {
    localStorage.setItem('zeugdb:gitConfig', 'invalid json');
    expect(loadGitConfig()).toBeNull();
  });
});
