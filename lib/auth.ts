import { NextRequest } from 'next/server';
import crypto from 'crypto';

const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'maxupport';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'maxupport1238';

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
  return timingSafeCompare(user, ADMIN_USERNAME) && timingSafeCompare(pass, ADMIN_PASSWORD);
}

export function generateAdminToken(): string {
  // HMAC-SHA256 token derived from admin credentials and secret salt
  const secret = `${ADMIN_USERNAME}:${ADMIN_PASSWORD}:museum_secure_salt_2026`;
  return crypto.createHmac('sha256', secret).update(ADMIN_USERNAME).digest('hex');
}

export function validateAdminRequest(request: NextRequest): boolean {
  const adminToken = request.cookies.get('admin_token')?.value;
  if (!adminToken) return false;
  const expectedToken = generateAdminToken();
  const rawToken = decodeURIComponent(adminToken);
  return timingSafeCompare(rawToken, expectedToken);
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
