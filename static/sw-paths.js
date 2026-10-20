export function getAppBase(scope) {
  const pathname = new URL(scope).pathname;
  return pathname === '/' ? '' : pathname.replace(/\/$/, '');
}

export function appPath(base, path) {
  return path === '/' ? `${base}/` : `${base}${path}`;
}
