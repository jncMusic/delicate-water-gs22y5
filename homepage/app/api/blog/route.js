import { NextResponse } from 'next/server';

export const revalidate = 3600; // 1시간 캐시

export async function GET() {
  try {
    const res = await fetch('https://rss.blog.naver.com/jncmusic.xml', {
      next: { revalidate: 3600 },
    });

    if (!res.ok) throw new Error('RSS fetch 실패');

    const xml = await res.text();

    // XML 파싱 (간단한 정규식)
    const items = [];
    const itemMatches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g);

    for (const match of itemMatches) {
      const block = match[1];

      const title = (block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) ||
        block.match(/<title>(.*?)<\/title>/))?.[1] ?? '';
      const link = (block.match(/<link>(.*?)<\/link>/) ||
        block.match(/<guid>(.*?)<\/guid>/))?.[1] ?? '';
      const pubDate = block.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? '';
      const description = (block.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ||
        block.match(/<description>([\s\S]*?)<\/description>/))?.[1] ?? '';

      // 썸네일 추출 (og:image 또는 첫 번째 img src)
      const thumbnail =
        description.match(/<img[^>]+src=["']([^"']+)["']/)?.[1] ?? null;

      if (title && link) {
        items.push({
          title: title.trim(),
          link: link.trim(),
          pubDate: pubDate.trim(),
          thumbnail,
        });
      }

      if (items.length >= 6) break;
    }

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
