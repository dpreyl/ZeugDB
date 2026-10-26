declare module 'sha.js' {
  interface Sha256Hash {
    update(data: Uint8Array): Sha256Hash;
    digest(encoding: 'hex'): string;
  }

  function sha(algorithm: 'sha256'): Sha256Hash;

  export default sha;
}
