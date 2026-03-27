'use client';

import { useState, useEffect, useRef } from 'react';
import { collection, addDoc, deleteDoc, doc, onSnapshot, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, GALLERY_COLLECTION, GALLERY_CATEGORIES } from '../lib/firebase';
import { Upload, Trash2, LogOut, Image, X, CheckCircle, AlertCircle, Loader } from 'lucide-react';

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_GALLERY_ADMIN_PW || 'jnc2013';

// =================================================================
// 관리자 갤러리 페이지 — jncmusic.kr/admin
// =================================================================
export default function AdminPage() {
  const [authed, setAuthed]           = useState(false);
  const [pw, setPw]                   = useState('');
  const [pwError, setPwError]         = useState(false);

  const [images, setImages]           = useState([]);
  const [activeTab, setActiveTab]     = useState('all');
  const [uploading, setUploading]     = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('concert');
  const [dragOver, setDragOver]       = useState(false);
  const [toast, setToast]             = useState(null);
  const fileInputRef                  = useRef(null);

  // Firestore 실시간 구독
  useEffect(() => {
    if (!authed) return;
    const q = query(collection(db, GALLERY_COLLECTION), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setImages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [authed]);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  // 로그인
  const handleLogin = (e) => {
    e.preventDefault();
    if (pw === ADMIN_PASSWORD) {
      setAuthed(true);
      setPwError(false);
    } else {
      setPwError(true);
    }
  };

  // 파일 업로드
  const handleFiles = async (files) => {
    const validFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (!validFiles.length) return;
    setUploading(true);

    for (let i = 0; i < validFiles.length; i++) {
      const file = validFiles[i];
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const storageRef = ref(storage, `gallery/${selectedCategory}/${fileName}`);

      await new Promise((resolve, reject) => {
        const task = uploadBytesResumable(storageRef, file);
        task.on(
          'state_changed',
          (snap) => {
            const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
            setUploadProgress(Math.round(((i + pct / 100) / validFiles.length) * 100));
          },
          reject,
          async () => {
            const url = await getDownloadURL(task.snapshot.ref);
            await addDoc(collection(db, GALLERY_COLLECTION), {
              src: url,
              alt: file.name.replace(/\.[^/.]+$/, ''),
              category: selectedCategory,
              storagePath: `gallery/${selectedCategory}/${fileName}`,
              createdAt: serverTimestamp(),
            });
            resolve();
          }
        );
      }).catch(() => showToast(`${file.name} 업로드 실패`, 'error'));
    }

    setUploading(false);
    setUploadProgress(0);
    showToast(`${validFiles.length}장 업로드 완료`);
  };

  // 이미지 삭제
  const handleDelete = async (img) => {
    if (!confirm(`"${img.alt}" 사진을 삭제하시겠습니까?`)) return;
    try {
      if (img.storagePath) await deleteObject(ref(storage, img.storagePath));
      await deleteDoc(doc(db, GALLERY_COLLECTION, img.id));
      showToast('삭제 완료');
    } catch {
      showToast('삭제 실패', 'error');
    }
  };

  const filtered = activeTab === 'all'
    ? images
    : images.filter((img) => img.category === activeTab);

  // =================================================================
  // 로그인 화면
  // =================================================================
  if (!authed) {
    return (
      <div className="min-h-screen bg-[#080f22] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-[#d4a843] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Image size={28} className="text-[#0d1b3e]" />
            </div>
            <h1 className="text-white font-extrabold text-2xl">갤러리 관리</h1>
            <p className="text-white/40 text-sm mt-1">JNC 음악학원</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              placeholder="비밀번호"
              value={pw}
              onChange={(e) => { setPw(e.target.value); setPwError(false); }}
              className={`w-full bg-white/10 border ${pwError ? 'border-red-500' : 'border-white/20'} text-white placeholder-white/30 rounded-xl px-4 py-3 outline-none focus:border-[#d4a843] transition-colors`}
            />
            {pwError && <p className="text-red-400 text-sm">비밀번호가 올바르지 않습니다.</p>}
            <button
              type="submit"
              className="w-full bg-[#d4a843] hover:bg-[#e8b33a] text-[#0d1b3e] font-bold py-3 rounded-xl transition-colors"
            >
              로그인
            </button>
          </form>
        </div>
      </div>
    );
  }

  // =================================================================
  // 관리자 화면
  // =================================================================
  return (
    <div className="min-h-screen bg-slate-100">
      {/* 토스트 */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}>
          {toast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* 헤더 */}
      <header className="bg-[#0d1b3e] px-6 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#d4a843] rounded-lg flex items-center justify-center">
            <Image size={16} className="text-[#0d1b3e]" />
          </div>
          <span className="text-white font-bold">갤러리 관리</span>
          <span className="text-white/30 text-sm">— JNC 음악학원</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/" className="text-white/50 hover:text-white text-sm transition-colors">홈으로</a>
          <button onClick={() => setAuthed(false)} className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm transition-colors">
            <LogOut size={14} />
            로그아웃
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* 업로드 영역 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm mb-8">
          <h2 className="font-bold text-[#0d1b3e] text-lg mb-4">사진 업로드</h2>

          {/* 카테고리 선택 */}
          <div className="flex flex-wrap gap-2 mb-4">
            {GALLERY_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  selectedCategory === cat.id
                    ? 'bg-[#0d1b3e] text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* 드래그 앤 드롭 영역 */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
              dragOver
                ? 'border-[#d4a843] bg-[#d4a843]/5'
                : 'border-slate-300 hover:border-[#d4a843]/50 hover:bg-slate-50'
            } ${uploading ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            {uploading ? (
              <div className="space-y-3">
                <Loader size={32} className="text-[#d4a843] animate-spin mx-auto" />
                <p className="text-slate-600 font-medium">업로드 중... {uploadProgress}%</p>
                <div className="w-48 h-2 bg-slate-200 rounded-full mx-auto">
                  <div
                    className="h-2 bg-[#d4a843] rounded-full transition-all"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <>
                <Upload size={32} className="text-slate-400 mx-auto mb-3" />
                <p className="text-slate-600 font-medium">클릭하거나 사진을 드래그해서 올려주세요</p>
                <p className="text-slate-400 text-sm mt-1">JPG, PNG, WEBP — 여러 장 동시 업로드 가능</p>
                <p className="text-[#d4a843] text-sm font-semibold mt-3">
                  선택된 카테고리: {GALLERY_CATEGORIES.find((c) => c.id === selectedCategory)?.label}
                </p>
              </>
            )}
          </div>
        </div>

        {/* 이미지 목록 */}
        <div className="bg-white rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-bold text-[#0d1b3e] text-lg">
              등록된 사진 <span className="text-slate-400 font-normal text-base">({filtered.length}장)</span>
            </h2>
            {/* 탭 */}
            <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('all')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'all' ? 'bg-white shadow-sm text-[#0d1b3e]' : 'text-slate-500 hover:text-slate-700'}`}
              >
                전체 ({images.length})
              </button>
              {GALLERY_CATEGORIES.map((cat) => {
                const cnt = images.filter((i) => i.category === cat.id).length;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setActiveTab(cat.id)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === cat.id ? 'bg-white shadow-sm text-[#0d1b3e]' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    {cat.label} ({cnt})
                  </button>
                );
              })}
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Image size={40} className="mx-auto mb-3 opacity-30" />
              <p>등록된 사진이 없습니다</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filtered.map((img) => (
                <div key={img.id} className="group relative aspect-square rounded-xl overflow-hidden bg-slate-100">
                  <img
                    src={img.src}
                    alt={img.alt}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  {/* 호버 오버레이 */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                    <p className="text-white text-xs font-medium text-center line-clamp-2">{img.alt}</p>
                    <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full">
                      {GALLERY_CATEGORIES.find((c) => c.id === img.category)?.label}
                    </span>
                    <button
                      onClick={() => handleDelete(img)}
                      className="mt-1 flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Trash2 size={12} />
                      삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
