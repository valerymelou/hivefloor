import { createHmac } from 'node:crypto';

/**
 * Signs a request body for `POST /ingest`: hex HMAC-SHA256 of
 * `timestamp + "." + body` with the shared secret.
 *
 * @param secret - The shared secret.
 * @param timestamp - Unix seconds, sent as `X-Office-Timestamp`.
 * @param body - The exact JSON body.
 * @returns The value of `X-Office-Signature`.
 */
export function signBody(secret: string, timestamp: number, body: string): string {
  return createHmac('sha256', secret)
    .update(`${String(timestamp)}.${body}`)
    .digest('hex');
}
