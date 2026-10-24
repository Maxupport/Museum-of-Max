import 'server-only';

// Verified in Vercel: ForMaxMuseum is already PRIVATE and connected to this
// project's Production/Preview with the sec_STORE_ID prefix. Do not scan tokens
// or fall back to the public Museum3 upload store.
export function novelPrivateStoreConfig(): { token: string } | { storeId: string; oidcToken: string } | null {
  if (process.env.NOVEL_PRIVATE_BLOB_READ_WRITE_TOKEN) return { token: process.env.NOVEL_PRIVATE_BLOB_READ_WRITE_TOKEN };
  // The SDK otherwise silently falls back to BLOB_READ_WRITE_TOKEN if OIDC is
  // unavailable, even when storeId was supplied. Never allow that public-token path.
  if (process.env.sec_STORE_ID === 'store_vvbDqZjeyID4ikVr' && process.env.VERCEL_OIDC_TOKEN?.trim())
    return { storeId: process.env.sec_STORE_ID, oidcToken: process.env.VERCEL_OIDC_TOKEN };
  return null;
}
