import { NextRequest, NextResponse } from 'next/server';
import { validateAdminRequest } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Counts = { total: number; owner: number; active: number; external: number; externalActive: number; externalInactive: number };
const requiredColumns = ['id', 'email', 'name', 'novelId', 'active', 'createdAt', 'sourceChapter', 'lastNotifiedAt', 'unsubscribeToken'];

export async function GET(request: NextRequest) {
  if (!validateAdminRequest(request)) return NextResponse.json({ ok: false }, { status: 401 });
  try {
    // Aggregate only the legacy base columns, so missing newer columns cannot be
    // mistaken for an empty list. No email, name or unsubscribe token is fetched.
    const [counts] = await prisma.$queryRaw<Counts[]>`
      WITH readers AS (
        SELECT active,
          split_part(lower(trim(email)), '@', 2) IN ('gmail.com', 'googlemail.com')
          AND replace(split_part(split_part(lower(trim(email)), '@', 1), '+', 1), '.', '') = 'maxupport' AS owner
        FROM public."Subscriber"
      )
      SELECT count(*)::int AS total, count(*) FILTER (WHERE owner)::int AS owner,
        count(*) FILTER (WHERE active)::int AS active,
        count(*) FILTER (WHERE NOT owner)::int AS external,
        count(*) FILTER (WHERE NOT owner AND active)::int AS "externalActive",
        count(*) FILTER (WHERE NOT owner AND NOT active)::int AS "externalInactive"
      FROM readers
    `;
    const columns = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'Subscriber'
    `;
    const missingColumns = requiredColumns.filter((name) => !columns.some((column) => column.column_name === name));
    if (!counts || Object.values(counts).some((value) => !Number.isSafeInteger(value) || value < 0)) throw new Error('Invalid counts');
    return NextResponse.json({ ok: true, data: { ...counts, checkedAt: new Date().toISOString(), missingColumns,
      schemaReady: missingColumns.length === 0 } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ ok: false, error: '無法核對正式訂閱人數；讀取失敗不代表名單為空。' }, { status: 503 });
  }
}
