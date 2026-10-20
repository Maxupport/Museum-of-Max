import 'server-only';
import { cache } from 'react';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { validateAdminToken } from '@/lib/auth';

export function getArticle(id: string, isAdmin: boolean, exhibitId?: string) {
  return prisma.writingsItem.findFirst({
    where: {
      id,
      ...(exhibitId ? { exhibitId } : {}),
      ...(!isAdmin ? { isHidden: false } : {}),
    },
  });
}

// Metadata and page rendering share the same visibility check and query.
export const getPageArticle = cache(async (exhibitId: string, id: string) => {
  const token = (await cookies()).get('admin_token')?.value;
  return getArticle(id, validateAdminToken(token), exhibitId);
});
