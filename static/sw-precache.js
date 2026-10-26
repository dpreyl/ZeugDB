import { appPath } from './sw-paths.js';

function pathValue(file) {
  return typeof file === 'string' ? file : file.path;
}

function appScopedPath(base, path) {
  if (base && (path === base || path.startsWith(`${base}/`))) return path;
  return appPath(base, path.startsWith('/') ? path : `/${path}`);
}

export function getBuildAssetUrls(buildFiles, base) {
  return buildFiles.map(file => appScopedPath(base, pathValue(file)));
}

export function getPrecacheUrls(buildFiles, staticFiles, base, appRoot, workerPath) {
  return [...new Set([
    appRoot,
    ...getBuildAssetUrls(buildFiles, base),
    ...staticFiles.map(file => appScopedPath(base, pathValue(file))),
    workerPath
  ])];
}
