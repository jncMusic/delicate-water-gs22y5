import { INSTRUMENTS } from './lib/instruments';
import { COURSES } from './lib/courses';

export default function sitemap() {
  const instrumentUrls = INSTRUMENTS.map((i) => ({
    url: `https://jncmusic.kr/instruments/${i.id}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.9,
  }));

  const courseUrls = COURSES.map((c) => ({
    url: `https://jncmusic.kr/courses/${c.id}`,
    lastModified: new Date(),
    changeFrequency: 'monthly',
    priority: 0.7,
  }));

  return [
    { url: 'https://jncmusic.kr', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    ...instrumentUrls,
    ...courseUrls,
  ];
}
