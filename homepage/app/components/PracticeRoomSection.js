'use client';

import { useState, useEffect } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, PRACTICE_ROOMS_COLLECTION } from '../lib/firebase';
import { ExternalLink } from 'lucide-react';

// 예약 URL에서 날짜 파라미터 제거 (저장된 URL에 날짜가 고정된 경우 자동 정리)
const cleanBookingUrl = (url) => {
  if (!url) return url;
  try {
    const u = new URL(url);
    u.searchParams.delete('startDate');
    u.searchParams.delete('date');
    return u.toString();
  } catch {
    return url;
  }
};

export default function PracticeRoomSection() {
  const [rooms, setRooms]   = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const q = query(collection(db, PRACTICE_ROOMS_COLLECTION), orderBy('order', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      setRooms(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoaded(true);
    }, () => setLoaded(true));
    return unsub;
  }, []);

  if (!loaded || rooms.length === 0) return null;

  return (
    <section id="practice" className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-50">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-[#d4a843] text-sm font-bold tracking-widest uppercase mb-3">Practice Rooms</p>
          <h2 className="text-4xl sm:text-5xl font-extrabold text-[#0d1b3e] leading-tight">연습실 안내</h2>
          <p className="text-slate-500 mt-4 text-lg max-w-xl mx-auto">
            네이버 예약을 통해 편리하게 예약하실 수 있습니다
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map((room) => (
            <div
              key={room.id}
              className="group bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-200 hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
            >
              {/* 사진 */}
              <div className="aspect-video bg-slate-100 overflow-hidden">
                {room.coverSrc ? (
                  <img
                    src={room.coverSrc}
                    alt={room.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-5xl">🎵</span>
                  </div>
                )}
              </div>

              {/* 정보 */}
              <div className="p-6">
                <h3 className="text-xl font-extrabold text-[#0d1b3e] mb-2">{room.name}</h3>
                {room.description && (
                  <p className="text-slate-500 text-sm leading-relaxed mb-4">{room.description}</p>
                )}
                {room.bookingUrl ? (
                  <a
                    href={cleanBookingUrl(room.bookingUrl)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full bg-[#03c75a] hover:bg-[#02b350] text-white font-bold py-3 rounded-xl transition-colors text-sm"
                  >
                    <ExternalLink size={15} />
                    네이버 예약하기
                  </a>
                ) : (
                  <div className="flex items-center justify-center w-full bg-slate-100 text-slate-400 font-semibold py-3 rounded-xl text-sm">
                    예약 준비 중
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
