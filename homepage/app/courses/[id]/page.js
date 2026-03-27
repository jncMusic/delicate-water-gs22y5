'use client';

import { useState } from 'react';
import { notFound } from 'next/navigation';
import { Music, ArrowLeft, ArrowRight, ChevronRight, Phone, MessageCircle } from 'lucide-react';
import { COURSES, COURSE_DETAILS } from '../../lib/courses';

export default function CoursePage({ params }) {
  const course = COURSES.find((c) => c.id === params.id);
  const detail = COURSE_DETAILS[params.id];

  if (!course || !detail) notFound();

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white">
      {/* ── 헤더 ── */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-[#0d1b3e]/95 backdrop-blur-md shadow-lg py-3">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#d4a843] flex items-center justify-center">
              <Music size={16} className="text-[#0d1b3e]" />
            </div>
            <span className="text-white font-extrabold text-base">JNC 음악학원</span>
          </a>
          <a
            href="/#courses"
            className="flex items-center gap-1.5 text-white/60 hover:text-white text-sm transition-colors"
          >
            <ArrowLeft size={15} />
            수강 과목으로
          </a>
        </div>
      </header>

      <main className="pt-16">
        {/* ── 히어로 ── */}
        <section className={`relative py-28 px-4 sm:px-6 lg:px-8 bg-gradient-to-br ${course.color} overflow-hidden`}>
          <div className="absolute inset-0 bg-[#080f22]/60" />
          <div className="absolute top-1/3 left-1/4 w-80 h-80 bg-[#d4a843]/5 rounded-full blur-3xl" />
          <div className="relative z-10 max-w-4xl mx-auto">
            <p className="text-[#d4a843] text-sm font-bold tracking-widest uppercase mb-4">{course.titleEn}</p>
            <h1 className="text-5xl sm:text-6xl font-extrabold text-white mb-4">
              {course.title}
            </h1>
            <p className="text-white/70 text-xl max-w-2xl leading-relaxed mb-8">
              {detail.hero}
            </p>
            {/* 악기 태그 */}
            <div className="flex flex-wrap gap-2">
              {course.instruments.map((inst) => (
                <span
                  key={inst}
                  className="text-sm font-semibold bg-white/10 border border-white/20 text-white px-3 py-1.5 rounded-full"
                >
                  {inst}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── 소개 ── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-4xl mx-auto">
            <p className="text-[#d4a843] text-sm font-bold tracking-widest uppercase mb-3">About</p>
            <p className="text-slate-700 text-lg leading-relaxed">
              {detail.summary}
            </p>
          </div>
        </section>

        {/* ── 이런 분들께 추천 ── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-[#d4a843] text-sm font-bold tracking-widest uppercase mb-3">Who Is This For</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0d1b3e]">이런 분들께 추천합니다</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {detail.targets.map((t) => (
                <div key={t.label} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                  <div className="text-3xl mb-4">{t.icon}</div>
                  <h3 className="text-[#0d1b3e] font-bold text-base mb-2">{t.label}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{t.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 수강 악기 ── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-white">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-[#d4a843] text-sm font-bold tracking-widest uppercase mb-3">Instruments</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0d1b3e]">수강 악기</h2>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {detail.instrumentDetails.map((inst) => (
                <div
                  key={inst.name}
                  className="flex gap-4 p-5 bg-slate-50 rounded-2xl hover:bg-[#0d1b3e] group transition-colors"
                >
                  <div className="text-3xl shrink-0">{inst.icon}</div>
                  <div>
                    <h3 className="text-[#0d1b3e] group-hover:text-white font-bold text-base mb-1 transition-colors">
                      {inst.name}
                    </h3>
                    <p className="text-slate-500 group-hover:text-white/60 text-sm leading-relaxed transition-colors">
                      {inst.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 커리큘럼 단계 ── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-[#080f22]">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <p className="text-[#d4a843] text-sm font-bold tracking-widest uppercase mb-3">Curriculum</p>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white">레슨 단계</h2>
            </div>
            <div className="relative">
              {/* 연결선 */}
              <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-white/10 hidden sm:block" />
              <div className="space-y-6">
                {detail.steps.map((s) => (
                  <div key={s.step} className="flex gap-6 items-start">
                    <div className="relative shrink-0 w-12 h-12 bg-[#d4a843] rounded-full flex items-center justify-center font-extrabold text-[#0d1b3e] text-lg z-10">
                      {s.step}
                    </div>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex-1">
                      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                        <h3 className="text-white font-bold text-base">{s.title}</h3>
                        <span className="text-[#d4a843] text-xs font-semibold bg-[#d4a843]/10 px-3 py-1 rounded-full">
                          {s.duration}
                        </span>
                      </div>
                      <p className="text-white/60 text-sm leading-relaxed">{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── 기대 성과 ── */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-[#d4a843] text-sm font-bold tracking-widest uppercase mb-3">Outcomes</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0d1b3e] mb-10">이런 걸 목표로 할 수 있어요</h2>
            <div className="flex flex-wrap justify-center gap-4">
              {course.outcomes.map((out) => (
                <div
                  key={out}
                  className="flex items-center gap-2 bg-white border border-slate-200 shadow-sm rounded-2xl px-6 py-4 text-[#0d1b3e] font-semibold hover:border-[#d4a843] hover:shadow-md transition-all"
                >
                  <span className="text-[#d4a843]">✓</span>
                  {out}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── 다른 과목 ── */}
        {(() => {
          const other = COURSES.find((c) => c.id !== params.id);
          if (!other) return null;
          return (
            <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white border-t border-slate-100">
              <div className="max-w-4xl mx-auto flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-slate-400 text-sm mb-1">다른 수강 과목도 확인해보세요</p>
                  <h3 className="text-[#0d1b3e] font-extrabold text-xl">{other.icon} {other.title}</h3>
                  <p className="text-slate-500 text-sm mt-1">{other.instruments.join(' · ')}</p>
                </div>
                <a
                  href={`/courses/${other.id}`}
                  className="flex items-center gap-2 bg-[#0d1b3e] text-white font-semibold px-6 py-3 rounded-xl hover:bg-[#142c58] transition-colors"
                >
                  {other.title} 보기
                  <ChevronRight size={16} />
                </a>
              </div>
            </section>
          );
        })()}

        {/* ── 수강 신청 CTA ── */}
        <section className="py-24 px-4 sm:px-6 lg:px-8 bg-[#0d1b3e]">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
              지금 바로 시작해보세요
            </h2>
            <p className="text-white/50 mb-10">
              전화 또는 네이버 톡톡으로 부담 없이 문의해 주세요
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="tel:02-2655-0520"
                className="flex items-center gap-2 bg-[#d4a843] hover:bg-[#e8b33a] text-[#0d1b3e] font-bold px-8 py-4 rounded-xl transition-all shadow-xl shadow-[#d4a843]/20 hover:-translate-y-0.5"
              >
                <Phone size={18} />
                02-2655-0520
              </a>
              <a
                href="https://talk.naver.com/profile/w4xhyc"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 bg-[#03c75a] hover:bg-[#02b350] text-white font-bold px-8 py-4 rounded-xl transition-all hover:-translate-y-0.5"
              >
                <MessageCircle size={18} />
                네이버 톡톡
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ── 푸터 ── */}
      <footer className="bg-[#080f22] border-t border-white/10 py-8 px-4 text-center">
        <p className="text-white/25 text-xs">© 2025 JNC 음악학원. 서울시 양천구 목동서로 35 목동프라자 3층 303호</p>
      </footer>
    </div>
  );
}
