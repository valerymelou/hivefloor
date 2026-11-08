// Kept free of Zod so the CLI hook can import it without loading Zod.

/**
 * Tells whether a string is an ingest endpoint URL: `https`, or `http` on a local
 * development host.
 *
 * @param value - The URL to check.
 * @returns `true` for `https://…` URLs and `http://localhost…` style URLs.
 */
export function isEndpointUrl(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.protocol === 'https:') {
    return true;
  }
  const localHosts = ['localhost', '127.0.0.1', '[::1]'];
  return url.protocol === 'http:' && localHosts.includes(url.hostname);
}
