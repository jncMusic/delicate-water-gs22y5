import './globals.css';

export const metadata = {
  metadataBase: new URL('https://jncmusic.kr'),
  title: {
    default: 'JNC 음악학원 | 피아노·관현악·실용음악·성악 전문',
    template: '%s | JNC 음악학원',
  },
  description:
    'JNC 음악학원은 피아노, 관현악, 실용음악, 성악을 전문으로 하는 음악학원입니다. 최고의 강사진과 체계적인 1:1 맞춤 커리큘럼으로 음악의 꿈을 이루어 드립니다. 유아부터 성인까지 전 연령 수강 가능.',
  keywords: [
    'JNC 음악학원',
    'JNC음악학원',
    '음악학원',
    '피아노학원',
    '관현악',
    '실용음악',
    '성악',
    '바이올린',
    '첼로',
    '플루트',
    '기타',
    '드럼',
    '보컬',
    '음악교육',
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
    title: 'JNC 음악학원 | 피아노·관현악·실용음악·성악 전문',
    description:
      '최고의 강사진과 체계적인 1:1 맞춤 커리큘럼. 피아노, 관현악, 실용음악, 성악 전 과목 수강 가능.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'JNC 음악학원',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'JNC 음악학원 | 피아노·관현악·실용음악·성악 전문',
    description: '최고의 강사진과 체계적인 1:1 맞춤 커리큘럼.',
    images: ['/og-image.png'],
  },
  verification: {
    google: '',
    naver: '',
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
              alternateName: ['JNC음악학원', 'JNC Music Academy'],
              description:
                '피아노, 관현악, 실용음악, 성악을 전문으로 하는 음악학원',
              url: 'https://jncmusic.kr',
              telephone: '',
              address: {
                '@type': 'PostalAddress',
                addressCountry: 'KR',
                addressLocality: '',
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
                  { '@type': 'Offer', itemOffered: { '@type': 'Course', name: '피아노' } },
                  { '@type': 'Offer', itemOffered: { '@type': 'Course', name: '관현악' } },
                  { '@type': 'Offer', itemOffered: { '@type': 'Course', name: '실용음악' } },
                  { '@type': 'Offer', itemOffered: { '@type': 'Course', name: '성악' } },
                ],
              },
            }),
          }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
