'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen, Calendar, ExternalLink } from 'lucide-react';

export default function BlogSection() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/blog')
      .then((r) => r.json())
      .then(({ items }) => {
        if (items && items.length > 0) {
          setPosts(items);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section id="blog" className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-16">
          <div>
            <p className="text-[#d4a843] text-sm font-bold tracking-widest uppercase mb-3">Blog</p>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-[#0d1b3e] leading-tight">
              학원 소식
            </h2>
            <p className="text-slate-500 mt-3 text-base max-w-md">
              네이버 블로그에서 JNC 음악학원의 최신 소식을 확인하세요.
            </p>
          </div>
          <a
            href="https://blog.naver.com/jncmusicacademy"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-[#03c75a] font-bold border border-[#03c75a]/40 hover:bg-[#03c75a] hover:text-white px-5 py-2.5 rounded-xl text-sm transition-all shrink-0"
          >
            <BookOpen size={16} />
            블로그 전체 보기
            <ExternalLink size={14} />
          </a>
        </div>

        {loading && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-slate-100 rounded-2xl h-72 animate-pulse" />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen size={28} className="text-slate-400" />
            </div>
            <p className="text-slate-500 mb-4">블로그 글을 불러오지 못했어요.</p>
            <a
              href="https://blog.naver.com/jncmusicacademy"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-[#03c75a] font-semibold hover:underline text-sm"
            >
              네이버 블로그에서 직접 보기 <ExternalLink size={14} />
            </a>
          </div>
        )}

        {!loading && !error && posts.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post, i) => (
              <a
                key={i}
                href={post.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col bg-white border border-slate-200 rounded-2xl overflow-hidden hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                {/* 썸네일 */}
                <div className="h-44 bg-slate-100 overflow-hidden shrink-0">
                  {post.thumbnail ? (
                    <img
                      src={post.thumbnail}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen size={32} className="text-slate-300" />
                    </div>
                  )}
                </div>

                {/* 내용 */}
                <div className="flex flex-col flex-1 p-5">
                  {post.date && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-2">
                      <Calendar size={12} />
                      {post.date}
                    </div>
                  )}
                  <h3 className="text-[#0d1b3e] font-bold text-base leading-snug mb-2 line-clamp-2 group-hover:text-[#d4a843] transition-colors">
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="text-slate-500 text-sm leading-relaxed line-clamp-2 flex-1">
                      {post.excerpt}
                    </p>
                  )}
                  <div className="flex items-center gap-1 text-[#03c75a] text-xs font-semibold mt-4 group-hover:gap-2 transition-all">
                    자세히 보기 <ArrowRight size={12} />
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
