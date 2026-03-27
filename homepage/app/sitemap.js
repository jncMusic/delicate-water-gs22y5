export default function sitemap() {
  return [
    { url: 'https://jncmusic.kr',                  lastModified: new Date(), changeFrequency: 'monthly', priority: 1 },
    { url: 'https://jncmusic.kr/courses/classic',   lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://jncmusic.kr/courses/practical', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
  ];
}
