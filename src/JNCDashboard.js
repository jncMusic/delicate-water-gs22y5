import React, { useState, useEffect, useMemo } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  writeBatch,
  deleteDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import {
  Users,
  Calendar as CalendarIcon,
  CreditCard,
  LayoutDashboard,
  Settings,
  CheckCircle,
  XCircle,
  Search,
  Plus,
  MoreHorizontal,
  TrendingUp,
  ChevronRight,
  AlertCircle,
  Save,
  X,
  UserCircle,
  LogOut,
  Database,
  Code,
  Lock,
  Mail,
  Trash2,
  CalendarDays,
  Menu,
  ChevronLeft,
  Upload,
  File,
  Pencil,
  Timer,
  Info,
  Download,
  Filter,
  MoreVertical,
  Maximize2,
  History,
  MessageSquareText,
  UserCheck,
  Send,
  CheckSquare,
  StickyNote,
  Music,
  HardDrive,
  RefreshCcw,
  Archive,
  ListTodo,
  BookOpen,
  Clock,
  UserPlus,
} from "lucide-react";

// =================================================================
// 1. Firebase 설정
// =================================================================
const firebaseConfig = {
  apiKey: "AIzaSyDc6bGpzvxNALaxvrhZxSMxuHAvqQJozSE",
  authDomain: "jnc-music-dashboard.firebaseapp.com",
  projectId: "jnc-music-dashboard",
  storageBucket: "jnc-music-dashboard.firebasestorage.app",
  messagingSenderId: "228282757928",
  appId: "1:228282757928:web:6fae515d207d8a61e0961d",
  measurementId: "G-253HKDQ29X",
};

let app, auth, db, APP_ID;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  APP_ID = "jnc-music-v2";
} catch (e) {
  console.error("Firebase 초기화 오류:", e);
}

// =================================================================
// 2. 상수 및 데이터
// =================================================================
const CLASS_NAMES = ["월", "화", "수", "목", "금", "토", "일"];
const DAYS_OF_WEEK = [
  { id: 1, label: "월" },
  { id: 2, label: "화" },
  { id: 3, label: "수" },
  { id: 4, label: "목" },
  { id: 5, label: "금" },
  { id: 6, label: "토" },
  { id: 0, label: "일" },
];

const INITIAL_TEACHERS_LIST = [
  "태유민",
  "조국화",
  "이상현",
  "민숙현",
  "김소형",
  "남선오",
  "이윤석",
  "진승하",
  "문세영",
  "권시문",
  "최지영",
  "공성윤",
  "김여빈",
  "한수정",
  "김주원",
  "김맑음",
  "강열혁",
];

const TEACHER_PASSWORDS = {
  남선오: "0351",
  한수정: "4314",
  이윤석: "9876",
  민숙현: "0412",
  김소형: "5858",
  김주원: "5259",
  권시문: "6312",
  김여빈: "5408",
  김맑음: "2313",
  최지영: "5912",
  조국화: "7904",
  이상현: "2723",
  문세영: "7608",
  공성윤: "2001",
  진승하: "3090",
  강열혁: "1123",
  태유민: "8825",
};

const HOLIDAYS = {
  "2025-01-01": "신정",
  "2025-01-29": "설날",
  "2025-10-06": "추석",
  "2025-12-25": "성탄절",
  "2026-01-01": "신정",
  "2026-02-17": "설날",
  "2026-09-25": "추석",
  "2026-12-25": "성탄절",
};

const GRADE_OPTIONS = [
  "미취학(5세)",
  "미취학(6세)",
  "미취학(7세)",
  "초1",
  "초2",
  "초3",
  "초4",
  "초5",
  "초6",
  "중1",
  "중2",
  "중3",
  "고1",
  "고2",
  "고3",
  "성인",
];

const FOLLOW_UP_OPTIONS = [
  { id: "send_class_info", label: "수업 안내 문자 발송", color: "blue" },
  { id: "request_teacher", label: "강사에게 수업 의뢰", color: "purple" },
  {
    id: "send_payment_info",
    label: "원비 결제 안내 문자 발송",
    color: "green",
  },
];

const getDaysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year, month) => new Date(year, month, 1).getDay();

// =================================================================
// 3. UI 및 모달 컴포넌트
// =================================================================

const SidebarItem = ({ icon: Icon, label, active, onClick }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
      active
        ? "bg-indigo-600 text-white shadow-md"
        : "text-slate-500 hover:bg-indigo-50 hover:text-indigo-600"
    }`}
  >
    {Icon && <Icon size={20} className="shrink-0" />}
    <span className="font-medium whitespace-nowrap">{label}</span>
  </button>
);

const StatCard = ({ icon: Icon, label, value, trend, trendUp }) => (
  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-start justify-between min-w-[200px]">
    <div>
      <p className="text-sm font-medium text-slate-500 mb-1">{label}</p>
      <h3 className="text-2xl font-bold text-slate-800">{value}</h3>
      {trend && (
        <p
          className={`text-xs font-medium mt-2 flex items-center ${
            trendUp ? "text-emerald-600" : "text-rose-600"
          }`}
        >
          <TrendingUp size={14} className="mr-1" />
          {trend}
        </p>
      )}
    </div>
    <div className="p-3 bg-indigo-50 rounded-lg text-indigo-600">
      {Icon && <Icon size={24} />}
    </div>
  </div>
);

const LoginModal = ({
  isOpen,
  onClose,
  teachers,
  onLogin,
  showToast,
  isInitialLogin,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdminLoginMode, setIsAdminLoginMode] = useState(false);
  const [selectedTeacherForLogin, setSelectedTeacherForLogin] = useState(null);
  const [teacherPassword, setTeacherPassword] = useState("");
  const [password, setPassword] = useState("");
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState("");

  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
      setIsAdminLoginMode(false);
      setSelectedTeacherForLogin(null);
      setTeacherPassword("");
      setPassword("");
    }
  }, [isOpen]);

  if (!isOpen) return null;
  const filteredTeachers = teachers.filter((t) => t.name.includes(searchTerm));

  const handleAdminLogin = () => {
    if (password === "1123") {
      onLogin({ name: "원장님", role: "admin" });
      setPassword("");
      setIsAdminLoginMode(false);
    } else {
      showToast("비밀번호가 일치하지 않습니다.", "warning");
    }
  };

  const handleTeacherClick = (teacher) => {
    setSelectedTeacherForLogin(teacher);
    setTeacherPassword("");
  };

  const handleTeacherLoginSubmit = () => {
    const correctPassword = TEACHER_PASSWORDS[selectedTeacherForLogin.name];
    if (!correctPassword) {
      showToast(
        "비밀번호가 설정되지 않은 강사입니다. 관리자에게 문의하세요.",
        "error"
      );
      return;
    }

    if (teacherPassword === correctPassword) {
      onLogin({ name: selectedTeacherForLogin.name, role: "teacher" });
      setSelectedTeacherForLogin(null);
      setTeacherPassword("");
    } else {
      showToast("비밀번호가 일치하지 않습니다.", "warning");
    }
  };

  const handlePasswordReset = (e) => {
    e.preventDefault();
    showToast(`'${resetEmail}'로 재설정 링크 전송됨`, "success");
    setIsResetMode(false);
    setIsAdminLoginMode(false);
  };

  if (isAdminLoginMode) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-slate-800">
              {isResetMode ? "비밀번호 재설정" : "관리자 접속"}
            </h2>
            <button
              onClick={() => {
                setIsAdminLoginMode(false);
                setIsResetMode(false);
              }}
            >
              <X size={24} className="text-slate-400" />
            </button>
          </div>
          {isResetMode ? (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="이메일 입력"
              />
              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold"
              >
                전송
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="비밀번호 입력"
                autoFocus
              />
              <button
                onClick={handleAdminLogin}
                className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors"
              >
                접속하기
              </button>
              <button
                onClick={() => setIsResetMode(true)}
                className="w-full text-center text-xs text-slate-400 hover:underline"
              >
                비밀번호 찾기
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (selectedTeacherForLogin) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <UserCircle className="text-indigo-600" />
              {selectedTeacherForLogin.name} 강사님
            </h2>
            <button onClick={() => setSelectedTeacherForLogin(null)}>
              <X size={24} className="text-slate-400" />
            </button>
          </div>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              비밀번호(전화번호 뒷 4자리)를 입력해주세요.
            </p>
            <input
              type="password"
              value={teacherPassword}
              onChange={(e) => setTeacherPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTeacherLoginSubmit()}
              className="w-full px-3 py-2 border rounded-lg focus:outline-indigo-500"
              placeholder="1234"
              autoFocus
              maxLength={4}
            />
            <button
              onClick={handleTeacherLoginSubmit}
              className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors"
            >
              로그인
            </button>
            <button
              onClick={() => setSelectedTeacherForLogin(null)}
              className="w-full py-2 text-slate-400 text-sm hover:text-slate-600"
            >
              뒤로가기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md flex flex-col max-h-[90vh]">
        <div className="p-6 border-b flex justify-between items-center">
          <h2 className="text-xl font-bold text-slate-800">
            로그인 / 계정 전환
          </h2>
          {!isInitialLogin && (
            <button onClick={onClose}>
              <X size={24} className="text-slate-400" />
            </button>
          )}
        </div>
        <div className="p-6 space-y-6 overflow-y-auto">
          <button
            onClick={() => setIsAdminLoginMode(true)}
            className="w-full p-4 bg-slate-50 hover:bg-indigo-50 border rounded-xl flex items-center group transition-colors"
          >
            <div className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold mr-3">
              M
            </div>
            <div className="text-left">
              <p className="font-bold text-slate-800">원장님 (관리자)</p>
              <p className="text-xs text-slate-500">모든 권한 접근 가능</p>
            </div>
          </button>
          <div className="relative flex py-2 items-center">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink-0 mx-4 text-slate-400 text-xs">
              또는 강사 계정으로 로그인
            </span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>
          <div>
            <div className="relative mb-3">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={16}
              />
              <input
                placeholder="이름 검색"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border rounded-lg focus:outline-indigo-500"
              />
            </div>
            <div className="max-h-48 overflow-y-auto space-y-2 border rounded-lg p-2 bg-slate-50">
              {filteredTeachers.map((teacher) => (
                <button
                  key={teacher.id}
                  onClick={() => handleTeacherClick(teacher)}
                  className="w-full text-left px-3 py-2 rounded hover:bg-white flex items-center transition-colors"
                >
                  <UserCircle size={16} className="mr-2 text-emerald-500" />
                  {teacher.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const EditTeacherModal = ({ teacher, onClose, onSave }) => {
  const [selectedDays, setSelectedDays] = useState(teacher.days || []);
  const toggleDay = (dayId) => {
    if (selectedDays.includes(dayId))
      setSelectedDays(selectedDays.filter((d) => d !== dayId));
    else setSelectedDays([...selectedDays, dayId]);
  };
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-800">강사 정보 수정</h2>
          <button onClick={onClose}>
            <X size={24} className="text-slate-400" />
          </button>
        </div>
        <div className="space-y-4">
          <div>
            <p className="text-sm text-slate-500 mb-1">강사 이름</p>
            <p className="text-lg font-bold text-slate-800">{teacher.name}</p>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-600 mb-2">
              수업 요일 선택
            </label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => (
                <button
                  key={day.id}
                  onClick={() => toggleDay(day.id)}
                  className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${
                    selectedDays.includes(day.id)
                      ? "bg-indigo-600 text-white shadow"
                      : "bg-white border text-slate-400 hover:border-indigo-300"
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={() => {
              onSave(teacher.id, selectedDays);
              onClose();
            }}
            className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700"
          >
            저장하기
          </button>
        </div>
      </div>
    </div>
  );
};

const PaymentDetailModal = ({
  student,
  onClose,
  onSavePayment,
  onUpdatePaymentHistory,
  showToast,
}) => {
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [amount, setAmount] = useState(student.tuitionFee || 0);

  const [editingHistoryId, setEditingHistoryId] = useState(null);
  const [editingDate, setEditingDate] = useState("");

  const historyList = useMemo(() => {
    return [...(student.paymentHistory || [])].sort((a, b) =>
      b.date.localeCompare(a.date)
    );
  }, [student.paymentHistory]);

  const currentSessions = useMemo(() => {
    const lastPayment = student.lastPaymentDate || "0000-00-00";
    return (student.attendanceHistory || [])
      .filter((h) => h.date >= lastPayment && h.status === "present")
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [student]);

  const handlePaymentSubmit = () => {
    if (!amount || amount <= 0) {
      showToast("금액을 확인해주세요.", "warning");
      return;
    }
    if (
      window.confirm(
        `${student.name} 원생의 ${Number(
          amount
        ).toLocaleString()}원 결제를 처리하시겠습니까?\n(선불: 입력하신 결제일(${paymentDate})을 기준으로 새로운 회차가 시작됩니다)`
      )
    ) {
      onSavePayment(student.id, paymentDate, parseInt(amount));
    }
  };

  const handleHistoryUpdate = (item) => {
    const newHistory = [...(student.paymentHistory || [])];
    const targetIndex = newHistory.findIndex((h) => h === item);
    if (targetIndex !== -1) {
      newHistory[targetIndex] = {
        ...newHistory[targetIndex],
        date: editingDate,
      };
      onUpdatePaymentHistory(student.id, newHistory);
      setEditingHistoryId(null);
    }
  };

  const handleHistoryDelete = (item) => {
    if (window.confirm("이 결제 기록을 정말 삭제하시겠습니까?")) {
      const newHistory = (student.paymentHistory || []).filter(
        (h) => h !== item
      );
      onUpdatePaymentHistory(student.id, newHistory);
    }
  };

  const getClassHistoryForPayment = (
    currentPayment,
    sortedHistory,
    allAttendance
  ) => {
    const myIndex = sortedHistory.findIndex((h) => h === currentPayment);
    const paymentDate = currentPayment.date;
    const nextPaymentDate =
      myIndex > 0 ? sortedHistory[myIndex - 1].date : null;
    const classes = allAttendance.filter((a) => {
      if (a.status !== "present") return false;
      if (a.date < paymentDate) return false;
      if (nextPaymentDate && a.date >= nextPaymentDate) return false;
      return true;
    });
    return classes.sort((a, b) => a.date.localeCompare(b.date));
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-lg">
              {student.name[0]}
            </div>
            <div>
              <h2 className="text-lg font-bold">{student.name} 수납 관리</h2>
              <p className="text-indigo-200 text-xs">
                {student.teacher} 선생님 | {student.className}요일
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50/50">
          <section>
            <div className="flex justify-between items-end mb-3">
              <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide flex items-center gap-2">
                <Timer size={16} /> 현재 세션 진행 현황
              </h3>
              <div className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-1 rounded">
                사용 횟수:{" "}
                <span className="text-base">{currentSessions.length}</span> / 4
                회
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              {currentSessions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {currentSessions.map((session, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-200 flex flex-col items-center min-w-[80px]"
                    >
                      <span className="text-[10px] text-slate-400 font-bold mb-0.5">
                        {idx + 1}회차 (사용)
                      </span>
                      <span className="text-slate-800 font-bold font-mono text-sm">
                        {session.date.slice(5)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-slate-400 text-sm border-2 border-dashed border-slate-100 rounded-lg">
                  결제 후 아직 진행된 수업이 없습니다. (0회 사용)
                </div>
              )}
              <div className="mt-4 pt-3 border-t border-slate-200 flex justify-between items-center">
                <span className="text-sm text-slate-600 font-medium">
                  진행률 (선불)
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        currentSessions.length >= 4
                          ? "bg-rose-500"
                          : "bg-emerald-500"
                      }`}
                      style={{
                        width: `${Math.min(
                          (currentSessions.length / 4) * 100,
                          100
                        )}%`,
                      }}
                    ></div>
                  </div>
                  <span
                    className={`font-bold ${
                      currentSessions.length >= 4
                        ? "text-rose-600"
                        : "text-emerald-600"
                    }`}
                  >
                    {currentSessions.length} / 4 회
                  </span>
                </div>
              </div>
            </div>
          </section>
          <section>
            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-3 flex items-center gap-2">
              <CreditCard size={16} /> 결제 등록 (선불 시작)
            </h3>
            <div className="bg-white border border-indigo-100 rounded-xl p-5 flex flex-col md:flex-row items-end gap-4 shadow-sm">
              <div className="flex-1 w-full">
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  결제 일자
                </label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full p-2.5 border border-slate-200 rounded-lg focus:outline-indigo-500 font-mono"
                />
              </div>
              <div className="flex-1 w-full">
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  결제 금액
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    ₩
                  </span>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full pl-7 p-2.5 border border-slate-200 rounded-lg focus:outline-indigo-500 font-bold text-slate-800"
                  />
                </div>
              </div>
              <button
                onClick={handlePaymentSubmit}
                className="w-full md:w-auto py-2.5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors shadow-md flex items-center justify-center gap-2 shrink-0"
              >
                <CheckCircle size={18} /> 결제 완료
              </button>
            </div>
            <p className="text-xs text-slate-400 mt-2 ml-1">
              * 오늘부터 새로운 4회 수업권이 시작됩니다.
            </p>
          </section>
          <section>
            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-3 flex items-center gap-2">
              <History size={16} /> 지난 결제 이력
            </h3>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 w-32">결제일</th>
                    <th className="px-4 py-3">수업 내역 (차감)</th>
                    <th className="px-4 py-3 w-28 text-right">금액</th>
                    <th className="px-4 py-3 w-20 text-center">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyList.length > 0 ? (
                    historyList.map((history, index) => {
                      const classes = getClassHistoryForPayment(
                        history,
                        historyList,
                        student.attendanceHistory || []
                      );
                      return (
                        <tr key={index} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-mono text-slate-600 align-top">
                            {editingHistoryId === history ? (
                              <input
                                type="date"
                                value={editingDate}
                                onChange={(e) => setEditingDate(e.target.value)}
                                className="border rounded p-1 w-full"
                              />
                            ) : (
                              history.date
                            )}
                          </td>
                          <td className="px-4 py-3 align-top">
                            {classes.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {classes.map((c, i) => (
                                  <span
                                    key={i}
                                    className="inline-block bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded text-xs font-mono"
                                  >
                                    {c.date.slice(5)}
                                  </span>
                                ))}
                                <span className="text-xs text-slate-400 ml-1 self-center">
                                  ({classes.length}회)
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-300">
                                - 내역 없음 -
                              </span>
                            )}
                            {index === 0 && classes.length < 4 && (
                              <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1 rounded ml-1">
                                진행중
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-bold text-slate-700 text-right align-top">
                            ₩{Number(history.amount).toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-center align-top">
                            {editingHistoryId === history ? (
                              <div className="flex flex-col gap-1">
                                <button
                                  onClick={() => handleHistoryUpdate(history)}
                                  className="text-emerald-600 font-bold text-xs hover:underline"
                                >
                                  저장
                                </button>
                                <button
                                  onClick={() => setEditingHistoryId(null)}
                                  className="text-slate-400 text-xs hover:underline"
                                >
                                  취소
                                </button>
                              </div>
                            ) : (
                              <div className="flex justify-center gap-2 text-slate-400">
                                <button
                                  onClick={() => {
                                    setEditingHistoryId(history);
                                    setEditingDate(history.date);
                                  }}
                                  className="hover:text-indigo-600"
                                >
                                  <Pencil size={14} />
                                </button>
                                <button
                                  onClick={() => handleHistoryDelete(history)}
                                  className="hover:text-rose-600"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan="4"
                        className="px-4 py-8 text-center text-slate-400"
                      >
                        결제 기록이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

// --- [DashboardView] ---
const DashboardView = ({ students, consultations, user }) => {
  const myStudents =
    user.role === "teacher"
      ? students.filter((s) => s.teacher === user.name && s.status === "재원")
      : students.filter((s) => s.status === "재원");
  const paymentDueCount = myStudents.filter(
    (s) => (s.sessionsCompleted || 0) >= 4
  ).length;
  const totalRevenue =
    user.role === "admin"
      ? myStudents.reduce((sum, s) => sum + (Number(s.tuitionFee) || 0), 0)
      : 0;

  // 상담 중 진행중인 건들 (관리자만 보임)
  const pendingConsultations = useMemo(() => {
    if (!consultations || user.role !== "admin") return [];
    return consultations.filter((c) => c.status === "pending");
  }, [consultations, user]);

  return (
    <div className="space-y-6 w-full animate-fade-in">
      {user.role === "teacher" && (
        <div className="bg-indigo-50 p-4 rounded-lg flex items-center text-indigo-800 mb-4">
          <UserCircle className="mr-2" size={20} />
          <span className="font-bold">{user.name} 선생님</span>, 환영합니다!
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 w-full">
        <StatCard
          icon={Users}
          label={user.role === "admin" ? "총 원생 수" : "담당 원생 수"}
          value={`${myStudents.length}명`}
          trendUp={true}
        />
        <StatCard
          icon={CreditCard}
          label={
            user.role === "admin" ? "전체 예상 매출" : "매출 조회 권한 없음"
          }
          value={
            user.role === "admin" ? `₩${totalRevenue.toLocaleString()}` : "-"
          }
          trendUp={true}
        />
        <StatCard
          icon={CheckCircle}
          label="오늘 출석률"
          value="-"
          trendUp={true}
        />
        <StatCard
          icon={AlertCircle}
          label="결제 대상(4회 완료)"
          value={`${paymentDueCount}명`}
          trend="확인 필요"
          trendUp={false}
        />
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border text-center text-slate-500">
        <TrendingUp size={48} className="mx-auto mb-4 opacity-20" />
        <p>
          데이터가 쌓이면 이곳에 월별 매출 및 원생 추이 그래프가 표시됩니다.
        </p>
      </div>

      {/* [NEW] 진행 중인 상담 / 할 일 섹션 (관리자용) */}
      {user.role === "admin" && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center">
            <ListTodo className="mr-2 text-indigo-600" size={20} /> 진행 중인
            상담 / 할 일
          </h3>
          {pendingConsultations.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {pendingConsultations.map((consult) => (
                <div
                  key={consult.id}
                  className="border rounded-lg p-4 bg-slate-50 hover:bg-white hover:shadow-md transition-all"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-bold text-slate-800">
                        {consult.name}
                      </span>
                      <span className="text-xs text-slate-500 ml-1">
                        ({consult.phone})
                      </span>
                    </div>
                    <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold">
                      {consult.date}
                    </span>
                  </div>
                  <div className="text-sm text-slate-600 mb-2 font-medium">
                    {consult.subject || "과목 미정"}
                  </div>

                  {/* 할 일 태그 표시 */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {consult.followUpActions &&
                    consult.followUpActions.length > 0 ? (
                      consult.followUpActions.map((actionId) => {
                        const option = FOLLOW_UP_OPTIONS.find(
                          (opt) => opt.id === actionId
                        );
                        if (!option) return null;
                        return (
                          <span
                            key={actionId}
                            className={`text-[10px] px-1.5 py-0.5 rounded border ${
                              option.color === "blue"
                                ? "bg-blue-50 text-blue-600 border-blue-100"
                                : option.color === "purple"
                                ? "bg-purple-50 text-purple-600 border-purple-100"
                                : "bg-green-50 text-green-600 border-green-100"
                            }`}
                          >
                            {option.label}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-xs text-slate-400">
                        지정된 후속 조치 없음
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-4 text-center">
              현재 대기 중인 상담이 없습니다.
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// --- [ConsultationView] ---
const ConsultationView = ({
  onRegisterStudent,
  showToast,
  consultations: allConsultations,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentConsult, setCurrentConsult] = useState({
    id: null,
    name: "",
    phone: "",
    date: new Date().toISOString().split("T")[0],
    subject: "",
    note: "",
    type: "student",
    grade: "",
    status: "pending",
    failReason: "",
    followUpActions: [],
    followUpNote: "",
  });

  // 탭 상태: pending(진행중), archived(완료)
  const [viewMode, setViewMode] = useState("pending");

  // 필터링된 리스트
  const filteredConsultations = useMemo(() => {
    if (viewMode === "pending") {
      return allConsultations.filter((c) => c.status === "pending");
    } else {
      return allConsultations.filter((c) => c.status !== "pending");
    }
  }, [allConsultations, viewMode]);

  const openModal = (consult = null) => {
    if (consult) {
      setCurrentConsult({
        ...consult,
        type: consult.type || "student",
        grade: consult.grade || "",
        status: consult.status || "pending",
        failReason: consult.failReason || "",
        followUpActions: consult.followUpActions || [],
        followUpNote: consult.followUpNote || "",
      });
    } else {
      setCurrentConsult({
        id: null,
        name: "",
        phone: "",
        date: new Date().toISOString().split("T")[0],
        subject: "",
        note: "",
        type: "student",
        grade: "",
        status: "pending",
        failReason: "",
        followUpActions: [],
        followUpNote: "",
      });
    }
    setIsModalOpen(true);
  };

  const toggleFollowUpAction = (actionId) => {
    const currentActions = currentConsult.followUpActions || [];
    if (currentActions.includes(actionId)) {
      setCurrentConsult({
        ...currentConsult,
        followUpActions: currentActions.filter((id) => id !== actionId),
      });
    } else {
      setCurrentConsult({
        ...currentConsult,
        followUpActions: [...currentActions, actionId],
      });
    }
  };

  const handleSaveConsultation = async () => {
    if (!currentConsult.name || !currentConsult.phone) {
      showToast("이름과 연락처를 입력해주세요.", "warning");
      return;
    }
    try {
      if (currentConsult.id) {
        await updateDoc(
          doc(
            db,
            "artifacts",
            APP_ID,
            "public",
            "data",
            "consultations",
            currentConsult.id
          ),
          { ...currentConsult }
        );
        showToast("상담 정보가 수정되었습니다.", "success");
      } else {
        const { id, ...dataToSave } = currentConsult;
        await addDoc(
          collection(
            db,
            "artifacts",
            APP_ID,
            "public",
            "data",
            "consultations"
          ),
          { ...dataToSave, createdAt: new Date().toISOString() }
        );
        showToast("상담이 등록되었습니다.", "success");
      }
      setIsModalOpen(false);
    } catch (e) {
      console.error(e);
      showToast("오류가 발생했습니다.", "error");
    }
  };

  const deleteConsultation = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("삭제하시겠습니까?")) return;
    try {
      await deleteDoc(
        doc(db, "artifacts", APP_ID, "public", "data", "consultations", id)
      );
      showToast("삭제되었습니다.", "success");
    } catch (e) {
      showToast("삭제 실패", "error");
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 h-full flex flex-col overflow-hidden">
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-800">
                {currentConsult.id ? "상담 정보 수정" : "신규 상담 등록"}
              </h2>
              <button onClick={() => setIsModalOpen(false)}>
                <X size={20} className="text-slate-400" />
              </button>
            </div>
            <div className="space-y-4">
              {/* 폼 내용 (기존과 동일) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">
                    상담 일자
                  </label>
                  <input
                    type="date"
                    value={currentConsult.date}
                    onChange={(e) =>
                      setCurrentConsult({
                        ...currentConsult,
                        date: e.target.value,
                      })
                    }
                    className="w-full p-2 border rounded bg-slate-50"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">
                    구분
                  </label>
                  <div className="flex bg-slate-100 rounded p-1">
                    <button
                      onClick={() =>
                        setCurrentConsult({
                          ...currentConsult,
                          type: "student",
                        })
                      }
                      className={`flex-1 text-xs py-1.5 rounded font-bold transition-all ${
                        currentConsult.type === "student"
                          ? "bg-white shadow text-indigo-600"
                          : "text-slate-400"
                      }`}
                    >
                      학생
                    </button>
                    <button
                      onClick={() =>
                        setCurrentConsult({ ...currentConsult, type: "adult" })
                      }
                      className={`flex-1 text-xs py-1.5 rounded font-bold transition-all ${
                        currentConsult.type === "adult"
                          ? "bg-white shadow text-indigo-600"
                          : "text-slate-400"
                      }`}
                    >
                      성인
                    </button>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 mb-1 block">
                    이름
                  </label>
                  <input
                    value={currentConsult.name}
                    onChange={(e) =>
                      setCurrentConsult({
                        ...currentConsult,
                        name: e.target.value,
                      })
                    }
                    className="w-full p-2 border rounded"
                    placeholder="이름"
                  />
                </div>
                {currentConsult.type === "student" && (
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">
                      학년
                    </label>
                    <select
                      value={currentConsult.grade}
                      onChange={(e) =>
                        setCurrentConsult({
                          ...currentConsult,
                          grade: e.target.value,
                        })
                      }
                      className="w-full p-2 border rounded bg-white"
                    >
                      <option value="">선택</option>
                      {GRADE_OPTIONS.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">
                  연락처
                </label>
                <input
                  value={currentConsult.phone}
                  onChange={(e) =>
                    setCurrentConsult({
                      ...currentConsult,
                      phone: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded"
                  placeholder="010-0000-0000"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">
                  희망 과목
                </label>
                <input
                  value={currentConsult.subject}
                  onChange={(e) =>
                    setCurrentConsult({
                      ...currentConsult,
                      subject: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded"
                  placeholder="예: 피아노, 바이올린"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 mb-1 block">
                  상담 내용
                </label>
                <textarea
                  value={currentConsult.note}
                  onChange={(e) =>
                    setCurrentConsult({
                      ...currentConsult,
                      note: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded h-20"
                  placeholder="특이사항 등"
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <label className="text-xs font-bold text-slate-500 mb-2 block flex items-center">
                  <CheckSquare size={14} className="mr-1" /> 후속 조치 (할 일)
                </label>
                <div className="space-y-2 mb-2">
                  {FOLLOW_UP_OPTIONS.map((opt) => (
                    <label
                      key={opt.id}
                      className="flex items-center text-sm text-slate-700 cursor-pointer hover:bg-slate-100 p-1 rounded"
                    >
                      <input
                        type="checkbox"
                        className="mr-2 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        checked={(
                          currentConsult.followUpActions || []
                        ).includes(opt.id)}
                        onChange={() => toggleFollowUpAction(opt.id)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
                <textarea
                  value={currentConsult.followUpNote}
                  onChange={(e) =>
                    setCurrentConsult({
                      ...currentConsult,
                      followUpNote: e.target.value,
                    })
                  }
                  className="w-full p-2 border rounded bg-white text-xs h-16 resize-none focus:outline-indigo-500"
                  placeholder="후속 조치 관련 메모"
                />
              </div>

              <div className="pt-2 border-t mt-2">
                <label className="text-xs font-bold text-slate-500 mb-2 block">
                  상담 결과
                </label>
                <div className="flex gap-2 mb-3">
                  {["pending", "registered", "dropped"].map((status) => (
                    <button
                      key={status}
                      onClick={() =>
                        setCurrentConsult({ ...currentConsult, status })
                      }
                      className={`flex-1 py-1.5 text-xs rounded font-bold border ${
                        currentConsult.status === status
                          ? status === "registered"
                            ? "bg-emerald-100 border-emerald-200 text-emerald-700"
                            : status === "dropped"
                            ? "bg-rose-100 border-rose-200 text-rose-700"
                            : "bg-slate-200 border-slate-300 text-slate-700"
                          : "bg-white border-slate-200 text-slate-400"
                      }`}
                    >
                      {status === "pending"
                        ? "대기"
                        : status === "registered"
                        ? "등록"
                        : "미등록"}
                    </button>
                  ))}
                </div>
                {currentConsult.status === "dropped" && (
                  <div>
                    <label className="text-xs font-bold text-rose-500 mb-1 block">
                      미등록 사유
                    </label>
                    <input
                      value={currentConsult.failReason}
                      onChange={(e) =>
                        setCurrentConsult({
                          ...currentConsult,
                          failReason: e.target.value,
                        })
                      }
                      className="w-full p-2 border border-rose-200 rounded bg-rose-50 text-rose-800 placeholder-rose-300"
                      placeholder="사유 입력"
                    />
                  </div>
                )}
              </div>
              <button
                onClick={handleSaveConsultation}
                className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 mt-2 shadow-sm"
              >
                {currentConsult.id ? "수정 저장" : "상담 등록"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-center mb-6 shrink-0 gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-bold flex items-center">
            <MessageSquareText className="mr-2" /> 상담 관리
          </h2>

          {/* 탭 버튼 */}
          <div className="flex bg-slate-100 p-1 rounded-lg">
            <button
              onClick={() => setViewMode("pending")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                viewMode === "pending"
                  ? "bg-white text-indigo-600 shadow"
                  : "text-slate-500"
              }`}
            >
              진행 중 (
              {allConsultations.filter((c) => c.status === "pending").length})
            </button>
            <button
              onClick={() => setViewMode("archived")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                viewMode === "archived"
                  ? "bg-white text-slate-700 shadow"
                  : "text-slate-500"
              }`}
            >
              <Archive size={12} className="inline mr-1 mb-0.5" />
              완료/보관함 (
              {allConsultations.filter((c) => c.status !== "pending").length})
            </button>
          </div>
        </div>
        <button
          onClick={() => openModal()}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold flex items-center hover:bg-indigo-700 transition-colors"
        >
          <Plus size={16} className="mr-1" /> 상담 추가
        </button>
      </div>

      <div className="flex-1 overflow-auto border rounded-lg">
        <table className="w-full text-left min-w-[800px]">
          <thead className="sticky top-0 bg-slate-50 border-b text-slate-500 text-xs uppercase">
            <tr>
              <th className="px-4 py-3 w-28">날짜</th>
              <th className="px-4 py-3 w-20">구분</th>
              <th className="px-4 py-3">이름/연락처</th>
              <th className="px-4 py-3">과목/내용</th>
              <th className="px-4 py-3 w-24 text-center">상태</th>
              <th className="px-4 py-3 w-20 text-right">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredConsultations.length > 0 ? (
              filteredConsultations.map((consult) => (
                <tr
                  key={consult.id}
                  className="hover:bg-slate-50 cursor-pointer"
                  onClick={() => openModal(consult)}
                >
                  <td className="px-4 py-3 text-sm text-slate-600">
                    {consult.date}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {consult.type === "adult" ? (
                      <span className="text-slate-500 font-bold text-xs">
                        성인
                      </span>
                    ) : (
                      <span className="text-indigo-600 font-bold text-xs">
                        학생 {consult.grade && `(${consult.grade})`}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">
                      {consult.name}
                    </div>
                    <div className="text-xs text-slate-400">
                      {consult.phone}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <div className="font-bold text-indigo-600 mb-0.5">
                      {consult.subject}
                    </div>
                    <div className="text-slate-500 text-xs truncate max-w-[200px]">
                      {consult.note}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {consult.followUpActions?.map((actionId) => {
                        const option = FOLLOW_UP_OPTIONS.find(
                          (opt) => opt.id === actionId
                        );
                        if (!option) return null;
                        return (
                          <span
                            key={actionId}
                            className={`text-[10px] px-1.5 py-0.5 rounded border ${
                              option.color === "blue"
                                ? "bg-blue-50 text-blue-600 border-blue-100"
                                : option.color === "purple"
                                ? "bg-purple-50 text-purple-600 border-purple-100"
                                : "bg-green-50 text-green-600 border-green-100"
                            }`}
                          >
                            {option.label}
                          </span>
                        );
                      })}
                    </div>
                    {consult.followUpNote && (
                      <div className="flex items-start gap-1 mt-1 text-slate-400 text-[10px]">
                        <StickyNote size={10} className="mt-0.5 shrink-0" />
                        <span>{consult.followUpNote}</span>
                      </div>
                    )}
                    {consult.status === "dropped" && consult.failReason && (
                      <div className="text-rose-500 text-xs mt-1">
                        사유: {consult.failReason}
                      </div>
                    )}
                  </td>
                  <td
                    className="px-4 py-3 text-center"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {consult.status === "registered" ? (
                      <span className="inline-flex px-2 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                        등록됨
                      </span>
                    ) : consult.status === "dropped" ? (
                      <span className="inline-flex px-2 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 border border-rose-200">
                        미등록
                      </span>
                    ) : (
                      <button
                        onClick={() => onRegisterStudent(consult)}
                        className="inline-flex items-center px-3 py-1 rounded bg-indigo-50 text-indigo-600 text-xs font-bold border border-indigo-200 hover:bg-indigo-100 transition-colors shadow-sm"
                      >
                        원생 등록 <ChevronRight size={12} className="ml-1" />
                      </button>
                    )}
                  </td>
                  <td
                    className="px-4 py-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={(e) => deleteConsultation(e, consult.id)}
                      className="text-slate-300 hover:text-rose-500 p-1"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="6" className="text-center py-10 text-slate-400">
                  내역이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// --- [CalendarView] ---
const CalendarView = ({ teachers, user, students, showToast }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [attendanceMenu, setAttendanceMenu] = useState(null);
  const [reasonModal, setReasonModal] = useState(null);
  const [dateDetail, setDateDetail] = useState(null);
  const [showNewOnly, setShowNewOnly] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    if (user.role === "teacher") setSelectedTeacher(user.name);
  }, [user]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  const getTeachersByDay = (dayIndex) => {
    let dayTeachers = teachers.filter(
      (t) => t.days && t.days.includes(dayIndex)
    );
    if (selectedTeacher)
      dayTeachers = dayTeachers.filter((t) => t.name === selectedTeacher);
    return dayTeachers;
  };

  const getStudentsForCell = (teacherName, dayOfWeek, dateStr) => {
    const dayNameMap = ["일", "월", "화", "수", "목", "금", "토"];
    const dayName = dayNameMap[dayOfWeek];
    const scheduled = students.filter(
      (s) =>
        s.teacher === teacherName &&
        s.className === dayName &&
        s.status === "재원"
    );
    const attended = students.filter((s) => {
      if (s.teacher !== teacherName) return false;
      if (s.status !== "재원") return false;
      return s.attendanceHistory?.some((h) => h.date === dateStr);
    });
    const merged = [...scheduled];
    attended.forEach((s) => {
      if (!merged.find((m) => m.id === s.id)) merged.push(s);
    });
    return merged;
  };

  const handleCalendarAttendance = async (
    student,
    date,
    status,
    reason = ""
  ) => {
    if (!auth.currentUser) return;
    try {
      const studentRef = doc(
        db,
        "artifacts",
        APP_ID,
        "public",
        "data",
        "students",
        student.id
      );
      let history = [...(student.attendanceHistory || [])];
      const existingIdx = history.findIndex((h) => h.date === date);

      if (status === "delete") {
        if (existingIdx > -1) history.splice(existingIdx, 1);
      } else {
        const record = {
          date: date,
          status: status,
          reason: reason,
          timestamp: new Date().toISOString(),
        };
        if (existingIdx > -1) history[existingIdx] = record;
        else history.push(record);
      }

      const lastPayment = student.lastPaymentDate || "0000-00-00";
      const count = history.filter(
        (h) => h.status === "present" && h.date >= lastPayment
      ).length;

      await updateDoc(studentRef, {
        attendanceHistory: history,
        sessionsCompleted: count,
      });
      setAttendanceMenu(null);
      setReasonModal(null);
      showToast(status === "delete" ? "기록 삭제됨" : "저장됨", "success");
    } catch (e) {
      console.error(e);
      showToast("오류 발생", "error");
    }
  };

  const handleStatusSelect = (status) => {
    if (status === "present" || status === "delete") {
      handleCalendarAttendance(
        attendanceMenu.student,
        attendanceMenu.date,
        status
      );
    } else {
      setReasonModal({
        student: attendanceMenu.student,
        date: attendanceMenu.date,
        status: status,
      });
      setAttendanceMenu(null);
    }
  };

  const getDetailModalData = (dateStr, dayOfWeek) => {
    let currentTeachers = teachers;
    if (selectedTeacher) {
      currentTeachers = teachers.filter((t) => t.name === selectedTeacher);
    }
    let allStudents = [];
    currentTeachers.forEach((t) => {
      const studentsForTeacher = getStudentsForCell(t.name, dayOfWeek, dateStr);
      allStudents = [...allStudents, ...studentsForTeacher];
    });
    return allStudents;
  };

  const newStudentsThisMonth = useMemo(() => {
    return students.filter((s) => {
      // 등록일(registerDate)이 있으면 그것을, 없으면 생성일(createdAt) 사용
      const dateToCheck =
        s.registerDate || (s.createdAt ? s.createdAt.slice(0, 10) : "");
      if (!dateToCheck) return false;
      const regDate = dateToCheck.substring(0, 7);
      const currentMonthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
      return regDate === currentMonthStr;
    });
  }, [students, year, month]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 animate-fade-in h-full flex flex-col">
      {attendanceMenu && (
        <AttendanceActionModal
          student={attendanceMenu.student}
          date={attendanceMenu.date}
          onClose={() => setAttendanceMenu(null)}
          onSelectStatus={handleStatusSelect}
        />
      )}
      {reasonModal && (
        <ReasonInputModal
          student={reasonModal.student}
          status={reasonModal.status}
          onClose={() => setReasonModal(null)}
          onSave={(reason) =>
            handleCalendarAttendance(
              reasonModal.student,
              reasonModal.date,
              reasonModal.status,
              reason
            )
          }
        />
      )}

      {dateDetail && (
        <DateDetailModal
          date={dateDetail.date}
          students={dateDetail.students}
          onClose={() => setDateDetail(null)}
          onStudentClick={(s, date) => setAttendanceMenu({ student: s, date })}
        />
      )}

      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center">
          <CalendarIcon className="mr-2 text-indigo-600" size={24} />
          {year}년 {month + 1}월
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNewOnly(!showNewOnly)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors flex items-center ${
              showNewOnly
                ? "bg-yellow-100 border-yellow-300 text-yellow-700"
                : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            <UserPlus size={14} className="mr-1" />{" "}
            {showNewOnly ? "신규생만 보기" : "신규생 보기"}
          </button>

          <div className="relative">
            <Filter
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <select
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="pl-9 pr-4 py-1.5 border rounded-lg text-sm bg-slate-50 focus:outline-indigo-500"
            >
              <option value="">전체 강사 보기</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name} 선생님
                </option>
              ))}
            </select>
          </div>
          <div className="flex space-x-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
              className="p-1.5 hover:bg-white rounded-md text-slate-600 shadow-sm"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1.5 text-xs font-bold hover:bg-white rounded-md text-slate-600 shadow-sm"
            >
              이번달
            </button>
            <button
              onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
              className="p-1.5 hover:bg-white rounded-md text-slate-600 shadow-sm"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden flex-1">
        {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
          <div
            key={day}
            className="bg-slate-50 p-2 text-center text-sm font-bold text-slate-500"
          >
            {day}
          </div>
        ))}
        {days.map((day, idx) => {
          if (!day)
            return (
              <div key={idx} className="bg-slate-50/50 min-h-[80px]"></div>
            );
          const dateStr = `${year}-${String(month + 1).padStart(
            2,
            "0"
          )}-${String(day).padStart(2, "0")}`;
          const isHoliday = HOLIDAYS[dateStr];
          const dayOfWeek = idx % 7;
          let teachersForDay = getTeachersByDay(dayOfWeek).map((t) => t.name);
          const isSunday = dayOfWeek === 0;

          if (showNewOnly) {
            const newStudents = students.filter((s) => {
              const regDate =
                s.registerDate || (s.createdAt ? s.createdAt.slice(0, 10) : "");
              return regDate === dateStr;
            });

            return (
              <div
                key={idx}
                className="bg-white p-2 min-h-[80px] hover:bg-indigo-50 transition-colors relative group border-t border-slate-50"
              >
                <div className="flex justify-between items-start">
                  <span
                    className={`text-sm font-medium ${
                      isSunday || isHoliday
                        ? "text-rose-500"
                        : dayOfWeek === 6
                        ? "text-blue-500"
                        : "text-slate-700"
                    }`}
                  >
                    {day}
                  </span>
                  {isHoliday && (
                    <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-1 rounded">
                      {isHoliday}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-col gap-1">
                  {newStudents.map((s, i) => (
                    <div
                      key={i}
                      className="text-[10px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded flex items-center shadow-sm border border-yellow-200"
                    >
                      <span className="font-bold mr-1">NEW</span> {s.name}
                    </div>
                  ))}
                  {newStudents.length === 0 && !isHoliday && (
                    <div className="text-[10px] text-slate-300 text-center mt-2">
                      -
                    </div>
                  )}
                </div>
              </div>
            );
          }

          let allCellItems = [];
          if (selectedTeacher) {
            const studentsForCell = getStudentsForCell(
              selectedTeacher,
              dayOfWeek,
              dateStr
            );
            allCellItems = studentsForCell.map((s) => ({
              type: "student",
              data: s,
            }));
          } else {
            allCellItems = teachersForDay.map((t) => ({
              type: "teacher",
              name: t,
            }));
          }

          const MAX_DISPLAY = 4;
          const overflowCount = allCellItems.length - MAX_DISPLAY;
          const displayItems = allCellItems.slice(0, MAX_DISPLAY);

          return (
            <div
              key={idx}
              className={`bg-white p-2 min-h-[80px] hover:bg-indigo-50 transition-colors relative group border-t border-slate-50 cursor-pointer`}
              onClick={() => {
                const details = getDetailModalData(dateStr, dayOfWeek);
                if (
                  (details.length > 0 || teachersForDay.length > 0) &&
                  !isHoliday
                ) {
                  setDateDetail({ date: dateStr, students: details });
                }
              }}
            >
              <div className="flex justify-between items-start">
                <span
                  className={`text-sm font-medium ${
                    isSunday || isHoliday
                      ? "text-rose-500"
                      : dayOfWeek === 6
                      ? "text-blue-500"
                      : "text-slate-700"
                  }`}
                >
                  {day}
                </span>
                {isHoliday && (
                  <span className="text-[10px] font-bold text-rose-500 bg-rose-50 px-1 rounded">
                    {isHoliday}
                  </span>
                )}
              </div>
              {isHoliday ? (
                <div className="mt-2 text-xs text-rose-400 font-medium text-center bg-rose-50/50 rounded py-1">
                  휴강
                </div>
              ) : (
                <div className="mt-1 flex flex-col gap-1">
                  {displayItems.map((item, i) => {
                    if (item.type === "teacher") {
                      return (
                        <span
                          key={i}
                          className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded truncate"
                        >
                          {item.name}
                        </span>
                      );
                    } else {
                      const s = item.data;
                      const record = s.attendanceHistory?.find(
                        (h) => h.date === dateStr
                      );
                      const status = record ? record.status : "scheduled";
                      let bgClass =
                        "bg-slate-100 text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50";
                      if (status === "present")
                        bgClass =
                          "bg-emerald-100 text-emerald-700 border-emerald-200 font-bold hover:bg-emerald-200";
                      else if (status === "absent")
                        bgClass =
                          "bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200";
                      else if (status === "canceled")
                        bgClass =
                          "bg-gray-100 text-gray-400 border-gray-200 line-through hover:bg-gray-200";

                      return (
                        <div
                          key={i}
                          onClick={(e) => {
                            e.stopPropagation();
                            setAttendanceMenu({ student: s, date: dateStr });
                          }}
                          className={`text-[10px] px-1.5 py-1 rounded border ${bgClass} font-medium truncate flex justify-between items-center transition-all shadow-sm`}
                        >
                          <span>{s.name}</span>
                          {status === "present" && (
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-1"></div>
                          )}
                        </div>
                      );
                    }
                  })}
                  {overflowCount > 0 && (
                    <div className="text-[10px] text-slate-400 font-medium text-center mt-1">
                      + {overflowCount}명 더보기
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* [NEW] 이번 달 신규 원생 리스트 (하단) */}
      <div className="mt-4 bg-yellow-50 border border-yellow-100 rounded-xl p-4 flex items-center gap-4">
        <div className="flex items-center text-yellow-800 font-bold shrink-0">
          <UserPlus className="mr-2" size={20} /> 이번 달 신규 원생 (
          {newStudentsThisMonth.length}명)
        </div>
        <div className="flex flex-wrap gap-2">
          {newStudentsThisMonth.length > 0 ? (
            newStudentsThisMonth.map((s) => {
              const displayDate =
                s.registerDate ||
                (s.createdAt ? s.createdAt.substring(0, 10) : "날짜미상");
              return (
                <span
                  key={s.id}
                  className="bg-white border border-yellow-200 text-yellow-700 px-3 py-1 rounded-lg text-xs font-medium shadow-sm"
                >
                  {s.name} ({displayDate.substring(5)})
                </span>
              );
            })
          ) : (
            <span className="text-xs text-yellow-600">
              신규 등록된 원생이 없습니다.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

// --- [ClassLogView 정의 (수업 일지)] ---
const ClassLogView = ({ students, teachers, user }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedTeacher, setSelectedTeacher] = useState(
    user.role === "teacher" ? user.name : ""
  );

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(i);

  // 회차 계산 함수 (결제일 기준)
  const getSessionCount = (student, targetDate) => {
    const history = student.attendanceHistory || [];
    const lastPayment = student.lastPaymentDate || "0000-00-00";

    // 선불제: 결제일 이후 수업만 카운트
    const validSessions = history
      .filter((h) => h.status === "present" && h.date >= lastPayment)
      .sort((a, b) => a.date.localeCompare(b.date));

    const index = validSessions.findIndex((h) => h.date === targetDate);
    return index !== -1 ? index + 1 : 0;
  };

  const getCellContent = (dateStr) => {
    let content = [];

    // 해당 날짜에 수업이 있는 학생들 찾기 (attendanceHistory 기준)
    students.forEach((s) => {
      const record = s.attendanceHistory?.find((h) => h.date === dateStr);
      if (record) {
        // 강사 필터링
        if (selectedTeacher && s.teacher !== selectedTeacher) return;

        const sessionNum = getSessionCount(s, dateStr);
        const statusMark =
          record.status === "present" ? `(${sessionNum})` : "(x)";
        const time = s.time || ""; // 시간 정보가 없으면 공란

        content.push({
          id: s.id,
          text: `${time} ${s.name}${statusMark}`,
          status: record.status,
          teacher: s.teacher,
        });
      }
    });

    // 시간순 정렬 (시간 정보가 텍스트라 완벽하진 않지만 대략적으로 정렬)
    content.sort((a, b) => a.text.localeCompare(b.text));

    return content;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 h-full flex flex-col animate-fade-in">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-slate-800 flex items-center">
          <BookOpen className="mr-2 text-indigo-600" size={24} /> 수업 일지
        </h2>
        <div className="flex items-center gap-2">
          {user.role === "admin" && (
            <select
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="p-2 border rounded-lg text-sm"
            >
              <option value="">전체 강사</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          <div className="flex space-x-1 bg-slate-100 rounded-lg p-1">
            <button
              onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
              className="p-1.5 hover:bg-white rounded-md text-slate-600 shadow-sm"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="px-3 py-1.5 text-xs font-bold text-slate-600 flex items-center">
              {year}년 {month + 1}월
            </span>
            <button
              onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
              className="p-1.5 hover:bg-white rounded-md text-slate-600 shadow-sm"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden flex-1 flex flex-col">
        {/* 헤더 */}
        <div className="grid grid-cols-7 bg-slate-50 border-b divide-x divide-slate-200">
          {["일", "월", "화", "수", "목", "금", "토"].map((day, i) => (
            <div
              key={day}
              className={`p-2 text-center text-sm font-bold ${
                i === 0
                  ? "text-rose-500"
                  : i === 6
                  ? "text-blue-500"
                  : "text-slate-600"
              }`}
            >
              {day}
            </div>
          ))}
        </div>
        {/* 바디 */}
        <div className="grid grid-cols-7 flex-1 divide-x divide-y divide-slate-200 bg-white">
          {days.map((day, i) => {
            if (!day) return <div key={i} className="bg-slate-50/30"></div>;

            const dateStr = `${year}-${String(month + 1).padStart(
              2,
              "0"
            )}-${String(day).padStart(2, "0")}`;
            const isHoliday = HOLIDAYS[dateStr];
            const items = getCellContent(dateStr);

            return (
              <div
                key={i}
                className="min-h-[100px] p-1 relative hover:bg-slate-50 transition-colors"
              >
                <div className="flex justify-between px-1">
                  <span
                    className={`text-xs font-bold ${
                      i % 7 === 0
                        ? "text-rose-500"
                        : i % 7 === 6
                        ? "text-blue-500"
                        : "text-slate-400"
                    }`}
                  >
                    {day}
                  </span>
                  {isHoliday && (
                    <span className="text-[10px] text-rose-500 font-bold">
                      {isHoliday}
                    </span>
                  )}
                </div>
                <div className="mt-1 space-y-0.5">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      className={`text-[10px] px-1 py-0.5 rounded truncate ${
                        item.status === "present"
                          ? "text-slate-700"
                          : "text-slate-400 line-through"
                      }`}
                    >
                      {item.text}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// --- [SettingsView] ---
const SettingsView = ({ teachers, students, showToast, seedData }) => {
  const [newTeacherName, setNewTeacherName] = useState("");
  const [newTeacherDays, setNewTeacherDays] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);

  const toggleDay = (dayId) => {
    if (newTeacherDays.includes(dayId))
      setNewTeacherDays(newTeacherDays.filter((d) => d !== dayId));
    else setNewTeacherDays([...newTeacherDays, dayId]);
  };

  const handleAddTeacher = async () => {
    if (!newTeacherName.trim())
      return showToast("강사 이름을 입력해주세요.", "error");
    if (newTeacherDays.length === 0)
      return showToast("수업 요일을 선택해주세요.", "error");
    try {
      await addDoc(
        collection(db, "artifacts", APP_ID, "public", "data", "teachers"),
        {
          name: newTeacherName.trim(),
          days: newTeacherDays,
          createdAt: new Date().toISOString(),
        }
      );
      setNewTeacherName("");
      setNewTeacherDays([]);
      showToast("강사님이 추가되었습니다.", "success");
    } catch (e) {
      showToast("추가 실패", "error");
    }
  };

  const handleUpdateTeacher = async (id, days) => {
    try {
      await updateDoc(
        doc(db, "artifacts", APP_ID, "public", "data", "teachers", id),
        { days: days }
      );
      showToast("수정되었습니다.", "success");
    } catch (e) {
      showToast("수정 실패", "error");
    }
  };

  const handleDeleteTeacher = async (id, e) => {
    e.stopPropagation();
    if (typeof id === "number") {
      if (
        window.confirm(
          "현재는 샘플 데이터입니다. 실제 데이터로 변환하시겠습니까?"
        )
      ) {
        await seedData();
      }
      return;
    }
    if (window.confirm("정말 삭제하시겠습니까?")) {
      try {
        await deleteDoc(
          doc(db, "artifacts", APP_ID, "public", "data", "teachers", id)
        );
        showToast("삭제되었습니다.", "success");
      } catch (e) {
        console.error(e);
        showToast("삭제 실패", "error");
      }
    }
  };

  const handleDownloadTemplate = () => {
    if (typeof window.XLSX === "undefined") {
      showToast(
        "엑셀 기능을 로딩 중입니다. 잠시 후 다시 시도해주세요.",
        "error"
      );
      return;
    }
    try {
      const wb = window.XLSX.utils.book_new();
      const ws = window.XLSX.utils.aoa_to_sheet([
        [
          "이름",
          "학년",
          "연락처",
          "담당선생님",
          "요일",
          "원비",
          "과목",
          "등록일",
          "수업시간",
        ],
        [
          "홍길동",
          "초3",
          "010-1234-5678",
          "태유민",
          "월",
          "150000",
          "피아노",
          "2024-01-01",
          "14:30",
        ],
      ]);
      ws["!cols"] = [
        { wch: 10 },
        { wch: 8 },
        { wch: 15 },
        { wch: 10 },
        { wch: 15 },
        { wch: 10 },
        { wch: 10 },
        { wch: 15 },
        { wch: 10 },
      ];
      window.XLSX.utils.book_append_sheet(wb, ws, "원생등록양식");
      window.XLSX.writeFile(wb, "JNC_원생등록_예시.xlsx");
      showToast("예제 파일(xlsx)이 다운로드되었습니다.", "success");
    } catch (e) {
      console.error(e);
      showToast("다운로드 중 오류가 발생했습니다.", "error");
    }
  };

  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (typeof window.XLSX === "undefined") {
      showToast(
        "엑셀 라이브러리 로딩 중입니다. 잠시 후 다시 시도해주세요.",
        "error"
      );
      return;
    }

    setUploading(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = window.XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = window.XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
        });

        if (jsonData.length < 2) {
          showToast("데이터가 없습니다.", "warning");
          setUploading(false);
          return;
        }

        const rows = jsonData.slice(1);
        let successCount = 0;
        const studentsRef = collection(
          db,
          "artifacts",
          APP_ID,
          "public",
          "data",
          "students"
        );

        for (const row of rows) {
          const name = row[0];
          if (!name) continue;

          const studentData = {
            name: String(row[0] || ""),
            grade: String(row[1] || ""),
            phone: String(row[2] || ""),
            teacher: String(row[3] || ""),
            className: String(row[4] || "").split(",")[0],
            tuitionFee: parseInt(row[5] || 0),
            subject: String(row[6] || ""),
            registerDate: String(
              row[7] || new Date().toISOString().split("T")[0]
            ),
            time: String(row[8] || ""),
            status: "재원",
            lastPaymentDate: String(
              row[7] || new Date().toISOString().split("T")[0]
            ),
            sessionsCompleted: 0,
            totalSessions: 4,
            attendanceHistory: [],
            paymentHistory: [],
            createdAt: new Date().toISOString(),
          };

          await addDoc(studentsRef, studentData);
          successCount++;
        }

        showToast(`${successCount}명 등록 완료!`, "success");
      } catch (error) {
        console.error(error);
        showToast("업로드 실패: " + error.message, "error");
      } finally {
        setUploading(false);
        document.getElementById("excel-upload-input").value = "";
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // 데이터 백업(JSON 다운로드) 기능
  const handleBackupData = async () => {
    try {
      showToast("데이터를 백업 중입니다...", "info");
      const collectionsToBackup = ["students", "teachers", "consultations"];
      const backupData = {};

      for (const colName of collectionsToBackup) {
        const snapshot = await getDocs(
          collection(db, "artifacts", APP_ID, "public", "data", colName)
        );
        backupData[colName] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
      }

      const jsonString = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `jnc_backup_${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast("백업 파일이 다운로드되었습니다.", "success");
    } catch (e) {
      console.error(e);
      showToast("백업 중 오류가 발생했습니다.", "error");
    }
  };

  // 데이터 복구 (Upload)
  const handleRestoreData = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (
      !window.confirm(
        "주의: 현재 데이터를 덮어쓰거나 중복될 수 있습니다.\n정말 복구하시겠습니까?"
      )
    ) {
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const backupData = JSON.parse(event.target.result);
        let restoreCount = 0;

        for (const colName of ["students", "teachers", "consultations"]) {
          if (backupData[colName] && Array.isArray(backupData[colName])) {
            const colRef = collection(
              db,
              "artifacts",
              APP_ID,
              "public",
              "data",
              colName
            );
            for (const item of backupData[colName]) {
              const { id, ...data } = item;
              if (id) {
                await setDoc(
                  doc(db, "artifacts", APP_ID, "public", "data", colName, id),
                  data
                );
              } else {
                await addDoc(colRef, data);
              }
              restoreCount++;
            }
          }
        }
        showToast(
          `데이터 복구가 완료되었습니다. (${restoreCount}건)`,
          "success"
        );
      } catch (err) {
        console.error(err);
        showToast("복구 중 오류가 발생했습니다.", "error");
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 h-full overflow-auto">
      {editingTeacher && (
        <EditTeacherModal
          teacher={editingTeacher}
          onClose={() => setEditingTeacher(null)}
          onSave={handleUpdateTeacher}
        />
      )}

      {/* 데이터 백업 및 복구 섹션 */}
      <div className="mb-8 p-6 bg-indigo-50 rounded-xl border border-indigo-100">
        <h3 className="font-bold text-indigo-900 mb-4 flex items-center">
          <HardDrive className="mr-2" size={20} /> 데이터 백업 및 복구
        </h3>
        <p className="text-sm text-indigo-700 mb-4">
          현재 저장된 모든 데이터를 파일로 저장하거나, 저장된 파일을 불러와
          데이터를 복구합니다.
        </p>
        <div className="flex gap-3">
          <button
            onClick={handleBackupData}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors shadow-sm"
          >
            <Download size={18} className="mr-2" /> 전체 데이터 백업(저장)
          </button>
          <label className="inline-flex items-center px-4 py-2 bg-white border border-indigo-300 text-indigo-700 rounded-lg cursor-pointer hover:bg-indigo-50 transition-colors font-bold shadow-sm">
            <RefreshCcw size={18} className="mr-2" /> 데이터 복구(불러오기)
            <input
              type="file"
              accept=".json"
              onChange={handleRestoreData}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* 엑셀 업로드 섹션 */}
      <div className="mb-8 p-6 bg-emerald-50 rounded-xl border border-emerald-100">
        <h3 className="font-bold text-emerald-900 mb-4 flex items-center">
          <File className="mr-2" size={20} /> 원생 일괄 업로드 (Excel)
        </h3>
        <p className="text-sm text-emerald-700 mb-4">
          엑셀 파일의 첫 줄에{" "}
          <b>
            이름, 학년, 연락처, 담당선생님, 요일, 원비, 과목, 등록일, 수업시간
          </b>{" "}
          컬럼이 있어야 합니다.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleDownloadTemplate}
            className="inline-flex items-center px-4 py-2 bg-white border border-emerald-300 text-emerald-700 rounded-lg cursor-pointer hover:bg-emerald-50 transition-colors font-medium shadow-sm"
          >
            <Download size={18} className="mr-2" /> 예제 양식 다운로드
          </button>
          <label
            className={`inline-flex items-center px-4 py-2 bg-emerald-600 text-white rounded-lg cursor-pointer hover:bg-emerald-700 transition-colors shadow-sm ${
              uploading ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {uploading ? (
              <span className="flex items-center">
                <div className="animate-spin mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                업로드 중...
              </span>
            ) : (
              <>
                <Upload size={18} className="mr-2" /> 엑셀 파일 선택 (.xlsx)
              </>
            )}
            <input
              id="excel-upload-input"
              type="file"
              accept=".xlsx, .xls"
              onChange={handleExcelUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>
      </div>
      <div className="border-t border-slate-200 my-6"></div>
      <div className="mb-8">
        <h3 className="font-bold text-slate-800 flex items-center mb-4">
          <Settings className="mr-2 text-indigo-600" size={20} /> 강사 관리
        </h3>
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
          <div className="mb-4">
            <label className="block text-xs font-bold text-slate-500 mb-2">
              강사 이름
            </label>
            <div className="flex gap-2">
              <input
                value={newTeacherName}
                onChange={(e) => setNewTeacherName(e.target.value)}
                placeholder="이름 입력"
                className="flex-1 p-2 border rounded-lg focus:outline-indigo-600"
              />
              <button
                onClick={handleAddTeacher}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-indigo-700"
              >
                추가
              </button>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs font-bold text-slate-500 mb-2">
              수업 요일 선택
            </label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => (
                <button
                  key={day.id}
                  onClick={() => toggleDay(day.id)}
                  className={`w-8 h-8 rounded-full text-xs font-bold transition-all ${
                    newTeacherDays.includes(day.id)
                      ? "bg-indigo-600 text-white shadow"
                      : "bg-white border text-slate-400 hover:border-indigo-300"
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-6">
            {teachers.map((t) => (
              <div
                key={t.id}
                onClick={() => setEditingTeacher(t)}
                className="bg-white p-3 border rounded-lg flex flex-col justify-between shadow-sm cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-all relative group"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="font-medium text-slate-700">{t.name}</span>
                  <button
                    onClick={(e) => handleDeleteTeacher(t.id, e)}
                    className="text-slate-300 hover:text-red-500 p-1 relative z-10"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {t.days && t.days.length > 0 ? (
                    t.days.map((d) => (
                      <span
                        key={d}
                        className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded"
                      >
                        {DAYS_OF_WEEK.find((day) => day.id === d)?.label}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] text-slate-300">
                      요일 미지정 (클릭하여 수정)
                    </span>
                  )}
                </div>
                <div className="absolute top-2 right-8 opacity-0 group-hover:opacity-100 text-indigo-400">
                  <Pencil size={14} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      {teachers.length === 0 && (
        <div className="text-center mt-10">
          <button
            onClick={seedData}
            className="text-slate-400 hover:text-indigo-600 text-sm underline"
          >
            초기 데이터 생성 (강사 리스트 복구)
          </button>
        </div>
      )}
    </div>
  );
};

// --- [StudentView: 통계 및 삭제 포함] ---
const StudentView = ({
  students,
  teachers,
  showToast,
  user,
  registerFromConsultation,
  setRegisterFromConsultation,
  onDeleteStudent,
}) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [newStudent, setNewStudent] = useState({
    name: "",
    grade: "",
    phone: "",
    tuitionFee: "",
    teacher: "",
    className: "",
    subject: "",
    registerDate: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (registerFromConsultation) {
      setNewStudent((prev) => ({
        ...prev,
        name: registerFromConsultation.name || "",
        phone: registerFromConsultation.phone || "",
        grade: registerFromConsultation.grade || "",
        subject: registerFromConsultation.subject || "",
      }));
      setIsAdding(true);
    }
  }, [registerFromConsultation]);

  useEffect(() => {
    if (user.role === "teacher")
      setNewStudent((prev) => ({ ...prev, teacher: user.name }));
  }, [user]);

  const teacherDays = useMemo(() => {
    if (user.role !== "teacher") return CLASS_NAMES;
    const currentTeacher = teachers.find((t) => t.name === user.name);
    if (!currentTeacher || !currentTeacher.days) return [];
    return CLASS_NAMES.filter((_, idx) => {
      const dayId = idx === 6 ? 0 : idx + 1;
      return currentTeacher.days.includes(dayId);
    });
  }, [user, teachers]);

  const handleAddStudent = async () => {
    if (!newStudent.name || !newStudent.teacher || !newStudent.className) {
      showToast("필수 정보를 입력해주세요.", "warning");
      return;
    }
    try {
      // registerDate가 있으면 그것을 createdAt 대신 사용하거나 별도로 저장
      const regDate =
        newStudent.registerDate || new Date().toISOString().split("T")[0];

      await addDoc(
        collection(db, "artifacts", APP_ID, "public", "data", "students"),
        {
          ...newStudent,
          status: "재원",
          lastPaymentDate: regDate, // 초기 결제일은 등록일로 설정 (필요시 수정 가능)
          sessionsCompleted: 0,
          totalSessions: 4,
          tuitionFee:
            user.role === "admin" ? parseInt(newStudent.tuitionFee || 0) : 0,
          attendanceHistory: [],
          paymentHistory: [],
          createdAt: new Date().toISOString(), // 시스템 생성일
          registerDate: regDate, // 사용자가 지정한 등록일
        }
      );

      if (registerFromConsultation && registerFromConsultation.id) {
        const consultRef = doc(
          db,
          "artifacts",
          APP_ID,
          "public",
          "data",
          "consultations",
          registerFromConsultation.id
        );
        await updateDoc(consultRef, { status: "registered" });
        setRegisterFromConsultation(null);
      }

      setIsAdding(false);
      setNewStudent({
        name: "",
        grade: "",
        phone: "",
        tuitionFee: "",
        teacher: user.role === "teacher" ? user.name : "",
        className: "",
        subject: "",
        registerDate: new Date().toISOString().split("T")[0],
      });
      showToast("등록 완료!", "success");
    } catch (e) {
      showToast("등록 실패", "error");
    }
  };

  const handleUpdateStudent = async (id, updatedData) => {
    try {
      await updateDoc(
        doc(db, "artifacts", APP_ID, "public", "data", "students", id),
        updatedData
      );
      setEditingStudent(null);
      showToast("학생 정보가 수정되었습니다.", "success");
    } catch (e) {
      showToast("수정 실패: " + e.message, "error");
    }
  };

  const displayedStudents =
    user.role === "teacher"
      ? students.filter((s) => s.teacher === user.name)
      : students;

  // [NEW] 통계 데이터 계산
  const stats = useMemo(() => {
    const total = displayedStudents.length;
    const enrolled = displayedStudents.filter(
      (s) => s.status === "재원"
    ).length;
    const paused = displayedStudents.filter((s) => s.status === "휴원").length;
    const withdrawn = displayedStudents.filter(
      (s) => s.status === "퇴원"
    ).length;
    return { total, enrolled, paused, withdrawn };
  }, [displayedStudents]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 h-full flex flex-col overflow-hidden">
      {editingStudent && (
        <StudentEditModal
          student={editingStudent}
          teachers={teachers}
          onClose={() => setEditingStudent(null)}
          onUpdate={handleUpdateStudent}
          user={user}
        />
      )}

      <div className="flex justify-between items-center mb-6 shrink-0">
        <h2 className="text-lg font-bold flex items-center">
          <Users className="mr-2" /> 원생 관리
        </h2>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-colors ${
            isAdding ? "bg-slate-200" : "bg-indigo-600 text-white"
          }`}
        >
          {isAdding ? "취소" : "신규 등록"}
        </button>
      </div>

      {/* [NEW] 통계 바 */}
      <div className="grid grid-cols-4 gap-4 mb-6 shrink-0">
        <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-center">
          <p className="text-xs text-slate-500 font-bold mb-1">전체 원생</p>
          <p className="text-xl font-bold text-slate-800">{stats.total}명</p>
        </div>
        <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100 text-center">
          <p className="text-xs text-emerald-600 font-bold mb-1">재원생</p>
          <p className="text-xl font-bold text-emerald-700">
            {stats.enrolled}명
          </p>
        </div>
        <div className="bg-amber-50 p-3 rounded-lg border border-amber-100 text-center">
          <p className="text-xs text-amber-600 font-bold mb-1">휴원생</p>
          <p className="text-xl font-bold text-amber-700">{stats.paused}명</p>
        </div>
        <div className="bg-rose-50 p-3 rounded-lg border border-rose-100 text-center">
          <p className="text-xs text-rose-600 font-bold mb-1">퇴원생</p>
          <p className="text-xl font-bold text-rose-700">{stats.withdrawn}명</p>
        </div>
      </div>

      {isAdding && (
        <div className="bg-indigo-50 p-4 rounded-lg mb-4 grid grid-cols-1 md:grid-cols-3 gap-3 shrink-0">
          <input
            placeholder="이름"
            value={newStudent.name}
            onChange={(e) =>
              setNewStudent({ ...newStudent, name: e.target.value })
            }
            className="p-2 border rounded"
          />
          <input
            placeholder="학년"
            value={newStudent.grade}
            onChange={(e) =>
              setNewStudent({ ...newStudent, grade: e.target.value })
            }
            className="p-2 border rounded"
          />
          <input
            placeholder="연락처"
            value={newStudent.phone}
            onChange={(e) =>
              setNewStudent({ ...newStudent, phone: e.target.value })
            }
            className="p-2 border rounded"
          />

          {/* [NEW] 등록일 추가 */}
          <input
            type="date"
            value={newStudent.registerDate}
            onChange={(e) =>
              setNewStudent({ ...newStudent, registerDate: e.target.value })
            }
            className="p-2 border rounded"
            title="등록일"
          />

          {user.role === "admin" ? (
            <select
              value={newStudent.teacher}
              onChange={(e) =>
                setNewStudent({ ...newStudent, teacher: e.target.value })
              }
              className="p-2 border rounded bg-white"
            >
              <option value="">선생님 선택</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="p-2 border rounded bg-slate-200 text-slate-500">
              {user.name} (본인)
            </div>
          )}
          <select
            value={newStudent.className}
            onChange={(e) =>
              setNewStudent({ ...newStudent, className: e.target.value })
            }
            className="p-2 border rounded bg-white"
          >
            <option value="">요일 선택</option>
            {user.role === "admin"
              ? CLASS_NAMES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))
              : teacherDays.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
          </select>
          {user.role === "admin" && (
            <input
              placeholder="원비"
              type="number"
              value={newStudent.tuitionFee}
              onChange={(e) =>
                setNewStudent({ ...newStudent, tuitionFee: e.target.value })
              }
              className="p-2 border rounded"
            />
          )}

          <input
            placeholder="과목 (예: 피아노)"
            value={newStudent.subject}
            onChange={(e) =>
              setNewStudent({ ...newStudent, subject: e.target.value })
            }
            className="p-2 border rounded"
          />

          {/* [NEW] 수업 시간 추가 */}
          <input
            type="time"
            value={newStudent.time || ""}
            onChange={(e) =>
              setNewStudent({ ...newStudent, time: e.target.value })
            }
            className="p-2 border rounded"
            title="수업 시간"
          />

          <button
            onClick={handleAddStudent}
            className="col-span-full bg-indigo-600 text-white py-2 rounded font-bold"
          >
            저장하기
          </button>
        </div>
      )}
      <div className="flex-1 overflow-auto border rounded-lg">
        <table className="w-full text-left min-w-[700px]">
          <thead className="sticky top-0 bg-slate-50 border-b">
            <tr className="text-slate-500 text-xs uppercase">
              <th className="py-3 px-4">이름/학년</th>
              <th className="py-3 px-4">연락처</th>
              <th className="py-3 px-4">배정</th>
              {user.role === "admin" && <th className="py-3 px-4">원비</th>}
              <th className="py-3 px-4">상태</th>
              <th className="py-3 px-4 text-right">삭제</th>
            </tr>
          </thead>
          <tbody>
            {displayedStudents.map((s) => (
              <tr
                key={s.id}
                className="border-b hover:bg-slate-50 cursor-pointer"
                onClick={() => setEditingStudent(s)}
              >
                <td className="py-3 px-4">
                  <div className="font-medium text-indigo-900">{s.name}</div>
                  <div className="text-xs text-slate-500">
                    {s.grade}{" "}
                    {s.subject && (
                      <span className="text-indigo-500">| {s.subject}</span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4 text-sm text-slate-600">{s.phone}</td>
                <td className="py-3 px-4 text-sm">
                  <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-medium">
                    {s.className} | {s.teacher}
                  </span>
                </td>
                {user.role === "admin" && (
                  <td className="py-3 px-4 text-sm font-bold text-indigo-600">
                    {Number(s.tuitionFee).toLocaleString()}
                  </td>
                )}
                <td className="py-3 px-4">
                  <div className="flex flex-col gap-1">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium w-fit ${
                        s.status === "재원"
                          ? "bg-emerald-100 text-emerald-700"
                          : s.status === "휴원"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {s.status}
                    </span>
                    {s.status === "재원" && (
                      <span
                        className={`text-xs font-bold ${
                          s.sessionsCompleted >= 4
                            ? "text-rose-500"
                            : "text-slate-400"
                        }`}
                      >
                        {s.sessionsCompleted >= 4
                          ? "결제 필요"
                          : `수강 중 (${s.sessionsCompleted}/4)`}
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteStudent(s.id);
                    }}
                    className="text-slate-300 hover:text-rose-500 p-1 rounded hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400 mt-2 text-right">
        * 목록을 클릭하면 상세 정보를 수정할 수 있습니다.
      </p>
    </div>
  );
};

// --- [PaymentView] ---
const PaymentView = ({
  students,
  showToast,
  onSavePayment,
  onUpdatePaymentHistory,
}) => {
  const [filterDue, setFilterDue] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState(null);

  // [NEW] 검색어 state 추가
  const [searchTerm, setSearchTerm] = useState("");

  const list = useMemo(() => {
    return students.filter((s) => {
      const isDue = !filterDue || s.sessionsCompleted >= s.totalSessions;
      const isReEnrolled = s.status === "재원";
      // 검색 필터 적용 (이름 또는 과목)
      const matchesSearch =
        s.name.includes(searchTerm) ||
        (s.subject && s.subject.includes(searchTerm));

      return isReEnrolled && isDue && matchesSearch;
    });
  }, [students, filterDue, searchTerm]);

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) || null,
    [students, selectedStudentId]
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6 h-full flex flex-col overflow-hidden">
      {selectedStudent && (
        <PaymentDetailModal
          student={selectedStudent}
          onClose={() => setSelectedStudentId(null)}
          onSavePayment={onSavePayment}
          onUpdatePaymentHistory={onUpdatePaymentHistory}
          showToast={showToast}
        />
      )}

      <div className="flex flex-col md:flex-row justify-between items-center mb-4 shrink-0 gap-3">
        <div className="flex items-center">
          <h2 className="text-lg font-bold flex items-center mr-4">
            <CreditCard className="mr-2" /> 수납 관리
          </h2>
          {/* [NEW] 검색창 추가 */}
          <div className="relative">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
              size={16}
            />
            <input
              placeholder="이름, 과목 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-1.5 border rounded-lg text-sm bg-slate-50 focus:outline-indigo-500 w-48"
            />
          </div>
        </div>

        <button
          onClick={() => setFilterDue(!filterDue)}
          className={`px-3 py-1.5 rounded text-sm border flex items-center transition-colors ${
            filterDue
              ? "bg-rose-50 border-rose-200 text-rose-600"
              : "bg-white hover:bg-slate-50"
          }`}
        >
          <AlertCircle size={14} className="mr-1" />
          {filterDue ? "전체 보기" : "결제 대상만 보기"}
        </button>
      </div>
      <div className="flex-1 overflow-auto border rounded-lg">
        <table className="w-full text-left min-w-[600px]">
          <thead className="sticky top-0 bg-slate-50 border-b">
            <tr className="text-slate-500 text-xs uppercase">
              <th className="py-3 px-4">이름/과목</th>
              <th className="py-3 px-4">원비</th>
              <th className="py-3 px-4">진척도</th>
              <th className="py-3 px-4">상태</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr
                key={s.id}
                className="border-b hover:bg-slate-50 cursor-pointer"
                onClick={() => setSelectedStudentId(s.id)}
              >
                <td className="py-3 px-4 font-medium">
                  {s.name}
                  {s.subject && (
                    <span className="text-xs text-slate-500 ml-1">
                      ({s.subject})
                    </span>
                  )}
                </td>
                <td className="py-3 px-4 font-bold text-indigo-600">
                  {s.tuitionFee ? Number(s.tuitionFee).toLocaleString() : 0}
                </td>
                <td className="py-3 px-4">
                  {s.sessionsCompleted}/{s.totalSessions}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`px-2 py-1 rounded text-xs font-bold ${
                      s.sessionsCompleted >= s.totalSessions
                        ? "bg-rose-100 text-rose-700"
                        : "bg-emerald-100 text-emerald-700"
                    }`}
                  >
                    {s.sessionsCompleted >= s.totalSessions
                      ? "결제 대상"
                      : "수강 중"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400 mt-2 text-right">
        * 목록을 클릭하면 상세 내역을 보고 결제 처리를 할 수 있습니다.
      </p>
    </div>
  );
};

// --- [Main App] ---
export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [message, setMessage] = useState(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null); // 초기 로그인 상태 null (로그인창 강제)
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [consultations, setConsultations] = useState([]); // 상담 데이터 상태 추가

  const [registerFromConsultation, setRegisterFromConsultation] =
    useState(null);

  useEffect(() => {
    if (!app) return;
    if (!document.getElementById("xlsx-script")) {
      const script = document.createElement("script");
      script.id = "xlsx-script";
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      script.async = true;
      document.body.appendChild(script);
    }
    signInAnonymously(auth)
      .then(() => {
        onSnapshot(
          collection(db, "artifacts", APP_ID, "public", "data", "students"),
          (s) => setStudents(s.docs.map((d) => ({ id: d.id, ...d.data() })))
        );
        onSnapshot(
          collection(db, "artifacts", APP_ID, "public", "data", "teachers"),
          (s) => {
            const tList = s.docs.map((d) => ({ id: d.id, ...d.data() }));
            if (tList.length === 0)
              setTeachers(
                INITIAL_TEACHERS_LIST.map((t, i) => ({ id: i, name: t }))
              );
            else setTeachers(tList);
          }
        );
        // 상담 데이터 구독 추가
        onSnapshot(
          collection(
            db,
            "artifacts",
            APP_ID,
            "public",
            "data",
            "consultations"
          ),
          (s) => {
            const list = s.docs.map((d) => ({ id: d.id, ...d.data() }));
            setConsultations(list.sort((a, b) => b.date.localeCompare(a.date)));
          }
        );
      })
      .catch((e) =>
        setMessage({
          text: "로그인 오류: Firebase 익명 로그인을 켜주세요.",
          type: "error",
        })
      );
  }, []);

  const seedData = async () => {
    const batch = writeBatch(db);
    INITIAL_TEACHERS_LIST.forEach((name) =>
      batch.set(
        doc(collection(db, "artifacts", APP_ID, "public", "data", "teachers")),
        { name }
      )
    );
    await batch.commit();
    showToast("초기 데이터 생성 완료", "success");
  };
  const showToast = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleSavePayment = async (studentId, date, amount) => {
    try {
      const studentRef = doc(
        db,
        "artifacts",
        APP_ID,
        "public",
        "data",
        "students",
        studentId
      );
      const student = students.find((s) => s.id === studentId);
      if (!student) return;

      const newHistoryItem = {
        date: date,
        amount: amount,
        type: "tuition",
        createdAt: new Date().toISOString(),
      };
      const updatedHistory = [
        ...(student.paymentHistory || []),
        newHistoryItem,
      ];
      const newSessionCount = (student.attendanceHistory || []).filter(
        (h) => h.status === "present" && h.date >= date
      ).length;

      await updateDoc(studentRef, {
        paymentHistory: updatedHistory,
        lastPaymentDate: date,
        sessionsCompleted: newSessionCount,
      });
      showToast("결제 처리가 완료되었습니다.", "success");
    } catch (e) {
      console.error(e);
      showToast("결제 처리 중 오류가 발생했습니다.", "error");
    }
  };

  const handleUpdatePaymentHistory = async (studentId, newHistory) => {
    try {
      const studentRef = doc(
        db,
        "artifacts",
        APP_ID,
        "public",
        "data",
        "students",
        studentId
      );
      const student = students.find((s) => s.id === studentId);
      let newLastPaymentDate = "0000-00-00";
      if (newHistory.length > 0) {
        const sortedHistory = [...newHistory].sort((a, b) =>
          b.date.localeCompare(a.date)
        );
        newLastPaymentDate = sortedHistory[0].date;
      }
      const newSessionCount = (student.attendanceHistory || []).filter(
        (h) => h.status === "present" && h.date >= newLastPaymentDate
      ).length;
      await updateDoc(studentRef, {
        paymentHistory: newHistory,
        lastPaymentDate: newLastPaymentDate,
        sessionsCompleted: newSessionCount,
      });
      showToast("결제 이력이 수정되었습니다.", "success");
    } catch (e) {
      showToast("수정 실패", "error");
    }
  };

  const handleDeleteStudent = async (studentId) => {
    if (
      window.confirm(
        "정말 삭제하시겠습니까?\n모든 출석 및 결제 기록이 영구적으로 삭제됩니다."
      )
    ) {
      try {
        await deleteDoc(
          doc(db, "artifacts", APP_ID, "public", "data", "students", studentId)
        );
        showToast("원생 정보가 삭제되었습니다.", "success");
      } catch (e) {
        showToast("삭제 중 오류가 발생했습니다.", "error");
      }
    }
  };

  const handleRegisterFromConsultation = (consultData) => {
    setRegisterFromConsultation(consultData);
    setActiveTab("students");
  };

  if (!currentUser) {
    return (
      <div className="h-screen bg-slate-50 flex items-center justify-center">
        {message && (
          <div
            className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${
              message.type === "error" ? "bg-rose-500" : "bg-emerald-600"
            }`}
          >
            {message.text}
          </div>
        )}
        <LoginModal
          isOpen={true}
          onClose={() => {}}
          teachers={teachers}
          onLogin={(u) => {
            setCurrentUser(u);
            showToast(`${u.name}님 환영합니다.`);
          }}
          showToast={showToast}
        />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {message && (
        <div
          className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white text-sm font-medium ${
            message.type === "error" ? "bg-rose-500" : "bg-emerald-600"
          }`}
        >
          {message.text}
        </div>
      )}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        teachers={teachers}
        onLogin={(u) => {
          setCurrentUser(u);
          setIsLoginModalOpen(false);
          showToast(`${u.name}님 로그인`);
        }}
        showToast={showToast}
      />
      <div
        className={`fixed md:static inset-y-0 left-0 z-30 w-64 bg-white border-r transform transition-transform duration-300 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } shadow-lg md:shadow-none flex flex-col`}
      >
        <div className="p-6 border-b flex justify-center">
          <h1 className="text-xl font-bold tracking-tight">
            JnC Music<span className="text-indigo-600">.</span>
          </h1>
        </div>
        <nav className="p-4 space-y-2 flex-1">
          <SidebarItem
            icon={LayoutDashboard}
            label="대시보드"
            active={activeTab === "dashboard"}
            onClick={() => {
              setActiveTab("dashboard");
              setIsSidebarOpen(false);
            }}
          />
          <SidebarItem
            icon={CalendarIcon}
            label="일정 관리"
            active={activeTab === "calendar"}
            onClick={() => {
              setActiveTab("calendar");
              setIsSidebarOpen(false);
            }}
          />
          <SidebarItem
            icon={Users}
            label="원생 관리"
            active={activeTab === "students"}
            onClick={() => {
              setActiveTab("students");
              setIsSidebarOpen(false);
            }}
          />
          <SidebarItem
            icon={CheckCircle}
            label="출석부"
            active={activeTab === "attendance"}
            onClick={() => {
              setActiveTab("attendance");
              setIsSidebarOpen(false);
            }}
          />
          <SidebarItem
            icon={BookOpen}
            label="수업 일지"
            active={activeTab === "classLog"}
            onClick={() => {
              setActiveTab("classLog");
              setIsSidebarOpen(false);
            }}
          />

          {currentUser.role === "admin" && (
            <SidebarItem
              icon={MessageSquareText}
              label="상담 관리"
              active={activeTab === "consultations"}
              onClick={() => {
                setActiveTab("consultations");
                setIsSidebarOpen(false);
              }}
            />
          )}

          {currentUser.role === "admin" && (
            <SidebarItem
              icon={CreditCard}
              label="수납 관리"
              active={activeTab === "payments"}
              onClick={() => {
                setActiveTab("payments");
                setIsSidebarOpen(false);
              }}
            />
          )}
          {currentUser.role === "admin" && (
            <>
              <div className="pt-4 px-4 text-xs font-bold text-slate-400">
                Settings
              </div>
              <SidebarItem
                icon={Settings}
                label="환경 설정"
                active={activeTab === "settings"}
                onClick={() => {
                  setActiveTab("settings");
                  setIsSidebarOpen(false);
                }}
              />
            </>
          )}
        </nav>
        <div
          className="p-4 border-t cursor-pointer hover:bg-slate-50"
          onClick={() => setIsLoginModalOpen(true)}
        >
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs">
              {currentUser.name[0]}
            </div>
            <div>
              <p className="text-sm font-bold">{currentUser.name}</p>
              <p className="text-xs text-slate-500">계정 전환</p>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden w-full relative">
        <header className="hidden md:flex bg-white border-b py-3 px-8 justify-between items-center shrink-0">
          <h2 className="text-xl font-bold">
            {activeTab === "dashboard"
              ? "대시보드"
              : activeTab === "students"
              ? "원생 관리"
              : activeTab === "attendance"
              ? "출석부"
              : activeTab === "payments"
              ? "수납 관리"
              : activeTab === "consultations"
              ? "상담 관리"
              : activeTab === "calendar"
              ? "일정 관리"
              : activeTab === "classLog"
              ? "수업 일지"
              : "환경 설정"}
          </h2>
          <div className="text-sm font-bold text-slate-600">
            2025년 12월 26일
          </div>
        </header>
        <header className="md:hidden bg-white border-b p-4 flex justify-between items-center shrink-0">
          <h1 className="font-bold text-lg">JnC Music</h1>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            <Menu />
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-8 w-full bg-slate-50">
          {activeTab === "dashboard" && (
            <DashboardView
              students={students}
              consultations={consultations}
              user={currentUser}
            />
          )}
          {activeTab === "calendar" && (
            <CalendarView
              teachers={teachers}
              user={currentUser}
              students={students}
              showToast={showToast}
            />
          )}
          {activeTab === "classLog" && (
            <ClassLogView
              teachers={teachers}
              user={currentUser}
              students={students}
            />
          )}
          {activeTab === "students" && (
            <StudentView
              students={students}
              teachers={teachers}
              showToast={showToast}
              user={currentUser}
              registerFromConsultation={registerFromConsultation}
              setRegisterFromConsultation={setRegisterFromConsultation}
              onDeleteStudent={handleDeleteStudent}
            />
          )}
          {activeTab === "attendance" && (
            <AttendanceView
              showToast={showToast}
              user={currentUser}
              students={students}
              teachers={teachers}
            />
          )}
          {activeTab === "payments" && currentUser.role === "admin" && (
            <PaymentView
              students={students}
              showToast={showToast}
              onSavePayment={handleSavePayment}
              onUpdatePaymentHistory={handleUpdatePaymentHistory}
            />
          )}
          {activeTab === "consultations" && currentUser.role === "admin" && (
            <ConsultationView
              onRegisterStudent={handleRegisterFromConsultation}
              showToast={showToast}
              consultations={consultations}
            />
          )}
          {activeTab === "settings" && currentUser.role === "admin" && (
            <SettingsView
              teachers={teachers}
              students={students}
              showToast={showToast}
              seedData={seedData}
            />
          )}
        </main>
      </div>
    </div>
  );
}
