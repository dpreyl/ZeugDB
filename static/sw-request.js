export function isSameOriginRequest(requestUrl, workerOrigin) {
  try {
    return new URL(requestUrl, workerOrigin).origin === new URL(workerOrigin).origin;
  } catch {
    return false;
  }
}
