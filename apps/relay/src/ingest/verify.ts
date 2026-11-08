import {
  INGEST_MAX_BYTES,
  IngestEventSchema,
  MAIN_ROLE,
  TIMESTAMP_WINDOW_SEC,
  type IngestEvent,
  type OfficeConfig,
} from '@hivefloor/schema';

/** Why an ingest request was refused. */
export type Rejection =
  'too-large' | 'unauthorized' | 'invalid' | 'not-allowed' | 'replay' | 'unavailable';

/** The bare status code for each rejection: the only place they are chosen (R1). */
export const REJECTION_STATUS: Readonly<Record<Rejection, number>> = {
  'too-large': 413,
  unauthorized: 401,
  invalid: 400,
  'not-allowed': 422,
  replay: 409,
  unavailable: 503,
};

/** An event that passed every check. */
export interface Verified {
  readonly ok: true;
  readonly event: IngestEvent;
  /** The hex signature, used for replay protection (R2). */
  readonly signature: string;
  /** `X-Office-Dry-Run: 1`: verify only, change nothing (ADR 0012). */
  readonly dryRun: boolean;
  /** A private event while the private room is hidden (H3): accept and drop. */
  readonly hidden: boolean;
}

/** The outcome of verifying an ingest request. */
export type Verification = Verified | { readonly ok: false; readonly reason: Rejection };

/** How far the rounded event time may lag: the window plus the largest rounding step. */
export const EVENT_TIME_SLACK_SEC = TIMESTAMP_WINDOW_SEC + 60;

const keys = new Map<string, Promise<CryptoKey>>();

function hmacKey(secret: string): Promise<CryptoKey> {
  let key = keys.get(secret);
  if (key === undefined) {
    key = crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    keys.set(secret, key);
  }
  return key;
}

function fromHex(hex: string): Uint8Array | undefined {
  if (!/^[0-9a-f]{64}$/.test(hex)) return undefined;
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

/**
 * Checks `X-Office-Signature` against HMAC-SHA256(secret, timestamp + "." + body)
 * in constant time.
 *
 * @param secret - The shared secret.
 * @param timestamp - The `X-Office-Timestamp` header, exactly as sent.
 * @param body - The raw body.
 * @param signature - The `X-Office-Signature` header.
 * @returns `true` when the signature matches.
 */
export async function verifySignature(
  secret: string,
  timestamp: string,
  body: string,
  signature: string,
): Promise<boolean> {
  const expected = fromHex(signature);
  if (expected === undefined) return false;
  const data = new TextEncoder().encode(`${timestamp}.${body}`);
  return crypto.subtle.verify('HMAC', await hmacKey(secret), expected, data);
}

/**
 * Reads a request body, refusing more than `maxBytes` even without a
 * `Content-Length` header.
 *
 * @param request - The request.
 * @param maxBytes - The size limit.
 * @returns The body text, or `undefined` when it is too large.
 */
export async function readLimited(request: Request, maxBytes: number): Promise<string | undefined> {
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > maxBytes) return undefined;
  if (request.body === null) return '';
  const reader = request.body.getReader() as ReadableStreamDefaultReader<Uint8Array>;
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return undefined;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/**
 * The relay's own allowlist check (the second gate): a known role and, if any,
 * a public project from the office config.
 *
 * @param event - A schema-valid event.
 * @param config - The office config.
 * @returns `true` when every name is allowed.
 */
export function isAllowed(event: IngestEvent, config: OfficeConfig): boolean {
  const roleOk = event.role === MAIN_ROLE || config.agentTypes.includes(event.role);
  const projectOk =
    event.project === undefined || config.publicProjects.some((p) => p.name === event.project);
  return roleOk && projectOk;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/**
 * Verifies one `POST /ingest` request (R1): size, timestamp window, signature,
 * schema and allowlists, in that order. Replay protection (R2) needs shared
 * state, so the Office Durable Object does it.
 *
 * @param request - The request.
 * @param secret - The shared secret.
 * @param config - The office config.
 * @param nowSec - Relay time in Unix seconds.
 * @returns The verified event, or why it was refused.
 */
export async function verifyIngest(
  request: Request,
  secret: string,
  config: OfficeConfig,
  nowSec: number,
): Promise<Verification> {
  const body = await readLimited(request, INGEST_MAX_BYTES);
  if (body === undefined) return { ok: false, reason: 'too-large' };
  const timestamp = request.headers.get('x-office-timestamp') ?? '';
  const signature = request.headers.get('x-office-signature') ?? '';
  const sentAt = /^\d{1,12}$/.test(timestamp) ? Number(timestamp) : Number.NaN;
  if (!(Math.abs(nowSec - sentAt) <= TIMESTAMP_WINDOW_SEC))
    return { ok: false, reason: 'unauthorized' };
  if (!(await verifySignature(secret, timestamp, body, signature)))
    return { ok: false, reason: 'unauthorized' };

  const parsed = IngestEventSchema.safeParse(parseJson(body));
  if (!parsed.success) return { ok: false, reason: 'invalid' };
  const event = parsed.data;
  if (event.t > nowSec + TIMESTAMP_WINDOW_SEC || event.t < nowSec - EVENT_TIME_SLACK_SEC)
    return { ok: false, reason: 'invalid' };
  if (!isAllowed(event, config)) return { ok: false, reason: 'not-allowed' };

  return {
    ok: true,
    event,
    signature,
    dryRun: request.headers.get('x-office-dry-run') === '1',
    hidden: event.project === undefined && !config.privateRoom.visible,
  };
}
