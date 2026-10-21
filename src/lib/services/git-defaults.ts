/**
 * Returns the default remote URL for the Gitea instance served beside the app.
 */
export function getDefaultGitConfigUrl(hostname?: string): string {
  const host = hostname
    ?? (typeof window === 'undefined' ? undefined : window.location.hostname)
    ?? 'localhost';
  return `http://${host}:8929/admin/ZeugDB`;
}
