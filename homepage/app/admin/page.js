'use client';

import { useState, useEffect, useRef } from 'react';
import { collection, addDoc, deleteDoc, doc, onSnapshot, serverTimestamp, query, orderBy, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage, GALLERY_COLLECTION, GALLERY_CATEGORIES, PRACTICE_ROOMS_COLLECTION } from '../lib/firebase';
import { Upload, Trash2, LogOut, Image, X, CheckCircle, AlertCircle, Loader, Plus, Edit2, Check } from 'lucide-react';

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_GALLERY_ADMIN_PW || 'jnc2013';

// =================================================================
// 관리자 페이지 — jncmusic.kr/admin
// =================================================================
export default function AdminPage() {
  const [authed, setAuthed]       = useState(false);
  const [pw, setPw]               = useState('');
  const [pwError, setPwError]     = useState(false);
  const [mainTab, setMainTab]     = useState('gallery'); // 'gallery' | 'practice'
  const [toast, setToast]         = useState(null);

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (pw === ADMIN_PASSWORD) { setAuthed(true); setPwError(false); }
    else setPwError(true);
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#080f22] flex items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-14 h-14 bg-[#d4a843] rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Image size={28} className="text-[#0d1b3e]" />
            </div>
            <h1 className="text-white font-extrabold text-2xl">관리자</h1>
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
            <button type="submit" className="w-full bg-[#d4a843] hover:bg-[#e8b33a] text-[#0d1b3e] font-bold py-3 rounded-xl transition-colors">
              로그인
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-white text-sm font-medium ${toast.type === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`}>
          {toast.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <header className="bg-[#0d1b3e] px-6 py-4 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#d4a843] rounded-lg flex items-center justify-center">
            <Image size={16} className="text-[#0d1b3e]" />
          </div>
          <span className="text-white font-bold">관리자</span>
          <span className="text-white/30 text-sm">— JNC 음악학원</span>
        </div>
        <div className="flex items-center gap-4">
          <a href="/" className="text-white/50 hover:text-white text-sm transition-colors">홈으로</a>
          <button onClick={() => setAuthed(false)} className="flex items-center gap-1.5 text-white/50 hover:text-white text-sm transition-colors">
            <LogOut size={14} /> 로그아웃
          </button>
        </div>
      </header>

      {/* 메인 탭 */}
      <div className="bg-white border-b border-slate-200 px-6">
        <div className="max-w-6xl mx-auto flex gap-1">
          {[{ id: 'gallery', label: '갤러리 관리' }, { id: 'practice', label: '연습실 관리' }].map((t) => (
            <button
              key={t.id}
              onClick={() => setMainTab(t.id)}
              className={`px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
                mainTab === t.id
                  ? 'border-[#d4a843] text-[#0d1b3e]'
                  : 'border-transparent text-slate-400 hover:text-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {mainTab === 'gallery'
          ? <GalleryManager showToast={showToast} />
          : <PracticeRoomManager showToast={showToast} />
        }
      </main>
    </div>
  );
}

// =================================================================
// 갤러리 관리
// =================================================================
function GalleryManager({ showToast }) {
  const [images, setImages]           = useState([]);
  const [activeTab, setActiveTab]     = useState('all');
  const [uploading, setUploading]     = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState('concert');
  const [dragOver, setDragOver]       = useState(false);
  const fileInputRef                  = useRef(null);

  useEffect(() => {
    const q = query(collection(db, GALLERY_COLLECTION), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => setImages(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, []);

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
        task.on('state_changed',
          (snap) => setUploadProgress(Math.round(((i + snap.bytesTransferred / snap.totalBytes) / validFiles.length) * 100)),
          reject,
          async () => {
            const url = await getDownloadURL(task.snapshot.ref);
            await addDoc(collection(db, GALLERY_COLLECTION), {
              src: url, alt: file.name.replace(/\.[^/.]+$/, ''),
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

  const handleDelete = async (img) => {
    if (!confirm(`"${img.alt}" 사진을 삭제하시겠습니까?`)) return;
    try {
      if (img.storagePath) await deleteObject(ref(storage, img.storagePath));
      await deleteDoc(doc(db, GALLERY_COLLECTION, img.id));
      showToast('삭제 완료');
    } catch { showToast('삭제 실패', 'error'); }
  };

  const filtered = activeTab === 'all' ? images : images.filter((img) => img.category === activeTab);

  return (
    <>
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-8">
        <h2 className="font-bold text-[#0d1b3e] text-lg mb-4">사진 업로드</h2>
        <div className="flex flex-wrap gap-2 mb-4">
          {GALLERY_CATEGORIES.map((cat) => (
            <button key={cat.id} onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${selectedCategory === cat.id ? 'bg-[#0d1b3e] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {cat.label}
            </button>
          ))}
        </div>
        <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => !uploading && fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${dragOver ? 'border-[#d4a843] bg-[#d4a843]/5' : 'border-slate-300 hover:border-[#d4a843]/50 hover:bg-slate-50'} ${uploading ? 'cursor-not-allowed opacity-60' : ''}`}>
          <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
          {uploading ? (
            <div className="space-y-3">
              <Loader size={32} className="text-[#d4a843] animate-spin mx-auto" />
              <p className="text-slate-600 font-medium">업로드 중... {uploadProgress}%</p>
              <div className="w-48 h-2 bg-slate-200 rounded-full mx-auto">
                <div className="h-2 bg-[#d4a843] rounded-full transition-all" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          ) : (
            <>
              <Upload size={32} className="text-slate-400 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">클릭하거나 사진을 드래그해서 올려주세요</p>
              <p className="text-slate-400 text-sm mt-1">JPG, PNG, WEBP — 여러 장 동시 업로드 가능</p>
              <p className="text-[#d4a843] text-sm font-semibold mt-3">선택된 카테고리: {GALLERY_CATEGORIES.find((c) => c.id === selectedCategory)?.label}</p>
            </>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h2 className="font-bold text-[#0d1b3e] text-lg">등록된 사진 <span className="text-slate-400 font-normal text-base">({filtered.length}장)</span></h2>
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            <button onClick={() => setActiveTab('all')} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === 'all' ? 'bg-white shadow-sm text-[#0d1b3e]' : 'text-slate-500 hover:text-slate-700'}`}>전체 ({images.length})</button>
            {GALLERY_CATEGORIES.map((cat) => (
              <button key={cat.id} onClick={() => setActiveTab(cat.id)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === cat.id ? 'bg-white shadow-sm text-[#0d1b3e]' : 'text-slate-500 hover:text-slate-700'}`}>
                {cat.label} ({images.filter((i) => i.category === cat.id).length})
              </button>
            ))}
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400"><Image size={40} className="mx-auto mb-3 opacity-30" /><p>등록된 사진이 없습니다</p></div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filtered.map((img) => (
              <div key={img.id} className="group relative aspect-square rounded-xl overflow-hidden bg-slate-100">
                <img src={img.src} alt={img.alt} className="w-full h-full object-cover" loading="lazy" />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                  <p className="text-white text-xs font-medium text-center line-clamp-2">{img.alt}</p>
                  <span className="text-[10px] bg-white/20 text-white px-2 py-0.5 rounded-full">{GALLERY_CATEGORIES.find((c) => c.id === img.category)?.label}</span>
                  <button onClick={() => handleDelete(img)} className="mt-1 flex items-center gap-1 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors">
                    <Trash2 size={12} /> 삭제
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// =================================================================
// 연습실 관리
// =================================================================
function PracticeRoomManager({ showToast }) {
  const [rooms, setRooms]       = useState([]);
  const [newName, setNewName]   = useState('');
  const [newUrl, setNewUrl]     = useState('');
  const [newDesc, setNewDesc]   = useState('');
  const [saving, setSaving]     = useState(false);
  const [uploading, setUploading] = useState(null); // roomId being uploaded
  const [editId, setEditId]     = useState(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl]   = useState('');
  const [editDesc, setEditDesc] = useState('');
  const photoInputRef           = useRef(null);
  const newPhotoInputRef        = useRef(null);
  const [pendingPhotoRoomId, setPendingPhotoRoomId] = useState(null);

  useEffect(() => {
    const q = query(collection(db, PRACTICE_ROOMS_COLLECTION), orderBy('order', 'asc'));
    return onSnapshot(q, (snap) => setRooms(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
  }, []);

  // 연습실 추가
  const handleAddRoom = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setSaving(true);
    try {
      await addDoc(collection(db, PRACTICE_ROOMS_COLLECTION), {
        name: newName.trim(),
        bookingUrl: newUrl.trim(),
        description: newDesc.trim(),
        coverSrc: '',
        storagePath: '',
        order: rooms.length,
        createdAt: serverTimestamp(),
      });
      setNewName(''); setNewUrl(''); setNewDesc('');
      showToast('연습실 추가 완료');
    } catch { showToast('추가 실패', 'error'); }
    setSaving(false);
  };

  // 연습실 삭제
  const handleDelete = async (room) => {
    if (!confirm(`"${room.name}"을(를) 삭제하시겠습니까?`)) return;
    try {
      if (room.storagePath) await deleteObject(ref(storage, room.storagePath));
      await deleteDoc(doc(db, PRACTICE_ROOMS_COLLECTION, room.id));
      showToast('삭제 완료');
    } catch { showToast('삭제 실패', 'error'); }
  };

  // 사진 업로드
  const handlePhotoUpload = async (roomId, file) => {
    if (!file) return;
    setUploading(roomId);
    const ext = file.name.split('.').pop();
    const fileName = `${Date.now()}.${ext}`;
    const storagePath = `practiceRooms/${roomId}/${fileName}`;
    const storageRef = ref(storage, storagePath);

    // 기존 사진 삭제
    const room = rooms.find((r) => r.id === roomId);
    if (room?.storagePath) {
      try { await deleteObject(ref(storage, room.storagePath)); } catch {}
    }

    await new Promise((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, file);
      task.on('state_changed', null, reject, async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        await updateDoc(doc(db, PRACTICE_ROOMS_COLLECTION, roomId), { coverSrc: url, storagePath });
        resolve();
      });
    }).catch(() => showToast('사진 업로드 실패', 'error'));

    setUploading(null);
    showToast('사진 업로드 완료');
  };

  // 정보 수정 저장
  const handleEditSave = async (roomId) => {
    try {
      await updateDoc(doc(db, PRACTICE_ROOMS_COLLECTION, roomId), {
        name: editName.trim(),
        bookingUrl: editUrl.trim(),
        description: editDesc.trim(),
      });
      setEditId(null);
      showToast('수정 완료');
    } catch { showToast('수정 실패', 'error'); }
  };

  return (
    <>
      {/* 추가 폼 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm mb-8">
        <h2 className="font-bold text-[#0d1b3e] text-lg mb-4">연습실 추가</h2>
        <form onSubmit={handleAddRoom} className="space-y-3">
          <input
            value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="연습실 이름 (예: 드럼 연습실)"
            className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#d4a843]"
            required
          />
          <input
            value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
            placeholder="간단한 설명 (선택)"
            className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#d4a843]"
          />
          <input
            value={newUrl} onChange={(e) => setNewUrl(e.target.value)}
            placeholder="네이버 예약 URL (선택)"
            className="w-full border rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#d4a843]"
          />
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 bg-[#0d1b3e] hover:bg-[#142c58] text-white font-bold px-6 py-3 rounded-xl transition-colors disabled:opacity-50">
            <Plus size={16} /> {saving ? '추가 중...' : '연습실 추가'}
          </button>
        </form>
      </div>

      {/* 연습실 목록 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm">
        <h2 className="font-bold text-[#0d1b3e] text-lg mb-6">
          등록된 연습실 <span className="text-slate-400 font-normal text-base">({rooms.length}개)</span>
        </h2>

        {rooms.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p>등록된 연습실이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-4">
            {rooms.map((room) => (
              <div key={room.id} className="border border-slate-200 rounded-2xl overflow-hidden">
                <div className="flex gap-4 p-4">
                  {/* 사진 */}
                  <div className="relative w-32 h-24 bg-slate-100 rounded-xl overflow-hidden shrink-0 flex items-center justify-center">
                    {room.coverSrc
                      ? <img src={room.coverSrc} alt={room.name} className="w-full h-full object-cover" />
                      : <span className="text-3xl">🎵</span>
                    }
                    {uploading === room.id && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <Loader size={20} className="text-white animate-spin" />
                      </div>
                    )}
                  </div>

                  {/* 정보 */}
                  <div className="flex-1 min-w-0">
                    {editId === room.id ? (
                      <div className="space-y-2">
                        <input value={editName} onChange={(e) => setEditName(e.target.value)}
                          className="w-full border rounded-lg px-3 py-1.5 text-sm font-bold outline-none focus:ring-2 focus:ring-[#d4a843]" />
                        <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
                          placeholder="설명"
                          className="w-full border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#d4a843]" />
                        <input value={editUrl} onChange={(e) => setEditUrl(e.target.value)}
                          placeholder="예약 URL"
                          className="w-full border rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#d4a843]" />
                      </div>
                    ) : (
                      <>
                        <h3 className="font-bold text-[#0d1b3e] text-base">{room.name}</h3>
                        {room.description && <p className="text-slate-500 text-sm mt-0.5">{room.description}</p>}
                        {room.bookingUrl
                          ? <p className="text-[#03c75a] text-xs mt-1 truncate">{room.bookingUrl}</p>
                          : <p className="text-slate-300 text-xs mt-1">예약 URL 미설정</p>
                        }
                      </>
                    )}
                  </div>

                  {/* 액션 버튼 */}
                  <div className="flex flex-col gap-2 shrink-0">
                    {editId === room.id ? (
                      <>
                        <button onClick={() => handleEditSave(room.id)}
                          className="flex items-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors">
                          <Check size={12} /> 저장
                        </button>
                        <button onClick={() => setEditId(null)}
                          className="flex items-center gap-1 bg-slate-200 hover:bg-slate-300 text-slate-600 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors">
                          <X size={12} /> 취소
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => { setEditId(room.id); setEditName(room.name); setEditUrl(room.bookingUrl || ''); setEditDesc(room.description || ''); }}
                          className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors">
                          <Edit2 size={12} /> 수정
                        </button>
                        <button
                          onClick={() => { setPendingPhotoRoomId(room.id); photoInputRef.current?.click(); }}
                          disabled={uploading === room.id}
                          className="flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                          <Upload size={12} /> 사진
                        </button>
                        <button onClick={() => handleDelete(room)}
                          className="flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-500 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors">
                          <Trash2 size={12} /> 삭제
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 숨김 파일 입력 */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          if (e.target.files[0] && pendingPhotoRoomId) {
            handlePhotoUpload(pendingPhotoRoomId, e.target.files[0]);
            setPendingPhotoRoomId(null);
          }
          e.target.value = '';
        }}
      />
    </>
  );
}
