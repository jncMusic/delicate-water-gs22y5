'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, BookOpen } from 'lucide-react';

export default function BlogSection() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/blog')
      .then((r) => r.json())
      .then((data) => setPosts(data.items || []))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  if (!loading && posts.length === 0) return null;

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-14">
          <p className="text-[#d4a843] text-sm font-bold tracking-widest uppercase mb-3">Blog</p>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-[#0d1b3e] leading-tight">학원 소식</h2>
          <p className="text-slate-500 mt-4 text-lg">네이버 블로그에서 더 많은 이야기를 만나보세요.</p>
        </div>

        {loading ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl overflow-hidden border border-slate-100 animate-pulse">
                <div className="h-44 bg-slate-200" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-slate-200 rounded w-1/3" />
                  <div className="h-5 bg-slate-200 rounded w-full" />
                  <div className="h-4 bg-slate-200 rounded w-5/6" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {posts.map((post, i) => (
              <a
                key={i}
                href={post.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group bg-white rounded-2xl overflow-hidden border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col"
              >
                {post.thumbnail ? (
                  <div className="h-44 overflow-hidden bg-slate-100">
                    <img
                      src={post.thumbnail}
                      alt={post.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                ) : (
                  <div className="h-44 bg-gradient-to-br from-[#0d1b3e] to-[#1a3a7a] flex items-center justify-center">
                    <BookOpen size={36} className="text-[#d4a843]/60" />
                  </div>
                )}
                <div className="p-5 flex flex-col flex-1">
                  {post.date && (
                    <span className="text-xs text-slate-400 mb-2">{post.date}</span>
                  )}
                  <h3 className="text-[#0d1b3e] font-bold text-base leading-snug mb-2 line-clamp-2 group-hover:text-[#d4a843] transition-colors">
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="text-slate-500 text-sm leading-relaxed line-clamp-2 flex-1">
                      {post.excerpt}
                    </p>
                  )}
                  <div className="flex items-center gap-1 mt-4 text-[#d4a843] text-sm font-semibold">
                    자세히 보기
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}

        <div className="text-center mt-12">
          <a
            href="https://blog.naver.com/jncmusicacademy"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-[#0d1b3e] text-white font-bold px-8 py-4 rounded-xl hover:bg-[#1a3a7a] transition-colors"
          >
            <BookOpen size={18} />
            네이버 블로그 전체 보기
            <ArrowRight size={16} />
          </a>
        </div>
      </div>
    </section>
  );
}
