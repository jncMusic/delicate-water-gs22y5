import './globals.css';

export const metadata = {
  metadataBase: new URL('https://jncmusic.kr'),
  title: {
    default: 'JNC 음악학원 | 목동 · 양천구 클래식 · 실용음악 전문',
    template: '%s | JNC 음악학원',
  },
  description:
    '서울 목동 · 양천구 JNC 음악학원. 2013년 개원, 누적 수강생 2000명+. 피아노·플루트·클라리넷·색소폰·오보에·트럼펫·첼로·보컬·기타·드럼·베이스·작곡·미디 전문. 취미부터 음대 입시·실용음악과 입시까지 1:1 맞춤 레슨.',
  keywords: [
    'JNC 음악학원', 'JNC음악학원',
    '목동 음악학원', '양천구 음악학원', '목동 피아노학원',
    '목동 기타학원', '목동 드럼학원', '목동 보컬학원',
    '목동 플루트', '목동 색소폰', '목동 첼로',
    '목동 실용음악', '목동 클래식',
    '양천구 피아노', '양천구 기타', '양천구 드럼',
    '음악학원', '피아노학원', '기타학원', '드럼학원', '보컬학원',
    '클라리넷', '오보에', '트럼펫', '베이스', '작곡', '미디',
    '음대 입시', '실용음악과 입시', '취미 음악', '성인 피아노',
    '취미 기타', '취미 드럼', '지역 아티스트',
  ],
  authors: [{ name: 'JNC 음악학원' }],
  creator: 'JNC 음악학원',
  publisher: 'JNC 음악학원',
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: 'https://jncmusic.kr',
    siteName: 'JNC 음악학원',
    title: 'JNC 음악학원 | 목동 · 양천구 클래식 · 실용음악 전문',
    description: '2013년 개원, 누적 수강생 2000명+. 목동·양천구 음악학원. 취미부터 입시까지 1:1 맞춤 레슨.',
    images: [{ url: '/og-image.png', width: 1200, height: 630, alt: 'JNC 음악학원' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'JNC 음악학원 | 목동 · 양천구 클래식 · 실용음악 전문',
    description: '2013년 개원, 누적 수강생 2000명+. 취미부터 입시까지 1:1 맞춤 레슨.',
    images: ['/og-image.png'],
  },
  verification: { google: '', naver: 'db7fcca47bbb3561cf224a430b7a6c9f849c62c3' },
  alternates: { canonical: 'https://jncmusic.kr' },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <meta name="naver-site-verification" content="db7fcca47bbb3561cf224a430b7a6c9f849c62c3" />
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'MusicSchool',
              name: 'JNC 음악학원',
              alternateName: ['JNC음악학원', 'JNC Music Academy', '목동 JNC 음악학원'],
              description: '2013년 개원. 목동·양천구 클래식·실용음악 전문 음악학원. 취미부터 음대 입시까지.',
              url: 'https://jncmusic.kr',
              telephone: '02-2655-0520',
              foundingDate: '2013',
              address: {
                '@type': 'PostalAddress',
                streetAddress: '목동서로 35, 목동프라자 3층 303호',
                addressLocality: '양천구',
                addressRegion: '서울특별시',
                postalCode: '07999',
                addressCountry: 'KR',
              },
              geo: {
                '@type': 'GeoCoordinates',
                latitude: '37.527',
                longitude: '126.865',
              },
              openingHoursSpecification: [
                {
                  '@type': 'OpeningHoursSpecification',
                  dayOfWeek: ['Monday','Tuesday','Wednesday','Thursday','Friday'],
                  opens: '10:30',
                  closes: '22:00',
                },
                {
                  '@type': 'OpeningHoursSpecification',
                  dayOfWeek: ['Saturday','Sunday'],
                  opens: '09:00',
                  closes: '22:00',
                },
              ],
              hasOfferCatalog: {
                '@type': 'OfferCatalog',
                name: '수강 과목',
                itemListElement: [
                  '피아노','플루트','클라리넷','색소폰','오보에','트럼펫','첼로',
                  '보컬','작곡','미디','기타','드럼','베이스',
                ].map((name) => ({
                  '@type': 'Offer',
                  itemOffered: { '@type': 'Course', name },
                })),
              },
              sameAs: ['https://www.instagram.com/jnc_music_academy/'],
            }),
          }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
