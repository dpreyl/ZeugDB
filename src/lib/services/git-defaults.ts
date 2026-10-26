/**
 * Returns the default remote URL for the Gitea instance served beside the app.
 */
export function getDefaultGitConfigUrl(hostname?: string, protocol?: string): string {
  const currentProtocol = protocol
    ?? (typeof window === 'undefined' ? undefined : window.location.protocol)
    ?? 'http:';
  const host = hostname
    ?? (typeof window === 'undefined' ? undefined : window.location.hostname)
    ?? 'localhost';

  // A hosted frontend cannot infer which private LAN address runs the user's
  // Gitea server. Never suggest the GitHub Pages origin as a Git endpoint.
  if (!isLocalGitHost(host)) return '';

  const secure = currentProtocol === 'https:';
  const scheme = secure ? 'https' : 'http';
  const port = secure ? 9443 : 8929;
  return `${scheme}://${host}:${port}/admin/ZeugDB`;
}

function isLocalGitHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  if (host === '::1' || host.startsWith('fe80:') || host.startsWith('fc') || host.startsWith('fd')) {
    return true;
  }

  const octets = host.split('.').map(Number);
  if (octets.length !== 4 || octets.some(octet => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false;
  }

  return octets[0] === 10 ||
    (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
    (octets[0] === 192 && octets[1] === 168) ||
    (octets[0] === 127);
}
