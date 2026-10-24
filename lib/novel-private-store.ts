import 'server-only';
import { getVercelOidcTokenSync } from '@vercel/oidc';

// Verified in Vercel: ForMaxMuseum is already PRIVATE and connected to this
// project's Production/Preview with the sec_STORE_ID prefix. Do not scan tokens
// or fall back to the public Museum3 upload store.
export function novelPrivateStoreConfig(): { token: string } | { storeId: string; oidcToken: string } | null {
  if (process.env.NOVEL_PRIVATE_BLOB_READ_WRITE_TOKEN) return { token: process.env.NOVEL_PRIVATE_BLOB_READ_WRITE_TOKEN };
  // The SDK otherwise silently falls back to BLOB_READ_WRITE_TOKEN if OIDC is
  // unavailable, even when storeId was supplied. Never allow that public-token path.
  if (process.env.sec_STORE_ID === 'store_vvbDqZjeyID4ikVr') {
    try {
      // Runtime identity is injected into Vercel request context, not necessarily
      // process.env. The helper prefers that fresh context over a build-time token.
      const oidcToken = getVercelOidcTokenSync();
      if (oidcToken.trim()) return { storeId: process.env.sec_STORE_ID, oidcToken };
    } catch { /* No identity: fail closed, never use a public-store token. */ }
  }
  return null;
}
