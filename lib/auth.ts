import type { NextRequest } from 'next/server';
import crypto from 'crypto';

export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 24;

function getAdminConfig() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password) return null;
  // This password was previously committed as a default and must be rotated.
  if (password === 'maxupport1238') return null;

  // Credential rotation invalidates sessions, even when a separate secret is set.
  // Existing deployments can keep using their configured credentials; an
  // independent random ADMIN_SESSION_SECRET is recommended for new deployments.
  const key = crypto.createHash('sha256').update(JSON.stringify([
    'museum-admin-session-v1', username, password, process.env.ADMIN_SESSION_SECRET || '',
  ])).digest();
  return { username, password, key };
}

/**
 * Timing-safe string comparison to prevent timing side-channel attacks
 */
function timingSafeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, 'utf-8');
    const bufB = Buffer.from(b, 'utf-8');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export function checkAdminCredentials(user: string, pass: string): boolean {
  const config = getAdminConfig();
  if (!config) return false;
  return timingSafeCompare(user, config.username) && timingSafeCompare(pass, config.password);
}

export function generateAdminToken(): string {
  const config = getAdminConfig();
  if (!config) throw new Error('Admin credentials are not configured');
  const issuedAt = Math.floor(Date.now() / 1000);
  const payload = `v1.${issuedAt}.${issuedAt + ADMIN_SESSION_MAX_AGE}.${crypto.randomBytes(16).toString('hex')}`;
  const signature = crypto.createHmac('sha256', config.key).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

export function validateAdminToken(token: string | undefined): boolean {
  const config = getAdminConfig();
  if (!config || !token || token.length > 256) return false;
  const match = /^v1\.(\d{1,12})\.(\d{1,12})\.([a-f0-9]{32})\.([a-f0-9]{64})$/.exec(token);
  if (!match) return false;
  const issuedAt = Number(match[1]);
  const expiresAt = Number(match[2]);
  const now = Math.floor(Date.now() / 1000);
  if (issuedAt > now || expiresAt <= now || expiresAt - issuedAt !== ADMIN_SESSION_MAX_AGE) return false;
  const payload = token.slice(0, token.lastIndexOf('.'));
  const expected = crypto.createHmac('sha256', config.key).update(payload).digest('hex');
  return timingSafeCompare(match[4], expected);
}

export function validateAdminRequest(request: NextRequest): boolean {
  return validateAdminToken(request.cookies.get('admin_token')?.value);
}

/**
 * Safely parse JSON string permissions to string array
 */
export function parsePermissions(permStr: string | null | undefined): string[] {
  if (!permStr) return [];
  try {
    const parsed = JSON.parse(permStr);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Safely stringify permissions string array to JSON
 */
export function stringifyPermissions(perms: string[]): string {
  return JSON.stringify(perms || []);
}
