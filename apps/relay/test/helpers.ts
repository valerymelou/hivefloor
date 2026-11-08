import {
  OfficeConfigSchema,
  type IngestEvent,
  type IngestEventInput,
  type OfficeConfig,
} from '@hivefloor/schema';
import { exampleOfficeConfig } from '@hivefloor/schema/fixtures';

export const SECRET = 'test-secret-0123456789abcdef';
export const CONFIG: OfficeConfig = OfficeConfigSchema.parse(exampleOfficeConfig);
export const NOW = 1794096003; // 2026-11-08T00:00:03Z

/** Builds an ingest event with defaults (a main session tool event in Ledgerly). */
export function event(overrides: Partial<IngestEventInput> = {}): IngestEvent {
  return {
    v: 1,
    t: NOW,
    seq: 1,
    sid: 'a9f3c2',
    role: 'claude',
    kind: 'tool',
    cat: 'coding',
    project: 'Ledgerly',
    ...overrides,
  } as IngestEvent;
}

/** Hex HMAC-SHA256 of `timestamp.body`, as the CLI signs it. */
export async function sign(
  body: string,
  timestamp: number | string,
  secret = SECRET,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(`${String(timestamp)}.${body}`),
  );
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** A signed `POST /ingest` request. */
export async function ingestRequest(
  body: unknown,
  options: { timestamp?: number; secret?: string; signature?: string; dryRun?: boolean } = {},
): Promise<Request> {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  const timestamp = options.timestamp ?? Math.floor(Date.now() / 1000);
  const signature = options.signature ?? (await sign(text, timestamp, options.secret));
  return new Request('https://office.example.com/ingest', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-office-timestamp': String(timestamp),
      'x-office-signature': signature,
      ...(options.dryRun === true ? { 'x-office-dry-run': '1' } : {}),
    },
    body: text,
  });
}
