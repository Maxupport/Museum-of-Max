import { Client } from '@notionhq/client';
import type { NotionProject } from '@/types/notion';

const apiKey = process.env.NOTION_API_KEY;
const isValidKey = apiKey && apiKey !== 'YOUR_NOTION_INTEGRATION_TOKEN';

// 配置 Notion Client: 使用 cache: 'no-store' 確保每一次呼叫都直接向 Notion 伺服器取得最新正本內容
export const notion = isValidKey ? new Client({
  auth: apiKey,
  fetch: (url, init) => fetch(url, { ...init, cache: 'no-store' })
}) : null;

/**
 * Retrieve all entries from a Notion database (projects / articles / novel chapters).
 * Returns real-time fresh NotionProject objects.
 */
export async function getProjects(databaseId: string): Promise<NotionProject[]> {
  if (!notion || !databaseId || databaseId === 'YOUR_NOTION_DATABASE_ID') {
    return [];
  }

  const pages: NotionProject[] = [];
  let cursor: string | undefined = undefined;

  try {
    do {
      const response: any = await (notion as any).databases.query({
        database_id: databaseId,
        start_cursor: cursor,
      });
      const results = response.results as any[];
      for (const page of results) {
        const properties = page.properties;
        const titleProp = properties['Title'];
        const slugProp = properties['Slug'];
        const coverProp = properties['Cover Image'];
        const excerptProp = properties['Excerpt'];
        const tagsProp = properties['Tags'];

        const title = titleProp?.title?.[0]?.plain_text ?? '';
        const slug = slugProp?.rich_text?.[0]?.plain_text ?? '';
        const coverImage = coverProp?.files?.[0]?.file?.url ?? '';
        const excerpt = excerptProp?.rich_text?.[0]?.plain_text ?? '';
        const tags = tagsProp?.multi_select?.map((t: any) => t.name) ?? [];

        pages.push({
          id: page.id,
          title,
          slug,
          coverImage,
          excerpt,
          tags,
        });
      }
      cursor = response.has_more ? response.next_cursor : undefined;
    } while (cursor);
  } catch (err) {
    console.warn('Failed to query Notion database:', err);
    return [];
  }

  return pages;
}
