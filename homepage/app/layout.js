import './globals.css';

export const metadata = {
  metadataBase: new URL('https://jncmusic.kr'),
  title: {
    default: 'JNC 음악학원 | 피아노·관현악·실용음악 전문 목동',
    template: '%s | JNC 음악학원',
  },
  description:
    'JNC 음악학원은 목동에서 피아노(클래식·재즈), 관현악(플루트·클라리넷·트럼펫·첼로), 실용음악(기타·베이스·드럼·보컬·건반·MIDI)을 전문으로 하는 음악학원입니다. 연습실 대여 가능. 유아부터 성인까지 1:1 맞춤 지도.',
  keywords: [
    'JNC 음악학원',
    'JNC음악학원',
    '목동 음악학원',
    '목동 피아노학원',
    '목동 실용음악',
    '클래식 피아노',
    '재즈 피아노',
    '플루트',
    '클라리넷',
    '트럼펫',
    '첼로',
    '기타',
    '베이스',
    '드럼',
    '보컬',
    '건반',
    'MIDI',
    '관현악',
    '실용음악',
    '연습실 대여',
    '양천구 음악학원',
    '음악교육',
    '1:1 맞춤 지도',
  ],
  authors: [{ name: 'JNC 음악학원' }],
  creator: 'JNC 음악학원',
  publisher: 'JNC 음악학원',
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    url: 'https://jncmusic.kr',
    siteName: 'JNC 음악학원',
    title: 'JNC 음악학원 | 피아노·관현악·실용음악 전문 목동',
    description:
      '목동 JNC 음악학원 — 클래식 피아노, 재즈 피아노, 플루트, 클라리넷, 트럼펫, 첼로, 기타, 베이스, 드럼, 보컬, 건반, MIDI. 연습실 대여 가능.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'JNC 음악학원 — 목동 피아노·관현악·실용음악',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'JNC 음악학원 | 피아노·관현악·실용음악 전문 목동',
    description: '목동 JNC 음악학원. 클래식·재즈 피아노, 관현악, 실용음악. 1:1 맞춤 지도.',
    images: ['/og-image.png'],
  },
  verification: {
    google: 'kD5yHt67QkPAjJTl5aAcoEb6nlOXZAF3q2TnBgYFOw0',
    other: {
      'naver-site-verification': 'db7fcca47bbb3561cf224a430b7a6c9f849c62c3',
    },
  },
  alternates: {
    canonical: 'https://jncmusic.kr',
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
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
              description:
                '피아노(클래식·재즈), 관현악(플루트·클라리넷·트럼펫·첼로), 실용음악(기타·베이스·드럼·보컬·건반·MIDI)을 전문으로 하는 목동 음악학원. 연습실 대여 가능.',
              url: 'https://jncmusic.kr',
              telephone: '02-2655-0520',
              address: {
                '@type': 'PostalAddress',
                streetAddress: '목동서로 35 목동프라자 3층 303호',
                addressLocality: '양천구',
                addressRegion: '서울특별시',
                postalCode: '07999',
                addressCountry: 'KR',
              },
              geo: {
                '@type': 'GeoCoordinates',
                latitude: 37.527,
                longitude: 126.865,
              },
              openingHoursSpecification: [
                {
                  '@type': 'OpeningHoursSpecification',
                  dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                  opens: '10:30',
                  closes: '22:00',
                },
                {
                  '@type': 'OpeningHoursSpecification',
                  dayOfWeek: ['Saturday', 'Sunday'],
                  opens: '09:00',
                  closes: '22:00',
                },
              ],
              hasOfferCatalog: {
                '@type': 'OfferCatalog',
                name: '수강 과목',
                itemListElement: [
                  {
                    '@type': 'Offer',
                    itemOffered: {
                      '@type': 'Course',
                      name: '피아노',
                      description: '클래식 피아노, 재즈 피아노',
                    },
                  },
                  {
                    '@type': 'Offer',
                    itemOffered: {
                      '@type': 'Course',
                      name: '관현악',
                      description: '플루트, 클라리넷, 트럼펫, 첼로',
                    },
                  },
                  {
                    '@type': 'Offer',
                    itemOffered: {
                      '@type': 'Course',
                      name: '실용음악',
                      description: '기타, 베이스, 드럼, 보컬, 건반, MIDI',
                    },
                  },
                  {
                    '@type': 'Offer',
                    itemOffered: {
                      '@type': 'Service',
                      name: '연습실 대여',
                      url: 'https://booking.naver.com/booking/10/bizes/187641?tr=bnm',
                    },
                  },
                ],
              },
              sameAs: [
                'https://www.instagram.com/jnc_music_academy/',
              ],
            }),
          }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
