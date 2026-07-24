import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
} from "react";
import { PaymentView as PaymentViewNew, BulkMessageModal as BulkMessageModalNew } from "./PaymentView";

// 에러 바운더리 — 렌더 에러를 잡아 화면에 표시
export class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: "monospace", background: "#fff0f0", minHeight: "100vh" }}>
          <h2 style={{ color: "red" }}>⚠️ 렌더 에러 (개발용)</h2>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{String(this.state.error)}</pre>
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, color: "#666" }}>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  getDoc,
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
  Bell,
  Calculator,
  Loader,
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

// SMS 전송용 텍스트 정리: 줄 끝 트레일링 공백/특수 공백 문자(전각·NBSP·zero-width 등)를 제거
// — EUC-KR 변환 과정에서 매핑되지 않아 "?"로 깨지는 문제 예방 (워드/한글 문서 복사 시 자주 섞여 들어옴)
const sanitizeSmsText = (text) =>
  text
    .replace(/\r\n/g, "\n")
    // NBSP(\u00A0), 전각 공백(\u3000), 각종 유니코드 공백/zero-width 문자, BOM(\uFEFF) → 일반 공백으로 정규화
    .replace(/[\u00A0\u1680\u2000-\u200D\u202F\u205F\u3000\uFEFF]/g, " ")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/, ""))
    .join("\n");

const sendAligoSms = async (receiver, msg) => {
  const res = await fetch(SMS_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ receiver, msg: sanitizeSmsText(msg) }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "발송 실패");
  return data;
};

// =================================================================
// 1-2. 결제선생(Paymint) 청구서 발송 헬퍼
// =================================================================
const PAYMINT_SEND_URL = process.env.REACT_APP_PAYMINT_API_URL || "https://jncmusic.kr/api/paymint/send";

// student: { id, name, phone, tuitionFee, subject, totalSessions, lastPaymentDate }
const sendKyuljesaengnim = async (student) => {
  const sessions = getEffectiveSessions(student);
  const formattedName = `[J&C]${student.subject || ""}-${student.name}`;
  const formattedSubject = `1:1 개인레슨 ${sessions}회`;
  // generatePaymentMessage와 동일하게 paymentHistory 기준으로 최종 결제일 계산
  const allPayments = (student.paymentHistory || []).sort((a, b) => a.date.localeCompare(b.date));
  const computedLastPayDate = allPayments.length > 0
    ? allPayments[allPayments.length - 1].date
    : (student.lastPaymentDate || "");
  const note = computedLastPayDate ? `최종 결제일: ${computedLastPayDate}` : "";
  const res = await fetch(PAYMINT_SEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studentId: student.id,
      studentName: formattedName,
      phone: student.phone || "",
      price: String(student.tuitionFee || 0),
      subject: formattedSubject,
      totalSessions: sessions,
      lastPaymentDate: computedLastPayDate,
      note,
    }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "결제선생 발송 실패");
  return data; // { success, billId, shortURL }
};

// 파기: /destroy (billId + price 필요) — 미결제(W) 청구서 취소용
const cancelKyuljesaengnim = async (billId, price) => {
  const PAYMINT_DESTROY_URL = PAYMINT_SEND_URL.replace("/send", "/destroy");
  const res = await fetch(PAYMINT_DESTROY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ billId, price }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "파기 실패");
  return data;
};

// 청구서 상태 조회: F=결제완료, W=미결제, C=취소, D=파기
const readBillState = async (billId) => {
  const PAYMINT_READ_URL = PAYMINT_SEND_URL.replace("/send", "/read");
  const res = await fetch(PAYMINT_READ_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ billId }),
  });
  return res.json();
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

// 원장 본인 (강사료 정산 대상에서 제외)
const OWNER_NAME = "강열혁";

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
        : "text-slate-500 hover:bg-indigo-50 active:bg-indigo-100 hover:text-indigo-600"
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

// 로컬 날짜 문자열 반환 (YYYY-MM-DD) - toISOString()은 UTC 변환으로 한국 오전 9시 이전 하루 오차 발생
const toLocalDateStr = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

// 결제 주기(세션 단위) 계산: 주2회(schedules 2개 이상)인데 totalSessions가
// 구버전 기본값(4)으로 저장된 학생을 자동으로 8회로 보정한다.
const getEffectiveSessions = (student) => {
  const saved = parseInt(student.totalSessions);
  if (!isNaN(saved) && saved > 0) return saved;
  const scheduleCount = Object.keys(student.schedules || {}).length;
  return scheduleCount >= 2 ? 8 : 4;
};

// 결제 주기별 유효 세션 날짜 배열 (sessionDates 불완전 시 sessionStartDate 기반 재계산)
const getPaymentDates = (payment, student) => {
  const payUnit =
    payment.totalSessions > 0
      ? payment.totalSessions
      : getEffectiveSessions(student);
  if (payment.sessionDates && payment.sessionDates.length >= payUnit) {
    return payment.sessionDates;
  }
  const startDate = payment.sessionStartDate || payment.date;
  const attSlots = (student.attendanceHistory || [])
    .filter((h) => h.status === "present" || h.status === "canceled")
    .sort((a, b) => a.date.localeCompare(b.date))
    .flatMap((h) =>
      Array(h.status === "canceled" ? 1 : (h.count || 1)).fill(h.date)
    );
  return attSlots.filter((d) => d >= startDate).slice(0, payUnit);
};

// 학생 결제 상태 통합 계산 헬퍼 (순수 누적 모델)
// - T = 총 출석 슬롯 (당일취소=1, 연강=2)
// - P = 총 결제 회차 (모든 결제의 totalSessions 합)
// - T > P → 미납 (T-P회), T == P → 결제 대상, T < P → 진행 중
// - 날짜·시작점·sessionDates와 완전 무관
const getStudentPaymentStatus = (student) => {
  const unit = getEffectiveSessions(student);
  const payments = [...(student.paymentHistory || [])].sort((a, b) =>
    a.date.localeCompare(b.date)
  );

  // 총 출석 슬롯 (날짜순, 오늘 이하만 — 미래 예약 출석은 결제 판정 제외)
  const todayStr = toLocalDateStr();
  const allSlots = [];
  for (const h of (student.attendanceHistory || []).slice().sort((a, b) =>
    a.date.localeCompare(b.date)
  )) {
    if (h.status !== "present" && h.status !== "canceled") continue;
    if (h.date > todayStr) continue;
    const cnt = h.status === "canceled" ? 1 : (h.count || 1);
    for (let i = 0; i < cnt; i++) allSlots.push({ date: h.date, status: h.status });
  }
  const T = allSlots.length;

  // 총 결제 회차
  const P = payments.reduce(
    (s, p) => s + (p.totalSessions > 0 ? p.totalSessions : unit),
    0
  );

  const lastPay = payments.length > 0 ? payments[payments.length - 1] : null;
  const lastPayUnit = lastPay
    ? lastPay.totalSessions > 0 ? lastPay.totalSessions : unit
    : unit;
  const previousCovered = P - lastPayUnit;

  // 현재 사이클 진행도 (X/Y 표시용)
  const lastConsumed = Math.max(0, Math.min(T - previousCovered, lastPayUnit));

  // 미납 = 결제 회차를 초과한 출석
  const unpaidSlots = allSlots.slice(P);
  const unpaidCount = unpaidSlots.length;
  const unpaidDates = [...new Set(unpaidSlots.map((s) => s.date))];

  const isCycleComplete = payments.length > 0 && T >= P;
  const isOverdue = T > P;

  return {
    lastConsumed,
    lastPayUnit,
    unpaidCount,
    unpaidDates,
    isCycleComplete,
    isPaymentDue: isCycleComplete,
    isOverdue,
    isExpired: isCycleComplete && !isOverdue,
  };
};

// =================================================================
// 4-1. 결제 안내 메시지 생성 헬퍼 (PaymentView 및 안내 발송 기능에서 공용)
// =================================================================
const getSeasonalGreeting = () => {
  const month = new Date().getMonth() + 1;
  const greetings = {
    1:  "추운 겨울 건강히 지내고 계신지요. 새해 복 많이 받으시기 바랍니다. 새해에도 원하시는 일들 모두 이루시길 기원합니다.",
    2:  "겨울 추위가 아직 남아 있습니다. 건강 유의하시고 따뜻하게 지내시기 바랍니다.",
    3:  "봄이 찾아왔지만 일교차가 크니 건강 유의하시기 바랍니다. 활기찬 봄날 되시기 바랍니다.",
    4:  "따뜻한 봄날이 이어지고 있습니다. 건강하고 활기찬 봄 보내시기 바랍니다.",
    5:  "가정의 달 5월입니다. 가족 모두 건강하고 행복한 시간 보내시기 바랍니다.",
    6:  "더워지는 날씨에 건강 유의하시기 바랍니다.",
    7:  "더워지는 날씨에 건강 유의하시기 바랍니다.",
    8:  "더워지는 날씨에 건강 유의하시기 바랍니다.",
    9:  "선선한 바람이 불어오고 있습니다. 환절기에 건강 유의하시기 바랍니다.",
    10: "쌀쌀해지는 날씨에 건강 유의하시기 바랍니다. 감기 조심하시기 바랍니다.",
    11: "초겨울 추위가 시작되었습니다. 따뜻하게 입고 건강 챙기시기 바랍니다.",
    12: "한 해동안 J&C 음악학원을 사랑해주셔서 감사드립니다. 뜻깊은 연말연시 되시기 바랍니다.",
  };
  return greetings[month] || "";
};

const generatePaymentMessage = (student, paymentUrl = "", style = "detailed") => {
  const sessionUnit = getEffectiveSessions(student);
  const tuition = parseInt(student.tuitionFee || 0).toLocaleString();

  // 출석(present) + 당일취소(canceled) 모두 세션으로 포함 (오늘 이하만)
  const todayForMsg = toLocalDateStr();
  const allSessions = (student.attendanceHistory || [])
    .filter((h) => (h.status === "present" || h.status === "canceled") && h.date <= todayForMsg)
    .sort((a, b) => a.date.localeCompare(b.date));

  // 누적 세션: present=count(1 or 2), canceled=1
  // 각 세션에 라벨 부여 (표시용) — fromDouble: 연강 슬롯 여부
  const sessionSlots = []; // { date, label, fromDouble }
  allSessions.forEach((h) => {
    if (h.status === "present") {
      const cnt = h.count || 1;
      for (let i = 0; i < cnt; i++) {
        sessionSlots.push({ date: h.date, label: h.date.slice(5).replace("-", "/"), fromDouble: cnt >= 2 });
      }
    } else if (h.status === "canceled") {
      sessionSlots.push({ date: h.date, label: h.date.slice(5).replace("-", "/") + "(당일취소)", fromDouble: false });
    }
  });

  // 슬롯 배열 → 날짜별 그룹화 후 표시 문자열 배열로 변환 (연강이면 날짜 하나로 묶어 (연강) 표시)
  const slotsToLabels = (slots) => {
    const seen = new Map();
    const order = [];
    slots.forEach((slot) => {
      if (!seen.has(slot.date)) {
        seen.set(slot.date, { label: slot.label, fromDouble: slot.fromDouble });
        order.push(slot.date);
      } else if (slot.fromDouble) {
        seen.get(slot.date).fromDouble = true;
      }
    });
    return order.map((date) => {
      const g = seen.get(date);
      if (g.label.includes("당일취소")) return g.label;
      return g.label + (g.fromDouble ? "(연강)" : "");
    });
  };

  // 결제 이력 정렬
  const allPayments = (student.paymentHistory || []).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const lastPayment =
    allPayments.length > 0
      ? allPayments[allPayments.length - 1].date
      : "기록 없음";

  // 누적 슬라이스 방식 (T vs P 모델과 동일)
  // 각 결제는 sessionSlots[prevUnits, prevUnits+payUnit)를 커버
  // 마지막 결제 커버 = slots[P-lastPayUnit, P), P 이후 = 미납
  let lastCoveredDate = "없음";
  let lastPaySessions = sessionUnit; // 마지막 결제가 커버한 회차 수
  const unpaidItems = []; // { date, label, fromDouble }
  const lastPayCoveredSlots = []; // 마지막 결제가 커버한 수업 슬롯

  if (allPayments.length > 0) {
    const P = allPayments.reduce(
      (sum, p) => sum + (p.totalSessions > 0 ? p.totalSessions : sessionUnit),
      0
    );
    const lastPay = allPayments[allPayments.length - 1];
    const lastPayUnit = lastPay.totalSessions > 0 ? lastPay.totalSessions : sessionUnit;
    lastPaySessions = lastPayUnit;
    const prevCovered = P - lastPayUnit;

    for (let i = 0; i < sessionSlots.length; i++) {
      const slot = sessionSlots[i];
      if (i >= prevCovered && i < P) {
        lastPayCoveredSlots.push(slot);
        lastCoveredDate = slot.date.slice(5).replace("-", "/");
      } else if (i >= P) {
        unpaidItems.push(slot);
      }
    }
  } else {
    // 결제 내역 없음 → 전체 미납
    for (const slot of sessionSlots) {
      unpaidItems.push(slot);
    }
  }
  const unpaidSlots = slotsToLabels(unpaidItems);

  // 수업일자: 마지막 결제 커버 세션 + 미납분
  const recentSessions =
    [...slotsToLabels(lastPayCoveredSlots), ...unpaidSlots].join(", ") ||
    "(출석 기록 없음)";

  const unpaidDatesStr = unpaidSlots.length > 0 ? unpaidSlots.join(", ") : "없음";
  const unpaidCount = unpaidSlots.length;
  // 2회차 이상 미납 시 추가 날짜 문구
  const additionalUnpaidStr = unpaidItems.length > 1
    ? " 이후 " + unpaidItems.slice(1).map((s, i) => `${i + 2}회차(${s.label})`).join(", ") + "까지 진행되었습니다."
    : "";
  // 첫 미납 회차가 오늘 이후면 "(예정)". 미납 없으면 다음 예정 수업일이므로 항상 (예정)
  const firstUnpaidIsUpcoming = unpaidItems.length === 0 || unpaidItems[0].date >= toLocalDateStr();

  // 새로운 1회차: 미납회차가 있으면 첫 미납 날짜, 없으면 다음 예정 수업일 계산
  let nextDateStr = "";
  let requestDateStr = "";
  const daysKor = ["일", "월", "화", "수", "목", "금", "토"];
  let targetDayIdx = -1;

  if (unpaidItems.length > 0) {
    // 첫 미납 회차가 곧 새로운 1회차
    const [, mm, dd] = unpaidItems[0].date.split("-");
    nextDateStr = `${mm}/${dd}`;
    requestDateStr = `${parseInt(mm)}/${parseInt(dd)}(${daysKor[new Date(unpaidItems[0].date).getDay()]})`;
  } else {
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
  }
  if (!requestDateStr) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 3);
    requestDateStr = `${fallback.getMonth() + 1}/${fallback.getDate()}(${daysKor[fallback.getDay()]})`;
  }

  // 날짜 포맷 변환 (MM/DD → M월 D일)
  const fmtMD = (mmdd) => {
    if (!mmdd || mmdd === "없음") return "없음";
    const [m, d] = mmdd.split("/");
    return `${parseInt(m)}월 ${parseInt(d)}일`;
  };
  const lastPaymentMD = lastPayment !== "기록 없음"
    ? `${parseInt(lastPayment.slice(5, 7))}월 ${parseInt(lastPayment.slice(8, 10))}일`
    : "기록 없음";
  const lastCoveredMD = fmtMD(lastCoveredDate);
  const nextDateMD = fmtMD(nextDateStr);
  const subject = student.subject || "음악";
  const nameLabel = `${student.name} ${student.grade === "성인" ? "님" : "학생"}`;
  const dow = new Date().getDay();
  const closingGreeting = dow === 1
    ? "평안한 한 주의 시작 되시기 바랍니다."
    : dow >= 2 && dow <= 4
    ? "평안한 한 주 보내시기 바랍니다."
    : "평안한 주말 되시기 바랍니다.";

  // ── 간결 형식 (새 템플릿) ──────────────────────────────────
  if (style === "simple") {
    return `안녕하세요, J&C 음악학원입니다. ${getSeasonalGreeting()}

${lastPaymentMD} 결제하신 ${nameLabel}의 ${subject} ${lastPaySessions}회차가 ${lastCoveredMD}에 완료되어 ${nextDateMD} 새로운 ${subject} 1회차가 시작되어 안내드립니다.${additionalUnpaidStr}

아직 결제 전으로 확인되어 안내드리오니 이미 결제하신 경우 알려주시면 감사하겠습니다. 제로페이/서울페이 등은 결제 후 알려주셔야 확인이 되는 점 양해부탁말씀 드립니다.

결제하지 않으셨다면 보내드리는 결제선생 페이지 또는 아래 계좌로 결제 부탁드립니다.
하나은행 125-91025-766307 강열혁(제이앤씨음악학원)
방문(카드/현금), 온라인(계좌이체·제로페이, 온라인 카드결제) 모두 가능합니다.

항상 감사드립니다. ${closingGreeting}

J&C 음악학원장 드림.`;
  }

  // ── 상세 형식 (기존 템플릿) ───────────────────────────────
  const paymentLine = paymentUrl
    ? `\n- 온라인 결제 링크 : ${paymentUrl}\n`
    : "\n- 온라인 카드 결제를 원하시는 경우 알려주시면 발송드리겠습니다. 결제 선생(카카오톡 페이지) 페이지 보내드립니다.\n";

  return `안녕하세요, J&C 음악학원입니다.

${getSeasonalGreeting()}

수업료 결제 안내입니다. 아래 수업일자와 결제내용 확인하시어 결제 부탁드리겠습니다.
-------------------------------
- 과정명 : ${subject} 1:1 개인레슨 과정 - ${student.name} ${student.grade === "성인" ? "님" : "학생"}
- 최종 결제일 : ${lastPayment.slice(5).replace("-", "/")}
- 수업일자 : ${recentSessions}
- 결제하신 수업 완료일 : ${lastCoveredDate}
- 새로운 1회차 수업 : ${nextDateStr}${firstUnpaidIsUpcoming ? " (예정)" : ""}
- 미납회차 : ${unpaidDatesStr} ${unpaidCount > 0 ? `(${unpaidCount}회)` : ""}

- 결제금액 : ${subject} 1:1 개인레슨 ${sessionUnit}회 ${tuition}원 ${unpaidCount > 0 ? `(미납 ${unpaidCount}회 포함)` : ""}
- 결제요청일 : ${requestDateStr} 까지 결제 부탁드립니다.
(현장결제는 수업 당일까지, 온라인결제는 수업 전일까지 부탁드립니다)

- 결제계좌
하나은행 125-91025-766307 강열혁(제이앤씨음악학원)
- 결제방법: 방문(카드/현금), 계좌이체, 제로페이, 온라인 결제
${paymentLine}
- 이미 결제하신 경우 알려주시면 감사하겠습니다. 특히 제로페이의 경우 학생명 확인이 어려우니 꼭 알려주시면 감사하겠습니다.


항상 감사드립니다. ${closingGreeting}

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
          확인 (배너에서 완료 처리)
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
            className="w-full p-4 bg-slate-50 hover:bg-indigo-50 active:bg-indigo-100 border rounded-xl flex items-center group transition-colors"
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
const StudentEditModal = ({ student, teachers, onClose, onUpdate, user, onUpdateAttendance }) => {
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
  const [isAttModalOpen, setIsAttModalOpen] = useState(false);

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

    const updates = {
      ...formData,
      schedules: cleanSchedules,
      classDays: days,
      className,
      time,
    };

    // 강사 변경 시 이력 기록 (급여 정산 기준일 분리를 위해)
    if (formData.teacher && formData.teacher !== student.teacher) {
      const today = new Date().toISOString().split("T")[0];
      const existingHistory = student.teacherHistory || [];
      if (existingHistory.length === 0 && student.teacher) {
        updates.teacherHistory = [
          { teacher: student.teacher, from: student.registrationDate || "2020-01-01", to: today },
          { teacher: formData.teacher, from: today, to: null },
        ];
      } else {
        updates.teacherHistory = [
          ...existingHistory.map((h) => (h.to === null ? { ...h, to: today } : h)),
          { teacher: formData.teacher, from: today, to: null },
        ];
      }
    }

    onUpdate(student.id, updates);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[90] flex items-center justify-center p-4 backdrop-blur-sm">
      {isAttModalOpen && (
        <FastAttendanceModal
          student={{ ...student, schedules: formData.schedules }}
          onClose={() => setIsAttModalOpen(false)}
          onSave={(studentId, newHistory) => {
            if (onUpdateAttendance) {
              onUpdateAttendance(studentId, newHistory);
            }
            setIsAttModalOpen(false);
          }}
        />
      )}
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
          <div className="flex gap-2 mt-4">
            {onUpdateAttendance && (
              <button
                type="button"
                onClick={() => setIsAttModalOpen(true)}
                className="flex-1 py-3 rounded-xl border border-indigo-200 text-indigo-600 font-bold hover:bg-indigo-50 active:bg-indigo-100 flex items-center justify-center gap-1.5 text-sm"
              >
                <CalendarDays size={15} /> 출석 기록 편집
              </button>
            )}
            <button
              onClick={handleSave}
              className="flex-1 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-sm"
            >
              변경사항 저장
            </button>
          </div>
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
  const [isPaySaving, setIsPaySaving] = useState(false);

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

  const handlePaymentSubmit = async () => {
    if (isPaySaving) return;
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
      setIsPaySaving(true);
      try {
        await onSavePayment(
          student.id,
          paymentDate,
          parseInt(amount),
          realSessionStartDate
        );
      } finally {
        setIsPaySaving(false);
      }
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
                          <span className="text-xs font-bold mb-0.5 opacity-70">
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
                  disabled={isPaySaving}
                  className="w-full md:w-auto py-2.5 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-md flex items-center justify-center gap-2 shrink-0 disabled:opacity-50"
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
                      <tr key={index} className="hover:bg-slate-50 active:bg-slate-100">
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
                                  <span className="text-xs text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 ml-1">
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

// [DashboardView] - 상담 통계 카드 숨김 처리 (강사 권한 분리)
const DashboardView = ({
  students,
  consultations,
  reports,
  user,
  messageLogs,
  onNavigateToConsultation,
  onNavigate,
  showToast,
  operationNotes = [],
  weeklySnapshots = [],
  onAddNote,
  onToggleNote,
  onDeleteNote,
}) => {
  const [newNoteText, setNewNoteText] = useState("");
  const [showDoneNotes, setShowDoneNotes] = useState(false);
  // 1. 내 담당 학생 필터링
  const myStudents = useMemo(() => {
    return user.role === "teacher"
      ? students.filter((s) => s.teacher === user.name && s.status === "재원")
      : students.filter((s) => s.status === "재원");
  }, [students, user]);

  // 2. 수납 상태 계산
  const isPaymentDue = (s) => {
    if ((s.paymentHistory || []).length === 0) return false;
    return getStudentPaymentStatus(s).isPaymentDue;
  };

  // 3. 주요 지표 계산
  const stats = useMemo(() => {
    const paymentDueStudents = myStudents.filter((s) => isPaymentDue(s));
    const paymentDueCount = paymentDueStudents.length;
    // 현재 시점 기준 수납 예정 금액(회차 완료·미납 학생들의 원비 합계, 주 단위와 무관하게 실시간)
    const paymentDueAmount = paymentDueStudents.reduce(
      (sum, s) => sum + (Number(s.tuitionFee) || 0),
      0
    );

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

    return { paymentDueCount, paymentDueAmount, totalRevenue, newStudentsCount, pendingConsults };
  }, [myStudents, consultations, user]);

  // 4. 주간 결산 (관리자 전용, 주 단위 탐색 가능)
  const [weekOffset, setWeekOffset] = useState(0); // 0=이번 주, -1=지난 주 ...
  const weeklyStats = useMemo(() => {
    if (user.role !== "admin") return null;
    const today = new Date();
    const dayOfWeek = (today.getDay() + 6) % 7; // 0=월 … 6=일
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dayOfWeek + weekOffset * 7);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    const weekStartStr = toLocalDateStr(weekStart);
    // 이번 주(offset 0)는 오늘까지만, 지난 주는 주 전체(일요일까지) 집계
    const weekEndStr =
      weekOffset === 0
        ? toLocalDateStr(today)
        : toLocalDateStr(weekEnd);

    // 주간 결제액 & 건수
    let weeklyPaymentTotal = 0;
    let weeklyPaymentCount = 0;
    students.forEach((s) => {
      (s.paymentHistory || []).forEach((p) => {
        if (p.date >= weekStartStr && p.date <= weekEndStr) {
          weeklyPaymentTotal += Number(p.amount) || 0;
          weeklyPaymentCount++;
        }
      });
    });

    // 주간 신규 등록수
    const weeklyNewStudents = students.filter((s) => {
      const regDate = (s.registrationDate || s.createdAt || "").slice(0, 10);
      return regDate >= weekStartStr && regDate <= weekEndStr;
    }).length;

    // 주간 상담 접수수
    const weeklyConsultations = consultations.filter((c) => {
      const cDate = (c.createdAt || c.date || "").slice(0, 10);
      return cDate >= weekStartStr && cDate <= weekEndStr;
    }).length;

    // 주간 범위 레이블
    const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()}`;
    const weekLabel = `${fmt(weekStart)}(월) ~ ${fmt(weekEnd)}(일)`;

    return { weeklyPaymentTotal, weeklyPaymentCount, weeklyNewStudents, weeklyConsultations, weekLabel };
  }, [students, consultations, user, weekOffset]);

  // 오늘 회차 완료 학생 (관리자 — 결제 안내 자동화)
  // 결제 이력 기반 잔여 회차로 판단 (단순 모듈로 방식 대신)
  const todayCycleComplete = useMemo(() => {
    if (user.role !== "admin") return [];
    const todayStr = toLocalDateStr();
    return students.filter((s) => {
      if (s.status !== "재원") return false;
      const history = s.attendanceHistory || [];
      const hasTodayRecord = history.some(
        (h) => h.date === todayStr && (h.status === "present" || h.status === "canceled")
      );
      if (!hasTodayRecord) return false;

      return isPaymentDue(s);
    });
  }, [students, user]);

  // 오늘의 수업 목록 (강사 전용)
  const todaySchedule = useMemo(() => {
    if (user.role !== "teacher") return { regular: [], makeup: [] };
    const todayStr = toLocalDateStr();
    const todayDate = new Date();
    const dayName = ["일", "월", "화", "수", "목", "금", "토"][todayDate.getDay()];
    const regular = myStudents.filter((s) =>
      s.schedules ? !!s.schedules[dayName] : s.className === dayName
    );
    const makeup = students.filter((s) =>
      s.teacher === user.name &&
      s.status === "재원" &&
      s.attendanceHistory?.some((h) => h.status === "reschedule" && h.makeupDate === todayStr)
    );
    return { regular, makeup };
  }, [myStudents, students, user]);

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

  // 5-1. 주차별 재원생 수 추이 (관리자 전용, 기간 선택 가능)
  const [weeklyTrendRange, setWeeklyTrendRange] = useState(12); // 12 | 24 | "all"
  const weeklyTrendData = useMemo(() => {
    if (user.role !== "admin") return [];
    const today = new Date();
    const dayOfWeek = (today.getDay() + 6) % 7; // 0=월 … 6=일
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - dayOfWeek);
    thisWeekStart.setHours(0, 0, 0, 0);

    let weekCount = weeklyTrendRange;
    if (weeklyTrendRange === "all") {
      // 가장 오래된 등록일까지의 주차 수 계산
      const earliestDates = students
        .map((s) => s.registrationDate || s.createdAt || "")
        .filter(Boolean)
        .sort();
      const earliest = earliestDates.length > 0 ? new Date(earliestDates[0].slice(0, 10)) : thisWeekStart;
      const diffWeeks = Math.floor((thisWeekStart - earliest) / (7 * 24 * 60 * 60 * 1000)) + 1;
      weekCount = Math.max(diffWeeks, 1);
    }

    const snapshotMap = {};
    weeklySnapshots.forEach((snap) => {
      if (snap.weekStartStr) snapshotMap[snap.weekStartStr] = snap.activeCount;
    });

    const weeks = [];
    for (let i = weekCount - 1; i >= 0; i--) {
      const start = new Date(thisWeekStart);
      start.setDate(thisWeekStart.getDate() - i * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      weeks.push({ start, end });
    }
    return weeks.map(({ start, end }) => {
      const startStr = toLocalDateStr(start);
      const endStr = toLocalDateStr(end);
      const newCount = students.filter((s) => {
        const reg = (s.registrationDate || s.createdAt || "").slice(0, 10);
        return reg >= startStr && reg <= endStr;
      }).length;
      // 실제 저장된 스냅샷이 있으면 그 값을 사용(정확), 없으면 현재 재원 기준 추정치(하한선)
      const hasSnapshot = Object.prototype.hasOwnProperty.call(snapshotMap, startStr);
      const activeCount = hasSnapshot
        ? snapshotMap[startStr]
        : students.filter((s) => {
            const reg = s.registrationDate || s.createdAt || "";
            return reg && reg.slice(0, 10) <= endStr && s.status === "재원";
          }).length;
      return {
        label: `${start.getMonth() + 1}/${start.getDate()}`,
        weekStartStr: startStr,
        new: newCount,
        active: activeCount,
        isEstimate: !hasSnapshot,
      };
    });
  }, [students, user, weeklyTrendRange, weeklySnapshots]);

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
          onClick={() => onNavigate("payments")}
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
              <TrendingUp size={18} className="text-indigo-500" /> {weekOffset === 0 ? "이번 주 결산" : "주간 결산"}
            </h3>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setWeekOffset((v) => v - 1)}
                className="p-1 rounded-lg hover:bg-slate-100 active:bg-slate-200 text-slate-500"
                title="이전 주"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">{weeklyStats.weekLabel}</span>
              <button
                onClick={() => setWeekOffset((v) => Math.min(0, v + 1))}
                disabled={weekOffset === 0}
                className="p-1 rounded-lg hover:bg-slate-100 active:bg-slate-200 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed"
                title="다음 주"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-indigo-50 rounded-xl p-4">
              <p className="text-xs text-indigo-500 font-bold mb-1">결제액</p>
              <p className="text-xl font-bold text-indigo-700">₩{weeklyStats.weeklyPaymentTotal.toLocaleString()}</p>
              <p className="text-xs text-slate-400 mt-1">{weeklyStats.weeklyPaymentCount}건 결제</p>
            </div>
            <div className="bg-emerald-50 rounded-xl p-4">
              <p className="text-xs text-emerald-600 font-bold mb-1">신규 등록</p>
              <p className="text-xl font-bold text-emerald-700">{weeklyStats.weeklyNewStudents}명</p>
              <p className="text-xs text-slate-400 mt-1">{weekOffset === 0 ? "이번 주 신규" : "해당 주 신규"}</p>
            </div>
            <div className="bg-amber-50 rounded-xl p-4">
              <p className="text-xs text-amber-600 font-bold mb-1">상담 접수</p>
              <p className="text-xl font-bold text-amber-700">{weeklyStats.weeklyConsultations}건</p>
              <p className="text-xs text-slate-400 mt-1">{weekOffset === 0 ? "이번 주 상담" : "해당 주 상담"}</p>
            </div>
            <div className="bg-rose-50 rounded-xl p-4">
              <p className="text-xs text-rose-600 font-bold mb-1">수납 예정 금액</p>
              <p className="text-xl font-bold text-rose-700">₩{stats.paymentDueAmount.toLocaleString()}</p>
              <p className="text-xs text-slate-400 mt-1">현재 기준 · {stats.paymentDueCount}명</p>
            </div>
          </div>
        </div>
      )}

      {/* 3-1. 운영 메모/할일 (관리자 전용) */}
      {user.role === "admin" && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-slate-700 flex items-center gap-2">
              <ListTodo size={18} className="text-violet-500" /> 운영 메모 / 할일
            </h3>
            <span className="text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">
              미완료 {operationNotes.filter((n) => !n.done).length}건
            </span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!newNoteText.trim()) return;
              onAddNote?.(newNoteText);
              setNewNoteText("");
            }}
            className="flex items-center gap-2 mb-3"
          >
            <input
              type="text"
              value={newNoteText}
              onChange={(e) => setNewNoteText(e.target.value)}
              placeholder="개선/할일 메모를 입력하세요..."
              className="flex-1 px-3 py-2 text-sm border rounded-lg outline-none focus:ring-2 focus:ring-violet-400"
            />
            <button
              type="submit"
              disabled={!newNoteText.trim()}
              className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-bold hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            >
              추가
            </button>
          </form>

          <div className="space-y-1.5">
            {operationNotes.filter((n) => !n.done).length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">할일이 없습니다. 👍</p>
            )}
            {operationNotes
              .filter((n) => !n.done)
              .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
              .map((n) => (
                <div key={n.id} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 group">
                  <button
                    onClick={() => onToggleNote?.(n.id, n.done)}
                    className="w-5 h-5 rounded-md border-2 border-slate-300 hover:border-violet-500 shrink-0"
                    title="완료 처리"
                  />
                  <span className="flex-1 text-sm text-slate-700">{n.text}</span>
                  <button
                    onClick={() => onDeleteNote?.(n.id)}
                    className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    title="삭제"
                  >
                    <X size={16} />
                  </button>
                </div>
              ))}
          </div>

          {operationNotes.some((n) => n.done) && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowDoneNotes((v) => !v)}
                className="text-xs text-slate-400 hover:text-slate-600 font-medium"
              >
                완료된 항목 {operationNotes.filter((n) => n.done).length}건 {showDoneNotes ? "숨기기 ▲" : "보기 ▼"}
              </button>
              {showDoneNotes && (
                <div className="space-y-1.5 mt-2">
                  {operationNotes
                    .filter((n) => n.done)
                    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
                    .map((n) => (
                      <div key={n.id} className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 group">
                        <button
                          onClick={() => onToggleNote?.(n.id, n.done)}
                          className="w-5 h-5 rounded-md bg-violet-500 border-2 border-violet-500 flex items-center justify-center shrink-0"
                          title="완료 취소"
                        >
                          <CheckSquare size={13} className="text-white" />
                        </button>
                        <span className="flex-1 text-sm text-slate-400 line-through">{n.text}</span>
                        <button
                          onClick={() => onDeleteNote?.(n.id)}
                          className="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          title="삭제"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 관리자: 오늘 결제 안내 필요 학생 카드 */}
      {user.role === "admin" && todayCycleComplete.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-amber-800 flex items-center gap-2 text-sm">
              <Bell size={16} className="text-amber-600" />
              오늘 회차 완료 — 결제 안내 필요
              <span className="bg-amber-200 text-amber-800 text-xs px-1.5 py-0.5 rounded-full font-bold">
                {todayCycleComplete.length}명
              </span>
            </h3>
            <button
              onClick={() => onNavigate("payments")}
              className="text-xs font-bold text-amber-700 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1 border border-amber-300"
            >
              수납센터 이동 →
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {todayCycleComplete.map((s) => (
              <div key={s.id} className="flex items-center gap-2 bg-white border border-amber-200 rounded-xl px-3 py-2 text-sm">
                <span className="font-bold text-slate-800">{s.name}</span>
                <span className="text-xs text-slate-400">{s.subject}</span>
                <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">
                  {getEffectiveSessions(s)}회차 완료
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 강사: 오늘의 수업 목록 */}
      {user.role === "teacher" && (todaySchedule.regular.length > 0 || todaySchedule.makeup.length > 0) && (
        <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
          <h3 className="font-bold text-slate-700 flex items-center gap-2 text-sm mb-3">
            <CalendarIcon size={16} className="text-indigo-500" />
            오늘의 수업 ({todaySchedule.regular.length + todaySchedule.makeup.length}명)
          </h3>
          <div className="flex flex-wrap gap-2">
            {todaySchedule.regular.map((s) => {
              const today = toLocalDateStr();
              const record = s.attendanceHistory?.find((h) => h.date === today);
              const statusLabel = record?.status === "present" ? "✓ 출석" : record?.status === "absent" ? "✗ 결석" : record?.status === "canceled" ? "취소" : null;
              return (
                <div key={s.id} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm border ${record?.status === "present" ? "bg-emerald-50 border-emerald-200" : record?.status === "absent" ? "bg-rose-50 border-rose-200 opacity-70" : "bg-slate-50 border-slate-200"}`}>
                  <span className="font-bold text-slate-800">{s.name}</span>
                  <span className="text-xs text-slate-400">{s.subject}</span>
                  {statusLabel && <span className={`text-xs font-bold ${record?.status === "present" ? "text-emerald-600" : record?.status === "absent" ? "text-rose-500" : "text-slate-400"}`}>{statusLabel}</span>}
                </div>
              );
            })}
            {todaySchedule.makeup.map((s) => (
              <div key={`makeup-${s.id}`} className="flex items-center gap-2 bg-sky-50 border border-sky-200 rounded-xl px-3 py-2 text-sm">
                <span className="font-bold text-slate-800">{s.name}</span>
                <span className="text-xs text-slate-400">{s.subject}</span>
                <span className="text-xs bg-sky-500 text-white px-1.5 py-0.5 rounded-full font-bold">보강</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => onNavigate("attendance")}
            className="mt-3 text-xs text-indigo-600 hover:underline font-bold"
          >
            출석부 바로가기 →
          </button>
        </div>
      )}

      {/* 4. 빠른 메뉴 이동 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
        <QuickMenuBtn
          icon={CalendarIcon}
          color="violet"
          label="주간 캘린더"
          sub="이번 주 수업 일정"
          onClick={() => onNavigate("calendar")}
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
              className="text-xs font-bold text-indigo-500 hover:bg-indigo-50 active:bg-indigo-100 px-2.5 py-1 rounded-lg transition-colors"
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
                    className="flex items-center gap-3 py-2.5 hover:bg-slate-50 active:bg-slate-100 cursor-pointer rounded-lg px-1 -mx-1 transition-colors group"
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
                            className={`text-xs px-1.5 py-0.5 rounded border hidden md:inline ${
                              colorMap[opt.color] || colorMap.blue
                            }`}
                          >
                            {opt.label}
                          </span>
                        );
                      })}
                      <span className="text-xs text-slate-400 font-mono">
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
                <div className="flex gap-1.5 h-28 mb-1">
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
                  <tr key={d.month} className="border-b border-slate-50 hover:bg-slate-50 active:bg-slate-100 transition-colors">
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
            <p className="text-xs text-slate-400 mt-2">
              * 재원생 수는 현재 재원 중인 학생 기준으로, 이미 퇴원한 학생은 반영되지 않습니다.
            </p>
          </div>
        </div>
      )}

      {/* 5-1. 주차별 재원생 수 추이 (관리자 전용) */}
      {user.role === "admin" && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-5 flex-wrap gap-2">
            <h3 className="font-bold text-slate-800 flex items-center text-lg">
              <TrendingUp className="mr-2 text-indigo-600" size={22} /> 주차별 재원생 추이
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">매주 월요일 기준</span>
              <div className="flex rounded-lg overflow-hidden border border-indigo-200 text-xs">
                {[[12, "12주"], [24, "24주"], ["all", "전체"]].map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setWeeklyTrendRange(val)}
                    className={`px-2.5 py-1 font-medium transition-colors ${weeklyTrendRange === val ? "bg-indigo-600 text-white" : "bg-white text-indigo-700 hover:bg-indigo-50"}`}
                  >{label}</button>
                ))}
              </div>
            </div>
          </div>

          {/* 막대 그래프 (구간 최소~최대 기준 스케일링으로 변화 폭을 잘 보이게 표시) */}
          {(() => {
            const activeValues = weeklyTrendData.map((d) => d.active);
            const maxActive = Math.max(...activeValues, 1);
            const minActive = Math.min(...activeValues, maxActive);
            const range = maxActive - minActive;
            const barWidthClass = weeklyTrendData.length > 16 ? "w-6 shrink-0" : "flex-1";
            return (
              <div className="overflow-x-auto pb-1">
                <div className={`flex gap-1.5 h-28 mb-1 ${weeklyTrendData.length > 16 ? "min-w-max" : ""}`}>
                  {weeklyTrendData.map((d) => (
                    <div key={d.weekStartStr} className={`${barWidthClass} flex flex-col items-center justify-end gap-0.5`}>
                      <span className={`text-[9px] font-bold ${d.isEstimate ? "text-slate-400" : "text-emerald-700"}`}>
                        {d.active}{d.isEstimate ? "*" : ""}
                      </span>
                      <div
                        className={`w-full rounded-t-md transition-colors cursor-default ${
                          d.isEstimate
                            ? "bg-slate-200 hover:bg-slate-300"
                            : "bg-emerald-300 hover:bg-emerald-400"
                        }`}
                        style={{
                          height: `${
                            range > 0
                              ? Math.max(((d.active - minActive) / range) * 100, 6)
                              : 50
                          }%`,
                        }}
                        title={`${d.label} 주: 재원 ${d.active}명 (${d.isEstimate ? "추정치" : "실측 스냅샷"}), 신규 ${d.new}명`}
                      />
                    </div>
                  ))}
                </div>
                {/* X축 레이블 */}
                <div className={`flex gap-1.5 mb-5 ${weeklyTrendData.length > 16 ? "min-w-max" : ""}`}>
                  {weeklyTrendData.map((d) => (
                    <div key={d.weekStartStr} className={`${barWidthClass} text-center text-[9px] text-slate-400`}>
                      {d.label}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          <p className="text-xs text-slate-400">
            * 막대 높이는 구간 내 최소~최대 값 기준으로 조정되어 변화 폭을 강조합니다(실제 값은 막대 위 숫자·hover 참고).
            <br />
            <span className="inline-flex items-center gap-1 mt-0.5">
              <span className="w-2 h-2 rounded-sm bg-emerald-300 inline-block" /> 진한 막대 = 그 주에 실제 저장된 재원생 수(정확) ·{" "}
              <span className="w-2 h-2 rounded-sm bg-slate-200 inline-block ml-1" /> 옅은 막대(숫자 옆 *) = 스냅샷 저장 이전 주라 현재 재원생 기준으로 역산한 추정치(하한선)
            </span>
          </p>
        </div>
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
    violet: "text-violet-600 bg-violet-50 group-hover:bg-violet-600",
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

  // 특정 날짜에 해당 학생의 담당 강사 조회
  // 우선순위: 출석 기록의 teacher 필드 → teacherHistory 이력 → 현재 teacher
  const getTeacherOnDate = (student, date, attendanceRecord) => {
    if (attendanceRecord?.teacher) return attendanceRecord.teacher;
    const history = student.teacherHistory;
    if (!history || history.length === 0) return student.teacher || "";
    const entry = [...history]
      .sort((a, b) => b.from.localeCompare(a.from))
      .find((h) => h.from <= date && (h.to === null || h.to >= date));
    return entry ? entry.teacher : (student.teacher || "");
  };

  // 수업일 추출 (총 회차 포함, 당일취소=0.5회, 강사 필터 적용)
  const getAttendanceDates = (student, teacherName) => {
    if (!student) return "";

    const filtered = (student.attendanceHistory || [])
      .filter(
        (h) =>
          h.date >= customStart &&
          h.date <= customEnd &&
          (h.status === "present" || h.status === "canceled") &&
          (!teacherName || getTeacherOnDate(student, h.date, h) === teacherName)
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

  // 강사별 총 시수 계산 (당일취소=0.5회 포함, 강사 이력 기반 필터)
  const getTeacherTotalHours = (teacherStudents, teacherName) => {
    return teacherStudents.reduce((total, s) => {
      return total + (s.attendanceHistory || [])
        .filter((h) =>
          h.date >= customStart &&
          h.date <= customEnd &&
          (h.status === "present" || h.status === "canceled") &&
          (!teacherName || getTeacherOnDate(s, h.date, h) === teacherName)
        )
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
      // 해당 기간에 이 강사가 담당한 출석 이력이 있으면 포함 (강사 변경 이력 반영)
      const hadAttendance = (s.attendanceHistory || []).some(
        (h) =>
          h.date >= customStart &&
          h.date <= customEnd &&
          (h.status === "present" || h.status === "canceled") &&
          getTeacherOnDate(s, h.date, h) === teacherName
      );
      if (hadAttendance) return true;
      // 현재 담당 강사이고 재원 중이면 포함 (출석 없어도)
      if (s.teacher === teacherName && s.status === "재원") return true;
      return false;
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
                총 {getTeacherTotalHours(myStudents, user.name)}회
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {myStudents.length > 0 ? (
                myStudents.map((s) => {
                  const dates = getAttendanceDates(s, user.name);
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
                  // 강사 변경 이력 반영: 해당 기간에 이 강사가 담당한 출석이 있으면 포함
                  const hadAttendance = (s.attendanceHistory || []).some(
                    (h) =>
                      h.date >= customStart &&
                      h.date <= customEnd &&
                      (h.status === "present" || h.status === "canceled") &&
                      getTeacherOnDate(s, h.date, h) === report.teacherName
                  );
                  if (hadAttendance) return true;
                  if (s.teacher === report.teacherName && s.status === "재원") return true;
                  return false;
                });
                const teacherTotalHours = getTeacherTotalHours(studentList, report.teacherName);
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
                          const dates = getAttendanceDates(s, report.teacherName);
                          return (
                            <div
                              key={s.id}
                              className="p-4 hover:bg-slate-50 active:bg-slate-100 transition-colors"
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
                                    className={`text-xs px-2 py-0.5 rounded-full border ${
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
                                    className="text-xs px-2 py-0.5 rounded-full border bg-blue-50 text-blue-600 border-blue-100 hover:bg-blue-100 transition-colors"
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
                                      className="text-xs px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-600 border-emerald-100 hover:bg-emerald-100 transition-colors"
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
  students: allStudents = [],
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
  const [showMsgModal, setShowMsgModal] = useState(false);
  const [msgTargetConsult, setMsgTargetConsult] = useState(null);
  const [msgTemplateType, setMsgTemplateType] = useState("new_lesson");
  const [msgText, setMsgText] = useState("");
  const [msgSending, setMsgSending] = useState(false);

  // 1. [기능 보존] 진행 중 / 보관함 필터링
  const filteredConsultations = useMemo(
    () =>
      allConsultations
        .filter((c) =>
          viewMode === "pending" ? c.status === "pending" : c.status !== "pending"
        )
        .sort((a, b) => (b.date || "").localeCompare(a.date || "")),
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

  // 상담 문자 템플릿 생성
  const generateConsultMsg = (consult, type) => {
    const isAdult = consult.type === "adult" || consult.type === "성인" || consult.grade === "성인";
    const nameLabel = `${consult.name} ${isAdult ? "님" : "학생"}`;
    const subject = consult.subject || "음악";
    if (type === "available") {
      return `안녕하세요, JnC 음악학원입니다. 문의해 주신 ${subject} 수업 가능 시간을 다음과 같이 안내드리게 되어 기쁘게 생각합니다.\n\n- 요일/시간: (예: 월요일 오후 4시, 수요일 오후 5시)\n\n편하신 시간에 방문하시거나 연락 주시면 자세히 안내드리겠습니다.\n\n감사합니다.\n\nJnC 음악학원장 드림.`;
    }
    if (type === "new_lesson") {
      // 이름 또는 전화번호로 등록 학생 조회 → 원비·회차·등록일·시간 자동 채움
      const matched = allStudents.find(
        (s) => s.name === consult.name || (consult.phone && s.phone === consult.phone)
      );
      const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];
      const rawRegDate = matched
        ? (matched.registrationDate || matched.createdAt?.slice(0, 10))
        : null;
      let firstLesson = "(날짜/요일/시간 입력)";
      let lessonDayKo = "";
      if (rawRegDate) {
        const d = new Date(rawRegDate + "T00:00:00");
        lessonDayKo = DAYS_KO[d.getDay()];
        const lessonTime = matched ? getStudentScheduleTime(matched, lessonDayKo) : "";
        firstLesson = lessonTime
          ? `${rawRegDate} (${lessonDayKo}) ${lessonTime}`
          : `${rawRegDate} (${lessonDayKo}) (시간 입력)`;
      }
      const rawSubject = consult.subject || "음악";
      const fullSubject = rawSubject.includes("1:1") ? rawSubject : `${rawSubject} 1:1 개인레슨`;
      const fee = matched && matched.tuitionFee
        ? `${Number(matched.tuitionFee).toLocaleString()}원`
        : "(금액)원";
      const sessions = matched
        ? (() => {
            const saved = parseInt(matched.totalSessions);
            if (!isNaN(saved) && saved > 0) return saved;
            return Object.keys(matched.schedules || {}).length >= 2 ? 8 : 4;
          })()
        : "(횟수)";
      const closingDay = lessonDayKo
        ? `다음주 ${lessonDayKo}요일에 뵙겠습니다.`
        : "(요일)에 뵙겠습니다.";
      return `안녕하세요, JnC 음악학원입니다. ${nameLabel}의 첫 수업을 다음과 같이 안내드리게 되어 기쁘게 생각합니다.\n\n* 첫 수업: ${firstLesson}\n* 과목: ${fullSubject}\n\n* 원비 안내\n월 원비: ${fee} / ${sessions}회 수업\n하나은행 125-91025-766307 강열혁(제이앤씨음악학원)\n방문(카드/현금), 계좌이체·제로페이, 온라인 카드결제 모두 가능합니다.\n\n* 취소/노쇼 안내\n당일 취소 및 노쇼는 수업 1회 차감됩니다.\n변경 사항은 수업 전날까지 연락 부탁드립니다.\n\n감사합니다. ${closingDay}\n\nJnC 음악학원장 드림.`;
    }
    if (type === "consult_confirm") {
      return `안녕하세요, JnC 음악학원입니다. ${nameLabel}의 상담 예약을 다음과 같이 안내드리게 되어 기쁘게 생각합니다.\n\n* 상담 일시: (날짜/요일/시간 입력)\n* 장소: JnC 음악학원 (목동)\n\n문의해 주셔서 감사합니다. 아래 학원 안내 정보 함께 참고하시기 바랍니다.\n\n[JnC 음악학원]\n* 위치: 서울 양천구 목동서로 35, 목동프라자 3층\n* 홈페이지: https://www.jncmusic.kr\n* 전화: 010-4028-9803\n\n[운영 시간]\n평일(월~금): 10:30 ~ 22:00\n주말(토·일): 09:00 ~ 22:00\n\n감사합니다.\n\nJnC 음악학원장 드림.`;
    }
    if (type === "academy_info") {
      return `안녕하세요, JnC 음악학원입니다.\n\n문의해 주셔서 감사합니다.\n아래 학원 안내 정보 참고 부탁드립니다.\n\n[JnC 음악학원]\n* 위치: 서울 양천구 목동서로 35, 목동프라자 3층\n* 홈페이지: https://www.jncmusic.kr\n* 전화: 010-4028-9803\n\n[운영 시간]\n평일(월~금): 10:30 ~ 22:00\n주말(토·일): 09:00 ~ 22:00\n\n[상담 안내]\n상담은 예약제로 운영됩니다.\n방문 또는 전화 상담 모두 가능하오니 편하신 방법으로 예약 후 방문 부탁드립니다.\n\n감사합니다.\n\nJnC 음악학원장 드림.`;
    }
    if (type === "blank") {
      return `안녕하세요, JnC 음악학원입니다.\n\n`;
    }
    return "";
  };

  const openMsgModal = (e, consult) => {
    e.stopPropagation();
    setMsgTargetConsult(consult);
    const defaultType = "new_lesson";
    setMsgTemplateType(defaultType);
    setMsgText(generateConsultMsg(consult, defaultType));
    setShowMsgModal(true);
  };

  return (
    <div className="bg-white rounded-2xl border shadow-sm p-6 h-full flex flex-col overflow-hidden animate-fade-in">
      {/* --- 상담 문자 템플릿 모달 --- */}
      {showMsgModal && msgTargetConsult && (
        <div className="fixed inset-0 bg-black/60 z-[120] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col" style={{ height: "78vh" }}>
            <div className="flex justify-between items-center p-5 border-b shrink-0">
              <div>
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  <MessageSquareText size={20} className="text-indigo-600" />
                  문자 템플릿
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">{msgTargetConsult.name} · {msgTargetConsult.phone}</p>
              </div>
              <button onClick={() => setShowMsgModal(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={22} className="text-slate-400" />
              </button>
            </div>
            <div className="p-4 border-b shrink-0">
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "new_lesson", label: "신규수업 안내" },
                  { id: "available", label: "수업 가능 안내" },
                  { id: "consult_confirm", label: "상담 예약 확인" },
                  { id: "academy_info", label: "학원 안내" },
                  { id: "blank", label: "빈 템플릿" },
                ].map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setMsgTemplateType(t.id);
                      setMsgText(generateConsultMsg(msgTargetConsult, t.id));
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                      msgTemplateType === t.id
                        ? "bg-indigo-600 text-white border-indigo-600"
                        : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 active:bg-slate-100"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 p-4 overflow-hidden">
              <textarea
                className="w-full h-full border border-slate-200 rounded-xl p-4 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none bg-slate-50 font-sans"
                value={msgText}
                onChange={(e) => setMsgText(e.target.value)}
                spellCheck="false"
              />
            </div>
            <div className="p-4 border-t bg-slate-50 rounded-b-2xl flex justify-between items-center shrink-0">
              <span className="text-xs text-slate-400">{msgText.length}자</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowMsgModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-bold text-sm transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={() => {
                    if (navigator.clipboard) {
                      navigator.clipboard.writeText(msgText).then(() => {
                        showToast("문자 내용이 복사되었습니다.", "success");
                        setShowMsgModal(false);
                      });
                    }
                  }}
                  className="px-4 py-2 bg-slate-600 text-white rounded-lg font-bold text-sm hover:bg-slate-700 flex items-center gap-1.5 transition-colors"
                >
                  <Copy size={15} /> 복사
                </button>
                {msgTargetConsult.phone && (
                  <button
                    onClick={async () => {
                      setMsgSending(true);
                      try {
                        await sendAligoSms(msgTargetConsult.phone, msgText);
                        showToast(`${msgTargetConsult.name} 문자 발송 완료`, "success");
                        setShowMsgModal(false);
                      } catch (err) {
                        showToast("발송 실패: " + err.message, "error");
                      } finally {
                        setMsgSending(false);
                      }
                    }}
                    disabled={msgSending}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold text-sm hover:bg-blue-700 flex items-center gap-1.5 disabled:opacity-60 transition-colors"
                  >
                    📱 {msgSending ? "발송 중..." : "문자 발송"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
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
                          : "bg-white border-slate-200 text-slate-400 hover:bg-slate-50 active:bg-slate-100"
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
              <th className="px-6 py-4 text-center w-24">문자</th>
              <th className="px-6 py-4 text-right w-20">삭제</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-100">
            {filteredConsultations.map((c) => (
              <tr
                key={c.id}
                onClick={() => openModal(c)}
                className="hover:bg-indigo-50 active:bg-indigo-100/20 cursor-pointer transition-all"
              >
                <td className="px-6 py-4">
                  <div className="text-xs text-slate-500 mb-1">{c.date}</div>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-bold ${
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
                  className="px-6 py-4 text-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={(e) => openMsgModal(e, c)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-sky-50 text-sky-600 border border-sky-100 rounded-lg text-xs font-bold hover:bg-sky-100 transition-colors"
                  >
                    📱 문자
                  </button>
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
                  colSpan="6"
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

// 강사별 고유 색상 팔레트 (주간 뷰 블록 카드용)
const TEACHER_COLOR_PALETTE = [
  { bg: "bg-violet-100",  text: "text-violet-900",  border: "border-l-violet-500"  },
  { bg: "bg-emerald-100", text: "text-emerald-900", border: "border-l-emerald-500" },
  { bg: "bg-amber-100",   text: "text-amber-900",   border: "border-l-amber-500"   },
  { bg: "bg-cyan-100",    text: "text-cyan-900",    border: "border-l-cyan-500"    },
  { bg: "bg-rose-100",    text: "text-rose-900",    border: "border-l-rose-500"    },
  { bg: "bg-indigo-100",  text: "text-indigo-900",  border: "border-l-indigo-500"  },
  { bg: "bg-pink-100",    text: "text-pink-900",    border: "border-l-pink-500"    },
  { bg: "bg-teal-100",    text: "text-teal-900",    border: "border-l-teal-500"    },
  { bg: "bg-orange-100",  text: "text-orange-900",  border: "border-l-orange-500"  },
  { bg: "bg-lime-100",    text: "text-lime-900",    border: "border-l-lime-500"    },
];

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
    for (let i = 8; i <= 22; i++) slots.push(i);
    return slots;
  }, []);

  const teacherColorMap = useMemo(() => {
    const map = {};
    [...teachers]
      .sort((a, b) => a.name.localeCompare(b.name, "ko"))
      .forEach((t, i) => {
        map[t.name] = TEACHER_COLOR_PALETTE[i % TEACHER_COLOR_PALETTE.length];
      });
    return map;
  }, [teachers]);

  const getTeachersByDay = (dayIndex) => {
    const dayNameMap = ["일", "월", "화", "수", "목", "금", "토"];
    const dayName = dayNameMap[dayIndex];
    // 실제 재원 학생 스케줄 기준으로 해당 요일에 수업 있는 강사 목록 계산
    const teacherNamesWithStudents = new Set(
      students
        .filter((s) => {
          if (s.status !== "재원") return false;
          return s.schedules ? !!s.schedules[dayName] : s.className === dayName;
        })
        .map((s) => s.teacher)
        .filter(Boolean)
    );
    let dayTeachers = teachers.filter((t) => teacherNamesWithStudents.has(t.name));
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
      // getLessonTime과 동일한 우선순위: schedules 있으면 schedules만, 없으면 className 레거시 폴백
      const isDayMatch = s.schedules
        ? !!s.schedules[dayName]
        : s.className === dayName;
      return isTeacherMatch && isDayMatch && isStatusMatch;
    });
    const attended = students.filter((s) => {
      if (s.teacher !== teacherName) return false;
      if (s.status !== "재원") return false;
      return s.attendanceHistory?.some((h) => h.date === dateStr);
    });
    // 보강 예정일에 해당하는 학생 (다른 날짜에 reschedule 등록 → makeupDate가 dateStr인 경우)
    const makeup = students.filter((s) => {
      if (s.teacher !== teacherName) return false;
      if (s.status !== "재원") return false;
      return s.attendanceHistory?.some(
        (h) => h.status === "reschedule" && h.makeupDate === dateStr
      );
    });
    const merged = [...scheduled];
    [...attended, ...makeup].forEach((s) => {
      if (!merged.find((m) => m.id === s.id)) merged.push(s);
    });
    return merged;
  };

  const handleCalendarAttendance = async (
    student,
    date,
    status,
    reason = "",
    memo = "",
    makeupDate = "",
    makeupTime = ""
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
      } else if (status === "reschedule") {
        // 보강: 원래 날짜에 reschedule 기록 저장
        const record = {
          date,
          status: "reschedule",
          makeupDate,
          makeupTime,
          reason,
          teacher: student.teacher || "",
          timestamp: new Date().toISOString(),
        };
        if (existingIdx > -1) history[existingIdx] = record;
        else history.push(record);
      } else {
        // 보강 수업 출석: reschedule 기록의 makeupDate에 출석 저장 (원본 날짜 아닌 실제 보강일에 기록)
        let targetDate = date;
        if (status === "present") {
          const reschRec = history.find(
            (h) => h.date === date && h.status === "reschedule" && h.makeupDate
          );
          if (reschRec) targetDate = reschRec.makeupDate;
        }
        const targetIdx = history.findIndex((h) => h.date === targetDate);
        const prevCount = targetIdx > -1 ? (history[targetIdx].count || 1) : 1;
        const record = {
          date: targetDate,
          status: status,
          reason: reason,
          teacher: student.teacher || "",
          timestamp: new Date().toISOString(),
        };
        if (status === "present") record.count = prevCount;
        if (memo) record.memo = memo;
        if (targetIdx > -1) history[targetIdx] = record;
        else history.push(record);
      }
      // reschedule은 세션 차감 안 함 (보강 완료 시 present로 별도 처리)
      const lastPayment = student.lastPaymentDate || "0000-00-00";
      const sessionsCompleted = history.reduce((sum, h) => {
        if (h.date < lastPayment) return sum;
        if (h.status === "present") return sum + (h.count || 1);
        if (h.status === "canceled") return sum + 1;
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
        : status === "reschedule" ? `보강 등록: ${makeupDate}`
        : "저장됨",
        "success"
      );
    } catch (e) {
      console.error(e);
      showToast("오류 발생", "error");
    }
  };

  const handleStatusSelect = (status, memo = "", makeupDate = "", makeupTime = "") => {
    if (status === "reschedule") {
      handleCalendarAttendance(
        attendanceMenu.student,
        attendanceMenu.date,
        "reschedule",
        memo,   // reason 전달
        "",
        makeupDate,
        makeupTime
      );
      setAttendanceMenu(null);
    } else if (status === "present" || status === "delete" || status === "double") {
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
    // 누적 출석 기반 순환 회차 반환 (1·2·3·4·1·2·3·4…)
    // 수납관리와 별개 — 수업일지/캘린더 표시 전용
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
        return (cumulative + cnt) % total === 0;
      }
      if (h.date > targetDate) break;
      cumulative += h.status === "canceled" ? 1 : (h.count || 1);
    }
    return false;
  };

  // [기능2] 오늘 이전 날짜 중 출석 미처리(scheduled) 여부
  const todayStr = toLocalDateStr();
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
      return !time || parseInt(time.split(":")[0], 10) !== hour;
    });
  };

  const getDetailModalData = (dateStr, dayOfWeek) => {
    const dayNameMap = ["일", "월", "화", "수", "목", "금", "토"];
    const dayName = dayNameMap[dayOfWeek];
    let currentTeachers = teachers;
    if (selectedTeacher)
      currentTeachers = teachers.filter((t) => t.name === selectedTeacher);
    let allStudents = [];
    currentTeachers.forEach((t) => {
      const studentsForTeacher = getStudentsForCell(t.name, dayOfWeek, dateStr);
      allStudents = [...allStudents, ...studentsForTeacher];
    });
    // 시간순 정렬
    return allStudents.sort((a, b) => {
      const tA = (a.schedules && a.schedules[dayName]) || "99:99";
      const tB = (b.schedules && b.schedules[dayName]) || "99:99";
      return tA.localeCompare(tB);
    });
  };

  const renderWeeklyView = () => {
    return (
      <div className="flex flex-col h-full border rounded-lg overflow-hidden bg-white">
        {/* 날짜 헤더 */}
        <div className="grid grid-cols-8 border-b bg-slate-50 shrink-0">
          <div className="p-2 text-center text-xs font-bold text-slate-500 border-r">
            Time
          </div>
          {weekDates.map((date, i) => {
            const dateStr = toLocalDateStr(date);
            const isToday = dateStr === toLocalDateStr();
            return (
              <div
                key={i}
                onClick={() => { setCurrentDate(new Date(date)); setViewType("day"); }}
                className={`p-2 text-center border-r last:border-r-0 cursor-pointer hover:bg-indigo-50 active:bg-indigo-100 transition-colors ${isToday ? "bg-indigo-50" : ""}`}
              >
                <div className={`text-xs font-bold ${i === 6 ? "text-rose-500" : i === 5 ? "text-blue-500" : "text-slate-700"}`}>
                  {DAYS_OF_WEEK.find((d) => d.id === (i + 1) % 7)?.label}
                </div>
                <div className={`text-xs ${isToday ? "text-indigo-600 font-bold" : "text-slate-500"}`}>
                  {date.getDate()}
                </div>
              </div>
            );
          })}
        </div>
        {/* 강사 색상 범례 */}
        <div className="flex gap-1.5 flex-wrap px-3 py-2 border-b bg-white shrink-0">
          {teachers.map((t) => {
            const c = teacherColorMap[t.name] || TEACHER_COLOR_PALETTE[0];
            return (
              <span key={t.name} className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.bg} ${c.text}`}>
                {t.name}
              </span>
            );
          })}
        </div>
        {/* 시간대 그리드 */}
        <div className="flex-1 overflow-y-auto">
          {timeSlots.map((hour) => (
            <div key={hour} className="grid grid-cols-8 border-b min-h-[80px]">
              <div className="p-2 text-center text-xs text-slate-400 border-r font-mono bg-slate-50 shrink-0">
                {hour}:00
              </div>
              {weekDates.map((date, i) => {
                const dateStr = toLocalDateStr(date);
                const dayOfWeek = date.getDay();
                let cellStudents = [];
                const targetTeachers = selectedTeacher
                  ? [teachers.find((t) => t.name === selectedTeacher)]
                  : teachers;
                targetTeachers.forEach((t) => {
                  if (!t) return;
                  const st = getStudentsForCell(t.name, dayOfWeek, dateStr);
                  const timeFiltered = st.filter((s) => {
                    const dayName = ["일", "월", "화", "수", "목", "금", "토"][dayOfWeek];
                    // 보강 학생: makeupTime 기준으로 시간 슬롯 결정
                    const makeupRec = s.attendanceHistory?.find(
                      (h) => h.status === "reschedule" && h.makeupDate === dateStr
                    );
                    if (makeupRec) {
                      if (!makeupRec.makeupTime) return false;
                      return parseInt(makeupRec.makeupTime.split(":")[0], 10) === hour;
                    }
                    const time = getStudentScheduleTime(s, dayName);
                    return time && parseInt(time.split(":")[0], 10) === hour;
                  });
                  cellStudents = [...cellStudents, ...timeFiltered];
                });
                const emptySlot = selectedTeacher && cellStudents.length === 0 &&
                  isEmptySlot(selectedTeacher, hour, dayOfWeek, dateStr) &&
                  dateStr >= todayStr;
                return (
                  <div
                    key={i}
                    className={`p-1 border-r last:border-r-0 relative ${emptySlot ? "bg-emerald-50/40" : ""}`}
                  >
                    {emptySlot && (
                      <div className="text-[9px] text-emerald-400 text-center mt-1 font-medium">빈 슬롯</div>
                    )}
                    {cellStudents.map((s, idx) => {
                      const record = s.attendanceHistory?.find((h) => h.date === dateStr);
                      // 보강 예정일인지: 다른 날짜 reschedule의 makeupDate가 오늘
                      const makeupRecord = !record
                        ? s.attendanceHistory?.find((h) => h.status === "reschedule" && h.makeupDate === dateStr)
                        : null;
                      const status = record ? record.status : makeupRecord ? "makeup" : "scheduled";
                      const isDoubleLesson = status === "present" && (record?.count || 1) === 2;
                      const sessionNum = getSessionCount(s, dateStr);
                      const isLast = status === "present" && isLastSessionOfCycle(s, dateStr);
                      const isUnprocessed = isUnprocessedPast(s, dateStr);
                      const tc = teacherColorMap[s.teacher] ?? TEACHER_COLOR_PALETTE[0];
                      const isAbsent = status === "absent";
                      const isCanceled = status === "canceled";
                      const isReschedule = status === "reschedule";
                      const isMakeup = status === "makeup";
                      return (
                        <div
                          key={idx}
                          onClick={(e) => { e.stopPropagation(); setAttendanceMenu({ student: s, date: dateStr }); }}
                          className={`border-l-4 rounded-lg px-2 py-1.5 mb-1 cursor-pointer transition-all hover:brightness-95
                            ${isAbsent
                              ? "bg-slate-100 border-l-slate-400 opacity-60"
                              : isCanceled
                              ? "bg-slate-50 border-l-slate-300 opacity-50"
                              : isReschedule
                              ? "bg-blue-50 border-l-blue-400 opacity-80"
                              : isMakeup
                              ? "bg-sky-50 border-l-sky-500 ring-1 ring-sky-300"
                              : isUnprocessed
                              ? `${tc.bg} border-l-amber-500 ring-1 ring-amber-400`
                              : `${tc.bg} ${tc.border}`}`}
                        >
                          <div className={`text-xs font-bold flex items-center gap-1 ${isAbsent || isCanceled ? "text-slate-400" : isReschedule || isMakeup ? "text-blue-700" : tc.text}`}>
                            <span className="truncate">{s.name}</span>
                            {sessionNum > 0 && <span className="shrink-0 text-[9px] opacity-60 font-normal">({sessionNum})</span>}
                            {isDoubleLesson && <span className="shrink-0 text-[8px] bg-indigo-700 text-white px-1 rounded leading-tight">×2</span>}
                            {isLast && <span className="shrink-0 text-xs">💳</span>}
                            {isUnprocessed && <span className="shrink-0 text-amber-500 font-bold">!</span>}
                            {isMakeup && <span className="shrink-0 text-[9px] bg-sky-500 text-white px-1 rounded leading-tight">보강</span>}
                          </div>
                          <div className="text-xs text-slate-500 truncate">{s.teacher} · {s.subject}</div>
                          {status === "present" && !isDoubleLesson && <div className="text-[9px] text-emerald-600 font-medium">✓ 출석</div>}
                          {isDoubleLesson && <div className="text-[9px] text-indigo-600 font-medium">✓ 연강 출석</div>}
                          {isAbsent && <div className="text-[9px] text-rose-500">✗ 결석</div>}
                          {isCanceled && <div className="text-[9px] text-slate-400">취소</div>}
                          {isReschedule && <div className="text-[9px] text-blue-500">🔄 보강 예정: {record.makeupDate?.replace(/-/g,'/')}{record.makeupTime ? ' ' + record.makeupTime : ''}</div>}
                          {isMakeup && <div className="text-[9px] text-sky-600 font-medium">🔄 보강 수업</div>}
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
    const dateStr = toLocalDateStr(currentDate);
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
                      // 보강 학생: makeupTime 기준으로 시간 슬롯 결정
                      const makeupRec = s.attendanceHistory?.find(
                        (h) => h.status === "reschedule" && h.makeupDate === dateStr
                      );
                      if (makeupRec) {
                        if (!makeupRec.makeupTime) return false;
                        return makeupRec.makeupTime.startsWith(`${hour}:`);
                      }
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
                        className={`h-20 border-b p-1 transition-colors ${emptySlot ? "bg-emerald-50/40" : "hover:bg-slate-50 active:bg-slate-100"}`}
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
                              className={`text-xs p-1 rounded border mb-1 cursor-pointer shadow-sm flex items-center gap-0.5 ${bgClass}`}
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
              className={`bg-white p-2 min-h-[80px] hover:bg-indigo-50 active:bg-indigo-100 transition-colors relative group border-t border-slate-50 cursor-pointer`}
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
                  <span className="text-xs font-bold text-rose-500 bg-rose-50 px-1 rounded">
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
                          className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded truncate"
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
                        "bg-slate-100 text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 active:bg-indigo-100";
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
                          className={`text-xs px-1.5 py-1 rounded border ${bgClass} font-medium flex justify-between items-center gap-0.5 transition-all shadow-sm`}
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
                    <div className="text-xs text-slate-400 font-medium text-center mt-1">
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
          <CalendarIcon className="mr-2 text-indigo-600" size={24} />
          {viewType === "day"
            ? `${year}년 ${month + 1}월 ${currentDate.getDate()}일 (${["일", "월", "화", "수", "목", "금", "토"][currentDate.getDay()]})`
            : `${year}년 ${month + 1}월`}
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
                if (viewType === "month")
                  setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
                else if (viewType === "week")
                  setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 7));
                else
                  setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 1));
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
                if (viewType === "month")
                  setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
                else if (viewType === "week")
                  setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 7));
                else
                  setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1));
              }}
              className="p-1.5 hover:bg-white rounded-md text-slate-600 shadow-sm"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
      {/* 범례 */}
      <div className="flex items-center gap-3 text-xs text-slate-500 mb-2 flex-wrap">
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
    // 누적 출석 순환 방식 (결제와 무관하게 1→2→3→4→1... 반복)
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
      // 1회 → 연강 2회 (오클릭 방지 확인 — 즉시 저장되므로 한 번 더 확인)
      if (!window.confirm(
        `${student.name} 학생의 ${dateStr}을(를) 연강(2회)으로 처리할까요?\n\n연강은 수업 2회로 계산되어 결제 회차에 반영됩니다.`
      )) {
        return;
      }
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

  // 모바일 아젠다 뷰용: 일자별 항목 미리 계산 (월간 그리드와 동일 로직 재사용)
  const dayEntries = days
    .map((day) => {
      if (!day) return null;
      const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const dateObj = new Date(year, month, day);
      return {
        day,
        dateStr,
        dayOfWeek: dateObj.getDay(),
        items: getCellContent(dateStr, dateObj.getDay()),
      };
    })
    .filter(Boolean);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-4 md:p-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4 md:mb-6">
        <h2 className="text-lg md:text-xl font-bold text-slate-800 flex items-center">
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
      {/* 데스크톱: 월간 그리드 */}
      <div className="hidden md:block border rounded-lg overflow-hidden">
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
                className="min-h-[100px] p-1 relative hover:bg-slate-50 active:bg-slate-100 transition-colors"
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
                    <span className="text-xs text-rose-500 font-bold">
                      {isHoliday}
                    </span>
                  )}
                </div>
                <div className="mt-1 space-y-0.5">
                  {items.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => handleItemClick(item.id, dateStr)}
                      className={`text-xs px-1 py-0.5 rounded truncate cursor-pointer transition-colors ${
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

      {/* 모바일: 리스트형 아젠다 뷰 (일자별 카드, 수업 있는 날만 표시) */}
      <div className="md:hidden space-y-2">
        {dayEntries.filter((e) => e.items.length > 0).length === 0 ? (
          <div className="text-center text-slate-400 text-sm py-12 border border-dashed rounded-lg">
            이번 달 수업 기록이 없습니다.
          </div>
        ) : (
          dayEntries
            .filter((e) => e.items.length > 0)
            .map((entry) => {
              const dayLabel = ["일", "월", "화", "수", "목", "금", "토"][entry.dayOfWeek];
              const isHoliday = HOLIDAYS[entry.dateStr];
              return (
                <div key={entry.dateStr} className="border border-slate-200 rounded-lg overflow-hidden">
                  <div
                    className={`flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200 font-bold text-sm ${
                      entry.dayOfWeek === 0
                        ? "text-rose-500"
                        : entry.dayOfWeek === 6
                        ? "text-blue-500"
                        : "text-slate-700"
                    }`}
                  >
                    <span>
                      {month + 1}월 {entry.day}일 ({dayLabel})
                    </span>
                    {isHoliday && (
                      <span className="text-xs text-rose-500 font-bold">{isHoliday}</span>
                    )}
                  </div>
                  <div className="divide-y divide-slate-100 bg-white">
                    {entry.items.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleItemClick(item.id, entry.dateStr)}
                        className={`px-3 py-2.5 text-sm cursor-pointer active:bg-slate-50 transition-colors ${
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
            })
        )}
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

  // 강사 메모 전달 상태
  const [memoTarget, setMemoTarget] = useState("");
  const [memoText, setMemoText] = useState("");
  const [memoSending, setMemoSending] = useState(false);

  // 강사 메모 전달 핸들러
  const handleSendMemoToTeacher = async () => {
    if (!memoTarget || !memoText.trim()) {
      showToast("강사와 메모 내용을 입력해주세요.", "warning");
      return;
    }
    const targetTeacher = teachers.find((t) => t.name === memoTarget);
    if (!targetTeacher) return;
    setMemoSending(true);
    try {
      const teacherRef = doc(db, "artifacts", APP_ID, "public", "data", "teachers", targetTeacher.id);
      const newNotice = {
        id: Date.now(),
        studentName: "",
        date: new Date().toISOString().slice(0, 10),
        memo: memoText.trim(),
        createdAt: new Date().toISOString(),
      };
      const existing = targetTeacher.pendingMemos || [];
      await updateDoc(teacherRef, { pendingMemos: [...existing, newNotice] });
      showToast(`${memoTarget} 강사에게 메모 전달 완료`);
      setMemoText("");
    } catch (e) {
      showToast("전달 실패: " + e.message, "error");
    } finally {
      setMemoSending(false);
    }
  };

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
    // data 안에 name, password, part, days, residentId, bankName, bankAccount가 모두 들어있음
    const { name, password, part, days, oldName, residentId, bankName, bankAccount } = data;

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
        password,
        part,
        days,
        residentId: residentId || "",
        bankName: bankName || "",
        bankAccount: bankAccount || "",
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
            <label className="flex-1 inline-flex justify-center items-center px-4 py-2 bg-white border border-indigo-300 text-indigo-700 rounded-lg cursor-pointer hover:bg-indigo-50 active:bg-indigo-100 font-bold shadow-sm transition-colors text-sm">
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
                    className="ml-2 text-xs text-indigo-500 hover:underline cursor-pointer"
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
              <div className="absolute top-0 right-0 px-3 py-1 rounded-bl-xl text-xs font-bold bg-slate-100 text-slate-600 border-l border-b border-slate-200">
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
                  <span className="text-xs font-bold text-slate-500">
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
                      className="text-xs bg-white border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded shadow-sm"
                    >
                      {DAYS_OF_WEEK.find((day) => day.id === d)?.label}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-300">요일 미정</span>
                )}
              </div>

              <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => handleDeleteTeacher(t.id, e)}
                  className="text-rose-400 hover:text-rose-600 p-2 hover:bg-rose-50 rounded"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 결제 링크 설정 (결제선생 등 외부 결제 URL) */}
      {/* 강사 메모 직접 전달 */}
      <div className="mt-8 p-6 bg-amber-50 rounded-xl border border-amber-200">
        <h3 className="font-bold text-amber-900 mb-1 flex items-center">
          📝 강사에게 메모 전달
        </h3>
        <p className="text-xs text-amber-700 mb-4">
          출석부 없이 강사에게 직접 메모를 전달합니다. 강사가 로그인 시 팝업으로 확인할 수 있습니다.
        </p>
        <div className="flex gap-2 mb-3">
          <select
            value={memoTarget}
            onChange={(e) => setMemoTarget(e.target.value)}
            className="p-2.5 border rounded-xl bg-white focus:outline-amber-500 text-sm min-w-[120px]"
          >
            <option value="">강사 선택</option>
            {teachers.filter((t) => t.name).map((t) => (
              <option key={t.id} value={t.name}>{t.name}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <textarea
            value={memoText}
            onChange={(e) => setMemoText(e.target.value)}
            placeholder="전달할 메모 내용을 입력하세요..."
            rows={2}
            className="flex-1 p-3 border rounded-xl bg-white focus:outline-amber-500 text-sm resize-none"
          />
          <button
            onClick={handleSendMemoToTeacher}
            disabled={memoSending || !memoTarget || !memoText.trim()}
            className="px-5 py-2.5 bg-amber-500 text-white rounded-xl font-bold hover:bg-amber-600 shadow-sm text-sm disabled:opacity-40 disabled:cursor-not-allowed self-end"
          >
            {memoSending ? "전달 중..." : "전달"}
          </button>
        </div>
        {/* 강사별 미확인 메모 현황 */}
        {teachers.some((t) => (t.pendingMemos || []).length > 0) && (
          <div className="mt-4 pt-4 border-t border-amber-200">
            <p className="text-xs font-bold text-amber-800 mb-2">미확인 메모 현황</p>
            <div className="space-y-1">
              {teachers
                .filter((t) => (t.pendingMemos || []).length > 0)
                .map((t) => (
                  <div key={t.id} className="flex items-center gap-2 text-xs text-amber-700">
                    <span className="font-bold">{t.name}</span>
                    <span className="bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full font-bold">
                      {t.pendingMemos.length}건
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

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
  const [password, setPassword] = useState(teacher.password || "");
  const [residentId, setResidentId] = useState(teacher.residentId || "");
  const [bankName, setBankName] = useState(teacher.bankName || "");
  const [bankAccount, setBankAccount] = useState(teacher.bankAccount || "");

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
                  className="ml-2 text-xs text-indigo-500 hover:underline cursor-pointer"
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

          {/* 주민번호 */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">
              주민등록번호 <span className="font-normal text-slate-400">(세무 자료용)</span>
            </label>
            <input
              className="w-full p-3 border rounded-xl bg-slate-50 focus:outline-indigo-600 font-mono tracking-widest"
              value={residentId}
              onChange={(e) => setResidentId(e.target.value)}
              placeholder="000000-0000000"
              maxLength={14}
            />
          </div>

          {/* 계좌번호 */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">
              계좌번호 <span className="font-normal text-slate-400">(급여 이체용)</span>
            </label>
            <div className="flex gap-2">
              <input
                className="w-24 p-3 border rounded-xl bg-slate-50 focus:outline-indigo-600 text-sm"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="은행명"
              />
              <input
                className="flex-1 p-3 border rounded-xl bg-slate-50 focus:outline-indigo-600 font-mono"
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
                placeholder="계좌번호"
              />
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
                residentId,
                bankName,
                bankAccount,
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
  const [showReschedule, setShowReschedule] = React.useState(
    currentRecord?.status === "reschedule"
  );
  const [makeupDate, setMakeupDate] = React.useState(
    currentRecord?.makeupDate || ""
  );
  const [makeupTime, setMakeupTime] = React.useState(
    currentRecord?.makeupTime || ""
  );
  const [rescheduleReason, setRescheduleReason] = React.useState(
    currentRecord?.reason || "강사 사정"
  );
  const isPresent = currentRecord?.status === "present";
  const isDouble = isPresent && (currentRecord.count || 1) === 2;
  const isReschedule = currentRecord?.status === "reschedule";

  if (showReschedule) {
    return (
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="bg-white rounded-xl shadow-2xl w-full max-w-xs p-4 animate-in fade-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="font-bold text-center mb-1">🔄 보강 일정</h3>
          <p className="text-xs text-center text-slate-500 mb-4">{student.name} — {date}</p>
          <div className="flex flex-col gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-500">보강 날짜 / 시간</label>
                {makeupDate && (
                  <span className="text-xs font-bold text-blue-600">
                    {makeupDate.replace(/-/g, '/')}{makeupTime ? ' ' + makeupTime : ''}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="date"
                  lang="ko-KR"
                  value={makeupDate}
                  onChange={(e) => setMakeupDate(e.target.value)}
                  className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
                <input
                  type="time"
                  value={makeupTime}
                  onChange={(e) => setMakeupTime(e.target.value)}
                  className="w-28 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1">사유</label>
              <div className="flex gap-2 mb-1">
                {["강사 사정", "학생 사정", "기타"].map((r) => (
                  <button
                    key={r}
                    onClick={() => setRescheduleReason(r)}
                    className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                      rescheduleReason === r
                        ? "bg-blue-100 border-blue-400 text-blue-700"
                        : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-blue-50"
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowReschedule(false)}
                className="flex-1 py-2 text-sm text-slate-500 hover:bg-slate-100 rounded-lg font-bold border"
              >
                취소
              </button>
              <button
                onClick={() => {
                  if (!makeupDate) return;
                  onSelectStatus("reschedule", rescheduleReason, makeupDate, makeupTime);
                }}
                disabled={!makeupDate}
                className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-40"
              >
                보강 저장
              </button>
            </div>
            {isReschedule && (
              <button
                onClick={() => onSelectStatus("delete", "")}
                className="w-full py-2 text-xs text-rose-400 hover:text-rose-600 font-medium flex items-center justify-center gap-1"
              >
                <Trash2 size={14} /> 보강 기록 삭제
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

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
              onClick={() => {
                // 연강(2회) 처리 시 오클릭 방지 확인 — 해제는 확인 없이 진행
                if (!isDouble) {
                  const ok = window.confirm(
                    `${student.name} 학생의 ${date}을(를) 연강(2회)으로 처리할까요?\n\n연강은 수업 2회로 계산되어 결제 회차에 반영됩니다.`
                  );
                  if (!ok) return;
                }
                onSelectStatus("double", memo);
              }}
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
          {/* 보강 버튼 */}
          <button
            onClick={() => setShowReschedule(true)}
            className={`w-full py-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2 ${
              isReschedule
                ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                : "bg-blue-50 text-blue-600 hover:bg-blue-100"
            }`}
          >
            🔄 {isReschedule ? `보강 예정 (${currentRecord.makeupDate?.replace(/-/g, '/')}${currentRecord.makeupTime ? ' ' + currentRecord.makeupTime : ''}) — 수정` : "보강 일정 등록"}
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

// [Helper: RescheduleModal] - 출석부(AttendanceView) 보강 일정 등록용
const RescheduleModal = ({ student, date, existingMakeupDate, existingMakeupTime, existingReason, onClose, onSave }) => {
  const [makeupDate, setMakeupDate] = React.useState(existingMakeupDate || "");
  const [makeupTime, setMakeupTime] = React.useState(existingMakeupTime || "");
  const [reason, setReason] = React.useState(existingReason || "강사 사정");
  const isEdit = !!existingMakeupDate;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-xs p-4 animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-bold text-center mb-1">🔄 보강 일정 {isEdit ? "수정" : "등록"}</h3>
        <p className="text-xs text-center text-slate-500 mb-4">{student.name} — {date}</p>
        <div className="flex flex-col gap-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-500">보강 날짜 / 시간</label>
              {makeupDate && (
                <span className="text-xs font-bold text-blue-600">
                  {makeupDate.replace(/-/g, '/')}{makeupTime ? ' ' + makeupTime : ''}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <input
                type="date"
                lang="ko-KR"
                value={makeupDate}
                onChange={(e) => setMakeupDate(e.target.value)}
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <input
                type="time"
                value={makeupTime}
                onChange={(e) => setMakeupTime(e.target.value)}
                className="w-28 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">사유</label>
            <div className="flex gap-2">
              {["강사 사정", "학생 사정", "기타"].map((r) => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
                  className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                    reason === r
                      ? "bg-blue-100 border-blue-400 text-blue-700"
                      : "bg-slate-50 border-slate-200 text-slate-500 hover:bg-blue-50"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2 text-sm text-slate-500 hover:bg-slate-100 rounded-lg font-bold border"
            >
              취소
            </button>
            <button
              onClick={() => {
                if (!makeupDate) return;
                onSave(makeupDate, reason, makeupTime);
              }}
              disabled={!makeupDate}
              className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-40"
            >
              보강 저장
            </button>
          </div>
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
                className="flex justify-between items-center p-3 border rounded-lg hover:bg-slate-50 active:bg-slate-100 cursor-pointer"
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
            <div key={d} className="text-xs text-slate-400">
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
      setTempHistory([...tempHistory, { date: dateStr, status: "present", count: 1, teacher: student.teacher || "", reason: "초기입력", timestamp: new Date().toISOString() }]);
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
              className="px-4 py-2 bg-white border rounded-lg hover:bg-slate-50 active:bg-slate-100 text-sm font-bold shadow-sm"
            >
              ◀ 이전 달
            </button>
            <button
              onClick={() => {
                setBaseDate(new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1));
              }}
              className="px-4 py-2 bg-white border rounded-lg hover:bg-slate-50 active:bg-slate-100 text-sm font-bold shadow-sm"
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
            <div key={d} className="text-xs text-slate-400">
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
                      : "bg-white text-slate-500 border-slate-100 hover:border-indigo-300 hover:bg-indigo-50 active:bg-indigo-100"
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
              className="px-4 py-2 bg-white border rounded-lg hover:bg-slate-50 active:bg-slate-100 text-sm font-bold shadow-sm"
            >
              ◀ 이전 달
            </button>
            <button
              onClick={() => {
                setBaseDate(new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 1));
              }}
              className="px-4 py-2 bg-white border rounded-lg hover:bg-slate-50 active:bg-slate-100 text-sm font-bold shadow-sm"
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
      classDays: Object.keys(schedule || {}),
      className: Object.keys(schedule || {})[0] || "",
      time: Object.values(schedule || {})[0] || "",
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
              <div key={day} className="text-xs text-slate-400">
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
                      className="text-xs text-red-400 hover:text-red-600 underline text-center"
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
        <div className="p-6 border-t bg-slate-50 flex justify-between gap-3 sticky bottom-0 z-10">
          {/* 등록서류 인쇄 (기존 학생만) */}
          {student ? (
            <button
              onClick={() => {
                const s = formData;
                const scheduleStr = Object.entries(s.schedules || {})
                  .map(([day, time]) => `${day}요일 ${time || ""}`)
                  .join(",  ");
                const fee = s.tuitionFee ? Number(s.tuitionFee).toLocaleString() + "원" : "";
                const schoolGrade = [s.school, s.grade && s.grade !== "성인" ? s.grade : ""].filter(Boolean).join(" ");
                const html = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><title>J&C 등록서류</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:"Malgun Gothic","맑은 고딕",sans-serif; font-size:11pt; color:#111; }
@page { size:A4; margin:18mm 16mm; }
.page { page-break-after:always; }
.page:last-child { page-break-after:avoid; }
h1,h2 { text-align:center; letter-spacing:6px; margin-bottom:14px; }
h1 { font-size:17pt; } h2 { font-size:15pt; }
.date-line { text-align:right; margin-bottom:12px; font-size:10pt; }
table { width:100%; border-collapse:collapse; }
td,th { border:1px solid #666; padding:7px 10px; font-size:10.5pt; vertical-align:middle; }
.lbl { background:#f0f0f0; font-weight:bold; text-align:center; white-space:nowrap; width:110px; }
.fixed { background:#fafafa; font-size:10pt; line-height:1.7; }
.sig { text-align:center; margin-top:10px; }
.sec { font-weight:bold; font-size:11pt; margin:14px 0 6px; }
.sub { font-size:9.5pt; font-weight:normal; }
</style></head><body>

<div class="page">
<h1>J&amp;C  Music  Academy  등록원서</h1>
<div class="date-line">20__ 년 __ 월 __ 일</div>
<table>
<tr><td class="lbl">성 명</td><td>${s.name||""}</td><td class="lbl" style="width:70px">성 별</td><td style="width:90px">&nbsp;</td></tr>
<tr><td class="lbl">생년월일</td><td>&nbsp;</td><td class="lbl">연 락 처</td><td>${s.phone||""}</td></tr>
<tr><td class="lbl">주 소</td><td colspan="3">&nbsp;</td></tr>
<tr><td class="lbl">학교 / 소속</td><td colspan="3">${schoolGrade||"&nbsp;"}</td></tr>
<tr><td class="lbl">수 강 과 목</td><td colspan="3">${s.subject||"&nbsp;"}</td></tr>
<tr><td class="lbl">배우는 목적</td><td colspan="3">취미</td></tr>
<tr><td class="lbl">첫 수업일자</td><td>${s.registrationDate||""}</td><td class="lbl">담당 선생님</td><td>${s.teacher ? s.teacher+" 선생님" : ""}</td></tr>
<tr><td class="lbl">수업 요일<br>및 시간</td><td colspan="3">${scheduleStr||"&nbsp;"}</td></tr>
<tr><td class="lbl">소개 / 경로</td><td colspan="3">&nbsp;</td></tr>
<tr><td class="lbl">결제방법 /<br>결제일 / 금액</td><td colspan="3">${fee ? "수강료: "+fee+"&nbsp;" : "&nbsp;"}</td></tr>
<tr><td class="lbl">노쇼 및<br>당일취소 안내</td><td colspan="3" class="fixed">
본 원은 당일취소 및 노쇼에 대해 1회분 수업이 차감됩니다.<br>
단, 호흡기질환/경조사 등에 대해서는 차감되지 않습니다.<br>
전날까지 연락 주시면 자유롭게 수업 변경이 가능합니다.
<div class="sig">확인 : ________________ (인)</div></td></tr>
<tr><td class="lbl">기타 특기사항</td><td colspan="3" style="height:44px">&nbsp;</td></tr>
<tr><td class="lbl">개인정보<br>이용 동의</td><td colspan="3" class="fixed">
본 학원의 원비 결제와 원활한 수업 진행을 위해 학생의 연락처와 성명 등 개인정보를 활용하는데 동의합니다.
<div class="sig" style="margin-top:10px">동의 (　) &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 작성자 : ________________ (인)</div></td></tr>
</table>
</div>

<div class="page">
<h2>J&amp;C  Music  Academy  입학 안내문</h2>

<div class="sec">1. 환불 규정 안내 &nbsp;<span class="sub">(학원법 시행령 제18조 3항에 의거)</span></div>
<table>
<tr><th class="lbl">구 분</th><th class="lbl">환불 금액</th></tr>
<tr><td class="lbl">첫 수업 전 환불</td><td style="text-align:center">100% 환불</td></tr>
<tr><td class="lbl">1/3 경과 전 환불</td><td style="text-align:center">납부 수강료 2/3 해당 금액</td></tr>
<tr><td class="lbl">1/2 경과 전 환불</td><td style="text-align:center">납부 수강료 1/2 해당 금액</td></tr>
<tr><td class="lbl">1/2 경과 후 환불</td><td style="text-align:center">환불 불가</td></tr>
</table>
<p style="font-size:9.5pt;margin-top:3px">※ 환불정산: 주 1회(4회 기준) 횟수 기준으로 적용</p>

<div class="sec">2. 수강 안내</div>
<table>
<tr><td class="lbl">수업 결제 안내</td><td>결제는 4회차 종료 후, 다음 1회차 수업 시작 전까지 완료 부탁드립니다.<br><span style="font-size:9.5pt">· 수강료 2회 미납 시 3회차 수업 준비가 어려울 수 있습니다.</span></td></tr>
<tr><td class="lbl">등록 기간</td><td>4회차 단위로 운영되며, 등록 기간은 별도로 안내드립니다.</td></tr>
<tr><td class="lbl">노쇼 · 당일취소</td><td>당일취소 및 노쇼는 1회분 수업이 차감됩니다.<br>공휴일 및 기타 학원 사정으로 수업이 진행되지 않는 경우 회차 차감 없음.<br><span style="font-size:9.5pt">전날까지 연락 시 자유롭게 수업 변경 가능합니다.</span></td></tr>
<tr><td class="lbl">가족 할인</td><td>두 번째 과목 등록 시 해당 과목 수강료에서 30,000원 할인<br><span style="font-size:9.5pt">(1인 2과목 또는 가족 구성원 모두 동일 적용)</span></td></tr>
</table>

<div class="sec">3. 결제 안내</div>
<table>
<tr><td class="lbl">수 강 료</td><td>등록 시 안내드린 금액 기준${fee ? " · <b>"+fee+"</b>" : ""} · 과목 추가 시 30,000원 할인 적용</td></tr>
<tr><td class="lbl" style="vertical-align:top">결제 방법</td><td>
· 방문 결제 &nbsp; : 카드 / 현금<br>
· 계좌이체 &nbsp; : 하나은행 125-91025-766307 &nbsp; 강열혁 (제이앤씨음악학원)<br>
· 제로페이 &nbsp; : 방문 시 이용 가능<br>
· 온라인 결제 : 카드 결제 희망 시 담당 선생님께 문의 — 결제선생(카카오톡 페이지) 링크 발송
</td></tr>
</table>

<div class="sec">4. 학원 안내</div>
<table>
<tr><td class="lbl">위 치</td><td>서울 양천구 목동서로 35, 목동프라자 3층</td></tr>
<tr><td class="lbl">전 화</td><td>010-4028-9803</td></tr>
<tr><td class="lbl">홈페이지</td><td>www.jncmusic.kr</td></tr>
<tr><td class="lbl">운영 시간</td><td>평일(월~금) 10:30 ~ 22:00 &nbsp;·&nbsp; 주말(토·일) 09:00 ~ 22:00</td></tr>
</table>

<p style="text-align:center;margin-top:20px;font-size:10pt">※ 중요사항은 꼼꼼히 읽어 주세요. 감사합니다.</p>
<p style="text-align:right;margin-top:8px;font-weight:bold;font-size:11pt">J&amp;C Music Academy</p>
</div>
</body></html>`;
                const win = window.open("", "_blank", "width=820,height=1100");
                if (!win) { alert("팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요."); return; }
                win.document.write(html);
                win.document.close();
                win.onload = () => win.print();
              }}
              className="px-5 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-2"
            >
              <Printer size={18} /> 등록서류 인쇄
            </button>
          ) : (
            <div />
          )}
          <div className="flex gap-3">
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

  const toDateStr = (date) => toLocalDateStr(date);
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
                className="w-full py-4 bg-white border-2 border-slate-200 rounded-2xl text-2xl font-bold text-slate-700 hover:bg-indigo-50 active:bg-indigo-100 hover:border-indigo-300 active:bg-indigo-100 disabled:opacity-40 transition-all shadow-sm"
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
              className="w-full py-4 bg-white border-2 border-slate-200 rounded-2xl text-2xl font-bold text-slate-700 hover:bg-indigo-50 active:bg-indigo-100 hover:border-indigo-300 active:bg-indigo-100 disabled:opacity-40 transition-all shadow-sm"
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
const AttendanceView = ({ students, showToast, user, teachers, onUpdateStudent }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [attViewStudent, setAttViewStudent] = useState(null);

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
  const formatDate = (date) => toLocalDateStr(date);

  // [기능 보존] 오늘 수업 대상자 필터링 (강사 필터링 로직 포함, 보강 대상 포함)
  const todayStudents = useMemo(() => {
    const dayName = getDayOfWeek(selectedDate);
    const dateStr = toLocalDateStr(selectedDate);
    const isTeacherOk = (s) =>
      user.role === "admin"
        ? selectedTeacher === "" || s.teacher === selectedTeacher
        : s.teacher === user.name;

    // 정규 수업 학생
    const regular = students
      .filter((s) => {
        const hasSchedule =
          s.status === "재원" &&
          (s.schedules ? !!s.schedules[dayName] : s.className === dayName);
        return hasSchedule && isTeacherOk(s);
      })
      .sort((a, b) =>
        (a.schedules?.[dayName] || "00:00").localeCompare(
          b.schedules?.[dayName] || "00:00"
        )
      );

    // 보강 수업 학생 (다른 날 reschedule → makeupDate = 오늘)
    const makeup = students.filter((s) => {
      if (!isTeacherOk(s) || s.status !== "재원") return false;
      if (regular.find((r) => r.id === s.id)) return false; // 이미 포함된 경우 제외
      return s.attendanceHistory?.some(
        (h) => h.status === "reschedule" && h.makeupDate === dateStr
      );
    });

    return [...regular, ...makeup.map((s) => ({ ...s, _isMakeup: true }))];
  }, [students, selectedDate, selectedTeacher, user]);

  // 보강 모달 상태
  const [rescheduleModal, setRescheduleModal] = useState(null); // { student }

  // DB 업데이트 및 횟수 재계산 로직
  const saveAttendanceToDB = async (student, status, detail = "", makeupDate = "", makeupTime = "") => {
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
      } else if (status === "reschedule") {
        // 보강 등록: makeupDate, makeupTime, reason(=detail) 저장
        const record = {
          date: dateStr,
          status: "reschedule",
          makeupDate,
          makeupTime,
          reason: detail,
          teacher: student.teacher || "",
          timestamp: new Date().toISOString(),
        };
        if (existingIdx > -1) history[existingIdx] = record;
        else history.push(record);
      } else {
        // 보강 수업 출석: reschedule 기록의 makeupDate에 출석 저장 (원본 날짜 아닌 실제 보강일에 기록)
        let targetDateStr = dateStr;
        if (status === "present") {
          const reschRec = history.find(
            (h) => h.date === dateStr && h.status === "reschedule" && h.makeupDate
          );
          if (reschRec) targetDateStr = reschRec.makeupDate;
        }
        // 추가/수정 모드 (기존 count 값 보존)
        const targetIdx = history.findIndex((h) => h.date === targetDateStr);
        const prevCount = targetIdx > -1 ? (history[targetIdx].count || 1) : 1;
        const record = {
          date: targetDateStr,
          status, // 'present', 'absent', 'canceled'
          timestamp: new Date().toISOString(),
        };

        // 출석일 때만 count 보존
        if (status === "present") record.count = prevCount;

        // 상세 사유 저장
        if (status === "absent") {
          record.reason = detail;
        } else if (status === "canceled") {
          record.subType = detail;
        }

        // 기존 메모 보존
        if (targetIdx > -1 && history[targetIdx].memo) record.memo = history[targetIdx].memo;

        if (targetIdx > -1) history[targetIdx] = record;
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
      else if (status === "absent") msg = `${student.name}님 결석(보강대상) 처리됨`;
      else if (status === "canceled") msg = `${student.name}님 당일취소(${detail}) 처리됨`;
      else if (status === "reschedule") msg = `${student.name}님 보강 등록 (${makeupDate})`;

      showToast(msg);
      setModalConfig(null);
      setRescheduleModal(null);
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
    if (idx === -1) {
      // 출석 기록 없으면 메모만 담긴 레코드 생성 (status 없음 → 출석/결석 뱃지 미표시)
      history.push({ date: dateStr, memo, timestamp: new Date().toISOString() });
    } else {
      history[idx] = { ...history[idx], memo };
    }
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
    } else if (action === "reschedule") {
      setRescheduleModal({ student });
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
    // 연강(2회) 처리 시 오클릭 방지 확인 — 해제(2→1)는 확인 없이 진행
    if (current === 1) {
      const ok = window.confirm(
        `${student.name} 학생의 ${dateStr}을(를) 연강(2회)으로 처리할까요?\n\n연강은 수업 2회로 계산되어 결제 회차에 반영됩니다.`
      );
      if (!ok) return;
    }
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

      {/* 보강 모달 */}
      {rescheduleModal && (() => {
        const existingRecord = rescheduleModal.student.attendanceHistory?.find(
          (h) => h.date === formatDate(selectedDate) && h.status === "reschedule"
        );
        return (
          <RescheduleModal
            student={rescheduleModal.student}
            date={formatDate(selectedDate)}
            existingMakeupDate={existingRecord?.makeupDate || ""}
            existingMakeupTime={existingRecord?.makeupTime || ""}
            existingReason={existingRecord?.reason || "강사 사정"}
            onClose={() => setRescheduleModal(null)}
            onSave={(makeupDate, reason, makeupTime) =>
              saveAttendanceToDB(rescheduleModal.student, "reschedule", reason, makeupDate, makeupTime)
            }
          />
        );
      })()}

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
              {`${String(selectedDate.getFullYear()).slice(-2)}/${String(selectedDate.getMonth()+1).padStart(2,'0')}/${String(selectedDate.getDate()).padStart(2,'0')}`} ({getDayOfWeek(selectedDate)})
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

      {/* 원생관리 창 (이름 클릭 시) */}
      {attViewStudent && (
        <StudentEditModal
          student={attViewStudent}
          teachers={teachers}
          user={user}
          onClose={() => setAttViewStudent(null)}
          onUpdate={(id, data) => { onUpdateStudent(id, data); setAttViewStudent(null); }}
          onUpdateAttendance={(studentId, newHistory) => {
            const lastPay = attViewStudent.lastPaymentDate || "0000-00-00";
            const sc = newHistory.reduce((sum, h) => {
              if (h.date < lastPay) return sum;
              if (h.status === "present") return sum + (h.count || 1);
              if (h.status === "canceled") return sum + 1;
              return sum;
            }, 0);
            onUpdateStudent(studentId, { attendanceHistory: newHistory, sessionsCompleted: sc });
            showToast("출석 기록이 수정되었습니다.", "success");
            setAttViewStudent(null);
          }}
        />
      )}

      {/* 3. 학생 리스트 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {todayStudents.length > 0 ? (
          todayStudents.map((s) => {
            const record = (s.attendanceHistory || []).find(
              (h) => h.date === formatDate(selectedDate)
            );
            const status = record?.status;
            // 보강 수업인 경우: makeupDate가 오늘인 reschedule 원본 기록에서 시간 추출
            const makeupRecord = s._isMakeup
              ? (s.attendanceHistory || []).find(
                  (h) => h.status === "reschedule" && h.makeupDate === formatDate(selectedDate)
                )
              : null;
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
                    : status === "reschedule"
                    ? "border-blue-400 bg-blue-50/30"
                    : s._isMakeup
                    ? "border-sky-400 bg-sky-50/30"
                    : "border-slate-100 shadow-sm"
                }`}
              >
                {/* 보강 수업 배지 */}
                {s._isMakeup && (
                  <div className="flex items-center gap-1 mb-2">
                    <span className="text-xs bg-sky-500 text-white px-2 py-0.5 rounded-full font-bold">🔄 보강 수업</span>
                    {makeupRecord?.makeupTime && (
                      <span className="text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-bold">{makeupRecord.makeupTime}</span>
                    )}
                  </div>
                )}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-bold text-lg text-slate-800 ${onUpdateStudent ? "cursor-pointer hover:text-indigo-600 transition-colors" : ""}`}
                        onClick={(e) => { if (onUpdateStudent) { e.stopPropagation(); setAttViewStudent(s); } }}
                      >
                        {s.name}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-bold">
                        {s.schedules[getDayOfWeek(selectedDate)]}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 font-medium">
                      {s.subject} · {s.teacher} 선생님
                    </p>
                    {/* 보강 예정일 표시 */}
                    {status === "reschedule" && record?.makeupDate && (
                      <p className="text-xs text-blue-600 font-bold mt-0.5">🔄 보강 예정: {record.makeupDate?.replace(/-/g,'/')}{record.makeupTime ? ' ' + record.makeupTime : ''} ({record.reason})</p>
                    )}
                  </div>
                  {status && status !== "reschedule" && (
                    <div className="text-right">
                      <span
                        className={`text-xs font-bold px-2 py-1 rounded-lg block w-fit ml-auto mb-1 ${
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
                        <span className="text-xs text-slate-500 font-medium">
                          ({detailInfo})
                        </span>
                      )}
                    </div>
                  )}
                  {status === "reschedule" && (
                    <span className="text-xs font-bold px-2 py-1 rounded-lg bg-blue-500 text-white">보강등록</span>
                  )}
                </div>

                {/* 액션 버튼 그룹 */}
                <div className="grid grid-cols-5 gap-1.5">
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
                  <button
                    onClick={() => onActionClick(s, "reschedule")}
                    className={`col-span-1 py-2.5 rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-0.5 transition-all ${
                      status === "reschedule"
                        ? "bg-blue-500 text-white shadow-lg shadow-blue-200"
                        : "bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 border border-slate-100"
                    }`}
                  >
                    <span className="leading-tight">
                      🔄
                      <br />
                      보강
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
                      className="w-full text-xs text-slate-300 hover:text-amber-400 flex items-center justify-center gap-1 py-0.5"
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
                    className="w-full mt-1 text-xs text-slate-300 hover:text-rose-400 flex items-center justify-center gap-1 py-1"
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
                      : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50 active:bg-slate-100"
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

  // 4. 리스트 필터링 + 강사별·시간순 정렬
  const filteredStudents = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const filtered = accessibleStudents.filter((s) => {
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

    // 강사별 → 시간순 정렬 (schedules에서 가장 이른 시간 기준)
    const getEarliestTime = (s) => {
      const times = Object.values(s.schedules || {}).filter(Boolean);
      return times.length > 0 ? times.sort()[0] : "99:99";
    };
    return filtered.slice().sort((a, b) => {
      const tA = (a.teacher || "").localeCompare(b.teacher || "");
      if (tA !== 0) return tA;
      return getEarliestTime(a).localeCompare(getEarliestTime(b));
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
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${filterStatus === "재원" ? "bg-white/25 text-white" : "bg-slate-200 text-slate-500"}`}>
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
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${filterStatus === "휴원" ? "bg-white/25 text-white" : "bg-slate-200 text-slate-500"}`}>
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
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${filterStatus === "퇴원" ? "bg-white/25 text-white" : "bg-slate-200 text-slate-500"}`}>
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
                        <span className="text-xs px-2 py-0.5 bg-rose-50 text-rose-500 rounded-full font-bold border border-rose-100">{s.subject}</span>
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
                  className="hover:bg-slate-50 active:bg-slate-100/50 transition-colors group"
                >
                  <td className="p-4 sticky left-0 bg-white group-hover:bg-slate-50 active:bg-slate-100 z-10 border-r border-slate-100 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className="font-bold text-slate-900 text-base cursor-pointer hover:text-indigo-600 hover:underline decoration-2 underline-offset-4 transition-all"
                          onClick={() => openWithTab(s, "info")}
                        >
                          {s.name}
                        </span>
                        <span className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full font-bold border border-indigo-100">
                          {s.subject}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-bold border ${
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
                              className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold border border-slate-200"
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
        showToast={showToast}
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
  showToast,
}) => {
  const [activeTab, setActiveTab] = useState("info");
  const [formData, setFormData] = useState({});
  const [attHistory, setAttHistory] = useState([]);
  const [payHistory, setPayHistory] = useState([]);
  const nowSMM = new Date();
  const [baseDate, setBaseDate] = useState(new Date(nowSMM.getFullYear(), nowSMM.getMonth() - 1, 1));
  const [payAmount, setPayAmount] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [notifyTemplateId, setNotifyTemplateId] = useState("custom");
  const [notifyMessage, setNotifyMessage] = useState("");
  const [notifySending, setNotifySending] = useState(false);

  const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

  // 🔥 [보안] 탭 목록 설정 (관리자만 payment·notify 탭 보임)
  const TABS =
    user?.role === "admin"
      ? ["info", "attendance", "payment", "notify"]
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
    setBaseDate(new Date(baseDate.getFullYear(), baseDate.getMonth() + offset, 1));
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

    // 결제 이력 totalSessions 보존 + sessionDates 재계산:
    // totalSessions 없이 저장된 기존 결제 항목은 변경 후 수강 단위로 채워 보존
    // sessionDates는 출석 이력 기반으로 순서대로 재할당 (변경 시 히스토리 보존)
    const newEffectiveSessions = parseInt(formData.totalSessions) > 0
      ? parseInt(formData.totalSessions)
      : (Object.keys(formData.schedules || {}).length >= 2 ? 8 : 4);
    const sortedAttForCorr = [...attHistory]
      .filter((h) => h.status === "present" || h.status === "canceled")
      .sort((a, b) => a.date.localeCompare(b.date));
    const corrAttSlots = [];
    sortedAttForCorr.forEach((h) => {
      const cnt = h.status === "canceled" ? 1 : (h.count || 1);
      for (let i = 0; i < cnt; i++) corrAttSlots.push(h.date);
    });
    const sortedPayForCorr = [...payHistory].sort((a, b) => a.date.localeCompare(b.date));
    // 누적 슬라이스: k번째 결제는 출석 슬롯의 [이전결제총합, 이전총합+ps) 구간 커버
    // 결제 간 sessionDates 중복 방지 (T vs P 누적 모델과 일치)
    let cursorForCorr = 0;
    const correctedPayHistory = sortedPayForCorr.map((p) => {
      const ps = p.totalSessions > 0 ? p.totalSessions : newEffectiveSessions;
      const recalcSessionDates = corrAttSlots.slice(cursorForCorr, cursorForCorr + ps);
      cursorForCorr += ps;
      return { ...p, totalSessions: ps, sessionDates: recalcSessionDates };
    });

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
          className="border rounded-xl p-3 bg-white shadow-sm"
        >
          <div className="text-center font-bold text-slate-700 mb-2 bg-slate-50 rounded py-1 text-sm">
            {year}년 {month + 1}월
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {["일", "월", "화", "수", "목", "금", "토"].map((day, idx) => (
              <div
                key={day}
                className={`text-xs font-bold ${
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
                    : tab === "notify"
                    ? "bg-amber-50 text-amber-700 shadow-inner ring-1 ring-amber-100"
                    : "bg-slate-100 text-slate-800 shadow-inner"
                  : "text-slate-400 hover:bg-slate-50 active:bg-slate-100"
              }`}
            >
              {tab === "info" && <User size={16} />}
              {tab === "attendance" && <CheckCircle size={16} />}
              {tab === "payment" && <CreditCard size={16} />}
              {tab === "notify" && <Bell size={16} />}
              {tab === "info"
                ? "기본 정보"
                : tab === "attendance"
                ? "출석 관리"
                : tab === "payment"
                ? "수납 관리"
                : "공지 관리"}
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
                      <div className="text-xs text-center font-bold text-slate-400">
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
                    className="px-3 py-1 bg-white border rounded text-xs hover:bg-slate-50 active:bg-slate-100 font-medium"
                  >
                    ◀ 이전
                  </button>
                  <button
                    onClick={() => moveMonth(1)}
                    className="px-3 py-1 bg-white border rounded text-xs hover:bg-slate-50 active:bg-slate-100 font-medium"
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
                      className="px-3 py-1 bg-white border rounded text-xs hover:bg-slate-50 active:bg-slate-100 font-medium"
                    >
                      ◀ 이전
                    </button>
                    <button
                      onClick={() => moveMonth(1)}
                      className="px-3 py-1 bg-white border rounded text-xs hover:bg-slate-50 active:bg-slate-100 font-medium"
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
                  전체 결제 내역
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
                      const fromDouble = h.status === "present" && cnt >= 2;
                      for (let i = 0; i < cnt; i++) sessionSlots.push({ date: h.date, fromDouble });
                    });
                    const payWithIdx = sortedPay.map((h, i) => {
                      let prevUnits = 0;
                      for (let j = 0; j < i; j++) {
                        prevUnits +=
                          sortedPay[j].totalSessions > 0
                            ? sortedPay[j].totalSessions
                            : sessionUnit;
                      }
                      return { ...h, payIdx: i, prevUnits };
                    });
                    const recentPays = [...payWithIdx].reverse();
                    return recentPays.map((h, idx) => {
                      // 누적 슬라이스: 이전 결제들의 총 회차 다음 구간을 이 결제가 커버
                      const payUnit = h.totalSessions > 0 ? h.totalSessions : sessionUnit;
                      const slots = sessionSlots.slice(h.prevUnits, h.prevUnits + payUnit);
                      const startNum = h.prevUnits + 1;
                      const endNum = h.prevUnits + payUnit;
                      // 날짜별로 그룹화 — 연강 슬롯이 하나라도 있으면 (연강) 표시
                      const dateGroups = [];
                      slots.forEach(({ date, fromDouble }) => {
                        const last = dateGroups[dateGroups.length - 1];
                        if (last && last.date === date) {
                          last.cnt++;
                          if (fromDouble) last.fromDouble = true;
                        } else {
                          dateGroups.push({ date, cnt: 1, fromDouble });
                        }
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
                                  (g.fromDouble ? "(연강)" : "")
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

          {/* 공지 관리 탭 */}
          {activeTab === "notify" && user?.role === "admin" && (
            <div className="space-y-4 animate-in slide-in-from-right-2 duration-300">
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 shadow-sm">
                <p className="text-sm font-bold text-amber-800 mb-1 flex items-center gap-1.5">
                  <Bell size={14} /> 공지 발송
                </p>
                <p className="text-xs text-amber-600">
                  {student?.name} {student?.grade === "성인" ? "님" : "학생"}에게 문자를 발송합니다.
                  수신번호: {student?.phone || "(연락처 없음)"}
                </p>
              </div>

              {/* 템플릿 선택 */}
              <div>
                <p className="text-xs font-bold text-slate-500 mb-2 ml-1">템플릿 선택</p>
                <div className="flex flex-wrap gap-2">
                  {BULK_SMS_TEMPLATES.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setNotifyTemplateId(t.id);
                        if (t.id === "custom") { setNotifyMessage(""); return; }
                        let text = applyTemplateGreetings(t.text);
                        text = applyStudentVars(text, { ...student, ...formData });
                        setNotifyMessage(text);
                      }}
                      className={`px-3 py-1.5 text-xs rounded-lg font-medium border transition-all ${
                        notifyTemplateId === t.id
                          ? "bg-amber-500 text-white border-amber-500 shadow-sm"
                          : "bg-white text-slate-600 border-slate-200 hover:border-amber-300"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 메시지 편집 */}
              <div>
                <p className="text-xs font-bold text-slate-500 mb-1.5 ml-1">메시지 내용</p>
                <textarea
                  className="w-full p-3 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-amber-400 bg-white resize-none"
                  rows={10}
                  placeholder="직접 입력하거나 템플릿을 선택하세요."
                  value={notifyMessage}
                  onChange={(e) => { setNotifyMessage(e.target.value); setNotifyTemplateId("custom"); }}
                />
                <p className="text-right text-xs text-slate-400 mt-1">{notifyMessage.length}자</p>
              </div>

              {/* 발송 버튼 */}
              <button
                disabled={!student?.phone || !notifyMessage.trim() || notifySending}
                onClick={async () => {
                  if (!student?.phone) { showToast?.("연락처가 없습니다.", "error"); return; }
                  if (!notifyMessage.trim()) { showToast?.("메시지를 입력하세요.", "error"); return; }
                  setNotifySending(true);
                  try {
                    await sendAligoSms(student.phone, notifyMessage);
                    showToast?.("발송 완료!", "success");
                    setNotifyMessage("");
                    setNotifyTemplateId("custom");
                  } catch (e) {
                    showToast?.(e.message || "발송 실패", "error");
                  } finally {
                    setNotifySending(false);
                  }
                }}
                className="w-full py-3 bg-amber-500 text-white text-sm font-bold rounded-xl hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
              >
                <Send size={15} />
                {notifySending ? "발송 중..." : "문자 발송"}
              </button>
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
          {student?.id && (
            <button
              onClick={() => {
                const s = formData;
                const scheduleStr = Object.entries(s.schedules || {})
                  .map(([day, time]) => `${day}요일 ${time || ""}`)
                  .join(",  ");
                const scheduleDays = Object.keys(s.schedules || {}).join("·");
                const assignedTeacher = teachers?.find(t => t.name === s.teacher);
                const DAY_ID_TO_KR = {1:"월",2:"화",3:"수",4:"목",5:"금",6:"토",0:"일"};
                const teacherDays = assignedTeacher?.days?.length
                  ? assignedTeacher.days.filter(d => typeof d === "number").map(d => DAY_ID_TO_KR[d] ?? d).join("·")
                  : scheduleDays;
                const teacherSchedule = [s.teacher ? s.teacher + " 선생님" : "", teacherDays ? teacherDays + "요일 출강" : ""].filter(Boolean).join(" / ");
                const fee = s.tuitionFee ? Number(s.tuitionFee).toLocaleString() + "원" : "";
                const schoolGrade = [s.school, s.grade && s.grade !== "성인" ? s.grade : ""].filter(Boolean).join(" ");
                const html = `<!DOCTYPE html>
<html lang="ko"><head><meta charset="UTF-8"><title>J&C 등록서류</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:"Malgun Gothic","맑은 고딕",sans-serif; font-size:11pt; color:#111; }
@page { size:A4; margin:18mm 16mm; }
.page { page-break-after:always; }
.page:last-child { page-break-after:avoid; }
h1,h2 { text-align:center; letter-spacing:6px; margin-bottom:14px; }
h1 { font-size:17pt; } h2 { font-size:15pt; }
.date-line { text-align:right; margin-bottom:12px; font-size:10pt; }
table { width:100%; border-collapse:collapse; }
td,th { border:1px solid #666; padding:11px 12px; font-size:12pt; vertical-align:middle; }
.lbl { background:#f0f0f0; font-weight:bold; text-align:center; white-space:nowrap; }
.val { text-align:center; }
.fixed { background:#fafafa; font-size:10pt; line-height:1.7; }
.sig { text-align:center; margin-top:10px; }
.sec { font-weight:bold; font-size:11pt; margin:14px 0 6px; }
.sub { font-size:9.5pt; font-weight:normal; }
.compact td, .compact th { padding:5px 10px; font-size:10pt; }
</style></head><body>
<div class="page">
<h1>J&amp;C  Music  Academy  등록원서</h1>
<div class="date-line">20__ 년 __ 월 __ 일</div>
<table>
<colgroup><col style="width:16%"><col style="width:34%"><col style="width:16%"><col style="width:34%"></colgroup>
<tr><td class="lbl">성 명</td><td class="val">${s.name||""}</td><td class="lbl">성 별</td><td class="val">&nbsp;</td></tr>
<tr><td class="lbl">생년월일</td><td class="val">&nbsp;</td><td class="lbl">연 락 처</td><td class="val">${s.phone||""}</td></tr>
<tr><td class="lbl">주 소</td><td colspan="3" class="val">&nbsp;</td></tr>
<tr><td class="lbl">학교 / 소속</td><td colspan="3" class="val">${schoolGrade||"&nbsp;"}</td></tr>
<tr><td class="lbl">수 강 과 목</td><td colspan="3" class="val">${s.subject||"&nbsp;"}</td></tr>
<tr><td class="lbl">배우는 목적</td><td colspan="3" class="val">취미</td></tr>
<tr><td class="lbl">등록일</td><td class="val">${s.registrationDate||""}</td><td class="lbl">담당 선생님</td><td class="val">${s.teacher ? s.teacher+" 선생님" : ""}</td></tr>
<tr><td class="lbl">수업 요일<br>및 시간</td><td colspan="3" class="val">${scheduleStr||"&nbsp;"}</td></tr>
<tr><td class="lbl">소개 / 경로</td><td colspan="3" class="val">&nbsp;</td></tr>
<tr><td class="lbl">결제방법 /<br>결제일 / 금액</td><td colspan="3" class="val">${fee ? "수강료: "+fee : "&nbsp;"}</td></tr>
<tr><td class="lbl">노쇼 및<br>당일취소 안내</td><td colspan="3" class="fixed">
본 원은 당일취소 및 노쇼에 대해 1회분 수업이 차감됩니다.<br>
단, 호흡기질환/경조사 등에 대해서는 차감되지 않습니다.<br>
전날까지 연락 주시면 자유롭게 수업 변경이 가능합니다.
<div class="sig">확인 : ________________ (인)</div></td></tr>
<tr><td class="lbl">기타 특기사항</td><td colspan="3" style="height:44px">&nbsp;</td></tr>
<tr><td class="lbl">개인정보<br>이용 동의</td><td colspan="3" class="fixed">
본 학원의 원비 결제와 원활한 수업 진행을 위해 학생의 연락처와 성명 등 개인정보를 활용하는데 동의합니다.
<div class="sig" style="margin-top:10px">동의 (　) &nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 작성자 : ________________ (인)</div></td></tr>
</table>
</div>
<div class="page">
<h2>J&amp;C  Music  Academy  입학 안내문</h2>
<div class="sec">1. 환불 규정 안내 &nbsp;<span class="sub">(학원법 시행령 제18조 3항에 의거)</span></div>
<table class="compact">
<tr><th class="lbl">구 분</th><th class="lbl">환불 금액</th></tr>
<tr><td class="lbl">첫 수업 전 환불</td><td style="text-align:center">100% 환불</td></tr>
<tr><td class="lbl">1/3 경과 전 환불</td><td style="text-align:center">납부 수강료 2/3 해당 금액</td></tr>
<tr><td class="lbl">1/2 경과 전 환불</td><td style="text-align:center">납부 수강료 1/2 해당 금액</td></tr>
<tr><td class="lbl">1/2 경과 후 환불</td><td style="text-align:center">환불 불가</td></tr>
</table>
<p style="font-size:9.5pt;margin-top:3px">※ 환불정산: 주 1회(4회 기준) 횟수 기준으로 적용</p>
<div class="sec">2. 수강 안내</div>
<table class="compact">
<tr><td class="lbl">수업 결제 안내</td><td>결제는 4회차 종료 후, 다음 1회차 수업 시작 전까지 완료 부탁드립니다.<br><span style="font-size:9.5pt">· 수강료 2회 미납 시 3회차 수업 준비가 어려울 수 있습니다.</span></td></tr>
<tr><td class="lbl">담당 강사 /<br>출강 요일</td><td>${teacherSchedule||"&nbsp;"}</td></tr>
<tr><td class="lbl">노쇼 · 당일취소</td><td>당일취소 및 노쇼는 1회분 수업이 차감됩니다.<br>공휴일 및 기타 학원 사정으로 수업이 진행되지 않는 경우 회차 차감 없음.<br><span style="font-size:9.5pt">전날까지 연락 시 자유롭게 수업 변경 가능합니다.</span></td></tr>
<tr><td class="lbl">가족 할인</td><td>두 번째 과목 등록 시 해당 과목 수강료에서 30,000원 할인<br><span style="font-size:9.5pt">(1인 2과목 또는 가족 구성원 모두 동일 적용)</span></td></tr>
</table>
<div class="sec">3. 결제 안내</div>
<table class="compact">
<tr><td class="lbl">수 강 료</td><td>등록 시 안내드린 금액 기준${fee ? " &nbsp;·&nbsp; <b>"+fee+"</b>" : ""}</td></tr>
<tr><td class="lbl" style="vertical-align:top">결제 방법</td><td>
· 방문 결제 &nbsp;&nbsp;: 카드 / 현금<br>
· 계좌이체 &nbsp;&nbsp;: 하나은행 125-91025-766307 &nbsp; 강열혁 (제이앤씨음악학원)<br>
· 제로페이 &nbsp;&nbsp;: 방문 시 이용 가능<br>
· 온라인 결제 : 카드 결제 희망 시 담당 선생님께 문의 — 결제선생(카카오톡 페이지) 링크 발송
</td></tr>
</table>
<div class="sec">4. 학원 안내</div>
<table class="compact">
<tr><td class="lbl">위 치</td><td>서울 양천구 목동서로 35, 목동프라자 3층</td></tr>
<tr><td class="lbl">전 화</td><td>010-4028-9803</td></tr>
<tr><td class="lbl">홈페이지</td><td>www.jncmusic.kr</td></tr>
<tr><td class="lbl">운영 시간</td><td>평일(월~금) 10:30 ~ 22:00 &nbsp;·&nbsp; 주말(토·일) 09:00 ~ 22:00</td></tr>
</table>
<p style="text-align:center;margin-top:20px;font-size:10pt">※ 중요사항은 꼼꼼히 읽어 주세요. 감사합니다.</p>
<p style="text-align:right;margin-top:8px;font-weight:bold;font-size:11pt">J&amp;C Music Academy</p>
</div>
</body></html>`;
                const win = window.open("", "_blank", "width=820,height=1100");
                if (!win) { alert("팝업이 차단되었습니다. 팝업 허용 후 다시 시도해주세요."); return; }
                win.document.write(html);
                win.document.close();
                win.onload = () => win.print();
              }}
              className="px-5 py-2.5 rounded-xl border border-slate-300 font-bold text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-2"
            >
              <Printer size={18} /> 등록서류 인쇄
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

// 단문용 짧은 시즌 인사
const getShortSeasonalGreeting = () => {
  const m = new Date().getMonth() + 1;
  const map = {
    1:  "추운 겨울 건강히 지내고 계신지요. 새해 복 많이 받으시기 바랍니다.",
    2:  "겨울 추위가 아직 남아 있습니다. 건강 유의하시기 바랍니다.",
    3:  "봄이 찾아왔지만 일교차가 크니 건강 유의하시기 바랍니다.",
    4:  "따뜻한 봄날이 이어지고 있습니다. 건강하고 활기찬 봄 보내시기 바랍니다.",
    5:  "가정의 달 5월입니다. 가족 모두 건강하고 행복한 시간 보내시기 바랍니다.",
    6:  "더워지는 날씨에 건강 유의하시기 바랍니다.",
    7:  "더워지는 날씨에 건강 유의하시기 바랍니다.",
    8:  "더워지는 날씨에 건강 유의하시기 바랍니다.",
    9:  "선선한 바람이 불어오고 있습니다. 환절기에 건강 유의하시기 바랍니다.",
    10: "쌀쌀해지는 날씨에 건강 유의하시기 바랍니다. 감기 조심하시기 바랍니다.",
    11: "초겨울 추위가 시작되었습니다. 따뜻하게 입고 건강 챙기시기 바랍니다.",
    12: "한 해동안 J&C 음악학원을 사랑해주셔서 감사드립니다. 뜻깊은 연말연시 되시기 바랍니다.",
  };
  return map[m] || "";
};
const getShortClosingGreeting = () => {
  const dow = new Date().getDay();
  if (dow === 1) return "평안한 한 주 시작되길 바랍니다.";
  if (dow >= 2 && dow <= 4) return "좋은 하루 되세요.";
  return "즐거운 주말 되세요.";
};

// {{시즌인사}}, {{시즌인사2}} 자동 치환
const applyTemplateGreetings = (text) =>
  text
    .replace(/\{\{시즌인사\}\}/g, getShortSeasonalGreeting())
    .replace(/\{\{시즌인사2\}\}/g, getShortClosingGreeting());

const DAYS_KO_BULK = ["일", "월", "화", "수", "목", "금", "토"];

// 학생 정보 변수 치환: {{이름}} {{강사}} {{원비}} {{과목}} {{횟수}} {{수업일시}} {{수업일정}} {{마무리}}
const applyStudentVars = (text, s) => {
  if (!s) return text;
  const nameSuffix = s.grade === "성인" ? "님" : " 학생";
  const name = s.name + nameSuffix;
  const teacher = s.teacher || "(강사)";
  // tuitionFee가 0이어도 표시 (falsy 체크 대신 null/undefined 체크)
  const fee = (s.tuitionFee != null && s.tuitionFee !== "")
    ? `${Number(s.tuitionFee).toLocaleString()}원`
    : "(금액)원";
  const rawSubject = s.subject || "(과목)";
  const subject = rawSubject.includes("1:1") ? rawSubject : `${rawSubject} 1:1 개인레슨`;
  const sessions = (() => {
    const saved = parseInt(s.totalSessions);
    if (!isNaN(saved) && saved > 0) return saved;
    return Object.keys(s.schedules || {}).length >= 2 ? 8 : 4;
  })();
  const scheduleEntries = Object.entries(s.schedules || {});
  // schedules 없으면 className/time 폴백
  const scheduleStr = scheduleEntries.length > 0
    ? scheduleEntries.map(([day, time]) => `${day}요일 ${time}`).join(", ")
    : (s.className ? `${s.className}요일 ${s.time || ""}` : "(수업 일정)");
  // registrationDate 없으면 오늘 날짜 기준으로 계산
  const regDateStr = s.registrationDate || (s.createdAt ? s.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10));
  let firstLesson = "(날짜/요일/시간 입력)";
  let lessonDayKo = "";
  // schedules가 있으면 실제 수업 요일/시간 사용
  const effectiveEntries = scheduleEntries.length > 0
    ? scheduleEntries
    : (s.className ? [[s.className, s.time || ""]] : []);
  if (effectiveEntries.length > 0) {
    const [firstDay, firstTime] = effectiveEntries[0];
    lessonDayKo = firstDay;
    const targetDayIdx = DAYS_KO_BULK.indexOf(firstDay);
    if (targetDayIdx >= 0) {
      const base = new Date(regDateStr + "T00:00:00");
      let diff = targetDayIdx - base.getDay();
      if (diff < 0) diff += 7;
      base.setDate(base.getDate() + diff);
      const y = base.getFullYear();
      const m = String(base.getMonth() + 1).padStart(2, "0");
      const d = String(base.getDate()).padStart(2, "0");
      firstLesson = `${y}-${m}-${d} (${firstDay}) ${firstTime || "(시간 입력)"}`;
    } else {
      firstLesson = `${regDateStr} (${firstDay}) ${firstTime || "(시간 입력)"}`;
    }
  } else {
    // schedules도 className도 없으면 등록일 기준으로만
    const d = new Date(regDateStr + "T00:00:00");
    lessonDayKo = DAYS_KO_BULK[d.getDay()];
    firstLesson = `${regDateStr} (${lessonDayKo}) (시간 입력)`;
  }
  const closingDay = lessonDayKo
    ? `다음주 ${lessonDayKo}요일에 뵙겠습니다.`
    : "다음주 (요일)에 뵙겠습니다.";
  return text
    .replace(/\{\{이름\}\}/g, name)
    .replace(/\{\{강사\}\}/g, teacher)
    .replace(/\{\{원비\}\}/g, fee)
    .replace(/\{\{과목\}\}/g, subject)
    .replace(/\{\{횟수\}\}/g, `${sessions}회`)
    .replace(/\{\{수업일시\}\}/g, firstLesson)
    .replace(/\{\{수업일정\}\}/g, scheduleStr)
    .replace(/\{\{마무리\}\}/g, closingDay);
};

const BULK_SMS_TEMPLATES = [
  { id: "custom",   label: "직접 입력", text: "" },

  // ── 미납 안내 ─────────────────────────────────────────
  {
    id: "unpaid",
    label: "미납 안내",
    text:
`안녕하세요, J&C 음악학원입니다. {{시즌인사}}
{{이름}} 수강료({{원비}})가 미납된 것으로 확인됩니다. 빠른 납부 부탁드립니다.
항상 감사드립니다. {{시즌인사2}}
J&C 음악학원장 드림.`,
  },

  // ── 학원 소식 ─────────────────────────────────────────
  {
    id: "news",
    label: "학원 소식",
    text:
`안녕하세요, J&C 음악학원입니다. {{시즌인사}}
[소식 내용을 입력하세요]
항상 감사드립니다. {{시즌인사2}}
J&C 음악학원장 드림.`,
  },

  // ── 휴원 안내 ─────────────────────────────────────────
  {
    id: "holiday",
    label: "휴원 안내",
    text:
`안녕하세요, J&C 음악학원입니다. {{시즌인사}}
[날짜]에 휴원합니다. 소중한 수업 시간에 불편을 드려 정말 죄송합니다. 넓은 양해 부탁드립니다.
항상 감사드립니다. {{시즌인사2}}
J&C 음악학원장 드림.`,
  },

  // ── 수업 변경 ─────────────────────────────────────────
  {
    id: "change",
    label: "수업 변경",
    text:
`안녕하세요, J&C 음악학원입니다. {{시즌인사}}
{{이름}} 수업 일정이 아래와 같이 변경됩니다.
▪ 기존: {{수업일정}}
▪ 변경: [변경 일시]
불편을 드려 죄송합니다. 문의: 02-2655-0220
항상 감사드립니다. {{시즌인사2}}
J&C 음악학원장 드림.`,
  },

  // ── 발표회 안내 ───────────────────────────────────────
  {
    id: "recital",
    label: "발표회 안내",
    text:
`안녕하세요, J&C 음악학원입니다. {{시즌인사}}
J&C 음악학원 발표회에 소중한 여러분을 초대합니다 🎵
▪ 일시: [날짜 / 시간]
▪ 장소: [장소]
학생들의 빛나는 무대, 꼭 함께해 주세요!
항상 감사드립니다. {{시즌인사2}}
J&C 음악학원장 드림.`,
  },

  // ── 학원 안내 ─────────────────────────────────────────
  {
    id: "academy_info",
    label: "학원 안내",
    text:
`안녕하세요, J&C 음악학원입니다. {{시즌인사}}

문의해 주셔서 감사합니다.
아래 학원 안내 정보 참고 부탁드립니다.

[J&C 음악학원]
* 위치: 서울 양천구 목동서로 35, 목동프라자 3층
* 홈페이지: https://www.jncmusic.kr
* 전화: 010-4028-9803

[운영 시간]
평일(월~금): 10:30 ~ 22:00
주말(토·일): 09:00 ~ 22:00

[상담 안내]
상담은 예약제로 운영됩니다.
방문 또는 전화 상담 모두 가능하오니 편하신 방법으로 예약 후 방문 부탁드립니다.

항상 감사드립니다. {{시즌인사2}}
J&C 음악학원장 드림.`,
  },

  // ── 첫 수업 안내 ──────────────────────────────────────
  {
    id: "new_lesson",
    label: "첫 수업 안내",
    text:
`안녕하세요, J&C 음악학원입니다.

{{이름}}의 첫 수업 안내드립니다.

* 첫 수업: {{수업일시}}
* 과목: {{과목}}

* 원비 안내
월 원비: {{원비}} / {{횟수}} 수업
하나은행 125-91025-766307 강열혁(제이앤씨음악학원)
방문(카드/현금), 계좌이체·제로페이, 온라인 카드결제 모두 가능합니다.

* 취소/노쇼 안내
당일 취소 및 노쇼는 수업 1회 차감됩니다.
변경 사항은 수업 전날까지 연락 부탁드립니다.

항상 감사드립니다. {{마무리}}
J&C 음악학원장 드림.`,
  },
];

const BulkSmsView = ({ students, teachers, showToast }) => {
  const [selectedIds, setSelectedIds] = useState([]);
  const [filterTeacher, setFilterTeacher] = useState("");
  const [filterPart, setFilterPart] = useState("");
  const [searchName, setSearchName] = useState("");
  const [templateId, setTemplateId] = useState("custom");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState(null); // null = 미발송, [] = 결과
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneFormat, setPhoneFormat] = useState("comma"); // "comma" | "newline"

  const PARTS = ["피아노", "관현악", "실용음악", "성악"];

  // 공지는 재원생에게만 발송 — 휴원/퇴원 학생은 대상에서 항상 제외
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      if (s.status !== "재원") return false;
      if (filterTeacher && s.teacher !== filterTeacher) return false;
      if (filterPart && s.part !== filterPart) return false;
      if (searchName && !s.name.includes(searchName)) return false;
      return true;
    });
  }, [students, filterTeacher, filterPart, searchName]);

  const toggleAll = () => {
    if (selectedIds.length === filteredStudents.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredStudents.map((s) => s.id));
    }
  };

  // top-level applyStudentVars와 동일한 로직 (BulkSmsView 내부 사용)
  const applyStudentVarsInner = (text, s) => applyStudentVars(text, s);

  const toggleOne = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  // 전화번호 추출: 선택된 학생이 있으면 선택 학생만, 없으면 현재 필터의 재원생 전체
  const phoneExtractTargets = useMemo(() => {
    const base = selectedIds.length > 0
      ? students.filter((s) => selectedIds.includes(s.id))
      : filteredStudents;
    return base.filter((s) => s.phone);
  }, [selectedIds, students, filteredStudents]);

  const phoneExtractText = useMemo(() => {
    const nums = phoneExtractTargets.map((s) => (s.phone || "").replace(/[^0-9]/g, ""));
    return phoneFormat === "comma" ? nums.join(",") : nums.join("\n");
  }, [phoneExtractTargets, phoneFormat]);

  const handleCopyPhones = () => {
    if (phoneExtractTargets.length === 0) {
      showToast("추출할 전화번호가 없습니다.", "warning");
      return;
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(phoneExtractText).then(() => {
        showToast(`${phoneExtractTargets.length}명 전화번호가 복사되었습니다.`, "success");
      });
    }
  };

  // 템플릿 또는 선택 학생 변경 시 자동 갱신 (직접 입력 제외)
  useEffect(() => {
    if (templateId === "custom") return;
    const t = BULK_SMS_TEMPLATES.find((t) => t.id === templateId);
    if (!t || !t.text) { setMessage(""); return; }
    let text = applyTemplateGreetings(t.text);
    if (selectedIds.length === 1) {
      const s = students.find((st) => st.id === selectedIds[0]);
      if (s) text = applyStudentVarsInner(text, s);
    }
    setMessage(text);
  }, [selectedIds, templateId]); // eslint-disable-line

  const handleTemplateChange = (tid) => {
    setTemplateId(tid);
    if (tid === "custom") setMessage("");
  };

  const handleSend = async () => {
    if (!message.trim()) {
      showToast("발송할 내용을 입력해주세요.", "warning");
      return;
    }
    const targets = students.filter(
      (s) => selectedIds.includes(s.id) && s.phone && s.status === "재원"
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
            <span className="text-xs px-3 py-1.5 rounded-md font-bold bg-indigo-50 text-indigo-700">
              재원생만 발송 대상
            </span>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                placeholder="이름 검색"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-sm border rounded-lg bg-white focus:outline-indigo-500 w-28"
              />
            </div>
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
              onClick={() => setShowPhoneModal(true)}
              className="ml-auto text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 font-bold hover:bg-slate-200 flex items-center gap-1"
            >
              <Phone size={12} /> 번호 추출
            </button>
            <button
              onClick={toggleAll}
              className="text-xs px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-700 font-bold hover:bg-indigo-100"
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
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 active:bg-slate-100 cursor-pointer border-b border-slate-50"
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

            <p className="text-[11px] text-slate-400">
              사진을 포함해 보내려면 위 "번호 추출"로 번호를 복사한 뒤 알리고 사이트에서 직접 발송해주세요.
            </p>

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

      {/* 전화번호 추출 모달 — 알리고 사이트에서 직접 사진(MMS) 발송 시 사용 */}
      {showPhoneModal && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setShowPhoneModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-bold text-slate-800">전화번호 추출</h3>
              <button onClick={() => setShowPhoneModal(false)} className="text-slate-400 hover:text-slate-600">
                <X size={18} />
              </button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-slate-500 leading-relaxed">
                {selectedIds.length > 0 ? "선택된 학생" : "현재 필터의 재원생 전체"} 중 연락처가 있는{" "}
                <span className="font-bold text-indigo-600">{phoneExtractTargets.length}명</span>의 번호입니다.
                복사해서 알리고 사이트의 대량발송(직접입력)에 붙여넣으면 사진(MMS)도 함께 보낼 수 있습니다.
              </p>
              <div className="flex bg-slate-100 rounded-lg p-1 w-fit">
                <button
                  onClick={() => setPhoneFormat("comma")}
                  className={`px-3 py-1 rounded-md text-xs font-bold ${
                    phoneFormat === "comma" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
                  }`}
                >
                  콤마 구분
                </button>
                <button
                  onClick={() => setPhoneFormat("newline")}
                  className={`px-3 py-1 rounded-md text-xs font-bold ${
                    phoneFormat === "newline" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500"
                  }`}
                >
                  줄바꿈 구분
                </button>
              </div>
              <textarea
                readOnly
                value={phoneExtractText}
                rows={6}
                onClick={(e) => e.target.select()}
                className="w-full border border-slate-200 rounded-xl p-3 text-xs font-mono resize-none bg-slate-50"
              />
            </div>
            <div className="p-4 border-t bg-slate-50 rounded-b-2xl flex justify-end gap-2">
              <button
                onClick={() => setShowPhoneModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg font-bold text-sm transition-colors"
              >
                닫기
              </button>
              <button
                onClick={handleCopyPhones}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 flex items-center gap-1.5 transition-colors"
              >
                <Copy size={15} /> 복사
              </button>
            </div>
          </div>
        </div>
      )}
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
  const [operationNotes, setOperationNotes] = useState([]); // 운영 메모/할일
  const [weeklySnapshots, setWeeklySnapshots] = useState([]); // 주차별 재원생 수 스냅샷

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
  const [payDetailStudentId, setPayDetailStudentId] = useState(null);
  // students onSnapshot 업데이트 시 모달 데이터도 실시간 반영
  const payDetailStudent = payDetailStudentId
    ? students.find((s) => s.id === payDetailStudentId) ?? null
    : null;

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

      // 7. 운영 메모/할일
      unsubscribes.push(onSnapshot(
        collection(db, "artifacts", safeAppId, "public", "data", "operationNotes"),
        (s) => setOperationNotes(s.docs.map((d) => ({ ...d.data(), id: d.id })))
      ));

      // 8. 주차별 재원생 수 스냅샷
      unsubscribes.push(onSnapshot(
        collection(db, "artifacts", safeAppId, "public", "data", "weeklySnapshots"),
        (s) => setWeeklySnapshots(s.docs.map((d) => ({ ...d.data(), id: d.id })))
      ));
    });
    // cleanup: StrictMode에서 리스너 중복 등록 방지
    return () => unsubscribes.forEach((unsub) => unsub());
  }, []);

  // 이번 주 재원생 수 스냅샷 자동 저장 (관리자가 접속했는데 이번 주 기록이 아직 없으면 1회 저장)
  const weeklySnapshotCheckedRef = useRef(false);
  useEffect(() => {
    if (!db || weeklySnapshotCheckedRef.current) return;
    if (currentUser?.role !== "admin" || students.length === 0) return;
    weeklySnapshotCheckedRef.current = true;

    const today = new Date();
    const dayOfWeek = (today.getDay() + 6) % 7; // 0=월 … 6=일
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString().split("T")[0];
    const safeAppId = APP_ID || "jnc-music-v2";
    const ref = doc(db, "artifacts", safeAppId, "public", "data", "weeklySnapshots", weekStartStr);

    getDoc(ref)
      .then((snap) => {
        if (snap.exists()) return; // 이번 주 스냅샷 이미 저장됨
        const activeCount = students.filter((s) => s.status === "재원").length;
        return setDoc(ref, {
          weekStartStr,
          activeCount,
          capturedAt: new Date().toISOString(),
        });
      })
      .catch((e) => console.error("주간 스냅샷 저장 실패:", e));
  }, [students, currentUser]);

  const showToast = (text, type = "success") => {
    setMessage({ text, type });
    setTimeout(() => setMessage(null), 3000);
  };

  // 운영 메모/할일 CRUD
  const handleAddNote = async (text) => {
    if (!text.trim()) return;
    try {
      await addDoc(
        collection(db, "artifacts", APP_ID, "public", "data", "operationNotes"),
        {
          text: text.trim(),
          done: false,
          createdAt: new Date().toISOString(),
          createdBy: currentUser?.name || "원장",
        }
      );
    } catch (e) {
      showToast("메모 추가 실패: " + e.message, "error");
    }
  };

  const handleToggleNote = async (id, done) => {
    try {
      await updateDoc(
        doc(db, "artifacts", APP_ID, "public", "data", "operationNotes", id),
        { done: !done }
      );
    } catch (e) {
      showToast("메모 수정 실패: " + e.message, "error");
    }
  };

  const handleDeleteNote = async (id) => {
    try {
      await deleteDoc(doc(db, "artifacts", APP_ID, "public", "data", "operationNotes", id));
    } catch (e) {
      showToast("메모 삭제 실패: " + e.message, "error");
    }
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

  const handleDeleteMessageLog = async (log) => {
    if (!log?.id) return;
    try {
      const safeAppId = APP_ID || "jnc-music-v2";
      await deleteDoc(doc(db, "artifacts", safeAppId, "public", "data", "messageLogs", log.id));
    } catch (e) {
      console.error("메시지 이력 삭제 오류:", e);
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
    realSessionStartDate = date,
    method = "",
    totalSessionsOverride = null
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
      // 완전 동일(날짜+금액)이면 무조건 차단
      const exactDuplicate = (student.paymentHistory || []).some(
        (p) => p.date === date && Number(p.amount) === Number(amount)
      );
      if (exactDuplicate) {
        showToast("이미 동일한 결제 내역이 있습니다.", "error");
        return;
      }
      // 10일 이내 동일 금액 결제가 있으면 중복 여부 확인
      const recentDuplicate = (student.paymentHistory || []).find((p) => {
        const diffDays = (new Date(date) - new Date(p.date)) / (1000 * 60 * 60 * 24);
        return Math.abs(diffDays) <= 10 && Number(p.amount) === Number(amount);
      });
      if (recentDuplicate) {
        const ok = window.confirm(
          `${recentDuplicate.date}에 동일 금액(${Number(amount).toLocaleString()}원)의 결제가 이미 있습니다.\n발송을 여러 번 한 경우 중복 등록일 수 있습니다.\n\n그래도 등록하시겠습니까?`
        );
        if (!ok) return;
      }
      const paymentSessionUnit = totalSessionsOverride ?? getEffectiveSessions(student);
      // 선불 방식: sessionStartDate(=realSessionStartDate)부터 시작하는 수업 날짜 저장
      const sortedAttForPay = [...(student.attendanceHistory || [])]
        .filter((h) => h.status === "present" || h.status === "canceled")
        .sort((a, b) => a.date.localeCompare(b.date));
      const attSlotsForPay = [];
      sortedAttForPay.forEach((h) => {
        const cnt = h.status === "canceled" ? 1 : (h.count || 1);
        for (let i = 0; i < cnt; i++) attSlotsForPay.push(h.date);
      });
      // 누적 슬라이스: 이전 결제들이 차지한 슬롯 다음부터 paymentSessionUnit개 커버
      // sessionDates 중복 방지 (T vs P 누적 모델과 일치)
      const previousUnits = (student.paymentHistory || []).reduce(
        (s, p) => s + (p.totalSessions > 0 ? p.totalSessions : getEffectiveSessions(student)),
        0
      );
      const sessionDates = attSlotsForPay.slice(
        previousUnits,
        previousUnits + paymentSessionUnit
      );

      const newHistoryItem = {
        date,
        amount,
        type: "tuition",
        sessionStartDate: realSessionStartDate,
        totalSessions: paymentSessionUnit,
        sessionDates,
        createdAt: new Date().toISOString(),
        ...(method && { method }),
      };
      const updatedHistory = [
        ...(student.paymentHistory || []),
        newHistoryItem,
      ];
      await updateDoc(studentRef, {
        paymentHistory: updatedHistory,
        lastPaymentDate: realSessionStartDate,
        sessionsCompleted: 0,
        ...(method && { lastPaymentMethod: method }),
      });

      // 결제 완료 시 미결제(paidAt 없는) 메시지 로그에만 paidAt 마킹 (이력 보존)
      // 다음 결제 주기에는 sessionStartDate 기준으로 새 로그가 "미발송"으로 분류됨
      try {
        const logsRef = collection(db, "artifacts", safeAppId, "public", "data", "messageLogs");
        const logsQuery = query(logsRef, where("studentId", "==", studentId));
        const logSnap = await getDocs(logsQuery);
        const batch = writeBatch(db);
        logSnap.forEach((d) => {
          const data = d.data();
          if (!data.paidAt) {
            batch.update(d.ref, {
              paidAt: realSessionStartDate,
              paidAmount: amount,
              ...(method && { paidMethod: method }),
            });
          }
        });
        await batch.commit();
      } catch (logErr) {
        console.error("메시지 이력 마킹 오류:", logErr);
      }

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

  // 강사 메모 팝업 닫기 (DB는 건드리지 않음 — 배너로 계속 표시)
  const handleMemoPopupClose = () => {
    setShowMemoPopup(false);
  };

  // 강사 메모 완료 처리 (Firestore pendingMemos 초기화 — 배너 완료 버튼)
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
    try {
      const safeAppId = APP_ID || "jnc-music-v2";
      await deleteDoc(
        doc(db, "artifacts", safeAppId, "public", "data", "students", studentId)
      );
      showToast("삭제되었습니다.", "success");
    } catch (e) {
      console.error(e);
      showToast("삭제 실패: " + e.message, "error");
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
      {/* 키오스크 모드: 전체화면 오버레이 (관리자 전용) */}
      {activeTab === "kiosk" && currentUser?.role === "admin" && (
        <KioskView
          students={students}
          onExitKiosk={() => setActiveTab("dashboard")}
        />
      )}

      {/* 0. 강사 메모 알림 팝업 (로그인 직후 — 확인은 팝업만 닫고 배너 유지) */}
      {showMemoPopup && (
        <MemoNoticePopup
          memos={pendingMemos}
          onDismiss={handleMemoPopupClose}
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
          {currentUser.role === "admin" && (
          <SidebarItem
            icon={Tablet}
            label="출석 단말기"
            active={activeTab === "kiosk"}
            onClick={() => {
              setActiveTab("kiosk");
              setIsSidebarOpen(false);
            }}
          />
          )}
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
                icon={Calculator}
                label="강사료 계산"
                active={activeTab === "instructorFee"}
                onClick={() => {
                  setActiveTab("instructorFee");
                  setIsSidebarOpen(false);
                }}
              />
              <SidebarItem
                icon={TrendingUp}
                label="월마감 자료"
                active={activeTab === "monthlyClosing"}
                onClick={() => {
                  setActiveTab("monthlyClosing");
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
              <p className="text-xs text-slate-500 bg-white border px-1.5 py-0.5 rounded-full inline-block mt-0.5">
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
              : activeTab === "instructorFee"
              ? "강사료 계산 센터"
              : activeTab === "monthlyClosing"
              ? "월마감 자료"
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
            className="p-2 rounded-lg hover:bg-slate-100 active:bg-slate-200 transition-colors"
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
              showToast={showToast}
              operationNotes={operationNotes}
              weeklySnapshots={weeklySnapshots}
              onAddNote={handleAddNote}
              onToggleNote={handleToggleNote}
              onDeleteNote={handleDeleteNote}
            />
          )}
          {activeTab === "timetable" && (
            <TeacherTimetableView students={students} teachers={teachers} user={currentUser} />
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
              onUpdateStudent={handleUpdateStudent}
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
            <>
              <PaymentViewNew
                students={students}
                showToast={showToast}
                onSavePayment={handleSavePayment}
                onUpdatePaymentHistory={handleUpdatePaymentHistory}
                onUpdateStudent={handleUpdateStudent}
                messageLogs={messageLogs}
                onSaveMessageLog={handleSaveMessageLog}
                onDeleteMessageLog={handleDeleteMessageLog}
                paymentUrl={paymentUrl}
                user={currentUser}
                generatePaymentMessage={generatePaymentMessage}
                onOpenStudentDetail={(student) => setPayDetailStudentId(student.id)}
              />
              {payDetailStudent && (
                <PaymentDetailModal
                  student={payDetailStudent}
                  onClose={() => setPayDetailStudentId(null)}
                  onSavePayment={handleSavePayment}
                  onUpdatePaymentHistory={handleUpdatePaymentHistory}
                  onUpdateStudent={handleUpdateStudent}
                  showToast={showToast}
                />
              )}
            </>
          )}
          {activeTab === "consultations" && currentUser.role === "admin" && (
            <ConsultationView
              consultations={consultations}
              showToast={showToast}
              onRegisterStudent={handleRegisterFromConsultation} // 👈 이 연결이 핵심입니다!
              targetConsultation={targetConsultation}
              onClearTargetConsultation={() => setTargetConsultation(null)}
              students={students}
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
          {activeTab === "instructorFee" && currentUser.role === "admin" && (
            <InstructorFeeView
              teachers={teachers}
              students={students}
              showToast={showToast}
            />
          )}
          {activeTab === "monthlyClosing" && currentUser.role === "admin" && (
            <MonthlyClosingView
              teachers={teachers}
              students={students}
              consultations={consultations}
              showToast={showToast}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// =================================================================
// [MonthlyClosingView] - 월마감 자료 (관리자 전용)
// =================================================================
const MonthlyClosingView = ({ teachers, students, consultations = [], showToast }) => {
  const today = new Date();
  const [selYear, setSelYear] = useState(today.getFullYear());
  const [selMonth, setSelMonth] = useState(today.getMonth() + 1);

  // 급여 정산주기(전월 24일~당월 23일) — 강사료 계산 센터/보고서와 동일
  const { start: periodStart, end: periodEnd } = calcDefaultPeriod(selYear, selMonth);

  // ── 수납 기준 매출 ────────────────────────────────────────────
  // 해당 월에 결제된 paymentHistory 항목의 amount(또는 tuitionFee) 합산
  const collectionRows = useMemo(() => {
    const rows = [];
    students.filter((s) => s.status === "재원" || (s.paymentHistory || []).some((p) => p.date >= periodStart && p.date <= periodEnd)).forEach((s) => {
      (s.paymentHistory || []).forEach((p) => {
        if (p.date >= periodStart && p.date <= periodEnd) {
          rows.push({
            studentId: s.id,
            name: s.name,
            subject: s.subject || "",
            teacher: s.teacher || "",
            date: p.date,
            amount: Number(p.amount || s.tuitionFee || 0),
            sessions: Number(p.totalSessions || 0),
          });
        }
      });
    });
    return rows.sort((a, b) => a.date.localeCompare(b.date));
  }, [students, periodStart, periodEnd]);
  const collectionTotal = collectionRows.reduce((s, r) => s + r.amount, 0);

  // ── 수업 기준 매출 ────────────────────────────────────────────
  // 해당 월 출석(present/canceled) 회차 × 회당 단가 합산
  const lessonRows = useMemo(() => {
    const rows = [];
    students.filter((s) => s.status === "재원" || (s.attendanceHistory || []).some((h) => h.date >= periodStart && h.date <= periodEnd)).forEach((s) => {
      const hists = (s.attendanceHistory || []).filter(
        (h) => h.date >= periodStart && h.date <= periodEnd && (h.status === "present" || h.status === "canceled")
      );
      if (!hists.length) return;
      const unit = getEffectiveSessions(s);
      const fee = Number(s.tuitionFee || 0);
      const perSession = unit > 0 ? Math.round(fee / unit) : 0;
      const sessions = hists.reduce((sum, h) => sum + (h.status === "present" ? (h.count || 1) : 0.5), 0);
      rows.push({
        studentId: s.id,
        name: s.name,
        subject: s.subject || "",
        teacher: s.teacher || "",
        sessions,
        perSession,
        amount: Math.round(sessions * perSession),
      });
    });
    return rows.sort((a, b) => b.amount - a.amount);
  }, [students, periodStart, periodEnd]);
  const lessonTotal = lessonRows.reduce((s, r) => s + r.amount, 0);

  // ── 강사료 (강사료 계산 센터와 동일 로직: 모듈 레벨 resolveFeeTeacher 사용) ──
  const calcSessions = useCallback((teacherName) =>
    students.map((s) => {
      const recs = (s.attendanceHistory || []).filter(
        (h) => h.date >= periodStart && h.date <= periodEnd &&
          (h.status === "present" || h.status === "canceled") &&
          resolveFeeTeacher(s, h.date, h) === teacherName
      );
      if (!recs.length) return null;
      const sessions = recs.reduce((sum, h) => sum + (h.status === "present" ? (h.count || 1) : (h.status === "canceled" ? 0.5 : 0)), 0);
      return { name: s.name, studentId: s.id, sessions, standardSessions: getEffectiveSessions(s), tuitionFee: Number(s.tuitionFee || 0) };
    }).filter(Boolean),
  [students, periodStart, periodEnd]);

  // 강사료 계산 센터와 동일
  const calcStudentFee = (teacher, row) => {
    if (!teacher) return 0;
    const overrides = teacher.studentFeeOverrides || {};
    const override = overrides[row.studentId];
    if (override != null && override !== "") {
      if (typeof override === "number" || (typeof override === "string" && override !== "")) {
        return row.sessions * Number(override);
      }
      const { type, value } = override;
      if (value !== "" && value != null && Number(value) >= 0) {
        if (type === "percent") return Math.round((row.tuitionFee / (row.standardSessions || 4)) * row.sessions * (Number(value) / 100));
        return row.sessions * Number(value);
      }
    }
    if (teacher.feeType === "revenueShare") {
      const rate = Number(teacher.feeRate || 0) / 100;
      const base = row.standardSessions || 4;
      return Math.round((row.tuitionFee / base) * row.sessions * rate);
    }
    return row.sessions * Number(teacher.feeRate || 0);
  };

  const teacherFeeRows = useMemo(() => {
    // 원장(강열혁) 본인은 강사료를 지급받지 않으므로 제외
    return teachers.filter((t) => t.name !== OWNER_NAME).map((t) => {
      const rows = calcSessions(t.name);
      const totalSessions = rows.reduce((s, r) => s + r.sessions, 0);
      let gross = 0;
      if (t.feeType === "monthly") {
        gross = Number(t.feeRate || 0);
      } else {
        gross = rows.reduce((s, r) => s + calcStudentFee(t, r), 0);
      }
      return { teacher: t, rows, totalSessions, gross };
    }).filter((r) => r.totalSessions > 0 && r.gross > 0);
  }, [teachers, calcSessions]);

  const totalFee = teacherFeeRows.reduce((s, r) => s + r.gross, 0);

  // ── 탭 ───────────────────────────────────────────────────────
  const [tab, setTab] = useState("summary");

  const prevMonth = () => {
    if (selMonth === 1) { setSelYear(y => y - 1); setSelMonth(12); }
    else setSelMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (selMonth === 12) { setSelYear(y => y + 1); setSelMonth(1); }
    else setSelMonth(m => m + 1);
  };

  // ── 엑셀 내보내기 ─────────────────────────────────────────────
  const handleExport = () => {
    if (!window.XLSX) { showToast("XLSX 라이브러리를 불러오는 중입니다.", "error"); return; }
    const wb = window.XLSX.utils.book_new();
    const title = `${selYear}년 ${selMonth}월 월마감`;

    // 요약 시트
    const summaryData = [
      [title],
      [],
      ["구분", "금액"],
      ["수납 기준 매출", collectionTotal],
      ["수업 기준 매출", lessonTotal],
      ["강사료 합계", totalFee],
      ["수납 기준 순수익", collectionTotal - totalFee],
      ["수업 기준 순수익", lessonTotal - totalFee],
      ["신규 원생수", newStudentsCount],
      ["신규 상담수", newConsultCount],
    ];
    window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(summaryData), "요약");

    // 수납 내역 시트
    const colData = [
      [`${title} — 수납 내역`], [],
      ["결제일", "학생명", "과목", "담당강사", "금액", "회차"],
      ...collectionRows.map(r => [r.date, r.name, r.subject, r.teacher, r.amount, r.sessions]),
      [], ["합계", "", "", "", collectionTotal, ""],
    ];
    window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(colData), "수납내역");

    // 수업 내역 시트
    const lesData = [
      [`${title} — 수업 기준 매출`], [],
      ["학생명", "과목", "담당강사", "수업회차", "회당단가", "금액"],
      ...lessonRows.map(r => [r.name, r.subject, r.teacher, r.sessions, r.perSession, r.amount]),
      [], ["합계", "", "", "", "", lessonTotal],
    ];
    window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(lesData), "수업매출");

    // 강사료 시트
    const feeData = [
      [`${title} — 강사료`], [],
      ["강사명", "수업회차", "강사료", "소득세(3%)", "지방세(0.3%)", "실지급액"],
      ...teacherFeeRows.map(r => {
        const tax = Math.round(r.gross * 0.033);
        return [r.teacher.name, r.totalSessions, r.gross, Math.round(r.gross * 0.03), Math.round(r.gross * 0.003), r.gross - tax];
      }),
      [], ["합계", teacherFeeRows.reduce((s, r) => s + r.totalSessions, 0), totalFee, "", "", ""],
    ];
    window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(feeData), "강사료");

    window.XLSX.writeFile(wb, `월마감_${selYear}${String(selMonth).padStart(2, "0")}.xlsx`);
    showToast("월마감 엑셀 파일이 저장되었습니다.", "success");
  };

  const SummaryCard = ({ label, value, sub, color = "text-slate-800", suffix = "원" }) => (
    <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-1 shadow-sm">
      <div className="text-xs text-slate-500 font-medium">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{Number(value).toLocaleString()}{suffix}</div>
      {sub && <div className="text-xs text-slate-400">{sub}</div>}
    </div>
  );

  // 정산기간 내 신규 등록 원생 수 (등록일 기준, 퇴원 제외)
  const newStudentsCount = useMemo(
    () =>
      students.filter(
        (s) =>
          (s.registrationDate || (s.createdAt ? s.createdAt.slice(0, 10) : "")) >= periodStart &&
          (s.registrationDate || (s.createdAt ? s.createdAt.slice(0, 10) : "")) <= periodEnd &&
          s.status !== "퇴원"
      ).length,
    [students, periodStart, periodEnd]
  );

  // 정산기간 내 신규 상담 접수 수 (상담일 기준)
  const newConsultCount = useMemo(
    () =>
      consultations.filter((c) => (c.date || "") >= periodStart && (c.date || "") <= periodEnd).length,
    [consultations, periodStart, periodEnd]
  );

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp size={20} className="text-indigo-600" /> 월마감 자료
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            매출 · 강사료 · 순수익 종합
            <span className="ml-1.5 text-slate-500 font-medium">
              (정산기간 {periodStart.slice(5).replace("-", "/")} ~ {periodEnd.slice(5).replace("-", "/")})
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100 active:bg-slate-200 text-slate-500"><ChevronLeft size={18} /></button>
          <div className="flex items-center gap-1">
            <select value={selYear} onChange={(e) => setSelYear(Number(e.target.value))}
              className="text-base font-bold text-slate-700 bg-transparent border-none outline-none cursor-pointer hover:text-indigo-600 pr-1">
              {Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i).map(y => (
                <option key={y} value={y}>{y}년</option>
              ))}
            </select>
            <select value={selMonth} onChange={(e) => setSelMonth(Number(e.target.value))}
              className="text-base font-bold text-slate-700 bg-transparent border-none outline-none cursor-pointer hover:text-indigo-600">
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                <option key={m} value={m}>{m}월</option>
              ))}
            </select>
          </div>
          <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-100 active:bg-slate-200 text-slate-500"><ChevronRight size={18} /></button>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 active:bg-indigo-800 shadow-sm"
          >
            <Download size={15} /> 엑셀
          </button>
        </div>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <SummaryCard label="수납 기준 매출" value={collectionTotal} sub={`${collectionRows.length}건`} color="text-indigo-700" />
        <SummaryCard label="수업 기준 매출" value={lessonTotal} sub={`${lessonRows.length}명`} color="text-indigo-700" />
        <SummaryCard label="강사료 합계" value={totalFee} sub={`${teacherFeeRows.length}명`} color="text-rose-600" />
        <SummaryCard label="신규 원생수" value={newStudentsCount} suffix="명" color="text-emerald-600" />
        <SummaryCard label="신규 상담수" value={newConsultCount} suffix="건" color="text-violet-600" />
        <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-5 flex flex-col gap-1 shadow-sm col-span-2 sm:col-span-1">
          <div className="text-xs text-indigo-500 font-bold">수납 기준 순수익</div>
          <div className={`text-2xl font-bold ${collectionTotal - totalFee >= 0 ? "text-emerald-700" : "text-rose-600"}`}>
            {(collectionTotal - totalFee).toLocaleString()}원
          </div>
          <div className="text-xs text-slate-400">수업 기준: {(lessonTotal - totalFee).toLocaleString()}원</div>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 mb-4 bg-slate-100 rounded-lg p-1 w-fit">
        {[["summary", "강사료 내역"], ["collection", "수납 내역"], ["lesson", "수업 매출"]].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${tab === id ? "bg-white shadow text-indigo-700 font-bold" : "text-slate-500 hover:text-slate-700"}`}>
            {label}
          </button>
        ))}
      </div>

      {/* 강사료 내역 탭 */}
      {tab === "summary" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-5 py-3 text-left font-bold text-slate-600">강사명</th>
                <th className="px-5 py-3 text-right font-bold text-slate-600">수업회차</th>
                <th className="px-5 py-3 text-right font-bold text-slate-600">강사료</th>
                <th className="px-5 py-3 text-right font-bold text-slate-600 hidden sm:table-cell">소득세(3%)</th>
                <th className="px-5 py-3 text-right font-bold text-slate-600 hidden sm:table-cell">지방세(0.3%)</th>
                <th className="px-5 py-3 text-right font-bold text-slate-600">실지급액</th>
              </tr>
            </thead>
            <tbody>
              {teacherFeeRows.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-slate-400">해당 월 강사료 데이터가 없습니다.</td></tr>
              ) : teacherFeeRows.map(({ teacher, totalSessions, gross }) => {
                const incomeTax = Math.round(gross * 0.03);
                const localTax = Math.round(gross * 0.003);
                const net = gross - incomeTax - localTax;
                return (
                  <tr key={teacher.id} className="border-b hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium">{teacher.name}
                      <span className="ml-1.5 text-xs text-slate-400">{teacher.feeType === "monthly" ? "(월고정)" : teacher.feeType === "revenueShare" ? `(${teacher.feeRate}%)` : `(${Number(teacher.feeRate || 0).toLocaleString()}원/회)`}</span>
                    </td>
                    <td className="px-5 py-3 text-right text-slate-600">{totalSessions}회</td>
                    <td className="px-5 py-3 text-right font-bold text-rose-600">{gross.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-slate-500 hidden sm:table-cell">{incomeTax.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right text-slate-500 hidden sm:table-cell">{localTax.toLocaleString()}</td>
                    <td className="px-5 py-3 text-right font-bold text-slate-700">{net.toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="bg-slate-50 border-t">
              <tr>
                <td className="px-5 py-3 font-bold text-slate-700">합계</td>
                <td className="px-5 py-3 text-right font-bold text-slate-600">{teacherFeeRows.reduce((s, r) => s + r.totalSessions, 0)}회</td>
                <td className="px-5 py-3 text-right font-bold text-rose-700">{totalFee.toLocaleString()}</td>
                <td className="px-5 py-3 text-right font-bold hidden sm:table-cell text-slate-600">{Math.round(totalFee * 0.03).toLocaleString()}</td>
                <td className="px-5 py-3 text-right font-bold hidden sm:table-cell text-slate-600">{Math.round(totalFee * 0.003).toLocaleString()}</td>
                <td className="px-5 py-3 text-right font-bold text-slate-800">{Math.round(totalFee * (1 - 0.033)).toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* 수납 내역 탭 */}
      {tab === "collection" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-slate-600">결제일</th>
                <th className="px-4 py-3 text-left font-bold text-slate-600">학생명</th>
                <th className="px-4 py-3 text-left font-bold text-slate-600 hidden sm:table-cell">과목</th>
                <th className="px-4 py-3 text-left font-bold text-slate-600 hidden sm:table-cell">강사</th>
                <th className="px-4 py-3 text-right font-bold text-slate-600">금액</th>
                <th className="px-4 py-3 text-right font-bold text-slate-600 hidden sm:table-cell">회차</th>
              </tr>
            </thead>
            <tbody>
              {collectionRows.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-slate-400">해당 월 수납 내역이 없습니다.</td></tr>
              ) : collectionRows.map((r, i) => (
                <tr key={i} className="border-b hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">{r.date.slice(5).replace("-", "/")}</td>
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{r.subject || "-"}</td>
                  <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{r.teacher || "-"}</td>
                  <td className="px-4 py-3 text-right font-bold text-indigo-700">{r.amount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-slate-400 hidden sm:table-cell">{r.sessions > 0 ? `${r.sessions}회` : "-"}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t">
              <tr>
                <td colSpan={4} className="px-4 py-3 font-bold text-slate-700">합계 ({collectionRows.length}건)</td>
                <td className="px-4 py-3 text-right font-bold text-indigo-700">{collectionTotal.toLocaleString()}</td>
                <td className="hidden sm:table-cell" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* 수업 매출 탭 */}
      {tab === "lesson" && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left font-bold text-slate-600">학생명</th>
                <th className="px-4 py-3 text-left font-bold text-slate-600 hidden sm:table-cell">과목</th>
                <th className="px-4 py-3 text-left font-bold text-slate-600 hidden sm:table-cell">강사</th>
                <th className="px-4 py-3 text-right font-bold text-slate-600">수업회차</th>
                <th className="px-4 py-3 text-right font-bold text-slate-600 hidden sm:table-cell">회당단가</th>
                <th className="px-4 py-3 text-right font-bold text-slate-600">금액</th>
              </tr>
            </thead>
            <tbody>
              {lessonRows.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-slate-400">해당 월 수업 기록이 없습니다.</td></tr>
              ) : lessonRows.map((r, i) => (
                <tr key={i} className="border-b hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{r.name}</td>
                  <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{r.subject || "-"}</td>
                  <td className="px-4 py-3 text-slate-500 hidden sm:table-cell">{r.teacher || "-"}</td>
                  <td className="px-4 py-3 text-right text-slate-600">{r.sessions}회</td>
                  <td className="px-4 py-3 text-right text-slate-400 hidden sm:table-cell">{r.perSession.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right font-bold text-indigo-700">{r.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t">
              <tr>
                <td colSpan={3} className="px-4 py-3 font-bold text-slate-700 hidden sm:table-cell">합계 ({lessonRows.length}명)</td>
                <td colSpan={3} className="px-4 py-3 font-bold text-slate-700 sm:hidden">합계 ({lessonRows.length}명)</td>
                <td className="px-4 py-3 text-right font-bold text-slate-600 hidden sm:table-cell">{lessonRows.reduce((s, r) => s + r.sessions, 0)}회</td>
                <td className="hidden sm:table-cell" />
                <td className="px-4 py-3 text-right font-bold text-indigo-700">{lessonTotal.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

// =================================================================
// [InstructorFeeView] - 강사료 계산 센터 (관리자 전용)
// =================================================================

// 출석 날짜 기준 실제 담당 강사 조회 (강사 변경 이력 반영)
const resolveFeeTeacher = (student, date, record) => {
  if (record?.teacher) return record.teacher;
  const hist = student.teacherHistory;
  if (!hist || !hist.length) return student.teacher || "";
  const entry = [...hist]
    .sort((a, b) => b.from.localeCompare(a.from))
    .find((h) => h.from <= date && (h.to === null || h.to >= date));
  return entry ? entry.teacher : student.teacher || "";
};

const calcDefaultPeriod = (year, month) => {
  let py = year, pm = month - 1;
  if (pm === 0) { pm = 12; py = year - 1; }
  return {
    start: `${py}-${String(pm).padStart(2, "0")}-24`,
    end: `${year}-${String(month).padStart(2, "0")}-23`,
  };
};

const InstructorFeeView = ({ teachers, students, showToast }) => {
  const [subTab, setSubTab] = useState("calc");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedTeacherName, setSelectedTeacherName] = useState("");
  const [showSlip, setShowSlip] = useState(false);
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [savingId, setSavingId] = useState(null);
  const [editFeeData, setEditFeeData] = useState({});
  const slipRef = useRef(null);

  const defaultPeriod = calcDefaultPeriod(selectedYear, selectedMonth);
  const [periodStart, setPeriodStart] = useState(defaultPeriod.start);
  const [periodEnd, setPeriodEnd] = useState(defaultPeriod.end);

  const teacherList = teachers.filter((t) => t.name && t.name.trim());

  // 첫 강사 자동 선택
  useEffect(() => {
    if (!selectedTeacherName && teacherList.length > 0) {
      setSelectedTeacherName(teacherList[0].name);
    }
  }, [teacherList.length]); // eslint-disable-line

  // 단가 편집 데이터 초기화 (최초 1회)
  useEffect(() => {
    setEditFeeData((prev) => {
      if (Object.keys(prev).length > 0) return prev;
      const data = {};
      teachers.forEach((t) => {
        if (t.id)
          data[t.id] = {
            feeType: t.feeType || "perSession",
            feeRate: t.feeRate != null ? String(t.feeRate) : "",
            // 구버전(숫자) 호환: { type, value } 구조로 정규화
            studentFeeOverrides: Object.fromEntries(
              Object.entries(t.studentFeeOverrides || {}).map(([sid, val]) => [
                sid,
                typeof val === "object" ? val : { type: "fixed", value: val },
              ])
            ),
            showOverrides: false,
          };
      });
      return Object.keys(data).length > 0 ? data : prev;
    });
  }, [teachers]);

  // 연/월 변경 시 기간 기본값으로 리셋
  useEffect(() => {
    const p = calcDefaultPeriod(selectedYear, selectedMonth);
    setPeriodStart(p.start);
    setPeriodEnd(p.end);
  }, [selectedYear, selectedMonth]);

  // 강사별 학생 수업 횟수 집계
  const calcSessions = useCallback(
    (teacherName) =>
      students
        .map((s) => {
          const allRecs = (s.attendanceHistory || []).filter(
            (h) =>
              h.date >= periodStart &&
              h.date <= periodEnd &&
              (h.status === "present" || h.status === "canceled")
          );
          const recs = allRecs.filter(
            (h) => resolveFeeTeacher(s, h.date, h) === teacherName
          );
          if (!recs.length) return null;
          const countRec = (h) =>
            h.status === "present" ? (h.count || 1) : h.status === "canceled" ? 0.5 : 0;
          const sessions = recs.reduce((sum, h) => sum + countRec(h), 0);
          const totalStudentSessions = allRecs.reduce((sum, h) => sum + countRec(h), 0);
          return {
            name: s.name,
            studentId: s.id,
            sessions,
            totalStudentSessions,
            standardSessions: getEffectiveSessions(s),
            tuitionFee: Number(s.tuitionFee || 0),
          };
        })
        .filter(Boolean)
        .sort((a, b) => b.sessions - a.sessions),
    [students, periodStart, periodEnd]
  );

  // 학생 1명에 대한 강사료 계산 (override → revenueShare → 기본 단가)
  const calcStudentFee = (teacher, row) => {
    if (!teacher) return 0;
    const overrides = teacher.studentFeeOverrides || {};
    const override = overrides[row.studentId];
    if (override != null && override !== "") {
      // 구버전 호환: 숫자면 회당 고정으로 처리
      if (typeof override === "number" || (typeof override === "string" && override !== "")) {
        return row.sessions * Number(override);
      }
      const { type, value } = override;
      if (value !== "" && value != null && Number(value) >= 0) {
        // percent: revenueShare와 동일하게 회당 단가 × 실제 수업 횟수 기준으로 계산
        // (수강료 × 비율%만 하면 실제 출석 횟수가 반영되지 않는 버그가 있었음)
        if (type === "percent") {
          const base = row.standardSessions || row.totalStudentSessions || 4;
          const perSession = row.tuitionFee / base;
          return Math.round(perSession * row.sessions * (Number(value) / 100));
        }
        return row.sessions * Number(value); // fixed
      }
    }
    // 기본 단가 (revenueShare: 회당 단가 × 실제 수업 횟수 × 비율)
    if (teacher.feeType === "revenueShare") {
      const rate = Number(teacher.feeRate || 0) / 100;
      const base = row.standardSessions || row.totalStudentSessions || 4;
      const perSession = row.tuitionFee / base;
      return Math.round(perSession * row.sessions * rate);
    }
    return row.sessions * Number(teacher.feeRate || 0);
  };

  // 강사료 합계 (회당/비율 → 학생별 합산, 월고정 → feeRate 그대로)
  const calcFee = (teacher, rows) => {
    if (!teacher) return 0;
    if (teacher.feeType === "monthly") return Number(teacher.feeRate || 0);
    return rows.reduce((sum, row) => sum + calcStudentFee(teacher, row), 0);
  };

  const currentTeacher = teacherList.find((t) => t.name === selectedTeacherName);
  const sessionRows = useMemo(
    () => (selectedTeacherName ? calcSessions(selectedTeacherName) : []),
    [selectedTeacherName, calcSessions]
  );
  const totalSessions = sessionRows.reduce((s, r) => s + r.sessions, 0);
  const grossFee = calcFee(currentTeacher, sessionRows);
  const tax = Math.round(grossFee * 0.033);

  // 일괄 다운로드 상태
  const [bulkDownloadIdx, setBulkDownloadIdx] = useState(-1);
  const [bulkDownloadDone, setBulkDownloadDone] = useState(0);
  const bulkSlipRef = useRef(null);

  // 단가 설정된 강사만 일괄 대상
  const bulkTeachers = useMemo(
    () => teacherList.filter((t) => {
      const rows = calcSessions(t.name);
      const sess = rows.reduce((s, r) => s + r.sessions, 0);
      return sess > 0 && calcFee(t, rows) > 0;
    }),
    [teacherList, calcSessions]
  );

  // 일괄 다운로드: bulkDownloadIdx 변경 시 캡처 실행
  useEffect(() => {
    if (bulkDownloadIdx < 0 || bulkDownloadIdx >= bulkTeachers.length) {
      if (bulkDownloadIdx >= bulkTeachers.length) {
        setBulkDownloadIdx(-1);
        setBulkDownloadDone(0);
        showToast(`${bulkTeachers.length}명 명세서 다운로드 완료`, "success");
      }
      return;
    }
    const timer = setTimeout(async () => {
      if (!bulkSlipRef.current) return;
      try {
        const canvas = await html2canvas(bulkSlipRef.current, { scale: 2.5, backgroundColor: "#ffffff", useCORS: true });
        const link = document.createElement("a");
        link.download = `급여명세서_${bulkTeachers[bulkDownloadIdx].name}_${selectedYear}년${selectedMonth}월.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        setBulkDownloadDone((d) => d + 1);
        setBulkDownloadIdx((i) => i + 1);
      } catch {
        setBulkDownloadIdx((i) => i + 1);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [bulkDownloadIdx]); // eslint-disable-line
  const netFee = grossFee - tax;

  const yearOptions = [
    new Date().getFullYear() - 1,
    new Date().getFullYear(),
    new Date().getFullYear() + 1,
  ];

  // 단가 Firebase 저장
  const handleSaveFeeRate = async (teacherId) => {
    const data = editFeeData[teacherId];
    if (!data) return;
    setSavingId(teacherId);
    try {
      // studentFeeOverrides: value가 비어있으면 제외, { type, value: number } 구조로 저장
      const cleanedOverrides = {};
      Object.entries(data.studentFeeOverrides || {}).forEach(([sid, entry]) => {
        if (!entry) return;
        const val = typeof entry === "object" ? entry.value : entry;
        const type = typeof entry === "object" ? (entry.type || "fixed") : "fixed";
        if (val !== "" && val != null && String(val).trim() !== "") {
          cleanedOverrides[sid] = { type, value: Number(val) };
        }
      });
      await updateDoc(
        doc(db, "artifacts", APP_ID, "public", "data", "teachers", teacherId),
        { feeType: data.feeType, feeRate: Number(data.feeRate) || 0, studentFeeOverrides: cleanedOverrides }
      );
      showToast("저장되었습니다.", "success");
    } catch {
      showToast("저장 실패", "error");
    } finally {
      setSavingId(null);
    }
  };

  // 명세서 이미지 저장
  const handleSaveSlipImage = async () => {
    if (!slipRef.current) return;
    try {
      const canvas = await html2canvas(slipRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.download = `급여명세서_${selectedTeacherName}_${selectedYear}년${selectedMonth}월.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      showToast("명세서가 저장되었습니다.", "success");
    } catch {
      showToast("이미지 저장 실패", "error");
    }
  };

  // 월별 계산서 엑셀 다운로드
  const handleCalcExcel = () => {
    if (typeof window.XLSX === "undefined") {
      showToast("잠시 후 다시 시도해주세요.", "error");
      return;
    }
    const isPerSession = (currentTeacher?.feeType || "perSession") !== "monthly";
    const wb = window.XLSX.utils.book_new();
    const rows = [
      [`${selectedYear}년 ${selectedMonth}월 강사료 계산서 — ${selectedTeacherName}`],
      [`정산 기간: ${periodStart} ~ ${periodEnd}`],
      [],
      ["학생명", "회차", "강사료(원)"],
      ...sessionRows.map((r) => [
        r.name,
        r.sessions,
        isPerSession ? calcStudentFee(currentTeacher, r) : "—",
      ]),
      [],
      ["합계", totalSessions, grossFee],
      ["세금 (3.3%)", "", -tax],
      ["실지급액", "", netFee],
    ];
    const ws = window.XLSX.utils.aoa_to_sheet(rows);
    window.XLSX.utils.book_append_sheet(wb, ws, "강사료계산서");
    window.XLSX.writeFile(
      wb,
      `강사료_${selectedTeacherName}_${selectedYear}${String(selectedMonth).padStart(2, "0")}.xlsx`
    );
  };

  // 세무 자료 엑셀 다운로드
  const handleTaxExcel = () => {
    if (typeof window.XLSX === "undefined") {
      showToast("잠시 후 다시 시도해주세요.", "error");
      return;
    }
    const wb = window.XLSX.utils.book_new();
    const header = [
      [`${selectedYear}년 ${selectedMonth}월 강사료 세무 자료`],
      [`정산 기간: ${periodStart} ~ ${periodEnd}`],
      [],
      ["연번", "강사명", "주민등록번호", "은행", "계좌번호", "파트", "귀속월", "지급액(강사료)", "소득세(3%)", "지방소득세(0.3%)", "합계세액", "실지급액"],
    ];
    let seq = 0;
    const dataRows = teacherList
      .map((t) => {
        const rows2 = calcSessions(t.name);
        const sess = rows2.reduce((s, r) => s + r.sessions, 0);
        if (!sess) return null;
        const gross = calcFee(t, rows2);
        if (!gross) return null;
        const it = Math.round(gross * 0.03);
        const lt = Math.round(gross * 0.003);
        seq++;
        return [
          seq,
          t.name,
          t.residentId || "",
          t.bankName || "",
          t.bankAccount || "",
          t.part || "",
          `${selectedYear}-${String(selectedMonth).padStart(2, "0")}`,
          gross,
          it,
          lt,
          it + lt,
          gross - it - lt,
        ];
      })
      .filter(Boolean);
    const totalGross = dataRows.reduce((s, r) => s + r[7], 0);
    const totalIt = dataRows.reduce((s, r) => s + r[8], 0);
    const totalLt = dataRows.reduce((s, r) => s + r[9], 0);
    const totalTax = dataRows.reduce((s, r) => s + r[10], 0);
    const totalNet = dataRows.reduce((s, r) => s + r[11], 0);
    const totalRow = ["", "합  계", "", "", "", "", "", totalGross, totalIt, totalLt, totalTax, totalNet];
    const ws = window.XLSX.utils.aoa_to_sheet([...header, ...dataRows, [], totalRow]);
    window.XLSX.utils.book_append_sheet(wb, ws, "세무자료");
    window.XLSX.writeFile(wb, `세무자료_${selectedYear}년${selectedMonth}월.xlsx`);
  };

  return (
    <div className="space-y-6">
      {/* 탭 바 */}
      <div className="flex gap-0 border-b bg-white rounded-t-2xl">
        {[
          { id: "calc", label: "월별 계산서" },
          { id: "settings", label: "단가 설정" },
          { id: "tax", label: "세무 자료" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSubTab(tab.id)}
            className={`px-5 py-3 text-sm font-bold border-b-2 transition-colors ${
              subTab === tab.id
                ? "border-indigo-600 text-indigo-600"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── 탭 1: 월별 계산서 ── */}
      {subTab === "calc" && (
        <div className="space-y-4">
          {/* 필터 컨트롤 */}
          <div className="bg-white rounded-2xl border p-4 flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">강사</label>
              <select
                value={selectedTeacherName}
                onChange={(e) => setSelectedTeacherName(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                {teacherList.map((t) => (
                  <option key={t.id} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">귀속 연/월</label>
              <div className="flex gap-1 items-center">
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="border rounded-lg px-3 py-2 text-sm"
                >
                  {yearOptions.map((y) => <option key={y} value={y}>{y}년</option>)}
                </select>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="border rounded-lg px-3 py-2 text-sm"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>{m}월</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">집계 시작일</label>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">집계 종료일</label>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="border rounded-lg px-3 py-2 text-sm"
              />
            </div>
            {(periodStart !== defaultPeriod.start || periodEnd !== defaultPeriod.end) && (
              <button
                onClick={() => { setPeriodStart(defaultPeriod.start); setPeriodEnd(defaultPeriod.end); }}
                className="self-end pb-0.5 text-xs text-indigo-500 hover:text-indigo-700 underline"
              >
                기본값으로
              </button>
            )}
          </div>

          {/* 단가 미설정 경고 */}
          {currentTeacher && !currentTeacher.feeRate && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700 flex items-center gap-2">
              <AlertCircle size={15} />
              단가가 설정되지 않았습니다. [단가 설정] 탭에서 먼저 입력해주세요.
            </div>
          )}

          {/* 수업 있음 + 강사료 0원 학생 경고 */}
          {currentTeacher && (currentTeacher.feeType || "perSession") !== "monthly" && (() => {
            const zeroFeeRows = sessionRows.filter((row) => row.sessions > 0 && calcStudentFee(currentTeacher, row) === 0);
            if (zeroFeeRows.length === 0) return null;
            return (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-sm text-rose-700 flex items-start gap-2">
                <AlertCircle size={15} className="shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">강사료 0원 학생 {zeroFeeRows.length}명:</span>{" "}
                  {zeroFeeRows.map((r) => r.name).join(", ")}
                  <span className="block text-xs text-rose-500 mt-0.5">[단가 설정] 탭에서 개별 단가를 입력하거나 기본 단가를 확인해주세요.</span>
                </div>
              </div>
            );
          })()}

          {/* 요약 카드 4개 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "담당 학생 수", value: `${sessionRows.length}명` },
              { label: "총 수업 횟수", value: `${totalSessions}회` },
              { label: "강사료", value: `${grossFee.toLocaleString()}원`, color: "text-indigo-600" },
              { label: "지급액 (세후)", value: `${netFee.toLocaleString()}원`, color: "text-emerald-700" },
            ].map((c) => (
              <div key={c.label} className="bg-white rounded-2xl border p-4 text-center">
                <p className="text-xs text-slate-500 mb-1">{c.label}</p>
                <p className={`text-xl font-bold ${c.color || "text-slate-800"}`}>{c.value}</p>
              </div>
            ))}
          </div>

          {/* 수업 내역 테이블 */}
          <div className="bg-white rounded-2xl border overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h3 className="font-bold text-slate-700">수업 내역</h3>
              <div className="flex gap-2">
                <button
                  onClick={handleCalcExcel}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                >
                  <Download size={13} /> 엑셀
                </button>
                <button
                  onClick={() => setShowSlip(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
                >
                  <File size={13} /> 명세서
                </button>
                {bulkDownloadIdx >= 0 ? (
                  <span className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-violet-50 text-violet-700 border border-violet-200 rounded-lg">
                    <Loader size={13} className="animate-spin" />
                    {bulkDownloadDone}/{bulkTeachers.length}
                  </span>
                ) : (
                  <button
                    onClick={() => { setBulkDownloadDone(0); setBulkDownloadIdx(0); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold bg-violet-50 text-violet-700 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors"
                  >
                    <Download size={13} /> 일괄 다운
                  </button>
                )}
              </div>
            </div>
            {sessionRows.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-sm">
                해당 기간의 수업 기록이 없습니다.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-5 py-3 text-left font-bold">학생명</th>
                    <th className="px-5 py-3 text-center font-bold">회차</th>
                    <th className="px-5 py-3 text-right font-bold">강사료</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionRows.map((row, i) => {
                    const isMonthly = (currentTeacher?.feeType || "perSession") === "monthly";
                    const rowFee = isMonthly ? null : calcStudentFee(currentTeacher, row);
                    const hasOverride = currentTeacher && (currentTeacher.studentFeeOverrides || {})[row.studentId] != null;
                    return (
                      <tr key={i} className="border-t hover:bg-slate-50 active:bg-slate-100 transition-colors">
                        <td className="px-5 py-3 font-medium">
                          {row.name}
                          {hasOverride && (
                            <span className="ml-1.5 text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-normal">개별단가</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-center">{row.sessions}회</td>
                        <td className="px-5 py-3 text-right">
                          {rowFee !== null ? (
                            rowFee === 0 && row.sessions > 0 ? (
                              <span className="inline-flex items-center gap-1 text-rose-600 font-bold">
                                <AlertCircle size={13} /> 0원
                              </span>
                            ) : `${rowFee.toLocaleString()}원`
                          ) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-slate-50 font-bold">
                    <td className="px-5 py-3">합계</td>
                    <td className="px-5 py-3 text-center">{totalSessions}회</td>
                    <td className="px-5 py-3 text-right">{grossFee.toLocaleString()}원</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── 탭 2: 단가 설정 ── */}
      {subTab === "settings" && (
        <div className="space-y-3">
          <p className="text-xs text-slate-400 pb-1">
            각 강사의 계약 조건에 따라 지급 단가를 설정합니다. 설정 내용은 관리자만 확인할 수 있습니다.
          </p>
          {teacherList.map((t) => {
            const ed = editFeeData[t.id] || { feeType: "perSession", feeRate: "", studentFeeOverrides: {}, showOverrides: false };
            const teacherStudents = students.filter((s) => s.teacher === t.name && s.status === "재원");
            return (
              <div key={t.id} className="bg-white rounded-2xl border overflow-hidden">
                {/* 기본 단가 설정 행 */}
                <div className="p-4 flex flex-wrap gap-3 items-center">
                  <div className="flex-1 min-w-[120px]">
                    <p className="font-bold text-slate-800">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.part || "파트 미설정"}</p>
                  </div>
                  <select
                    value={ed.feeType}
                    onChange={(e) =>
                      setEditFeeData((prev) => ({
                        ...prev,
                        [t.id]: { ...prev[t.id], feeType: e.target.value },
                      }))
                    }
                    className="border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="perSession">회당 지급</option>
                    <option value="monthly">월 고정</option>
                    <option value="revenueShare">수업료 비율 (%)</option>
                  </select>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={ed.feeRate}
                      onChange={(e) =>
                        setEditFeeData((prev) => ({
                          ...prev,
                          [t.id]: { ...prev[t.id], feeRate: e.target.value },
                        }))
                      }
                      placeholder={ed.feeType === "monthly" ? "월 고정액" : ed.feeType === "revenueShare" ? "비율 (예: 50)" : "회당 금액"}
                      className="border rounded-lg px-3 py-2 text-sm w-36"
                    />
                    <span className="text-xs text-slate-500">{ed.feeType === "revenueShare" ? "%" : "원"}</span>
                  </div>
                  <button
                    onClick={() => handleSaveFeeRate(t.id)}
                    disabled={savingId === t.id}
                    className="px-4 py-2 text-sm font-bold bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {savingId === t.id ? "저장 중…" : "저장"}
                  </button>
                  {teacherStudents.length > 0 && ed.feeType !== "monthly" && (
                    <button
                      onClick={() =>
                        setEditFeeData((prev) => ({
                          ...prev,
                          [t.id]: { ...prev[t.id], showOverrides: !prev[t.id]?.showOverrides },
                        }))
                      }
                      className="px-3 py-2 text-xs font-bold border rounded-lg text-slate-600 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                    >
                      학생별 단가 {ed.showOverrides ? "▲ 닫기" : "▼ 설정"}
                    </button>
                  )}
                </div>

                {/* 학생별 단가 override 섹션 */}
                {ed.showOverrides && ed.feeType !== "monthly" && (
                  <div className="border-t bg-slate-50 px-4 py-3 space-y-2">
                    <p className="text-xs text-slate-400 mb-2">
                      입력하지 않으면 위의 기본 단가가 적용됩니다. 학생별로 회당 고정 또는 원비 비율(%)을 선택할 수 있어요.
                    </p>
                    {teacherStudents.map((s) => {
                      const raw = (ed.studentFeeOverrides || {})[s.id];
                      const overrideType = (typeof raw === "object" && raw?.type) ? raw.type : "fixed";
                      const overrideVal = (typeof raw === "object" ? raw?.value : raw) ?? "";
                      const previewFee = overrideVal !== "" && Number(overrideVal) >= 0
                        ? (overrideType === "percent"
                          ? Math.round(Number(s.tuitionFee || 0) * Number(overrideVal) / 100)
                          : null)
                        : null;
                      return (
                        <div key={s.id} className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-slate-700 w-24 shrink-0">{s.name}</span>
                          <span className="text-xs text-slate-400 w-28 shrink-0">원비 {Number(s.tuitionFee || 0).toLocaleString()}원</span>
                          <select
                            value={overrideType}
                            onChange={(e) =>
                              setEditFeeData((prev) => ({
                                ...prev,
                                [t.id]: {
                                  ...prev[t.id],
                                  studentFeeOverrides: {
                                    ...(prev[t.id]?.studentFeeOverrides || {}),
                                    [s.id]: { type: e.target.value, value: overrideVal },
                                  },
                                },
                              }))
                            }
                            className="border rounded-lg px-2 py-1 text-xs"
                          >
                            <option value="fixed">회당 고정</option>
                            <option value="percent">원비 비율 (%)</option>
                          </select>
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={overrideVal}
                              onChange={(e) =>
                                setEditFeeData((prev) => ({
                                  ...prev,
                                  [t.id]: {
                                    ...prev[t.id],
                                    studentFeeOverrides: {
                                      ...(prev[t.id]?.studentFeeOverrides || {}),
                                      [s.id]: { type: overrideType, value: e.target.value },
                                    },
                                  },
                                }))
                              }
                              placeholder="기본값 사용"
                              className="border rounded-lg px-2 py-1 text-sm w-24"
                            />
                            <span className="text-xs text-slate-500">{overrideType === "percent" ? "%" : "원/회"}</span>
                          </div>
                          {previewFee !== null && (
                            <span className="text-xs text-indigo-600 font-medium">= {previewFee.toLocaleString()}원/월</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── 탭 3: 세무 자료 ── */}
      {subTab === "tax" && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border p-4 flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">연도</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                {yearOptions.map((y) => <option key={y} value={y}>{y}년</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-500 block mb-1">월</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="border rounded-lg px-3 py-2 text-sm"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleTaxExcel}
              className="flex items-center gap-2 px-4 py-2 text-sm font-bold bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <Download size={15} /> 엑셀 다운로드
            </button>
          </div>
          <p className="text-xs text-slate-400">집계 기간: {periodStart} ~ {periodEnd}</p>

          <div className="bg-white rounded-2xl border overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-4 py-3 text-left font-bold">강사명</th>
                  <th className="px-4 py-3 text-left font-bold">파트</th>
                  <th className="px-4 py-3 text-right font-bold">강사료</th>
                  <th className="px-4 py-3 text-right font-bold">소득세 (3%)</th>
                  <th className="px-4 py-3 text-right font-bold">지방소득세 (0.3%)</th>
                  <th className="px-4 py-3 text-right font-bold">실지급액</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const taxRows = teacherList
                    .map((t) => {
                      const rows2 = calcSessions(t.name);
                      const sess = rows2.reduce((s, r) => s + r.sessions, 0);
                      if (!sess) return null;
                      const gross = calcFee(t, rows2);
                      if (!gross) return null;
                      const it = Math.round(gross * 0.03);
                      const lt = Math.round(gross * 0.003);
                      return { t, gross, it, lt };
                    })
                    .filter(Boolean);
                  const sumGross = taxRows.reduce((s, r) => s + r.gross, 0);
                  const sumIt = taxRows.reduce((s, r) => s + r.it, 0);
                  const sumLt = taxRows.reduce((s, r) => s + r.lt, 0);
                  const sumNet = taxRows.reduce((s, r) => s + (r.gross - r.it - r.lt), 0);
                  return (
                    <>
                      {taxRows.map(({ t, gross, it, lt }) => (
                        <tr key={t.id} className="border-t hover:bg-slate-50 active:bg-slate-100 transition-colors">
                          <td className="px-4 py-3 font-medium">{t.name}</td>
                          <td className="px-4 py-3 text-slate-500">{t.part || "—"}</td>
                          <td className="px-4 py-3 text-right">{gross.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-rose-600">{it.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-rose-500">{lt.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right font-bold text-emerald-700">
                            {(gross - it - lt).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                      {taxRows.length > 0 && (
                        <tr className="border-t-2 border-slate-300 bg-slate-50 font-bold">
                          <td className="px-4 py-3">합  계</td>
                          <td className="px-4 py-3"></td>
                          <td className="px-4 py-3 text-right">{sumGross.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-rose-600">{sumIt.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-rose-500">{sumLt.toLocaleString()}</td>
                          <td className="px-4 py-3 text-right text-emerald-700">{sumNet.toLocaleString()}</td>
                        </tr>
                      )}
                    </>
                  );
                })()}
              </tbody>
            </table>
            {teacherList.every((t) => {
              const rows2 = calcSessions(t.name);
              const sess = rows2.reduce((s, r) => s + r.sessions, 0);
              return !sess || !calcFee(t, rows2);
            }) && (
              <div className="py-16 text-center text-slate-400 text-sm">
                해당 기간에 수업 기록이 있고 단가가 설정된 강사가 없습니다.
              </div>
            )}
          </div>
          <p className="text-xs text-slate-400">
            * 단가가 설정된 강사만 표시됩니다. 주민등록번호 등 민감 정보는 별도 입력이 필요합니다.
          </p>
        </div>
      )}

      {/* ── 급여 명세서 모달 ── */}
      {showSlip && (() => {
        const isMonthly = (currentTeacher?.feeType || "perSession") === "monthly";
        return (
          <div
            className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto"
            onClick={(e) => { if (e.target === e.currentTarget) setShowSlip(false); }}
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md my-4">
              <div className="flex items-center justify-between px-5 py-4 border-b">
                <h3 className="font-bold text-slate-800">급여 명세서 미리보기</h3>
                <button onClick={() => setShowSlip(false)} className="p-2 rounded-lg hover:bg-slate-100 active:bg-slate-200 transition-colors"><X size={20} /></button>
              </div>
              <div className="px-5 pt-4 pb-2 flex items-center gap-3">
                <label className="text-xs font-bold text-slate-500 whitespace-nowrap">지급일</label>
                <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm flex-1" />
              </div>
              {/* 캡처 대상 */}
              <div ref={slipRef} className="mx-4 mb-2 mt-3 bg-white rounded-xl overflow-hidden" style={{ fontFamily: "sans-serif" }}>
                {/* 헤더 */}
                <div style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)", padding: "24px 28px 20px" }}>
                  <div style={{ color: "#c7d2fe", fontSize: "11px", letterSpacing: "2px", marginBottom: "4px" }}>SALARY STATEMENT</div>
                  <div style={{ color: "#fff", fontSize: "20px", fontWeight: 800, marginBottom: "2px" }}>J&C 음악학원</div>
                  <div style={{ color: "#e0e7ff", fontSize: "13px", fontWeight: 600 }}>{selectedYear}년 {selectedMonth}월 급여 명세서</div>
                  <div style={{ color: "#a5b4fc", fontSize: "11px", marginTop: "6px" }}>집계 기간: {periodStart} ~ {periodEnd}</div>
                </div>
                {/* 강사 정보 */}
                <div style={{ background: "#f8fafc", padding: "16px 28px", borderBottom: "1px solid #e2e8f0" }}>
                  <div style={{ display: "flex", gap: "32px", flexWrap: "wrap" }}>
                    {[
                      ["강사명", currentTeacher?.name || selectedTeacherName],
                      ["파트", currentTeacher?.part || "—"],
                      ["지급일", payDate],
                    ].map(([k, v]) => (
                      <div key={k}>
                        <div style={{ fontSize: "10px", color: "#94a3b8", marginBottom: "2px" }}>{k}</div>
                        <div style={{ fontSize: "14px", fontWeight: 700, color: "#1e293b" }}>{v}</div>
                      </div>
                    ))}
                    {currentTeacher?.bankName && (
                      <div>
                        <div style={{ fontSize: "10px", color: "#94a3b8", marginBottom: "2px" }}>계좌번호</div>
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>{currentTeacher.bankName} {currentTeacher.bankAccount}</div>
                      </div>
                    )}
                  </div>
                </div>
                {/* 수업 내역 테이블 */}
                {!isMonthly && sessionRows.length > 0 && (
                  <div style={{ padding: "16px 28px" }}>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: "#6366f1", marginBottom: "8px", letterSpacing: "1px" }}>수업 내역</div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                      <thead>
                        <tr style={{ borderBottom: "2px solid #e2e8f0" }}>
                          {["학생명", "회차", "강사료"].map((h) => (
                            <th key={h} style={{ padding: "6px 4px", textAlign: h === "강사료" ? "right" : "left", color: "#64748b", fontWeight: 600, fontSize: "11px" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {sessionRows.map((row, i) => {
                          const rowFee = calcStudentFee(currentTeacher, row);
                          return (
                            <tr key={i} style={{ borderBottom: "1px solid #f1f5f9" }}>
                              <td style={{ padding: "5px 4px", color: "#334155" }}>{row.name}</td>
                              <td style={{ padding: "5px 4px", color: "#64748b" }}>{row.sessions}회</td>
                              <td style={{ padding: "5px 4px", textAlign: "right", color: "#334155" }}>{rowFee.toLocaleString()}원</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                {/* 급여 계산 */}
                <div style={{ background: "#f8fafc", padding: "16px 28px", borderTop: "1px solid #e2e8f0" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#6366f1", marginBottom: "10px", letterSpacing: "1px" }}>급여 계산</div>
                  {[
                    ["담당 학생 수", `${sessionRows.length}명`, "#334155", false],
                    ["총 수업 횟수", `${totalSessions}회`, "#334155", false],
                    ["강사료", `${grossFee.toLocaleString()}원`, "#1e293b", true],
                    ["소득세 (3%)", `-${Math.round(grossFee * 0.03).toLocaleString()}원`, "#dc2626", false],
                    ["지방소득세 (0.3%)", `-${Math.round(grossFee * 0.003).toLocaleString()}원`, "#dc2626", false],
                  ].map(([k, v, color, bold]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", borderBottom: "1px solid #e2e8f0" }}>
                      <span style={{ color: "#64748b", fontSize: "13px" }}>{k}</span>
                      <span style={{ color, fontWeight: bold ? 700 : 500, fontSize: "13px" }}>{v}</span>
                    </div>
                  ))}
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 4px", marginTop: "4px", borderTop: "2px solid #6366f1" }}>
                    <span style={{ fontSize: "16px", fontWeight: 800, color: "#1e293b" }}>실지급액</span>
                    <span style={{ fontSize: "18px", fontWeight: 800, color: "#059669" }}>{netFee.toLocaleString()}원</span>
                  </div>
                </div>
                {/* 하단 서명 */}
                <div style={{ padding: "14px 28px", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "12px", borderTop: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>{payDate} &nbsp; J&C 음악학원장 강열혁</span>
                  <div style={{ width: "44px", height: "44px", borderRadius: "50%", border: "2px solid #6366f1", display: "flex", alignItems: "center", justifyContent: "center", color: "#6366f1", fontSize: "11px", fontWeight: 700 }}>인</div>
                </div>
              </div>
              <div className="px-5 pb-5 pt-3">
                <button onClick={handleSaveSlipImage} className="w-full flex items-center justify-center gap-2 py-3 text-sm font-bold bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 active:bg-indigo-800 transition-colors">
                  <Download size={16} /> 이미지 저장
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── 일괄 다운로드용 화면 밖 렌더링 ── */}
      {bulkDownloadIdx >= 0 && bulkDownloadIdx < bulkTeachers.length && (() => {
        const t = bulkTeachers[bulkDownloadIdx];
        const rows = calcSessions(t.name);
        const gross = calcFee(t, rows);
        const taxAmt = Math.round(gross * 0.033);
        const net = gross - taxAmt;
        const totalSess = rows.reduce((s, r) => s + r.sessions, 0);
        const isMonthly = (t.feeType || "perSession") === "monthly";
        return (
          <div style={{ position: "fixed", left: "-9999px", top: 0, zIndex: -1 }}>
            <div ref={bulkSlipRef} style={{ width: "480px", background: "#fff", fontFamily: "sans-serif", borderRadius: "12px", overflow: "hidden" }}>
              <div style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)", padding: "24px 28px 20px" }}>
                <div style={{ color: "#c7d2fe", fontSize: "11px", letterSpacing: "2px", marginBottom: "4px" }}>SALARY STATEMENT</div>
                <div style={{ color: "#fff", fontSize: "20px", fontWeight: 800, marginBottom: "2px" }}>J&C 음악학원</div>
                <div style={{ color: "#e0e7ff", fontSize: "13px", fontWeight: 600 }}>{selectedYear}년 {selectedMonth}월 급여 명세서</div>
                <div style={{ color: "#a5b4fc", fontSize: "11px", marginTop: "6px" }}>집계 기간: {periodStart} ~ {periodEnd}</div>
              </div>
              <div style={{ background: "#f8fafc", padding: "16px 28px", borderBottom: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", gap: "32px", flexWrap: "wrap" }}>
                  {[["강사명", t.name], ["파트", t.part || "—"], ["지급일", payDate]].map(([k, v]) => (
                    <div key={k}>
                      <div style={{ fontSize: "10px", color: "#94a3b8", marginBottom: "2px" }}>{k}</div>
                      <div style={{ fontSize: "14px", fontWeight: 700, color: "#1e293b" }}>{v}</div>
                    </div>
                  ))}
                  {t.bankName && (
                    <div>
                      <div style={{ fontSize: "10px", color: "#94a3b8", marginBottom: "2px" }}>계좌번호</div>
                      <div style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>{t.bankName} {t.bankAccount}</div>
                    </div>
                  )}
                </div>
              </div>
              <div style={{ background: "#f8fafc", padding: "16px 28px", borderTop: "1px solid #e2e8f0" }}>
                {[
                  ["담당 학생 수", `${rows.length}명`, "#334155", false],
                  ["총 수업 횟수", `${totalSess}회`, "#334155", false],
                  ["강사료", `${gross.toLocaleString()}원`, "#1e293b", true],
                  ["소득세 (3%)", `-${Math.round(gross * 0.03).toLocaleString()}원`, "#dc2626", false],
                  ["지방소득세 (0.3%)", `-${Math.round(gross * 0.003).toLocaleString()}원`, "#dc2626", false],
                ].map(([k, v, color, bold]) => (
                  <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #e2e8f0" }}>
                    <span style={{ color: "#64748b", fontSize: "13px" }}>{k}</span>
                    <span style={{ color, fontWeight: bold ? 700 : 500, fontSize: "13px" }}>{v}</span>
                  </div>
                ))}
                <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 4px", marginTop: "4px", borderTop: "2px solid #6366f1" }}>
                  <span style={{ fontSize: "16px", fontWeight: 800, color: "#1e293b" }}>실지급액</span>
                  <span style={{ fontSize: "18px", fontWeight: 800, color: "#059669" }}>{net.toLocaleString()}원</span>
                </div>
              </div>
              <div style={{ padding: "14px 28px", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "12px", borderTop: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "12px", color: "#64748b" }}>{payDate} &nbsp; J&C 음악학원장 강열혁</span>
                <div style={{ width: "44px", height: "44px", borderRadius: "50%", border: "2px solid #6366f1", display: "flex", alignItems: "center", justifyContent: "center", color: "#6366f1", fontSize: "11px", fontWeight: 700 }}>인</div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// [TeacherTimetableView] - (파트필터 + 인쇄 + 보안 + 모바일최적화 + 중앙정렬/자동숨김 유지)
const TeacherTimetableView = ({ students, teachers, user }) => {
  // 1. 상태 관리
  const [selectedDay, setSelectedDay] = useState("월");
  const [viewMode, setViewMode] = useState("daily");
  const [selectedPart, setSelectedPart] = useState("전체"); // 파트 필터
  const [sheetTeacherFilter, setSheetTeacherFilter] = useState([]); // 출강표 강사 필터 (빈 배열 = 전체)
  const [sheetPartFilter, setSheetPartFilter] = useState("전체"); // 출강표 파트 필터
  const [printOrientation, setPrintOrientation] = useState("landscape"); // 출강표 인쇄 방향

  const printRef = useRef(null);

  const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
  // 운영 시간: 09:00 ~ 22:00
  const HOURS = Array.from({ length: 14 }, (_, i) => i + 9);

  // 파트 정의
  const PARTS = [
    { id: "전체", label: "전체" },
    { id: "피아노", label: "🎹 피아노" },
    { id: "관현악", label: "🎻 관현악" },
    { id: "드럼", label: "🥁 드럼" },
    { id: "기타악기", label: "🎸 기타" },
    { id: "실용", label: "🎵 실용" },
    { id: "성악", label: "🎤 성악" },
  ];

  // 과목 -> 파트 매핑
  const getPartBySubject = (subject) => {
    if (!subject) return "";
    if (subject.includes("피아노")) return "피아노";
    if (["플루트", "클라리넷", "바이올린", "첼로"].some((s) => subject.includes(s))) return "관현악";
    if (subject.includes("드럼")) return "드럼";
    if (subject.includes("기타")) return "기타악기";
    if (["베이스", "작곡"].some((s) => subject.includes(s))) return "실용";
    if (["성악", "보컬"].some((s) => subject.includes(s))) return "성악";
    return "";
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
      // 출강표는 overflow-auto 컨테이너 대신 내부 table을 직접 캡처 (가로 잘림 방지)
      const target = viewMode === "sheet"
        ? (printRef.current.querySelector("table") || printRef.current)
        : printRef.current;
      const canvas = await html2canvas(target, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      const link = document.createElement("a");
      link.href = canvas.toDataURL("image/png");
      const teacherSuffix = viewMode === "sheet" && sheetTeacherFilter.length > 0 ? `_${sheetTeacherFilter.join("_")}` : "";
      link.download = `시간표_${viewMode === "sheet" ? "출강표" : `${selectedPart}_${selectedDay}`}${teacherSuffix}.png`;
      link.click();
    } catch (err) {
      console.error(err);
      alert("저장 실패");
    }
  };

  const handlePrint = () => {
    // 출강표 인쇄 방향 동적 적용
    const styleId = "print-orientation-override";
    let el = document.getElementById(styleId);
    if (!el) { el = document.createElement("style"); el.id = styleId; document.head.appendChild(el); }
    el.textContent = printOrientation === "portrait"
      ? `@media print { @page { size: A4 portrait; margin: 6mm; } #print-sheet-root { zoom: 0.62; } }`
      : `@media print { @page { size: A4 landscape; margin: 8mm; } #print-sheet-root { zoom: 1; } }`;
    window.print();
  };

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
    if (!student.schedules && student.className === targetDay && student.time)
      return student.time;
    return null;
  };

  // 45분 수업 기준 타임라인 상수
  const LESSON_MIN = 45;
  const PX_PER_MIN = 2;            // 1분 = 2px
  const PX_PER_HOUR = 60 * PX_PER_MIN; // 120px / 시간
  const LESSON_HEIGHT = LESSON_MIN * PX_PER_MIN; // 90px
  const TL_START = 9;              // 타임라인 시작 (9시)
  const TOTAL_MINS = (22 - TL_START) * 60; // 780분

  const getEndTimeStr = (timeStr) => {
    const [h, m] = timeStr.split(":").map(Number);
    const endTotal = h * 60 + m + LESSON_MIN;
    return `${Math.floor(endTotal / 60)}:${String(endTotal % 60).padStart(2, "0")}`;
  };
  const TOTAL_HEIGHT = TOTAL_MINS * PX_PER_MIN; // 1560px

  // 특정 강사·요일의 수업 목록 (시간순)
  const getAllStudentLessons = useCallback((teacherName, day) => {
    return students
      .filter((s) => {
        if (isTeacherMode && teacherName !== myName) return false;
        if (s.teacher !== teacherName) return false;
        if (!getLessonTime(s, day)) return false;
        if (selectedPart !== "전체" && getPartBySubject(s.subject || "") !== selectedPart) return false;
        return true;
      })
      .map((s) => {
        const timeStr = getLessonTime(s, day);
        const [hour, minute] = timeStr.split(":").map(Number);
        return { student: s, timeStr, hour, minute };
      })
      .sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
  }, [students, isTeacherMode, myName, selectedPart]); // eslint-disable-line

  // 45분 수업 배정 가능한 빈 구간 계산
  const getAvailableWindows = useCallback((teacherName, day) => {
    const isWeekend = day === "토" || day === "일";
    const opStartMin = (isWeekend ? 9 : 12) * 60;
    const opEndMin = 22 * 60;
    const booked = students
      .filter((s) => s.teacher === teacherName && s.status === "재원" && getLessonTime(s, day))
      .map((s) => {
        const [h, m] = (getLessonTime(s, day)).split(":").map(Number);
        const start = h * 60 + m;
        return { start, end: start + LESSON_MIN };
      })
      .sort((a, b) => a.start - b.start);
    const windows = [];
    let cursor = opStartMin;
    for (const lesson of booked) {
      if (lesson.start > cursor && lesson.start - cursor >= LESSON_MIN) {
        windows.push({ startMin: cursor, endMin: lesson.start });
      }
      cursor = Math.max(cursor, lesson.end);
    }
    if (cursor <= opEndMin - LESSON_MIN) {
      windows.push({ startMin: cursor, endMin: opEndMin });
    }
    return windows;
  }, [students]); // eslint-disable-line

  // 수업 데이터 필터링 (파트 필터 적용)
  const getLessons = (teacherName, day, hour) => {
    return students
      .filter((s) => {
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
      })
      .sort((a, b) => {
        // 같은 시간대 내 분(minute) 기준 오름차순 정렬
        const tA = getLessonTime(a, day) || "99:99";
        const tB = getLessonTime(b, day) || "99:99";
        return tA.localeCompare(tB);
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

  // 모바일 전용: 타임라인 그리드 대신 세로 리스트(아젠다)로 표시 — 좁은 화면에서 컬럼이 눌려 글씨가 작아지는 문제 방지
  const renderMobileAgendaCard = (key, label, lessons, windows, highlight) => (
    <div
      key={key}
      className={`rounded-xl border overflow-hidden ${
        highlight ? "border-indigo-300 ring-1 ring-indigo-200" : "border-slate-200"
      }`}
    >
      <div
        className={`px-3 py-2 font-bold text-sm ${
          highlight ? "bg-indigo-50 text-indigo-700" : "bg-slate-50 text-slate-700"
        }`}
      >
        {label}
      </div>
      <div className="divide-y divide-slate-100 bg-white">
        {lessons.length === 0 && windows.length === 0 && (
          <div className="px-3 py-3 text-center text-slate-400 text-sm">수업 없음</div>
        )}
        {lessons.map((l, li) => (
          <div
            key={`l-${li}`}
            className={`px-3 py-2 flex items-center justify-between gap-2 text-sm border-l-4 ${getSubjectColor(l.student.subject)}`}
          >
            <span className="font-semibold text-slate-800 truncate">
              {l.student.subject || l.student.name}
            </span>
            <span className="font-bold text-slate-500 text-xs whitespace-nowrap">
              {l.timeStr} ~ {getEndTimeStr(l.timeStr)}
            </span>
          </div>
        ))}
        {windows.map(({ startMin, endMin }, wi) => {
          const sH = Math.floor(startMin / 60), sM = startMin % 60;
          const eH = Math.floor(endMin / 60), eM = endMin % 60;
          return (
            <div
              key={`w-${wi}`}
              className="px-3 py-2 flex items-center justify-between gap-2 text-sm bg-emerald-50"
            >
              <span className="font-bold text-emerald-600 text-xs">▸ 신규배정 가능</span>
              <span className="font-bold text-emerald-500 text-xs whitespace-nowrap">
                {sH}:{String(sM).padStart(2, "0")} ~ {eH}:{String(eM).padStart(2, "0")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

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
              className="p-2 rounded-lg border hover:bg-slate-50 active:bg-slate-100 text-slate-500 shadow-sm"
              title="이미지 저장"
            >
              <Download size={18} />
            </button>
            <button
              onClick={handlePrint}
              className="p-2 rounded-lg border hover:bg-slate-50 active:bg-slate-100 text-slate-500 shadow-sm"
              title="출력하기"
            >
              <Printer size={18} />
            </button>
          </div>
        </div>

        {/* 2열: 파트 필터 & 보기 모드 & 요일 선택 */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-slate-50/50 p-2 rounded-xl border border-slate-100">
          {/* 출강표 모드: 파트 필터 + 강사 멀티 선택 */}
          {viewMode === "sheet" && !isTeacherMode && (() => {
            const availTeachers = teachers.filter((t) => {
              const hasStudent = students.some((s) => s.teacher === t.name && s.status === "재원");
              if (!hasStudent) return false;
              if (sheetPartFilter !== "전체") {
                return students.some((s) => s.teacher === t.name && s.status === "재원" && getPartBySubject(s.subject) === sheetPartFilter);
              }
              return true;
            });
            const toggle = (name) =>
              setSheetTeacherFilter((prev) =>
                prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]
              );
            return (
              <div className="flex flex-col gap-2 w-full">
                {/* 파트 필터 행 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-500 font-medium whitespace-nowrap">파트</span>
                  {PARTS.map((part) => (
                    <button
                      key={part.id}
                      onClick={() => { setSheetPartFilter(part.id); setSheetTeacherFilter([]); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                        sheetPartFilter === part.id
                          ? "bg-indigo-600 text-white border-indigo-600"
                          : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {part.label}
                    </button>
                  ))}
                  <span className="text-slate-200 mx-1">|</span>
                  <span className="text-xs text-slate-500 font-medium whitespace-nowrap">용지</span>
                  <div className="flex bg-white border border-slate-200 p-0.5 rounded-lg">
                    <button
                      onClick={() => setPrintOrientation("landscape")}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${printOrientation === "landscape" ? "bg-slate-100 text-indigo-600" : "text-slate-400 hover:text-slate-600"}`}
                      title="A4 가로 출력"
                    >가로</button>
                    <button
                      onClick={() => setPrintOrientation("portrait")}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${printOrientation === "portrait" ? "bg-slate-100 text-indigo-600" : "text-slate-400 hover:text-slate-600"}`}
                      title="A4 세로 출력"
                    >세로</button>
                  </div>
                </div>
                {/* 강사 선택 행 */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-500 font-medium whitespace-nowrap">강사</span>
                  <button
                    onClick={() => setSheetTeacherFilter([])}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      sheetTeacherFilter.length === 0
                        ? "bg-slate-700 text-white border-slate-700"
                        : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    전체
                  </button>
                  {availTeachers.map((t) => (
                    <button
                      key={t.name}
                      onClick={() => toggle(t.name)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                        sheetTeacherFilter.includes(t.name)
                          ? "bg-slate-700 text-white border-slate-700"
                          : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                      }`}
                    >
                      {t.name} T
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* 파트 선택 버튼들 (출강표 모드에서는 숨김) */}
          {viewMode !== "sheet" && (
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
          )}

          <div className="flex gap-2 w-full md:w-auto justify-end">
            {/* 보기 모드 (관리자: 출강표/요일, 강사: 오늘/주간) */}
            <div className="flex bg-white border border-slate-200 p-1 rounded-lg">
              {isTeacherMode ? (
                <>
                  <button onClick={() => setViewMode("daily")} className={`px-3 py-1.5 rounded-md text-xs font-bold ${viewMode === "daily" ? "bg-slate-100 text-indigo-600" : "text-slate-400"}`}>오늘</button>
                  <button onClick={() => setViewMode("weekly")} className={`px-3 py-1.5 rounded-md text-xs font-bold ${viewMode === "weekly" ? "bg-slate-100 text-indigo-600" : "text-slate-400"}`}>주간</button>
                </>
              ) : (
                <>
                  <button onClick={() => setViewMode("daily")} className={`px-3 py-1.5 rounded-md text-xs font-bold ${viewMode === "daily" ? "bg-slate-100 text-indigo-600" : "text-slate-400"}`}>요일별</button>
                  <button onClick={() => setViewMode("sheet")} className={`px-3 py-1.5 rounded-md text-xs font-bold ${viewMode === "sheet" ? "bg-slate-100 text-indigo-600" : "text-slate-400"}`}>출강표</button>
                </>
              )}
            </div>

            {/* 요일 선택 (관리자 or 강사 일간모드) */}
            {viewMode !== "sheet" && (!isTeacherMode || (isTeacherMode && viewMode === "daily")) && (
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
      {viewMode !== "sheet" && (
      <div
        className="flex-1 overflow-auto border rounded-xl bg-slate-50/50 relative print:overflow-visible print:bg-white print:border-none"
        ref={printRef}
      >
        <div className="hidden md:inline-block min-w-full pb-20 print:inline-block">
          {/* 헤더 */}
          <div className="flex border-b bg-white sticky top-0 z-10 shadow-sm print:static print:shadow-none print:border-slate-300">
            <div className="w-[50px] md:w-[80px] p-2 md:p-4 text-center text-xs md:text-xs font-bold text-slate-400 border-r bg-slate-50 sticky left-0 z-20 shrink-0 flex items-center justify-center print:bg-white print:border-slate-300">
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

          {/* 바디 — 45분 절대좌표 타임라인 */}
          <div className="flex" style={{ height: TOTAL_HEIGHT }}>
            {/* 시간축 */}
            <div
              className="w-[50px] md:w-[80px] border-r bg-white sticky left-0 z-10 shrink-0 print:static print:border-slate-300"
              style={{ position: "relative", height: TOTAL_HEIGHT }}
            >
              {HOURS.map((hour, i) => (
                <React.Fragment key={hour}>
                  <div
                    style={{ position: "absolute", top: i * PX_PER_HOUR, left: 0, right: 0 }}
                    className="border-t border-slate-200 print:border-slate-300"
                  />
                  <div
                    style={{ position: "absolute", top: i * PX_PER_HOUR + 2, left: 0, right: 0 }}
                    className="pl-1 md:pl-2 text-[9px] md:text-xs font-bold text-slate-400"
                  >
                    {hour}:00
                  </div>
                </React.Fragment>
              ))}
            </div>

            {/* 강사/요일 컬럼 */}
            {isTeacherMode && viewMode === "weekly" ? (
              /* 강사 주간 보기 */
              <div className="flex flex-1 min-w-max">
                {DAYS.map((day) => {
                  const isWeekend = day === "토" || day === "일";
                  const preOpShadeEnd = isWeekend ? 0 : (10 - TL_START) * 60;
                  const consultStart = isWeekend ? null : (10 - TL_START) * 60;
                  const consultEnd = isWeekend ? null : (12 - TL_START) * 60;
                  const opEndMin = (22 - TL_START) * 60;
                  const lessons = getAllStudentLessons(myName, day);
                  const windows = getAvailableWindows(myName, day);
                  return (
                    <div
                      key={day}
                      className={`flex-1 min-w-[100px] md:min-w-[140px] border-r shrink-0 print:border-slate-300 ${selectedDay === day ? "bg-indigo-50/20" : "bg-white"}`}
                      style={{ position: "relative", height: TOTAL_HEIGHT }}
                    >
                      {/* 비운영 음영 (평일 9:00-10:00) */}
                      {preOpShadeEnd > 0 && (
                        <div style={{ position: "absolute", top: 0, height: preOpShadeEnd * PX_PER_MIN, left: 0, right: 0 }} className="bg-slate-100/70 print:bg-transparent" />
                      )}
                      {/* 상담가능 구간 (평일 10:00-12:00) */}
                      {consultStart !== null && (
                        <div style={{ position: "absolute", top: consultStart * PX_PER_MIN, height: (consultEnd - consultStart) * PX_PER_MIN, left: 1, right: 1, zIndex: 1 }} className="bg-amber-50 border border-amber-200 rounded print:bg-transparent">
                          <div className="px-1.5 pt-1 leading-tight">
                            <div className="text-[9px] md:text-xs font-extrabold text-amber-600">상담가능</div>
                            <div className="text-[8px] md:text-[9px] font-bold text-amber-500">10:00 ~ 12:00</div>
                          </div>
                        </div>
                      )}
                      <div style={{ position: "absolute", top: opEndMin * PX_PER_MIN, height: (TOTAL_MINS - opEndMin) * PX_PER_MIN, left: 0, right: 0 }} className="bg-slate-100/70 print:bg-transparent" />
                      {/* 시간 그리드 */}
                      {HOURS.map((_, i) => (
                        <div key={i} style={{ position: "absolute", top: i * PX_PER_HOUR, left: 0, right: 0 }} className="border-t border-slate-200 print:border-slate-300" />
                      ))}
                      {/* 30분 보조선 */}
                      {HOURS.map((_, i) => (
                        <div key={`h-${i}`} style={{ position: "absolute", top: i * PX_PER_HOUR + 60, left: 0, right: 0 }} className="border-t border-dashed border-slate-100" />
                      ))}
                      {/* 배정 가능 구간 */}
                      {windows.map(({ startMin, endMin }, wi) => {
                        const sH = Math.floor(startMin / 60), sM = startMin % 60;
                        const eH = Math.floor(endMin / 60), eM = endMin % 60;
                        return (
                          <div key={wi} style={{ position: "absolute", top: (startMin - TL_START * 60) * PX_PER_MIN, height: (endMin - startMin) * PX_PER_MIN, left: 1, right: 1, zIndex: 1 }} className="bg-emerald-50 border border-emerald-200 rounded print:bg-transparent">
                            <div className="px-1.5 pt-1 leading-tight">
                              <div className="text-[9px] md:text-xs font-extrabold text-emerald-600">수강 가능</div>
                              <div className="text-[8px] md:text-[9px] font-bold text-emerald-500">{sH}:{String(sM).padStart(2,"0")} ~ {eH}:{String(eM).padStart(2,"0")}</div>
                            </div>
                          </div>
                        );
                      })}
                      {/* 수업 카드 */}
                      {lessons.map((l, li) => (
                        <div
                          key={li}
                          style={{ position: "absolute", top: (l.hour * 60 + l.minute - TL_START * 60) * PX_PER_MIN, height: LESSON_HEIGHT - 2, left: 2, right: 2, zIndex: 2 }}
                          className={`rounded-lg border text-[9px] md:text-xs shadow-sm overflow-hidden px-1.5 py-0.5 print:border-slate-400 ${getSubjectColor(l.student.subject)}`}
                        >
                          <div className="font-semibold truncate">{l.student.subject || l.student.name}</div>
                          <div className="font-bold">{l.timeStr} ~ {getEndTimeStr(l.timeStr)}</div>
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ) : (
              /* 관리자/강사 일간 보기 */
              <div className="flex flex-1 justify-center min-w-max">
                {activeTeachers.length > 0 ? (
                  activeTeachers.map((t) => {
                    const targetName = isTeacherMode ? myName : t.name;
                    const isWeekend = selectedDay === "토" || selectedDay === "일";
                    const preOpShadeEnd = isWeekend ? 0 : (10 - TL_START) * 60;
                    const consultStart = isWeekend ? null : (10 - TL_START) * 60;
                    const consultEnd = isWeekend ? null : (12 - TL_START) * 60;
                    const opEndMin = (22 - TL_START) * 60;
                    const lessons = getAllStudentLessons(targetName, selectedDay);
                    const windows = getAvailableWindows(targetName, selectedDay);
                    return (
                      <div
                        key={t.id}
                        className={`${isTeacherMode ? "flex-1 min-w-[200px]" : "w-[120px] md:w-[160px]"} border-r shrink-0 bg-white print:border-slate-300`}
                        style={{ position: "relative", height: TOTAL_HEIGHT }}
                      >
                        {/* 비운영 음영 (평일 9:00-10:00) */}
                        {preOpShadeEnd > 0 && (
                          <div style={{ position: "absolute", top: 0, height: preOpShadeEnd * PX_PER_MIN, left: 0, right: 0 }} className="bg-slate-100/70 print:bg-transparent" />
                        )}
                        {/* 상담가능 구간 (평일 10:00-12:00) */}
                        {consultStart !== null && (
                          <div style={{ position: "absolute", top: consultStart * PX_PER_MIN, height: (consultEnd - consultStart) * PX_PER_MIN, left: 1, right: 1, zIndex: 1 }} className="bg-amber-50 border border-amber-200 rounded print:bg-transparent">
                            <div className="px-1.5 pt-1 leading-tight">
                              <div className="text-[9px] md:text-[11px] font-extrabold text-amber-600">상담가능</div>
                              <div className="text-[8px] md:text-xs font-bold text-amber-500">10:00 ~ 12:00</div>
                            </div>
                          </div>
                        )}
                        <div style={{ position: "absolute", top: opEndMin * PX_PER_MIN, height: (TOTAL_MINS - opEndMin) * PX_PER_MIN, left: 0, right: 0 }} className="bg-slate-100/70 print:bg-transparent" />
                        {/* 시간 그리드 */}
                        {HOURS.map((_, i) => (
                          <div key={i} style={{ position: "absolute", top: i * PX_PER_HOUR, left: 0, right: 0 }} className="border-t border-slate-200 print:border-slate-300" />
                        ))}
                        {/* 30분 보조선 */}
                        {HOURS.map((_, i) => (
                          <div key={`h-${i}`} style={{ position: "absolute", top: i * PX_PER_HOUR + 60, left: 0, right: 0 }} className="border-t border-dashed border-slate-100" />
                        ))}
                        {/* 배정 가능 구간 */}
                        {windows.map(({ startMin, endMin }, wi) => {
                          const sH = Math.floor(startMin / 60), sM = startMin % 60;
                          const eH = Math.floor(endMin / 60), eM = endMin % 60;
                          return (
                          <div key={wi} style={{ position: "absolute", top: (startMin - TL_START * 60) * PX_PER_MIN, height: (endMin - startMin) * PX_PER_MIN, left: 1, right: 1, zIndex: 1 }} className="bg-emerald-50 border border-emerald-200 rounded print:bg-transparent">
                            <div className="px-1.5 pt-1 leading-tight">
                              <div className="text-[9px] md:text-[11px] font-extrabold text-emerald-600">수강 가능</div>
                              <div className="text-[8px] md:text-xs font-bold text-emerald-500">{sH}:{String(sM).padStart(2,"0")} ~ {eH}:{String(eM).padStart(2,"0")}</div>
                            </div>
                          </div>
                          );
                        })}
                        {/* 수업 카드 */}
                        {lessons.map((l, li) => (
                          <div
                            key={li}
                            style={{ position: "absolute", top: (l.hour * 60 + l.minute - TL_START * 60) * PX_PER_MIN, height: LESSON_HEIGHT - 2, left: 2, right: 2, zIndex: 2 }}
                            className={`rounded-lg border shadow-sm text-xs md:text-xs overflow-hidden print:border-slate-400 print:shadow-none ${getSubjectColor(l.student.subject)}`}
                          >
                            <div className="px-1.5 py-1">
                              <div className="font-semibold truncate">{l.student.subject || l.student.name}</div>
                              <div className="font-bold text-xs">{l.timeStr} ~ {getEndTimeStr(l.timeStr)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })
                ) : (
                  <div className="flex-1 flex justify-center pt-20 text-slate-400 text-sm">
                    {selectedPart === "전체"
                      ? `📅 ${selectedDay}요일 수업 없음`
                      : `🔍 [${selectedPart}] 파트 수업 없음`}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 모바일: 리스트형 아젠다 뷰 */}
        <div className="md:hidden print:hidden p-3 space-y-3">
          {isTeacherMode && viewMode === "weekly"
            ? DAYS.map((day) =>
                renderMobileAgendaCard(
                  day,
                  `${day}요일`,
                  getAllStudentLessons(myName, day),
                  getAvailableWindows(myName, day),
                  selectedDay === day
                )
              )
            : activeTeachers.length > 0
            ? activeTeachers.map((t) => {
                const targetName = isTeacherMode ? myName : t.name;
                return renderMobileAgendaCard(
                  t.id,
                  isTeacherMode ? `${selectedDay}요일` : `${t.name} T`,
                  getAllStudentLessons(targetName, selectedDay),
                  getAvailableWindows(targetName, selectedDay),
                  false
                );
              })
            : (
              <div className="text-center text-slate-400 text-sm py-10">
                {selectedPart === "전체"
                  ? `📅 ${selectedDay}요일 수업 없음`
                  : `🔍 [${selectedPart}] 파트 수업 없음`}
              </div>
            )}
        </div>
      </div>
      )}

      {/* ── 출강표 뷰 (강사별 매트릭스 테이블) ──────────────────── */}
      {viewMode === "sheet" && !isTeacherMode && (() => {
        const SHEET_DAYS = ["월", "화", "수", "목", "금", "토", "일"];
        const toMin = (t) => {
          if (!t || !t.includes(":")) return NaN;
          const [h, m] = t.split(":").map(Number);
          return h * 60 + m;
        };

        // 재원 학생이 있는 강사 + 강사 필터 + 파트 필터 적용
        const sheetTeachers = teachers.filter((t) => {
          if (sheetTeacherFilter.length > 0 && !sheetTeacherFilter.includes(t.name)) return false;
          return students.some((s) => {
            if (s.teacher !== t.name || s.status !== "재원") return false;
            if (!SHEET_DAYS.some((d) => getLessonTime(s, d))) return false;
            if (sheetPartFilter !== "전체" && getPartBySubject(s.subject) !== sheetPartFilter) return false;
            return true;
          });
        });

        // 강사·요일별 수업 목록 (시간순, 파트 필터 적용)
        const getCell = (teacherName, day) =>
          students
            .filter((s) => {
              if (s.teacher !== teacherName || s.status !== "재원") return false;
              if (!getLessonTime(s, day)) return false;
              if (sheetPartFilter !== "전체" && getPartBySubject(s.subject) !== sheetPartFilter) return false;
              return true;
            })
            .map((s) => ({ name: s.name, min: toMin(getLessonTime(s, day)) }))
            .filter((x) => !isNaN(x.min))
            .sort((a, b) => a.min - b.min);

        if (sheetTeachers.length === 0) {
          return (
            <div ref={printRef} className="flex-1 flex items-center justify-center text-slate-400 text-sm">
              재원 학생이 배정된 강사가 없습니다.
            </div>
          );
        }

        return (
          <div ref={printRef} id="print-sheet-root" className="flex-1 overflow-auto p-4 bg-white">
            <table className="w-full text-sm border-collapse min-w-[600px]" style={{ tableLayout: "fixed" }}>
              <thead>
                <tr className="bg-slate-100">
                  <th className="border border-slate-300 px-3 py-2.5 text-center font-bold text-slate-600 text-sm print:text-base" style={{ width: "80px" }}>강사</th>
                  {SHEET_DAYS.map((day) => (
                    <th
                      key={day}
                      style={{ width: `calc((100% - 80px) / 7)` }}
                      className={`border border-slate-300 px-2 py-2.5 text-center font-bold text-sm print:text-base ${
                        day === "일" ? "text-rose-600" : day === "토" ? "text-blue-600" : "text-slate-700"
                      }`}
                    >
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sheetTeachers.map((teacher, ti) => (
                  <tr key={teacher.name} className={ti % 2 === 0 ? "bg-white" : "bg-slate-50/60"}>
                    <td className="border border-slate-300 px-3 py-2 text-center font-bold text-slate-700 text-sm print:text-base whitespace-nowrap align-middle bg-slate-50">
                      {teacher.name} T
                    </td>
                    {SHEET_DAYS.map((day) => {
                      const lessons = getCell(teacher.name, day);
                      const items = [];
                      lessons.forEach((l, i) => {
                        if (i > 0) {
                          const prevEnd = lessons[i - 1].min + LESSON_MIN;
                          const gap = l.min - prevEnd;
                          if (gap >= 45) {
                            const fmt = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
                            items.push(
                              <div key={`gap-${i}`} className="flex items-center gap-1 my-0.5 px-1 py-0.5 rounded bg-emerald-50 border border-emerald-200 whitespace-nowrap print:hidden">
                                <span className="text-emerald-600 text-[9px] font-bold">▸ 신규배정 가능</span>
                                <span className="text-emerald-500 text-[9px] tabular-nums">{fmt(prevEnd)}~{fmt(l.min)}</span>
                              </div>
                            );
                          }
                        }
                        items.push(
                          <div key={i} className="flex items-baseline gap-1 py-0.5 print:py-1 whitespace-nowrap">
                            <span className="text-slate-400 tabular-nums text-xs leading-snug print:text-sm">
                              {String(Math.floor(l.min / 60)).padStart(2, "0")}:{String(l.min % 60).padStart(2, "0")}
                            </span>
                            <span className="font-medium text-slate-800 text-sm print:text-base print:font-semibold">{l.name}</span>
                          </div>
                        );
                      });
                      return (
                        <td key={day} className="border border-slate-300 px-2 py-1.5 align-top">
                          {items}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })()}
    </div>
  );

};

// [SubjectTimetableView] - 과목별 수업 시간표 (2줄 압축형)
const SubjectTimetableView = ({ students, showToast }) => {
  const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
  const LESSON_MIN = 45;
  const TL_E = 22 * 60;

  const toMin = (t) => {
    if (!t || typeof t !== "string" || !t.includes(":")) return NaN;
    const [h, m] = t.split(":").map(Number);
    return isNaN(h) || isNaN(m) ? NaN : h * 60 + m;
  };
  const toStr = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, "0")}`;
  const getOpStart = (day) => (day === "토" || day === "일") ? 9 * 60 : 12 * 60;

  const subjectScheduleMap = useMemo(() => {
    const map = {};
    students
      .filter((s) => s.status === "재원" && s.subject)
      .forEach((s) => {
        if (!map[s.subject]) map[s.subject] = {};
        DAYS.forEach((day) => {
          const t = s.schedules?.[day] || (s.className === day ? s.time : null);
          if (t) {
            if (!map[s.subject][day]) map[s.subject][day] = new Set();
            map[s.subject][day].add(t);
          }
        });
      });
    return map;
  }, [students]); // eslint-disable-line

  const subjectList = Object.keys(subjectScheduleMap).sort();

  // 수업 시간 + 수강가능 슬롯 계산 (연속 수업은 병합)
  const getCellInfo = (subject, day) => {
    const times = subjectScheduleMap[subject]?.[day];
    if (!times || times.size === 0) return null;
    const opStart = getOpStart(day);
    const lessonMins = Array.from(times).map(toMin).filter((n) => !isNaN(n)).sort((a, b) => a - b);
    if (!lessonMins.length) return null;

    // 연속 수업 병합
    const lessonBlocks = [];
    let bs = lessonMins[0], be = lessonMins[0] + LESSON_MIN;
    for (let i = 1; i < lessonMins.length; i++) {
      if (lessonMins[i] === be) { be = lessonMins[i] + LESSON_MIN; }
      else { lessonBlocks.push({ s: bs, e: be }); bs = lessonMins[i]; be = lessonMins[i] + LESSON_MIN; }
    }
    lessonBlocks.push({ s: bs, e: be });

    // 수강가능 슬롯 (opStart~22:00 내 공강 구간을 45분 단위로)
    const availSlots = [];
    let cursor = opStart;
    for (const lb of lessonBlocks) {
      let t = cursor;
      while (t + LESSON_MIN <= lb.s) { availSlots.push(t); t += LESSON_MIN; }
      cursor = Math.max(cursor, lb.e);
    }
    let t = cursor;
    while (t + LESSON_MIN <= TL_E) { availSlots.push(t); t += LESSON_MIN; }

    return { lessonBlocks, availSlots };
  };

  const subjectBg = (subject) => {
    const map = {
      피아노:  { bg: "bg-indigo-500", light: "bg-indigo-50",  text: "text-indigo-700",  border: "border-indigo-200"  },
      바이올린: { bg: "bg-fuchsia-500", light: "bg-fuchsia-50", text: "text-fuchsia-700", border: "border-fuchsia-200" },
      플루트:  { bg: "bg-emerald-500", light: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
      첼로:   { bg: "bg-amber-500",   light: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200"   },
      성악:   { bg: "bg-rose-500",    light: "bg-rose-50",    text: "text-rose-700",    border: "border-rose-200"    },
      기타:   { bg: "bg-sky-500",     light: "bg-sky-50",     text: "text-sky-700",     border: "border-sky-200"     },
      드럼:   { bg: "bg-slate-500",   light: "bg-slate-50",   text: "text-slate-700",   border: "border-slate-200"   },
    };
    return map[subject] || { bg: "bg-gray-400", light: "bg-gray-50", text: "text-gray-700", border: "border-gray-200" };
  };

  const printRef = useRef(null);
  const handleDownloadImage = async () => {
    if (!printRef.current) return;
    try {
      const canvas = await html2canvas(printRef.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const link = document.createElement("a");
      link.download = "과목별시간표.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
      showToast("이미지가 저장되었습니다!", "success");
    } catch {
      showToast("이미지 저장에 실패했습니다.", "error");
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 h-full flex flex-col overflow-hidden animate-fade-in">
      <div className="flex justify-between items-center mb-4 shrink-0">
        <h2 className="text-lg font-bold flex items-center text-slate-800">
          <BookOpen className="mr-2 text-indigo-600" /> 과목별 수업 시간표
        </h2>
        <button
          onClick={handleDownloadImage}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold rounded-lg shadow-md flex items-center transition-colors"
        >
          <Download size={16} className="mr-2" /> 이미지 저장
        </button>
      </div>

      {subjectList.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
          등록된 수업 정보가 없습니다.
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <div ref={printRef} className="bg-white p-3 min-w-[600px]">
            <div className="text-center mb-4">
              <p className="text-base font-bold text-slate-800">J&C 음악학원 수업 시간표</p>
              <p className="text-xs text-slate-400 mt-0.5">상담 문의: 010-4028-9803</p>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              {/* 요일 헤더 */}
              <div className="grid bg-slate-50 border-b border-slate-200" style={{ gridTemplateColumns: "100px repeat(7, 1fr)" }}>
                <div className="px-3 py-2.5 text-[11px] text-slate-400 border-r border-slate-200">과목</div>
                {DAYS.map((day) => (
                  <div key={day} className={`py-2.5 text-center text-xs font-bold border-r last:border-r-0 border-slate-200 ${day === "일" ? "text-rose-500" : day === "토" ? "text-blue-500" : "text-slate-600"}`}>
                    {day}
                  </div>
                ))}
              </div>

              {/* 과목 행 */}
              {subjectList.map((subject, si) => {
                const colors = subjectBg(subject);
                return (
                  <div
                    key={subject}
                    className={`grid ${si > 0 ? "border-t border-slate-200" : ""}`}
                    style={{ gridTemplateColumns: "100px repeat(7, 1fr)" }}
                  >
                    {/* 과목명 */}
                    <div className={`flex items-center gap-2 px-3 py-3 border-r border-slate-200 ${colors.light}`}>
                      <div className={`w-2 h-2 rounded-full ${colors.bg} shrink-0`} />
                      <span className={`font-bold text-xs ${colors.text}`}>{subject}</span>
                    </div>

                    {/* 요일별 셀 */}
                    {DAYS.map((day) => {
                      const info = getCellInfo(subject, day);
                      if (!info) return (
                        <div key={day} className="border-r last:border-r-0 border-slate-200 flex items-center justify-center py-3">
                          <span className="text-slate-200 text-base">—</span>
                        </div>
                      );
                      const { lessonBlocks, availSlots } = info;
                      return (
                        <div key={day} className="border-r last:border-r-0 border-slate-200 px-1.5 py-2 flex flex-col gap-1">
                          {/* 수업 시간 태그들 */}
                          <div className="flex flex-wrap gap-0.5">
                            {lessonBlocks.map((lb) => (
                              <span
                                key={lb.s}
                                className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold ${colors.light} ${colors.text} border ${colors.border}`}
                              >
                                {toStr(lb.s)}~{toStr(lb.e)}
                              </span>
                            ))}
                          </div>
                          {/* 수강가능 슬롯 요약 */}
                          {availSlots.length > 0 && (
                            <div className="flex flex-wrap gap-0.5">
                              {availSlots.slice(0, 3).map((t) => (
                                <span key={t} className="inline-block px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-200">
                                  {toStr(t)}
                                </span>
                              ))}
                              {availSlots.length > 3 && (
                                <span className="inline-block px-1.5 py-0.5 rounded text-[9px] text-emerald-500 bg-emerald-50 border border-emerald-100">
                                  +{availSlots.length - 3}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* 범례 */}
            <div className="flex items-center gap-4 mt-3 justify-center">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-indigo-50 border border-indigo-200" />
                <span className="text-xs text-slate-500">수업 시간</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200" />
                <span className="text-xs text-slate-500">수강신청 가능 시간</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
