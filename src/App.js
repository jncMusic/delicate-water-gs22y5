import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
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
  query, // 🔥 쿼리 관련 기능 추가 (안전 대비)
  where, // 🔥 쿼리 관련 기능 추가 (안전 대비)
} from "firebase/firestore";
import {
  LayoutDashboard,
  LayoutGrid,
  BookOpen,
  Calendar as CalendarIcon,
  Users,
  CheckCircle,
  File,
  MessageSquareText,
  CreditCard,
  Settings,
  Menu,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  UserPlus,
  Phone,
  MapPin,
  User,
  TrendingUp,
  AlertCircle,
  UserCircle,
  LogOut,
  RefreshCcw,
  Copy,
  Zap,
  Save,
  Clock,
  ListTodo,
  Filter,
  CalendarDays,
  Archive,
  StickyNote,
  Timer,
  History,
  Pencil,
  Grid,
  Columns,
  HardDrive,
  Download,
  Upload,
  CheckSquare,
  Printer, // 🔥 인쇄 아이콘 추가
  Music, // 🔥 파트 아이콘 추가
  ChevronDown,
  Tablet, // 🔥 키오스크 단말기 아이콘
  Send,
} from "lucide-react";
import html2canvas from "html2canvas"; // 🔥 이미지 저장 라이브러리 추가

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
// 1-1. 알리고 SMS 발송 헬퍼
// =================================================================
const SMS_API_URL = process.env.REACT_APP_SMS_API_URL || "/api/send-sms";

const sendAligoSms = async (receiver, msg) => {
  const res = await fetch(SMS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ receiver, msg }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "발송 실패");
  return data;
};

// =================================================================
// 2. 상수 및 데이터 & 헬퍼 함수
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

// [중요] 학생의 특정 요일 수업 시간 가져오기 (가변 시간 대응)
const getStudentScheduleTime = (student, dayName) => {
  if (!student) return "";
  if (student.schedules && student.schedules[dayName]) {
    return student.schedules[dayName];
  }
  if (!student.schedules && student.className === dayName) {
    return student.time || "";
  }
  return "";
};

// [중요] 결제 안내 메시지 생성용 수업일자 추출 헬퍼
const getLessonDatesForMessage = (student) => {
  const lastPaymentDate = student.lastPaymentDate || "0000-00-00";
  return (student.attendanceHistory || [])
    .filter((h) => h.date >= lastPaymentDate && h.status === "present")
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4)
    .map((h) => h.date.slice(5).replace("-", "/"));
};

// [중요] 학생의 주 수업 빈도 반환 (명시적 설정 우선, 없으면 스케줄로 자동 판별)
const getWeeklyFrequency = (student) => {
  if (student.weeklyFrequency) return student.weeklyFrequency;
  const count = Object.keys(student.schedules || {}).length;
  return count >= 2 ? 2 : 1;
};

// =================================================================
// 3. UI 및 공통 컴포넌트
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
// [수정됨] StatCard: 클릭 기능 및 Hover 효과 추가
const StatCard = ({ icon: Icon, label, value, trend, trendUp, onClick }) => (
  <div
    onClick={onClick}
    className={`bg-white p-6 rounded-xl shadow-sm border border-slate-100 flex items-start justify-between min-w-[200px] transition-all ${
      onClick
        ? "cursor-pointer hover:shadow-md hover:border-indigo-200 active:scale-95"
        : ""
    }`}
  >
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
    <div
      className={`p-3 rounded-lg ${
        onClick ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-600"
      }`}
    >
      {Icon && <Icon size={24} />}
    </div>
  </div>
);

// =================================================================
// 4. 공통 헬퍼 함수
// =================================================================

// 결제 주기(세션 단위) 계산: 주2회(schedules 2개 이상)인데 totalSessions가
// 구버전 기본값(4)으로 저장된 학생을 자동으로 8회로 보정한다.
const getEffectiveSessions = (student) => {
  const saved = parseInt(student.totalSessions) || 4;
  const scheduleCount = Object.keys(student.schedules || {}).length;
  if (scheduleCount >= 2 && saved === 4) return 8;
  return saved;
};

// =================================================================
// 4-1. 결제 안내 메시지 생성 헬퍼 (PaymentView 및 안내 발송 기능에서 공용)
// =================================================================
const getSeasonalGreeting = () => {
  const month = new Date().getMonth() + 1;
  const greetings = {
    1:  "새해 복 많이 받으세요! 올 한 해도 건강하고 행복한 시간 되시길 바랍니다.",
    2:  "추운 겨울 잘 마무리하시고 건강 잘 챙기시길 바랍니다.",
    3:  "따뜻한 봄이 찾아왔습니다. 활기찬 봄날 보내시길 바랍니다.",
    4:  "봄꽃이 만발하는 아름다운 계절입니다. 좋은 날들 보내시길 바랍니다.",
    5:  "가정의 달 5월입니다. 가족과 함께 행복한 시간 보내시길 바랍니다.",
    6:  "무더운 여름이 다가오고 있습니다. 건강 유의하시길 바랍니다.",
    7:  "본격적인 여름 시즌입니다. 시원하고 즐거운 여름 보내시길 바랍니다.",
    8:  "한여름 무더위가 기승을 부리고 있습니다. 건강 잘 챙기시길 바랍니다.",
    9:  "선선한 가을 바람이 불어오고 있습니다. 좋은 가을 맞이하시길 바랍니다.",
    10: "단풍이 물드는 아름다운 계절입니다. 즐거운 가을 보내시길 바랍니다.",
    11: "쌀쌀한 날씨가 이어지고 있습니다. 건강 유의하시길 바랍니다.",
    12: "연말을 맞이하여 한 해를 잘 마무리하시길 바랍니다.",
  };
  return greetings[month] || "";
};

const generatePaymentMessage = (student, paymentUrl = "") => {
  const sessionUnit = getEffectiveSessions(student);
  const tuition = parseInt(student.tuitionFee || 0).toLocaleString();

  // 출석(present) + 당일취소(canceled) 모두 세션으로 포함
  const allSessions = (student.attendanceHistory || [])
    .filter((h) => h.status === "present" || h.status === "canceled")
    .sort((a, b) => a.date.localeCompare(b.date));

  // 누적 세션: present=count(1 or 2), canceled=0.5
  // 각 세션에 라벨 부여 (표시용)
  const sessionSlots = []; // { date, label, weight }
  allSessions.forEach((h) => {
    if (h.status === "present") {
      const cnt = h.count || 1;
      for (let i = 0; i < cnt; i++) {
        sessionSlots.push({ date: h.date, label: h.date.slice(5).replace("-", "/"), weight: 1 });
      }
    } else if (h.status === "canceled") {
      sessionSlots.push({ date: h.date, label: h.date.slice(5).replace("-", "/") + "(당일취소)", weight: 1 });
    }
  });

  // 결제별 totalSessions 합산
  const allPayments = (student.paymentHistory || []).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const totalPaidCapacity = allPayments.reduce(
    (sum, p) => sum + (p.totalSessions || sessionUnit), 0
  );
  const lastPayment =
    allPayments.length > 0
      ? allPayments[allPayments.length - 1].date
      : "기록 없음";

  // 누적 가중치로 paid/unpaid 구분
  let cumulativeWeight = 0;
  let lastCoveredDate = "없음";
  const unpaidSlots = [];
  const recentSlots = [];
  for (const slot of sessionSlots) {
    const nextWeight = cumulativeWeight + slot.weight;
    if (nextWeight <= totalPaidCapacity) {
      cumulativeWeight = nextWeight;
      lastCoveredDate = slot.label.replace("(당일취소)", ""); // 취소는 완료일 제외
      recentSlots.push(slot.label);
    } else {
      unpaidSlots.push(slot.label);
    }
  }

  const recentStart = Math.max(0, recentSlots.length - sessionUnit);
  const recentSessions = recentSlots.slice(recentStart).join(", ") || "(출석 기록 없음)";

  const unpaidDatesStr = unpaidSlots.length > 0 ? unpaidSlots.join(", ") : "없음";
  const unpaidCount = unpaidSlots.reduce((sum, _s) => sum + 1, 0);

  // 다음 수업일 자동 계산
  let nextDateStr = "";
  let requestDateStr = "";
  const daysKor = ["일", "월", "화", "수", "목", "금", "토"];
  let targetDayIdx = -1;

  if (student.schedules) {
    const scheduledDays = Object.keys(student.schedules);
    if (scheduledDays.length > 0) targetDayIdx = daysKor.indexOf(scheduledDays[0]);
  }
  if (targetDayIdx === -1 && student.className)
    targetDayIdx = daysKor.indexOf(student.className);

  const lastClassDateStr =
    allSessions.length > 0
      ? allSessions[allSessions.length - 1].date
      : new Date().toISOString().split("T")[0];

  if (targetDayIdx !== -1) {
    let d = new Date(lastClassDateStr);
    d.setDate(d.getDate() + 1);
    for (let i = 0; i < 14; i++) {
      if (d.getDay() === targetDayIdx) {
        const m = d.getMonth() + 1;
        const dt = d.getDate();
        const dayName = daysKor[d.getDay()];
        nextDateStr = `${String(m).padStart(2, "0")}/${String(dt).padStart(2, "0")}`;
        requestDateStr = `${m}/${dt}(${dayName})`;
        break;
      }
      d.setDate(d.getDate() + 1);
    }
  }
  if (!requestDateStr) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 3);
    requestDateStr = `${fallback.getMonth() + 1}/${fallback.getDate()}(${daysKor[fallback.getDay()]})`;
  }

  const paymentLine = paymentUrl
    ? `\n- 온라인 결제 링크 : ${paymentUrl}\n`
    : "\n- 온라인 카드 결제를 원하시는 경우 알려주시면 발송드리겠습니다. 결제 선생(카카오톡 페이지) 페이지 보내드립니다.\n";

  return `안녕하세요, J&C 음악학원입니다.

${getSeasonalGreeting()}

수업료 결제 안내입니다. 아래 수업일자와 결제내용 확인하시어 결제 부탁드리겠습니다.
-------------------------------
- 과정명 : ${student.subject || "음악"} 1:1 개인레슨 과정 - ${student.name} ${student.grade === "성인" ? "님" : "학생"}
- 최종 결제일 : ${lastPayment.slice(5).replace("-", "/")}
- 수업일자 : ${recentSessions}
- 결제하신 수업 완료일 : ${lastCoveredDate}
- 새로운 1회차 수업 : ${nextDateStr} (예정)
- 미납회차 : ${unpaidDatesStr} ${unpaidCount > 0 ? `(${unpaidCount}회)` : ""}

- 결제금액 : ${student.subject || "음악"} 1:1 개인레슨 ${sessionUnit}회 ${tuition}원 ${unpaidCount > 0 ? `(미납 ${unpaidCount}회 포함)` : ""}
- 결제요청일 : ${requestDateStr} 까지 결제 부탁드립니다.
(현장결제는 수업 당일까지, 온라인결제는 수업 전일까지 부탁드립니다)

- 결제계좌
하나은행 125-91025-766307 강열혁(제이앤씨음악학원)
- 결제방법: 방문(카드/현금), 계좌이체, 제로페이, 온라인 결제
${paymentLine}
- 이미 결제하신 경우 알려주시면 감사하겠습니다. 특히 제로페이의 경우 학생명 확인이 어려우니 꼭 알려주시면 감사하겠습니다.


항상 감사드립니다. ${(() => {
  const dow = new Date().getDay(); // 0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토
  if (dow === 1) return "평안한 한 주의 시작 되시기 바랍니다.";
  if (dow >= 2 && dow <= 4) return "평안한 한 주 보내시기 바랍니다.";
  return "평안한 주말 되시기 바랍니다.";
})()}

J&C 음악학원장 올림.`;
};

// =================================================================
// 5. 모달 및 팝업 컴포넌트
// =================================================================

// [MemoNoticePopup] 강사 메모 알림 팝업 (로그인 직후 + 배너)
const MemoNoticePopup = ({ memos, onDismiss }) => {
  if (!memos || memos.length === 0) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">📝</span>
          <h2 className="text-lg font-bold text-slate-800">원장님 전달 메모</h2>
          <span className="ml-auto bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
            {memos.length}건
          </span>
        </div>
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {memos.map((m) => (
            <div
              key={m.id}
              className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold text-slate-700">
                  {m.studentName}
                </span>
                <span className="text-xs text-slate-400">{m.date}</span>
              </div>
              <p className="text-sm text-amber-800">{m.memo}</p>
            </div>
          ))}
        </div>
        <button
          onClick={onDismiss}
          className="mt-5 w-full py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors"
        >
          확인 완료
        </button>
      </div>
    </div>
  );
};

// [MemoNoticeBanner] 대시보드 상단 배너 (완료 전까지 지속)
const MemoNoticeBanner = ({ memos, onDismiss }) => {
  const [expanded, setExpanded] = React.useState(false);
  if (!memos || memos.length === 0) return null;
  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 shrink-0">
      <div className="flex items-center gap-2">
        <span className="text-base">📝</span>
        <span className="text-sm font-bold text-amber-800">
          원장님 전달 메모 {memos.length}건
        </span>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-amber-600 underline ml-1"
        >
          {expanded ? "접기" : "내용 보기"}
        </button>
        <button
          onClick={onDismiss}
          className="ml-auto text-xs bg-indigo-600 text-white px-3 py-1 rounded-lg font-bold hover:bg-indigo-700 transition-colors"
        >
          완료
        </button>
      </div>
      {expanded && (
        <div className="mt-2 space-y-1.5 pl-6">
          {memos.map((m) => (
            <div key={m.id} className="text-xs text-amber-700 flex gap-2">
              <span className="font-bold text-slate-600">{m.studentName}</span>
              <span className="text-slate-400">{m.date}</span>
              <span>{m.memo}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// [LoginModal]
const LoginModal = ({
  isOpen,
  onClose,
  teachers,
  onLogin,
  showToast,
  isInitialLogin,
  adminPassword: adminPw = "1123",
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
    if (password === adminPw) {
      onLogin({ name: "원장님", role: "admin" });
      setPassword("");
      setIsAdminLoginMode(false);
    } else {
      showToast("비밀번호가 일치하지 않습니다.", "warning");
    }
  };

  const handleTeacherLoginSubmit = () => {
    const correctPassword = selectedTeacherForLogin.password;

    if (!correctPassword) {
      showToast("비밀번호가 설정되지 않은 강사입니다. 환경설정에서 비밀번호를 지정해주세요.", "error");
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
            <div className="space-y-4">
              <input
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                placeholder="이메일 입력"
              />
              <button
                onClick={() => {
                  showToast(`'${resetEmail}'로 전송됨`, "success");
                  setIsResetMode(false);
                }}
                className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold"
              >
                전송
              </button>
            </div>
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
              <UserCircle className="text-indigo-600" />{" "}
              {selectedTeacherForLogin.name} 강사님
            </h2>
            <button onClick={() => setSelectedTeacherForLogin(null)}>
              <X size={24} className="text-slate-400" />
            </button>
          </div>
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              비밀번호(설정값 또는 전화번호 뒷 4자리)
            </p>
            <input
              type="password"
              value={teacherPassword}
              onChange={(e) => setTeacherPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTeacherLoginSubmit()}
              className="w-full px-3 py-2 border rounded-lg focus:outline-indigo-500"
              placeholder="비밀번호"
              autoFocus
            />
            <button
              onClick={handleTeacherLoginSubmit}
              className="w-full py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors"
            >
              로그인
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
                  onClick={() => setSelectedTeacherForLogin(teacher)}
                  className="w-full text-left px-3 py-2 rounded hover:bg-white flex items-center transition-colors"
                >
                  <UserCircle size={16} className="mr-2 text-emerald-500" />{" "}
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

// [StudentEditModal]
const StudentEditModal = ({ student, teachers, onClose, onUpdate, user }) => {
  const [formData, setFormData] = useState(() => {
    const initSchedules =
      student.schedules ||
      (student.className ? { [student.className]: student.time || "" } : {});
    const count = Object.keys(initSchedules).length;
    // 기존 데이터의 기본값(4)이 저장된 주2회 학생 → 8로 보정
    const correctedSessions =
      count >= 2 && (!student.totalSessions || student.totalSessions === 4)
        ? 8
        : student.totalSessions || 4;
    return {
      ...student,
      schedules: initSchedules,
      classDays:
        student.classDays || (student.className ? [student.className] : []),
      totalSessions: correctedSessions,
      weeklyLessons: student.weeklyLessons || 1,
      weeklyFrequency: student.weeklyFrequency || (count >= 2 ? 2 : 1),
    };
  });
  const isAdmin = user.role === "admin";

  // 결제 주기 자동/수동 모드: 시간표 슬롯 수에 따라 자동 설정 여부
  const [weeklyMode, setWeeklyMode] = useState(() => {
    const initSchedules =
      student.schedules ||
      (student.className ? { [student.className]: student.time || "" } : {});
    const count = Object.keys(initSchedules).length;
    const autoSessions = count >= 2 ? 8 : 4;
    const saved = student.totalSessions || 4;
    // 주2회인데 구버전 기본값(4)으로 저장된 경우 → auto로 간주
    if (count >= 2 && saved === 4) return "auto";
    return saved === autoSessions ? "auto" : "manual";
  });

  const toggleDay = (day) => {
    const currentSchedules = { ...formData.schedules };
    if (currentSchedules[day] !== undefined) {
      delete currentSchedules[day];
    } else {
      currentSchedules[day] = "";
    }
    const days = Object.keys(currentSchedules);
    // 자동 모드: 시간표 슬롯 수에 따라 결제 주기 자동 설정 (주2회=8회, 주1회=4회)
    const newTotalSessions =
      weeklyMode === "auto"
        ? days.length >= 2
          ? 8
          : 4
        : formData.totalSessions;
    const autoFrequency = days.length >= 2 ? 2 : 1;
    setFormData({
      ...formData,
      schedules: currentSchedules,
      classDays: days,
      className: days[0] || "",
      time: days.length > 0 ? currentSchedules[days[0]] || "" : "",
      totalSessions: newTotalSessions,
      weeklyFrequency: autoFrequency,
    });
  };

  const handleTimeChange = (day, time) => {
    const safeTime = time === undefined ? "" : time;
    setFormData({
      ...formData,
      schedules: { ...formData.schedules, [day]: safeTime },
    });
  };

  const handleSave = () => {
    // 빈 시간의 요일 제거
    const cleanSchedules = { ...formData.schedules };
    Object.keys(cleanSchedules).forEach((key) => {
      if (!cleanSchedules[key] || cleanSchedules[key].trim() === "") {
        delete cleanSchedules[key];
      }
    });

    const days = Object.keys(cleanSchedules);
    const className = days.length > 0 ? days[0] : "";
    const time = days.length > 0 ? cleanSchedules[days[0]] || "" : "";

    onUpdate(student.id, {
      ...formData,
      schedules: cleanSchedules,
      classDays: days,
      className,
      time,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[90] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-800">원생 정보 수정</h2>
          <button onClick={onClose}>
            <X size={24} className="text-slate-400" />
          </button>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">
                이름
              </label>
              <input
                className="w-full p-2 border rounded-lg bg-slate-50"
                value={formData.name || ""}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">
                학년
              </label>
              <input
                className="w-full p-2 border rounded-lg"
                value={formData.grade || ""}
                onChange={(e) =>
                  setFormData({ ...formData, grade: e.target.value })
                }
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">
              연락처
            </label>
            <input
              className="w-full p-2 border rounded-lg"
              value={formData.phone || ""}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">
                등록일
              </label>
              <input
                type="date"
                className="w-full p-2 border rounded-lg"
                value={formData.registrationDate || ""}
                onChange={(e) =>
                  setFormData({ ...formData, registrationDate: e.target.value })
                }
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-500">
                  결제 주기 (1세트)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (weeklyMode === "auto") {
                      setWeeklyMode("manual");
                    } else {
                      const count = Object.keys(formData.schedules).length;
                      const autoSessions = count >= 2 ? 8 : 4;
                      setWeeklyMode("auto");
                      setFormData({ ...formData, totalSessions: autoSessions });
                    }
                  }}
                  className={`text-xs px-2 py-0.5 rounded-full border font-medium transition-colors ${
                    weeklyMode === "auto"
                      ? "bg-indigo-50 border-indigo-300 text-indigo-600"
                      : "bg-amber-50 border-amber-300 text-amber-600"
                  }`}
                >
                  {weeklyMode === "auto" ? "자동" : "수동"}
                </button>
              </div>
              <select
                className={`w-full p-2 border rounded-lg bg-white ${
                  weeklyMode === "auto" ? "opacity-60 cursor-not-allowed" : ""
                }`}
                value={formData.totalSessions}
                disabled={weeklyMode === "auto"}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    totalSessions: parseInt(e.target.value),
                  })
                }
              >
                <option value={4}>4회 (주1회)</option>
                <option value={8}>8회 (주2회)</option>
                <option value={12}>12회</option>
              </select>
              {weeklyMode === "auto" && (
                <p className="text-xs text-slate-400 mt-1">
                  시간표 {Object.keys(formData.schedules).length}개 기준 자동 설정
                </p>
              )}
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">
              총 수업 횟수 / 세트 (수동 조정)
            </label>
            <select
              className="w-full p-2 border rounded-lg bg-white"
              value={formData.totalSessions}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  totalSessions: parseInt(e.target.value),
                })
              }
            >
              <option value={4}>4회</option>
              <option value={8}>8회</option>
              <option value={12}>12회</option>
            </select>
          </div>
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">
                담당 선생님
              </label>
              <select
                className="w-full p-2 border rounded-lg bg-white"
                value={formData.teacher || ""}
                onChange={(e) =>
                  setFormData({ ...formData, teacher: e.target.value })
                }
                disabled={!isAdmin && user.name !== formData.teacher}
              >
                {teachers.map((t) => (
                  <option key={t.id} value={t.name}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="text-xs font-bold text-slate-500">
                  수업 요일 및 시간
                </label>
                {Object.keys(formData.schedules).length > 0 && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      Object.keys(formData.schedules).length >= 2
                        ? "bg-indigo-100 text-indigo-600"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    주{Object.keys(formData.schedules).length}회
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {CLASS_NAMES.map((day) => {
                  const isSelected =
                    formData.schedules && formData.schedules[day] !== undefined;
                  return (
                    <div
                      key={day}
                      className={`flex items-center p-1 border rounded-lg transition-all ${
                        isSelected
                          ? "bg-white border-indigo-300 shadow-sm"
                          : "border-transparent opacity-60"
                      }`}
                    >
                      <button
                        onClick={() => toggleDay(day)}
                        className={`w-7 h-7 rounded text-xs font-bold mr-1 ${
                          isSelected
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-200 text-slate-500 hover:bg-slate-300"
                        }`}
                      >
                        {day}
                      </button>
                      {isSelected && (
                        <input
                          type="time"
                          className="text-xs border rounded p-1 w-20 bg-white"
                          value={formData.schedules[day] || ""}
                          onChange={(e) =>
                            handleTimeChange(day, e.target.value)
                          }
                        />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 주 수업 빈도 선택 (요일 수에 따라 자동 반영, 수동 조정 가능) */}
              <div className="mt-3">
                <label className="block text-xs font-bold text-slate-500 mb-2">
                  주 수업 빈도
                </label>
                <div className="flex gap-2">
                  {[1, 2].map((freq) => (
                    <button
                      key={freq}
                      type="button"
                      onClick={() =>
                        setFormData({ ...formData, weeklyFrequency: freq })
                      }
                      className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${
                        (formData.weeklyFrequency || 1) === freq
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                          : "bg-white text-slate-500 border-slate-300 hover:border-indigo-400"
                      }`}
                    >
                      주{freq}회
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  * 요일을 2개 이상 선택하면 자동으로 주2회로 변경됩니다.
                </p>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">
              과목
            </label>
            <input
              className="w-full p-2 border rounded-lg"
              value={formData.subject || ""}
              onChange={(e) =>
                setFormData({ ...formData, subject: e.target.value })
              }
              placeholder="피아노"
            />
          </div>
          {isAdmin && (
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">
                원비 (선불제 기준)
              </label>
              <input
                type="number"
                className="w-full p-2 border rounded-lg"
                value={formData.tuitionFee || 0}
                onChange={(e) =>
                  setFormData({ ...formData, tuitionFee: e.target.value })
                }
              />
            </div>
          )}
          <div className="border-t pt-4"></div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2">
              재원 상태
            </label>
            <div className="flex gap-2">
              {["재원", "휴원", "퇴원"].map((status) => (
                <button
                  key={status}
                  onClick={() => setFormData({ ...formData, status })}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                    formData.status === status
                      ? status === "재원"
                        ? "bg-emerald-100 text-emerald-700 border-emerald-200 border"
                        : status === "휴원"
                        ? "bg-amber-100 text-amber-700 border-amber-200 border"
                        : "bg-rose-100 text-rose-700 border-rose-200 border"
                      : "bg-slate-50 text-slate-400 border border-slate-200"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={handleSave}
            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 mt-4 shadow-sm"
          >
            변경사항 저장
          </button>
        </div>
      </div>
    </div>
  );
};
// [PaymentDetailModal] - 완전체 코드 (생략 없음)
const PaymentDetailModal = ({
  student,
  onClose,
  onSavePayment,
  onUpdatePaymentHistory,
  showToast,
  onUpdateStudent, // [NEW] 데이터 수정 권한 받음
}) => {
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [amount, setAmount] = useState(student.tuitionFee || 0);
  const [editingHistoryId, setEditingHistoryId] = useState(null);
  const [editingDate, setEditingDate] = useState("");

  // [NEW] 출석 수정 모달 상태
  const [isAttendanceModalOpen, setIsAttendanceModalOpen] = useState(false);

  // 4회 or 8회 단위 설정 (주2회 학생 자동 보정 포함)
  const SESSION_UNIT = getEffectiveSessions(student);

  const { historyRows, nextSessionStartIndex, currentStatus } = useMemo(() => {
    const allAttendance = [...(student.attendanceHistory || [])]
      .filter((h) => h.status === "present" || h.status === "canceled")
      .sort((a, b) => a.date.localeCompare(b.date));

    const sortedPayments = [...(student.paymentHistory || [])].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    // 연강(count=2) 포함 실제 총 출석 횟수 (잔여/미납 계산용, 당일취소=1회)
    const totalAttendedSessions = allAttendance.reduce(
      (sum, h) => sum + (h.status === "canceled" ? 1 : (h.count || 1)),
      0
    );

    // entry 인덱스 추적: 연강 1 entry = 2 세션으로 누산
    let entryIdx = 0;
    let lastPayStartEntryIdx = 0;

    const rows = sortedPayments.map((payment, i) => {
      const payUnit = payment.totalSessions || SESSION_UNIT;
      const startEntryIdx = entryIdx;
      if (i === sortedPayments.length - 1) lastPayStartEntryIdx = startEntryIdx;

      // payUnit 세션이 채워질 때까지 entry 수집 (연강=2회, 당일취소=1회)
      let collected = 0;
      while (entryIdx < allAttendance.length && collected < payUnit) {
        const h = allAttendance[entryIdx];
        collected += h.status === "canceled" ? 1 : (h.count || 1);
        entryIdx++;
      }

      const matchedSessions = allAttendance.slice(startEntryIdx, entryIdx);

      return {
        payment: payment,
        sessions: matchedSessions,
        isFull: collected >= payUnit,
        payUnit: payUnit,
      };
    });

    const totalPaidSessions = sortedPayments.reduce(
      (sum, p) => sum + (p.totalSessions || SESSION_UNIT),
      0
    );
    const balance = totalPaidSessions - totalAttendedSessions;
    const currentActiveSessions = allAttendance.slice(lastPayStartEntryIdx);

    return {
      historyRows: rows.reverse(),
      nextSessionStartIndex: entryIdx, // 다음 결제 사이클 시작 entry 인덱스
      currentStatus: {
        balance: balance,
        totalAttended: allAttendance.length, // globalIdx 계산용 entry 개수
        activeSessions: currentActiveSessions,
      },
    };
  }, [student.attendanceHistory, student.paymentHistory, SESSION_UNIT]);

  // [NEW] 출석 저장 핸들러 (PaymentModal 내부용)
  const handleSaveAttendanceInside = (studentId, newHistory) => {
    // 1. 진행도(sessionsCompleted) 재계산 (연강 count 반영)
    const lastPayment = student.lastPaymentDate || "0000-00-00";
    const newSessionCount = newHistory.reduce((sum, h) => {
      if (h.date < lastPayment) return sum;
      if (h.status === "present") return sum + (h.count || 1);
      if (h.status === "canceled") return sum + 1; // 당일취소는 학생 1회 차감 (강사 시수는 별도 0.5회 적용)
      return sum;
    }, 0);

    // 2. 부모(App.js)에게 업데이트 요청
    onUpdateStudent(studentId, {
      attendanceHistory: newHistory,
      sessionsCompleted: newSessionCount,
    });

    showToast("출석 날짜가 수정되었습니다.", "success");
    setIsAttendanceModalOpen(false);
  };

  const handlePaymentSubmit = () => {
    if (!amount || amount <= 0) {
      showToast("금액을 확인해주세요.", "warning");
      return;
    }
    const allAttendance = [...(student.attendanceHistory || [])]
      .filter((h) => h.status === "present" || h.status === "canceled")
      .sort((a, b) => a.date.localeCompare(b.date));
    const targetSession = allAttendance[nextSessionStartIndex];
    const realSessionStartDate = targetSession
      ? targetSession.date
      : paymentDate;

    let confirmMsg = `${student.name} 원생 수강권 갱신(선불)\n(설정된 회차: ${SESSION_UNIT}회)\n\n`;
    if (targetSession && targetSession.date < paymentDate) {
      confirmMsg += `⚠️ 미납 수업 포함: ${targetSession.date} 수업부터 이번 결제입니다.\n`;
    } else {
      confirmMsg += `수강 시작일: ${realSessionStartDate}\n`;
    }
    confirmMsg += `결제일: ${paymentDate}\n`;

    if (window.confirm(confirmMsg)) {
      onSavePayment(
        student.id,
        paymentDate,
        parseInt(amount),
        realSessionStartDate
      );
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
    if (
      window.confirm(
        "이 결제 기록을 삭제하면 수업 횟수가 재계산됩니다. 삭제하시겠습니까?"
      )
    ) {
      const newHistory = (student.paymentHistory || []).filter(
        (h) => h !== item
      );
      onUpdatePaymentHistory(student.id, newHistory);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
      {/* [NEW] 내부에서 출석 모달 띄우기 */}
      {isAttendanceModalOpen && (
        <FastAttendanceModal
          student={student}
          onClose={() => setIsAttendanceModalOpen(false)}
          onSave={handleSaveAttendanceInside}
        />
      )}

      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center text-white shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold text-lg">
              {student.name[0]}
            </div>
            <div>
              <h2 className="text-lg font-bold">{student.name} 수납 관리</h2>
              <p className="text-indigo-200 text-xs">
                {student.teacher} 선생님 | {SESSION_UNIT}회 과정
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
              <div className="flex items-center gap-3">
                <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide flex items-center gap-2">
                  <Timer size={16} /> 현재 수강 현황
                </h3>
                {/* [NEW] 출석 수정 버튼 */}
                <button
                  onClick={() => setIsAttendanceModalOpen(true)}
                  className="px-2 py-1 bg-white border border-slate-300 rounded text-xs font-bold text-slate-600 hover:text-indigo-600 hover:border-indigo-300 shadow-sm flex items-center gap-1 transition-all"
                >
                  <CalendarDays size={12} /> 날짜 수정
                </button>
              </div>

              <div
                className={`text-xs font-bold px-3 py-1.5 rounded-full ${
                  currentStatus.balance > 0
                    ? "bg-indigo-100 text-indigo-700"
                    : currentStatus.balance === 0
                    ? "bg-slate-200 text-slate-600"
                    : "bg-rose-100 text-rose-700 animate-pulse"
                }`}
              >
                {currentStatus.balance > 0
                  ? `잔여 ${currentStatus.balance}회 남음`
                  : currentStatus.balance === 0
                  ? "수강권 소진 (결제 필요)"
                  : `⚠️ ${Math.abs(currentStatus.balance)}회 초과 (미납)`}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
              <div className="text-xs text-slate-400 mb-2">
                최근 진행 수업 (YY-MM-DD)
              </div>
              <div className="flex flex-wrap gap-2">
                {currentStatus.activeSessions.length > 0 ? (
                  currentStatus.activeSessions
                    .slice(-SESSION_UNIT * 2)
                    .flatMap((session, idx) => {
                      const globalIdx =
                        currentStatus.totalAttended -
                        currentStatus.activeSessions.length +
                        idx;
                      const isUnpaid =
                        globalIdx >= nextSessionStartIndex;
                      const isDouble = (session.count || 1) >= 2;
                      return Array.from({ length: session.count || 1 }, (_, k) => (
                        <div
                          key={`${idx}-${k}`}
                          className={`px-3 py-2 rounded-lg border flex flex-col items-center min-w-[80px] ${
                            isUnpaid
                              ? "bg-rose-50 border-rose-200 text-rose-700"
                              : isDouble
                              ? "bg-violet-50 border-violet-200 text-violet-700"
                              : "bg-slate-50 border-slate-200 text-slate-600"
                          }`}
                        >
                          <span className="text-[10px] font-bold mb-0.5 opacity-70">
                            {isUnpaid ? "미납" : isDouble ? "연강" : "결제됨"}
                          </span>
                          <span className="font-bold font-mono text-sm">
                            {session.date.slice(2)}
                          </span>
                        </div>
                      ));
                    })
                ) : (
                  <div className="text-center w-full py-4 text-slate-300 text-sm">
                    진행된 수업 없음
                  </div>
                )}
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-3 flex items-center gap-2">
              <CreditCard size={16} /> 신규 결제
            </h3>
            <div className="bg-white border border-indigo-100 rounded-xl p-5 shadow-sm">
              <div className="flex flex-col md:flex-row items-end gap-4 mb-2">
                <div className="flex-1 w-full">
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    결제일
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
                    금액
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
                  className="w-full md:w-auto py-2.5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-md flex items-center justify-center gap-2 shrink-0"
                >
                  <CheckCircle size={18} /> 갱신하기
                </button>
              </div>
              {currentStatus.balance < 0 && (
                <div className="text-xs text-rose-600 bg-rose-50 p-2 rounded flex items-start mt-2">
                  <AlertCircle size={14} className="mr-1.5 mt-0.5 shrink-0" />
                  <span>
                    <b>미납 확인:</b> {Math.abs(currentStatus.balance)}회 미납
                    수업이 이번 결제로 처리됩니다.
                  </span>
                </div>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-bold text-slate-600 uppercase tracking-wide mb-3 flex items-center gap-2">
              <History size={16} /> 지난 이력
            </h3>
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 w-32">결제일</th>
                    <th className="px-4 py-3">
                      수업 내역 ({SESSION_UNIT}회/건)
                    </th>
                    <th className="px-4 py-3 w-28 text-right">금액</th>
                    <th className="px-4 py-3 w-20 text-center">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {historyRows.length > 0 ? (
                    historyRows.map((row, index) => (
                      <tr key={index} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-mono text-slate-600 align-top">
                          {editingHistoryId === row.payment ? (
                            <input
                              type="date"
                              value={editingDate}
                              onChange={(e) => setEditingDate(e.target.value)}
                              className="border rounded p-1 w-full"
                            />
                          ) : (
                            row.payment.date
                          )}
                        </td>
                        <td className="px-4 py-3 align-top">
                          {row.sessions.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {row.sessions.flatMap((c, i) =>
                                Array.from({ length: c.count || 1 }, (_, k) => (
                                  <span
                                    key={`${i}-${k}`}
                                    className={`inline-block border px-1.5 py-0.5 rounded text-xs font-mono ${
                                      (c.count || 1) >= 2
                                        ? "bg-violet-50 text-violet-700 border-violet-200"
                                        : "bg-indigo-50 text-indigo-700 border-indigo-100"
                                    }`}
                                  >
                                    {c.date.slice(2)}{(c.count || 1) >= 2 ? " ✦" : ""}
                                  </span>
                                ))
                              )}
                              {(() => {
                                const usedSessions = row.sessions.reduce(
                                  (sum, c) => sum + (c.count || 1), 0
                                );
                                return usedSessions < row.payUnit && index === 0 ? (
                                  <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 ml-1">
                                    +{row.payUnit - usedSessions}회 잔여
                                  </span>
                                ) : null;
                              })()}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-300">
                              (사용 전)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-700 text-right align-top">
                          ₩{Number(row.payment.amount).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center align-top">
                          {editingHistoryId === row.payment ? (
                            <div className="flex flex-col gap-1">
                              <button
                                onClick={() => handleHistoryUpdate(row.payment)}
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
                                  setEditingHistoryId(row.payment);
                                  setEditingDate(row.payment.date);
                                }}
                                className="hover:text-indigo-600"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                onClick={() => handleHistoryDelete(row.payment)}
                                className="hover:text-rose-600"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan="4"
                        className="px-4 py-8 text-center text-slate-400"
                      >
                        기록 없음
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

// =================================================================
// [수납 관리 모달] 대시보드에서 수강권 만료/미납자 확인
// =================================================================
const PaymentManagementModal = ({ students, messageLogs, onClose, user, onNavigate }) => {
  const [activeTab, setActiveTab] = useState("expired");

  const { expiredStudents, overdueStudents } = useMemo(() => {
    const filtered =
      user.role === "teacher"
        ? students.filter((s) => s.teacher === user.name && s.status === "재원")
        : students.filter((s) => s.status === "재원");
    const expired = [];
    const overdue = [];
    for (const s of filtered) {
      const attended = (s.attendanceHistory || [])
        .filter((h) => h.status === "present" || h.status === "canceled")
        .reduce((sum, h) => sum + (h.status === "canceled" ? 1 : (h.count || 1)), 0);
      const sessionUnit = getEffectiveSessions(s);
      const capacity = (s.paymentHistory || []).reduce(
        (sum, p) => sum + (p.totalSessions || sessionUnit),
        0
      );
      const remaining = capacity - attended;
      if (remaining < 0) overdue.push(s);
      else if (remaining === 0 && capacity > 0) expired.push(s);
    }
    return { expiredStudents: expired, overdueStudents: overdue };
  }, [students, user]);

  const today = new Date().toISOString().slice(0, 10);
  const sentToday = new Set(
    messageLogs.filter((l) => l.sentAt === today).map((l) => l.studentId)
  );
  const lastSentMap = useMemo(() => {
    const map = {};
    for (const l of messageLogs) {
      if (!map[l.studentId] || l.sentAt > map[l.studentId]) {
        map[l.studentId] = l.sentAt;
      }
    }
    return map;
  }, [messageLogs]);

  const listToShow = activeTab === "expired" ? expiredStudents : overdueStudents;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[80vh] flex flex-col">
        {/* 헤더 */}
        <div className="flex justify-between items-center px-6 py-5 border-b">
          <h2 className="font-bold text-lg text-slate-800 flex items-center gap-2">
            <CreditCard size={20} className="text-indigo-500" /> 수납 관리
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* 탭 */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab("expired")}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${
              activeTab === "expired"
                ? "border-b-2 border-indigo-500 text-indigo-600"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            수강권 만료
            <span
              className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === "expired"
                  ? "bg-indigo-100 text-indigo-600"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {expiredStudents.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("overdue")}
            className={`flex-1 py-3 text-sm font-bold transition-colors ${
              activeTab === "overdue"
                ? "border-b-2 border-rose-500 text-rose-600"
                : "text-slate-400 hover:text-slate-600"
            }`}
          >
            미납자 (수강권 초과)
            <span
              className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                activeTab === "overdue"
                  ? "bg-rose-100 text-rose-600"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {overdueStudents.length}
            </span>
          </button>
        </div>

        {/* 목록 */}
        <div className="overflow-y-auto flex-1 p-4 space-y-2">
          {listToShow.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              해당 학생이 없습니다
            </div>
          ) : (
            listToShow.map((s) => {
              const isSentToday = sentToday.has(s.id);
              const lastSent = lastSentMap[s.id];
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between px-4 py-3 rounded-xl border border-slate-100 bg-slate-50/60 hover:bg-white hover:border-indigo-200 transition-all"
                >
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-800 text-sm">
                      {s.name}
                    </span>
                    <span className="text-xs text-slate-400 mt-0.5">
                      {s.teacher || "-"} · {s.subject || "과목 미정"}
                    </span>
                  </div>
                  <div>
                    {isSentToday ? (
                      <span className="text-[10px] bg-emerald-50 text-emerald-600 border border-emerald-200 px-2 py-1 rounded-full font-bold">
                        오늘 발송
                      </span>
                    ) : lastSent ? (
                      <span className="text-[10px] bg-slate-100 text-slate-500 border border-slate-200 px-2 py-1 rounded-full">
                        {lastSent} 발송
                      </span>
                    ) : (
                      <span className="text-[10px] bg-rose-50 text-rose-500 border border-rose-200 px-2 py-1 rounded-full font-bold">
                        미발송
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 푸터 */}
        <div className="p-4 border-t flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-500 hover:bg-slate-100 rounded-lg font-bold"
          >
            닫기
          </button>
          <button
            onClick={() => {
              onClose();
              onNavigate(user.role === "admin" ? "payments" : "students");
            }}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700"
          >
            수납 관리 바로가기
          </button>
        </div>
      </div>
    </div>
  );
};

// [DashboardView] - 상담 통계 카드 숨김 처리 (강사 권한 분리)
const DashboardView = ({
  students,
  consultations,
  reports,
  user,
  messageLogs,
  onNavigateToConsultation,
  onNavigate,
}) => {
  // 1. 내 담당 학생 필터링
  const myStudents = useMemo(() => {
    return user.role === "teacher"
      ? students.filter((s) => s.teacher === user.name && s.status === "재원")
      : students.filter((s) => s.status === "재원");
  }, [students, user]);

  const [showPaymentMgmt, setShowPaymentMgmt] = useState(false);

  // 2. 수납 상태 계산
  const isPaymentDue = (s) => {
    const totalAttended = (s.attendanceHistory || [])
      .filter((h) => h.status === "present" || h.status === "canceled")
      .reduce((sum, h) => sum + (h.status === "canceled" ? 1 : (h.count || 1)), 0);
    const sessionUnit = getEffectiveSessions(s);
    const totalPaidCapacity = (s.paymentHistory || []).reduce(
      (sum, p) => sum + (p.totalSessions || sessionUnit), 0
    );
    const remainingCapacity = totalPaidCapacity - totalAttended;

    const isOverdue = remainingCapacity < 0;
    const isCompleted = remainingCapacity === 0 && totalPaidCapacity > 0;

    return isOverdue || isCompleted;
  };

  // 3. 주요 지표 계산
  const stats = useMemo(() => {
    const paymentDueCount = myStudents.filter((s) => isPaymentDue(s)).length;

    const totalRevenue =
      user.role === "admin"
        ? myStudents.reduce((sum, s) => sum + (Number(s.tuitionFee) || 0), 0)
        : 0;

    const currentMonthPrefix = new Date().toISOString().slice(0, 7);
    const newStudentsCount = myStudents.filter((s) => {
      const regDate = s.registrationDate || s.createdAt || "";
      return regDate.startsWith(currentMonthPrefix);
    }).length;

    const pendingConsults = consultations.filter((c) => c.status === "pending");

    return { paymentDueCount, totalRevenue, newStudentsCount, pendingConsults };
  }, [myStudents, consultations, user]);

  // 4. 주간 결산 (관리자 전용)
  const weeklyStats = useMemo(() => {
    if (user.role !== "admin") return null;
    const today = new Date();
    const dayOfWeek = (today.getDay() + 6) % 7; // 0=월 … 6=일
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString().split("T")[0];
    const todayStr = today.toISOString().split("T")[0];

    // 주간 결제액 & 건수
    let weeklyPaymentTotal = 0;
    let weeklyPaymentCount = 0;
    students.forEach((s) => {
      (s.paymentHistory || []).forEach((p) => {
        if (p.date >= weekStartStr && p.date <= todayStr) {
          weeklyPaymentTotal += Number(p.amount) || 0;
          weeklyPaymentCount++;
        }
      });
    });

    // 주간 신규 등록수
    const weeklyNewStudents = students.filter((s) => {
      const regDate = (s.registrationDate || s.createdAt || "").slice(0, 10);
      return regDate >= weekStartStr && regDate <= todayStr;
    }).length;

    // 주간 상담 접수수
    const weeklyConsultations = consultations.filter((c) => {
      const cDate = (c.createdAt || c.date || "").slice(0, 10);
      return cDate >= weekStartStr && cDate <= todayStr;
    }).length;

    // 주간 범위 레이블
    const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const weekLabel = `${fmt(weekStart)}(월) ~ ${fmt(weekEnd)}(일)`;

    return { weeklyPaymentTotal, weeklyPaymentCount, weeklyNewStudents, weeklyConsultations, weekLabel };
  }, [students, consultations, user]);

  // 5. 원생 추이 (관리자 전용, 최근 12개월)
  const trendData = useMemo(() => {
    if (user.role !== "admin") return [];
    const now = new Date();
    const months = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      );
    }
    return months.map((ym) => {
      const newCount = students.filter((s) =>
        (s.registrationDate || s.createdAt || "").startsWith(ym)
      ).length;
      // 해당 월까지 등록한 현재 재원생 수 (현재 재원 기준 하한선)
      const activeCount = students.filter((s) => {
        const reg = s.registrationDate || s.createdAt || "";
        return reg && reg.slice(0, 7) <= ym && s.status === "재원";
      }).length;
      return { month: ym, new: newCount, active: activeCount };
    });
  }, [students, user]);

  // 5. 강사용 월간 보고서 상태
  const reportStatus = useMemo(() => {
    if (user.role !== "teacher") return null;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const myReport = reports.find(
      (r) =>
        r.teacherName === user.name &&
        parseInt(r.year) === currentYear &&
        parseInt(r.month) === currentMonth &&
        !r.isDeleted
    );
    return myReport ? "completed" : "pending";
  }, [reports, user]);

  return (
    <div className="space-y-6 w-full animate-fade-in pb-10">
      {/* 1. 상단 환영 메시지 */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex-1">
          <h2 className="text-2xl font-bold text-slate-800">
            안녕하세요,{" "}
            {user.name.includes("원장")
              ? user.name
              : `${user.name} ${user.role === "admin" ? "원장님" : "선생님"}`}
            !
          </h2>
          <p className="text-slate-500 mt-1">
            오늘도 보람찬 수업 되시길 바랍니다.
          </p>
        </div>

        {user.role === "teacher" && (
          <div
            onClick={() => onNavigate("reports")}
            className={`p-6 rounded-2xl flex items-center justify-between cursor-pointer transition-all shadow-sm border flex-1 ${
              reportStatus === "completed"
                ? "bg-emerald-50 text-emerald-800 border-emerald-100 hover:bg-emerald-100"
                : "bg-white border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`p-2 rounded-lg ${
                  reportStatus === "completed"
                    ? "bg-emerald-500/10"
                    : "bg-rose-500/10"
                }`}
              >
                <File size={24} />
              </div>
              <div>
                <span className="font-bold text-sm block">
                  {new Date().getMonth() + 1}월 수업 보고서
                </span>
                <span className="text-xs opacity-70">
                  {reportStatus === "completed" ? "작성 완료" : "지금 작성하기"}
                </span>
              </div>
            </div>
            <ChevronRight size={20} />
          </div>
        )}
      </div>

      {/* 2. 핵심 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={Users}
          label={user.role === "admin" ? "총 원생 수" : "담당 원생 수"}
          value={`${myStudents.length}명`}
          trend={`${stats.newStudentsCount}명 신규`}
          trendUp={true}
          onClick={() => onNavigate("students")}
        />

        {/* [수정] 매출 카드는 관리자만 표시 (기존 유지) */}
        <StatCard
          icon={CreditCard}
          label={
            user.role === "admin" ? "전체 예상 매출" : "매출 조회 권한 없음"
          }
          value={
            user.role === "admin"
              ? `₩${stats.totalRevenue.toLocaleString()}`
              : "-"
          }
          trend="이번 달 기준"
          trendUp={true}
          onClick={
            user.role === "admin" ? () => onNavigate("payments") : undefined
          }
        />

        <StatCard
          icon={AlertCircle}
          label="수납 관리"
          value={`${stats.paymentDueCount}명`}
          trend="만료·미납 확인"
          trendUp={false}
          onClick={() => setShowPaymentMgmt(true)}
        />

        {/* [수정] 대기 중인 상담 카드는 '관리자(admin)'에게만 표시 */}
        {user.role === "admin" && (
          <StatCard
            icon={MessageSquareText}
            label="대기 중인 상담"
            value={`${stats.pendingConsults.length}건`}
            trend="미응대 상담"
            trendUp={false}
            onClick={() => onNavigate("consultations")}
          />
        )}
      </div>

      {/* 3. 주간 결산 (관리자 전용) */}
      {user.role === "admin" && weeklyStats && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
              <TrendingUp size={18} className="text-indigo-500" /> 이번 주 결산
            </h3>
            <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">{weeklyStats.weekLabel}</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-indigo-50 rounded-xl p-4">
              <p className="text-xs text-indigo-500 font-bold mb-1">결제액</p>
              <p className="text-xl font-bold text-indigo-700">₩{weeklyStats.weeklyPaymentTotal.toLocaleString()}</p>
              <p className="text-xs text-slate-400 mt-1">{weeklyStats.weeklyPaymentCount}건 결제</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4">
              <p className="text-xs text-emerald-600 font-bold mb-1">신규 등록</p>
              <p className="text-xl font-bold text-emerald-700">{weeklyStats.weeklyNewStudents}명</p>
              <p className="text-xs text-slate-400 mt-1">이번 주 신규</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-4">
              <p className="text-xs text-amber-600 font-bold mb-1">상담 접수</p>
              <p className="text-xl font-bold text-amber-700">{weeklyStats.weeklyConsultations}건</p>
              <p className="text-xs text-slate-400 mt-1">이번 주 상담</p>
            </div>
          </div>
        </div>
      )}

      {/* 4. 빠른 메뉴 이동 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickMenuBtn
          icon={CheckCircle}
          color="indigo"
          label="출석부"
          sub="출석/결석 체크"
          onClick={() => onNavigate("attendance")}
        />
        <QuickMenuBtn
          icon={BookOpen}
          color="blue"
          label="수업 일지"
          sub="일별 현황 조회"
          onClick={() => onNavigate("classLog")}
        />
        <QuickMenuBtn
          icon={LayoutGrid}
          color="amber"
          label="시간표"
          sub="전체 수업 일정"
          onClick={() => onNavigate("timetable")}
        />
      </div>

      {/* 4. 관리자 전용: 상담 대기 목록 (컴팩트) */}
      {user.role === "admin" && (
        <div className="bg-white px-5 py-4 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-bold text-slate-700 flex items-center text-sm">
              <ListTodo className="mr-1.5 text-indigo-500" size={16} /> 진행 중인 상담
              <span className="ml-2 text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-bold">
                {stats.pendingConsults.length}건
              </span>
            </h3>
            <button
              onClick={() => onNavigate("consultations")}
              className="text-xs font-bold text-indigo-500 hover:bg-indigo-50 px-2.5 py-1 rounded-lg transition-colors"
            >
              전체 보기
            </button>
          </div>

          {stats.pendingConsults.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {stats.pendingConsults.slice(0, 5).map((consult) => {
                const colorMap = {
                  purple: "bg-purple-50 text-purple-600 border-purple-100",
                  green: "bg-green-50 text-green-600 border-green-100",
                  blue: "bg-blue-50 text-blue-600 border-blue-100",
                };
                return (
                  <div
                    key={consult.id}
                    onClick={() =>
                      onNavigateToConsultation &&
                      onNavigateToConsultation(consult)
                    }
                    className="flex items-center gap-3 py-2.5 hover:bg-slate-50 cursor-pointer rounded-lg px-1 -mx-1 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <span className="font-bold text-slate-800 text-sm group-hover:text-indigo-600 transition-colors">
                        {consult.name}
                      </span>
                      <span className="text-xs text-slate-400 ml-2">
                        {consult.subject || "과목 미정"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {consult.followUpActions?.slice(0, 2).map((actionId) => {
                        const opt = FOLLOW_UP_OPTIONS.find(
                          (o) => o.id === actionId
                        ) || { label: "?", color: "blue" };
                        return (
                          <span
                            key={actionId}
                            className={`text-[10px] px-1.5 py-0.5 rounded border hidden md:inline ${
                              colorMap[opt.color] || colorMap.blue
                            }`}
                          >
                            {opt.label}
                          </span>
                        );
                      })}
                      <span className="text-[10px] text-slate-400 font-mono">
                        {consult.date}
                      </span>
                    </div>
                  </div>
                );
              })}
              {stats.pendingConsults.length > 5 && (
                <div
                  className="text-xs text-slate-400 text-center pt-2 cursor-pointer hover:text-indigo-500"
                  onClick={() => onNavigate("consultations")}
                >
                  +{stats.pendingConsults.length - 5}건 더 보기
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-2 text-center">
              현재 대기 중인 상담이 없습니다.
            </p>
          )}
        </div>
      )}

      {/* 5. 원생 추이 (관리자 전용) */}
      {user.role === "admin" && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-5">
            <h3 className="font-bold text-slate-800 flex items-center text-lg">
              <TrendingUp className="mr-2 text-indigo-600" size={22} /> 원생 추이
            </h3>
            <span className="text-xs text-slate-400">최근 12개월 · 신규 등록 기준</span>
          </div>

          {/* 막대 그래프 */}
          {(() => {
            const maxNew = Math.max(...trendData.map((d) => d.new), 1);
            return (
              <div>
                <div className="flex items-end gap-1.5 h-28 mb-1">
                  {trendData.map((d) => (
                    <div key={d.month} className="flex-1 flex flex-col items-center justify-end gap-0.5">
                      {d.new > 0 && (
                        <span className="text-[9px] font-bold text-indigo-600">
                          +{d.new}
                        </span>
                      )}
                      <div
                        className="w-full rounded-t-md bg-indigo-200 hover:bg-indigo-400 transition-colors cursor-default"
                        style={{ height: `${Math.max((d.new / maxNew) * 100, d.new > 0 ? 8 : 2)}%` }}
                        title={`${d.month.replace("-", "년 ")}월: 신규 ${d.new}명, 재원 ${d.active}명`}
                      />
                    </div>
                  ))}
                </div>
                {/* X축 레이블 */}
                <div className="flex gap-1.5 mb-5">
                  {trendData.map((d) => (
                    <div key={d.month} className="flex-1 text-center text-[9px] text-slate-400">
                      {d.month.slice(5)}월
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* 표 */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-slate-400 font-medium">
                  <th className="py-2 pr-4 text-left">월</th>
                  <th className="py-2 pr-4 text-center">재원생</th>
                  <th className="py-2 text-center">신규 등록</th>
                </tr>
              </thead>
              <tbody>
                {trendData.map((d) => (
                  <tr key={d.month} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                    <td className="py-2 pr-4 font-bold text-slate-700">
                      {d.month.replace("-", "년 ")}월
                    </td>
                    <td className="py-2 pr-4 text-center text-slate-600">{d.active}명</td>
                    <td className="py-2 text-center font-bold text-indigo-600">
                      {d.new > 0 ? `+${d.new}명` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[10px] text-slate-400 mt-2">
              * 재원생 수는 현재 재원 중인 학생 기준으로, 이미 퇴원한 학생은 반영되지 않습니다.
            </p>
          </div>
        </div>
      )}

      {/* 수납 관리 모달 */}
      {showPaymentMgmt && (
        <PaymentManagementModal
          students={students}
          messageLogs={messageLogs}
          onClose={() => setShowPaymentMgmt(false)}
          user={user}
          onNavigate={onNavigate}
        />
      )}
    </div>
  );
};

// [Helper 컴포넌트: 빠른 메뉴 버튼]
const QuickMenuBtn = ({ icon: Icon, color, label, sub, onClick }) => {
  const colorClasses = {
    indigo: "text-indigo-600 bg-indigo-50 group-hover:bg-indigo-600",
    blue: "text-blue-600 bg-blue-50 group-hover:bg-blue-600",
    amber: "text-amber-600 bg-amber-50 group-hover:bg-amber-600",
  };

  return (
    <button
      onClick={onClick}
      className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all flex items-center justify-between group"
    >
      <div className="flex items-center gap-4">
        <div
          className={`p-3 rounded-xl transition-colors ${
            colorClasses[color] || colorClasses.indigo
          } group-hover:text-white`}
        >
          <Icon size={24} />
        </div>
        <div className="text-left">
          <p className="font-bold text-slate-800 text-base">{label}</p>
          <p className="text-xs text-slate-400">{sub}</p>
        </div>
      </div>
      <ChevronRight
        size={20}
        className="text-slate-300 group-hover:text-indigo-500 transition-colors"
      />
    </button>
  );
};

// =================================================================
// [ReportView] ID 인식 강화 및 삭제 기능 수정
// =================================================================
const ReportView = ({
  user,
  teachers,
  students,
  reports,
  onSaveReport,
  onDeleteReport,
  onUpdateStudent,
}) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [reportSelectedStudent, setReportSelectedStudent] = useState(null);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [studentModalTab, setStudentModalTab] = useState("attendance");
  const [selectedTeacher, setSelectedTeacher] = useState(
    user.role === "teacher" ? user.name : "전체"
  );
  const [isWriting, setIsWriting] = useState(false);
  const [studentReports, setStudentReports] = useState({});

  // 커스텀 집계 기간
  const getDefaultPeriod = (year, month) => {
    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = year - 1;
    }
    return {
      start: `${prevYear}-${String(prevMonth).padStart(2, "0")}-24`,
      end: `${year}-${String(month).padStart(2, "0")}-23`,
    };
  };
  const defaultPeriod = getDefaultPeriod(selectedYear, selectedMonth);
  const [customStart, setCustomStart] = useState(defaultPeriod.start);
  const [customEnd, setCustomEnd] = useState(defaultPeriod.end);

  // 년/월 변경 시 커스텀 기간 초기화
  useEffect(() => {
    const p = getDefaultPeriod(selectedYear, selectedMonth);
    setCustomStart(p.start);
    setCustomEnd(p.end);
  }, [selectedYear, selectedMonth]);

  // 기간 문자열
  const getPeriodString = () => {
    const s = customStart.split("-");
    const e = customEnd.split("-");
    return `${parseInt(s[0])}년 ${parseInt(s[1])}월 ${parseInt(s[2])}일 ~ ${parseInt(e[0])}년 ${parseInt(e[1])}월 ${parseInt(e[2])}일`;
  };

  // 수업일 추출 (총 회차 포함, 당일취소=0.5회)
  const getAttendanceDates = (student) => {
    if (!student) return "";

    const filtered = (student.attendanceHistory || [])
      .filter(
        (h) =>
          h.date >= customStart &&
          h.date <= customEnd &&
          (h.status === "present" || h.status === "canceled")
      )
      .sort((a, b) => a.date.localeCompare(b.date));

    if (filtered.length === 0) return "";

    const totalCount = filtered.reduce((sum, h) => {
      if (h.status === "present") return sum + (h.count || 1);
      if (h.status === "canceled") return sum + 0.5;
      return sum;
    }, 0);
    const dateStr = filtered
      .map((h) =>
        h.status === "canceled"
          ? h.date.slice(5).replace("-", "/") + "(당일취소)"
          : h.date.slice(5).replace("-", "/")
      )
      .join(", ");

    return `${dateStr} (총 ${totalCount}회)`;
  };

  // 강사별 총 시수 계산 (당일취소=0.5회 포함)
  const getTeacherTotalHours = (teacherStudents) => {
    return teacherStudents.reduce((total, s) => {
      return total + (s.attendanceHistory || [])
        .filter(h => h.date >= customStart && h.date <= customEnd)
        .reduce((sum, h) => {
          if (h.status === "present") return sum + (h.count || 1);
          if (h.status === "canceled") return sum + 0.5;
          return sum;
        }, 0);
    }, 0);
  };

  // 필터링
  const filteredReports = reports.filter((r) => {
    if (!r || r.isDeleted) return false;
    const matchYear = parseInt(r.year) === selectedYear;
    const matchMonth = parseInt(r.month) === selectedMonth;
    const matchTeacher =
      selectedTeacher === "전체" ? true : r.teacherName === selectedTeacher;
    return matchYear && matchMonth && matchTeacher;
  });

  const myReport = reports.find(
    (r) =>
      r.teacherName === user.name &&
      parseInt(r.year) === selectedYear &&
      parseInt(r.month) === selectedMonth &&
      !r.isDeleted
  );

  const myStudents = useMemo(() => {
    const teacherName = user.role === "teacher" ? user.name : selectedTeacher;
    if (teacherName === "전체") return [];
    return students.filter((s) => {
      if (s.teacher !== teacherName) return false;
      if (s.status === "재원") return true;
      // 휴원/퇴원생: 해당 기간에 출석 이력이 있으면 보고서에 포함
      return (
        ["휴원", "퇴원"].includes(s.status) &&
        (s.attendanceHistory || []).some(
          (h) =>
            h.date >= customStart &&
            h.date <= customEnd &&
            h.status === "present"
        )
      );
    });
  }, [students, user, selectedTeacher, customStart, customEnd]);

  useEffect(() => {
    if (myReport) {
      setStudentReports(myReport.data || {});
    } else {
      setStudentReports({});
    }
  }, [myReport, selectedYear, selectedMonth]);

  const handleInputChange = (studentId, field, value) => {
    setStudentReports((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
  };

  const handleSubmit = () => {
    onSaveReport({
      id: myReport ? myReport.id : null,
      teacherName: user.name,
      year: selectedYear,
      month: selectedMonth,
      data: studentReports,
      updatedAt: new Date().toISOString(),
      isDeleted: false,
    });
    setIsWriting(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 h-full flex flex-col animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 shrink-0">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center">
            <File className="mr-2 text-indigo-600" size={24} /> 월간 수업 보고서
          </h2>
          <div className="flex items-center gap-2 mt-1 ml-8 flex-wrap">
            <span className="text-xs text-slate-500">집계 기간:</span>
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="px-2 py-0.5 border border-slate-200 rounded text-xs font-bold text-indigo-600 bg-indigo-50"
            />
            <span className="text-xs text-slate-400">~</span>
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="px-2 py-0.5 border border-slate-200 rounded text-xs font-bold text-indigo-600 bg-indigo-50"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="p-2 border rounded-lg bg-slate-50 text-sm font-bold"
          >
            {[2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="p-2 border rounded-lg bg-slate-50 text-sm font-bold"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}월
              </option>
            ))}
          </select>
          {user.role === "admin" && (
            <select
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="p-2 border rounded-lg bg-white text-sm"
            >
              <option value="전체">전체 강사</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
          {user.role === "teacher" && (
            <button
              onClick={() => setIsWriting(!isWriting)}
              className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center transition-colors ${
                isWriting
                  ? "bg-slate-200 text-slate-600"
                  : "bg-indigo-600 text-white hover:bg-indigo-700"
              }`}
            >
              <Pencil size={14} className="mr-2" />
              {isWriting
                ? "작성 취소"
                : myReport
                ? "보고서 수정"
                : "보고서 작성"}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isWriting && user.role === "teacher" && (
          <div className="mb-8 p-1 animate-in slide-in-from-top-2">
            <div className="flex items-center gap-2 mb-4 px-1">
              <span className="text-sm font-bold text-slate-600">담당 원생</span>
              <span className="text-sm px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full font-bold border border-indigo-100">{myStudents.length}명</span>
              <span className="text-sm px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-bold border border-emerald-100">
                총 {getTeacherTotalHours(myStudents)}회
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {myStudents.length > 0 ? (
                myStudents.map((s) => {
                  const dates = getAttendanceDates(s);
                  const sData = studentReports[s.id] || {
                    note: "",
                    feedbackSent: false,
                  };
                  return (
                    <div
                      key={s.id}
                      className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <span className="font-bold text-slate-800 text-lg mr-2">
                            {s.name}
                          </span>
                          <span className="text-xs text-slate-500">
                            {s.grade} | {s.subject}
                          </span>
                        </div>
                        <label className="flex items-center space-x-2 cursor-pointer bg-white px-3 py-1.5 rounded border border-indigo-100 shadow-sm">
                          <input
                            type="checkbox"
                            checked={sData.feedbackSent || false}
                            onChange={(e) =>
                              handleInputChange(
                                s.id,
                                "feedbackSent",
                                e.target.checked
                              )
                            }
                            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-xs font-bold text-indigo-800">
                            피드백 발송함
                          </span>
                        </label>
                      </div>
                      <div className="mb-3">
                        <span className="text-xs font-bold text-slate-500 block mb-1">
                          📅 수업 진행 일자 (자동)
                        </span>
                        <div className="text-sm font-mono text-indigo-700 bg-white px-2 py-1 rounded border border-indigo-100 min-h-[30px] flex items-center">
                          {dates || "기간 내 출석 없음"}
                        </div>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-500 block mb-1">
                          📝 성취도 및 전달사항
                        </span>
                        <textarea
                          value={sData.note || ""}
                          onChange={(e) =>
                            handleInputChange(s.id, "note", e.target.value)
                          }
                          className="w-full p-2 border rounded bg-white text-sm focus:outline-indigo-500 min-h-[60px]"
                          placeholder="내용 입력"
                        />
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-8 text-slate-400">
                  담당하는 재원생이 없습니다.
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t sticky bottom-0 bg-white p-2 border-t-indigo-100">
              <button
                onClick={() => setIsWriting(false)}
                className="px-5 py-2.5 text-slate-500 text-sm font-bold hover:bg-slate-100 rounded-lg"
              >
                취소
              </button>
              <button
                onClick={handleSubmit}
                className="px-5 py-2.5 bg-indigo-600 text-white text-sm font-bold rounded-lg hover:bg-indigo-700 shadow-sm flex items-center"
              >
                <CheckCircle size={16} className="mr-2" /> 전체 저장
              </button>
            </div>
          </div>
        )}

        {/* 관리자 전체 보기 시 총합 요약 */}
        {user.role === "admin" && filteredReports.length > 0 && (
          <div className="mb-4 px-4 py-3 bg-indigo-50 border border-indigo-100 rounded-xl flex items-center gap-4 flex-wrap">
            <span className="text-sm font-bold text-indigo-700">
              {selectedMonth}월 보고서 현황
            </span>
            <span className="text-sm text-indigo-600">
              보고서 제출 <span className="font-bold">{filteredReports.length}명</span> 강사
            </span>
            <span className="text-sm text-indigo-600">
              총 담당 원생{" "}
              <span className="font-bold">
                {filteredReports.reduce((sum, r) => {
                  return sum + students.filter((s) => s.teacher === r.teacherName && s.status === "재원").length;
                }, 0)}명
              </span>
            </span>
          </div>
        )}

        <div className="space-y-6">
          {filteredReports.length > 0
            ? filteredReports.map((report) => {
                const studentList = students.filter((s) => {
                  if (s.teacher !== report.teacherName) return false;
                  if (s.status === "재원") return true;
                  return (
                    ["휴원", "퇴원"].includes(s.status) &&
                    (s.attendanceHistory || []).some(
                      (h) => h.date >= customStart && h.date <= customEnd && h.status === "present"
                    )
                  );
                });
                const teacherTotalHours = getTeacherTotalHours(studentList);
                return (
                  <div
                    key={report.id}
                    className="bg-white border rounded-xl shadow-sm overflow-hidden group"
                  >
                    <div className="bg-slate-50 px-6 py-4 border-b flex justify-between items-center">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white border flex items-center justify-center font-bold text-indigo-600 shadow-sm">
                          {report.teacherName[0]}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-slate-800">
                              {report.teacherName} 선생님
                            </h3>
                            <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full font-bold border border-indigo-100">
                              {studentList.length}명
                            </span>
                            <span className="text-xs px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-bold border border-emerald-100">
                              총 {teacherTotalHours}회
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">
                            작성일:{" "}
                            {report.updatedAt
                              ? report.updatedAt.slice(0, 10)
                              : "날짜 없음"}
                          </p>
                        </div>
                      </div>
                      {/* [삭제 버튼 수정됨] */}
                      {(user.role === "admin" ||
                        user.name === report.teacherName) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (report.id) {
                              onDeleteReport(report.id);
                            } else {
                              alert(
                                "시스템 오류: ID가 없습니다. 새로고침 후 다시 시도해주세요."
                              );
                            }
                          }}
                          className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                    <div className="divide-y divide-slate-100">
                      {studentList.length > 0 ? (
                        studentList.map((s) => {
                          const sData = (report.data || {})[s.id] || {};
                          const dates = getAttendanceDates(s);
                          return (
                            <div
                              key={s.id}
                              className="p-4 hover:bg-slate-50 transition-colors"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span
                                    className="font-bold text-slate-800 cursor-pointer hover:text-indigo-600 transition-colors"
                                    onClick={() => {
                                      setReportSelectedStudent(s);
                                      setStudentModalTab("attendance");
                                      setIsStudentModalOpen(true);
                                    }}
                                    title="출석콕콕 보기"
                                  >
                                    {s.name}
                                  </span>
                                  <span
                                    className={`text-[10px] px-2 py-0.5 rounded-full border ${
                                      sData.feedbackSent
                                        ? "bg-emerald-50 text-emerald-600 border-emerald-100"
                                        : "bg-amber-50 text-amber-600 border-amber-100"
                                    }`}
                                  >
                                    {sData.feedbackSent
                                      ? "피드백 완료"
                                      : "피드백 미발송"}
                                  </span>
                                  <button
                                    onClick={() => {
                                      setReportSelectedStudent(s);
                                      setStudentModalTab("attendance");
                                      setIsStudentModalOpen(true);
                                    }}
                                    className="text-[10px] px-2 py-0.5 rounded-full border bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100 transition-colors"
                                  >
                                    출석콕콕
                                  </button>
                                  {user.role === "admin" && (
                                    <button
                                      onClick={() => {
                                        setReportSelectedStudent(s);
                                        setStudentModalTab("payment");
                                        setIsStudentModalOpen(true);
                                      }}
                                      className="text-[10px] px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100 transition-colors"
                                    >
                                      수납콕콕
                                    </button>
                                  )}
                                </div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                <div className="md:col-span-1">
                                  <span className="text-xs font-bold text-slate-400 block mb-1">
                                    수업일
                                  </span>
                                  <span className="font-mono text-slate-600 text-xs">
                                    {dates || "-"}
                                  </span>
                                </div>
                                <div className="md:col-span-2">
                                  <span className="text-xs font-bold text-slate-400 block mb-1">
                                    메모 / 특이사항
                                  </span>
                                  <p className="text-slate-700 whitespace-pre-wrap">
                                    {sData.note || "기록 없음"}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-6 text-center text-slate-400 text-sm">
                          데이터가 없습니다.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            : !isWriting && (
                <div className="text-center py-12 text-slate-400 border-2 border-dashed border-slate-100 rounded-xl">
                  <File className="mx-auto mb-2 opacity-20" size={48} />
                  <p>등록된 보고서가 없습니다.</p>
                </div>
              )}
        </div>
      </div>
      <StudentManagementModal
        isOpen={isStudentModalOpen}
        onClose={() => setIsStudentModalOpen(false)}
        student={reportSelectedStudent}
        teachers={teachers}
        initialTab={studentModalTab}
        user={user}
        onSave={(data) => {
          if (onUpdateStudent && reportSelectedStudent?.id) {
            onUpdateStudent(reportSelectedStudent.id, data);
          }
          setIsStudentModalOpen(false);
        }}
        onDelete={() => setIsStudentModalOpen(false)}
      />
    </div>
  );
};

// [ConsultationView] - 오리지널 기능 완벽 보존 + 연동 강화 버전
const ConsultationView = ({
  onRegisterStudent,
  showToast,
  consultations: allConsultations,
  targetConsultation,
  onClearTargetConsultation,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
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

  const [viewMode, setViewMode] = useState("pending");

  // 1. [기능 보존] 진행 중 / 보관함 필터링
  const filteredConsultations = useMemo(
    () =>
      allConsultations.filter((c) =>
        viewMode === "pending" ? c.status === "pending" : c.status !== "pending"
      ),
    [allConsultations, viewMode]
  );

  // 2. [기능 보존] 외부 진입 시 자동 열기
  useEffect(() => {
    if (targetConsultation) {
      openModal(targetConsultation);
      if (onClearTargetConsultation) onClearTargetConsultation();
    }
  }, [targetConsultation]);

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

  // 3. [기능 보존] 후속 조치 토글
  const toggleFollowUpAction = (actionId) => {
    const currentActions = currentConsult.followUpActions || [];
    const nextActions = currentActions.includes(actionId)
      ? currentActions.filter((id) => id !== actionId)
      : [...currentActions, actionId];
    setCurrentConsult({ ...currentConsult, followUpActions: nextActions });
  };

  // 4. [기능 보존] 저장 로직 (Firebase 연동) + 중복 클릭 방지
  const handleSaveConsultation = async () => {
    if (isSaving) return; // 중복 클릭 방지
    if (!currentConsult.name || !currentConsult.phone) {
      showToast("이름과 연락처를 입력해주세요.", "warning");
      return;
    }
    setIsSaving(true);
    try {
      const safeAppId = APP_ID || "jnc-music-v2";
      if (currentConsult.id) {
        const { id, ...dataToUpdate } = currentConsult;
        await updateDoc(
          doc(
            db,
            "artifacts",
            safeAppId,
            "public",
            "data",
            "consultations",
            currentConsult.id
          ),
          dataToUpdate
        );
        showToast("수정 저장되었습니다.", "success");
      } else {
        const { id, ...dataToSave } = currentConsult;
        await addDoc(
          collection(
            db,
            "artifacts",
            safeAppId,
            "public",
            "data",
            "consultations"
          ),
          { ...dataToSave, createdAt: new Date().toISOString() }
        );
        showToast("신규 상담이 등록되었습니다.", "success");
      }
      setIsModalOpen(false);
    } catch (e) {
      console.error(e);
      showToast("저장 중 오류가 발생했습니다.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const deleteConsultation = async (e, id) => {
    e.stopPropagation();
    if (!window.confirm("상담 내역을 삭제하시겠습니까?")) return;
    try {
      const safeAppId = APP_ID || "jnc-music-v2";
      await deleteDoc(
        doc(db, "artifacts", safeAppId, "public", "data", "consultations", id)
      );
      showToast("삭제되었습니다.", "success");
    } catch (e) {
      showToast("삭제 실패", "error");
    }
  };

  return (
    <div className="bg-white rounded-2xl border shadow-sm p-6 h-full flex flex-col overflow-hidden animate-fade-in">
      {/* --- 상담 모달 영역 --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto scrollbar-hide">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-slate-800">
                {currentConsult.id ? "상담 정보 수정" : "신규 상담 등록"}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={24} className="text-slate-400" />
              </button>
            </div>

            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 ml-1">
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
                    className="w-full p-2.5 border rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 ml-1">
                    구분
                  </label>
                  <div className="flex bg-slate-100 rounded-xl p-1">
                    <button
                      onClick={() =>
                        setCurrentConsult({
                          ...currentConsult,
                          type: "student",
                        })
                      }
                      className={`flex-1 text-xs py-2 rounded-lg font-bold transition-all ${
                        currentConsult.type === "student"
                          ? "bg-white shadow text-indigo-600"
                          : "text-slate-400"
                      }`}
                    >
                      학생
                    </button>
                    <button
                      onClick={() =>
                        setCurrentConsult({
                          ...currentConsult,
                          type: "adult",
                          grade: "",
                        })
                      }
                      className={`flex-1 text-xs py-2 rounded-lg font-bold transition-all ${
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
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 ml-1">
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
                    className="w-full p-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="성함"
                  />
                </div>
                {currentConsult.type === "student" && (
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 ml-1">
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
                      className="w-full p-2.5 border rounded-xl bg-white outline-none focus:ring-2 focus:ring-indigo-500"
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

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 ml-1">
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
                  className="w-full p-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="010-0000-0000"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 ml-1">
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
                  className="w-full p-2.5 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="예: 피아노"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 ml-1">
                  상담 상세 메모
                </label>
                <textarea
                  value={currentConsult.note}
                  onChange={(e) =>
                    setCurrentConsult({
                      ...currentConsult,
                      note: e.target.value,
                    })
                  }
                  className="w-full p-3 border rounded-xl h-24 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  placeholder="상담 내용 기록"
                />
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <label className="text-xs font-bold text-slate-600 mb-3 block flex items-center gap-1.5">
                  <CheckSquare size={16} className="text-indigo-500" /> 후속
                  조치 (할 일)
                </label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {FOLLOW_UP_OPTIONS.map((opt) => (
                    <label
                      key={opt.id}
                      className="flex items-center text-xs text-slate-700 cursor-pointer hover:bg-white p-1 rounded-lg transition-colors"
                    >
                      <input
                        type="checkbox"
                        className="mr-2 rounded border-slate-300 text-indigo-600"
                        checked={currentConsult.followUpActions.includes(
                          opt.id
                        )}
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
                  className="w-full p-2.5 border rounded-xl bg-white text-xs h-16 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="후속 조치 상세 메모"
                />
              </div>

              <div className="pt-2 border-t mt-2">
                <label className="text-xs font-bold text-slate-500 mb-2 block ml-1">
                  상담 결과
                </label>
                <div className="flex gap-2 mb-4">
                  {["pending", "registered", "dropped"].map((status) => (
                    <button
                      key={status}
                      onClick={() =>
                        setCurrentConsult({ ...currentConsult, status })
                      }
                      className={`flex-1 py-2 text-xs rounded-xl font-bold border transition-all ${
                        currentConsult.status === status
                          ? status === "registered"
                            ? "bg-emerald-500 border-emerald-600 text-white shadow-md"
                            : status === "dropped"
                            ? "bg-rose-500 border-rose-600 text-white shadow-md"
                            : "bg-slate-600 border-slate-700 text-white shadow-md"
                          : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50"
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
                  <input
                    value={currentConsult.failReason}
                    onChange={(e) =>
                      setCurrentConsult({
                        ...currentConsult,
                        failReason: e.target.value,
                      })
                    }
                    className="w-full p-2.5 border border-rose-200 rounded-xl bg-rose-50 text-rose-800 text-xs outline-none"
                    placeholder="미등록 사유를 적어주세요."
                  />
                )}
              </div>

              <button
                onClick={handleSaveConsultation}
                disabled={isSaving}
                className={`w-full py-3.5 rounded-xl font-bold shadow-lg transition-all ${isSaving ? "bg-slate-400 text-slate-200 cursor-not-allowed" : "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95"}`}
              >
                {isSaving ? "저장 중..." : currentConsult.id ? "수정 내용 저장" : "상담 내역 등록"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- 상단 헤더 및 필터 영역 --- */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 shrink-0 gap-4">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <MessageSquareText className="text-indigo-600" /> 상담 관리
          </h2>
          <div className="flex bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setViewMode("pending")}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                viewMode === "pending"
                  ? "bg-white text-indigo-600 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              진행 중 (
              {allConsultations.filter((c) => c.status === "pending").length})
            </button>
            <button
              onClick={() => setViewMode("archived")}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                viewMode === "archived"
                  ? "bg-white text-slate-700 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              완료/보관함 (
              {allConsultations.filter((c) => c.status !== "pending").length})
            </button>
          </div>
        </div>
        <button
          onClick={() => openModal()}
          className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-bold flex items-center gap-1.5 shadow-md hover:bg-indigo-700 transition-all active:scale-95"
        >
          <Plus size={18} /> 상담 추가
        </button>
      </div>

      {/* --- 리스트 테이블 영역 --- */}
      <div className="flex-1 overflow-auto border rounded-2xl bg-slate-50/30 shadow-inner">
        <table className="w-full text-left border-separate border-spacing-0">
          <thead className="sticky top-0 bg-white z-10 shadow-sm font-bold text-xs text-slate-400 uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4">일자/구분</th>
              <th className="px-6 py-4">성함/연락처</th>
              <th className="px-6 py-4">과목 및 상세내역</th>
              <th className="px-6 py-4 text-center w-36">원생 등록</th>
              <th className="px-6 py-4 text-right w-20">삭제</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {filteredConsultations.map((c) => (
              <tr
                key={c.id}
                onClick={() => openModal(c)}
                className="hover:bg-indigo-50/20 cursor-pointer transition-all"
              >
                <td className="px-6 py-4">
                  <div className="text-xs text-slate-500 mb-1">{c.date}</div>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      c.type === "adult"
                        ? "bg-slate-100 text-slate-600"
                        : "bg-indigo-50 text-indigo-600"
                    }`}
                  >
                    {c.type === "adult" ? "성인" : "학생"}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-800 text-base">
                    {c.name}{" "}
                    {c.grade && (
                      <span className="text-slate-400 font-normal text-xs">
                        ({c.grade})
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 font-mono tracking-tighter">
                    {c.phone}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-bold text-indigo-600 text-sm mb-1">
                    {c.subject}
                  </div>
                  <div className="text-xs text-slate-500 line-clamp-1 italic max-w-[250px]">
                    "{c.note}"
                  </div>
                </td>
                <td
                  className="px-6 py-4 text-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  {c.status === "registered" ? (
                    <span className="inline-flex px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-lg text-xs font-bold">
                      등록 완료
                    </span>
                  ) : (
                    <button
                      onClick={() => onRegisterStudent(c)}
                      className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md hover:scale-105 active:scale-95 transition-all"
                    >
                      원생 등록 <ChevronRight size={14} className="ml-1" />
                    </button>
                  )}
                </td>
                <td
                  className="px-6 py-4 text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={(e) => deleteConsultation(e, c.id)}
                    className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </td>
              </tr>
            ))}
            {filteredConsultations.length === 0 && (
              <tr>
                <td
                  colSpan="5"
                  className="text-center py-20 text-slate-400 font-bold"
                >
                  상담 내역이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// [CalendarView]
const CalendarView = ({ teachers, user, students, showToast }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState("month");
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [attendanceMenu, setAttendanceMenu] = useState(null);
  const [reasonModal, setReasonModal] = useState(null);
  const [dateDetail, setDateDetail] = useState(null);

  useEffect(() => {
    if (user.role === "teacher") setSelectedTeacher(user.name);
  }, [user]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const monthDays = [];
  for (let i = 0; i < firstDay; i++) monthDays.push(null);
  for (let i = 1; i <= daysInMonth; i++) monthDays.push(i);

  const getWeekDates = (date) => {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date.setDate(diff));
    const week = [];
    for (let i = 0; i < 7; i++) {
      const nextDate = new Date(monday);
      nextDate.setDate(monday.getDate() + i);
      week.push(nextDate);
    }
    return week;
  };
  const weekDates = useMemo(
    () => getWeekDates(new Date(currentDate)),
    [currentDate]
  );
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let i = 10; i <= 22; i++) slots.push(i);
    return slots;
  }, []);

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
    const scheduled = students.filter((s) => {
      const isTeacherMatch = s.teacher === teacherName;
      const isStatusMatch = s.status === "재원";
      const isDayMatch =
        (s.classDays && s.classDays.includes(dayName)) ||
        s.className === dayName ||
        (s.schedules && s.schedules[dayName]);
      return isTeacherMatch && isDayMatch && isStatusMatch;
    });
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
    reason = "",
    memo = ""
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
      } else if (status === "double") {
        // 연강 토글: 1회↔2회
        if (existingIdx > -1 && history[existingIdx].status === "present") {
          const cur = history[existingIdx].count || 1;
          history[existingIdx] = { ...history[existingIdx], count: cur === 1 ? 2 : 1 };
        }
      } else {
        const prevCount = existingIdx > -1 ? (history[existingIdx].count || 1) : 1;
        const record = {
          date: date,
          status: status,
          reason: reason,
          timestamp: new Date().toISOString(),
        };
        if (status === "present") record.count = prevCount;
        if (memo) record.memo = memo;
        if (existingIdx > -1) history[existingIdx] = record;
        else history.push(record);
      }
      const lastPayment = student.lastPaymentDate || "0000-00-00";
      const sessionsCompleted = history.reduce((sum, h) => {
        if (h.date < lastPayment) return sum;
        if (h.status === "present") return sum + (h.count || 1);
        if (h.status === "canceled") return sum + 1; // 당일취소는 학생 1회 차감 (강사 시수는 별도 0.5회 적용)
        return sum;
      }, 0);
      await updateDoc(studentRef, {
        attendanceHistory: history,
        sessionsCompleted,
      });
      setAttendanceMenu(null);
      setReasonModal(null);
      const doubleCount = status === "double"
        ? ((history.find((h) => h.date === date)?.count || 1) === 2 ? 2 : 1)
        : null;
      showToast(
        status === "delete" ? "기록 삭제됨"
        : status === "double" ? `연강 ${doubleCount === 2 ? "처리(2회)" : "해제(1회)"}`
        : "저장됨",
        "success"
      );
    } catch (e) {
      console.error(e);
      showToast("오류 발생", "error");
    }
  };

  const handleStatusSelect = (status, memo = "") => {
    if (status === "present" || status === "delete" || status === "double") {
      handleCalendarAttendance(
        attendanceMenu.student,
        attendanceMenu.date,
        status,
        "",
        memo
      );
    } else {
      setReasonModal({
        student: attendanceMenu.student,
        date: attendanceMenu.date,
        status: status,
        memo: memo,
      });
      setAttendanceMenu(null);
    }
  };

  const getSessionCount = (student, targetDate) => {
    // totalSessions 단위(4 or 8)로 순환하는 회차를 반환 (1·2·3·4·1·2·3·4…)
    // 당일취소도 1회 점유하므로 포함
    const total = getEffectiveSessions(student);
    const sessions = (student.attendanceHistory || [])
      .filter((h) => h.status === "present" || h.status === "canceled")
      .sort((a, b) => a.date.localeCompare(b.date));
    let cumulative = 0;
    for (const h of sessions) {
      if (h.date === targetDate) return (cumulative % total) + 1;
      if (h.date > targetDate) break;
      cumulative += h.status === "canceled" ? 1 : (h.count || 1);
    }
    return null;
  };

  // [기능1] 해당 날짜가 학생의 현재 결제 사이클 마지막 회차인지 여부
  const isLastSessionOfCycle = (student, targetDate) => {
    const total = getEffectiveSessions(student);
    const sessions = (student.attendanceHistory || [])
      .filter((h) => h.status === "present" || h.status === "canceled")
      .sort((a, b) => a.date.localeCompare(b.date));
    let cumulative = 0;
    for (const h of sessions) {
      if (h.date === targetDate) {
        const cnt = h.status === "canceled" ? 1 : (h.count || 1);
        // 마지막 회차에 도달하면 true (4회 단위면 4번째, 8회면 8번째)
        return (cumulative + cnt) % total === 0;
      }
      if (h.date > targetDate) break;
      cumulative += h.status === "canceled" ? 1 : (h.count || 1);
    }
    return false;
  };

  // [기능2] 오늘 이전 날짜 중 출석 미처리(scheduled) 여부
  const todayStr = new Date().toISOString().split("T")[0];
  const isUnprocessedPast = (student, dateStr) => {
    if (dateStr >= todayStr) return false;
    const record = student.attendanceHistory?.find((h) => h.date === dateStr);
    return !record; // 기록 자체가 없으면 미처리
  };

  // [기능3] 강사 선택 시 특정 시간대에 수업이 없는지 여부 (빈 슬롯)
  const isEmptySlot = (teacherName, hour, dayOfWeek, dateStr) => {
    if (!selectedTeacher) return false;
    const dayName = ["일", "월", "화", "수", "목", "금", "토"][dayOfWeek];
    const teacherStudents = students.filter(
      (s) => s.teacher === teacherName && s.status === "재원" &&
        ((s.schedules && s.schedules[dayName]) || (!s.schedules && s.className === dayName))
    );
    return teacherStudents.every((s) => {
      const time = getStudentScheduleTime(s, dayName);
      return !time || !time.startsWith(`${hour}:`);
    });
  };

  const getDetailModalData = (dateStr, dayOfWeek) => {
    let currentTeachers = teachers;
    if (selectedTeacher)
      currentTeachers = teachers.filter((t) => t.name === selectedTeacher);
    let allStudents = [];
    currentTeachers.forEach((t) => {
      const studentsForTeacher = getStudentsForCell(t.name, dayOfWeek, dateStr);
      allStudents = [...allStudents, ...studentsForTeacher];
    });
    return allStudents;
  };

  const renderWeeklyView = () => {
    return (
      <div className="flex flex-col h-full border rounded-lg overflow-hidden bg-white">
        <div className="grid grid-cols-8 border-b bg-slate-50">
          <div className="p-2 text-center text-xs font-bold text-slate-500 border-r">
            Time
          </div>
          {weekDates.map((date, i) => {
            const dateStr = date.toISOString().split("T")[0];
            const isToday = dateStr === new Date().toISOString().split("T")[0];
            return (
              <div
                key={i}
                className={`p-2 text-center border-r last:border-r-0 ${
                  isToday ? "bg-indigo-50" : ""
                }`}
              >
                <div
                  className={`text-xs font-bold ${
                    i === 6
                      ? "text-rose-500"
                      : i === 5
                      ? "text-blue-500"
                      : "text-slate-700"
                  }`}
                >
                  {DAYS_OF_WEEK.find((d) => d.id === (i + 1) % 7)?.label}
                </div>
                <div
                  className={`text-xs ${
                    isToday ? "text-indigo-600 font-bold" : "text-slate-500"
                  }`}
                >
                  {date.getDate()}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex-1 overflow-y-auto">
          {timeSlots.map((hour) => (
            <div key={hour} className="grid grid-cols-8 border-b min-h-[60px]">
              <div className="p-2 text-center text-xs text-slate-400 border-r font-mono bg-slate-50">
                {hour}:00
              </div>
              {weekDates.map((date, i) => {
                const dateStr = date.toISOString().split("T")[0];
                const dayOfWeek = date.getDay();
                let cellStudents = [];
                const targetTeachers = selectedTeacher
                  ? [teachers.find((t) => t.name === selectedTeacher)]
                  : teachers;
                targetTeachers.forEach((t) => {
                  if (!t) return;
                  const st = getStudentsForCell(t.name, dayOfWeek, dateStr);
                  const timeFiltered = st.filter((s) => {
                    const dayName = ["일", "월", "화", "수", "목", "금", "토"][
                      dayOfWeek
                    ];
                    const time = getStudentScheduleTime(s, dayName);
                    return time && time.startsWith(`${hour}:`);
                  });
                  cellStudents = [...cellStudents, ...timeFiltered];
                });
                // [기능3] 강사 선택 시 빈 슬롯 표시
                const emptySlot = selectedTeacher && cellStudents.length === 0 &&
                  isEmptySlot(selectedTeacher, hour, dayOfWeek, dateStr) &&
                  dateStr >= todayStr;
                return (
                  <div
                    key={i}
                    className={`p-1 border-r last:border-r-0 relative transition-colors ${emptySlot ? "bg-emerald-50/40" : "hover:bg-slate-50"}`}
                  >
                    {emptySlot && (
                      <div className="text-[9px] text-emerald-400 text-center mt-1 font-medium">빈 슬롯</div>
                    )}
                    {cellStudents.map((s, idx) => {
                      const record = s.attendanceHistory?.find(
                        (h) => h.date === dateStr
                      );
                      const status = record ? record.status : "scheduled";
                      const isDoubleLesson = status === "present" && (record?.count || 1) === 2;
                      const sessionNum = getSessionCount(s, dateStr);
                      const isLast = status === "present" && isLastSessionOfCycle(s, dateStr);
                      const isUnprocessed = isUnprocessedPast(s, dateStr);
                      let bgClass =
                        "bg-indigo-100 text-indigo-700 border-indigo-200";
                      if (isUnprocessed)
                        bgClass = "bg-amber-50 text-amber-700 border-amber-400";
                      else if (isDoubleLesson)
                        bgClass = "bg-emerald-700 text-white border-emerald-800";
                      else if (status === "present")
                        bgClass =
                          "bg-emerald-100 text-emerald-700 border-emerald-200";
                      else if (status === "absent")
                        bgClass = "bg-rose-100 text-rose-700 border-rose-200";
                      else if (status === "canceled")
                        bgClass =
                          "bg-slate-100 text-slate-400 border-slate-200 line-through";
                      return (
                        <div
                          key={idx}
                          onClick={(e) => {
                            e.stopPropagation();
                            setAttendanceMenu({ student: s, date: dateStr });
                          }}
                          className={`text-[10px] px-1 py-0.5 rounded border mb-1 cursor-pointer truncate flex items-center gap-0.5 ${bgClass}`}
                        >
                          <span className="truncate">{s.name} {sessionNum ? `(${sessionNum})` : ""}{isDoubleLesson ? "×2" : ""}</span>
                          {isLast && <span className="shrink-0">💳</span>}
                          {isUnprocessed && <span className="shrink-0 text-amber-500">!</span>}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderDailyView = () => {
    const dateStr = currentDate.toISOString().split("T")[0];
    const dayOfWeek = currentDate.getDay();
    const visibleTeachers = selectedTeacher
      ? teachers.filter((t) => t.name === selectedTeacher)
      : teachers;
    return (
      <div className="flex h-full border rounded-lg overflow-hidden bg-white">
        <div className="w-16 flex-shrink-0 border-r bg-slate-50 flex flex-col">
          <div className="h-10 border-b"></div>
          <div className="flex-1 overflow-hidden">
            {timeSlots.map((hour) => (
              <div
                key={hour}
                className="h-20 border-b flex items-center justify-center text-xs text-slate-400 font-mono"
              >
                {hour}:00
              </div>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <div
            className="flex"
            style={{
              width: `${Math.max(100, visibleTeachers.length * 120)}px`,
            }}
          >
            {visibleTeachers.map((t) => (
              <div
                key={t.id}
                className="w-[120px] flex-shrink-0 border-r flex flex-col"
              >
                <div className="h-10 border-b bg-slate-50 flex items-center justify-center font-bold text-xs text-slate-700 sticky top-0">
                  {t.name}
                </div>
                <div>
                  {timeSlots.map((hour) => {
                    const cellStudents = getStudentsForCell(
                      t.name,
                      dayOfWeek,
                      dateStr
                    ).filter((s) => {
                      const dayName = [
                        "일",
                        "월",
                        "화",
                        "수",
                        "목",
                        "금",
                        "토",
                      ][dayOfWeek];
                      const time = getStudentScheduleTime(s, dayName);
                      return time && time.startsWith(`${hour}:`);
                    });
                    // [기능3] 강사 선택 시 빈 슬롯
                    const emptySlot = selectedTeacher && cellStudents.length === 0 &&
                      isEmptySlot(selectedTeacher, hour, dayOfWeek, dateStr) &&
                      dateStr >= todayStr;
                    return (
                      <div
                        key={hour}
                        className={`h-20 border-b p-1 transition-colors ${emptySlot ? "bg-emerald-50/40" : "hover:bg-slate-50"}`}
                      >
                        {emptySlot && (
                          <div className="text-[9px] text-emerald-400 text-center mt-1 font-medium">빈 슬롯</div>
                        )}
                        {cellStudents.map((s, idx) => {
                          const record = s.attendanceHistory?.find(
                            (h) => h.date === dateStr
                          );
                          const status = record ? record.status : "scheduled";
                          const isDoubleLesson = status === "present" && (record?.count || 1) === 2;
                          const sessionNum = getSessionCount(s, dateStr);
                          const isLast = status === "present" && isLastSessionOfCycle(s, dateStr);
                          const isUnprocessed = isUnprocessedPast(s, dateStr);
                          let bgClass =
                            "bg-white border-slate-200 text-slate-700";
                          if (isUnprocessed)
                            bgClass = "bg-amber-50 border-amber-400 text-amber-700";
                          else if (isDoubleLesson)
                            bgClass = "bg-emerald-700 border-emerald-800 text-white";
                          else if (status === "present")
                            bgClass =
                              "bg-emerald-100 border-emerald-200 text-emerald-800";
                          return (
                            <div
                              key={idx}
                              onClick={(e) => {
                                e.stopPropagation();
                                setAttendanceMenu({
                                  student: s,
                                  date: dateStr,
                                });
                              }}
                              className={`text-[10px] p-1 rounded border mb-1 cursor-pointer shadow-sm flex items-center gap-0.5 ${bgClass}`}
                            >
                              <span className="truncate">{s.name} {sessionNum ? `(${sessionNum})` : ""}{isDoubleLesson ? "×2" : ""}</span>
                              {isLast && <span className="shrink-0">💳</span>}
                              {isUnprocessed && <span className="shrink-0 font-bold text-amber-500">!</span>}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    return (
      <div className="grid grid-cols-7 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden flex-1 h-full">
        {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
          <div
            key={day}
            className="bg-slate-50 p-2 text-center text-sm font-bold text-slate-500"
          >
            {day}
          </div>
        ))}
        {monthDays.map((day, idx) => {
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
                  setDateDetail({ date: dateStr, dayOfWeek });
                }
              }}
            >
              <div className="flex justify-between items-start">
                <span
                  className={`text-sm font-medium ${
                    idx % 7 === 0 || isHoliday
                      ? "text-rose-500"
                      : idx % 7 === 6
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
                      const sessionNum = getSessionCount(s, dateStr);
                      const isLast = status === "present" && isLastSessionOfCycle(s, dateStr);
                      const isUnprocessed = isUnprocessedPast(s, dateStr);
                      let bgClass =
                        "bg-slate-100 text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50";
                      if (isUnprocessed)
                        bgClass = "bg-amber-50 text-amber-700 border-amber-400 hover:bg-amber-100";
                      else if (status === "present")
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
                          className={`text-[10px] px-1.5 py-1 rounded border ${bgClass} font-medium flex justify-between items-center gap-0.5 transition-all shadow-sm`}
                        >
                          <span className="truncate">
                            {s.name} {sessionNum ? `(${sessionNum})` : ""}
                          </span>
                          <span className="shrink-0 flex items-center gap-0.5">
                            {isLast && <span>💳</span>}
                            {isUnprocessed && <span className="font-bold text-amber-500">!</span>}
                            {status === "present" && !isLast && (
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"></span>
                            )}
                          </span>
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
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 animate-fade-in h-full flex flex-col">
      {attendanceMenu && (
        <AttendanceActionModal
          student={attendanceMenu.student}
          date={attendanceMenu.date}
          onClose={() => setAttendanceMenu(null)}
          onSelectStatus={handleStatusSelect}
          currentRecord={attendanceMenu.student.attendanceHistory?.find((h) => h.date === attendanceMenu.date)}
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
              reason,
              reasonModal.memo || ""
            )
          }
        />
      )}
      {dateDetail && (
        <DateDetailModal
          date={dateDetail.date}
          students={getDetailModalData(dateDetail.date, dateDetail.dayOfWeek)}
          onClose={() => setDateDetail(null)}
          onStudentClick={(s, date) => setAttendanceMenu({ student: s, date })}
        />
      )}
      <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
        <h2 className="text-xl font-bold text-slate-800 flex items-center">
          <CalendarIcon className="mr-2 text-indigo-600" size={24} /> {year}년{" "}
          {month + 1}월
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-lg mr-2">
            <button
              onClick={() => setViewType("month")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                viewType === "month"
                  ? "bg-white text-indigo-600 shadow"
                  : "text-slate-500"
              }`}
            >
              <Grid size={14} className="inline mr-1" /> 월간
            </button>
            <button
              onClick={() => setViewType("week")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                viewType === "week"
                  ? "bg-white text-indigo-600 shadow"
                  : "text-slate-500"
              }`}
            >
              <Columns size={14} className="inline mr-1" /> 주간
            </button>
            <button
              onClick={() => setViewType("day")}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                viewType === "day"
                  ? "bg-white text-indigo-600 shadow"
                  : "text-slate-500"
              }`}
            >
              <ListTodo size={14} className="inline mr-1" /> 일별
            </button>
          </div>
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
              onClick={() => {
                const newDate = new Date(currentDate);
                if (viewType === "month")
                  newDate.setMonth(newDate.getMonth() - 1);
                else if (viewType === "week")
                  newDate.setDate(newDate.getDate() - 7);
                else newDate.setDate(newDate.getDate() - 1);
                setCurrentDate(newDate);
              }}
              className="p-1.5 hover:bg-white rounded-md text-slate-600 shadow-sm"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-3 py-1.5 text-xs font-bold hover:bg-white rounded-md text-slate-600 shadow-sm"
            >
              오늘
            </button>
            <button
              onClick={() => {
                const newDate = new Date(currentDate);
                if (viewType === "month")
                  newDate.setMonth(newDate.getMonth() + 1);
                else if (viewType === "week")
                  newDate.setDate(newDate.getDate() + 7);
                else newDate.setDate(newDate.getDate() + 1);
                setCurrentDate(newDate);
              }}
              className="p-1.5 hover:bg-white rounded-md text-slate-600 shadow-sm"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
      {/* 범례 */}
      <div className="flex items-center gap-3 text-[10px] text-slate-500 mb-2 flex-wrap">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-100 border border-emerald-200 inline-block"></span>출석 완료</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-amber-50 border border-amber-400 inline-block"></span>미처리 과거 수업 <b className="text-amber-500">!</b></span>
        <span className="flex items-center gap-1"><span>💳</span>이번 수업 후 결제 필요</span>
        {selectedTeacher && <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded bg-emerald-50 border border-emerald-200 inline-block"></span>빈 슬롯 (신규 배치 가능)</span>}
      </div>
      {viewType === "month" && renderMonthView()}
      {viewType === "week" && renderWeeklyView()}
      {viewType === "day" && renderDailyView()}
    </div>
  );
};
// [ClassLogView]
const ClassLogView = ({ students, teachers, user, showToast }) => {
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
  const getSessionNumbers = (student, targetDate) => {
    // 전체 출석 이력 누적 기준으로 해당 날짜 수업의 회차 배열을 반환한다.
    // 월 관계없이 totalSessions 단위로 순환: 주1회(4회), 주2회(8회)
    // 연강(count=2)이면 [n, n+1] 두 회차를 반환, 일반은 [n] 한 개
    const total = getEffectiveSessions(student);
    const sessions = (student.attendanceHistory || [])
      .filter((h) => h.status === "present" || h.status === "canceled")
      .sort((a, b) => a.date.localeCompare(b.date));
    let cumulative = 0;
    for (const h of sessions) {
      if (h.date === targetDate) {
        const cnt = h.status === "canceled" ? 1 : (h.count || 1);
        return Array.from({ length: cnt }, (_, i) => (cumulative + i) % total + 1);
      }
      if (h.date > targetDate) break;
      cumulative += h.status === "canceled" ? 1 : (h.count || 1);
    }
    return [];
  };
  const getCellContent = (dateStr, dayIndex) => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const isFuture = dateStr > todayStr;
    let content = [];
    const dayName = DAYS_OF_WEEK.find((d) => d.id === dayIndex)?.label;
    students.forEach((s) => {
      const record = s.attendanceHistory?.find((h) => h.date === dateStr);
      const hasSchedule =
        (s.schedules && s.schedules[dayName]) ||
        (!s.schedules && s.className === dayName);
      if (record || (!isFuture && hasSchedule && s.status === "재원")) {
        if (selectedTeacher && s.teacher !== selectedTeacher) return;
        const time = getStudentScheduleTime(s, dayName);
        if (record?.status === "present") {
          // 연강(count>=2)이면 회차별로 행을 분리해서 표시
          const nums = getSessionNumbers(s, dateStr);
          nums.forEach((num) => {
            content.push({
              id: s.id,
              text: `${time} ${s.name}(${num})`,
              status: "present",
              time,
            });
          });
        } else {
          const statusMark = record?.status ? "(x)" : "";
          content.push({
            id: s.id,
            text: `${time} ${s.name}${statusMark}`,
            status: record?.status || "scheduled",
            time,
          });
        }
      }
    });
    content.sort((a, b) => a.time.localeCompare(b.time));
    return content;
  };

  // 수업일지 항목 클릭: 없음→출석1회→출석2회(연강)→제거 순환
  const handleItemClick = async (studentId, dateStr) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return;
    const studentRef = doc(db, "artifacts", APP_ID, "public", "data", "students", studentId);
    let history = [...(student.attendanceHistory || [])];
    const idx = history.findIndex((h) => h.date === dateStr);
    const existing = idx > -1 ? history[idx] : null;

    let msg = "";
    if (!existing || existing.status !== "present") {
      // 없거나 결석/취소 → 출석 1회
      const record = { date: dateStr, status: "present", count: 1, timestamp: new Date().toISOString() };
      if (idx > -1) history[idx] = record;
      else history.push(record);
      msg = `${student.name} 출석 처리(1회)`;
    } else if ((existing.count || 1) === 1) {
      // 1회 → 연강 2회
      history[idx] = { ...existing, count: 2 };
      msg = `${student.name} 연강 처리(2회)`;
    } else {
      // 2회 → 제거
      history.splice(idx, 1);
      msg = `${student.name} 출석 취소`;
    }

    const lastPay = student.lastPaymentDate || "0000-00-00";
    const sessionsCompleted = history.reduce((sum, h) => {
      if (h.date < lastPay) return sum;
      if (h.status === "present") return sum + (h.count || 1);
      if (h.status === "canceled") return sum + 1; // 당일취소는 학생 1회 차감 (강사 시수는 별도 0.5회 적용)
      return sum;
    }, 0);

    try {
      await updateDoc(studentRef, { attendanceHistory: history, sessionsCompleted });
      showToast(msg, "success");
    } catch (e) {
      showToast("저장 실패", "error");
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 animate-fade-in">
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
      <div className="border rounded-lg overflow-hidden">
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
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-200 bg-white">
          {days.map((day, i) => {
            if (!day) return <div key={i} className="bg-slate-50/30"></div>;
            const dateStr = `${year}-${String(month + 1).padStart(
              2,
              "0"
            )}-${String(day).padStart(2, "0")}`;
            const isHoliday = HOLIDAYS[dateStr];
            const dateObj = new Date(year, month, day);
            const items = getCellContent(dateStr, dateObj.getDay());
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
                      onClick={() => handleItemClick(item.id, dateStr)}
                      className={`text-[10px] px-1 py-0.5 rounded truncate cursor-pointer transition-colors ${
                        item.status === "present"
                          ? "text-slate-700 hover:bg-emerald-100"
                          : "text-slate-400 line-through hover:bg-slate-100"
                      }`}
                      title="클릭: 출석→연강→취소 순환"
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

// [SettingsView] - (강사 관리 완전체: 비밀번호/파트/요일 통합 관리)
const SettingsView = ({ teachers, students, showToast, seedData, adminPassword, paymentUrl = "" }) => {
  // --- [상태 관리] ---
  // 0. 관리자 비밀번호 변경용 상태
  const [newAdminPw, setNewAdminPw] = useState("");
  const [confirmAdminPw, setConfirmAdminPw] = useState("");

  // 결제 링크 URL 설정
  const [paymentUrlInput, setPaymentUrlInput] = useState(paymentUrl);

  // 1. 신규 강사 등록용 상태
  const [newTeacherName, setNewTeacherName] = useState("");
  const [newTeacherPassword, setNewTeacherPassword] = useState("");
  const [newTeacherPart, setNewTeacherPart] = useState("피아노");
  const [isDirectInput, setIsDirectInput] = useState(false);
  const [newTeacherDays, setNewTeacherDays] = useState([]);

  // 2. 시스템/UI 상태
  const [uploading, setUploading] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null); // 수정할 강사 객체

  // --- [상수 데이터] ---
  const DAYS_OF_WEEK = [
    { id: "월", label: "월" },
    { id: "화", label: "화" },
    { id: "수", label: "수" },
    { id: "목", label: "목" },
    { id: "금", label: "금" },
    { id: "토", label: "토" },
    { id: "일", label: "일" },
  ];

  const TEACHER_PARTS = [
    { id: "피아노", label: "🎹 피아노" },
    { id: "재즈피아노", label: "🎹 재즈피아노" },
    { id: "드럼", label: "🥁 드럼" },
    { id: "기타", label: "🎸 기타" },
    { id: "베이스", label: "🎸 베이스" },
    { id: "보컬", label: "🎤 보컬" },
    { id: "플루트", label: "🎻 플루트" },
    { id: "클라리넷", label: "🎻 클라리넷" },
    { id: "오보에", label: "🎻 오보에" },
    { id: "바이올린", label: "🎻 바이올린" },
    { id: "첼로", label: "🎻 첼로" },
    { id: "작곡", label: "🎼 작곡" },
    { id: "미디", label: "💻 미디" },
  ];

  // --- [핸들러 함수] ---

  // 0. 관리자 비밀번호 변경
  const handleChangeAdminPassword = async () => {
    if (!newAdminPw.trim()) return showToast("새 비밀번호를 입력해주세요.", "error");
    if (newAdminPw !== confirmAdminPw) return showToast("비밀번호가 일치하지 않습니다.", "error");
    try {
      await setDoc(
        doc(db, "artifacts", APP_ID, "public", "data", "settings", "admin"),
        { password: newAdminPw.trim() },
        { merge: true }
      );
      setNewAdminPw("");
      setConfirmAdminPw("");
      showToast("관리자 비밀번호가 변경되었습니다.", "success");
    } catch (e) {
      showToast("변경 실패: " + e.message, "error");
    }
  };

  // 요일 토글 (신규 등록용)
  const toggleDay = (dayId) => {
    if (newTeacherDays.includes(dayId))
      setNewTeacherDays(newTeacherDays.filter((d) => d !== dayId));
    else setNewTeacherDays([...newTeacherDays, dayId]);
  };

  // 1. 강사 추가 (Create)
  const handleAddTeacher = async () => {
    if (!newTeacherName.trim())
      return showToast("강사 이름을 입력해주세요.", "error");
    if (!newTeacherPassword.trim())
      return showToast("비밀번호를 입력해주세요.", "error");
    if (!newTeacherPart.trim())
      return showToast("담당 과목을 입력해주세요.", "error");
    if (newTeacherDays.length === 0)
      return showToast("수업 요일을 선택해주세요.", "error");

    try {
      await addDoc(
        collection(db, "artifacts", APP_ID, "public", "data", "teachers"),
        {
          name: newTeacherName.trim(),
          password: newTeacherPassword.trim(), // 비밀번호 저장
          part: newTeacherPart.trim(), // 파트 저장
          days: newTeacherDays,
          createdAt: new Date().toISOString(),
        }
      );

      // 초기화
      setNewTeacherName("");
      setNewTeacherPassword("");
      setNewTeacherPart("피아노");
      setIsDirectInput(false);
      setNewTeacherDays([]);
      showToast("강사님이 추가되었습니다.", "success");
    } catch (e) {
      console.error(e);
      showToast("추가 실패", "error");
    }
  };

  // 2. 강사 정보 수정 (Update) - 비밀번호 포함
  const handleUpdateTeacher = async (id, data) => {
    // data 안에 name, password, part, days가 모두 들어있음
    const { name, password, part, days, oldName } = data;

    try {
      const teacherRef = doc(
        db,
        "artifacts",
        APP_ID,
        "public",
        "data",
        "teachers",
        id
      );

      // Firebase 업데이트 (비밀번호, 파트, 요일 등 모두 갱신)
      await updateDoc(teacherRef, {
        name,
        password, // 🔥 중요: 수정된 비밀번호 반영
        part,
        days,
      });

      // 강사 이름이 바뀌었다면, 원생 데이터의 담당 강사명도 변경
      if (name !== oldName) {
        const batch = writeBatch(db);
        const affectedStudents = students.filter((s) => s.teacher === oldName);
        affectedStudents.forEach((s) => {
          const studentRef = doc(
            db,
            "artifacts",
            APP_ID,
            "public",
            "data",
            "students",
            s.id
          );
          batch.update(studentRef, { teacher: name });
        });
        await batch.commit();
        showToast(
          `정보 수정 및 학생 ${affectedStudents.length}명 이관 완료`,
          "success"
        );
      } else {
        showToast("강사 정보가 수정되었습니다.", "success");
      }
    } catch (e) {
      console.error(e);
      showToast("수정 실패", "error");
    }
  };

  // 3. 강사 삭제 (Delete)
  const handleDeleteTeacher = async (id, e) => {
    e.stopPropagation();
    if (typeof id === "number") {
      // 샘플 데이터인 경우
      if (
        window.confirm(
          "현재는 샘플 데이터입니다. 실제 데이터로 변환하시겠습니까?"
        )
      ) {
        await seedData();
      }
      return;
    }
    if (window.confirm("정말 이 강사님을 삭제하시겠습니까? (복구 불가)")) {
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

  // --- [대시보드 데이터 엑셀 내보내기 (비교용)] ---
  const handleExportForComparison = () => {
    if (typeof window.XLSX === "undefined") {
      showToast("엑셀 기능을 로딩 중입니다.", "error");
      return;
    }
    try {
      const rows = [
        ["이름", "강사명", "연번", "횟수", "금액(원비)", "최종결제일", "상태"],
      ];
      students
        .slice()
        .sort((a, b) => (a.teacher || "").localeCompare(b.teacher || ""))
        .forEach((s, idx) => {
          const sortedPay = [...(s.paymentHistory || [])].sort((a, b) =>
            a.date.localeCompare(b.date)
          );
          const lastPayDate =
            sortedPay.length > 0 ? sortedPay[sortedPay.length - 1].date : "";
          rows.push([
            s.name || "",
            s.teacher || "",
            idx + 1,
            s.totalSessions || "",
            s.tuitionFee || 0,
            lastPayDate,
            s.status || "재원",
          ]);
        });

      const wb = window.XLSX.utils.book_new();
      const ws = window.XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = [16, 12, 6, 6, 12, 14, 8].map((w) => ({ wch: w }));
      window.XLSX.utils.book_append_sheet(wb, ws, "대시보드현황");
      const today = new Date().toISOString().slice(0, 10);
      window.XLSX.writeFile(wb, `JNC_대시보드_${today}.xlsx`);
      showToast("내보내기 완료!", "success");
    } catch (e) {
      console.error(e);
      showToast("내보내기 오류", "error");
    }
  };

  // --- [기존 유틸리티 기능: 엑셀/백업] ---
  const handleDownloadTemplate = () => {
    if (typeof window.XLSX === "undefined") {
      showToast("엑셀 기능을 로딩 중입니다.", "error");
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
          "요일(예: 월,수)",
          "원비",
          "과목",
          "수업시간",
          "등록일(YYYY-MM-DD)",
        ],
        [
          "홍길동",
          "초3",
          "010-1234-5678",
          "태유민",
          "월,수",
          "150000",
          "피아노",
          "14:30",
          "2026-01-01",
        ],
      ]);
      window.XLSX.utils.book_append_sheet(wb, ws, "원생등록양식");
      window.XLSX.writeFile(wb, "JNC_원생등록_예시.xlsx");
      showToast("예제 파일이 다운로드되었습니다.", "success");
    } catch (e) {
      console.error(e);
      showToast("오류 발생", "error");
    }
  };

  const handleExcelUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (typeof window.XLSX === "undefined") {
      showToast("엑셀 라이브러리 로딩 중입니다.", "error");
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

          const daysStr = String(row[4] || "");
          const classDays = daysStr
            .split(",")
            .map((d) => d.trim())
            .filter((d) => d);
          const className = classDays[0] || "";
          const schedules = {};
          classDays.forEach((d) => (schedules[d] = String(row[7] || "")));

          const studentData = {
            name: String(row[0] || ""),
            grade: String(row[1] || ""),
            phone: String(row[2] || ""),
            teacher: String(row[3] || ""),
            className: className,
            classDays: classDays,
            schedules: schedules,
            tuitionFee: parseInt(row[5] || 0),
            subject: String(row[6] || ""),
            time: String(row[7] || ""),
            registrationDate: String(
              row[8] || new Date().toISOString().split("T")[0]
            ),
            status: "재원",
            lastPaymentDate: new Date().toISOString().split("T")[0],
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

  const handleBackupData = async () => {
    try {
      showToast("백업 중...", "info");
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
      showToast("백업 완료.", "success");
    } catch (e) {
      console.error(e);
      showToast("백업 오류", "error");
    }
  };

  const handleRestoreData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!window.confirm("주의: 현재 데이터를 덮어씁니다. 복구하시겠습니까?")) {
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
              if (id)
                await setDoc(
                  doc(db, "artifacts", APP_ID, "public", "data", colName, id),
                  data
                );
              else await addDoc(colRef, data);
              restoreCount++;
            }
          }
        }
        showToast(`복구 완료 (${restoreCount}건)`, "success");
      } catch (err) {
        console.error(err);
        showToast("복구 오류", "error");
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  // 결제 링크 URL 저장
  const handleSavePaymentUrl = async () => {
    try {
      await setDoc(
        doc(db, "artifacts", APP_ID, "public", "data", "settings", "messaging"),
        { paymentUrl: paymentUrlInput.trim() },
        { merge: true }
      );
      showToast("결제 링크가 저장되었습니다.", "success");
    } catch (e) {
      showToast("저장 오류: " + e.message, "error");
    }
  };

  // --- [화면 렌더링] ---
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 h-full overflow-auto animate-fade-in">
      {/* 강사 수정 모달 (여기에 비밀번호 수정 기능 포함) */}
      {editingTeacher && (
        <EditTeacherModal
          teacher={editingTeacher}
          students={students}
          teacherParts={TEACHER_PARTS}
          onClose={() => setEditingTeacher(null)}
          onSave={handleUpdateTeacher}
        />
      )}

      {/* 1. 상단 유틸리티 (백업/엑셀) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="p-6 bg-indigo-50 rounded-xl border border-indigo-100">
          <h3 className="font-bold text-indigo-900 mb-4 flex items-center">
            <HardDrive className="mr-2" size={20} /> 데이터 백업 및 복구
          </h3>
          <div className="flex gap-3">
            <button
              onClick={handleBackupData}
              className="flex-1 inline-flex justify-center items-center px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-sm transition-colors text-sm"
            >
              <Download size={16} className="mr-2" /> 백업(저장)
            </button>
            <label className="flex-1 inline-flex justify-center items-center px-4 py-2 bg-white border border-indigo-300 text-indigo-700 rounded-lg cursor-pointer hover:bg-indigo-50 font-bold shadow-sm transition-colors text-sm">
              <RefreshCcw size={16} className="mr-2" /> 복구(로드)
              <input
                type="file"
                accept=".json"
                onChange={handleRestoreData}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <div className="p-6 bg-emerald-50 rounded-xl border border-emerald-100">
          <h3 className="font-bold text-emerald-900 mb-4 flex items-center">
            <File className="mr-2" size={20} /> 원생 일괄 업로드
          </h3>
          <div className="flex gap-3">
            <button
              onClick={handleDownloadTemplate}
              className="flex-1 inline-flex justify-center items-center px-4 py-2 bg-white border border-emerald-300 text-emerald-700 rounded-lg hover:bg-emerald-50 font-bold shadow-sm transition-colors text-sm"
            >
              <Download size={16} className="mr-2" /> 양식 다운
            </button>
            <label
              className={`flex-1 inline-flex justify-center items-center px-4 py-2 bg-emerald-600 text-white rounded-lg cursor-pointer hover:bg-emerald-700 font-bold shadow-sm transition-colors text-sm ${
                uploading ? "opacity-50" : ""
              }`}
            >
              {uploading ? (
                "업로드 중..."
              ) : (
                <>
                  <Upload size={16} className="mr-2" /> 엑셀 선택
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

        {/* 비교용 내보내기 카드 */}
        <div className="p-6 bg-sky-50 rounded-xl border border-sky-100">
          <h3 className="font-bold text-sky-900 mb-1 flex items-center">
            <Download className="mr-2" size={20} /> 데이터 비교용 내보내기
          </h3>
          <p className="text-xs text-sky-700 mb-3">
            현재 대시보드 원생 데이터를 엑셀로 추출합니다.<br />
            기존 엑셀 파일과 나란히 놓고 차이를 확인하세요.
          </p>
          <button
            onClick={handleExportForComparison}
            className="w-full inline-flex justify-center items-center px-4 py-2 bg-sky-500 text-white rounded-lg hover:bg-sky-600 font-bold shadow-sm transition-colors text-sm"
          >
            <Download size={16} className="mr-2" /> 엑셀로 내보내기
          </button>
        </div>
      </div>

      <div className="border-t border-slate-200 my-6"></div>

      {/* 1-1. 관리자 비밀번호 변경 */}
      <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <h4 className="font-bold text-slate-700 text-sm mb-3">🔐 관리자 비밀번호 변경</h4>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="password"
            value={newAdminPw}
            onChange={(e) => setNewAdminPw(e.target.value)}
            placeholder="새 비밀번호"
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="password"
            value={confirmAdminPw}
            onChange={(e) => setConfirmAdminPw(e.target.value)}
            placeholder="비밀번호 확인"
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={handleChangeAdminPassword}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 transition-colors"
          >
            변경
          </button>
        </div>
      </div>

      <div className="border-t border-slate-200 my-6"></div>

      {/* 2. 강사 관리 섹션 */}
      <div className="mb-8">
        <h3 className="font-bold text-slate-800 flex items-center mb-4 text-lg">
          <Settings className="mr-2 text-indigo-600" size={22} /> 강사 관리
        </h3>

        {/* 강사 추가 폼 */}
        <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">
                강사 이름
              </label>
              <input
                value={newTeacherName}
                onChange={(e) => setNewTeacherName(e.target.value)}
                placeholder="이름"
                className="w-full p-2.5 border rounded-xl focus:outline-indigo-600 bg-white"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">
                비밀번호
              </label>
              <input
                value={newTeacherPassword}
                onChange={(e) => setNewTeacherPassword(e.target.value)}
                placeholder="초기 비밀번호"
                type="text"
                className="w-full p-2.5 border rounded-xl focus:outline-indigo-600 bg-white"
              />
            </div>

            <div className="md:col-span-4">
              <label className="block text-xs font-bold text-slate-500 mb-1.5 ml-1">
                담당 과목
                {isDirectInput && (
                  <span
                    onClick={() => {
                      setIsDirectInput(false);
                      setNewTeacherPart("피아노");
                    }}
                    className="ml-2 text-[10px] text-indigo-500 hover:underline cursor-pointer"
                  >
                    (목록 선택)
                  </span>
                )}
              </label>

              {isDirectInput ? (
                <input
                  value={newTeacherPart}
                  onChange={(e) => setNewTeacherPart(e.target.value)}
                  className="w-full p-2.5 border rounded-xl focus:outline-indigo-600 bg-white text-indigo-700 font-bold"
                  placeholder="직접 입력"
                />
              ) : (
                <select
                  value={newTeacherPart}
                  onChange={(e) => {
                    if (e.target.value === "DIRECT_INPUT") {
                      setIsDirectInput(true);
                      setNewTeacherPart("");
                    } else {
                      setNewTeacherPart(e.target.value);
                    }
                  }}
                  className="w-full p-2.5 border rounded-xl focus:outline-indigo-600 bg-white font-bold text-slate-700"
                >
                  {TEACHER_PARTS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                  <option value="DIRECT_INPUT">✨ 직접 입력</option>
                </select>
              )}
            </div>

            <div className="md:col-span-2 flex items-end">
              <button
                onClick={handleAddTeacher}
                className="w-full bg-indigo-600 text-white p-2.5 rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-md"
              >
                추가
              </button>
            </div>
          </div>

          <div className="mb-2">
            <label className="block text-xs font-bold text-slate-500 mb-2 ml-1">
              수업 요일 선택
            </label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => (
                <button
                  key={day.id}
                  onClick={() => toggleDay(day.id)}
                  className={`w-9 h-9 rounded-full text-xs font-bold transition-all border ${
                    newTeacherDays.includes(day.id)
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                      : "bg-white border-slate-200 text-slate-400 hover:border-indigo-300"
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 3. 강사 리스트 표시 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {teachers.map((t) => (
            <div
              key={t.id}
              onClick={() => setEditingTeacher(t)}
              className="bg-white p-4 border rounded-xl flex flex-col justify-between shadow-sm cursor-pointer hover:border-indigo-500 hover:shadow-md transition-all group relative overflow-hidden"
            >
              {/* 파트 뱃지 */}
              <div className="absolute top-0 right-0 px-3 py-1 rounded-bl-xl text-[10px] font-bold bg-slate-100 text-slate-600 border-l border-b border-slate-200">
                {t.part || "미지정"}
              </div>

              <div className="flex flex-col gap-2 mb-3">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg text-slate-800">
                    {t.name} T
                  </span>
                </div>
                {/* 비밀번호 표시 박스 */}
                <div className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1.5 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500">
                    🔑 비밀번호
                  </span>
                  <span className="text-sm font-mono font-bold text-indigo-600">
                    {t.password || (
                      <span className="text-slate-300 font-normal italic">
                        없음
                      </span>
                    )}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {t.days && t.days.length > 0 ? (
                  t.days.map((d) => (
                    <span
                      key={d}
                      className="text-[10px] bg-white border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded shadow-sm"
                    >
                      {DAYS_OF_WEEK.find((day) => day.id === d)?.label}
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] text-slate-300">요일 미정</span>
                )}
              </div>

              <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => handleDeleteTeacher(t.id, e)}
                  className="text-rose-400 hover:text-rose-600 p-1 hover:bg-rose-50 rounded"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 결제 링크 설정 (결제선생 등 외부 결제 URL) */}
      <div className="mt-8 p-6 bg-emerald-50 rounded-xl border border-emerald-100">
        <h3 className="font-bold text-emerald-900 mb-1 flex items-center">
          <CreditCard className="mr-2" size={18} /> 결제 링크 설정
        </h3>
        <p className="text-xs text-emerald-700 mb-4">
          결제선생 등 온라인 결제 링크를 저장하면 안내 메시지에 자동으로 삽입됩니다.
        </p>
        <div className="flex gap-2">
          <input
            type="url"
            value={paymentUrlInput}
            onChange={(e) => setPaymentUrlInput(e.target.value)}
            placeholder="https://결제선생.com/..."
            className="flex-1 p-3 border rounded-xl bg-white focus:outline-emerald-500 text-sm"
          />
          <button
            onClick={handleSavePaymentUrl}
            className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 shadow-sm text-sm"
          >
            저장
          </button>
        </div>
        {paymentUrlInput && (
          <p className="text-xs text-emerald-600 mt-2">
            현재 저장된 링크: <span className="font-mono break-all">{paymentUrlInput}</span>
          </p>
        )}
      </div>

      {/* 데이터 없음 안내 */}
      {teachers.length === 0 && (
        <div className="text-center mt-10 p-10 border-2 border-dashed border-slate-200 rounded-xl">
          <p className="text-slate-400 mb-4">등록된 강사가 없습니다.</p>
          <button
            onClick={seedData}
            className="text-indigo-500 hover:text-indigo-700 font-bold underline text-sm"
          >
            초기 샘플 데이터 복구하기
          </button>
        </div>
      )}
    </div>
  );
};
// [EditTeacherModal] - 강사 정보 수정 (비밀번호 + 파트 + 요일)
const EditTeacherModal = ({
  teacher,
  students,
  teacherParts,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState(teacher.name);
  const [password, setPassword] = useState(teacher.password || ""); // 기존 비밀번호 불러오기

  const isPredefined = teacherParts.some((p) => p.id === teacher.part);
  const [part, setPart] = useState(teacher.part || "피아노");
  const [isDirectInput, setIsDirectInput] = useState(
    !isPredefined && !!teacher.part
  );
  const [days, setDays] = useState(teacher.days || []);

  const DAYS_OF_WEEK = [
    { id: "월", label: "월" },
    { id: "화", label: "화" },
    { id: "수", label: "수" },
    { id: "목", label: "목" },
    { id: "금", label: "금" },
    { id: "토", label: "토" },
    { id: "일", label: "일" },
  ];

  const toggleDay = (dayId) => {
    if (days.includes(dayId)) setDays(days.filter((d) => d !== dayId));
    else setDays([...days, dayId]);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[120] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold mb-6 text-slate-800 flex items-center">
          <Settings className="mr-2 text-indigo-600" size={20} /> 강사 정보 수정
        </h3>

        <div className="space-y-4">
          {/* 이름 */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">
              이름
            </label>
            <input
              className="w-full p-3 border rounded-xl bg-slate-50 focus:outline-indigo-600"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* 비밀번호 수정 */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">
              비밀번호 관리
            </label>
            <div className="relative">
              <input
                className="w-full p-3 border rounded-xl bg-slate-50 focus:outline-indigo-600 font-mono text-indigo-700 font-bold"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호 입력"
              />
              <span className="absolute right-3 top-3.5 text-xs text-slate-400">
                변경 가능
              </span>
            </div>
          </div>

          {/* 파트 수정 */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">
              담당 과목
              {isDirectInput && (
                <span
                  onClick={() => {
                    setIsDirectInput(false);
                    setPart("피아노");
                  }}
                  className="ml-2 text-[10px] text-indigo-500 hover:underline cursor-pointer"
                >
                  (목록 선택)
                </span>
              )}
            </label>
            {isDirectInput ? (
              <input
                value={part}
                onChange={(e) => setPart(e.target.value)}
                className="w-full p-3 border rounded-xl bg-slate-50 focus:outline-indigo-600 font-bold text-indigo-700"
                placeholder="직접 입력"
              />
            ) : (
              <select
                className="w-full p-3 border rounded-xl bg-slate-50 focus:outline-indigo-600 font-bold"
                value={part}
                onChange={(e) => {
                  if (e.target.value === "DIRECT_INPUT") {
                    setIsDirectInput(true);
                    setPart("");
                  } else {
                    setPart(e.target.value);
                  }
                }}
              >
                {teacherParts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
                <option value="DIRECT_INPUT">✨ 직접 입력</option>
              </select>
            )}
          </div>

          {/* 요일 수정 */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2">
              출근 요일
            </label>
            <div className="flex flex-wrap gap-2">
              {DAYS_OF_WEEK.map((day) => (
                <button
                  key={day.id}
                  onClick={() => toggleDay(day.id)}
                  className={`w-8 h-8 rounded-full text-xs font-bold transition-all border ${
                    days.includes(day.id)
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-slate-400 border-slate-200"
                  }`}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-8">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-slate-500 hover:bg-slate-100 rounded-lg font-bold"
          >
            취소
          </button>
          <button
            onClick={() => {
              // 수정된 모든 정보(비밀번호 포함) 저장
              onSave(teacher.id, {
                name,
                password,
                part,
                days,
                oldName: teacher.name,
              });
              onClose();
            }}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 shadow-md"
          >
            저장하기
          </button>
        </div>
      </div>
    </div>
  );
};

// [Helper: ReasonInputModal]
const ReasonInputModal = ({ student, status, onClose, onSave }) => {
  const [reason, setReason] = useState("");
  return (
    <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
        <h3 className="text-lg font-bold mb-4">
          {status === "absent" ? "결석" : "취소"} 사유 입력
        </h3>
        <textarea
          className="w-full border rounded-lg p-3 h-24 mb-4 resize-none focus:outline-indigo-500"
          placeholder="사유를 입력하세요 (선택)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          autoFocus
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg"
          >
            취소
          </button>
          <button
            onClick={() => onSave(reason)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700"
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
};

// [Helper: AttendanceActionModal]
const MEMO_PRESETS = ["결제 요청", "보강 예정", "연락 바람", "다음 수업 확인"];
const AttendanceActionModal = ({ student, date, onClose, onSelectStatus, currentRecord }) => {
  const [memo, setMemo] = React.useState(currentRecord?.memo || "");
  const isPresent = currentRecord?.status === "present";
  const isDouble = isPresent && (currentRecord.count || 1) === 2;
  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-xs p-4 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold text-center mb-4">
          {student.name} - {date}
        </h3>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onSelectStatus("present", memo)}
            className="w-full py-3 bg-emerald-100 text-emerald-700 rounded-lg font-bold hover:bg-emerald-200"
          >
            출석 처리
          </button>
          {isPresent && (
            <button
              onClick={() => onSelectStatus("double", memo)}
              className={`w-full py-3 rounded-lg font-bold transition-colors ${
                isDouble
                  ? "bg-violet-200 text-violet-800 hover:bg-violet-300"
                  : "bg-violet-50 text-violet-600 hover:bg-violet-100"
              }`}
            >
              {isDouble ? "✦ 연강(2회) — 클릭 시 해제" : "연강 추가 (+1회)"}
            </button>
          )}
          <button
            onClick={() => onSelectStatus("absent", memo)}
            className="w-full py-3 bg-rose-100 text-rose-700 rounded-lg font-bold hover:bg-rose-200"
          >
            결석 처리
          </button>
          <button
            onClick={() => onSelectStatus("canceled", memo)}
            className="w-full py-3 bg-slate-100 text-slate-700 rounded-lg font-bold hover:bg-slate-200"
          >
            당일 취소
          </button>
          {/* 메모 입력 */}
          <div className="border-t pt-2 mt-1">
            <p className="text-xs text-slate-400 mb-1.5 font-medium">메모 (선택)</p>
            <div className="flex flex-wrap gap-1 mb-2">
              {MEMO_PRESETS.map((p) => (
                <button
                  key={p}
                  onClick={() => setMemo(memo === p ? "" : p)}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${
                    memo === p
                      ? "bg-amber-100 border-amber-300 text-amber-800 font-bold"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-amber-50 hover:border-amber-200"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
            <input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="직접 입력..."
              className="w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-amber-400"
            />
          </div>
          <div className="border-t my-1"></div>
          <button
            onClick={() => onSelectStatus("delete", "")}
            className="w-full py-3 text-slate-400 hover:text-rose-500 font-medium flex items-center justify-center gap-2"
          >
            <Trash2 size={16} /> 기록 삭제
          </button>
        </div>
      </div>
    </div>
  );
};

// [Helper: DateDetailModal]
const DateDetailModal = ({ date, students, onClose, onStudentClick }) => (
  <div
    className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
    onClick={onClose}
  >
    <div
      className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 max-h-[80vh] flex flex-col"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold">{date} 상세 일정</h3>
        <button onClick={onClose}>
          <X className="text-slate-400" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2">
        {students.length > 0 ? (
          students.map((s) => {
            const record = s.attendanceHistory?.find((h) => h.date === date);
            return (
              <div
                key={s.id}
                onClick={() => {
                  onStudentClick(s, date);
                }}
                className="flex justify-between items-center p-3 border rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                <div>
                  <span className="font-bold">{s.name}</span>{" "}
                  <span className="text-xs text-slate-500">({s.teacher})</span>
                </div>
                {record ? (
                  <span
                    className={`text-xs px-2 py-1 rounded font-bold ${
                      record.status === "present"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {record.status === "present" ? "출석" : "결석"}
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">미처리</span>
                )}
              </div>
            );
          })
        ) : (
          <p className="text-center text-slate-400 py-4">일정이 없습니다.</p>
        )}
      </div>
    </div>
  </div>
);
// [New Component] 초기 데이터 구축용: 원생별 달력 콕콕 (Fast Attendance Clicker)
const FastAttendanceModal = ({ student, onClose, onSave }) => {
  // 현재 월 기준 3개월 전부터 표시 (4개월치 보여줌) - new Date(y, m, 1)로 overflow 방지
  const nowAtt = new Date();
  const initBase = new Date(nowAtt.getFullYear(), nowAtt.getMonth() - 3, 1);
  const [baseDate, setBaseDate] = useState(initBase);
  // 로컬 상태로 출석 기록 관리 (저장 전까지 DB 안 건드림)
  const [tempHistory, setTempHistory] = useState(
    student.attendanceHistory || []
  );

  // 달력 생성 헬퍼 (4개월치 표시)
  const renderCalendarMonth = (year, month) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    // 학생의 수업 요일 인덱스 — schedules 객체 기준 (시간표 변경 시 즉시 반영)
    const DAY_IDX = ["일", "월", "화", "수", "목", "금", "토"];
    const targetDays = Object.keys(student.schedules || {}).map((d) =>
      DAY_IDX.indexOf(d)
    ).filter((i) => i >= 0);
    // 구버전 호환 (schedules 없는 레거시 데이터)
    if (targetDays.length === 0 && student.classDays) {
      (student.classDays || []).forEach((d) => {
        const i = DAY_IDX.indexOf(d);
        if (i >= 0) targetDays.push(i);
      });
    }
    if (targetDays.length === 0 && student.className) {
      const i = DAY_IDX.indexOf(student.className);
      if (i >= 0) targetDays.push(i);
    }

    return (
      <div key={`${year}-${month}`} className="border rounded-lg p-2 bg-white">
        <div className="text-center font-bold text-slate-700 mb-2 bg-slate-50 rounded py-1">
          {year}년 {month + 1}월
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
            <div key={d} className="text-[10px] text-slate-400">
              {d}
            </div>
          ))}
          {days.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`}></div>;

            const dateStr = `${year}-${String(month + 1).padStart(
              2,
              "0"
            )}-${String(day).padStart(2, "0")}`;
            const attRecord = tempHistory.find((h) => h.date === dateStr && h.status === "present");
            const isPresent = !!attRecord;
            const isDouble = isPresent && (attRecord.count || 1) === 2;
            const dayOfWeek = idx % 7;
            const isClassDay = targetDays.includes(dayOfWeek);

            return (
              <div
                key={day}
                onClick={() => toggleDate(dateStr)}
                className={`
                  aspect-square flex items-center justify-center rounded-full text-xs cursor-pointer select-none transition-all relative
                  ${
                    isDouble
                      ? "bg-indigo-800 text-white font-bold shadow-md transform scale-110"
                      : isPresent
                      ? "bg-indigo-600 text-white font-bold shadow-md transform scale-110"
                      : isClassDay
                      ? "bg-indigo-50 text-indigo-400 hover:bg-indigo-200 border border-indigo-100"
                      : "text-slate-300 hover:bg-slate-100"
                  }
                `}
                title={isDouble ? "연강(2회) — 클릭 시 제거" : isPresent ? "출석(1회) — 클릭 시 연강" : "클릭: 출석"}
              >
                {day}
                {isDouble && (
                  <span className="absolute -top-1 -right-1 bg-amber-400 text-white text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center leading-none">×2</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };
  const toggleDate = (dateStr) => {
    const exists = tempHistory.find((h) => h.date === dateStr);
    if (!exists) {
      // 없음 → 출석 1회
      setTempHistory([...tempHistory, { date: dateStr, status: "present", count: 1, reason: "초기입력", timestamp: new Date().toISOString() }]);
    } else if ((exists.count || 1) === 1) {
      // 1회 → 연강 2회
      setTempHistory(tempHistory.map((h) => h.date === dateStr ? { ...h, count: 2 } : h));
    } else {
      // 2회 → 제거
      setTempHistory(tempHistory.filter((h) => h.date !== dateStr));
    }
  };

  const handleSave = () => {
    // 날짜순 정렬
    const sorted = [...tempHistory].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    onSave(student.id, sorted);
  };

  // 4개월치 렌더링 (new Date(y, m, 1)로 overflow 방지)
  const calendars = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 1);
    calendars.push(renderCalendarMonth(d.getFullYear(), d.getMonth()));
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-6 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center">
              <CheckCircle className="text-indigo-600 mr-2" /> {student.name}{" "}
              출석 콕콕 입력
            </h2>
            <p className="text-sm text-slate-500">
              수업 요일은{" "}
              <span className="bg-indigo-50 text-indigo-500 px-1 rounded">
                연한 색
              </span>
              으로 표시됩니다. 클릭하여 출석을 체크하세요.
            </p>
          </div>
          <button onClick={onClose}>
            <X size={24} className="text-slate-400 hover:text-slate-600" />
          </button>
        </div>

        {/* 캘린더 그리드 */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {calendars}
          </div>

          {/* 달 이동 버튼 */}
          <div className="flex justify-center gap-4 mt-6">
            <button
              onClick={() => {
                setBaseDate(new Date(baseDate.getFullYear(), baseDate.getMonth() - 1, 1));
              }}
              className="px-4 py-2 bg-white border rounded-lg hover:bg-slate-50 text-sm font-bold shadow-sm"
            >
              ◀ 이전 달
            </button>
            <button
              onClick={() => {
                setBaseDate(new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1));
              }}
              className="px-4 py-2 bg-white border rounded-lg hover:bg-slate-50 text-sm font-bold shadow-sm"
            >
              다음 달 ▶
            </button>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-3 pt-4 border-t">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg text-slate-500 hover:bg-slate-100 font-bold"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2.5 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-md flex items-center"
          >
            <CheckCircle size={18} className="mr-2" />
            {tempHistory.length}건 저장하기
          </button>
        </div>
      </div>
    </div>
  );
};
// [New Component] 초기 데이터 구축용: 원생별 수납 콕콕 (Fast Payment Clicker)
const FastPaymentModal = ({ student, onClose, onSave }) => {
  // 현재 월 기준 1개월 전부터 표시 (4개월치: 지난달·이번달·다음달·다다음달)
  // new Date(year, month, 1)로 항상 1일 고정 → setMonth overflow 방지
  const now = new Date();
  const initBaseP2 = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const [baseDate, setBaseDate] = useState(initBaseP2);
  // 기본 원비 세팅
  const [defaultAmount, setDefaultAmount] = useState(student.tuitionFee || 0);

  // 로컬 상태로 결제 기록 관리
  const [tempHistory, setTempHistory] = useState(student.paymentHistory || []);

  const renderCalendarMonth = (year, month) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    return (
      <div
        key={`${year}-${month}`}
        className="border rounded-lg p-2 bg-white shadow-sm"
      >
        <div className="text-center font-bold text-slate-700 mb-2 bg-slate-50 rounded py-1 border border-slate-100">
          {year}년 {month + 1}월
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {["일", "월", "화", "수", "목", "금", "토"].map((d) => (
            <div key={d} className="text-[10px] text-slate-400">
              {d}
            </div>
          ))}
          {days.map((day, idx) => {
            if (!day) return <div key={`empty-${idx}`}></div>;

            const dateStr = `${year}-${String(month + 1).padStart(
              2,
              "0"
            )}-${String(day).padStart(2, "0")}`;
            // 해당 날짜에 결제 내역이 있는지 확인
            const paymentItem = tempHistory.find((h) => h.date === dateStr);
            const isPaid = !!paymentItem;

            return (
              <div
                key={day}
                onClick={() => toggleDate(dateStr)}
                className={`
                  aspect-square flex items-center justify-center rounded-lg text-xs cursor-pointer select-none transition-all border
                  ${
                    isPaid
                      ? "bg-indigo-600 text-white font-bold border-indigo-700 shadow-md transform scale-105"
                      : "bg-white text-slate-500 border-slate-100 hover:border-indigo-300 hover:bg-indigo-50"
                  }
                `}
              >
                {day}
                {isPaid && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const toggleDate = (dateStr) => {
    const exists = tempHistory.find((h) => h.date === dateStr);
    if (exists) {
      // 이미 있으면 삭제 (토글)
      if (window.confirm(`${dateStr} 결제 기록을 취소하시겠습니까?`)) {
        setTempHistory(tempHistory.filter((h) => h.date !== dateStr));
      }
    } else {
      // 없으면 추가
      setTempHistory([
        ...tempHistory,
        {
          date: dateStr,
          amount: parseInt(defaultAmount), // 설정된 금액으로 저장
          type: "tuition",
          sessionStartDate: dateStr, // 초기 입력이므로 시작일=결제일 통일 (자동정산 로직이 처리)
          createdAt: new Date().toISOString(),
        },
      ]);
    }
  };

  const handleSave = () => {
    if (
      tempHistory.length === 0 &&
      (student.paymentHistory || []).length === 0
    ) {
      onClose();
      return;
    }
    // 날짜순 정렬 (과거 -> 미래)
    const sorted = [...tempHistory].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    onSave(student.id, sorted);
  };

  // 4개월치 렌더링 (new Date(y, m, 1)로 overflow 방지)
  const calendars = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 1);
    calendars.push(renderCalendarMonth(d.getFullYear(), d.getMonth()));
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-6 flex flex-col max-h-[90vh]">
        <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 flex items-center">
              <CreditCard className="text-indigo-600 mr-2" /> {student.name}{" "}
              수납 콕콕 입력
            </h2>
            <p className="text-sm text-slate-500">
              결제일(입금일)을 클릭하면 아래 금액으로 등록됩니다.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-indigo-50 p-2 rounded-lg border border-indigo-100">
            <span className="text-xs font-bold text-indigo-800">
              건당 결제액:
            </span>
            <input
              type="number"
              value={defaultAmount}
              onChange={(e) => setDefaultAmount(e.target.value)}
              className="w-24 p-1 text-right font-bold border rounded text-indigo-700 focus:outline-indigo-500"
            />
            <span className="text-xs text-indigo-800">원</span>
          </div>
          <button onClick={onClose}>
            <X size={24} className="text-slate-400 hover:text-slate-600" />
          </button>
        </div>

        {/* 캘린더 그리드 */}
        <div className="flex-1 overflow-y-auto bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {calendars}
          </div>

          {/* 달 이동 버튼 */}
          <div className="flex justify-center gap-4 mt-6">
            <button
              onClick={() => {
                setBaseDate(new Date(baseDate.getFullYear(), baseDate.getMonth() - 1, 1));
              }}
              className="px-4 py-2 bg-white border rounded-lg hover:bg-slate-50 text-sm font-bold shadow-sm"
            >
              ◀ 이전 달
            </button>
            <button
              onClick={() => {
                setBaseDate(new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1));
              }}
              className="px-4 py-2 bg-white border rounded-lg hover:bg-slate-50 text-sm font-bold shadow-sm"
            >
              다음 달 ▶
            </button>
          </div>
        </div>

        <div className="mt-4 flex justify-end gap-3 pt-4 border-t">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg text-slate-500 hover:bg-slate-100 font-bold"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            className="px-6 py-2.5 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-md flex items-center"
          >
            <CheckCircle size={18} className="mr-2" />총 {tempHistory.length}건
            저장하기
          </button>
        </div>
      </div>
    </div>
  );
};
// [StudentModal] 통합 관리 모달 (정보수정 + 출석달력 + 수납달력)
const StudentModal = ({
  isOpen,
  onClose,
  student,
  teachers,
  onSave,
  onDelete,
}) => {
  const [activeTab, setActiveTab] = useState("info"); // info | attendance | payment

  // -- 공통 상태 -- (new Date(y, m, 1)로 overflow 방지)
  const nowSM = new Date();
  const [baseDate, setBaseDate] = useState(new Date(nowSM.getFullYear(), nowSM.getMonth() - 1, 1));

  // -- 1. 정보 수정 상태 --
  const [formData, setFormData] = useState({});
  const [isAdult, setIsAdult] = useState(false); // 성인 여부 추가
  const [schedule, setSchedule] = useState({}); // 요일별 스케줄 추가

  // -- 2. 출석 관리 상태 --
  const [attHistory, setAttHistory] = useState([]);

  // -- 3. 수납 관리 상태 --
  const [payHistory, setPayHistory] = useState([]);
  const [payAmount, setPayAmount] = useState(0);

  // 모달 열릴 때 데이터 초기화
  useEffect(() => {
    if (isOpen && student) {
      setFormData({
        ...student,
        schedules: student.schedules || {},
        weeklyFrequency:
          student.weeklyFrequency ||
          (Object.keys(student.schedules || {}).length >= 2 ? 2 : 1),
      });
      setAttHistory(student.attendanceHistory || []);
      setPayHistory(student.paymentHistory || []);
      setPayAmount(student.tuitionFee || 0);
      setSchedule(student.schedules || {}); // 스케줄 연동
      setIsAdult(student.grade === "성인"); // 성인 여부 연동
      setActiveTab("info");
    } else if (isOpen && !student) {
      // 신규 등록
      setFormData({
        name: "",
        grade: "",
        phone: "",
        teacher: teachers[0]?.name || "",
        status: "재원",
        registrationDate: new Date().toISOString().split("T")[0],
        tuitionFee: "",
        paymentDay: "1",
        schedules: {},
        subject: "", // 과목 초기화 추가
        school: "", // 학교 초기화 추가
        weeklyFrequency: 1, // 주 수업 빈도 기본값 (주1회)
      });
      setSchedule({});
      setIsAdult(false);
      setActiveTab("info");
    }
  }, [isOpen, student, teachers]);

  // 입력값 변경 핸들러
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // 스케줄 변경 핸들러
  const handleScheduleChange = (day, time) => {
    const newSchedule = { ...schedule };
    if (!time) {
      delete newSchedule[day];
    } else {
      newSchedule[day] = time;
    }
    setSchedule(newSchedule);
    // 요일 수에 따라 주 수업 빈도 자동 갱신 (2개 이상이면 주2회)
    const dayCount = Object.keys(newSchedule).length;
    setFormData((prev) => ({
      ...prev,
      weeklyFrequency: dayCount >= 2 ? 2 : 1,
    }));
  };

  // 🔥 [핵심] 저장 로직 (괄호 닫기 문제 해결 + 유효성 검사)
  const handleSaveWrapper = async () => {
    // 1. 필수값 체크 (전화번호 제외)
    if (
      !formData.name ||
      !formData.teacher ||
      !formData.subject ||
      !formData.tuitionFee
    ) {
      alert("이름, 담당 강사, 과목, 원비(수강료)를 모두 입력해주세요.");
      return;
    }

    const finalData = {
      ...formData,
      grade: isAdult ? "성인" : formData.grade,
      schedules: schedule, // 스케줄 포함
      attendanceHistory: attHistory,
      paymentHistory: payHistory,
      updatedAt: new Date().toISOString(),
    };

    // 증식 방지 로직
    const isNewRegistration = student && student.status === "pending";
    const targetId = isNewRegistration ? null : student?.id || null;

    onSave(targetId, finalData);
  }; // 👈 여기가 중요합니다! 함수를 닫아주세요.

  if (!isOpen) return null;

  // --- [Helper] 달력 렌더링 함수 ---
  const renderCalendar = (type) => {
    const calendars = [];
    for (let i = 0; i < 4; i++) {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDay = new Date(year, month, 1).getDay();

      const days = [];
      for (let k = 0; k < firstDay; k++) days.push(null);
      for (let k = 1; k <= daysInMonth; k++) days.push(k);

      calendars.push(
        <div
          key={`${year}-${month}`}
          className="border rounded-lg p-2 bg-white shadow-sm"
        >
          <div className="text-center font-bold text-slate-700 mb-2 bg-slate-50 rounded py-1">
            {year}년 {month + 1}월
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {["일", "월", "화", "수", "목", "금", "토"].map((day) => (
              <div key={day} className="text-[10px] text-slate-400">
                {day}
              </div>
            ))}
            {days.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`}></div>;
              const dateStr = `${year}-${String(month + 1).padStart(
                2,
                "0"
              )}-${String(day).padStart(2, "0")}`;
              let isSelected = false;
              if (type === "attendance") {
                isSelected = attHistory.some(
                  (h) => h.date === dateStr && h.status === "present"
                );
              } else {
                isSelected = payHistory.some((h) => h.date === dateStr);
              }
              return (
                <div
                  key={day}
                  className={`aspect-square flex items-center justify-center rounded-lg text-xs border
                    ${
                      isSelected
                        ? type === "attendance"
                          ? "bg-emerald-500 text-white font-bold border-emerald-600"
                          : "bg-indigo-600 text-white font-bold border-indigo-700"
                        : "bg-white text-slate-500 hover:bg-slate-100"
                    }`}
                >
                  {day}
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{calendars}</div>
    );
  };

  // --- UI 렌더링 ---
  return (
    <div className="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4 md:pl-64 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* 1. 헤더 영역 */}
        <div className="flex justify-between items-center p-6 border-b sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800">
            {student ? (
              <User size={24} className="text-indigo-600" />
            ) : (
              <UserPlus size={24} className="text-indigo-600" />
            )}
            {student ? "원생 정보 수정" : "신규 원생 등록"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500"
          >
            <X size={24} />
          </button>
        </div>

        {/* 2. 본문 영역 */}
        <div className="p-6 space-y-6">
          {/* (1) 기본 정보 입력 섹션 */}
          <section>
            <h3 className="text-sm font-bold text-slate-400 mb-4 flex items-center gap-2">
              <CheckCircle size={16} /> 기본 정보
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 이름 */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  이름 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <User
                    className="absolute left-3 top-2.5 text-slate-400"
                    size={16}
                  />
                  <input
                    name="name"
                    value={formData.name || ""}
                    onChange={handleChange}
                    className="w-full pl-10 p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                    placeholder="이름 입력"
                  />
                </div>
              </div>

              {/* 연락처 (선택 사항) */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  연락처
                </label>
                <div className="relative">
                  <Phone
                    className="absolute left-3 top-2.5 text-slate-400"
                    size={16}
                  />
                  <input
                    name="phone"
                    value={formData.phone || ""}
                    onChange={handleChange}
                    className="w-full pl-10 p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                    placeholder="010-0000-0000"
                  />
                </div>
              </div>

              {/* 담당 강사 */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  담당 강사 <span className="text-red-500">*</span>
                </label>
                <select
                  name="teacher"
                  value={formData.teacher || ""}
                  onChange={handleChange}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold bg-white"
                >
                  <option value="">선택해주세요</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name} 선생님
                    </option>
                  ))}
                </select>
              </div>

              {/* 상태 선택 */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  상태 (재원/휴원/퇴원)
                </label>
                <select
                  name="status"
                  value={formData.status || "재원"}
                  onChange={handleChange}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold bg-white"
                >
                  <option value="재원">🟢 재원</option>
                  <option value="휴원">🟡 휴원</option>
                  <option value="퇴원">🔴 퇴원</option>
                  <option value="pending">⏳ 상담대기</option>
                </select>
              </div>

              {/* 수강 과목 */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  수강 과목 <span className="text-red-500">*</span>
                </label>
                <select
                  name="subject"
                  value={formData.subject || ""}
                  onChange={handleChange}
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold bg-white"
                >
                  <option value="">과목 선택</option>
                  {[
                    "피아노",
                    "바이올린",
                    "플루트",
                    "첼로",
                    "성악",
                    "클라리넷",
                    "기타",
                    "드럼",
                    "작곡",
                  ].map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>

              {/* 원비 (수강료) */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  원비 (4주 기준) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <CreditCard
                    className="absolute left-3 top-2.5 text-slate-400"
                    size={16}
                  />
                  <input
                    name="tuitionFee"
                    type="number"
                    value={formData.tuitionFee || ""}
                    onChange={handleChange}
                    className="w-full pl-10 p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-mono font-bold text-right"
                    placeholder="금액 입력"
                  />
                  <span className="absolute right-3 top-2.5 text-xs text-slate-500">
                    원
                  </span>
                </div>
              </div>

              {/* 학교 / 학년 */}
              <div className="col-span-1 md:col-span-2 flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    학교 / 학년
                  </label>
                  <div className="flex gap-2">
                    <input
                      name="school"
                      value={formData.school || ""}
                      onChange={handleChange}
                      disabled={isAdult}
                      className="flex-1 p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-100"
                      placeholder="학교명"
                    />
                    <input
                      name="grade"
                      value={isAdult ? "성인" : formData.grade || ""}
                      onChange={handleChange}
                      disabled={isAdult}
                      className="w-20 p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none disabled:bg-slate-100 text-center"
                      placeholder="학년"
                    />
                  </div>
                </div>
                <div className="flex items-end pb-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isAdult}
                      onChange={(e) => setIsAdult(e.target.checked)}
                      className="w-4 h-4 accent-indigo-600 rounded"
                    />
                    <span className="text-sm font-bold text-slate-600">
                      성인 여부
                    </span>
                  </label>
                </div>
              </div>

              {/* 등록일 */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  등록일
                </label>
                <div className="relative">
                  <CalendarIcon
                    className="absolute left-3 top-2.5 text-slate-400"
                    size={16}
                  />
                  <input
                    type="date"
                    name="registrationDate"
                    value={formData.registrationDate || ""}
                    onChange={handleChange}
                    className="w-full pl-10 p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-600"
                  />
                </div>
              </div>

              {/* 원생 고유번호 */}
              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">
                  원생 고유번호(ID)
                </label>
                <input
                  value={student?.id || "신규 등록 자동 생성"}
                  disabled
                  className="w-full p-2 bg-slate-100 border rounded-lg text-slate-400 text-xs font-mono"
                />
              </div>
            </div>
          </section>

          <hr className="border-slate-100" />

          {/* (2) 요일별 등원 시간 설정 */}
          <section>
            <h3 className="text-sm font-bold text-slate-400 mb-4 flex items-center gap-2">
              <Clock size={16} /> 요일별 등원 시간
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {["월", "화", "수", "목", "금", "토", "일"].map((day) => (
                <div
                  key={day}
                  className="flex flex-col gap-1 p-2 bg-slate-50 rounded border"
                >
                  <span className="text-xs font-bold text-center text-slate-600 mb-1">
                    {day}요일
                  </span>
                  <input
                    type="time"
                    value={schedule[day] || ""}
                    onChange={(e) => handleScheduleChange(day, e.target.value)}
                    className="text-xs p-1 border rounded text-center focus:ring-1 focus:ring-indigo-500 outline-none"
                  />
                  {schedule[day] && (
                    <button
                      onClick={() => handleScheduleChange(day, "")}
                      className="text-[10px] text-red-400 hover:text-red-600 underline text-center"
                    >
                      지우기
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* 주 수업 빈도 선택 (요일 설정 시 자동 반영, 수동 조정 가능) */}
            <div className="mt-3">
              <label className="block text-xs font-bold text-slate-500 mb-2">
                주 수업 빈도
              </label>
              <div className="flex gap-2">
                {[1, 2].map((freq) => (
                  <button
                    key={freq}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, weeklyFrequency: freq }))
                    }
                    className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${
                      (formData.weeklyFrequency || 1) === freq
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                        : "bg-white text-slate-500 border-slate-300 hover:border-indigo-400"
                    }`}
                  >
                    주{freq}회
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                * 요일을 2개 이상 설정하면 자동으로 주2회로 변경됩니다.
              </p>
            </div>
          </section>

          {/* (3) 메모 */}
          <section>
            <h3 className="text-sm font-bold text-slate-400 mb-4 flex items-center gap-2">
              <StickyNote size={16} /> 특이사항 메모
            </h3>
            <textarea
              name="memo"
              value={formData.memo || ""}
              onChange={handleChange}
              rows={3}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-sm"
              placeholder="학습 진도, 학부모 요청사항 등..."
            />
          </section>
        </div>

        {/* 3. 하단 버튼 영역 */}
        <div className="p-6 border-t bg-slate-50 flex justify-end gap-3 sticky bottom-0 z-10">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-100 transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleSaveWrapper}
            className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition-all flex items-center gap-2"
          >
            <Save size={18} />
            {student ? "정보 수정 저장" : "신규 등록"}
          </button>
        </div>
      </div>
    </div>
  );
}; // 👈 이 괄호까지 완벽하게 있어야 합니다!

// =================================================================
// [KioskView] - 학원 입구 셀프 출석 체크인 단말기
// =================================================================
const KioskView = ({ students, onExitKiosk }) => {
  // 'search' → 전화번호 입력, 'results' → 일치 학생 선택, 'success' → 완료
  const [step, setStep] = useState("search");
  const [phoneInput, setPhoneInput] = useState(""); // 전화번호 뒤 4자리 검색어
  const [searchResults, setSearchResults] = useState([]); // 검색 결과
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [error, setError] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [exitClickCount, setExitClickCount] = useState(0);
  const [confetti, setConfetti] = useState([]);

  // 매초 시간 갱신
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 기분 좋은 도-미-솔-도 체임 사운드 (Web Audio API)
  const playSuccessSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = "sine";
        osc.frequency.value = freq;
        const start = ctx.currentTime + i * 0.17;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.35, start + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);
        osc.start(start);
        osc.stop(start + 0.5);
      });
    } catch (e) {}
  }, []);

  // 성공 후 3.5초 뒤 자동 초기화
  useEffect(() => {
    if (step === "success") {
      playSuccessSound();
      const colors = ["#6366f1","#f59e0b","#10b981","#ef4444","#3b82f6","#ec4899","#f97316"];
      const shapes = ["●","★","♪","♫","✦","▲","◆"];
      setConfetti(
        Array.from({ length: 40 }, (_, idx) => ({
          id: idx,
          left: Math.random() * 100,
          color: colors[idx % colors.length],
          shape: shapes[idx % shapes.length],
          duration: 2.2 + Math.random() * 1.5,
          delay: Math.random() * 0.8,
          size: 14 + Math.random() * 18,
        }))
      );
      const timer = setTimeout(() => {
        setStep("search");
        setPhoneInput("");
        setSearchResults([]);
        setSelectedStudent(null);
        setError("");
        setConfetti([]);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const toDateStr = (date) => date.toISOString().split("T")[0];
  const todayStr = toDateStr(currentTime);

  // 전화번호 뒤 4자리로 재원 학생 검색
  const handleSearch = useCallback((digits) => {
    if (digits.length < 4) {
      setSearchResults([]);
      return;
    }
    const matched = students.filter((s) => {
      if (s.status !== "재원") return false;
      const phone = (s.phone || "").replace(/[^0-9]/g, "");
      return phone.slice(-4) === digits;
    });
    setSearchResults(matched);
    setStep("results");
  }, [students]);

  const handleKeypad = (val) => {
    if (phoneInput.length >= 4) return;
    const next = phoneInput + val;
    setPhoneInput(next);
    if (next.length === 4) handleSearch(next);
  };

  const handleKeypadDelete = () => {
    const next = phoneInput.slice(0, -1);
    setPhoneInput(next);
    if (step === "results") {
      setStep("search");
      setSearchResults([]);
    }
  };

  const handleReset = () => {
    setStep("search");
    setPhoneInput("");
    setSearchResults([]);
    setError("");
  };

  // 학생 선택 즉시 출석 처리 (전화번호로 이미 본인 확인됨)
  const handleCheckIn = async (student) => {
    // 이미 오늘 출석한 경우
    const alreadyChecked = (student.attendanceHistory || []).some(
      (h) => h.date === todayStr && h.status === "present"
    );
    if (alreadyChecked) {
      setError(`${student.name} 님은 오늘 이미 출석 처리되었습니다.`);
      return;
    }

    try {
      setSelectedStudent(student);
      const studentRef = doc(
        db, "artifacts", APP_ID, "public", "data", "students", student.id
      );
      let history = [...(student.attendanceHistory || [])];
      const existingIdx = history.findIndex((h) => h.date === todayStr);
      const record = {
        date: todayStr,
        status: "present",
        count: 1,
        timestamp: new Date().toISOString(),
        checkedInByKiosk: true,
      };
      if (existingIdx > -1) history[existingIdx] = record;
      else history.push(record);

      const lastPay = student.lastPaymentDate || "0000-00-00";
      const sessionsCount = history.reduce((sum, h) => {
        if (h.date < lastPay) return sum;
        if (h.status === "present") return sum + (h.count || 1);
        if (h.status === "canceled") return sum + 1; // 당일취소는 학생 1회 차감 (강사 시수는 별도 0.5회 적용)
        return sum;
      }, 0);

      await updateDoc(studentRef, {
        attendanceHistory: history,
        sessionsCompleted: sessionsCount,
      });
      setStep("success");
    } catch (e) {
      console.error(e);
      setError("저장 중 오류가 발생했습니다. 선생님께 문의해주세요.");
    }
  };

  // 시간 표시 5회 클릭 → 관리자 모드 복귀
  const handleTimeClick = () => {
    const next = exitClickCount + 1;
    setExitClickCount(next);
    if (next >= 5) {
      setExitClickCount(0);
      onExitKiosk();
    }
  };

  const timeStr = currentTime.toLocaleTimeString("ko-KR", {
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const dateDisplayStr = currentTime.toLocaleDateString("ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "long",
  });

  // 공통 CSS 키프레임
  const kioskStyles = `
    @keyframes confetti-fall {
      0%   { transform: translateY(-30px) rotate(0deg);   opacity: 1; }
      80%  { opacity: 1; }
      100% { transform: translateY(105vh) rotate(900deg); opacity: 0; }
    }
    @keyframes pop-in {
      0%   { transform: scale(0) rotate(-15deg); opacity: 0; }
      60%  { transform: scale(1.2) rotate(5deg);  opacity: 1; }
      100% { transform: scale(1)   rotate(0deg);  opacity: 1; }
    }
    @keyframes pulse-glow {
      0%, 100% { box-shadow: 0 0 0 0 rgba(255,255,255,0.5); }
      50%       { box-shadow: 0 0 0 24px rgba(255,255,255,0); }
    }
  `;

  // ── 성공 화면 ──
  if (step === "success") {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-emerald-400 to-emerald-600 flex flex-col items-center justify-center z-50 overflow-hidden">
        <style>{kioskStyles}</style>
        {confetti.map((p) => (
          <div key={p.id} style={{
            position: "absolute", left: `${p.left}%`, top: "-30px",
            fontSize: `${p.size}px`, color: p.color,
            animation: `confetti-fall ${p.duration}s ${p.delay}s ease-in forwards`,
            pointerEvents: "none", userSelect: "none",
          }}>{p.shape}</div>
        ))}
        <div className="text-white text-center relative z-10">
          <div
            className="w-36 h-36 bg-white rounded-full flex items-center justify-center mx-auto mb-8"
            style={{ animation: "pop-in 0.5s cubic-bezier(0.34,1.56,0.64,1) both, pulse-glow 1.5s 0.5s ease-in-out infinite" }}
          >
            <span style={{ fontSize: "72px", lineHeight: 1 }}>✓</span>
          </div>
          <div className="text-5xl font-bold mb-3" style={{ animation: "pop-in 0.45s 0.15s both" }}>
            {selectedStudent.name} 님
          </div>
          <div className="text-3xl font-semibold opacity-95 mb-2" style={{ animation: "pop-in 0.45s 0.28s both" }}>
            출석이 완료되었습니다! 🎵
          </div>
          <div className="text-lg opacity-70 mt-4" style={{ animation: "pop-in 0.45s 0.4s both" }}>
            잠시 후 자동으로 돌아갑니다...
          </div>
        </div>
      </div>
    );
  }

  // ── 공통 레이아웃 래퍼 (검색 / 결과 화면 공유) ──
  return (
    <div className="fixed inset-0 bg-gradient-to-br from-slate-50 to-indigo-50 flex flex-col z-50">
      <style>{kioskStyles}</style>

      {/* 상단 시간 표시 (5회 클릭 → 관리자 복귀) */}
      <div className="bg-indigo-700 text-white text-center py-5 shadow-lg shrink-0">
        <button
          onClick={handleTimeClick}
          className="text-5xl font-bold tracking-widest mb-1 w-full focus:outline-none select-none"
        >
          {timeStr}
        </button>
        <div className="text-base opacity-75">{dateDisplayStr}</div>
      </div>

      <div className="flex-1 overflow-y-auto flex items-center justify-center p-5">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-center text-slate-800 mt-4 mb-1">
            JnC Music Academy
          </h1>
          <p className="text-center text-slate-500 mb-2 text-base font-medium">
            전화번호 뒤 4자리를 입력하세요
          </p>
          <p className="text-center text-slate-400 mb-4 text-sm">
            학생은 보호자 번호 · 성인은 본인 번호
          </p>

          {/* 핀 입력 표시 */}
          <div className="flex justify-center gap-3 mb-2">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`w-16 h-16 rounded-2xl border-2 flex items-center justify-center text-3xl font-bold transition-all ${
                  phoneInput.length > i
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 bg-white"
                }`}
              >
                {phoneInput.length > i ? "●" : ""}
              </div>
            ))}
          </div>

          {/* 에러 메시지 */}
          {error && (
            <p className="text-center text-red-500 text-sm font-medium mb-2">{error}</p>
          )}

          {/* 검색 결과 (results 단계) */}
          {step === "results" && (
            <div className="mb-4">
              {searchResults.length === 0 ? (
                <div className="text-center py-6 bg-white rounded-2xl border-2 border-slate-200">
                  <div className="text-3xl mb-2">😅</div>
                  <p className="text-slate-500 font-medium">일치하는 학생이 없습니다</p>
                  <p className="text-slate-400 text-sm mt-1">번호를 다시 확인해주세요</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-center text-slate-500 text-sm mb-3">
                    본인 이름을 선택하세요
                  </p>
                  {searchResults.map((student) => {
                    const todayRecord = (student.attendanceHistory || []).find(
                      (h) => h.date === todayStr && (h.status === "present" || h.status === "canceled")
                    );
                    const alreadyChecked = todayRecord?.status === "present";
                    const isCanceled = todayRecord?.status === "canceled";
                    return (
                      <button
                        key={student.id}
                        onClick={() => !alreadyChecked && !isCanceled && handleCheckIn(student)}
                        disabled={alreadyChecked || isCanceled}
                        className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all shadow-sm ${
                          alreadyChecked
                            ? "bg-emerald-50 border-emerald-200 cursor-not-allowed opacity-70"
                            : isCanceled
                            ? "bg-amber-50 border-amber-200 cursor-not-allowed opacity-70"
                            : "bg-white border-slate-200 hover:border-indigo-400 hover:shadow-md active:scale-95"
                        }`}
                      >
                        <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
                          <span className="text-xl font-bold text-indigo-600">
                            {student.name[0]}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="font-bold text-lg text-slate-800">
                            {student.name}
                          </div>
                          <div className="text-sm text-slate-500">
                            {student.teacher} 선생님
                          </div>
                        </div>
                        {alreadyChecked ? (
                          <div className="flex items-center gap-1 text-emerald-600 font-bold text-sm">
                            <span className="w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs">✓</span>
                            출석 완료
                          </div>
                        ) : isCanceled ? (
                          <div className="flex items-center gap-1 text-amber-600 font-bold text-sm">
                            <span className="w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center text-white text-xs">✕</span>
                            당일취소
                          </div>
                        ) : (
                          <div className="text-indigo-400 font-bold text-lg">→</div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* 숫자 키패드 */}
          <div className="grid grid-cols-3 gap-3 mb-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
              <button
                key={n}
                onClick={() => handleKeypad(String(n))}
                disabled={phoneInput.length >= 4}
                className="w-full py-4 bg-white border-2 border-slate-200 rounded-2xl text-2xl font-bold text-slate-700 hover:bg-indigo-50 hover:border-indigo-300 active:bg-indigo-100 disabled:opacity-40 transition-all shadow-sm"
              >
                {n}
              </button>
            ))}
            <button
              onClick={handleReset}
              className="w-full py-4 bg-slate-100 border-2 border-slate-200 rounded-2xl text-sm font-bold text-slate-500 hover:bg-slate-200 active:bg-slate-300 transition-all"
            >
              초기화
            </button>
            <button
              onClick={() => handleKeypad("0")}
              disabled={phoneInput.length >= 4}
              className="w-full py-4 bg-white border-2 border-slate-200 rounded-2xl text-2xl font-bold text-slate-700 hover:bg-indigo-50 hover:border-indigo-300 active:bg-indigo-100 disabled:opacity-40 transition-all shadow-sm"
            >
              0
            </button>
            <button
              onClick={handleKeypadDelete}
              className="w-full py-4 bg-slate-100 border-2 border-slate-200 rounded-2xl text-xl font-bold text-slate-600 hover:bg-slate-200 active:bg-slate-300 transition-all"
            >
              ←
            </button>
          </div>

          <p className="text-center text-slate-300 text-xs mt-4">
            문의: 선생님께 직접 말씀해주세요
          </p>
        </div>
      </div>
    </div>
  );
};

// [AttendanceView] - 1:1 레슨 맞춤형 (지각 삭제, 결석 사유, 당일취소 유형화 + 강사필터링 유지)
const AttendanceView = ({ students, showToast, user, teachers }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());

  // [기능 보존] 강사 필터링 상태 (관리자는 빈값=전체, 강사는 본인이름 고정)
  const [selectedTeacher, setSelectedTeacher] = useState(
    user.role === "teacher" ? user.name : ""
  );

  // 모달 상태 (결석 사유 or 당일취소 사유 입력용)
  const [modalConfig, setModalConfig] = useState(null); // { type: 'absent' | 'canceled', student: ... }
  // 메모 편집 상태
  const [memoEditId, setMemoEditId] = useState(null);
  const [memoInput, setMemoInput] = useState("");

  const getDayOfWeek = (date) =>
    ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  const formatDate = (date) => date.toISOString().split("T")[0];

  // [기능 보존] 오늘 수업 대상자 필터링 (강사 필터링 로직 포함)
  const todayStudents = useMemo(() => {
    const dayName = getDayOfWeek(selectedDate);
    return students
      .filter((s) => {
        // 1. 재원생 & 오늘 수업 여부
        const hasSchedule =
          s.status === "재원" && s.schedules && s.schedules[dayName];

        // 2. 강사 필터링 (Admin은 선택, Teacher는 본인만)
        const isTeacherMatch =
          user.role === "admin"
            ? selectedTeacher === "" || s.teacher === selectedTeacher
            : s.teacher === user.name;

        return hasSchedule && isTeacherMatch;
      })
      .sort((a, b) =>
        (a.schedules[dayName] || "00:00").localeCompare(
          b.schedules[dayName] || "00:00"
        )
      );
  }, [students, selectedDate, selectedTeacher, user]);

  // DB 업데이트 및 횟수 재계산 로직
  const saveAttendanceToDB = async (student, status, detail = "") => {
    const dateStr = formatDate(selectedDate);
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
      const existingIdx = history.findIndex((h) => h.date === dateStr);

      // 삭제 모드
      if (status === "delete") {
        if (existingIdx > -1) history.splice(existingIdx, 1);
      } else {
        // 추가/수정 모드 (기존 count 값 보존)
        const prevCount = existingIdx > -1 ? (history[existingIdx].count || 1) : 1;
        const record = {
          date: dateStr,
          status, // 'present', 'absent', 'canceled'
          timestamp: new Date().toISOString(),
        };

        // 출석일 때만 count 보존
        if (status === "present") record.count = prevCount;

        // 상세 사유 저장
        if (status === "absent") {
          record.reason = detail; // 결석 사유 (텍스트)
        } else if (status === "canceled") {
          record.subType = detail; // 당일취소 유형 (질병, 경조사, 기타)
        }

        // 기존 메모 보존
        if (existingIdx > -1 && history[existingIdx].memo) record.memo = history[existingIdx].memo;

        if (existingIdx > -1) history[existingIdx] = record;
        else history.push(record);
      }

      // [횟수 차감 로직] 1:1 레슨 룰 적용
      // 1. 출석(present): 차감 (+1)
      // 2. 결석(absent): 차감 안 함 (0) -> 보강 예정이므로
      // 3. 당일취소(canceled):
      //    - 질병(방역 등): 차감 안 함 (0)
      //    - 경조사/기타: 원칙적 차감 (+1) (학원 규정에 따라 수정 가능, 여기선 차감으로 설정)
      const lastPay = student.lastPaymentDate || "0000-00-00";
      const count = history.reduce((sum, h) => {
        if (h.date < lastPay) return sum; // 지난 결제일 이전 기록 무시
        if (h.status === "present") return sum + (h.count || 1); // 연강(count:2)은 2회 차감
        if (h.status === "canceled") return sum + 1; // 당일취소는 학생 1회 차감 (강사 시수는 별도 0.5회 적용)
        return sum; // absent는 차감 안함
      }, 0);

      await updateDoc(studentRef, {
        attendanceHistory: history,
        sessionsCompleted: count,
      });

      let msg = "";
      if (status === "delete") msg = "기록이 삭제되었습니다.";
      else if (status === "present") msg = `${student.name}님 출석 처리됨`;
      else if (status === "absent")
        msg = `${student.name}님 결석(보강대상) 처리됨`;
      else if (status === "canceled")
        msg = `${student.name}님 당일취소(${detail}) 처리됨`;

      showToast(msg);
      setModalConfig(null); // 모달 닫기
    } catch (e) {
      console.error(e);
      showToast("저장 실패", "error");
    }
  };

  // 메모 저장 (출석 기록에 memo 필드 업데이트 + 담당 강사 pendingMemos 전달)
  const saveMemo = async (student, memo) => {
    const dateStr = formatDate(selectedDate);
    const studentRef = doc(db, "artifacts", APP_ID, "public", "data", "students", student.id);
    const history = [...(student.attendanceHistory || [])];
    const idx = history.findIndex((h) => h.date === dateStr);
    if (idx === -1) return;
    history[idx] = { ...history[idx], memo };
    try {
      await updateDoc(studentRef, { attendanceHistory: history });

      // 담당 강사에게 메모 알림 전달 (관리자가 작성한 경우에만)
      if (memo && user.role === "admin" && student.teacher) {
        const targetTeacher = teachers.find((t) => t.name === student.teacher);
        if (targetTeacher) {
          const teacherRef = doc(db, "artifacts", APP_ID, "public", "data", "teachers", targetTeacher.id);
          const newNotice = {
            id: Date.now(),
            studentName: student.name,
            date: dateStr,
            memo,
            createdAt: new Date().toISOString(),
          };
          const existing = targetTeacher.pendingMemos || [];
          await updateDoc(teacherRef, { pendingMemos: [...existing, newNotice] });
        }
      }

      showToast(`${student.name}님 메모 저장됨`);
      setMemoEditId(null);
    } catch (e) {
      showToast("저장 실패", "error");
    }
  };

  // 버튼 클릭 핸들러 (분기 처리)
  // 같은 상태 버튼을 다시 누르면 기록 삭제(취소)
  const onActionClick = (student, action) => {
    const dateStr = formatDate(selectedDate);
    const record = (student.attendanceHistory || []).find((h) => h.date === dateStr);
    const currentStatus = record?.status;

    // 같은 버튼 재클릭 → 기록 삭제
    if (currentStatus === action) {
      saveAttendanceToDB(student, "delete");
      return;
    }

    if (action === "present") {
      saveAttendanceToDB(student, "present");
    } else if (action === "delete") {
      if (window.confirm("이 출석 기록을 삭제하시겠습니까?")) {
        saveAttendanceToDB(student, "delete");
      }
    } else {
      // 결석(absent)이나 당일취소(canceled)는 모달 띄우기
      setModalConfig({ type: action, student });
    }
  };

  // 연강 토글 (1회↔2회)
  const toggleDoubleLesson = async (student) => {
    const dateStr = formatDate(selectedDate);
    const studentRef = doc(db, "artifacts", APP_ID, "public", "data", "students", student.id);
    const history = [...(student.attendanceHistory || [])];
    const idx = history.findIndex((h) => h.date === dateStr && h.status === "present");
    if (idx === -1) return;
    const current = history[idx].count || 1;
    history[idx] = { ...history[idx], count: current === 1 ? 2 : 1 };
    const lastPay = student.lastPaymentDate || "0000-00-00";
    const sessionsCompleted = history.reduce((sum, h) => {
      if (h.date < lastPay) return sum;
      if (h.status === "present") return sum + (h.count || 1);
      if (h.status === "canceled") return sum + 1; // 당일취소는 학생 1회 차감 (강사 시수는 별도 0.5회 적용)
      return sum;
    }, 0);
    try {
      await updateDoc(studentRef, { attendanceHistory: history, sessionsCompleted });
      showToast(current === 1 ? `${student.name}님 연강(2회) 처리됨` : `${student.name}님 연강 해제(1회)`, "success");
    } catch (e) {
      showToast("저장 실패", "error");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-20">
      {/* 1. 입력 모달 (결석 사유 / 당일취소 유형) */}
      {modalConfig && (
        <AttendanceDetailModal
          config={modalConfig}
          onClose={() => setModalConfig(null)}
          onConfirm={(detail) =>
            saveAttendanceToDB(modalConfig.student, modalConfig.type, detail)
          }
        />
      )}

      {/* 2. 상단 컨트롤러 (날짜 + 강사필터) */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() - 1);
              setSelectedDate(d);
            }}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-500"
          >
            <ChevronLeft />
          </button>
          <div className="text-center">
            <h2 className="text-2xl font-bold text-slate-800">
              {selectedDate.toLocaleDateString()} ({getDayOfWeek(selectedDate)})
            </h2>
            <p className="text-sm text-indigo-600 font-medium">
              오늘 레슨 대상: {todayStudents.length}명
            </p>
          </div>
          <button
            onClick={() => {
              const d = new Date(selectedDate);
              d.setDate(d.getDate() + 1);
              setSelectedDate(d);
            }}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-500"
          >
            <ChevronRight />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* [기능 보존] 관리자용 강사 필터 */}
          {user.role === "admin" && (
            <select
              value={selectedTeacher}
              onChange={(e) => setSelectedTeacher(e.target.value)}
              className="px-3 py-2 border rounded-xl bg-slate-50 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">전체 강사 보기</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.name}>
                  {t.name} 선생님
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => setSelectedDate(new Date())}
            className="px-4 py-2 bg-slate-100 text-slate-600 font-bold rounded-xl text-sm hover:bg-slate-200 transition-colors"
          >
            오늘
          </button>
        </div>
      </div>

      {/* 3. 학생 리스트 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {todayStudents.length > 0 ? (
          todayStudents.map((s) => {
            const record = (s.attendanceHistory || []).find(
              (h) => h.date === formatDate(selectedDate)
            );
            const status = record?.status;
            // 상세 정보 (결석 사유 or 취소 유형)
            const detailInfo = record?.reason || record?.subType || "";

            return (
              <div
                key={s.id}
                className={`bg-white p-5 rounded-2xl border-2 transition-all ${
                  status === "present"
                    ? "border-emerald-500 bg-emerald-50/30"
                    : status === "canceled"
                    ? "border-rose-500 bg-rose-50/30"
                    : status === "absent"
                    ? "border-amber-500 bg-amber-50/30"
                    : "border-slate-100 shadow-sm"
                }`}
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg text-slate-800">
                        {s.name}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-bold">
                        {s.schedules[getDayOfWeek(selectedDate)]}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 font-medium">
                      {s.subject} · {s.teacher} 선생님
                    </p>
                  </div>
                  {status && (
                    <div className="text-right">
                      <span
                        className={`text-[10px] font-bold px-2 py-1 rounded-lg block w-fit ml-auto mb-1 ${
                          status === "present"
                            ? "bg-emerald-500 text-white"
                            : status === "canceled"
                            ? "bg-rose-500 text-white"
                            : "bg-amber-500 text-white"
                        }`}
                      >
                        {status === "present"
                          ? "출석완료"
                          : status === "canceled"
                          ? "당일취소"
                          : "결석"}
                      </span>
                      {detailInfo && (
                        <span className="text-[10px] text-slate-500 font-medium">
                          ({detailInfo})
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* 액션 버튼 그룹 */}
                <div className="grid grid-cols-4 gap-2">
                  <button
                    onClick={() => onActionClick(s, "present")}
                    className={`col-span-2 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1 transition-all ${
                      status === "present"
                        ? "bg-emerald-600 text-white shadow-lg shadow-emerald-200"
                        : "bg-slate-50 text-slate-400 hover:bg-emerald-50 hover:text-emerald-600 border border-slate-100"
                    }`}
                  >
                    <CheckCircle size={16} /> 출석
                  </button>
                  <button
                    onClick={() => onActionClick(s, "absent")}
                    className={`col-span-1 py-2.5 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-0.5 transition-all ${
                      status === "absent"
                        ? "bg-amber-500 text-white shadow-lg shadow-amber-200"
                        : "bg-slate-50 text-slate-400 hover:bg-amber-50 hover:text-amber-600 border border-slate-100"
                    }`}
                  >
                    <span>결석</span>
                  </button>
                  <button
                    onClick={() => onActionClick(s, "canceled")}
                    className={`col-span-1 py-2.5 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-0.5 transition-all ${
                      status === "canceled"
                        ? "bg-rose-500 text-white shadow-lg shadow-rose-200"
                        : "bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-600 border border-slate-100"
                    }`}
                  >
                    <span className="leading-tight">
                      당일
                      <br />
                      취소
                    </span>
                  </button>
                </div>
                {/* 연강 토글 버튼 (출석 완료 시에만 표시) */}
                {status === "present" && (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleDoubleLesson(s); }}
                    className={`w-full mt-2 py-2 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition-all border ${
                      (record?.count || 1) === 2
                        ? "bg-violet-100 text-violet-700 border-violet-300"
                        : "bg-slate-50 text-slate-400 hover:bg-violet-50 hover:text-violet-600 border-slate-200"
                    }`}
                  >
                    {(record?.count || 1) === 2 ? "✦ 연강 (2회) — 클릭 시 해제" : "연강 추가 (+1회)"}
                  </button>
                )}
                {/* 메모 영역 */}
                <div className="mt-2 border-t pt-2">
                  {memoEditId === s.id ? (
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap gap-1">
                        {MEMO_PRESETS.map((p) => (
                          <button
                            key={p}
                            onClick={() => setMemoInput(memoInput === p ? "" : p)}
                            className={`text-xs px-2 py-0.5 rounded border transition-colors ${
                              memoInput === p
                                ? "bg-amber-100 border-amber-300 text-amber-800 font-bold"
                                : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-amber-50"
                            }`}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-1">
                        <input
                          value={memoInput}
                          onChange={(e) => setMemoInput(e.target.value)}
                          placeholder="직접 입력..."
                          className="flex-1 border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-amber-400"
                        />
                        <button
                          onClick={() => saveMemo(s, memoInput)}
                          className="text-xs bg-amber-500 text-white px-2 py-1 rounded font-bold"
                        >
                          저장
                        </button>
                        <button
                          onClick={() => setMemoEditId(null)}
                          className="text-xs text-slate-400 px-1"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : record?.memo ? (
                    <button
                      onClick={() => { setMemoEditId(s.id); setMemoInput(record.memo); }}
                      className="w-full text-left text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200 hover:bg-amber-100 truncate"
                    >
                      📝 {record.memo}
                    </button>
                  ) : (
                    <button
                      onClick={() => { setMemoEditId(s.id); setMemoInput(""); }}
                      className="w-full text-[10px] text-slate-300 hover:text-amber-400 flex items-center justify-center gap-1 py-0.5"
                    >
                      + 메모 추가
                    </button>
                  )}
                </div>
                {status && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onActionClick(s, "delete");
                    }}
                    className="w-full mt-1 text-[10px] text-slate-300 hover:text-rose-400 flex items-center justify-center gap-1 py-1"
                  >
                    <Trash2 size={10} /> 기록 삭제/초기화
                  </button>
                )}
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-20 text-center bg-white rounded-2xl border-2 border-dashed border-slate-200">
            <CalendarDays size={48} className="mx-auto text-slate-200 mb-4" />
            <p className="text-slate-400 font-bold">
              해당 날짜에 예정된 레슨이 없습니다.
            </p>
            {user.role === "admin" && selectedTeacher && (
              <p
                className="text-xs text-indigo-400 mt-2 cursor-pointer hover:underline"
                onClick={() => setSelectedTeacher("")}
              >
                '전체 강사 보기'로 전환하기
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// [Internal Component] 사유 입력 모달
const AttendanceDetailModal = ({ config, onClose, onConfirm }) => {
  const [reason, setReason] = useState("");
  const [cancelType, setCancelType] = useState("기타"); // 당일취소 기본값

  const isCanceled = config.type === "canceled";

  return (
    <div className="fixed inset-0 bg-black/60 z-[150] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 transform transition-all scale-100">
        <h3 className="text-lg font-bold text-slate-800 mb-2">
          {isCanceled ? "당일 취소 처리" : "결석 처리"}
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          {isCanceled
            ? "당일 취소는 원칙적으로 횟수가 차감됩니다. (질병 제외)"
            : "결석은 미리 고지된 건으로, 횟수가 차감되지 않습니다."}
        </p>

        {isCanceled ? (
          <div className="space-y-2 mb-6">
            <label className="text-xs font-bold text-slate-600 block">
              취소 사유 선택
            </label>
            <div className="grid grid-cols-3 gap-2">
              {["질병", "경조사", "기타"].map((type) => (
                <button
                  key={type}
                  onClick={() => setCancelType(type)}
                  className={`py-2 rounded-lg text-sm font-bold border transition-all ${
                    cancelType === type
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mb-6">
            <label className="text-xs font-bold text-slate-600 block mb-1">
              결석 사유 입력
            </label>
            <textarea
              className="w-full p-3 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none resize-none bg-slate-50"
              rows={3}
              placeholder="예: 가족 여행, 학교 행사 등"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              autoFocus
            />
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-slate-500 hover:bg-slate-100 rounded-xl font-bold text-sm"
          >
            취소
          </button>
          <button
            onClick={() => onConfirm(isCanceled ? cancelType : reason)}
            className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold shadow-md hover:bg-indigo-700 text-sm"
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================================================================================
// ==================================================================================
// [1] StudentView: 원생 목록 (보안 강화: 강사는 본인 학생만 + 수납 기능 차단 + Z-Index 최적화 유지)
// ==================================================================================
const StudentView = ({
  students,
  teachers,
  showToast,
  user,
  onDeleteStudent,
  onUpdateStudent,
  registerFromConsultation,
  setRegisterFromConsultation,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  // 기본값을 '재원'으로 설정 (휴원·퇴원은 드롭다운으로 접근)
  const [filterStatus, setFilterStatus] = useState("재원");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState("info");

  const [isQuickEditMode, setIsQuickEditMode] = useState(false);
  const [quickEditData, setQuickEditData] = useState({});

  const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

  // 1. 권한 필터링 (강사는 본인 학생만 볼 수 있음 -> 전체 원생수 노출 원천 차단)
  const accessibleStudents = useMemo(() => {
    if (user.role === "admin") return students;
    return students.filter((s) => s.teacher === user.name);
  }, [students, user]);

  // 2. 상담 연동
  useEffect(() => {
    if (registerFromConsultation) {
      setSelectedStudent(registerFromConsultation);
      setModalTab("info");
      setIsDetailModalOpen(true);
      if (setRegisterFromConsultation) setRegisterFromConsultation(null);
    }
  }, [registerFromConsultation, setRegisterFromConsultation]);

  // 3. 통계 계산 (강사는 본인 학생 수만 카운트됨)
  const stats = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    return {
      전체: accessibleStudents.length,
      재원: accessibleStudents.filter((s) => (s.status || "재원") === "재원")
        .length,
      휴원: accessibleStudents.filter((s) => s.status === "휴원").length,
      퇴원: accessibleStudents.filter((s) => s.status === "퇴원").length,
      신규: accessibleStudents.filter(
        (s) =>
          (s.registrationDate || "").startsWith(currentMonth) &&
          s.status !== "퇴원"
      ).length,
    };
  }, [accessibleStudents]);

  // 4. 리스트 필터링
  const filteredStudents = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    return accessibleStudents.filter((s) => {
      const term = searchTerm.toLowerCase().trim();
      const sPhone = s.phone || "";

      const matchesSearch =
        !term ||
        s.name?.toLowerCase().includes(term) ||
        s.teacher?.toLowerCase().includes(term) ||
        s.subject?.toLowerCase().includes(term) ||
        sPhone.includes(term);

      const status = s.status || "재원";

      if (filterStatus === "신규") {
        return (
          matchesSearch &&
          (s.registrationDate || "").startsWith(currentMonth) &&
          status !== "퇴원"
        );
      }
      return matchesSearch && status === filterStatus;
    });
  }, [accessibleStudents, searchTerm, filterStatus]);

  const openWithTab = (student, tab = "info") => {
    setSelectedStudent(student);
    setModalTab(tab);
    setIsDetailModalOpen(true);
  };

  // 퀵에디트 저장
  const handleSaveQuickEdit = async () => {
    try {
      const changedStudentIds = Object.keys(quickEditData);

      if (changedStudentIds.length === 0) {
        setIsQuickEditMode(false);
        showToast("변경 내용이 없어 모드를 종료합니다.");
        return;
      }

      let updatedCount = 0;
      const updatePromises = changedStudentIds.map(async (studentId) => {
        const student = students.find((s) => s.id === studentId);
        if (!student) return;

        const changes = quickEditData[studentId];
        const newSchedules = { ...(student.schedules || {}), ...changes };

        Object.keys(newSchedules).forEach((day) => {
          if (!newSchedules[day] || newSchedules[day].trim() === "") {
            delete newSchedules[day];
          }
        });

        await onUpdateStudent(studentId, { schedules: newSchedules });
        updatedCount++;
      });

      await Promise.all(updatePromises);
      setQuickEditData({});
      setIsQuickEditMode(false);
      showToast(`${updatedCount}명의 시간표가 수정되었습니다.`);
    } catch (e) {
      console.error(e);
      showToast("시간표 저장 중 오류가 발생했습니다.", "error");
    }
  };

  return (
    <div className="space-y-4 animate-fade-in pb-24">
      {/* 상단 컨트롤바 */}
      <div className="flex flex-col gap-4 bg-white p-5 rounded-2xl border shadow-sm sticky top-0 z-30">
        <div className="flex flex-col xl:flex-row justify-between gap-4">
          <div className="relative flex-1 max-w-2xl">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              size={18}
            />
            <input
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="이름, 과목, 강사, 연락처 검색..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* 재원 */}
            <button
              onClick={() => setFilterStatus("재원")}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2 ${
                filterStatus === "재원"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              재원
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filterStatus === "재원" ? "bg-white/25 text-white" : "bg-slate-200 text-slate-500"}`}>
                {stats.재원}
              </span>
            </button>

            {/* 휴원 */}
            <button
              onClick={() => setFilterStatus("휴원")}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                filterStatus === "휴원"
                  ? "bg-amber-500 text-white shadow-sm"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              휴원
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filterStatus === "휴원" ? "bg-white/25 text-white" : "bg-slate-200 text-slate-500"}`}>
                {stats.휴원}
              </span>
            </button>

            {/* 퇴원 */}
            <button
              onClick={() => setFilterStatus("퇴원")}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                filterStatus === "퇴원"
                  ? "bg-rose-500 text-white shadow-sm"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              퇴원
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filterStatus === "퇴원" ? "bg-white/25 text-white" : "bg-slate-200 text-slate-500"}`}>
                {stats.퇴원}
              </span>
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
          <button
            onClick={() => setFilterStatus("신규")}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 border transition-all ${
              filterStatus === "신규"
                ? "bg-amber-500 text-white shadow-lg scale-105"
                : "bg-white text-amber-600 border-amber-200"
            }`}
          >
            <Plus size={18} /> ✨ 이번달 신규{" "}
            <span className="opacity-80 text-xs">({stats.신규})</span>
          </button>

          <div className="flex gap-2">
            <button
              onClick={() =>
                isQuickEditMode
                  ? handleSaveQuickEdit()
                  : setIsQuickEditMode(true)
              }
              className={`px-4 py-2.5 rounded-xl font-bold flex items-center shadow-sm ${
                isQuickEditMode
                  ? "bg-emerald-600 text-white"
                  : "bg-white border text-slate-700"
              }`}
            >
              {isQuickEditMode ? (
                <>
                  <Save size={18} className="mr-1.5" /> 저장
                </>
              ) : (
                <>
                  <Zap size={18} className="mr-1.5 text-amber-500" /> 시간표
                  빠른수정
                </>
              )}
            </button>

            {/* 신규 등록 버튼 (퀵에디트 모드가 아닐 때만 보임) */}
            {!isQuickEditMode && (
              <button
                onClick={() => openWithTab(null, "info")}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold flex items-center shadow-md hover:bg-indigo-700"
              >
                <Plus size={18} className="mr-1.5" /> 신규 등록
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 검색 결과 수 */}
      {searchTerm.trim() && (
        <div className="text-sm text-slate-500 px-1">
          <span className="font-bold text-indigo-600">{filteredStudents.length}명</span> 검색됨
        </div>
      )}

      {/* 퇴원 원생 전용 테이블 */}
      {filterStatus === "퇴원" && (
        <div className="bg-white rounded-2xl border border-rose-100 shadow-sm overflow-auto max-h-[70vh]">
          <div className="px-5 py-3 bg-rose-50 border-b border-rose-100 flex items-center gap-2">
            <span className="text-rose-600 font-bold text-sm">퇴원 원생 관리</span>
            <span className="text-xs text-rose-400">({filteredStudents.length}명)</span>
          </div>
          <table className="w-full text-left border-separate border-spacing-0">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                <th className="p-4 w-56 sticky left-0 top-0 bg-slate-100 z-20 border-b border-r border-slate-200">이름 / 과목 / 강사</th>
                <th className="p-4 border-b border-slate-200">연락처</th>
                <th className="p-4 border-b border-slate-200">퇴원일</th>
                <th className="p-4 w-36 text-center border-b border-slate-200">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.length > 0 ? filteredStudents.map((s) => (
                <tr key={s.id} className="hover:bg-rose-50/30 transition-colors group">
                  <td className="p-4 sticky left-0 bg-white group-hover:bg-rose-50/30 z-10 border-r border-slate-100">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-700 cursor-pointer hover:text-indigo-600 hover:underline" onClick={() => openWithTab(s, "info")}>{s.name}</span>
                        <span className="text-[10px] px-2 py-0.5 bg-rose-50 text-rose-500 rounded-full font-bold border border-rose-100">{s.subject}</span>
                      </div>
                      <span className="text-xs text-slate-400">{s.teacher}</span>
                    </div>
                  </td>
                  <td className="p-4 text-sm font-mono text-slate-500">{s.phone || "-"}</td>
                  <td className="p-4 text-sm text-slate-500">{s.withdrawalDate || "-"}</td>
                  <td className="p-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={async () => {
                          if (window.confirm(`${s.name} 원생을 재등록(재원) 처리하시겠습니까?`)) {
                            await onUpdateStudent(s.id, { status: "재원", withdrawalDate: null });
                          }
                        }}
                        className="px-3 py-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-600 hover:text-white transition-all"
                      >
                        재등록
                      </button>
                      <button
                        onClick={() => openWithTab(s, "info")}
                        className="p-1.5 bg-white text-slate-400 border border-slate-200 rounded-lg hover:bg-slate-800 hover:text-white transition-all"
                        title="정보수정"
                      >
                        <Settings size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="py-16 text-center text-slate-400">
                    <p className="font-bold text-base mb-1">퇴원 원생이 없습니다.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* 일반 테이블 영역 (재원·휴원·신규) */}
      {filterStatus !== "퇴원" && (
      <div className="bg-white rounded-2xl border shadow-sm overflow-auto max-h-[70vh]">
        <table className="w-full text-left border-separate border-spacing-0">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
              <th className="p-4 w-60 sticky left-0 top-0 bg-slate-100 z-20 border-b border-r border-slate-200 shadow-sm">
                원생 / 강사 정보
              </th>
              {isQuickEditMode ? (
                DAYS.map((d) => (
                  <th
                    key={d}
                    className="p-2 text-center w-24 sticky top-0 z-20 bg-slate-50 border-b border-slate-200 shadow-sm"
                  >
                    {d}
                  </th>
                ))
              ) : (
                <th className="p-4 bg-slate-50 border-b border-slate-200 shadow-sm">
                  수업 시간표 요약
                </th>
              )}
              {!isQuickEditMode && (
                <th className="p-4 w-40 text-center bg-slate-50 border-b border-slate-200 shadow-sm">
                  빠른 관리
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredStudents.length > 0 ? (
              filteredStudents.map((s) => (
                <tr
                  key={s.id}
                  className="hover:bg-slate-50/50 transition-colors group"
                >
                  <td className="p-4 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="font-bold text-slate-900 text-base cursor-pointer hover:text-indigo-600 hover:underline decoration-2 underline-offset-4 transition-all"
                          onClick={() => openWithTab(s, "info")}
                        >
                          {s.name}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full font-bold border border-indigo-100">
                          {s.subject}
                        </span>
                        <span
                          className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                            getWeeklyFrequency(s) === 2
                              ? "bg-violet-50 text-violet-600 border-violet-100"
                              : "bg-slate-50 text-slate-500 border-slate-200"
                          }`}
                        >
                          주{getWeeklyFrequency(s)}회
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                        <span>{s.teacher}</span>
                        {s.phone && (
                          <>
                            <span className="text-slate-300">|</span>
                            <span className="font-mono text-slate-400">
                              {s.phone}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* 시간표 (퀵에디트 모드 vs 일반 모드) */}
                  {isQuickEditMode ? (
                    DAYS.map((day) => (
                      <td
                        key={day}
                        className="p-1.5 min-w-[100px] border-b border-slate-50"
                      >
                        <input
                          type="text"
                          className="w-full text-center text-xs p-2 border rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white outline-none"
                          value={
                            quickEditData[s.id]?.[day] !== undefined
                              ? quickEditData[s.id][day]
                              : s.schedules?.[day] || ""
                          }
                          onChange={(e) =>
                            setQuickEditData((prev) => ({
                              ...prev,
                              [s.id]: {
                                ...(prev[s.id] || {}),
                                [day]: e.target.value,
                              },
                            }))
                          }
                        />
                      </td>
                    ))
                  ) : (
                    <td className="p-4 border-r border-slate-50">
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(s.schedules || {}).filter(([_, time]) => time).map(
                          ([day, time]) => (
                            <span
                              key={day}
                              className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[10px] font-bold border border-slate-200"
                            >
                              {day} {time}
                            </span>
                          )
                        )}
                        {(!s.schedules ||
                          Object.keys(s.schedules).length === 0) && (
                          <span className="text-xs text-slate-300">
                            일정 없음
                          </span>
                        )}
                      </div>
                    </td>
                  )}

                  {!isQuickEditMode && (
                    <td className="p-4 bg-slate-50/10">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openWithTab(s, "attendance")}
                          className="p-2.5 bg-white text-emerald-600 border border-emerald-100 rounded-xl shadow-sm hover:bg-emerald-600 hover:text-white transition-all"
                          title="출석부"
                        >
                          <CalendarIcon size={18} />
                        </button>

                        {/* 🔥 [보안] 수납관리 버튼: 오직 관리자(admin)만 볼 수 있음 */}
                        {user.role === "admin" && (
                          <button
                            onClick={() => openWithTab(s, "payment")}
                            className="p-2.5 bg-white text-indigo-600 border border-indigo-100 rounded-xl shadow-sm hover:bg-indigo-600 hover:text-white transition-all"
                            title="수납관리"
                          >
                            <CreditCard size={18} />
                          </button>
                        )}

                        <button
                          onClick={() => openWithTab(s, "info")}
                          className="p-2.5 bg-white text-slate-400 border border-slate-200 rounded-xl shadow-sm hover:bg-slate-800 hover:text-white transition-all"
                          title="정보수정"
                        >
                          <Settings size={18} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={isQuickEditMode ? 9 : 3}
                  className="py-20 text-center text-slate-400"
                >
                  <p className="font-bold text-lg mb-2">
                    검색 결과가 없습니다.
                  </p>
                  <p className="text-sm">
                    선택한 상태({filterStatus})에 해당하는 원생이 없습니다.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      )}

      <StudentManagementModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        student={selectedStudent}
        teachers={teachers}
        initialTab={modalTab}
        // 🔥 [중요] 모달에도 user 정보 전달 (권한 체크용)
        user={user}
        onSave={(data) => {
          onUpdateStudent(selectedStudent?.id || null, data);
          setIsDetailModalOpen(false);
        }}
        onDelete={(id) => {
          onDeleteStudent(id);
          setIsDetailModalOpen(false);
        }}
      />
    </div>
  );
};

// ==================================================================================
/// [2] StudentManagementModal: 통합 관리 (보안 강화: 강사는 수납 탭/수강료 정보 숨김)
// ==================================================================================
const StudentManagementModal = ({
  isOpen,
  onClose,
  student,
  teachers,
  onSave,
  onDelete,
  initialTab = "info",
  user, // 🔥 user prop 수신
}) => {
  const [activeTab, setActiveTab] = useState("info");
  const [formData, setFormData] = useState({});
  const [attHistory, setAttHistory] = useState([]);
  const [payHistory, setPayHistory] = useState([]);
  const [baseDate, setBaseDate] = useState(new Date());
  const [payAmount, setPayAmount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);

  const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

  // 🔥 [보안] 탭 목록 설정 (관리자만 payment 탭 보임)
  const TABS =
    user?.role === "admin"
      ? ["info", "attendance", "payment"]
      : ["info", "attendance"];

  useEffect(() => {
    if (isOpen) {
      if (student && student.fromConsultationId && !student.id) {
        // 상담에서 최초 등록 (아직 DB에 저장 안 된 상태)
        setFormData({
          name: student.name || "",
          phone: student.phone || "",
          subject: student.subject || "",
          grade: student.grade || "",
          teacher: student.teacher || "",
          status: "재원",
          registrationDate: new Date().toISOString().slice(0, 10),
          memo: student.note || "",
          totalSessions: 4,
          weeklyLessons: 1,
          tuitionFee: 0,
          schedules: {},
          fromConsultationId: student.fromConsultationId,
          weeklyFrequency: 1, // 주 수업 빈도 기본값 (주1회)
        });
        setAttHistory([]);
        setPayHistory([]);
        setPayAmount(0);
      } else if (student && student.id) {
        setFormData({
          ...student,
          totalSessions: getEffectiveSessions(student),
          weeklyLessons: student.weeklyLessons || 1,
          weeklyFrequency:
            student.weeklyFrequency ||
            (Object.keys(student.schedules || {}).length >= 2 ? 2 : 1),
        });
        setAttHistory(student.attendanceHistory || []);
        setPayHistory(student.paymentHistory || []);
        setPayAmount(student.tuitionFee || 0);
      } else {
        setFormData({
          name: "",
          phone: "",
          subject: "",
          grade: "",
          status: "재원",
          totalSessions: 4,
          weeklyLessons: 1,
          tuitionFee: 0,
          teacher: teachers[0]?.name || "",
          registrationDate: new Date().toISOString().slice(0, 10),
          schedules: {},
          weeklyFrequency: 1, // 주 수업 빈도 기본값 (주1회)
        });
        setAttHistory([]);
        setPayHistory([]);
        setPayAmount(0);
      }
      setBaseDate(new Date());

      // 만약 초기 탭이 payment인데 강사라면 info로 강제 이동
      if (initialTab === "payment" && user?.role !== "admin") {
        setActiveTab("info");
      } else {
        setActiveTab(initialTab);
      }
    }
  }, [isOpen, student, teachers, initialTab, user]);

  if (!isOpen) return null;

  const moveMonth = (offset) => {
    const d = new Date(baseDate);
    d.setMonth(d.getMonth() + offset);
    setBaseDate(d);
  };

  const handleScheduleChange = (day, value) => {
    setFormData((prev) => {
      const newSchedules = { ...prev.schedules };
      if (!value || value.trim() === "") {
        delete newSchedules[day];
      } else {
        newSchedules[day] = value;
      }
      // 요일 수에 따라 주 수업 빈도 자동 갱신 (2개 이상이면 주2회)
      const dayCount = Object.keys(newSchedules).length;
      return {
        ...prev,
        schedules: newSchedules,
        weeklyFrequency: dayCount >= 2 ? 2 : 1,
      };
    });
  };

  const toggleAttendance = (dateStr) => {
    const exists = attHistory.find((h) => h.date === dateStr);
    if (!exists) {
      // 없음 → 1회 출석
      setAttHistory([
        ...attHistory,
        {
          date: dateStr,
          status: "present",
          count: 1,
          timestamp: new Date().toISOString(),
        },
      ]);
    } else if ((exists.count || 1) === 1) {
      // 1회 → 2회 연강
      setAttHistory(
        attHistory.map((h) =>
          h.date === dateStr ? { ...h, count: 2 } : h
        )
      );
    } else {
      // 2회 → 제거
      setAttHistory(attHistory.filter((h) => h.date !== dateStr));
    }
  };

  const togglePayment = (dateStr) => {
    const exists = payHistory.find((h) => h.date === dateStr);
    if (exists) {
      if (window.confirm(`${dateStr} 결제 내역을 삭제하시겠습니까?`)) {
        setPayHistory(payHistory.filter((h) => h.date !== dateStr));
      }
    } else {
      setPayHistory([
        ...payHistory,
        {
          date: dateStr,
          amount: parseInt(payAmount) || 0,
          type: "tuition",
          sessionStartDate: dateStr,
          // 결제 당시의 회차 단위를 보존 (나중에 주1회/주2회 변경 시에도 유지되도록)
          totalSessions: formData.totalSessions || 4,
          createdAt: new Date().toISOString(),
        },
      ]);
    }
  };

  const handleFinalSave = async () => {
    if (isSaving) return;
    if (!formData.name) return alert("이름을 입력해주세요.");

    setIsSaving(true);

    // 빈 시간의 요일 제거
    const cleanSchedules = { ...(formData.schedules || {}) };
    Object.keys(cleanSchedules).forEach((day) => {
      if (!cleanSchedules[day] || cleanSchedules[day].trim() === "") {
        delete cleanSchedules[day];
      }
    });

    // 출석 캘린더 수정 후 sessionsCompleted 재계산 (연강 count 반영)
    const lastPayment = formData.lastPaymentDate || "0000-00-00";
    const recalcSessionsCompleted = attHistory.reduce((sum, h) => {
      if (h.date < lastPayment) return sum;
      if (h.status === "present") return sum + (h.count || 1);
      if (h.status === "canceled") return sum + 1; // 당일취소는 학생 1회 차감 (강사 시수는 별도 0.5회 적용)
      return sum;
    }, 0);

    // 결제 이력 totalSessions 보존:
    // totalSessions 없이 저장된 기존 결제 항목은 변경 전 원생의 수강 단위로 채워 보존
    const originalEffectiveSessions = student ? getEffectiveSessions(student) : 4;
    const correctedPayHistory = payHistory.map((p) => ({
      ...p,
      totalSessions: p.totalSessions || originalEffectiveSessions,
    }));

    const updatedData = {
      ...formData,
      schedules: cleanSchedules,
      attendanceHistory: attHistory,
      paymentHistory: correctedPayHistory,
      sessionsCompleted: recalcSessionsCompleted,
      updatedAt: new Date().toISOString(),
    };

    await onSave(updatedData);

    setTimeout(() => setIsSaving(false), 500);
  };

  const renderCalendar = (type) => {
    const calendars = [];
    for (let i = 0; i < 2; i++) {
      const d = new Date(baseDate);
      d.setMonth(baseDate.getMonth() + i);
      const year = d.getFullYear();
      const month = d.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const firstDay = new Date(year, month, 1).getDay();
      const days = [];
      for (let k = 0; k < firstDay; k++) days.push(null);
      for (let k = 1; k <= daysInMonth; k++) days.push(k);

      calendars.push(
        <div
          key={`${year}-${month}`}
          className="border rounded-xl p-3 bg-white shadow-sm"
        >
          <div className="text-center font-bold text-slate-700 mb-2 bg-slate-50 rounded py-1 text-sm">
            {year}년 {month + 1}월
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {["일", "월", "화", "수", "목", "금", "토"].map((day, idx) => (
              <div
                key={day}
                className={`text-[10px] font-bold ${
                  idx === 0
                    ? "text-rose-400"
                    : idx === 6
                    ? "text-blue-400"
                    : "text-slate-400"
                }`}
              >
                {day}
              </div>
            ))}
            {days.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`}></div>;
              const dateStr = `${year}-${String(month + 1).padStart(
                2,
                "0"
              )}-${String(day).padStart(2, "0")}`;
              let isSelected = false;
              let isDouble = false;
              if (type === "attendance") {
                const attRecord = attHistory.find(
                  (h) => h.date === dateStr && h.status === "present"
                );
                isSelected = !!attRecord;
                isDouble = isSelected && (attRecord.count || 1) === 2;
              } else {
                isSelected = payHistory.some((h) => h.date === dateStr);
              }

              return (
                <div
                  key={day}
                  onClick={() =>
                    type === "attendance"
                      ? toggleAttendance(dateStr)
                      : togglePayment(dateStr)
                  }
                  className={`aspect-square flex items-center justify-center rounded-lg text-xs cursor-pointer transition-all border relative ${
                    isDouble
                      ? "bg-emerald-700 text-white font-bold border-emerald-800 shadow-md transform scale-105"
                      : isSelected
                      ? type === "attendance"
                        ? "bg-emerald-500 text-white font-bold border-emerald-600 shadow-md transform scale-105"
                        : "bg-indigo-600 text-white font-bold border-indigo-700 shadow-md transform scale-105"
                      : "bg-white text-slate-600 hover:bg-slate-100 hover:border-indigo-200"
                  }`}
                >
                  {day}
                  {isDouble && (
                    <span className="absolute -top-1 -right-1 bg-amber-400 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                      ×2
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{calendars}</div>
    );
  };

  return (
    <div className="fixed inset-0 md:left-64 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh]">
        {/* 헤더 */}
        <div className="p-5 border-b flex justify-between items-center bg-slate-50/80 rounded-t-3xl shrink-0 backdrop-blur-sm">
          <div>
            <h3 className="font-bold text-xl text-slate-800 flex items-center gap-2">
              {formData.fromConsultationId && !student?.id
                ? "💬 상담 정보로 등록"
                : student?.id
                ? `👤 ${student.name} 정보 수정`
                : "✨ 신규 원생 등록"}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              기본 정보와 출결을 통합 관리합니다.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white rounded-full transition-colors shadow-sm"
          >
            <X size={24} className="text-slate-400" />
          </button>
        </div>

        {/* 탭 */}
        <div className="flex border-b text-sm font-bold bg-white shrink-0 p-1 gap-1">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 rounded-xl transition-all flex items-center justify-center gap-1 ${
                activeTab === tab
                  ? tab === "attendance"
                    ? "bg-emerald-50 text-emerald-700 shadow-inner ring-1 ring-emerald-100"
                    : tab === "payment"
                    ? "bg-indigo-50 text-indigo-700 shadow-inner ring-1 ring-indigo-100"
                    : "bg-slate-100 text-slate-800 shadow-inner"
                  : "text-slate-400 hover:bg-slate-50"
              }`}
            >
              {tab === "info" && <User size={16} />}
              {tab === "attendance" && <CheckCircle size={16} />}
              {tab === "payment" && <CreditCard size={16} />}
              {tab === "info"
                ? "기본 정보"
                : tab === "attendance"
                ? "출석 관리"
                : "수납 관리"}
            </button>
          ))}
        </div>

        {/* 컨텐츠 */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
          {activeTab === "info" && (
            <div className="space-y-6 animate-in slide-in-from-bottom-2 duration-300">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 ml-1">
                    이름
                  </label>
                  <input
                    className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    placeholder="이름 입력"
                    value={formData.name || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 ml-1">
                    연락처
                  </label>
                  <input
                    className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    placeholder="010-0000-0000"
                    value={formData.phone || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, phone: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 ml-1">
                    수강 과목
                  </label>
                  <input
                    className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    placeholder="예: 피아노"
                    value={formData.subject || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, subject: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 ml-1">
                    학년/학교
                  </label>
                  <input
                    className="w-full p-3 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    placeholder="예: 초3"
                    value={formData.grade || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, grade: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* 강사 / 상태 / 수강료 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-4 shadow-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 ml-1">
                      담당 강사
                    </label>
                    <select
                      className="w-full p-3 border rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                      value={formData.teacher || ""}
                      onChange={(e) =>
                        setFormData({ ...formData, teacher: e.target.value })
                      }
                    >
                      <option value="">강사 선택</option>
                      {teachers.map((t) => (
                        <option key={t.id} value={t.name}>
                          {t.name} 선생님
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 ml-1">
                      상태 (재원/휴원/퇴원)
                    </label>
                    <select
                      className="w-full p-3 border rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 font-bold"
                      value={formData.status || "재원"}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value })
                      }
                    >
                      <option value="재원">🟢 재원</option>
                      <option value="휴원">🟡 휴원</option>
                      <option value="퇴원">🔴 퇴원</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* 🔥 [보안] 수강료 정보: 관리자(admin)만 볼 수 있음 */}
                  {user?.role === "admin" ? (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-500 ml-1">
                        정규 수강료 (원)
                      </label>
                      <input
                        type="number"
                        className="w-full p-3 border rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-indigo-600 text-right"
                        placeholder="0"
                        value={formData.tuitionFee || ""}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            tuitionFee: e.target.value,
                          })
                        }
                      />
                    </div>
                  ) : (
                    // 강사는 빈 공간으로 처리하여 레이아웃 유지
                    <div></div>
                  )}

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 ml-1">
                      등록일
                    </label>
                    <input
                      type="date"
                      className="w-full p-3 border rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-600"
                      value={formData.registrationDate || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          registrationDate: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* 주당 수업 횟수 / 세트 횟수 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 ml-1">
                      주당 수업 횟수
                    </label>
                    <div className="flex gap-2">
                      {[{ v: 1, label: "주1회" }, { v: 2, label: "주2회" }].map(({ v, label }) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() =>
                            setFormData({
                              ...formData,
                              weeklyFrequency: v,
                              weeklyLessons: v,
                              totalSessions: v === 2 ? 8 : 4,
                            })
                          }
                          className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${
                            formData.weeklyFrequency === v
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                              : "bg-slate-50 border-slate-200 text-slate-400 hover:border-indigo-300"
                          }`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 ml-1">
                      총 수업 횟수 / 세트 (수동 조정)
                    </label>
                    <select
                      className="w-full p-3 border rounded-xl bg-slate-50 outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-600"
                      value={formData.totalSessions || 4}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          totalSessions: parseInt(e.target.value),
                        })
                      }
                    >
                      <option value={4}>4회</option>
                      <option value={8}>8회</option>
                      <option value={12}>12회</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* 시간표 */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <label className="text-xs font-bold text-slate-500 mb-3 block flex items-center gap-1">
                  <Timer size={14} className="text-indigo-500" /> 요일별 정규
                  수업 시간 (예: 14:30)
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {DAYS.map((day) => (
                    <div key={day} className="space-y-1">
                      <div className="text-[10px] text-center font-bold text-slate-400">
                        {day}
                      </div>
                      <input
                        className={`w-full p-1.5 text-xs border rounded-lg text-center focus:ring-2 focus:ring-indigo-500 outline-none transition-colors ${
                          formData.schedules?.[day]
                            ? "bg-indigo-50 border-indigo-200 font-bold text-indigo-700"
                            : "bg-slate-50"
                        }`}
                        placeholder="-"
                        value={formData.schedules?.[day] || ""}
                        onChange={(e) =>
                          handleScheduleChange(day, e.target.value)
                        }
                      />
                    </div>
                  ))}
                </div>

                {/* 주 수업 빈도 선택 (요일 수에 따라 자동 반영, 수동 조정 가능) */}
                <div className="mt-4">
                  <label className="text-xs font-bold text-slate-500 mb-2 block">
                    주 수업 빈도
                  </label>
                  <div className="flex gap-2">
                    {[1, 2].map((freq) => (
                      <button
                        key={freq}
                        type="button"
                        onClick={() =>
                          setFormData((prev) => ({
                            ...prev,
                            weeklyFrequency: freq,
                          }))
                        }
                        className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${
                          (formData.weeklyFrequency || 1) === freq
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                            : "bg-white text-slate-500 border-slate-300 hover:border-indigo-400"
                        }`}
                      >
                        주{freq}회
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    * 요일을 2개 이상 입력하면 자동으로 주2회로 변경됩니다.
                  </p>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 ml-1">
                  메모 / 특이사항
                </label>
                <textarea
                  className="w-full p-4 border rounded-2xl h-24 text-sm outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  placeholder="특이사항이나 상담 내용을 기록하세요."
                  value={formData.memo || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, memo: e.target.value })
                  }
                />
              </div>
            </div>
          )}

          {activeTab === "attendance" && (
            <div className="space-y-4 animate-in slide-in-from-right-2 duration-300">
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex justify-between items-center shadow-sm">
                <div className="text-emerald-800 text-sm font-bold flex items-center">
                  <CheckCircle size={18} className="mr-2" /> 현재 총{" "}
                  {attHistory.filter((h) => h.status === "present").length}회
                  출석
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => moveMonth(-1)}
                    className="px-3 py-1 bg-white border rounded text-xs hover:bg-slate-50 font-medium"
                  >
                    ◀ 이전
                  </button>
                  <button
                    onClick={() => moveMonth(1)}
                    className="px-3 py-1 bg-white border rounded text-xs hover:bg-slate-50 font-medium"
                  >
                    다음 ▶
                  </button>
                </div>
              </div>
              <p className="text-xs text-center text-slate-400 mb-2">
                * 날짜를 클릭하면 출석(초록색)으로 체크/해제됩니다.
              </p>
              {renderCalendar("attendance")}
            </div>
          )}

          {/* 🔥 [보안] 수납 탭 내용은 관리자(admin)일 때만 렌더링됨 */}
          {activeTab === "payment" && user?.role === "admin" && (
            <div className="space-y-4 animate-in slide-in-from-right-2 duration-300">
              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex flex-col gap-3 shadow-sm">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-indigo-900">
                      결제 등록 금액:
                    </span>
                    <input
                      type="number"
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      className="w-24 p-1.5 text-right font-bold border border-indigo-200 rounded bg-white text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <span className="text-xs text-indigo-600">원</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => moveMonth(-1)}
                      className="px-3 py-1 bg-white border rounded text-xs hover:bg-slate-50 font-medium"
                    >
                      ◀ 이전
                    </button>
                    <button
                      onClick={() => moveMonth(1)}
                      className="px-3 py-1 bg-white border rounded text-xs hover:bg-slate-50 font-medium"
                    >
                      다음 ▶
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-indigo-400">
                  * 위 금액을 설정하고 날짜를 클릭하면 해당 날짜/금액으로 수납
                  내역이 추가됩니다.
                </p>
              </div>
              {renderCalendar("payment")}
              <div className="mt-4 border-t pt-4">
                <h4 className="text-xs font-bold text-slate-500 mb-2">
                  최근 결제 내역 (요약)
                </h4>
                <div className="space-y-2">
                  {(() => {
                    const sessionUnit = parseInt(formData.totalSessions) || 4;
                    const sortedPay = [...payHistory].sort((a, b) =>
                      a.date.localeCompare(b.date)
                    );
                    const sortedAtt = [...attHistory]
                      .filter((h) => h.status === "present" || h.status === "canceled")
                      .sort((a, b) => a.date.localeCompare(b.date));
                    // count 반영: 연강(count:2)=슬롯 2개, 당일취소=슬롯 1개
                    const sessionSlots = [];
                    sortedAtt.forEach((h) => {
                      const cnt = h.status === "canceled" ? 1 : (h.count || 1);
                      for (let i = 0; i < cnt; i++) sessionSlots.push(h.date);
                    });
                    const payWithIdx = sortedPay.map((h, i) => ({ ...h, payIdx: i }));
                    const recentPays = [...payWithIdx].reverse().slice(0, 3);
                    return recentPays.map((h, idx) => {
                      const startSession = h.payIdx * sessionUnit;
                      const slots = sessionSlots.slice(startSession, startSession + sessionUnit);
                      const startNum = startSession + 1;
                      const endNum = startSession + slots.length;
                      // 날짜별로 그룹화 (연강 여부 확인)
                      const dateGroups = [];
                      slots.forEach((date) => {
                        const last = dateGroups[dateGroups.length - 1];
                        if (last && last.date === date) last.cnt++;
                        else dateGroups.push({ date, cnt: 1 });
                      });
                      return (
                        <div
                          key={idx}
                          className="bg-white rounded border border-slate-100 p-2 text-xs"
                        >
                          <div className="flex justify-between">
                            <span className="font-mono text-slate-600">{h.date}</span>
                            <span className="font-bold text-indigo-600">
                              {Number(h.amount).toLocaleString()}원
                            </span>
                          </div>
                          {slots.length > 0 ? (
                            <div className="mt-1 text-[11px] text-slate-500">
                              <span className="text-slate-400 font-medium">
                                {startNum}~{endNum}회차:{" "}
                              </span>
                              {dateGroups
                                .map((g) =>
                                  g.date.slice(5).replace("-", "/") +
                                  (g.cnt > 1 ? "(연강)" : "")
                                )
                                .join(", ")}
                            </div>
                          ) : (
                            <div className="mt-1 text-[11px] text-slate-400">
                              세션 진행중
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                  {payHistory.length === 0 && (
                    <p className="text-xs text-slate-400">
                      등록된 수납 내역이 없습니다.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="p-5 border-t bg-white flex justify-end gap-3 rounded-b-3xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          {student?.id && onDelete && (
            <button
              onClick={() => {
                if (
                  window.confirm(
                    "정말 이 원생 정보를 삭제하시겠습니까? (복구 불가)"
                  )
                ) {
                  onDelete(student.id);
                }
              }}
              className="mr-auto text-rose-500 text-xs underline font-bold hover:text-rose-700 px-2"
            >
              원생 삭제
            </button>
          )}
          <button
            onClick={onClose}
            className="px-6 py-3 text-slate-500 font-bold hover:bg-slate-100 rounded-xl transition-colors"
          >
            취소
          </button>
          <button
            onClick={handleFinalSave}
            disabled={isSaving}
            className={`px-8 py-3 rounded-xl font-bold shadow-lg flex items-center transition-all ${
              isSaving
                ? "bg-slate-400 text-slate-200 cursor-not-allowed"
                : "bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 shadow-indigo-200"
            }`}
          >
            <Save size={18} className="mr-2" />
            {isSaving ? "저장 중..." : (activeTab === "info" ? "정보 저장" : "변경사항 저장")}
          </button>
        </div>
      </div>
    </div>
  );
};

// =================================================================
// [BulkSmsView] - 공지 / 안내 문자 일괄 발송 (관리자 전용)
// =================================================================
const BULK_SMS_TEMPLATES = [
  { id: "custom",   label: "직접 입력",   text: "" },
  { id: "holiday",  label: "휴원 안내",   text: "안녕하세요, JnC 음악학원입니다.\n[날짜]에 휴원합니다.\n수업 일정에 참고해 주세요. 감사합니다." },
  { id: "change",   label: "수업 변경",   text: "안녕하세요, JnC 음악학원입니다.\n수업 일정이 변경되었습니다.\n변경 일시: [날짜/시간]\n문의: 02-2655-0220" },
  { id: "recital",  label: "발표회 안내", text: "안녕하세요, JnC 음악학원입니다.\n발표회를 안내드립니다.\n일시: [날짜]\n장소: [장소]\n많은 참석 바랍니다!" },
  { id: "fee",      label: "수강료 안내", text: "안녕하세요, JnC 음악학원입니다.\n이번 달 수강료 납부를 안내드립니다.\n납부 계좌: [계좌번호]\n감사합니다." },
];

const BulkSmsView = ({ students, teachers, showToast }) => {
  const [selectedIds, setSelectedIds] = useState([]);
  const [filterTeacher, setFilterTeacher] = useState("");
  const [filterPart, setFilterPart] = useState("");
  const [templateId, setTemplateId] = useState("custom");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState(null); // null = 미발송, [] = 결과

  const PARTS = ["피아노", "관현악", "실용음악", "성악"];

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (filterTeacher && s.teacher !== filterTeacher) return false;
      if (filterPart && s.part !== filterPart) return false;
      return true;
    });
  }, [students, filterTeacher, filterPart]);

  const toggleAll = () => {
    if (selectedIds.length === filteredStudents.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredStudents.map((s) => s.id));
    }
  };

  const toggleOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleTemplateChange = (tid) => {
    setTemplateId(tid);
    const t = BULK_SMS_TEMPLATES.find((t) => t.id === tid);
    if (t && t.text) setMessage(t.text);
    else setMessage("");
  };

  const handleSend = async () => {
    if (!message.trim()) {
      showToast("발송할 내용을 입력해주세요.", "warning");
      return;
    }
    const targets = students.filter(
      (s) => selectedIds.includes(s.id) && s.phone
    );
    if (targets.length === 0) {
      showToast("연락처가 있는 발송 대상을 선택해주세요.", "warning");
      return;
    }
    if (!window.confirm(`${targets.length}명에게 문자를 발송합니까?`)) return;

    setSending(true);
    setResults([]);
    const newResults = [];
    for (const s of targets) {
      try {
        await sendAligoSms(s.phone, message);
        newResults.push({ name: s.name, phone: s.phone, success: true });
      } catch (e) {
        newResults.push({ name: s.name, phone: s.phone, success: false, error: e.message });
      }
      setResults([...newResults]);
    }
    setSending(false);
    const ok = newResults.filter((r) => r.success).length;
    showToast(
      `발송 완료: ${ok}명 성공 / ${newResults.length - ok}명 실패`,
      ok === newResults.length ? "success" : "warning"
    );
  };

  const selectedWithPhone = students.filter(
    (s) => selectedIds.includes(s.id) && s.phone
  ).length;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
        <Send size={22} className="text-indigo-600" />
        공지 / 안내 문자 발송
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 왼쪽: 원생 선택 */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-4 border-b bg-slate-50 flex flex-wrap gap-2 items-center">
            <select
              value={filterTeacher}
              onChange={(e) => setFilterTeacher(e.target.value)}
              className="text-sm border rounded-lg px-2 py-1.5 bg-white"
            >
              <option value="">전체 선생님</option>
              {teachers.map((t) => (
                <option key={t.id} value={t.name}>{t.name}</option>
              ))}
            </select>
            <select
              value={filterPart}
              onChange={(e) => setFilterPart(e.target.value)}
              className="text-sm border rounded-lg px-2 py-1.5 bg-white"
            >
              <option value="">전체 파트</option>
              {PARTS.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <button
              onClick={toggleAll}
              className="ml-auto text-xs px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-100"
            >
              {selectedIds.length === filteredStudents.length ? "전체 해제" : "전체 선택"}
            </button>
          </div>

          <div className="overflow-y-auto" style={{ maxHeight: "380px" }}>
            {filteredStudents.length === 0 ? (
              <p className="text-center text-slate-400 py-10 text-sm">원생이 없습니다.</p>
            ) : (
              filteredStudents.map((s) => (
                <label
                  key={s.id}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 cursor-pointer border-b border-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(s.id)}
                    onChange={() => toggleOne(s.id)}
                    className="w-4 h-4 accent-indigo-600"
                  />
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-slate-800 text-sm">{s.name}</span>
                    <span className="text-xs text-slate-400 ml-2">{s.teacher}</span>
                  </div>
                  {s.phone ? (
                    <span className="text-xs text-slate-400">{s.phone}</span>
                  ) : (
                    <span className="text-xs text-red-300">연락처 없음</span>
                  )}
                </label>
              ))
            )}
          </div>

          <div className="px-4 py-2.5 bg-slate-50 border-t text-xs text-slate-500">
            선택: <span className="font-bold text-indigo-600">{selectedIds.length}명</span>
            {selectedIds.length > 0 && (
              <span className="ml-2">(연락처 있음: <span className="font-bold">{selectedWithPhone}명</span>)</span>
            )}
          </div>
        </div>

        {/* 오른쪽: 메시지 작성 */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 space-y-3">
            <p className="text-sm font-bold text-slate-700">템플릿 선택</p>
            <div className="flex flex-wrap gap-2">
              {BULK_SMS_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleTemplateChange(t.id)}
                  className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-all ${
                    templateId === t.id
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <p className="text-sm font-bold text-slate-700">내용</p>
                <span className={`text-xs ${message.length > 90 ? "text-orange-500 font-bold" : "text-slate-400"}`}>
                  {message.length}자 {message.length > 90 ? "(장문 LMS)" : "(단문 SMS)"}
                </span>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={7}
                placeholder="발송할 내용을 입력하세요."
                className="w-full border border-slate-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>

            <button
              onClick={handleSend}
              disabled={sending || selectedWithPhone === 0 || !message.trim()}
              className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <Send size={16} />
              {sending
                ? `발송 중... (${results?.length || 0}/${selectedWithPhone}명)`
                : `${selectedWithPhone}명에게 발송`}
            </button>
          </div>

          {/* 발송 결과 */}
          {results !== null && results.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
              <p className="text-sm font-bold text-slate-700 mb-2">발송 결과</p>
              <div className="space-y-1 overflow-y-auto" style={{ maxHeight: "200px" }}>
                {results.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${r.success ? "bg-green-400" : "bg-red-400"}`} />
                    <span className="font-medium">{r.name}</span>
                    <span className="text-slate-400 text-xs">{r.phone}</span>
                    {!r.success && <span className="text-red-400 text-xs ml-auto">{r.error}</span>}
                    {r.success && <span className="text-green-500 text-xs ml-auto">완료</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// [PaymentView] - 결제 안내 발송 시스템 통합 (메시지 일괄 생성, 발송 이력, 결제 완료 간편 입력)
const PaymentView = ({
  students,
  showToast,
  onSavePayment,
  onUpdatePaymentHistory,
  onUpdateStudent,
  messageLogs = [],
  onSaveMessageLog,
  paymentUrl = "",
  user,
}) => {
  const [filterDue, setFilterDue] = useState(false);
  // sentFilter: "" = 전체, "sent" = 발송됨만, "unsent" = 미발송만
  const [sentFilter, setSentFilter] = useState("");
  // filterWeek: 이번 주 만료/미납자만 표시
  const [filterWeek, setFilterWeek] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState("");

  const [showMsgPreview, setShowMsgPreview] = useState(false);
  const [msgContent, setMsgContent] = useState("");
  const [msgStudent, setMsgStudent] = useState(null); // 개별 미리보기 대상 학생
  const [msgSending, setMsgSending] = useState(false);

  // 안내 발송 모드 state
  const [notifMode, setNotifMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkModal, setShowBulkModal] = useState(false);

  // 결제 완료 간편 입력 state
  const [quickPayStudent, setQuickPayStudent] = useState(null);
  const [quickPayDate, setQuickPayDate] = useState("");

  // 수강 현황 계산 헬퍼
  const getStudentProgress = (s) => {
    const totalAttended = (s.attendanceHistory || [])
      .filter((h) => h.status === "present" || h.status === "canceled")
      .reduce((sum, h) => sum + (h.status === "canceled" ? 1 : (h.count || 1)), 0);
    const sessionUnit = getEffectiveSessions(s);
    const sortedPayments = [...(s.paymentHistory || [])].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    // 결제별 totalSessions 합산 (수강권 변경 이력 반영)
    const totalPaidCapacity = sortedPayments.reduce(
      (sum, p) => sum + (p.totalSessions || sessionUnit),
      0
    );

    const remainingCapacity = totalPaidCapacity - totalAttended;

    // 마지막 결제 사이클 단위 (표시용)
    const lastPayUnit =
      sortedPayments.length > 0
        ? sortedPayments[sortedPayments.length - 1].totalSessions || sessionUnit
        : sessionUnit;
    const lastCycleStart = Math.max(0, totalPaidCapacity - lastPayUnit);
    let currentUsage = Math.max(0, totalAttended - lastCycleStart);
    // 사이클 경계: 용량 소진 상태에서 나머지=0이면 마지막 사이클 완료로 표시
    if (currentUsage === 0 && totalAttended > 0 && remainingCapacity <= 0)
      currentUsage = lastPayUnit;
    const isOverdue = remainingCapacity < 0;
    const isCompleted = remainingCapacity === 0 && totalPaidCapacity > 0;

    return {
      currentUsage,
      sessionUnit: lastPayUnit,
      isOverdue,
      isCompleted,
      displayStatus: isOverdue
        ? "미납 (초과)"
        : isCompleted
        ? "수강권 만료"
        : "수강 중",
      statusColor: isOverdue
        ? "bg-rose-100 text-rose-700 font-bold"
        : isCompleted
        ? "bg-amber-100 text-amber-700 font-bold"
        : "bg-emerald-100 text-emerald-700",
    };
  };

  // 강사 목록 (드롭다운용)
  const teacherOptions = useMemo(() => {
    const set = new Set();
    students.forEach((s) => { if (s.teacher) set.add(s.teacher); });
    return Array.from(set).sort();
  }, [students]);

  const list = useMemo(() => {
    const sentStudentIds = new Set(messageLogs.map((l) => l.studentId));
    // 이번 주 시작(월요일) 계산
    const today = new Date();
    const dayOfWeek = (today.getDay() + 6) % 7; // 0=월 … 6=일
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString().split("T")[0];

    const filtered = students.filter((s) => {
      const { isOverdue, isCompleted } = getStudentProgress(s);
      // 안내 발송 모드: 미납/만료만 표시
      const isDue = notifMode
        ? isCompleted || isOverdue
        : !filterDue || isCompleted || isOverdue;
      const isReEnrolled = s.status === "재원";
      const matchesSearch =
        s.name.includes(searchTerm) ||
        (s.subject && s.subject.includes(searchTerm)) ||
        (s.teacher && s.teacher.includes(searchTerm));
      const matchesTeacher = !selectedTeacher || s.teacher === selectedTeacher;
      // 발송 필터: 전체 / 발송됨만 / 미발송만
      const isSent = sentStudentIds.has(s.id);
      const matchesSent =
        sentFilter === "sent" ? isSent :
        sentFilter === "unsent" ? !isSent :
        true;
      // 주간 필터: 이번 주 이후 안내 발송 기록이 없는 미납/만료자
      const lastNotif = messageLogs
        .filter((l) => l.studentId === s.id)
        .sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0]?.sentAt || null;
      const matchesWeek = !filterWeek || ((isCompleted || isOverdue) && (!lastNotif || lastNotif < weekStartStr));
      return isReEnrolled && isDue && matchesSearch && matchesTeacher && matchesSent && matchesWeek;
    });

    // 결제 안내일 기준 정렬: 미발송 → 오래된 순
    filtered.sort((a, b) => {
      const da = messageLogs
        .filter((l) => l.studentId === a.id)
        .sort((x, y) => y.sentAt.localeCompare(x.sentAt))[0]?.sentAt || "";
      const db = messageLogs
        .filter((l) => l.studentId === b.id)
        .sort((x, y) => y.sentAt.localeCompare(x.sentAt))[0]?.sentAt || "";
      return da.localeCompare(db); // 미발송("") → 오래된 것 먼저
    });
    return filtered;
  }, [students, filterDue, filterWeek, sentFilter, searchTerm, selectedTeacher, notifMode, messageLogs]);

  const selectedStudent = useMemo(
    () => students.find((s) => s.id === selectedStudentId) || null,
    [students, selectedStudentId]
  );

  // 안내 문자 미리보기 (개별 학생, 전역 헬퍼 활용)
  const handleOpenMsgPreview = (e, student) => {
    e.stopPropagation();
    setMsgContent(generatePaymentMessage(student, paymentUrl));
    setMsgStudent(student);
    setShowMsgPreview(true);
  };

  // 마지막 안내 발송일 조회
  const getLastNotifDate = (studentId) => {
    const logs = messageLogs
      .filter((l) => l.studentId === studentId)
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    return logs.length > 0 ? logs[0].sentAt : null;
  };

  // 체크박스 토글
  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // 결제 완료 간편 저장
  const handleQuickPaySave = async () => {
    if (!quickPayStudent || !quickPayDate) return;
    try {
      await onSavePayment(
        quickPayStudent.id,
        quickPayDate,
        parseInt(quickPayStudent.tuitionFee || 0),
        quickPayDate
      );
      setQuickPayStudent(null);
      setQuickPayDate("");
    } catch (e) {
      showToast("저장 오류: " + e.message, "error");
    }
  };

  const handleConfirmCopy = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(msgContent).then(() => {
        showToast("안내 문구가 복사되었습니다!", "success");
        setShowMsgPreview(false);
      });
    } else {
      showToast("복사 실패 (브라우저 미지원)", "error");
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6 h-full flex flex-col overflow-hidden animate-fade-in relative">
      {/* 개별 메시지 미리보기 모달 */}
      {showMsgPreview && (
        <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col h-[85vh]">
            <div className="flex justify-between items-center p-4 border-b shrink-0">
              <h3 className="text-lg font-bold flex items-center text-indigo-900">
                <MessageSquareText className="mr-2" size={20} /> 안내 문자 미리보기
              </h3>
              <button onClick={() => setShowMsgPreview(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-hidden flex flex-col">
              <div className="text-sm text-slate-500 mb-2 flex items-center shrink-0">
                <AlertCircle size={14} className="mr-1" /> 내용을 확인하고 필요하면 직접 수정한 뒤 복사하세요.
              </div>
              <textarea
                className="w-full flex-1 border border-slate-300 rounded-lg p-4 text-sm font-sans leading-relaxed focus:outline-indigo-500 resize-none bg-slate-50"
                value={msgContent}
                onChange={(e) => setMsgContent(e.target.value)}
                spellCheck="false"
              />
            </div>
            <div className="p-4 border-t bg-slate-50 rounded-b-xl flex justify-end gap-3 shrink-0">
              <button onClick={() => setShowMsgPreview(false)} className="px-5 py-2.5 rounded-lg text-slate-600 hover:bg-slate-200 font-bold">취소</button>
              <button onClick={handleConfirmCopy} className="px-6 py-2.5 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg flex items-center">
                <Copy size={18} className="mr-2" /> 복사하기
              </button>
              {msgStudent?.phone && (
                <button
                  onClick={async () => {
                    setMsgSending(true);
                    try {
                      await sendAligoSms(msgStudent.phone, msgContent);
                      showToast(`${msgStudent.name} 문자 발송 완료`, "success");
                      setShowMsgPreview(false);
                    } catch (e) {
                      showToast("발송 실패: " + e.message, "error");
                    } finally {
                      setMsgSending(false);
                    }
                  }}
                  disabled={msgSending}
                  className="px-6 py-2.5 rounded-lg bg-blue-600 text-white font-bold hover:bg-blue-700 shadow-lg flex items-center disabled:opacity-60"
                >
                  📱 {msgSending ? "발송 중..." : "문자 발송"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 결제 완료 간편 입력 모달 */}
      {quickPayStudent && (
        <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold mb-1 flex items-center text-emerald-700">
              <CreditCard className="mr-2" size={20} /> 결제 완료 입력
            </h3>
            <p className="text-sm text-slate-500 mb-4">{quickPayStudent.name} ({quickPayStudent.subject})</p>
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-500 mb-1">결제일자</label>
              <input
                type="date"
                value={quickPayDate}
                onChange={(e) => setQuickPayDate(e.target.value)}
                className="w-full p-3 border rounded-xl bg-slate-50 focus:outline-emerald-500 text-sm"
              />
            </div>
            <div className="mb-3">
              <label className="block text-xs font-bold text-slate-500 mb-1">결제금액</label>
              <div className="p-3 border rounded-xl bg-slate-50 text-sm font-bold text-indigo-600">
                {Number(quickPayStudent.tuitionFee || 0).toLocaleString()}원
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => { setQuickPayStudent(null); setQuickPayDate(""); }} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg font-bold">취소</button>
              <button
                onClick={handleQuickPaySave}
                disabled={!quickPayDate}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 shadow-md disabled:opacity-40"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 일괄 메시지 발송 모달 */}
      {showBulkModal && (
        <BulkMessageModal
          students={list.filter((s) => selectedIds.includes(s.id))}
          messageLogs={messageLogs}
          paymentUrl={paymentUrl}
          onSaveLog={onSaveMessageLog}
          onClose={() => setShowBulkModal(false)}
          showToast={showToast}
          user={user}
        />
      )}

      {selectedStudent && !notifMode && (
        <PaymentDetailModal
          student={selectedStudent}
          onClose={() => setSelectedStudentId(null)}
          onSavePayment={onSavePayment}
          onUpdatePaymentHistory={onUpdatePaymentHistory}
          onUpdateStudent={onUpdateStudent}
          showToast={showToast}
        />
      )}

      {/* 헤더 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 shrink-0 gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-bold flex items-center mr-2">
            <CreditCard className="mr-2" /> 수납 관리
          </h2>
          {/* 모드 탭 */}
          <div className="flex rounded-lg overflow-hidden border text-sm">
            <button
              onClick={() => { setNotifMode(false); setSelectedIds([]); }}
              className={`px-3 py-1.5 font-medium transition-colors ${!notifMode ? "bg-indigo-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
            >
              명단 관리
            </button>
            <button
              onClick={() => { setNotifMode(true); setSelectedIds([]); }}
              className={`px-3 py-1.5 font-medium transition-colors flex items-center gap-1 ${notifMode ? "bg-indigo-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
            >
              <MessageSquareText size={14} /> 안내 발송
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              placeholder="이름, 과목, 강사 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-1.5 border rounded-lg text-sm bg-slate-50 focus:outline-indigo-500 w-44"
            />
          </div>
          <select
            value={selectedTeacher}
            onChange={(e) => setSelectedTeacher(e.target.value)}
            className="py-1.5 px-3 border rounded-lg text-sm bg-slate-50 focus:outline-indigo-500"
          >
            <option value="">강사 전체</option>
            {teacherOptions.map((t) => (<option key={t} value={t}>{t}</option>))}
          </select>
          {!notifMode && (
            <button
              onClick={() => setFilterDue(!filterDue)}
              className={`px-3 py-1.5 rounded text-sm border flex items-center transition-colors ${filterDue ? "bg-rose-50 border-rose-200 text-rose-600" : "bg-white hover:bg-slate-50"}`}
            >
              <AlertCircle size={14} className="mr-1" /> {filterDue ? "전체 보기" : "미납/만료만"}
            </button>
          )}
          <button
            onClick={() => setFilterWeek(!filterWeek)}
            className={`px-3 py-1.5 rounded text-sm border flex items-center transition-colors ${filterWeek ? "bg-violet-50 border-violet-300 text-violet-700 font-bold" : "bg-white hover:bg-slate-50"}`}
          >
            <AlertCircle size={14} className="mr-1" /> {filterWeek ? "주간 해제" : "주간 미발송"}
          </button>
          <button
            onClick={() => setSentFilter(sentFilter === "" ? "unsent" : sentFilter === "unsent" ? "sent" : "")}
            className={`px-3 py-1.5 rounded text-sm border flex items-center transition-colors ${
              sentFilter === "unsent"
                ? "bg-amber-50 border-amber-300 text-amber-700 font-bold"
                : sentFilter === "sent"
                ? "bg-indigo-50 border-indigo-200 text-indigo-700 font-bold"
                : "bg-white hover:bg-slate-50"
            }`}
          >
            <MessageSquareText size={14} className="mr-1" />
            {sentFilter === "unsent" ? "미발송만" : sentFilter === "sent" ? "발송됨만" : "발송 필터"}
          </button>
        </div>
      </div>

      {/* 안내 발송 모드: 일괄 액션 바 */}
      {notifMode && (
        <div className="flex items-center justify-between mb-3 shrink-0 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedIds(selectedIds.length === list.length ? [] : list.map((s) => s.id))}
              className="text-sm text-indigo-700 font-bold hover:underline"
            >
              {selectedIds.length === list.length ? "전체 해제" : "전체 선택"}
            </button>
            <span className="text-sm text-slate-500">
              미납/만료 <span className="font-bold text-rose-600">{list.length}명</span> 중{" "}
              <span className="font-bold text-indigo-700">{selectedIds.length}명</span> 선택
            </span>
            <span className="text-sm text-slate-400">|</span>
            <span className="text-sm text-slate-500">
              총 미납금액{" "}
              <span className="font-bold text-rose-600">
                {(selectedIds.length > 0
                  ? list.filter((s) => selectedIds.includes(s.id))
                  : list
                ).reduce((sum, s) => sum + (Number(s.tuitionFee) || 0), 0).toLocaleString()}원
              </span>
              {selectedIds.length > 0 && (
                <span className="text-xs text-indigo-500 ml-1">(선택된 {selectedIds.length}명)</span>
              )}
            </span>
          </div>
          <button
            onClick={() => { if (selectedIds.length > 0) setShowBulkModal(true); else showToast("학생을 선택해주세요.", "error"); }}
            className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-sm flex items-center gap-1"
          >
            <MessageSquareText size={15} /> 메시지 생성 ({selectedIds.length})
          </button>
        </div>
      )}

      <div className="flex-1 overflow-auto border rounded-lg">
        <table className="w-full text-left min-w-[640px]">
          <thead className="sticky top-0 bg-slate-50 border-b">
            <tr className="text-slate-500 text-xs uppercase">
              {notifMode && (
                <th className="py-3 px-3 w-8">
                  <input
                    type="checkbox"
                    checked={list.length > 0 && selectedIds.length === list.length}
                    onChange={() => setSelectedIds(selectedIds.length === list.length ? [] : list.map((s) => s.id))}
                    className="w-4 h-4 rounded accent-indigo-600"
                    title="전체 선택"
                  />
                </th>
              )}
              <th className="py-3 px-4">이름/과목</th>
              <th className="py-3 px-4">강사</th>
              <th className="py-3 px-4">원비</th>
              <th className="py-3 px-4">진척도</th>
              <th className="py-3 px-4">상태</th>
              {notifMode ? (
                <>
                  <th className="py-3 px-4">마지막 안내</th>
                  <th className="py-3 px-4 text-center">결제 완료</th>
                </>
              ) : (
                <th className="py-3 px-4 text-center">안내</th>
              )}
            </tr>
          </thead>
          <tbody>
            {list.map((s) => {
              const { currentUsage, sessionUnit, displayStatus, statusColor } = getStudentProgress(s);
              const lastNotif = getLastNotifDate(s.id);
              return (
                <tr
                  key={s.id}
                  className={`border-b transition-colors ${notifMode ? (selectedIds.includes(s.id) ? "bg-indigo-50" : "hover:bg-slate-50") : "hover:bg-slate-50 cursor-pointer"}`}
                  onClick={() => { if (!notifMode) setSelectedStudentId(s.id); else toggleSelect(s.id); }}
                >
                  {notifMode && (
                    <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(s.id)}
                        onChange={() => toggleSelect(s.id)}
                        className="w-4 h-4 rounded accent-indigo-600"
                      />
                    </td>
                  )}
                  <td className="py-3 px-4 font-medium">
                    {s.name}{" "}
                    {s.subject && <span className="text-xs text-slate-500 ml-1">({s.subject})</span>}
                    {s.phone && <div className="text-xs text-slate-400">{s.phone}</div>}
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-600">
                    {s.teacher || <span className="text-slate-300">-</span>}
                  </td>
                  <td className="py-3 px-4 font-bold text-indigo-600">
                    {s.tuitionFee ? Number(s.tuitionFee).toLocaleString() : 0}
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-slate-700">
                    {currentUsage} / {sessionUnit}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2 py-1 rounded text-xs ${statusColor}`}>{displayStatus}</span>
                  </td>
                  {notifMode ? (
                    <>
                      <td className="py-3 px-4 text-xs">
                        {lastNotif ? (
                          <span className="text-emerald-600 font-medium">{lastNotif}</span>
                        ) : (
                          <span className="text-slate-300">미발송</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => {
                            setQuickPayStudent(s);
                            setQuickPayDate(new Date().toISOString().split("T")[0]);
                          }}
                          className="px-2 py-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 font-medium"
                        >
                          결제 완료
                        </button>
                      </td>
                    </>
                  ) : (
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={(e) => handleOpenMsgPreview(e, s)}
                        className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                        title="안내 문자 미리보기"
                      >
                        <MessageSquareText size={18} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr>
                <td colSpan={notifMode ? 8 : 6} className="py-10 text-center text-slate-400">
                  {notifMode ? "결제 안내가 필요한 학생이 없습니다." : "데이터가 없습니다."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// [BulkMessageModal] - 일괄 메시지 생성 및 발송 완료 처리
const BulkMessageModal = ({ students, messageLogs, paymentUrl, onSaveLog, onClose, showToast, user }) => {
  const today = new Date().toISOString().split("T")[0];
  // 발송 완료 체크 state: { studentId: boolean }
  const [sent, setSent] = useState({});
  // 편집된 메시지 내용: { studentId: string }
  const [messages, setMessages] = useState(() => {
    const init = {};
    students.forEach((s) => { init[s.id] = generatePaymentMessage(s, paymentUrl); });
    return init;
  });
  const [activeIdx, setActiveIdx] = useState(0);

  const activeStudent = students[activeIdx];

  const handleCopySingle = (studentId) => {
    const msg = messages[studentId];
    if (navigator.clipboard) {
      navigator.clipboard.writeText(msg).then(() => showToast("복사되었습니다.", "success"));
    }
  };

  const handleCopyAll = () => {
    const combined = students.map((s) => `=== ${s.name} ===\n${messages[s.id]}`).join("\n\n");
    if (navigator.clipboard) {
      navigator.clipboard.writeText(combined).then(() => showToast(`${students.length}명 전체 복사 완료`, "success"));
    }
  };

  // 알리고 SMS 직접 발송
  const [sending, setSending] = useState({});
  const handleSendSms = async (s) => {
    if (!s.phone) {
      showToast(`${s.name}: 연락처가 없습니다.`, "warning");
      return;
    }
    if (sending[s.id]) return;
    setSending((prev) => ({ ...prev, [s.id]: true }));
    try {
      await sendAligoSms(s.phone, messages[s.id]);
      showToast(`${s.name} 문자 발송 완료`, "success");
      // 발송 완료 이력도 자동 저장
      await handleMarkSent(s);
    } catch (e) {
      showToast(`${s.name} 발송 실패: ${e.message}`, "error");
    } finally {
      setSending((prev) => ({ ...prev, [s.id]: false }));
    }
  };

  const handleMarkSent = async (s) => {
    if (sent[s.id]) return;
    try {
      if (onSaveLog) {
        await onSaveLog({
          studentId: s.id,
          studentName: s.name,
          phone: s.phone || "",
          sentAt: today,
          channel: "수동복사",
          messageType: "결제안내",
          sentBy: user?.name || "원장",
        });
      }
      setSent((prev) => ({ ...prev, [s.id]: true }));
      showToast(`${s.name} 발송 완료 처리되었습니다.`, "success");
    } catch (e) {
      showToast("저장 오류: " + e.message, "error");
    }
  };

  const getLastNotif = (studentId) => {
    const logs = (messageLogs || [])
      .filter((l) => l.studentId === studentId)
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    return logs.length > 0 ? logs[0].sentAt : null;
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col h-[90vh]">
        {/* 헤더 */}
        <div className="flex justify-between items-center p-4 border-b shrink-0">
          <h3 className="text-lg font-bold flex items-center text-indigo-900">
            <MessageSquareText className="mr-2" size={20} />
            일괄 안내 메시지 ({students.length}명)
          </h3>
          <div className="flex gap-2">
            <button
              onClick={handleCopyAll}
              className="px-3 py-1.5 text-xs border border-indigo-300 text-indigo-700 rounded-lg font-bold hover:bg-indigo-50 flex items-center gap-1"
            >
              <Copy size={13} /> 전체 복사
            </button>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* 왼쪽: 학생 목록 */}
          <div className="w-44 shrink-0 border-r overflow-y-auto bg-slate-50">
            {students.map((s, idx) => {
              const lastNotif = getLastNotif(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveIdx(idx)}
                  className={`w-full text-left px-3 py-2.5 border-b text-sm transition-colors ${activeIdx === idx ? "bg-indigo-100 border-l-4 border-l-indigo-600" : "hover:bg-white"}`}
                >
                  <div className="font-medium truncate">{s.name}</div>
                  <div className="text-xs text-slate-400 truncate">{s.subject}</div>
                  {sent[s.id] && <div className="text-xs text-emerald-600 font-bold mt-0.5">✓ 발송완료</div>}
                  {!sent[s.id] && lastNotif && <div className="text-xs text-slate-400 mt-0.5">최근: {lastNotif}</div>}
                </button>
              );
            })}
          </div>

          {/* 오른쪽: 메시지 편집 */}
          {activeStudent && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0">
                <div>
                  <span className="font-bold text-slate-800">{activeStudent.name}</span>
                  <span className="text-xs text-slate-500 ml-2">{activeStudent.phone || "연락처 없음"}</span>
                  {(() => {
                    const lastNotif = getLastNotif(activeStudent.id);
                    return lastNotif ? <span className="text-xs text-emerald-600 ml-2">최근 안내: {lastNotif}</span> : null;
                  })()}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleCopySingle(activeStudent.id)}
                    className="px-3 py-1.5 text-xs border rounded-lg font-bold flex items-center gap-1 hover:bg-slate-50"
                  >
                    <Copy size={13} /> 복사
                  </button>
                  <button
                    onClick={() => handleSendSms(activeStudent)}
                    disabled={!!sent[activeStudent.id] || !!sending[activeStudent.id]}
                    className={`px-3 py-1.5 text-xs rounded-lg font-bold flex items-center gap-1 transition-colors ${
                      sent[activeStudent.id]
                        ? "bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-default"
                        : sending[activeStudent.id]
                        ? "bg-blue-100 text-blue-600 border border-blue-200 cursor-wait"
                        : "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                    }`}
                  >
                    {sent[activeStudent.id] ? "✓ 발송완료" : sending[activeStudent.id] ? "발송 중..." : "📱 문자 발송"}
                  </button>
                  <button
                    onClick={() => handleMarkSent(activeStudent)}
                    disabled={!!sent[activeStudent.id]}
                    className={`px-3 py-1.5 text-xs rounded-lg font-bold flex items-center gap-1 transition-colors ${sent[activeStudent.id] ? "bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-default" : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"}`}
                  >
                    {sent[activeStudent.id] ? "✓ 완료" : "완료 처리"}
                  </button>
                </div>
              </div>
              <textarea
                className="flex-1 mx-4 mb-4 border rounded-xl p-4 text-sm font-sans leading-relaxed focus:outline-indigo-500 resize-none bg-slate-50"
                value={messages[activeStudent.id] || ""}
                onChange={(e) => setMessages((prev) => ({ ...prev, [activeStudent.id]: e.target.value }))}
                spellCheck="false"
              />
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="p-4 border-t bg-slate-50 rounded-b-2xl flex justify-between items-center shrink-0">
          <span className="text-xs text-slate-500">
            발송 완료: <span className="font-bold text-emerald-600">{Object.values(sent).filter(Boolean).length}</span> / {students.length}명
          </span>
          <button onClick={onClose} className="px-5 py-2 bg-slate-200 text-slate-700 rounded-lg font-bold hover:bg-slate-300">닫기</button>
        </div>
      </div>
    </div>
  );
};

// [Main App] //
// // [App.js] 메인 컴포넌트 - ID 누락 및 경로 문제 해결
export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [currentUser, setCurrentUser] = useState(null);

  // 데이터 상태
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [reports, setReports] = useState([]);
  const [adminPassword, setAdminPassword] = useState("1123"); // 기본값, Firestore에서 덮어씌움
  const [messageLogs, setMessageLogs] = useState([]);
  const [paymentUrl, setPaymentUrl] = useState(""); // settings/messaging에서 로드

  // UI 상태
  const [registerFromConsultation, setRegisterFromConsultation] =
    useState(null);
  const [message, setMessage] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  // 강사 메모 알림 상태
  const [pendingMemos, setPendingMemos] = useState([]);
  const [showMemoPopup, setShowMemoPopup] = useState(false);
  const [today, setToday] = useState(new Date());
  const [targetConsultation, setTargetConsultation] = useState(null);

  useEffect(() => {
    setToday(new Date());
  }, []);
  const formattedDate = `${today.getFullYear()}년 ${
    today.getMonth() + 1
  }월 ${today.getDate()}일`;

  // =================================================================
  // [핵심] 데이터 실시간 로딩 - 순서 변경 및 ID 강제 주입
  // =================================================================
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

    const unsubscribes = [];
    signInAnonymously(auth).then(() => {
      console.log("Firebase 접속 성공");
      const safeAppId = APP_ID || "jnc-music-v2"; // 안전장치

      // 1. 학생
      unsubscribes.push(onSnapshot(
        collection(db, "artifacts", safeAppId, "public", "data", "students"),
        (s) => setStudents(s.docs.map((d) => ({ ...d.data(), id: d.id })))
      ));

      // 2. 강사
      unsubscribes.push(onSnapshot(
        collection(db, "artifacts", safeAppId, "public", "data", "teachers"),
        (s) => {
          const updated = s.docs.map((d) => ({ ...d.data(), id: d.id }));
          setTeachers(updated);
          // 현재 로그인된 강사의 pendingMemos 실시간 반영
          setCurrentUser((prev) => {
            if (prev?.role === "teacher") {
              const me = updated.find((t) => t.name === prev.name);
              const memos = me?.pendingMemos || [];
              setPendingMemos(memos);
            }
            return prev;
          });
        }
      ));

      // 3. 상담
      unsubscribes.push(onSnapshot(
        collection(
          db,
          "artifacts",
          safeAppId,
          "public",
          "data",
          "consultations"
        ),
        (s) => setConsultations(s.docs.map((d) => ({ ...d.data(), id: d.id })))
      ));

      // 4-0. 관리자 비밀번호
      unsubscribes.push(onSnapshot(
        doc(db, "artifacts", safeAppId, "public", "data", "settings", "admin"),
        (d) => { if (d.exists() && d.data().password) setAdminPassword(d.data().password); }
      ));

      // 4. [문제 해결] 보고서 데이터 (ID가 덮어씌워지지 않도록 순서 변경)
      unsubscribes.push(onSnapshot(
        collection(db, "artifacts", safeAppId, "public", "data", "reports"),
        (s) => {
          const loadedReports = s.docs.map((d) => ({
            ...d.data(), // 1. 데이터를 먼저 펼치고
            id: d.id, // 2. ID를 나중에 덮어씌움 (ID 보장)
          }));
          setReports(loadedReports);
        }
      ));

      // 5. 메시지 발송 이력
      unsubscribes.push(onSnapshot(
        collection(db, "artifacts", safeAppId, "public", "data", "messageLogs"),
        (s) => setMessageLogs(s.docs.map((d) => ({ ...d.data(), id: d.id })))
      ));

      // 6. 결제 링크 설정 (결제선생 URL 등)
      unsubscribes.push(onSnapshot(
        doc(db, "artifacts", safeAppId, "public", "data", "settings", "messaging"),
        (d) => { if (d.exists()) setPaymentUrl(d.data().paymentUrl || ""); }
      ));
    });
    // cleanup: StrictMode에서 리스너 중복 등록 방지
    return () => unsubscribes.forEach((unsub) => unsub());
  }, []);

  const showToast = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  const seedData = async () => {
    const batch = writeBatch(db);
    INITIAL_TEACHERS_LIST.forEach((name) =>
      batch.set(
        doc(collection(db, "artifacts", APP_ID, "public", "data", "teachers")),
        { name, days: [1, 2, 3, 4, 5], createdAt: new Date().toISOString() }
      )
    );
    // 관리자 비밀번호 기본값 설정
    batch.set(
      doc(db, "artifacts", APP_ID, "public", "data", "settings", "admin"),
      { password: "1123" },
      { merge: true }
    );
    await batch.commit();
    showToast("기본 데이터 생성 완료");
  };

  // -----------------------------------------------------------
  // [메시지 발송 이력 저장]
  // -----------------------------------------------------------
  const handleSaveMessageLog = async (logData) => {
    try {
      const safeAppId = APP_ID || "jnc-music-v2";
      await addDoc(
        collection(db, "artifacts", safeAppId, "public", "data", "messageLogs"),
        { ...logData, createdAt: new Date().toISOString() }
      );
    } catch (e) {
      console.error("메시지 이력 저장 오류:", e);
    }
  };

  // -----------------------------------------------------------
  // [삭제 함수] 보고서 삭제
  // -----------------------------------------------------------
  const handleDeleteReport = async (reportId) => {
    if (!reportId) {
      alert("삭제할 문서 ID가 없습니다.");
      return;
    }
    if (!window.confirm("정말 삭제하시겠습니까?")) return;

    try {
      const safeAppId = APP_ID || "jnc-music-v2";
      // 1차 시도: 완전 삭제
      await deleteDoc(
        doc(db, "artifacts", safeAppId, "public", "data", "reports", reportId)
      );
      showToast("보고서가 삭제되었습니다.", "success");
    } catch (e) {
      console.error(e);
      // 2차 시도: Soft Delete
      try {
        const safeAppId = APP_ID || "jnc-music-v2";
        await updateDoc(
          doc(
            db,
            "artifacts",
            safeAppId,
            "public",
            "data",
            "reports",
            reportId
          ),
          { isDeleted: true }
        );
        showToast("보고서가 삭제(숨김)되었습니다.", "success");
      } catch (err) {
        showToast("삭제 실패: " + e.message, "error");
      }
    }
  };

  const handleSaveReport = async (reportData) => {
    const safeAppId = APP_ID || "jnc-music-v2";
    try {
      if (reportData.id) {
        await updateDoc(
          doc(
            db,
            "artifacts",
            safeAppId,
            "public",
            "data",
            "reports",
            reportData.id
          ),
          reportData
        );
        showToast("보고서가 수정되었습니다.");
      } else {
        await addDoc(
          collection(db, "artifacts", safeAppId, "public", "data", "reports"),
          reportData
        );
        showToast("보고서가 등록되었습니다.");
      }
    } catch (e) {
      showToast("저장 실패", "error");
    }
  };

  const handleSavePayment = async (
    studentId,
    date,
    amount,
    realSessionStartDate = date
  ) => {
    const safeAppId = APP_ID || "jnc-music-v2";
    try {
      const studentRef = doc(
        db,
        "artifacts",
        safeAppId,
        "public",
        "data",
        "students",
        studentId
      );
      const student = students.find((s) => s.id === studentId);
      if (!student) return;
      const newHistoryItem = {
        date,
        amount,
        type: "tuition",
        sessionStartDate: realSessionStartDate,
        totalSessions: getEffectiveSessions(student),
        createdAt: new Date().toISOString(),
      };
      const updatedHistory = [
        ...(student.paymentHistory || []),
        newHistoryItem,
      ];
      await updateDoc(studentRef, {
        paymentHistory: updatedHistory,
        lastPaymentDate: realSessionStartDate,
        sessionsCompleted: 0,
      });
      showToast("결제 완료", "success");
    } catch (e) {
      showToast("결제 오류", "error");
    }
  };

  const handleUpdatePaymentHistory = async (studentId, newHistory) => {
    const safeAppId = APP_ID || "jnc-music-v2";
    try {
      const studentRef = doc(
        db,
        "artifacts",
        safeAppId,
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
        newLastPaymentDate =
          sortedHistory[0].sessionStartDate || sortedHistory[0].date;
      }
      const newSessionCount = (student.attendanceHistory || []).filter(
        (h) => h.status === "present" && h.date >= newLastPaymentDate
      ).length;
      await updateDoc(studentRef, {
        paymentHistory: newHistory,
        lastPaymentDate: newLastPaymentDate,
        sessionsCompleted: newSessionCount,
      });
      showToast("수정 완료", "success");
    } catch (e) {
      showToast("수정 실패", "error");
    }
  };
  // ▼▼▼▼▼ [여기서부터 복사] return ( 바로 위에 붙여넣으세요! ▼▼▼▼▼

  // 1. [가장 먼저 정의] 로그인 처리 함수
  const handleLoginProcess = (user) => {
    setCurrentUser(user);
    setIsLoginModalOpen(false);
    setActiveTab("dashboard");
    showToast(`${user.name}님 환영합니다.`, "success");

    // 강사 로그인 시 pendingMemos 확인 후 팝업 표시
    if (user.role === "teacher") {
      const teacherData = teachers.find((t) => t.name === user.name);
      const memos = teacherData?.pendingMemos || [];
      if (memos.length > 0) {
        setPendingMemos(memos);
        setShowMemoPopup(true);
      } else {
        setPendingMemos([]);
      }
    }
  };

  // 강사 메모 알림 확인 완료 처리 (Firestore pendingMemos 초기화)
  const handleMemoDismiss = async () => {
    setShowMemoPopup(false);
    setPendingMemos([]);
    if (currentUser?.role === "teacher") {
      const teacherData = teachers.find((t) => t.name === currentUser.name);
      if (teacherData) {
        const teacherRef = doc(db, "artifacts", APP_ID, "public", "data", "teachers", teacherData.id);
        try {
          await updateDoc(teacherRef, { pendingMemos: [] });
        } catch (e) {
          // silent fail
        }
      }
    }
  };

  // 2. [정의] 로그아웃 처리 함수
  const handleLogout = () => {
    if (window.confirm("로그아웃 하시겠습니까?")) {
      setCurrentUser(null);
      setActiveTab("dashboard");
    }
  };

  // 3. [정의] 학생 정보 저장 및 수정 (신규/수정 자동 판단 + 즉시 저장)
  const handleUpdateStudent = async (id, updatedData) => {
    try {
      const safeAppId = APP_ID || "jnc-music-v2";

      // 퇴원 처리 시 퇴원일 자동 기록 (이미 설정된 경우 덮어쓰지 않음)
      if (updatedData.status === "퇴원" && !updatedData.withdrawalDate) {
        const existingStudent = students.find((s) => s.id === id);
        if (!existingStudent?.withdrawalDate) {
          updatedData = { ...updatedData, withdrawalDate: new Date().toISOString().slice(0, 10) };
        }
      }
      // 재등록 시 퇴원일 제거
      if (updatedData.status === "재원" && updatedData.withdrawalDate === null) {
        updatedData = { ...updatedData, withdrawalDate: "" };
      }

      if (id) {
        // 1. Firebase DB 업데이트
        const studentRef = doc(
          db,
          "artifacts",
          safeAppId,
          "public",
          "data",
          "students",
          id
        );
        await updateDoc(studentRef, updatedData);
        // onSnapshot이 자동으로 상태를 동기화합니다
        showToast("정보가 성공적으로 수정되었습니다.", "success");
      } else {
        // 상담에서 넘어온 경우: 이미 등록된 원생이 있는지 중복 체크
        if (updatedData.fromConsultationId) {
          const existingStudent = students.find(
            (s) => s.fromConsultationId === updatedData.fromConsultationId
          );
          if (existingStudent) {
            // 이미 등록된 원생 → 신규 생성 대신 기존 데이터 업데이트
            const studentRef = doc(
              db, "artifacts", safeAppId, "public", "data", "students", existingStudent.id
            );
            await updateDoc(studentRef, updatedData);
            // onSnapshot이 자동으로 상태를 동기화합니다
            showToast("기존 원생 정보가 수정되었습니다.", "success");
            return;
          }
        }

        // 신규 등록 로직
        const studentsRef = collection(
          db,
          "artifacts",
          safeAppId,
          "public",
          "data",
          "students"
        );
        await addDoc(studentsRef, {
          ...updatedData,
          createdAt: new Date().toISOString(),
        });
        // onSnapshot이 자동으로 상태를 동기화합니다

        // 상담에서 넘어온 경우 상담 상태를 "registered"로 변경
        if (updatedData.fromConsultationId) {
          try {
            const consultRef = doc(
              db, "artifacts", safeAppId, "public", "data", "consultations", updatedData.fromConsultationId
            );
            await updateDoc(consultRef, { status: "registered" });
          } catch (err) {
            console.error("상담 상태 업데이트 실패:", err);
          }
        }

        showToast("새 원생이 등록되었습니다.", "success");
      }
    } catch (e) {
      console.error("저장 실패:", e);
      showToast("저장에 실패했습니다. 관리자에게 문의하세요.", "error");
    }
  };

  // 4. [정의] 학생 삭제
  const handleDeleteStudent = async (studentId) => {
    if (window.confirm("정말 삭제하시겠습니까? (복구 불가)")) {
      try {
        const safeAppId = APP_ID || "jnc-music-v2";

        await deleteDoc(
          doc(db, "artifacts", safeAppId, "public", "data", "students", studentId)
        );
        // onSnapshot이 자동으로 상태를 동기화합니다
        showToast("삭제되었습니다.", "success");
      } catch (e) {
        console.error(e);
        showToast("삭제 실패: " + e.message, "error");
      }
    }
  };

  // 5. [에러 해결 완료] 상담 -> 원생 등록 데이터 연동 함수
  const handleRegisterFromConsultation = (consultation) => {
    // 1. 상담 데이터를 원생 양식으로 변환
    const transferData = {
      name: consultation.name || "",
      phone: consultation.phone || "",
      subject: consultation.subject || "",
      grade: consultation.type === "adult" ? "성인" : (consultation.grade || ""),
      note: consultation.note || "",
      fromConsultationId: consultation.id, // 등록 완료 처리를 위해
      status: "재원",
      registrationDate: new Date().toISOString().slice(0, 10),
      totalSessions: 4,
      schedules: {},
      teacher: "",
    };

    // 2. 탭 이동
    setActiveTab("students");

    // 3. [핵심] StudentView가 낚아챌 바구니에 데이터 주입
    // → StudentView의 useEffect가 감지하여 모달을 자동으로 열어줌
    setRegisterFromConsultation(transferData);

    showToast(`${consultation.name}님의 정보를 불러왔습니다.`, "success");
  };

  // 6. [화면 표시] 로그인 안 되어 있을 때 (함수들이 다 만들어진 뒤에 실행됨!)
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
          onLogin={handleLoginProcess}
          showToast={showToast}
          isInitialLogin={true}
          adminPassword={adminPassword}
        />
      </div>
    );
  }

  // ▲▲▲▲▲ [여기까지] return ( 바로 위에 있어야 합니다 ▲▲▲▲▲
  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* 키오스크 모드: 전체화면 오버레이 */}
      {activeTab === "kiosk" && (
        <KioskView
          students={students}
          onExitKiosk={() => setActiveTab("dashboard")}
        />
      )}

      {/* 0. 강사 메모 알림 팝업 (로그인 직후) */}
      {showMemoPopup && (
        <MemoNoticePopup
          memos={pendingMemos}
          onDismiss={handleMemoDismiss}
        />
      )}

      {/* 1. 알림 메시지 */}
      {message && (
        <div
          className={`fixed top-6 right-6 z-[100] px-6 py-3 rounded-2xl shadow-2xl text-white font-bold animate-in slide-in-from-right duration-300 ${
            message.type === "error" ? "bg-rose-500" : "bg-emerald-600"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* 2. 로그인/계정전환 모달 */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        teachers={teachers}
        onLogin={handleLoginProcess}
        showToast={showToast}
        isInitialLogin={!currentUser}
        adminPassword={adminPassword}
      />

      {/* 3-0. 모바일 사이드바 backdrop (수정됨: 블러 효과 추가) */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* 3. 좌측 사이드바 (3단 구조: 헤더 - 스크롤 메뉴 - 하단 고정) */}
      <div
        className={`fixed md:static inset-y-0 left-0 z-50 w-64 bg-white border-r transform transition-transform duration-300 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        } shadow-lg md:shadow-none flex flex-col h-full`}
      >
        {/* (A) 헤더 (로고) */}
        <div className="p-6 border-b flex justify-center shrink-0">
          <h1 className="text-xl font-bold tracking-tight">
            JnC Music<span className="text-indigo-600">.</span>
          </h1>
        </div>

        {/* (B) 메뉴 (여기에만 스크롤이 생깁니다) */}
        <nav className="p-4 space-y-1 flex-1 overflow-y-auto scrollbar-hide">
          <SidebarItem
            icon={LayoutDashboard}
            label="대시보드"
            active={activeTab === "dashboard"}
            onClick={() => {
              setActiveTab("dashboard");
              setIsSidebarOpen(false);
            }}
          />
          {/* [1] Timetable 섹션 */}
          <div className="pt-4 pb-2 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
            Timetable
          </div>
          <button
            onClick={() => {
              setActiveTab("timetable");
              setIsSidebarOpen(false);
            }}
            // [수정] font-bold -> font-medium 으로 변경하여 두께를 줄임
            className={`w-full text-left px-4 py-3 rounded-xl mb-1 font-medium transition-all flex items-center ${
              activeTab === "timetable"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                : "text-slate-500 hover:bg-white hover:text-indigo-600"
            }`}
          >
            <LayoutGrid className="mr-3" size={20} /> 강사별 주간 시간표
          </button>
          <button
            onClick={() => {
              setActiveTab("subject_timetable");
              setIsSidebarOpen(false);
            }}
            // [수정] font-bold -> font-medium 으로 변경
            className={`w-full text-left px-4 py-3 rounded-xl mb-1 font-medium transition-all flex items-center ${
              activeTab === "subject_timetable"
                ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                : "text-slate-500 hover:bg-white hover:text-indigo-600"
            }`}
          >
            <BookOpen className="mr-3" size={20} /> 과목별 시간표 (외부)
          </button>
          {/* ▼ 일정 관리가 여기로 이사왔습니다! ▼ */}
          <SidebarItem
            icon={CalendarIcon}
            label="일정 관리"
            active={activeTab === "calendar"}
            onClick={() => {
              setActiveTab("calendar");
              setIsSidebarOpen(false);
            }}
          />
          {/* [2] Management 섹션 */}
          <div className="pt-4 pb-2 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
            Management
          </div>
          {/* 일정 관리는 위로 올라갔음 */}
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
            icon={Tablet}
            label="출석 단말기"
            active={activeTab === "kiosk"}
            onClick={() => {
              setActiveTab("kiosk");
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
          <SidebarItem
            icon={File}
            label="보고서 관리"
            active={activeTab === "reports"}
            onClick={() => {
              setActiveTab("reports");
              setIsSidebarOpen(false);
            }}
          />
          {/* [3] Admin 섹션 */}
          {currentUser.role === "admin" && (
            <>
              <div className="pt-4 pb-2 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                Admin
              </div>
              <SidebarItem
                icon={MessageSquareText}
                label="상담 관리"
                active={activeTab === "consultations"}
                onClick={() => {
                  setActiveTab("consultations");
                  setIsSidebarOpen(false);
                }}
              />
              <SidebarItem
                icon={CreditCard}
                label="수납 관리"
                active={activeTab === "payments"}
                onClick={() => {
                  setActiveTab("payments");
                  setIsSidebarOpen(false);
                }}
              />
              <SidebarItem
                icon={Send}
                label="공지 발송"
                active={activeTab === "bulkSms"}
                onClick={() => {
                  setActiveTab("bulkSms");
                  setIsSidebarOpen(false);
                }}
              />
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
          <div className="h-10"></div> {/* 하단 여백 */}
        </nav>
        {/* (C) 하단 프로필 & 로그아웃 (항상 바닥에 고정됨) */}
        <div className="p-4 border-t bg-slate-50 shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold shadow-sm">
              {currentUser.name[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-800 truncate">
                {currentUser.name} 님
              </p>
              <p className="text-[10px] text-slate-500 bg-white border px-1.5 py-0.5 rounded-full inline-block mt-0.5">
                {currentUser.role === "admin" ? "원장님" : "강사님"}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setIsLoginModalOpen(true)}
              className="flex-1 py-2 bg-white border border-slate-300 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-100 transition-colors flex items-center justify-center"
              title="계정 전환"
            >
              <RefreshCcw size={14} className="mr-1" /> 전환
            </button>
            <button
              onClick={handleLogout}
              className="flex-1 py-2 bg-rose-50 border border-rose-200 text-rose-600 text-xs font-bold rounded-lg hover:bg-rose-100 transition-colors flex items-center justify-center"
              title="로그아웃"
            >
              <Trash2 size={14} className="mr-1" /> 로그아웃
            </button>
          </div>
        </div>
      </div>

      {/* 4. 메인 컨텐츠 영역 */}
      <div className="flex-1 flex flex-col overflow-hidden w-full relative">
        <header className="hidden md:flex bg-white border-b py-3 px-8 justify-between items-center shrink-0">
          <h2 className="text-xl font-bold text-slate-800">
            {activeTab === "dashboard"
              ? "대시보드"
              : activeTab === "timetable"
              ? "강사별 주간 시간표"
              : activeTab === "subject_timetable"
              ? "과목별 운영 시간표"
              : activeTab === "students"
              ? "원생 관리"
              : activeTab === "attendance"
              ? "출석부"
              : activeTab === "classLog"
              ? "수업 일지"
              : activeTab === "reports"
              ? "월간 보고서"
              : activeTab === "payments"
              ? "수납 관리"
              : activeTab === "consultations"
              ? "상담 관리"
              : activeTab === "settings"
              ? "환경 설정"
              : "JnC Music"}
          </h2>
          <div className="text-sm font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
            {formattedDate}
          </div>
        </header>

        <header className="md:hidden bg-white border-b p-4 flex justify-between items-center shrink-0">
          <h1 className="font-bold text-lg">JnC Music</h1>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
          >
            {isSidebarOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </header>

        {/* 강사 메모 알림 배너 (완료 전까지 지속) */}
        {currentUser?.role === "teacher" && !showMemoPopup && pendingMemos.length > 0 && (
          <MemoNoticeBanner memos={pendingMemos} onDismiss={handleMemoDismiss} />
        )}

        <main className="flex-1 overflow-y-auto p-4 md:p-8 w-full bg-slate-50">
          {activeTab === "dashboard" && (
            <DashboardView
              students={students}
              consultations={consultations}
              reports={reports}
              user={currentUser}
              messageLogs={messageLogs}
              onNavigateToConsultation={(consult) => {
                setTargetConsultation(consult);
                setActiveTab("consultations");
              }}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}
          {activeTab === "timetable" && (
            <TeacherTimetableView students={students} teachers={teachers} />
          )}
          {activeTab === "subject_timetable" && (
            <SubjectTimetableView
              students={students}
              teachers={teachers}
              showToast={showToast}
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
              showToast={showToast}
            />
          )}
          {activeTab === "students" && (
            <StudentView
              students={students}
              teachers={teachers}
              showToast={showToast}
              user={currentUser}
              onDeleteStudent={handleDeleteStudent}
              setRegisterFromConsultation={setRegisterFromConsultation}
              registerFromConsultation={registerFromConsultation}
              onUpdateStudent={handleUpdateStudent}
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
          {activeTab === "reports" && (
            <ReportView
              user={currentUser}
              teachers={teachers}
              students={students}
              reports={reports}
              onSaveReport={handleSaveReport}
              onDeleteReport={handleDeleteReport}
              onUpdateStudent={handleUpdateStudent}
            />
          )}
          {activeTab === "payments" && currentUser.role === "admin" && (
            <PaymentView
              students={students}
              showToast={showToast}
              onSavePayment={handleSavePayment}
              onUpdatePaymentHistory={handleUpdatePaymentHistory}
              onUpdateStudent={handleUpdateStudent}
              messageLogs={messageLogs}
              onSaveMessageLog={handleSaveMessageLog}
              paymentUrl={paymentUrl}
              user={currentUser}
            />
          )}
          {activeTab === "consultations" && currentUser.role === "admin" && (
            <ConsultationView
              consultations={consultations}
              showToast={showToast}
              onRegisterStudent={handleRegisterFromConsultation} // 👈 이 연결이 핵심입니다!
              targetConsultation={targetConsultation}
              onClearTargetConsultation={() => setTargetConsultation(null)}
            />
          )}
          {activeTab === "bulkSms" && currentUser.role === "admin" && (
            <BulkSmsView
              students={students}
              teachers={teachers}
              showToast={showToast}
            />
          )}
          {activeTab === "settings" && currentUser.role === "admin" && (
            <SettingsView
              teachers={teachers}
              students={students}
              showToast={showToast}
              seedData={seedData}
              adminPassword={adminPassword}
              paymentUrl={paymentUrl}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// [TeacherTimetableView] - (파트필터 + 인쇄 + 보안 + 모바일최적화 + 중앙정렬/자동숨김 유지)
const TeacherTimetableView = ({ students, teachers, user }) => {
  // 1. 상태 관리
  const [selectedDay, setSelectedDay] = useState("월");
  const [viewMode, setViewMode] = useState("daily");
  const [selectedPart, setSelectedPart] = useState("전체"); // 파트 필터

  const printRef = useRef(null);

  const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
  // 운영 시간: 09:00 ~ 22:00
  const HOURS = Array.from({ length: 14 }, (_, i) => i + 9);

  // 파트 정의
  const PARTS = [
    { id: "전체", label: "전체" },
    { id: "피아노", label: "🎹 피아노" },
    { id: "관현악", label: "🎻 관현악" },
    { id: "실용", label: "🎸 실용" },
    { id: "성악", label: "🎤 성악" },
  ];

  // 과목 -> 파트 매핑
  const getPartBySubject = (subject) => {
    if (!subject) return "기타";
    if (subject.includes("피아노")) return "피아노";
    if (
      ["플루트", "클라리넷", "바이올린", "첼로"].some((s) =>
        subject.includes(s)
      )
    )
      return "관현악";
    if (["드럼", "기타", "베이스", "작곡"].some((s) => subject.includes(s)))
      return "실용";
    if (["성악", "보컬"].some((s) => subject.includes(s))) return "성악";
    return "기타";
  };

  const isTeacherMode = user?.role === "teacher";
  const myName = user?.name;

  // 오늘 요일 자동 세팅
  useEffect(() => {
    const todayIndex = new Date().getDay();
    const mapping = {
      1: "월",
      2: "화",
      3: "수",
      4: "목",
      5: "금",
      6: "토",
      0: "일",
    };
    setSelectedDay(mapping[todayIndex] || "월");
  }, []);

  // 이미지 저장
  const handleDownloadImage = async () => {
    if (!printRef.current) return;
    try {
      const canvas = await html2canvas(printRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      link.download = `시간표_${selectedPart}_${selectedDay}.png`;
      link.click();
    } catch (err) {
      console.error(err);
      alert("저장 실패");
    }
  };

  const handlePrint = () => window.print();

  const getSubjectColor = (subject) => {
    const part = getPartBySubject(subject);
    const map = {
      피아노: "bg-indigo-50 text-indigo-700 border-indigo-200",
      관현악: "bg-emerald-50 text-emerald-700 border-emerald-200",
      실용: "bg-amber-50 text-amber-700 border-amber-200",
      성악: "bg-rose-50 text-rose-700 border-rose-200",
    };
    return map[part] || "bg-slate-50 text-slate-600 border-slate-200";
  };

  const getLessonTime = (student, targetDay) => {
    if (student.status !== "재원") return null;
    if (student.schedules && student.schedules[targetDay])
      return student.schedules[targetDay];
    if (student.className === targetDay && student.time) return student.time;
    return null;
  };

  // 수업 데이터 필터링 (파트 필터 적용)
  const getLessons = (teacherName, day, hour) => {
    return students.filter((s) => {
      // 1. 기본 필터 (강사 매칭 & 보안)
      if (isTeacherMode && teacherName !== myName) return false;
      if (s.teacher !== teacherName) return false;

      // 2. 시간 확인
      const timeStr = getLessonTime(s, day);
      if (!timeStr) return false;
      const sHour = parseInt(timeStr.split(":")[0]);
      if (sHour !== hour) return false;

      // 3. 파트 필터 적용
      if (selectedPart !== "전체") {
        const studentPart = getPartBySubject(s.subject || "");
        if (studentPart !== selectedPart) return false;
      }

      return true;
    });
  };

  // 화면 표시 강사 목록 (자동 숨김 + 파트 필터 + 중앙 정렬용 데이터)
  const activeTeachers = useMemo(() => {
    let targetTeachers = teachers;

    // 강사 모드면 본인만
    if (isTeacherMode) {
      targetTeachers = teachers.filter((t) => t.name === myName);
    }

    // 관리자 모드: 해당 요일에 수업이 있고 && 선택된 파트 수업이 있는 강사만 표시 (자동 숨김)
    return targetTeachers.filter((t) => {
      const hasLesson = students.some((s) => {
        const isMyStudent = s.teacher === t.name;
        const hasTime = getLessonTime(s, selectedDay);

        let isPartMatch = true;
        if (selectedPart !== "전체") {
          isPartMatch = getPartBySubject(s.subject || "") === selectedPart;
        }

        return isMyStudent && hasTime && isPartMatch;
      });
      return hasLesson;
    });
  }, [teachers, students, selectedDay, isTeacherMode, myName, selectedPart]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 md:p-6 h-full flex flex-col overflow-hidden animate-fade-in relative z-0">
      {/* 상단 컨트롤바 (인쇄 시 숨김) */}
      <div className="flex flex-col gap-3 mb-4 shrink-0 print:hidden">
        {/* 1열: 타이틀 + 기능 버튼 */}
        <div className="flex justify-between items-center">
          <h2 className="text-lg md:text-xl font-bold flex items-center text-slate-800">
            <LayoutGrid className="mr-2 text-indigo-600" />
            {isTeacherMode ? `${myName} T 시간표` : "종합 시간표"}
          </h2>
          <div className="flex gap-2">
            <button
              onClick={handleDownloadImage}
              className="p-2 rounded-lg border hover:bg-slate-50 text-slate-500 shadow-sm"
              title="이미지 저장"
            >
              <Download size={18} />
            </button>
            <button
              onClick={handlePrint}
              className="p-2 rounded-lg border hover:bg-slate-50 text-slate-500 shadow-sm"
              title="출력하기"
            >
              <Printer size={18} />
            </button>
          </div>
        </div>

        {/* 2열: 파트 필터 & 보기 모드 & 요일 선택 */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-slate-50/50 p-2 rounded-xl border border-slate-100">
          {/* 파트 선택 버튼들 */}
          <div className="flex gap-1 overflow-x-auto max-w-full no-scrollbar pb-1 md:pb-0">
            {PARTS.map((part) => (
              <button
                key={part.id}
                onClick={() => setSelectedPart(part.id)}
                className={`px-3 py-1.5 rounded-lg text-xs md:text-sm font-bold whitespace-nowrap transition-all border ${
                  selectedPart === part.id
                    ? "bg-indigo-600 text-white border-indigo-600 shadow-md"
                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-100"
                }`}
              >
                {part.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2 w-full md:w-auto justify-end">
            {/* 강사 전용: 보기 모드 */}
            {isTeacherMode && (
              <div className="flex bg-white border border-slate-200 p-1 rounded-lg">
                <button
                  onClick={() => setViewMode("daily")}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold ${
                    viewMode === "daily"
                      ? "bg-slate-100 text-indigo-600"
                      : "text-slate-400"
                  }`}
                >
                  오늘
                </button>
                <button
                  onClick={() => setViewMode("weekly")}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold ${
                    viewMode === "weekly"
                      ? "bg-slate-100 text-indigo-600"
                      : "text-slate-400"
                  }`}
                >
                  주간
                </button>
              </div>
            )}

            {/* 요일 선택 (관리자 or 강사 일간모드) */}
            {(!isTeacherMode || (isTeacherMode && viewMode === "daily")) && (
              <div className="flex bg-white border border-slate-200 p-1 rounded-lg overflow-x-auto max-w-[180px] md:max-w-none no-scrollbar">
                {DAYS.map((day) => (
                  <button
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap ${
                      selectedDay === day
                        ? "bg-indigo-50 text-indigo-600"
                        : "text-slate-400 hover:text-slate-600"
                    }`}
                  >
                    {day}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 시간표 영역 (인쇄 대상) */}
      <div
        className="flex-1 overflow-auto border rounded-xl bg-slate-50/50 relative print:overflow-visible print:bg-white print:border-none"
        ref={printRef}
      >
        <div className="inline-block min-w-full pb-20 print:pb-0">
          {/* 헤더 */}
          <div className="flex border-b bg-white sticky top-0 z-10 shadow-sm print:static print:shadow-none print:border-slate-300">
            <div className="w-[50px] md:w-[80px] p-2 md:p-4 text-center text-[10px] md:text-xs font-bold text-slate-400 border-r bg-slate-50 sticky left-0 z-20 shrink-0 flex items-center justify-center print:bg-white print:border-slate-300">
              TIME
            </div>

            {isTeacherMode && viewMode === "weekly" ? (
              // 강사 주간 보기
              <div className="flex flex-1 min-w-max">
                {DAYS.map((day) => (
                  <div
                    key={day}
                    className={`flex-1 min-w-[100px] md:min-w-[140px] p-2 md:p-4 text-center text-sm md:text-base font-bold border-r bg-white print:border-slate-300 ${
                      selectedDay === day
                        ? "text-indigo-600 bg-indigo-50/30 print:bg-transparent"
                        : "text-slate-800"
                    }`}
                  >
                    {day}
                  </div>
                ))}
              </div>
            ) : (
              // 관리자/강사 일간 보기 (🔥 중앙 정렬 justify-center 적용됨)
              <div className="flex flex-1 justify-center min-w-max">
                {activeTeachers.length > 0 ? (
                  activeTeachers.map((t) => (
                    <div
                      key={t.id}
                      className="w-[120px] md:w-[160px] p-2 md:p-4 text-center text-sm md:text-base font-bold border-r text-slate-800 bg-white shrink-0 print:border-slate-300"
                    >
                      {isTeacherMode ? `${selectedDay}요일` : `${t.name} T`}
                    </div>
                  ))
                ) : (
                  <div className="flex-1 p-4 text-center text-slate-400 font-medium whitespace-nowrap text-sm">
                    {selectedPart === "전체"
                      ? `📅 ${selectedDay}요일 수업 없음`
                      : `🔍 [${selectedPart}] 파트 수업 없음`}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 바디 */}
          <div className="divide-y divide-slate-200 print:divide-slate-300">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="flex min-h-[80px] md:min-h-[100px] print:min-h-[80px]"
              >
                {/* 시간축 */}
                <div className="w-[50px] md:w-[80px] p-1 md:p-2 text-center text-[10px] md:text-xs font-bold text-slate-400 border-r bg-white flex flex-col justify-start pt-2 sticky left-0 z-10 shrink-0 print:static print:border-slate-300">
                  {hour}:00
                </div>

                {isTeacherMode && viewMode === "weekly" ? (
                  // 강사 주간 보기 바디
                  <div className="flex flex-1 min-w-max">
                    {DAYS.map((day) => {
                      const lessons = getLessons(myName, day, hour);
                      const isWeekend = day === "토" || day === "일";
                      const opStart = isWeekend ? 9 : 10;
                      const isOperating = hour >= opStart && hour < 22;
                      return (
                        <div
                          key={day}
                          className={`flex-1 min-w-[100px] md:min-w-[140px] border-r p-1 transition-colors flex flex-col gap-1 print:border-slate-300 ${
                            !isOperating
                              ? "bg-slate-100/60"
                              : lessons.length === 0
                              ? "bg-emerald-50 hover:bg-emerald-100"
                              : selectedDay === day
                              ? "bg-indigo-50/10 hover:bg-slate-50 print:bg-transparent"
                              : "bg-white hover:bg-slate-50"
                          }`}
                        >
                          {isOperating && lessons.length === 0 && (
                            <div className="flex items-center justify-center h-full py-2">
                              <span className="text-[10px] font-semibold text-emerald-400">가능</span>
                            </div>
                          )}
                          {lessons.map((l, idx) => (
                            <div
                              key={idx}
                              className={`px-2 py-1 md:px-3 md:py-2 rounded-lg border text-[10px] md:text-xs shadow-sm print:border-slate-400 print:shadow-none ${getSubjectColor(
                                l.subject
                              )}`}
                            >
                              <div className="font-bold flex justify-between items-center mb-0.5">
                                <span className="truncate">{l.name}</span>
                              </div>
                              <div className="flex justify-between items-center opacity-80 text-[9px] md:text-[10px]">
                                <span>{getLessonTime(l, day)}</span>
                                <span className="hidden md:inline">
                                  {l.grade}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  // 관리자/강사 일간 보기 바디 (🔥 중앙 정렬 justify-center 적용됨)
                  <div className="flex flex-1 justify-center min-w-max">
                    {activeTeachers.map((t) => {
                      const targetName = isTeacherMode ? myName : t.name;
                      const lessons = getLessons(targetName, selectedDay, hour);
                      const isWeekend = selectedDay === "토" || selectedDay === "일";
                      const opStart = isWeekend ? 9 : 10;
                      const isOperating = hour >= opStart && hour < 22;
                      return (
                        <div
                          key={t.id}
                          className={`${
                            isTeacherMode ? "w-full" : "w-[120px] md:w-[160px]"
                          } border-r p-1 transition-colors shrink-0 flex flex-col gap-1 print:border-slate-300 ${
                            !isOperating
                              ? "bg-slate-100/60"
                              : lessons.length === 0
                              ? "bg-emerald-50 hover:bg-emerald-100"
                              : "bg-white hover:bg-slate-50"
                          }`}
                        >
                          {isOperating && lessons.length === 0 && (
                            <div className="flex items-center justify-center h-full py-2">
                              <span className="text-[10px] font-semibold text-emerald-400">가능</span>
                            </div>
                          )}
                          {lessons.map((l, idx) => (
                            <div
                              key={idx}
                              className={`px-2 py-1 md:px-3 md:py-2 rounded-lg border text-[10px] md:text-xs shadow-sm print:border-slate-400 print:shadow-none ${getSubjectColor(
                                l.subject
                              )}`}
                            >
                              <div className="font-bold flex justify-between items-center mb-0.5">
                                <span className="truncate">{l.name}</span>
                                <span className="md:hidden text-[9px] opacity-70">
                                  {l.grade}
                                </span>
                              </div>
                              <div className="flex justify-between items-center opacity-80 text-[9px] md:text-[10px]">
                                <span>{getLessonTime(l, selectedDay)}</span>
                                <span className="hidden md:inline">
                                  {l.grade}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      );
                    })}
                    {/* 빈 공간 처리 */}
                    {activeTeachers.length === 0 && (
                      <div className="flex-1 bg-transparent"></div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// [SubjectTimetableView] - 평일 10:30 / 주말 09:00 오픈 규칙 적용
const SubjectTimetableView = ({ students, teachers, showToast }) => {
  const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

  // 화면 표시 시간: 오전 9시 ~ 밤 10시 (주말이 9시 시작이므로 9부터 그림)
  const DISPLAY_START_HOUR = 9;
  const END_HOUR = 22;
  const HOURS = Array.from(
    { length: END_HOUR - DISPLAY_START_HOUR + 1 },
    (_, i) => i + DISPLAY_START_HOUR
  );

  // 과목별 색상 매핑
  const getSubjectColor = (subject) => {
    const map = {
      피아노: "bg-indigo-100 text-indigo-700 border-indigo-200",
      바이올린: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
      플루트: "bg-emerald-100 text-emerald-700 border-emerald-200",
      첼로: "bg-amber-100 text-amber-700 border-amber-200",
      성악: "bg-rose-100 text-rose-700 border-rose-200",
      기타: "bg-sky-100 text-sky-700 border-sky-200",
      드럼: "bg-slate-100 text-slate-700 border-slate-200",
    };
    return map[subject] || "bg-gray-100 text-gray-600 border-gray-200";
  };

  // 1. 강사별 주력 과목 파악
  const teacherSubjects = useMemo(() => {
    const map = {};
    teachers.forEach((t) => {
      const myStudents = students.filter(
        (s) => s.teacher === t.name && s.status === "재원"
      );
      // 학생 없으면 과목 추론 불가 -> 스킵 (또는 강사 정보에 과목 필드가 있다면 그걸 써야 함)
      if (myStudents.length === 0) return;

      const counts = {};
      myStudents.forEach((s) => {
        const subj = s.subject || "기타";
        counts[subj] = (counts[subj] || 0) + 1;
      });
      const mainSubject = Object.keys(counts).reduce(
        (a, b) => (counts[a] > counts[b] ? a : b),
        "기타"
      );
      map[t.name] = mainSubject;
    });
    return map;
  }, [students, teachers]);

  // 2. [핵심] 평일 10:30 / 주말 09:00 로직으로 격자 채우기
  const availabilityMap = useMemo(() => {
    const map = {};

    teachers.forEach((t) => {
      const subject = teacherSubjects[t.name];
      if (!subject || !t.days || t.days.length === 0) return;

      t.days.forEach((dayId) => {
        // dayId: 0(일), 1(월) ... 6(토)
        let dayStr = dayId === 0 ? "일" : DAYS[dayId - 1];

        const isWeekend = dayId === 0 || dayId === 6; // 토, 일

        // [규칙] 주말은 9시부터, 평일은 10시(10:30)부터 표시
        const startHour = isWeekend ? 9 : 10;

        for (let h = startHour; h <= END_HOUR; h++) {
          const key = `${dayStr}-${h}`;
          if (!map[key]) map[key] = new Set();
          map[key].add(subject);
        }
      });
    });

    return map;
  }, [teachers, teacherSubjects, DAYS]);

  // 3. 텍스트 복사 (10:30 등 디테일한 시간 텍스트 생성)
  const handleCopyCaption = () => {
    const subjects = {};

    teachers.forEach((t) => {
      const subject = teacherSubjects[t.name];
      if (!subject || !t.days) return;
      if (!subjects[subject]) subjects[subject] = new Set();
      t.days.forEach((d) => subjects[subject].add(d));
    });

    let text = "[J&C 음악학원 수업 시간표]\n\n";
    if (Object.keys(subjects).length === 0)
      text += "등록된 수업 정보가 없습니다.\n";

    Object.entries(subjects).forEach(([subj, daySet]) => {
      text += `🎵 ${subj}\n`;

      // 평일(1~5)과 주말(0,6) 분리
      const weekdays = Array.from(daySet)
        .filter((d) => d >= 1 && d <= 5)
        .sort();
      const weekends = Array.from(daySet)
        .filter((d) => d === 0 || d === 6)
        .sort((a, b) => (a === 0 ? 7 : a) - (b === 0 ? 7 : b));

      if (weekdays.length > 0) {
        let dayStr =
          weekdays.length === 5
            ? "평일 (월-금)"
            : weekdays.map((d) => DAYS[d - 1]).join(", ");
        text += `   - ${dayStr}: 10:30 ~ 22:00\n`;
      }

      if (weekends.length > 0) {
        let dayStr = weekends
          .map((d) => (d === 0 ? "일" : DAYS[d - 1]))
          .join(", ");
        if (weekends.length === 2) dayStr = "주말 (토, 일)";
        text += `   - ${dayStr}: 09:00 ~ 22:00\n`;
      }
      text += "\n";
    });

    text += "상담 문의: 010-4028-9803";

    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(text)
        .then(() => showToast("운영 시간표가 복사되었습니다!", "success"));
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 h-full flex flex-col overflow-hidden animate-fade-in">
      <div className="flex justify-between items-center mb-6 shrink-0">
        <h2 className="text-lg font-bold flex items-center text-slate-800">
          <BookOpen className="mr-2 text-indigo-600" /> 과목별 운영 시간표 (외부
          공유용)
        </h2>
        <button
          onClick={handleCopyCaption}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-md flex items-center transition-colors"
        >
          <Copy size={16} className="mr-2" /> 시간표 복사
        </button>
      </div>

      <div className="flex-1 overflow-auto border rounded-xl bg-white relative">
        <div className="grid grid-cols-[60px_repeat(7,1fr)] bg-slate-50 border-b sticky top-0 z-10 shadow-sm min-w-[800px]">
          <div className="p-3 text-center text-xs font-bold text-slate-400 border-r flex items-center justify-center bg-slate-50 sticky left-0 z-20">
            TIME
          </div>
          {DAYS.map((day) => (
            <div
              key={day}
              className={`p-3 text-center text-sm font-bold border-r last:border-r-0 ${
                day === "일"
                  ? "text-rose-500 bg-rose-50/30"
                  : day === "토"
                  ? "text-blue-500 bg-blue-50/30"
                  : "text-slate-700"
              }`}
            >
              {day}
            </div>
          ))}
        </div>

        <div className="divide-y divide-slate-100 min-w-[800px]">
          {HOURS.map((hour) => (
            <div
              key={hour}
              className="grid grid-cols-[60px_repeat(7,1fr)] min-h-[50px]"
            >
              <div className="p-2 text-center text-xs font-bold text-slate-400 border-r bg-white flex items-center justify-center sticky left-0 z-10 font-mono">
                {hour}:00
              </div>

              {DAYS.map((day) => {
                const key = `${day}-${hour}`;
                const subjects = availabilityMap[key]
                  ? Array.from(availabilityMap[key])
                  : [];

                return (
                  <div
                    key={day}
                    className="border-r last:border-r-0 p-1 flex flex-wrap content-center justify-center gap-1 hover:bg-slate-50 transition-colors"
                  >
                    {subjects.length > 0 ? (
                      subjects.sort().map((subj) => (
                        <span
                          key={subj}
                          className={`text-[10px] px-2 py-1 rounded border font-bold shadow-sm whitespace-nowrap opacity-90 ${getSubjectColor(
                            subj
                          )}`}
                        >
                          {subj}
                        </span>
                      ))
                    ) : (
                      <div className="w-full h-full"></div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 text-center text-xs text-slate-400">
        * 평일 10:30~22:00, 주말 09:00~22:00 기준 자동 생성
      </div>
    </div>
  );
};
