'use client';

import { useState, useEffect, useRef } from 'react';
import { Music, X, Menu, ExternalLink, ChevronDown } from 'lucide-react';
import { INSTRUMENTS } from '../lib/instruments';

const NAV_ITEMS = [
  { label: '학원 소개', href: '#about' },
  { label: '수강 과목', href: '#courses' },
  { label: '연습실', href: '#practice' },
  { label: '강사 소개', href: '#teachers' },
  { label: '수강 신청', href: '#enroll' },
  { label: '오시는 길', href: '#location' },
];

const CLASSIC = INSTRUMENTS.filter((i) => i.category === 'classic');
const PRACTICAL = INSTRUMENTS.filter((i) => i.category === 'practical');

export default function Header() {
  const [scrolled, setScrolled]             = useState(false);
  const [activeSection, setActiveSection]   = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showDashboard, setShowDashboard]   = useState(false);
  const [instrOpen, setInstrOpen]           = useState(false);
  const [mobileInstrOpen, setMobileInstrOpen] = useState(false);
  const instrRef = useRef(null);
  const iframeRef = useRef(null);

  useEffect(() => {
    const sections = ['about', 'courses', 'practice', 'teachers', 'enroll', 'location'];
    const handleScroll = () => {
      setScrolled(window.scrollY > 60);
      const reversed = [...sections].reverse();
      for (const id of reversed) {
        const el = document.getElementById(id);
        if (el && window.scrollY >= el.offsetTop - 120) {
          setActiveSection(id);
          return;
        }
      }
      setActiveSection('');
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // 드롭다운 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (instrRef.current && !instrRef.current.contains(e.target)) {
        setInstrOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    document.body.style.overflow = showDashboard ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showDashboard]);

  const openDashboard = () => { setMobileMenuOpen(false); setShowDashboard(true); };

  // 대시보드 오버레이
  if (showDashboard) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-100">
        <div className="flex items-center justify-between bg-[#0d1b3e] px-4 py-2.5 shrink-0 shadow-lg">
          <button
            onClick={() => setShowDashboard(false)}
            className="flex items-center gap-2 text-white/80 hover:text-[#d4a843] transition-colors text-sm font-medium"
          >
            <X size={16} />홈으로 돌아가기
          </button>
          <span className="text-white font-bold text-sm tracking-wide">JNC 음악학원 강사 시스템</span>
          <a
            href="https://jncmusic.vercel.app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-white/60 hover:text-white transition-colors text-xs"
          >
            새 탭으로 열기 <ExternalLink size={12} />
          </a>
        </div>
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

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 ${
        scrolled ? 'bg-[#0d1b3e]/95 backdrop-blur-md shadow-lg shadow-black/30 py-3' : 'bg-transparent py-5'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 select-none">
          <div className="w-9 h-9 rounded-lg bg-[#d4a843] flex items-center justify-center shadow-md">
            <Music size={20} className="text-[#0d1b3e]" />
          </div>
          <div className="leading-tight">
            <span className="block text-[#d4a843] font-extrabold text-lg tracking-tight">JNC</span>
            <span className="block text-white text-[10px] tracking-widest font-medium opacity-80">음악학원</span>
          </div>
        </a>

        <nav className="hidden md:flex items-center gap-1">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                activeSection === item.href.replace('#', '')
                  ? 'text-[#d4a843]'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              {item.label}
            </a>
          ))}

          {/* 악기 소개 드롭다운 */}
          <div className="relative" ref={instrRef}>
            <button
              onClick={() => setInstrOpen((v) => !v)}
              className={`flex items-center gap-1 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                instrOpen ? 'text-[#d4a843] bg-white/10' : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              악기 소개
              <ChevronDown
                size={14}
                className={`transition-transform duration-200 ${instrOpen ? 'rotate-180' : ''}`}
              />
            </button>

            {instrOpen && (
              <div className="absolute top-full right-0 mt-2 w-64 bg-[#0d1b3e] border border-white/10 rounded-xl shadow-2xl shadow-black/50 overflow-hidden">
                <div className="p-3">
                  <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest px-2 mb-2">클래식</p>
                  <div className="grid grid-cols-2 gap-1 mb-3">
                    {CLASSIC.map((inst) => (
                      <a
                        key={inst.id}
                        href={`/instruments/${inst.id}`}
                        onClick={() => setInstrOpen(false)}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-white/80 hover:text-[#d4a843] hover:bg-white/10 transition-colors text-sm"
                      >
                        <span className="text-base leading-none">{inst.icon}</span>
                        {inst.name}
                      </a>
                    ))}
                  </div>
                  <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest px-2 mb-2">실용음악</p>
                  <div className="grid grid-cols-2 gap-1">
                    {PRACTICAL.map((inst) => (
                      <a
                        key={inst.id}
                        href={`/instruments/${inst.id}`}
                        onClick={() => setInstrOpen(false)}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-white/80 hover:text-[#d4a843] hover:bg-white/10 transition-colors text-sm"
                      >
                        <span className="text-base leading-none">{inst.icon}</span>
                        {inst.name}
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </nav>

        <div className="flex items-center gap-3">
          <button
            onClick={openDashboard}
            className="hidden md:flex items-center gap-2 bg-[#d4a843] hover:bg-[#e8b33a] text-[#0d1b3e] text-sm font-bold px-4 py-2 rounded-lg transition-all shadow-md hover:-translate-y-0.5"
          >
            강사 로그인
          </button>
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
            <a
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className="block w-full text-left px-4 py-3 text-white/80 hover:text-white hover:bg-white/10 rounded-lg text-sm font-medium transition-colors"
            >
              {item.label}
            </a>
          ))}

          {/* 모바일 악기 소개 토글 */}
          <button
            onClick={() => setMobileInstrOpen((v) => !v)}
            className="flex items-center justify-between w-full px-4 py-3 text-white/80 hover:text-white hover:bg-white/10 rounded-lg text-sm font-medium transition-colors"
          >
            <span>악기 소개</span>
            <ChevronDown
              size={14}
              className={`transition-transform duration-200 ${mobileInstrOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {mobileInstrOpen && (
            <div className="px-4 pb-2">
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-2 mt-1">클래식</p>
              <div className="grid grid-cols-3 gap-1 mb-3">
                {CLASSIC.map((inst) => (
                  <a
                    key={inst.id}
                    href={`/instruments/${inst.id}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-1.5 px-2 py-2 rounded-lg text-white/80 hover:text-[#d4a843] hover:bg-white/10 transition-colors text-xs"
                  >
                    <span>{inst.icon}</span>
                    {inst.name}
                  </a>
                ))}
              </div>
              <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest mb-2">실용음악</p>
              <div className="grid grid-cols-3 gap-1">
                {PRACTICAL.map((inst) => (
                  <a
                    key={inst.id}
                    href={`/instruments/${inst.id}`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center gap-1.5 px-2 py-2 rounded-lg text-white/80 hover:text-[#d4a843] hover:bg-white/10 transition-colors text-xs"
                  >
                    <span>{inst.icon}</span>
                    {inst.name}
                  </a>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={openDashboard}
            className="w-full mt-2 bg-[#d4a843] text-[#0d1b3e] font-bold py-3 rounded-lg text-sm"
          >
            강사 로그인
          </button>
        </div>
      )}
    </header>
  );
}
