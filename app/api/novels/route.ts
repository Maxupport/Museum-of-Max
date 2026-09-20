import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cookies } from 'next/headers';

// 驗證是否為策展人 (管理員)
async function isCuratorRequest(req: NextRequest): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get('is_curator')?.value === 'true';
}

/**
 * GET /api/novels
 * 取得所有小說最上層資訊，並附帶各小說的章節數與最新章節資訊。
 * 若某書名有 WritingsItem 章節但尚無 Novel 記錄，自動建立預設紀錄。
 */
export async function GET() {
  try {
    // 1. 取得所有 Novel 記錄
    const novels = await prisma.novel.findMany({
      orderBy: { order: 'asc' },
    });

    // 2. 取得所有「小說」category 的 WritingsItem，依 topic (書名) 分組，計算章節數
    const writingsItems = await prisma.writingsItem.findMany({
      where: {
        category: '小說',
        isHidden: false,
      },
      select: {
        id: true,
        topic: true,    // 書名存於 topic 欄位
        title: true,    // 章節名稱
        order: true,    // 章節排序
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { order: 'asc' },
    });

    // 3. 統計各書名的章節數與章節列表
    const chaptersByNovelTitle: Record<string, typeof writingsItems> = {};
    for (const item of writingsItems) {
      const novelTitle = item.topic || '未命名小說';
      if (!chaptersByNovelTitle[novelTitle]) {
        chaptersByNovelTitle[novelTitle] = [];
      }
      chaptersByNovelTitle[novelTitle].push(item);
    }

    // 4. 確保所有有章節但未建立 Novel 記錄的書名，自動補齊預設記錄
    const existingTitles = new Set(novels.map((n) => n.title));
    const titlesToCreate = Object.keys(chaptersByNovelTitle).filter(
      (t) => !existingTitles.has(t) && t !== '未命名小說'
    );

    if (titlesToCreate.length > 0) {
      await prisma.novel.createMany({
        data: titlesToCreate.map((title, idx) => ({
          title,
          author: 'Maxupport',
          status: '連載中',
          order: 100 + idx, // 放在最後
        })),
        skipDuplicates: true,
      });

      // 重新查詢（含新建的）
      const updatedNovels = await prisma.novel.findMany({
        orderBy: { order: 'asc' },
      });

      return NextResponse.json({
        ok: true,
        data: updatedNovels.map((novel) => {
          const chapters = chaptersByNovelTitle[novel.title] || [];
          const sortedChapters = [...chapters].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          const latestChapter = [...chapters].sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          )[0];
          return {
            ...novel,
            totalChapters: chapters.length,
            latestChapterTitle: latestChapter?.title || null,
            latestUpdatedAt: latestChapter?.updatedAt || null,
            chapters: sortedChapters.map((c) => ({
              id: c.id,
              title: c.title,
              order: c.order,
            })),
          };
        }),
      });
    }

    // 5. 組合回傳資料（附帶章節數與章節列表）
    const data = novels.map((novel) => {
      const chapters = chaptersByNovelTitle[novel.title] || [];
      const sortedChapters = [...chapters].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const latestChapter = [...chapters].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )[0];
      return {
        ...novel,
        totalChapters: chapters.length,
        latestChapterTitle: latestChapter?.title || null,
        latestUpdatedAt: latestChapter?.updatedAt || null,
        chapters: sortedChapters.map((c) => ({
          id: c.id,
          title: c.title,
          order: c.order,
        })),
      };
    });

    return NextResponse.json({ ok: true, data });
  } catch (err) {
    console.error('[GET /api/novels] Error:', err);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/novels
 * 新增一本小說的最上層資訊（需策展人身份）。
 * Body: { title, author, coverUrl, description, status, order }
 */
export async function POST(req: NextRequest) {
  if (!await isCuratorRequest(req)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { title, author, coverUrl, description, status, order } = body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ ok: false, error: '小說書名為必填欄位' }, { status: 400 });
    }

    const novel = await prisma.novel.upsert({
      where: { title: title.trim() },
      update: {
        author: author || 'Maxupport',
        coverUrl: coverUrl || null,
        description: description || null,
        status: status || '連載中',
        order: typeof order === 'number' ? order : 0,
      },
      create: {
        title: title.trim(),
        author: author || 'Maxupport',
        coverUrl: coverUrl || null,
        description: description || null,
        status: status || '連載中',
        order: typeof order === 'number' ? order : 0,
      },
    });

    return NextResponse.json({ ok: true, data: novel });
  } catch (err) {
    console.error('[POST /api/novels] Error:', err);
    return NextResponse.json({ ok: false, error: 'Internal server error' }, { status: 500 });
  }
}
