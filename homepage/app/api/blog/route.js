import { NextResponse } from 'next/server';

function extractCDATA(xml, tag) {
  const re = new RegExp(`<${tag}>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`);
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

function extractTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`);
  const m = xml.match(re);
  return m ? m[1].trim() : null;
}

function parseRSS(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = re.exec(xml)) !== null) {
    const item = match[1];
    const title = extractCDATA(item, 'title') || extractTag(item, 'title') || '';
    const link = extractTag(item, 'link') || '';
    const pubDate = extractTag(item, 'pubDate') || '';
    const description =
      extractCDATA(item, 'description') || extractTag(item, 'description') || '';

    // 썸네일: description 안의 첫 번째 img src
    const thumbMatch = description.match(/<img[^>]+src=["']([^"']+)["']/i);
    const thumbnail = thumbMatch ? thumbMatch[1] : null;

    // 본문 요약: HTML 태그 제거 후 100자
    const excerpt = description.replace(/<[^>]+>/g, '').trim().slice(0, 100);

    const date = pubDate
      ? new Date(pubDate).toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      : '';

    if (title) items.push({ title, link, date, excerpt, thumbnail });
  }
  return items.slice(0, 6);
}

export async function GET() {
  try {
    const res = await fetch('https://rss.blog.naver.com/jncmusicacademy.xml', {
      next: { revalidate: 3600 },
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JNCBot/1.0)' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const xml = await res.text();
    const items = parseRSS(xml);
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json({ items: [], error: String(e) });
  }
}
