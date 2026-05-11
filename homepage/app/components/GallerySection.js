'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, GALLERY_COLLECTION, GALLERY_CATEGORIES } from '../lib/firebase';

export default function GallerySection() {
  const [images, setImages]   = useState([]);
  const [tab, setTab]         = useState('all');
  const [loaded, setLoaded]   = useState(false);

  useEffect(() => {
    const q = query(collection(db, GALLERY_COLLECTION), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setImages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoaded(true);
    }, () => setLoaded(true));
    return unsub;
  }, []);

  if (!loaded || images.length === 0) return null;

  const filtered = tab === 'all' ? images : images.filter((img) => img.category === tab);

  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-[#d4a843] text-sm font-bold tracking-widest uppercase mb-3">Gallery</p>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-[#0d1b3e] leading-tight">갤러리</h2>
        </div>

        <div className="flex flex-wrap justify-center gap-2 mb-10">
          {[{ id: 'all', label: '전체' }, ...GALLERY_CATEGORIES].map((cat) => {
            const cnt = cat.id === 'all' ? images.length : images.filter((i) => i.category === cat.id).length;
            if (cat.id !== 'all' && cnt === 0) return null;
            return (
              <button
                key={cat.id}
                onClick={() => setTab(cat.id)}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                  tab === cat.id
                    ? 'bg-[#0d1b3e] text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.label} <span className="opacity-60">({cnt})</span>
              </button>
            );
          })}
        </div>

        <div className="columns-2 md:columns-3 lg:columns-4 [column-gap:1rem]">
          {filtered.map((img) => (
            <div
              key={img.id}
              className="break-inside-avoid mb-4 rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
            >
              <img src={img.src} alt={img.alt} className="w-full object-cover" loading="lazy" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
