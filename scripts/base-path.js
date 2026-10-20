export function normalizeBasePath(value = '') {
  if (value === '') return '';
  if (typeof value !== 'string' || !value.startsWith('/')) {
    throw new Error('BASE_PATH must begin with "/" or be empty.');
  }
  if (value.endsWith('/')) {
    throw new Error('BASE_PATH must not end with "/" (except for the empty root path).');
  }

  const segments = value.slice(1).split('/');
  if (segments.some(segment => !/^[A-Za-z0-9._~-]+$/.test(segment) || segment === '.' || segment === '..')) {
    throw new Error('BASE_PATH must contain only valid path segments.');
  }

  return value;
}
