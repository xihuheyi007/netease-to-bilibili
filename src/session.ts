// KV-based session management for Cloudflare Workers
// Sessions store Bilibili cookies server-side. Browser only holds an opaque session ID in an HTTP-only cookie.

import type { SessionData, BilibiliCookies } from './types';

export interface SessionKV {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
}

const SESSION_PREFIX = 'sess:';
const SESSION_TTL = 2 * 3600; // 2 hours hard max
const IDLE_TTL = 30 * 60;     // 30 min idle timeout (also max cookie age)

function makeKVKey(sessionId: string): string {
  // The session ID is already a high-entropy random UUID, so using it directly
  // avoids collisions from a weak derived hash while keeping keys opaque enough.
  return SESSION_PREFIX + sessionId;
}

function buildSessionData(initial?: Partial<SessionData>): SessionData {
  const now = Date.now();
  return {
    bilibili: initial?.bilibili,
    createdAt: initial?.createdAt ?? now,
    lastAccessedAt: initial?.lastAccessedAt ?? now,
    csrfToken: initial?.csrfToken ?? crypto.randomUUID(),
    pendingQr: initial?.pendingQr,
  };
}

export function parseSessionId(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  const m = cookieHeader.match(/sid=([^;]+)/);
  return m ? m[1] : null;
}

async function readSessionById(kv: SessionKV, sessionId: string): Promise<SessionData | null> {
  const raw = await kv.get(makeKVKey(sessionId));
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as SessionData;
    if (!data.createdAt || !data.lastAccessedAt || !data.csrfToken) return null;
    return data;
  } catch {
    return null;
  }
}

function isExpired(data: SessionData): boolean {
  const now = Date.now();
  const hardExpired = now - data.createdAt > SESSION_TTL * 1000;
  const idleExpired = now - data.lastAccessedAt > IDLE_TTL * 1000;
  return hardExpired || idleExpired;
}

/** Create a new session, store in KV, return session ID */
export async function createSession(kv: SessionKV, initial?: Partial<SessionData>): Promise<{ sessionId: string; session: SessionData }> {
  const sessionId = crypto.randomUUID();
  const session = buildSessionData(initial);
  await kv.put(makeKVKey(sessionId), JSON.stringify(session), { expirationTtl: SESSION_TTL });
  return { sessionId, session };
}

export async function saveSession(kv: SessionKV, sessionId: string, session: SessionData): Promise<void> {
  session.lastAccessedAt = Date.now();
  await kv.put(makeKVKey(sessionId), JSON.stringify(session), { expirationTtl: SESSION_TTL });
}

/** Get session data from KV using session ID from cookie */
export async function getSession(kv: SessionKV, cookieHeader: string | null): Promise<SessionData | null> {
  const sessionId = parseSessionId(cookieHeader);
  if (!sessionId) return null;
  const data = await readSessionById(kv, sessionId);
  if (!data) return null;
  if (isExpired(data)) {
    await kv.delete(makeKVKey(sessionId));
    return null;
  }
  return data;
}

export async function requireSession(kv: SessionKV, cookieHeader: string | null): Promise<{ sessionId: string; session: SessionData } | null> {
  const sessionId = parseSessionId(cookieHeader);
  if (!sessionId) return null;
  const session = await getSession(kv, cookieHeader);
  if (!session) return null;
  return { sessionId, session };
}

/** Destroy a session */
export async function destroySession(kv: SessionKV, cookieHeader: string): Promise<void> {
  const sessionId = parseSessionId(cookieHeader);
  if (!sessionId) return;
  await kv.delete(makeKVKey(sessionId));
}

export async function ensureSession(kv: SessionKV, cookieHeader: string | null): Promise<{ sessionId: string; session: SessionData; isNew: boolean }> {
  const existing = await requireSession(kv, cookieHeader);
  if (existing) {
    await saveSession(kv, existing.sessionId, existing.session);
    return { ...existing, isNew: false };
  }
  const created = await createSession(kv);
  return { ...created, isNew: true };
}

/** Attach Bilibili login to an existing session */
export async function attachBilibiliSession(
  kv: SessionKV,
  sessionId: string,
  session: SessionData,
  bilibili: BilibiliCookies,
): Promise<void> {
  session.bilibili = bilibili;
  session.pendingQr = undefined;
  await saveSession(kv, sessionId, session);
}

/** Get session cookie header value (for setting in response) */
export function sessionCookieValue(sessionId: string): string {
  return `sid=${sessionId}; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL}; Path=/`;
}

/** Get expired session cookie value (for clearing) */
export function clearSessionCookieValue(): string {
  return 'sid=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/';
}
