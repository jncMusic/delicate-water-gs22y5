'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Music,
  Phone,
  MapPin,
  Clock,
  Instagram,
  ChevronDown,
  Menu,
  X,
  MessageCircle,
  ArrowRight,
  Users,
  Award,
  BookOpen,
  Star,
  ExternalLink,
} from 'lucide-react';

// =================================================================
// 상수 데이터
// =================================================================

const NAV_ITEMS = [
  { label: '학원 소개', href: '#about' },
  { label: '수강 과목', href: '#courses' },
  { label: '강사 소개', href: '#teachers' },
  { label: '수강 신청', href: '#enroll' },
  { label: '오시는 길', href: '#location' },
];

const COURSES = [
  {
    id: 'piano',
    title: '피아노',
    titleEn: 'Piano',
    icon: '🎹',
    color: 'from-blue-900 to-[#0d1b3e]',
    borderHover: 'hover:border-blue-400/40',
    description: '클래식의 기초부터 재즈의 자유로운 표현까지. 입문자부터 입시·전공자까지 1:1 맞춤 지도합니다.',
    instruments: ['클래식 피아노', '재즈 피아노'],
  },
  {
    id: 'orchestral',
    title: '관현악',
    titleEn: 'Orchestral',
    icon: '🎻',
    color: 'from-emerald-900 to-[#0d1b3e]',
    borderHover: 'hover:border-emerald-400/40',
    description: '현악·목관·금관 악기를 전문 강사진과 함께. 취미부터 입시·오케스트라 활동까지 지원합니다.',
    instruments: ['플루트', '클라리넷', '트럼펫', '첼로'],
  },
  {
    id: 'practical',
    title: '실용음악',
    titleEn: 'Practical Music',
    icon: '🎸',
    color: 'from-orange-900 to-[#0d1b3e]',
    borderHover: 'hover:border-orange-400/40',
    description: '밴드·보컬·작편곡까지 현장 중심의 커리큘럼. 전공 준비부터 취미 연주까지 모든 레벨을 지도합니다.',
    instruments: ['기타', '베이스', '드럼', '보컬', '건반', 'MIDI'],
  },
];

const STATS = [
  { icon: Users, value: '500+', label: '누적 수강생' },
  { icon: Award, value: '10+', label: '전문 강사진' },
  { icon: BookOpen, value: '3개', label: '수강 과목' },
  { icon: Star, value: '15년+', label: '음악 교육 경력' },
];

const INSTRUCTORS = [
  { name: "강열혁", role: "원장", instrument: "플루트", desc: "연세대 석사 / 현) JnC Music Lab 대표", icon: "🎶" },
  { name: "조국화", instrument: "피아노", icon: "🎹" },
  { name: "김소형", instrument: "피아노", icon: "🎹" },
  { name: "최지영", instrument: "피아노", icon: "🎹" },
  { name: "김맑음", instrument: "오보에", icon: "🎷" },
  { name: "이윤석", instrument: "베이스", icon: "🎸" },
  { name: "남선오", instrument: "베이스", icon: "🎸" },
  { name: "문세영", instrument: "보컬", icon: "🎤" },
  { name: "권시문", instrument: "드럼", icon: "🥁" },
  { name: "천가희", instrument: "드럼", icon: "🥁" },
  { name: "태유민", instrument: "드럼", icon: "🥁" },
  { name: "김여빈", instrument: "기타", icon: "🎸" },
  { name: "이상현", instrument: "기타", icon: "🎸" },
  { name: "공성윤", instrument: "기타", icon: "🎸" },
  { name: "한수정", instrument: "트럼펫", icon: "🎺" },
];

const HOURS = [
  { day: '월 – 금', time: '10:30 – 22:00' },
  { day: '토 · 일', time: '09:00 – 22:00' },
  { day: '공휴일', time: '휴원 (별도 공지)' },
];

// =================================================================
// 메인 컴포넌트
// =================================================================

export default function HomePage() {
  const [showDashboard, setShowDashboard] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState('');
  const iframeRef = useRef(null);

  // 스크롤 감지 → 헤더 스타일 변경
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 60);

      // 현재 섹션 감지
      const sections = ['about', 'courses', 'teachers', 'enroll', 'location'];
      for (const id of sections.reverse()) {
        const el = document.getElementById(id);
        if (el && window.scrollY >= el.offsetTop - 120) {
          setActiveSection(id);
          break;
        }
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 대시보드 오픈 시 body 스크롤 잠금
  useEffect(() => {
    document.body.style.overflow = showDashboard ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showDashboard]);

  const openDashboard = () => {
    setMobileMenuOpen(false);
    setShowDashboard(true);
  };

  const scrollTo = (href) => {
    setMobileMenuOpen(false);
    const id = href.replace('#', '');
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  // =================================================================
  // 대시보드 iframe 오버레이
  // =================================================================
  if (showDashboard) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-100">
        {/* 상단 바 */}
        <div className="flex items-center justify-between bg-[#0d1b3e] px-4 py-2.5 shrink-0 shadow-lg">
          <button
            onClick={() => setShowDashboard(false)}
            className="flex items-center gap-2 text-white/80 hover:text-[#d4a843] transition-colors text-sm font-medium"
          >
            <X size={16} />
            홈으로 돌아가기
          </button>
          <span className="text-white font-bold text-sm tracking-wide">
            JNC 음악학원 강사 시스템
          </span>
          <a
            href="https://jncmusic.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-white/60 hover:text-white transition-colors text-xs"
          >
            새 탭으로 열기
            <ExternalLink size={12} />
          </a>
        </div>
        {/* 대시보드 iframe */}
        <iframe
          ref={iframeRef}
          src="https://jncmusic.vercel.app"
          className="flex-1 w-full border-0"
          title="JNC 음악학원 강사 시스템"
          allow="clipboard-write; fullscreen"
        />
      </div>
    );
  }

  // =================================================================
  // 홈페이지
  // =================================================================
  return (
    <>
      {/* ── 헤더 ── */}
      <header
        className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
          scrolled
            ? 'bg-[#0d1b3e]/95 backdrop-blur-md shadow-lg shadow-black/30 py-3'
            : 'bg-transparent py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* 로고 */}
          <a
            href="#"
            onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            className="flex items-center gap-2 select-none"
          >
            <div className="w-9 h-9 rounded-lg bg-[#d4a843] flex items-center justify-center shadow-md">
              <Music size={20} className="text-[#0d1b3e]" />
            </div>
            <div className="leading-tight">
              <span className="block text-[#d4a843] font-extrabold text-lg tracking-tight">JNC</span>
              <span className="block text-white text-[10px] tracking-widest font-medium opacity-80">음악학원</span>
            </div>
          </a>

          {/* 데스크탑 네비게이션 */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.href}
                onClick={() => scrollTo(item.href)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  activeSection === item.href.replace('#', '')
                    ? 'text-[#d4a843]'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* 강사 로그인 버튼 */}
          <div className="flex items-center gap-3">
            <button
              onClick={openDashboard}
              className="hidden md:flex items-center gap-2 bg-[#d4a843] hover:bg-[#e8b33a] text-[#0d1b3e] text-sm font-bold px-4 py-2 rounded-lg transition-all shadow-md shadow-[#d4a843]/20 hover:shadow-[#d4a843]/40 hover:-translate-y-0.5"
            >
              강사 로그인
            </button>
            {/* 모바일 햄버거 */}
            <button
              className="md:hidden text-white p-1"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="메뉴 열기"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* 모바일 메뉴 */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0d1b3e]/98 backdrop-blur-md border-t border-white/10 px-4 pb-4 pt-2 space-y-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.href}
                onClick={() => scrollTo(item.href)}
                className="block w-full text-left px-4 py-3 text-white/80 hover:text-white hover:bg-white/10 rounded-lg text-sm font-medium transition-colors"
              >
                {item.label}
              </button>
            ))}
            <button
              onClick={openDashboard}
              className="w-full mt-2 bg-[#d4a843] text-[#0d1b3e] font-bold py-3 rounded-lg text-sm"
            >
              강사 로그인
            </button>
          </div>
        )}
      </header>

      <main>
        {/* ── 히어로 ── */}
        <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#080f22]">
          {/* 배경 그라디언트 */}
          <div className="absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-br from-[#080f22] via-[#0d1b3e] to-[#142c58]" />
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#d4a843]/5 rounded-full blur-3xl" />
            <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl" />
            {/* 악보 라인 장식 */}
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="absolute left-0 right-0 border-t border-white/[0.03]"
                style={{ top: `${28 + i * 4}%` }}
              />
            ))}
          </div>

          <div className="relative z-10 text-center px-4 sm:px-6 max-w-5xl mx-auto">
            {/* 배지 */}
            <div className="inline-flex items-center gap-2 bg-[#d4a843]/10 border border-[#d4a843]/30 text-[#d4a843] text-xs font-semibold px-4 py-1.5 rounded-full mb-8 tracking-wider">
              <Music size={12} />
              JNC 음악학원
            </div>

            {/* 메인 슬로건 */}
            <h1 className="text-5xl sm:text-7xl lg:text-8xl font-extrabold text-white mb-4 tracking-tight leading-none">
              Grow with
              <br />
              <span
                style={{
                  background: 'linear-gradient(135deg, #d4a843 0%, #f0cc6e 50%, #c9912d 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Music
              </span>
            </h1>

            {/* 서브 텍스트 */}
            <p className="text-white/60 text-lg sm:text-xl max-w-xl mx-auto mt-6 mb-10 leading-relaxed">
              피아노 · 관현악 · 실용음악
              <br className="hidden sm:block" />
              <span className="text-white/80"> 유아부터 성인까지, 수준에 맞는 1:1 맞춤 지도</span>
            </p>

            {/* CTA 버튼 */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button
                onClick={() => scrollTo('#enroll')}
                className="flex items-center gap-2 bg-[#d4a843] hover:bg-[#e8b33a] text-[#0d1b3e] font-bold px-8 py-4 rounded-xl text-base transition-all shadow-xl shadow-[#d4a843]/25 hover:shadow-[#d4a843]/40 hover:-translate-y-1"
              >
                수강 신청 문의
                <ArrowRight size={18} />
              </button>
              <button
                onClick={() => scrollTo('#courses')}
                className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold px-8 py-4 rounded-xl text-base transition-all hover:-translate-y-1"
              >
                수강 과목 보기
                <ChevronDown size={18} />
              </button>
            </div>
          </div>

          {/* 스크롤 인디케이터 */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-white/30">
            <span className="text-xs tracking-widest">SCROLL</span>
            <ChevronDown size={16} className="animate-bounce" />
          </div>
        </section>

        {/* ── 학원 소개 ── */}
        <section id="about" className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              {/* 텍스트 */}
              <div>
                <p className="text-[#d4a843] text-sm font-bold tracking-widest uppercase mb-3">About JNC</p>
                <h2 className="text-4xl sm:text-5xl font-extrabold text-[#0d1b3e] leading-tight mb-6">
                  음악과 함께
                  <br />
                  성장하는 공간
                </h2>
                <p className="text-slate-600 text-lg leading-relaxed mb-5">
                  JNC 음악학원은 목동 지역에서 피아노, 관현악, 실용음악을 전문으로 가르치는 음악 교육 기관입니다.
                </p>
                <p className="text-slate-600 leading-relaxed mb-8">
                  단순한 연주 기술 습득을 넘어, 음악을 통해 창의성과 표현력을 키울 수 있도록 학생 개개인의 성향과 목표에 맞는 1:1 맞춤 커리큘럼을 제공합니다. 유아·초등부터 입시·성인반까지, 음악을 사랑하는 모든 분들을 환영합니다.
                </p>
                <button
                  onClick={() => scrollTo('#enroll')}
                  className="inline-flex items-center gap-2 text-[#d4a843] font-bold hover:gap-4 transition-all group"
                >
                  수강 신청 문의하기
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              {/* 통계 그리드 */}
              <div className="grid grid-cols-2 gap-4">
                {STATS.map(({ icon: Icon, value, label }) => (
                  <div
                    key={label}
                    className="bg-[#0d1b3e] rounded-2xl p-6 flex flex-col items-start gap-3 hover:-translate-y-1 transition-transform"
                  >
                    <div className="w-10 h-10 bg-[#d4a843]/15 rounded-lg flex items-center justify-center">
                      <Icon size={20} className="text-[#d4a843]" />
                    </div>
                    <div>
                      <div className="text-3xl font-extrabold text-white">{value}</div>
                      <div className="text-sm text-white/50 mt-0.5">{label}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── 수강 과목 ── */}
        <section id="courses" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#080f22]">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-[#d4a843] text-sm font-bold tracking-widest uppercase mb-3">Courses</p>
              <h2 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight">
                수강 과목
              </h2>
              <p className="text-white/50 mt-4 text-lg max-w-xl mx-auto">
                각 분야 전문 강사진이 직접 1:1로 지도합니다
              </p>
            </div>

            {/* 과목 카드 3열 */}
            <div className="grid sm:grid-cols-3 gap-6 mb-6">
              {COURSES.map((course) => (
                <div
                  key={course.id}
                  className={`group relative bg-[#0d1b3e] border border-white/10 rounded-2xl p-7 overflow-hidden hover:-translate-y-2 ${course.borderHover} transition-all duration-300`}
                >
                  <div className={`absolute inset-0 bg-gradient-to-br ${course.color} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                  <div className="relative z-10">
                    <div className="text-4xl mb-5">{course.icon}</div>
                    <h3 className="text-white font-extrabold text-2xl mb-0.5">{course.title}</h3>
                    <p className="text-[#d4a843]/60 text-xs font-semibold tracking-widest uppercase mb-4">{course.titleEn}</p>
                    <p className="text-white/55 text-sm leading-relaxed mb-6">{course.description}</p>
                    {/* 악기 목록 */}
                    <div className="border-t border-white/10 pt-5">
                      <p className="text-white/30 text-[10px] font-bold tracking-widest uppercase mb-3">개설 악기</p>
                      <div className="flex flex-wrap gap-2">
                        {course.instruments.map((inst) => (
                          <span
                            key={inst}
                            className="text-xs font-semibold bg-white/8 text-white/75 border border-white/10 px-3 py-1.5 rounded-lg group-hover:bg-[#d4a843]/15 group-hover:text-[#d4a843] group-hover:border-[#d4a843]/30 transition-colors"
                          >
                            {inst}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* 연습실 대여 — 가로 전체 배너 */}
            <a
              href="https://booking.naver.com/booking/10/bizes/187641?tr=bnm"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between bg-[#0d1b3e] border border-white/10 hover:border-[#d4a843]/50 rounded-2xl px-8 py-6 transition-all duration-300 hover:-translate-y-1 overflow-hidden relative"
            >
              {/* 배경 글로우 */}
              <div className="absolute inset-0 bg-gradient-to-r from-[#d4a843]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative z-10 flex items-center gap-5">
                <div className="w-14 h-14 bg-[#d4a843]/15 group-hover:bg-[#d4a843]/25 rounded-xl flex items-center justify-center text-2xl shrink-0 transition-colors">
                  🎵
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <h3 className="text-white font-extrabold text-xl">연습실 대여</h3>
                    <span className="text-[10px] font-bold bg-[#d4a843]/20 text-[#d4a843] px-2.5 py-1 rounded-full border border-[#d4a843]/30 tracking-wider">RENTAL</span>
                  </div>
                  <p className="text-white/50 text-sm">네이버 예약을 통해 간편하게 연습실을 대여하세요</p>
                </div>
              </div>
              <div className="relative z-10 flex items-center gap-2 bg-[#d4a843] group-hover:bg-[#e8b33a] text-[#0d1b3e] font-bold text-sm px-5 py-2.5 rounded-xl transition-colors shrink-0 ml-4">
                예약하기
                <ArrowRight size={16} />
              </div>
            </a>
          </div>
        </section>

        {/* ── 강사 소개 ── */}
<section id="teachers" className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-50">
  <div className="max-w-7xl mx-auto">
    <div className="text-center mb-16">
      <p className="text-[#d4a843] text-sm font-bold tracking-widest uppercase mb-3">Instructors</p>
      <h2 className="text-4xl sm:text-5xl font-extrabold text-[#0d1b3e] leading-tight">
        최고의 강사진
      </h2>
      <p className="text-slate-500 mt-4 text-lg max-w-xl mx-auto">
        각 분야에서 활발히 활동 중인 전문 아티스트들이<br className="hidden sm:block" />
        열정적으로 지도를 도와드립니다.
      </p>
    </div>

    {/* 강사 카드 그리드 */}
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-6">
      {INSTRUCTORS.map((teacher, index) => (
        <div 
          key={index} 
          className={`group relative bg-white border border-slate-200 rounded-2xl p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
            teacher.role === "원장" ? "border-[#d4a843] ring-1 ring-[#d4a843]/20" : ""
          }`}
        >
          {/* 원장님 강조 표시 */}
          {teacher.role === "원장" && (
            <div className="absolute top-3 right-3 bg-[#d4a843] text-[#0d1b3e] text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
              Director
            </div>
          )}

          <div className="flex flex-col items-center text-center">
            {/* 악기 아이콘 */}
            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-2xl mb-4 group-hover:scale-110 transition-transform">
              {teacher.icon}
            </div>

            {/* 이름 및 정보 */}
            <h3 className="text-[#0d1b3e] font-bold text-lg mb-1">
              {teacher.name}
            </h3>
            <p className="text-[#d4a843] text-xs font-semibold mb-3">
              {teacher.instrument}
            </p>
            
            {/* 설명 (원장님 등 특수 정보가 있을 때만 출력) */}
            {teacher.desc && (
              <p className="text-slate-400 text-[11px] leading-relaxed break-keep">
                {teacher.desc}
              </p>
            )}
            
            {!teacher.desc && (
              <div className="w-8 h-0.5 bg-slate-100 rounded-full mt-2" />
            )}
          </div>
        </div>
      ))}
    </div>

    {/* 하단 안내 */}
    <div className="mt-16 text-center">
      <div className="inline-flex items-center gap-3 bg-white border border-slate-200 px-6 py-4 rounded-2xl shadow-sm">
        <div className="flex -space-x-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px]">
              👤
            </div>
          ))}
        </div>
        <p className="text-slate-600 text-sm font-medium">
          총 <span className="text-[#0d1b3e] font-bold">15명</span>의 전문 강사진이 함께합니다.
        </p>
      </div>
    </div>
  </div>
</section>

        {/* ── 수강 신청 ── */}
        <section id="enroll" className="py-24 px-4 sm:px-6 lg:px-8 bg-[#0d1b3e]">
          <div className="max-w-5xl mx-auto text-center">
            <p className="text-[#d4a843] text-sm font-bold tracking-widest uppercase mb-3">Enrollment</p>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight mb-4">
              수강 신청 안내
            </h2>
            <p className="text-white/50 text-lg mb-14 max-w-lg mx-auto">
              전화, 네이버 톡톡, 방문 상담을 통해 편하게 문의해 주세요
            </p>

            <div className="grid sm:grid-cols-3 gap-5 mb-12">
              {/* 전화 문의 */}
              <a
                href="tel:02-2655-0520"
                className="group bg-white/5 hover:bg-[#d4a843] border border-white/10 hover:border-[#d4a843] rounded-2xl p-7 flex flex-col items-center gap-4 transition-all duration-300 hover:-translate-y-1"
              >
                <div className="w-12 h-12 bg-[#d4a843]/15 group-hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors">
                  <Phone size={24} className="text-[#d4a843] group-hover:text-[#0d1b3e]" />
                </div>
                <div>
                  <div className="text-white group-hover:text-[#0d1b3e] font-bold text-base mb-1 transition-colors">전화 문의</div>
                  <div className="text-[#d4a843] group-hover:text-[#0d1b3e]/70 font-semibold text-lg transition-colors">02-2655-0520</div>
                </div>
              </a>

              {/* 네이버 톡톡 */}
              <a
                href="https://talk.naver.com/jncmusic"
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-white/5 hover:bg-[#03c75a] border border-white/10 hover:border-[#03c75a] rounded-2xl p-7 flex flex-col items-center gap-4 transition-all duration-300 hover:-translate-y-1"
              >
                <div className="w-12 h-12 bg-[#03c75a]/15 group-hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors">
                  <MessageCircle size={24} className="text-[#03c75a] group-hover:text-white" />
                </div>
                <div>
                  <div className="text-white font-bold text-base mb-1">네이버 톡톡</div>
                  <div className="text-[#03c75a] group-hover:text-white text-sm transition-colors">바로 메시지 보내기</div>
                </div>
              </a>

              {/* 방문 상담 */}
              <button
                onClick={() => scrollTo('#location')}
                className="group bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/30 rounded-2xl p-7 flex flex-col items-center gap-4 transition-all duration-300 hover:-translate-y-1"
              >
                <div className="w-12 h-12 bg-white/10 group-hover:bg-white/20 rounded-xl flex items-center justify-center transition-colors">
                  <MapPin size={24} className="text-white/70 group-hover:text-white" />
                </div>
                <div>
                  <div className="text-white font-bold text-base mb-1">방문 상담</div>
                  <div className="text-white/50 group-hover:text-white/70 text-sm transition-colors">오시는 길 보기 →</div>
                </div>
              </button>
            </div>

            {/* 운영 시간 */}
            <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-6 py-3 text-white/60 text-sm">
              <Clock size={15} className="text-[#d4a843]" />
              평일 10:30–22:00 &nbsp;|&nbsp; 주말 09:00–22:00
            </div>
          </div>
        </section>

        {/* ── 오시는 길 ── */}
        <section id="location" className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <p className="text-[#d4a843] text-sm font-bold tracking-widest uppercase mb-3">Location</p>
              <h2 className="text-4xl sm:text-5xl font-extrabold text-[#0d1b3e] leading-tight">
                오시는 길
              </h2>
            </div>

            <div className="grid lg:grid-cols-2 gap-10 items-start">
              {/* 지도 */}
              <div className="rounded-2xl overflow-hidden shadow-xl aspect-video lg:aspect-auto lg:h-80">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3163.5!2d126.865!3d37.527!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2z7ISc7Jq47Yq567OE7IucIOyYgeynhOq1rCDrpr_rlJTshLjroZwgMzU!5e0!3m2!1sko!2skr!4v1234567890"
                  width="100%"
                  height="100%"
                  style={{ border: 0, minHeight: '320px' }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="JNC 음악학원 위치"
                />
              </div>

              {/* 정보 */}
              <div className="space-y-6">
                {/* 주소 */}
                <div className="flex gap-4 p-5 bg-slate-50 rounded-2xl">
                  <div className="w-11 h-11 bg-[#0d1b3e] rounded-xl flex items-center justify-center shrink-0">
                    <MapPin size={20} className="text-[#d4a843]" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#d4a843] uppercase tracking-widest mb-1">주소</div>
                    <div className="text-[#0d1b3e] font-semibold leading-snug">
                      서울시 양천구 목동서로 35
                      <br />
                      목동프라자 3층 303호
                    </div>
                    <a
                      href="https://map.naver.com/v5/search/서울시 양천구 목동서로 35 목동프라자"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-[#d4a843] hover:underline mt-1.5 inline-block"
                    >
                      네이버 지도에서 보기 →
                    </a>
                  </div>
                </div>

                {/* 전화 */}
                <div className="flex gap-4 p-5 bg-slate-50 rounded-2xl">
                  <div className="w-11 h-11 bg-[#0d1b3e] rounded-xl flex items-center justify-center shrink-0">
                    <Phone size={20} className="text-[#d4a843]" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#d4a843] uppercase tracking-widest mb-1">전화</div>
                    <a href="tel:02-2655-0520" className="text-[#0d1b3e] font-semibold text-lg hover:text-[#d4a843] transition-colors">
                      02-2655-0520
                    </a>
                  </div>
                </div>

                {/* 운영 시간 */}
                <div className="flex gap-4 p-5 bg-slate-50 rounded-2xl">
                  <div className="w-11 h-11 bg-[#0d1b3e] rounded-xl flex items-center justify-center shrink-0">
                    <Clock size={20} className="text-[#d4a843]" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-[#d4a843] uppercase tracking-widest mb-3">운영 시간</div>
                    <div className="space-y-2">
                      {HOURS.map(({ day, time }) => (
                        <div key={day} className="flex justify-between items-center text-sm">
                          <span className="text-slate-500 font-medium">{day}</span>
                          <span className="text-[#0d1b3e] font-semibold">{time}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── 푸터 ── */}
      <footer className="bg-[#080f22] border-t border-white/10 py-10 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            {/* 로고 + 정보 */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-[#d4a843] flex items-center justify-center">
                  <Music size={16} className="text-[#0d1b3e]" />
                </div>
                <span className="text-white font-extrabold text-base">JNC 음악학원</span>
              </div>
              <p className="text-white/40 text-xs leading-relaxed">
                서울시 양천구 목동서로 35, 목동프라자 3층 303호
                <br />
                Tel. 02-2655-0520
              </p>
            </div>

            {/* 소셜 + 로그인 */}
            <div className="flex items-center gap-4">
              <a
                href="https://www.instagram.com/jnc_music_academy/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="인스타그램"
                className="w-9 h-9 bg-white/10 hover:bg-[#d4a843] rounded-lg flex items-center justify-center transition-colors group"
              >
                <Instagram size={16} className="text-white/70 group-hover:text-[#0d1b3e]" />
              </a>
              <button
                onClick={openDashboard}
                className="text-xs text-white/30 hover:text-white/60 transition-colors"
              >
                강사 로그인
              </button>
            </div>
          </div>

          <div className="border-t border-white/10 mt-8 pt-6 flex flex-col sm:flex-row justify-between items-center gap-2 text-white/25 text-xs">
            <span>© 2025 JNC 음악학원. All rights reserved.</span>
            <span>Grow with Music</span>
          </div>
        </div>
      </footer>
    </>
  );
}
