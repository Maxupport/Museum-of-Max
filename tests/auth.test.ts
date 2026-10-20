import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { ADMIN_SESSION_MAX_AGE, checkAdminCredentials, generateAdminToken, validateAdminRequest, validateAdminToken } from '@/lib/auth';

beforeEach(() => {
  vi.stubEnv('ADMIN_USERNAME', 'test-curator');
  vi.stubEnv('ADMIN_PASSWORD', 'test-only-password');
  vi.stubEnv('ADMIN_SESSION_SECRET', 'test-only-random-session-secret');
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-20T00:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('admin sessions', () => {
  it('accepts configured credentials and rejects wrong credentials', () => {
    expect(checkAdminCredentials('test-curator', 'test-only-password')).toBe(true);
    expect(checkAdminCredentials('test-curator', 'wrong-password')).toBe(false);
  });

  it('fails closed when either credential is missing', () => {
    vi.stubEnv('ADMIN_USERNAME', '');
    expect(checkAdminCredentials('', 'test-only-password')).toBe(false);
    expect(validateAdminToken('anything')).toBe(false);
    expect(() => generateAdminToken()).toThrow();
    vi.stubEnv('ADMIN_USERNAME', 'test-curator');
    vi.stubEnv('ADMIN_PASSWORD', '');
    expect(checkAdminCredentials('test-curator', '')).toBe(false);
  });

  it('rejects the previously exposed default password even if it remains in the environment', () => {
    vi.stubEnv('ADMIN_PASSWORD', 'maxupport1238');
    expect(checkAdminCredentials('test-curator', 'maxupport1238')).toBe(false);
    expect(() => generateAdminToken()).toThrow();
  });

  it('issues unique signed sessions that work with the existing cookie name', () => {
    const token = generateAdminToken();
    expect(generateAdminToken()).not.toBe(token);
    expect(validateAdminToken(token)).toBe(true);
    expect(validateAdminRequest(new NextRequest('https://museum.test/api/passcodes', {
      headers: { cookie: `admin_token=${token}` },
    }))).toBe(true);
  });

  it.each([
    '', 'is_curator=true', 'visitor_token=curator_admin',
    'admin_token=forged; is_curator=true; visitor_token=curator_admin',
    'admin_token=%E0%A4%A',
  ])('rejects forged or malformed cookies: %s', (cookie) => {
    const request = new NextRequest('https://museum.test/api/passcodes', { headers: { cookie } });
    expect(validateAdminRequest(request)).toBe(false);
  });

  it('rejects signature tampering and extending a token expiration', () => {
    const token = generateAdminToken();
    const parts = token.split('.');
    parts[2] = String(Number(parts[2]) + 86400);
    expect(validateAdminToken(parts.join('.'))).toBe(false);
    expect(validateAdminToken(`${token.slice(0, -1)}${token.endsWith('0') ? '1' : '0'}`)).toBe(false);
  });

  it('expires sessions server-side even if a client keeps sending the cookie', () => {
    const token = generateAdminToken();
    vi.advanceTimersByTime(ADMIN_SESSION_MAX_AGE * 1000 - 1000);
    expect(validateAdminToken(token)).toBe(true);
    vi.advanceTimersByTime(1000);
    expect(validateAdminToken(token)).toBe(false);
  });

  it('invalidates old sessions when the password or secret changes', () => {
    const token = generateAdminToken();
    vi.stubEnv('ADMIN_PASSWORD', 'rotated-password');
    expect(validateAdminToken(token)).toBe(false);
    vi.stubEnv('ADMIN_PASSWORD', 'test-only-password');
    vi.stubEnv('ADMIN_SESSION_SECRET', 'rotated-secret');
    expect(validateAdminToken(token)).toBe(false);
  });

  it('supports existing deployments with configured credentials and no additional secret', () => {
    vi.stubEnv('ADMIN_SESSION_SECRET', '');
    expect(validateAdminToken(generateAdminToken())).toBe(true);
  });
});
