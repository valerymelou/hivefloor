import { createHash, createHmac } from 'node:crypto';
import { FALLBACK_AGENT_TYPE, HASH_LENGTH, MAIN_ROLE } from '@hivefloor/schema';

/**
 * The UTC day of a timestamp, used to pick the daily salt.
 *
 * @param nowSec - Unix seconds.
 * @returns The day as `YYYY-MM-DD`.
 */
export function utcDay(nowSec: number): string {
  return new Date(nowSec * 1000).toISOString().slice(0, 10);
}

/**
 * The salt for one UTC day, derived from the shared secret. IDs hashed with
 * different days' salts can't be linked, and nobody without the secret can
 * recompute them.
 *
 * @param secret - The shared secret.
 * @param day - A `YYYY-MM-DD` day, pinned per session at `SessionStart` (H7).
 * @returns The salt as hex.
 */
export function daySalt(secret: string, day: string): string {
  return createHmac('sha256', secret).update(`hivefloor:salt:${day}`).digest('hex');
}

/**
 * Hashes a session or agent ID into the 6 lowercase hex characters that are
 * sent instead of it (C6).
 *
 * @param salt - The session's day salt.
 * @param id - A raw `session_id` or `agent_id`.
 * @returns The short hash.
 */
export function shortHash(salt: string, id: string): string {
  return createHmac('sha256', salt).update(id).digest('hex').slice(0, HASH_LENGTH);
}

/**
 * A local file name for a session or agent's state. Never sent anywhere.
 *
 * @param id - A raw `session_id` or `agent_id`.
 * @returns 16 hex characters.
 */
export function fileKey(id: string): string {
  return createHash('sha256').update(id).digest('hex').slice(0, 16);
}

/**
 * The role a subagent is shown with: its type when the owner listed it in
 * `publicAgentTypes`, otherwise `Helper` (C6).
 *
 * @param agentType - `agent_type` from the payload, if any.
 * @param publicAgentTypes - The owner's `publicAgentTypes`.
 * @returns The role to send.
 */
export function subagentRole(
  agentType: string | undefined,
  publicAgentTypes: readonly string[],
): string {
  if (agentType !== undefined && agentType !== MAIN_ROLE && publicAgentTypes.includes(agentType)) {
    return agentType;
  }
  return FALLBACK_AGENT_TYPE;
}
