import 'server-only';

// Verified in Vercel: ForMaxMuseum is already PRIVATE and connected to this
// project's Production/Preview with the sec_STORE_ID prefix. Do not scan tokens
// or fall back to the public Museum3 upload store.
export function novelPrivateStoreConfig(): { token: string } | { storeId: string } | null {
  if (process.env.NOVEL_PRIVATE_BLOB_READ_WRITE_TOKEN) return { token: process.env.NOVEL_PRIVATE_BLOB_READ_WRITE_TOKEN };
  if (process.env.sec_STORE_ID === 'store_vvbDqZjeyID4ikVr') return { storeId: process.env.sec_STORE_ID };
  return null;
}
