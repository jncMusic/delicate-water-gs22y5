import { notFound } from 'next/navigation';
import { ArrowLeft, Phone, MessageCircle, CheckCircle } from 'lucide-react';
import { INSTRUMENTS, getInstrument } from '../../lib/instruments';

export function generateStaticParams() {
  return INSTRUMENTS.map((i) => ({ id: i.id }));
}

export function generateMetadata({ params }) {
  const inst = getInstrument(params.id);
  if (!inst) return {};
  return {
    title: inst.title,
    description: inst.description,
    keywords: inst.keywords,
    alternates: { canonical: `https://jncmusic.kr/instruments/${inst.id}` },
    openGraph: {
      type: 'website',
      locale: 'ko_KR',
      url: `https://jncmusic.kr/instruments/${inst.id}`,
      siteName: 'JnC 음악학원',
      title: inst.title,
      description: inst.description,
      images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: inst.title }],
    },
  };
}

export default function InstrumentPage({ params }) {
  const inst = getInstrument(params.id);
  if (!inst) notFound();

  return (
    <div className="min-h-screen bg-white">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'Course',
            name: `${inst.name} 레슨`,
            description: inst.description,
            provider: {
              '@type': 'MusicSchool',
              name: 'JnC 음악학원',
              url: 'https://jncmusic.kr',
              address: {
                '@type': 'PostalAddress',
                streetAddress: '목동서로 35, 목동프라자 3층',
                addressLocality: '양천구',
                addressRegion: '서울특별시',
                addressCountry: 'KR',
              },
              telephone: '010-4028-9803',
            },
            url: `https://jncmusic.kr/instruments/${inst.id}`,
          }),
        }}
      />

      {/* 헤더 */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-[#0d1b3e]/95 backdrop-blur-md shadow-lg py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <span className="text-[#d4a843] font-black text-xl tracking-tight">JnC</span>
            <span className="text-white font-semibold text-sm hidden sm:block">음악학원</span>
          </a>
          <a
            href="/"
            className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm transition-colors"
          >
            <ArrowLeft size={15} />
            홈으로
          </a>
        </div>
      </header>

      {/* 히어로 */}
      <section className="pt-24 pb-16 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-[#0d1b3e] to-[#1a3a7a]">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-[#d4a843] text-sm font-bold tracking-widest uppercase mb-4">
            {inst.categoryLabel}
          </p>
          <div className="text-7xl mb-6">{inst.icon}</div>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-4 leading-tight">
            {inst.keyword}
          </h1>
          <p className="text-white/70 text-lg leading-relaxed max-w-2xl mx-auto">
            {inst.hero}
          </p>
        </div>
      </section>

      {/* 소개 */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-[#0d1b3e] mb-4">
            JnC 음악학원 {inst.name} 레슨 소개
          </h2>
          <p className="text-slate-600 text-lg leading-relaxed">{inst.summary}</p>
        </div>
      </section>

      {/* 대상 */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-50">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-[#0d1b3e] mb-8">이런 분께 추천해요</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {inst.targets.map((t) => (
              <div key={t.label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle size={16} className="text-[#d4a843]" />
                  <span className="font-bold text-[#0d1b3e]">{t.label}</span>
                </div>
                <p className="text-slate-500 text-sm leading-relaxed">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 커리큘럼 */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-[#0d1b3e] mb-8">커리큘럼</h2>
          <ol className="space-y-4">
            {inst.curriculum.map((step, i) => (
              <li key={i} className="flex items-start gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-[#0d1b3e] text-[#d4a843] font-bold text-sm flex items-center justify-center">
                  {i + 1}
                </span>
                <span className="text-slate-700 text-base leading-relaxed pt-1">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-[#0d1b3e]">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-white mb-2">
            {inst.name} 레슨 상담 문의
          </h2>
          <p className="text-white/60 mb-8 text-sm">
            서울 양천구 목동서로 35, 목동프라자 3층 · 1:1 맞춤 레슨
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="tel:010-4028-9803"
              className="flex items-center justify-center gap-2 bg-[#d4a843] text-[#0d1b3e] font-bold px-7 py-3.5 rounded-xl hover:bg-[#e0b84e] transition-colors"
            >
              <Phone size={17} />
              전화 상담
            </a>
            <a
              href="https://talk.naver.com/profile/w4xhyc"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 bg-white/10 text-white font-bold px-7 py-3.5 rounded-xl hover:bg-[#03c75a] hover:border-[#03c75a] transition-colors border border-white/20"
            >
              <MessageCircle size={17} />
              네이버 톡톡 문의
            </a>
          </div>
        </div>
      </section>

      {/* 푸터 */}
      <footer className="py-8 px-4 text-center bg-[#070e20]">
        <a href="/" className="text-[#d4a843] font-black text-lg tracking-tight">JnC 음악학원</a>
        <p className="text-white/30 text-xs mt-2">
          서울 양천구 목동서로 35, 목동프라자 3층 · 010-4028-9803
        </p>
      </footer>
    </div>
  );
}
