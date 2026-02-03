import React, { useState, useEffect, useMemo, useCallback } from "react";
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
} from "lucide-react";

// =================================================================
// 1. Firebase 설정 및 전역 변수 고정 (에러 방지용)
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

// [주의] 이 변수들은 반드시 initializeApp 이후에 참조되어야 합니다.
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const APP_ID = "jnc-music-v2"; // let 대신 const로 고정

console.log("✅ 시스템이 정상적으로 로드되었습니다.");

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
// 4. 모달 및 팝업 컴포넌트
// =================================================================

// [LoginModal]
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

  const handleTeacherLoginSubmit = () => {
    const dbPassword = selectedTeacherForLogin.password;
    const hardcodedPassword = TEACHER_PASSWORDS[selectedTeacherForLogin.name];
    const correctPassword = dbPassword || hardcodedPassword;

    if (!correctPassword) {
      showToast("비밀번호가 설정되지 않은 강사입니다.", "error");
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

// [EditTeacherModal]
const EditTeacherModal = ({ teacher, students, onClose, onSave }) => {
  const [name, setName] = useState(teacher.name);
  const [password, setPassword] = useState(teacher.password || "");
  const [selectedDays, setSelectedDays] = useState(teacher.days || []);

  const assignedStudents = useMemo(() => {
    return students.filter(
      (s) => s.teacher === teacher.name && s.status === "재원"
    );
  }, [students, teacher.name]);

  const toggleDay = (dayId) => {
    if (selectedDays.includes(dayId))
      setSelectedDays(selectedDays.filter((d) => d !== dayId));
    else setSelectedDays([...selectedDays, dayId]);
  };

  const handleSave = () => {
    onSave(teacher.id, {
      name,
      password,
      days: selectedDays,
      oldName: teacher.name,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-slate-800">강사 정보 수정</h2>
          <button onClick={onClose}>
            <X size={24} className="text-slate-400" />
          </button>
        </div>
        <div className="space-y-5 overflow-y-auto flex-1 p-1">
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">
              강사 이름
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 border rounded-lg focus:outline-indigo-500 font-bold text-slate-800"
            />
            {name !== teacher.name && (
              <p className="text-xs text-rose-500 mt-1">
                ⚠️ 이름을 변경하면 담당 학생들의 선생님 정보도 자동으로
                변경됩니다.
              </p>
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1 flex items-center">
              <Lock size={12} className="mr-1" /> 로그인 비밀번호
            </label>
            <input
              type="text"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="변경할 비밀번호 입력"
              className="w-full p-2 border rounded-lg focus:outline-indigo-500 text-sm"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              비워두면 기존 비밀번호가 유지됩니다.
            </p>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2">
              수업 요일
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
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-2">
              배정된 학생 ({assignedStudents.length}명)
            </label>
            <div className="bg-slate-50 rounded-lg p-2 max-h-32 overflow-y-auto border border-slate-200">
              {assignedStudents.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {assignedStudents.map((s) => (
                    <span
                      key={s.id}
                      className="text-xs bg-white border px-2 py-1 rounded text-slate-600"
                    >
                      {s.name} (
                      {s.classDays ? s.classDays.join(",") : s.className})
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 text-center py-2">
                  배정된 학생이 없습니다.
                </p>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={handleSave}
          className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 mt-6 shadow-md"
        >
          저장하기
        </button>
      </div>
    </div>
  );
};

// [StudentEditModal]
const StudentEditModal = ({ student, teachers, onClose, onUpdate, user }) => {
  const [formData, setFormData] = useState({
    ...student,
    schedules:
      student.schedules ||
      (student.className ? { [student.className]: student.time || "" } : {}),
    classDays:
      student.classDays || (student.className ? [student.className] : []),
    totalSessions: student.totalSessions || 4,
  });
  const isAdmin = user.role === "admin";

  const toggleDay = (day) => {
    const currentSchedules = { ...formData.schedules };
    if (currentSchedules[day] !== undefined) {
      delete currentSchedules[day];
    } else {
      currentSchedules[day] = "";
    }
    const days = Object.keys(currentSchedules);
    setFormData({
      ...formData,
      schedules: currentSchedules,
      classDays: days,
      className: days[0] || "",
      time: days.length > 0 ? currentSchedules[days[0]] || "" : "",
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
    const days = Object.keys(formData.schedules);
    const className = days.length > 0 ? days[0] : "";
    const time = days.length > 0 ? formData.schedules[days[0]] || "" : "";

    const cleanSchedules = { ...formData.schedules };
    Object.keys(cleanSchedules).forEach((key) => {
      if (cleanSchedules[key] === undefined) cleanSchedules[key] = "";
    });

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
              <label className="block text-xs font-bold text-slate-500 mb-1">
                총 수업 횟수 (1세트)
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
                <option value={4}>4회 (기본)</option>
                <option value={8}>8회</option>
                <option value={12}>12회</option>
              </select>
            </div>
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
              <label className="block text-xs font-bold text-slate-500 mb-2">
                수업 요일 및 시간
              </label>
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

  // 4회 or 8회 단위 설정
  const SESSION_UNIT = parseInt(student.totalSessions) || 4;

  const { historyRows, nextSessionStartIndex, currentStatus } = useMemo(() => {
    const allAttendance = [...(student.attendanceHistory || [])]
      .filter((h) => h.status === "present")
      .sort((a, b) => a.date.localeCompare(b.date));

    const sortedPayments = [...(student.paymentHistory || [])].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    const rows = sortedPayments.map((payment, index) => {
      const startIndex = index * SESSION_UNIT;
      const endIndex = startIndex + SESSION_UNIT;
      const matchedSessions = allAttendance.slice(startIndex, endIndex);

      return {
        payment: payment,
        sessions: matchedSessions,
        isFull: matchedSessions.length === SESSION_UNIT,
      };
    });

    const totalPaidSessions = sortedPayments.length * SESSION_UNIT;
    const totalAttended = allAttendance.length;
    const balance = totalPaidSessions - totalAttended;
    const lastPaidIndex = Math.max(
      0,
      (sortedPayments.length - 1) * SESSION_UNIT
    );
    const currentActiveSessions = allAttendance.slice(lastPaidIndex);

    return {
      historyRows: rows.reverse(),
      nextSessionStartIndex: totalPaidSessions,
      currentStatus: {
        balance: balance,
        totalAttended: totalAttended,
        activeSessions: currentActiveSessions,
      },
    };
  }, [student.attendanceHistory, student.paymentHistory, SESSION_UNIT]);

  // [NEW] 출석 저장 핸들러 (PaymentModal 내부용)
  const handleSaveAttendanceInside = (studentId, newHistory) => {
    // 1. 진행도(sessionsCompleted) 재계산
    const lastPayment = student.lastPaymentDate || "0000-00-00";
    const newSessionCount = newHistory.filter(
      (h) => h.status === "present" && h.date >= lastPayment
    ).length;

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
      .filter((h) => h.status === "present")
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
                    .map((session, idx) => {
                      const globalIdx =
                        currentStatus.totalAttended -
                        currentStatus.activeSessions.length +
                        idx;
                      const isUnpaid =
                        globalIdx >= historyRows.length * SESSION_UNIT;
                      return (
                        <div
                          key={idx}
                          className={`px-3 py-2 rounded-lg border flex flex-col items-center min-w-[80px] ${
                            isUnpaid
                              ? "bg-rose-50 border-rose-200 text-rose-700"
                              : "bg-slate-50 border-slate-200 text-slate-600"
                          }`}
                        >
                          <span className="text-[10px] font-bold mb-0.5 opacity-70">
                            {isUnpaid ? "미납" : "결제됨"}
                          </span>
                          <span className="font-bold font-mono text-sm">
                            {session.date.slice(2)}
                          </span>
                        </div>
                      );
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
                              {row.sessions.map((c, i) => (
                                <span
                                  key={i}
                                  className="inline-block border bg-indigo-50 text-indigo-700 border-indigo-100 px-1.5 py-0.5 rounded text-xs font-mono"
                                >
                                  {c.date.slice(2)}
                                </span>
                              ))}
                              {row.sessions.length < SESSION_UNIT &&
                                index === 0 && (
                                  <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 ml-1">
                                    +{SESSION_UNIT - row.sessions.length}회 잔여
                                  </span>
                                )}
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
  onNavigateToConsultation,
  onNavigate,
}) => {
  // 1. 내 담당 학생 필터링
  const myStudents = useMemo(() => {
    return user.role === "teacher"
      ? students.filter((s) => s.teacher === user.name && s.status === "재원")
      : students.filter((s) => s.status === "재원");
  }, [students, user]);

  // 2. 수납 상태 계산
  const isPaymentDue = (s) => {
    const totalAttended = (s.attendanceHistory || []).filter(
      (h) => h.status === "present"
    ).length;
    const sessionUnit = parseInt(s.totalSessions) || 4;
    const totalPaidCapacity = (s.paymentHistory || []).length * sessionUnit;

    let currentUsage = totalAttended % sessionUnit;
    if (currentUsage === 0 && totalAttended > 0) currentUsage = sessionUnit;

    const isOverdue = totalAttended > totalPaidCapacity;
    const isCompleted = currentUsage === sessionUnit;

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

  // 4. 강사용 월간 보고서 상태
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
          label="수강권 만료 (재결제)"
          value={`${stats.paymentDueCount}명`}
          trend="확인 필요"
          trendUp={false}
          onClick={() =>
            onNavigate(user.role === "admin" ? "payments" : "students")
          }
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

      {/* 3. 빠른 메뉴 이동 */}
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

      {/* 4. 관리자 전용: 상담 대기 목록 */}
      {user.role === "admin" && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-800 flex items-center text-lg">
              <ListTodo className="mr-2 text-indigo-600" size={22} /> 진행 중인
              상담
            </h3>
            <button
              onClick={() => onNavigate("consultations")}
              className="text-sm font-bold text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              전체 보기
            </button>
          </div>

          {stats.pendingConsults.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.pendingConsults.map((consult) => (
                <div
                  key={consult.id}
                  onClick={() =>
                    onNavigateToConsultation &&
                    onNavigateToConsultation(consult)
                  }
                  className="border border-slate-100 rounded-xl p-5 bg-slate-50/50 hover:bg-white hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer group"
                >
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="font-bold text-slate-800 block text-base group-hover:text-indigo-600 transition-colors">
                        {consult.name}
                      </span>
                      <span className="text-xs text-slate-500">
                        {consult.phone}
                      </span>
                    </div>
                    <span className="text-[10px] bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-bold">
                      {consult.date}
                    </span>
                  </div>
                  <div className="text-sm text-slate-600 mb-3 font-medium line-clamp-1">
                    {consult.subject || "과목 미정"}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {consult.followUpActions?.length > 0 ? (
                      consult.followUpActions.map((actionId) => {
                        const opt = FOLLOW_UP_OPTIONS.find(
                          (o) => o.id === actionId
                        ) || { label: "알 수 없음", color: "blue" };
                        const colorMap = {
                          purple:
                            "bg-purple-50 text-purple-600 border-purple-100",
                          green: "bg-green-50 text-green-600 border-green-100",
                          blue: "bg-blue-50 text-blue-600 border-blue-100",
                        };
                        return (
                          <span
                            key={actionId}
                            className={`text-[10px] px-2 py-0.5 rounded-md border ${
                              colorMap[opt.color] || colorMap.blue
                            }`}
                          >
                            {opt.label}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-xs text-slate-400">
                        후속 조치 없음
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
              <MessageSquareText
                size={40}
                className="mx-auto text-slate-300 mb-2"
              />
              <p className="text-slate-400 text-sm">
                현재 대기 중인 상담이 없습니다.
              </p>
            </div>
          )}
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
}) => {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedTeacher, setSelectedTeacher] = useState(
    user.role === "teacher" ? user.name : "전체"
  );
  const [isWriting, setIsWriting] = useState(false);
  const [studentReports, setStudentReports] = useState({});

  // 기간 문자열
  const getPeriodString = (year, month) => {
    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = year - 1;
    }
    return `${prevYear}년 ${prevMonth}월 24일 ~ ${year}년 ${month}월 23일`;
  };

  // 수업일 추출
  const getAttendanceDates = (student, year, month) => {
    if (!student) return "";
    let prevYear = year;
    let prevMonth = month - 1;
    if (prevMonth === 0) {
      prevMonth = 12;
      prevYear = year - 1;
    }
    const startDate = `${prevYear}-${String(prevMonth).padStart(2, "0")}-24`;
    const endDate = `${year}-${String(month).padStart(2, "0")}-23`;

    return (student.attendanceHistory || [])
      .filter(
        (h) =>
          h.date >= startDate && h.date <= endDate && h.status === "present"
      )
      .map((h) => h.date.slice(5))
      .sort()
      .join(", ");
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
    return students.filter(
      (s) => s.teacher === teacherName && s.status === "재원"
    );
  }, [students, user, selectedTeacher]);

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
          <p className="text-xs text-slate-500 mt-1 ml-8">
            집계 기간:{" "}
            <span className="font-bold text-indigo-600">
              {getPeriodString(selectedYear, selectedMonth)}
            </span>
          </p>
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
            <div className="grid grid-cols-1 gap-4">
              {myStudents.length > 0 ? (
                myStudents.map((s) => {
                  const dates = getAttendanceDates(
                    s,
                    selectedYear,
                    selectedMonth
                  );
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

        <div className="space-y-6">
          {filteredReports.length > 0
            ? filteredReports.map((report) => {
                const studentList = students.filter(
                  (s) => s.teacher === report.teacherName && s.status === "재원"
                );
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
                          <h3 className="font-bold text-slate-800">
                            {report.teacherName} 선생님
                          </h3>
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
                          const dates = getAttendanceDates(
                            s,
                            report.year,
                            report.month
                          );
                          return (
                            <div
                              key={s.id}
                              className="p-4 hover:bg-slate-50 transition-colors"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center">
                                  <span className="font-bold text-slate-800 mr-2">
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

  // 4. [기능 보존] 저장 로직 (Firebase 연동)
  const handleSaveConsultation = async () => {
    if (!currentConsult.name || !currentConsult.phone) {
      showToast("이름과 연락처를 입력해주세요.", "warning");
      return;
    }
    try {
      const safeAppId = APP_ID || "jnc-music-v2";
      if (currentConsult.id) {
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
          { ...currentConsult }
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
                className="w-full py-3.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg transition-all active:scale-95"
              >
                {currentConsult.id ? "수정 내용 저장" : "상담 내역 등록"}
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
    for (let i = 13; i <= 22; i++) slots.push(i);
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
        s.className === dayName;
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

  const getSessionCount = (student, targetDate) => {
    const history = student.attendanceHistory || [];
    const lastPayment = student.lastPaymentDate || "0000-00-00";
    const validSessions = history
      .filter((h) => h.status === "present" && h.date >= lastPayment)
      .sort((a, b) => a.date.localeCompare(b.date));
    const index = validSessions.findIndex((h) => h.date === targetDate);
    return index !== -1 ? index + 1 : null;
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
                return (
                  <div
                    key={i}
                    className="p-1 border-r last:border-r-0 relative hover:bg-slate-50 transition-colors"
                  >
                    {cellStudents.map((s, idx) => {
                      const record = s.attendanceHistory?.find(
                        (h) => h.date === dateStr
                      );
                      const status = record ? record.status : "scheduled";
                      const sessionNum = getSessionCount(s, dateStr);
                      let bgClass =
                        "bg-indigo-100 text-indigo-700 border-indigo-200";
                      if (status === "present")
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
                          className={`text-[10px] px-1 py-0.5 rounded border mb-1 cursor-pointer truncate ${bgClass}`}
                        >
                          {s.name} {sessionNum && `(${sessionNum})`}
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
                    return (
                      <div
                        key={hour}
                        className="h-20 border-b p-1 hover:bg-slate-50 transition-colors"
                      >
                        {cellStudents.map((s, idx) => {
                          const record = s.attendanceHistory?.find(
                            (h) => h.date === dateStr
                          );
                          const status = record ? record.status : "scheduled";
                          const sessionNum = getSessionCount(s, dateStr);
                          let bgClass =
                            "bg-white border-slate-200 text-slate-700";
                          if (status === "present")
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
                              className={`text-[10px] p-1 rounded border mb-1 cursor-pointer shadow-sm ${bgClass}`}
                            >
                              {s.name} {sessionNum && `(${sessionNum})`}
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
                  setDateDetail({ date: dateStr, students: details });
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
                          <span>
                            {s.name} {sessionNum ? `(${sessionNum})` : ""}
                          </span>
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
      {viewType === "month" && renderMonthView()}
      {viewType === "week" && renderWeeklyView()}
      {viewType === "day" && renderDailyView()}
    </div>
  );
};
// [ClassLogView]
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
  const getSessionCount = (student, targetDate) => {
    const history = student.attendanceHistory || [];
    const lastPayment = student.lastPaymentDate || "0000-00-00";
    const validSessions = history
      .filter((h) => h.status === "present" && h.date >= lastPayment)
      .sort((a, b) => a.date.localeCompare(b.date));
    const index = validSessions.findIndex((h) => h.date === targetDate);
    return index !== -1 ? index + 1 : 0;
  };
  const getCellContent = (dateStr, dayIndex) => {
    let content = [];
    const dayName = DAYS_OF_WEEK.find((d) => d.id === dayIndex)?.label;
    students.forEach((s) => {
      const record = s.attendanceHistory?.find((h) => h.date === dateStr);
      const hasSchedule =
        (s.schedules && s.schedules[dayName]) ||
        (!s.schedules && s.className === dayName);
      if (record || (hasSchedule && s.status === "재원")) {
        if (selectedTeacher && s.teacher !== selectedTeacher) return;
        const sessionNum = getSessionCount(s, dateStr);
        const statusMark =
          record?.status === "present"
            ? `(${sessionNum})`
            : record?.status
            ? "(x)"
            : "";
        const time = getStudentScheduleTime(s, dayName);
        content.push({
          id: s.id,
          text: `${time} ${s.name}${statusMark}`,
          status: record?.status || "scheduled",
          time,
        });
      }
    });
    content.sort((a, b) => a.time.localeCompare(b.time));
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
        <div className="grid grid-cols-7 flex-1 divide-x divide-y divide-slate-200 bg-white">
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

// [SettingsView]
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
  const handleUpdateTeacher = async (id, data) => {
    const { name, password, days, oldName } = data;
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
      await updateDoc(teacherRef, { name, password, days });
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
          `강사 정보 수정 및 학생 ${affectedStudents.length}명 이관 완료`,
          "success"
        );
      } else {
        showToast("수정되었습니다.", "success");
      }
    } catch (e) {
      console.error(e);
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
  // [App.js] 내부 함수 정의 구역에 추가해주세요.

  // App.js 내부의 handleUpdateStudent를 이 코드로 단일화하세요.

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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 h-full overflow-auto">
      {editingTeacher && (
        <EditTeacherModal
          teacher={editingTeacher}
          students={students}
          onClose={() => setEditingTeacher(null)}
          onSave={handleUpdateTeacher}
        />
      )}
      <div className="mb-8 p-6 bg-indigo-50 rounded-xl border border-indigo-100">
        <h3 className="font-bold text-indigo-900 mb-4 flex items-center">
          <HardDrive className="mr-2" size={20} /> 데이터 백업 및 복구
        </h3>
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
      <div className="mb-8 p-6 bg-emerald-50 rounded-xl border border-emerald-100">
        <h3 className="font-bold text-emerald-900 mb-4 flex items-center">
          <File className="mr-2" size={20} /> 원생 일괄 업로드 (Excel)
        </h3>
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
              "업로드 중..."
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
                      요일 미지정
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
const AttendanceActionModal = ({ student, date, onClose, onSelectStatus }) => (
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
          onClick={() => onSelectStatus("present")}
          className="w-full py-3 bg-emerald-100 text-emerald-700 rounded-lg font-bold hover:bg-emerald-200"
        >
          출석 처리
        </button>
        <button
          onClick={() => onSelectStatus("absent")}
          className="w-full py-3 bg-rose-100 text-rose-700 rounded-lg font-bold hover:bg-rose-200"
        >
          결석 처리
        </button>
        <button
          onClick={() => onSelectStatus("canceled")}
          className="w-full py-3 bg-slate-100 text-slate-700 rounded-lg font-bold hover:bg-slate-200"
        >
          당일 취소
        </button>
        <div className="border-t my-1"></div>
        <button
          onClick={() => onSelectStatus("delete")}
          className="w-full py-3 text-slate-400 hover:text-rose-500 font-medium flex items-center justify-center gap-2"
        >
          <Trash2 size={16} /> 기록 삭제
        </button>
      </div>
    </div>
  </div>
);

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
                  onClose();
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
// ==================================================================================
// [1] FastAttendanceModal: 초기 데이터 구축용 (출석 콕콕)
// ==================================================================================
const FastAttendanceModal = ({ student, onClose, onSave }) => {
  // 기본적으로 2025년 10월부터 표시
  const [baseDate, setBaseDate] = useState(new Date("2025-10-01"));

  // 로컬 상태로 출석 기록 관리
  const [tempHistory, setTempHistory] = useState(
    student.attendanceHistory || []
  );

  const toggleDate = (dateStr) => {
    const exists = tempHistory.find((h) => h.date === dateStr);
    if (exists) {
      // 이미 있으면 삭제 (토글)
      setTempHistory(tempHistory.filter((h) => h.date !== dateStr));
    } else {
      // 없으면 추가
      setTempHistory([
        ...tempHistory,
        {
          date: dateStr,
          status: "present",
          reason: "초기입력",
          timestamp: new Date().toISOString(),
        },
      ]);
    }
  };

  const handleSave = () => {
    // 날짜순 정렬
    const sorted = [...tempHistory].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    onSave(student.id, sorted);
  };

  // 달력 생성 헬퍼
  const renderCalendarMonth = (year, month) => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);

    // 학생의 수업 요일 인덱스 (예: 월=1, 수=3)
    const targetDays = (student.classDays || []).map((d) =>
      ["일", "월", "화", "수", "목", "금", "토"].indexOf(d)
    );
    // 구버전 호환 (className에 요일이 있는 경우)
    if (targetDays.length === 0 && student.className) {
      const idx = ["일", "월", "화", "수", "목", "금", "토"].indexOf(
        student.className
      );
      if (idx !== -1) targetDays.push(idx);
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
            const isPresent = tempHistory.some(
              (h) => h.date === dateStr && h.status === "present"
            );
            const dayOfWeek = idx % 7;
            const isClassDay = targetDays.includes(dayOfWeek);

            return (
              <div
                key={day}
                onClick={() => toggleDate(dateStr)}
                className={`
                  aspect-square flex items-center justify-center rounded-full text-xs cursor-pointer select-none transition-all
                  ${
                    isPresent
                      ? "bg-indigo-600 text-white font-bold shadow-md transform scale-110"
                      : isClassDay
                      ? "bg-indigo-50 text-indigo-400 hover:bg-indigo-200 border border-indigo-100"
                      : "text-slate-300 hover:bg-slate-100"
                  }
                `}
              >
                {day}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // 4개월치 렌더링
  const calendars = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date(baseDate);
    d.setMonth(baseDate.getMonth() + i);
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

        <div className="flex-1 overflow-y-auto bg-slate-50 p-4 rounded-xl border border-slate-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {calendars}
          </div>
          <div className="flex justify-center gap-4 mt-6">
            <button
              onClick={() => {
                const d = new Date(baseDate);
                d.setMonth(d.getMonth() - 1);
                setBaseDate(d);
              }}
              className="px-4 py-2 bg-white border rounded-lg hover:bg-slate-50 text-sm font-bold shadow-sm"
            >
              ◀ 이전 달
            </button>
            <button
              onClick={() => {
                const d = new Date(baseDate);
                d.setMonth(d.getMonth() + 1);
                setBaseDate(d);
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
            <CheckCircle size={18} className="mr-2" /> {tempHistory.length}건
            저장하기
          </button>
        </div>
      </div>
    </div>
  );
};

// ==================================================================================
// [2] FastPaymentModal: 초기 데이터 구축용 (수납 콕콕)
// ==================================================================================
const FastPaymentModal = ({ student, onClose, onSave }) => {
  // 기본 2025년 10월부터 표시 (필요하면 날짜 조정 가능)
  const [baseDate, setBaseDate] = useState(new Date("2025-10-01"));
  // 기본 원비 세팅
  const [defaultAmount, setDefaultAmount] = useState(student.tuitionFee || 0);

  // 로컬 상태로 결제 기록 관리
  const [tempHistory, setTempHistory] = useState(student.paymentHistory || []);

  const toggleDate = (dateStr) => {
    const exists = tempHistory.find((h) => h.date === dateStr);
    if (exists) {
      // 이미 있으면 삭제 (취소 확인 후)
      if (window.confirm(`${dateStr} 결제 기록을 취소하시겠습니까?`)) {
        setTempHistory(tempHistory.filter((h) => h.date !== dateStr));
      }
    } else {
      // 없으면 추가
      setTempHistory([
        ...tempHistory,
        {
          date: dateStr,
          amount: parseInt(defaultAmount),
          type: "tuition",
          sessionStartDate: dateStr,
          createdAt: new Date().toISOString(),
        },
      ]);
    }
  };

  const handleSave = () => {
    // 날짜순 정렬 (과거 -> 미래)
    const sorted = [...tempHistory].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    onSave(student.id, sorted);
  };

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
            const isPaid = !!tempHistory.find((h) => h.date === dateStr);

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

  // 4개월치 렌더링
  const calendars = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date(baseDate);
    d.setMonth(baseDate.getMonth() + i);
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
                const d = new Date(baseDate);
                d.setMonth(d.getMonth() - 1);
                setBaseDate(d);
              }}
              className="px-4 py-2 bg-white border rounded-lg hover:bg-slate-50 text-sm font-bold shadow-sm"
            >
              ◀ 이전 달
            </button>
            <button
              onClick={() => {
                const d = new Date(baseDate);
                d.setMonth(d.getMonth() + 1);
                setBaseDate(d);
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

// [AttendanceView] - 1:1 레슨 맞춤형 (지각 삭제, 결석 사유, 당일취소 유형화 + 강사필터링 유지)
const AttendanceView = ({ students, showToast, user, teachers }) => {
  const [selectedDate, setSelectedDate] = useState(new Date());

  // [기능 보존] 강사 필터링 상태 (관리자는 빈값=전체, 강사는 본인이름 고정)
  const [selectedTeacher, setSelectedTeacher] = useState(
    user.role === "teacher" ? user.name : ""
  );

  // 모달 상태 (결석 사유 or 당일취소 사유 입력용)
  const [modalConfig, setModalConfig] = useState(null); // { type: 'absent' | 'canceled', student: ... }

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
        // 추가/수정 모드
        const record = {
          date: dateStr,
          status, // 'present', 'absent', 'canceled'
          timestamp: new Date().toISOString(),
        };

        // 상세 사유 저장
        if (status === "absent") {
          record.reason = detail; // 결석 사유 (텍스트)
        } else if (status === "canceled") {
          record.subType = detail; // 당일취소 유형 (질병, 경조사, 기타)
        }

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
      const count = history.filter((h) => {
        if (h.date < lastPay) return false; // 지난 결제일 이전 기록 무시

        if (h.status === "present") return true; // 출석은 무조건 차감
        if (h.status === "canceled") {
          // 당일취소 중 '질병'은 봐줌, 나머지는 차감 (노쇼 페널티)
          return h.subType !== "질병";
        }
        return false; // absent는 차감 안함
      }).length;

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

  // 버튼 클릭 핸들러 (분기 처리)
  const onActionClick = (student, action) => {
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

                {/* 액션 버튼 그룹 (지각 제거됨) */}
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
                {status && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onActionClick(s, "delete");
                    }}
                    className="w-full mt-2 text-[10px] text-slate-300 hover:text-rose-400 flex items-center justify-center gap-1 py-1"
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
/// [StudentView] 레이어 층수(z-index) 최적화 + 오리지널 기능 100% 보존 버전
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
  const [filterStatus, setFilterStatus] = useState("재원");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState("info");
  const [isQuickEditMode, setIsQuickEditMode] = useState(false);
  const [quickEditData, setQuickEditData] = useState({});

  const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

  // [중요] 데이터 로딩 전 충돌 방지 안전장치 (StudentView 상단 유지)
  if (!teachers || teachers.length === 0) {
    return (
      <div className="p-10 text-center text-slate-500 font-bold">
        강사 정보를 불러오는 중...
      </div>
    );
  }

  // 1. [기능 보존 + 중복 증식 해결] 상담 데이터 수신 시 처리
  useEffect(() => {
    if (registerFromConsultation) {
      const isAdultData =
        registerFromConsultation.type === "adult" ||
        (registerFromConsultation.grade &&
          registerFromConsultation.grade.includes("성인"));

      const preparedData = {
        ...registerFromConsultation,
        grade: isAdultData ? "성인" : registerFromConsultation.grade,
        isAdult: isAdultData,
      };

      setSelectedStudent(preparedData);
      setModalTab("info");
      setIsDetailModalOpen(true);

      // [핵심] 메모리 즉시 비우기 (상담 데이터의 잔상이 남지 않도록)
      if (setRegisterFromConsultation) {
        setTimeout(() => setRegisterFromConsultation(null), 100);
      }
    }
  }, [registerFromConsultation, setRegisterFromConsultation]);

  // 2. 권한 필터링
  const accessibleStudents = useMemo(() => {
    if (!user) return [];
    if (user.role === "admin") return students;
    return students.filter((s) => s.teacher === user.name);
  }, [students, user]);

  // 3. 통계 계산
  const stats = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    return {
      재원: accessibleStudents.filter((s) => s.status === "재원").length,
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
      const matchesSearch =
        !term ||
        s.name?.toLowerCase().includes(term) ||
        s.teacher?.toLowerCase().includes(term) ||
        s.subject?.toLowerCase().includes(term);
      if (filterStatus === "신규")
        return (
          matchesSearch &&
          (s.registrationDate || "").startsWith(currentMonth) &&
          s.status !== "퇴원"
        );
      return matchesSearch && s.status === filterStatus;
    });
  }, [accessibleStudents, searchTerm, filterStatus]);

  const openWithTab = (student, tab = "info") => {
    setSelectedStudent(student);
    setModalTab(tab);
    setIsDetailModalOpen(true);
  };

  const handleSaveQuickEdit = () => {
    // [기능 보존] 퀵에디트 변경 사항을 부모로 전달
    Object.entries(quickEditData).forEach(([studentId, scheduleUpdate]) => {
      const originalStudent = students.find((s) => s.id === studentId);
      if (originalStudent) {
        onUpdateStudent(studentId, {
          ...originalStudent,
          schedules: { ...originalStudent.schedules, ...scheduleUpdate },
        });
      }
    });
    setIsQuickEditMode(false);
    setQuickEditData({});
    showToast("시간표 수정사항이 저장되었습니다.", "success");
  };

  return (
    <div className="relative h-full">
      {/* 1. 모달 레이어 (증식 완벽 차단 로직 포함) */}
      {isDetailModalOpen && (
        <StudentModal
          isOpen={true}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedStudent(null);
          }}
          student={selectedStudent}
          teachers={teachers}
          onSave={(finalId, data) => {
            // [중요] StudentModal에서 계산되어 넘어온 finalId(null 또는 기존ID)를 사용
            onUpdateStudent(finalId, data);
            setIsDetailModalOpen(false);
            setSelectedStudent(null);
          }}
          onDelete={(id) => {
            onDeleteStudent(id);
            setIsDetailModalOpen(false);
            setSelectedStudent(null);
          }}
        />
      )}
      {/* 2. 리스트 레이어 */}
      <div
        className={`space-y-4 animate-fade-in pb-24 h-full ${
          isDetailModalOpen ? "hidden" : "block"
        }`}
      >
        <div className="flex flex-col gap-4 bg-white p-5 rounded-2xl border shadow-sm sticky top-0 z-10">
          <div className="flex flex-col xl:flex-row justify-between gap-4">
            <div className="relative flex-1 max-w-2xl">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                size={18}
              />
              <input
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="이름, 파트, 강사 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl w-fit shrink-0">
              {["재원", "휴원", "퇴원"].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`px-5 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                    filterStatus === status
                      ? "bg-white text-indigo-600 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {status}
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                      filterStatus === status
                        ? "bg-indigo-100 text-indigo-600"
                        : "bg-slate-200 text-slate-500"
                    }`}
                  >
                    {stats[status]}
                  </span>
                </button>
              ))}
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
              <button
                onClick={() => openWithTab(null, "info")}
                className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-bold flex items-center shadow-md hover:bg-indigo-700"
              >
                <Plus size={18} className="mr-1.5" /> 신규 등록
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border shadow-sm overflow-auto max-h-[70vh] relative">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead className="sticky top-0 z-0">
              <tr className="bg-slate-50 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                <th className="p-4 w-60 sticky left-0 top-0 bg-slate-100 z-10 border-b border-r border-slate-200 shadow-sm">
                  원생 / 강사 정보
                </th>
                {isQuickEditMode ? (
                  DAYS.map((d) => (
                    <th
                      key={d}
                      className="p-2 text-center w-24 bg-slate-50 border-b border-slate-200 shadow-sm"
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
                            className="font-bold text-slate-900 text-base cursor-pointer hover:text-indigo-600 hover:underline"
                            onClick={() => openWithTab(s, "info")}
                          >
                            {s.name}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full font-bold border border-indigo-100">
                            {s.subject}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                          <span>{s.teacher}</span>
                          <span className="text-slate-300">|</span>
                          <span className="font-mono text-slate-400">
                            {s.phone}
                          </span>
                        </div>
                      </div>
                    </td>
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
                          {Object.entries(s.schedules || {}).map(
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
                          >
                            <CalendarIcon size={18} />
                          </button>
                          <button
                            onClick={() => openWithTab(s, "payment")}
                            className="p-2.5 bg-white text-indigo-600 border border-indigo-100 rounded-xl shadow-sm hover:bg-indigo-600 hover:text-white transition-all"
                          >
                            <CreditCard size={18} />
                          </button>
                          <button
                            onClick={() => openWithTab(s, "info")}
                            className="p-2.5 bg-white text-slate-400 border border-slate-200 rounded-xl shadow-sm hover:bg-slate-800 hover:text-white transition-all"
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
                    className="py-20 text-center text-slate-400 font-bold text-lg"
                  >
                    원생이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
// ==================================================================================
// [StudentModal] 성인 자동 연동 + 보관함 이동 기능 포함 버전
const StudentModal = ({
  isOpen,
  onClose,
  student,
  teachers,
  onSave,
  onDelete,
}) => {
  const [activeTab, setActiveTab] = useState("info");
  const [baseDate, setBaseDate] = useState(new Date());
  const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

  const [formData, setFormData] = useState({});
  const [isAdult, setIsAdult] = useState(false);

  const [attHistory, setAttHistory] = useState([]);
  const [payHistory, setPayHistory] = useState([]);
  const [payAmount, setPayAmount] = useState(0);

  useEffect(() => {
    if (isOpen) {
      if (student) {
        // [수정] 데이터가 없을 경우를 대비한 기본값(||) 설정 강화
        const incomingGrade = (student.grade || "").trim();
        const isAdultCheck =
          student.type === "adult" ||
          incomingGrade === "성인" ||
          incomingGrade.includes("성인") ||
          student.isAdult === true;

        setIsAdult(isAdultCheck);

        setFormData({
          ...student,
          name: student.name || "",
          grade: isAdultCheck ? "성인" : incomingGrade,
          phone: student.phone || student.parentPhone || "",
          teacher: student.teacher || teachers[0]?.name || "",
          schedules: student.schedules || {},
          memo: student.note || student.memo || "",
          totalSessions: student.totalSessions || 4,
          fromConsultationId:
            student.fromConsultationId ||
            (student.status === "pending" ? student.id : null),
          status:
            student.status === "pending" ? "재원" : student.status || "재원",
        });

        // [핵심] 배열 데이터가 없을 경우 빈 배열([])로 강제 초기화하여 하얀 화면 방지
        setAttHistory(
          Array.isArray(student.attendanceHistory)
            ? student.attendanceHistory
            : []
        );
        setPayHistory(
          Array.isArray(student.paymentHistory) ? student.paymentHistory : []
        );
        setPayAmount(student.tuitionFee || 0);
      } else {
        // 신규 등록 모드 (기존과 동일)
        setIsAdult(false);
        setFormData({
          name: "",
          grade: "",
          phone: "",
          teacher: teachers[0]?.name || "",
          status: "재원",
          registrationDate: new Date().toISOString().split("T")[0],
          tuitionFee: "",
          subject: "",
          schedules: {},
          memo: "",
          totalSessions: 4,
        });
        setAttHistory([]);
        setPayHistory([]);
        setPayAmount(0);
      }
      setActiveTab("info");
    }
  }, [isOpen, student, teachers]);

  const handleAdultCheck = (e) => {
    const checked = e.target.checked;
    setIsAdult(checked);
    if (checked) setFormData((prev) => ({ ...prev, grade: "성인" }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "grade") setIsAdult(value === "성인");
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleScheduleChange = (day, value) => {
    setFormData((prev) => ({
      ...prev,
      schedules: { ...(prev.schedules || {}), [day]: value },
    }));
  };

  // [저장 로직] 상담 데이터 보관함 이동 기능 유지 + 증식 방지
  const handleSaveWrapper = async () => {
    // 1. 데이터 정리
    const finalData = {
      ...formData,
      grade: isAdult ? "성인" : formData.grade,
      attendanceHistory: attHistory,
      paymentHistory: payHistory,
      updatedAt: new Date().toISOString(),
    };

    // 2. 상담 기록 업데이트 (등록 완료 처리)
    if (formData.fromConsultationId) {
      try {
        const safeAppId = "jnc-music-v2";
        const consultRef = doc(
          db,
          "artifacts",
          safeAppId,
          "public",
          "data",
          "consultations",
          formData.fromConsultationId
        );
        await updateDoc(consultRef, {
          status: "registered",
          registeredAt: new Date().toISOString(),
        });
      } catch (e) {
        console.error("상담 상태 업데이트 실패:", e);
      }
    }

    // [중요] 타겟 ID 결정 로직 재수정
    // 상담 리스트에서 넘어온 경우(status: pending)는 student.id가 있어도 '상담ID'이지 '원생ID'가 아닙니다.
    // 따라서 status가 "pending"이면 무조건 null을 보내어 '신규 생성'을 유도합니다.
    const isFromConsultation =
      student && (student.status === "pending" || !student.registrationDate);
    const targetId = isFromConsultation ? null : student?.id || null;

    onSave(targetId, finalData);
  };

  if (!isOpen) return null;

  // --- 유틸리티 헬퍼 (기능 복구) ---
  const toggleAttendance = (dateStr) => {
    const exists = attHistory.find((h) => h.date === dateStr);
    setAttHistory(
      exists
        ? attHistory.filter((h) => h.date !== dateStr)
        : [
            ...attHistory,
            {
              date: dateStr,
              status: "present",
              timestamp: new Date().toISOString(),
            },
          ]
    );
  };

  const togglePayment = (dateStr) => {
    const exists = payHistory.find((h) => h.date === dateStr);
    if (exists) {
      if (confirm("기록을 삭제하시겠습니까?"))
        setPayHistory(payHistory.filter((h) => h.date !== dateStr));
    } else {
      setPayHistory([
        ...payHistory,
        {
          date: dateStr,
          amount: parseInt(payAmount) || 0,
          type: "tuition",
          sessionStartDate: dateStr,
          createdAt: new Date().toISOString(),
        },
      ]);
    }
  };

  const moveMonth = (offset) => {
    const d = new Date(baseDate);
    d.setMonth(d.getMonth() + offset);
    setBaseDate(d);
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
          className="border rounded-lg p-2 bg-white shadow-sm"
        >
          <div className="text-center font-bold text-slate-700 mb-2 bg-slate-50 rounded py-1">
            {year}년 {month + 1}월
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {["일", "월", "화", "수", "목", "금", "토"].map((d, idx) => (
              <div
                key={d}
                className={`text-[10px] ${
                  idx === 0
                    ? "text-rose-400"
                    : idx === 6
                    ? "text-blue-400"
                    : "text-slate-400"
                }`}
              >
                {d}
              </div>
            ))}
            {days.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`}></div>;
              const dateStr = `${year}-${String(month + 1).padStart(
                2,
                "0"
              )}-${String(day).padStart(2, "0")}`;
              let isSelected =
                type === "attendance"
                  ? attHistory.some(
                      (h) => h.date === dateStr && h.status === "present"
                    )
                  : payHistory.some((h) => h.date === dateStr);
              return (
                <div
                  key={day}
                  onClick={() =>
                    type === "attendance"
                      ? toggleAttendance(dateStr)
                      : togglePayment(dateStr)
                  }
                  className={`aspect-square flex items-center justify-center rounded-lg text-xs cursor-pointer transition-all border ${
                    isSelected
                      ? type === "attendance"
                        ? "bg-emerald-500 text-white font-bold"
                        : "bg-indigo-600 text-white font-bold transform scale-105"
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{calendars}</div>
    );
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl m-4 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex justify-between items-center p-5 border-b bg-slate-50 shrink-0">
          <div>
            <h3 className="text-xl font-bold text-slate-800">
              {formData.fromConsultationId
                ? "💬 상담 정보로 등록"
                : student?.id
                ? `${formData.name} 원생 관리`
                : "✨ 신규 원생 등록"}
            </h3>
            <p className="text-xs text-slate-500">
              {isAdult ? "성인 회원" : `${formData.grade || "-"} 학생`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X size={24} />
          </button>
        </div>
        <div className="flex border-b">
          {["info", "attendance", "payment"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 text-sm font-bold ${
                activeTab === tab
                  ? "text-indigo-600 border-b-2 border-indigo-600 bg-indigo-50 shadow-inner"
                  : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              {tab === "info"
                ? "기본 정보"
                : tab === "attendance"
                ? "출석 관리"
                : "수납 관리"}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {activeTab === "info" && (
            <div className="space-y-6 animate-in fade-in duration-300">
              <div className="bg-white p-3 rounded-lg border border-indigo-100 flex items-center shadow-sm">
                <input
                  type="checkbox"
                  id="adultCheck"
                  checked={isAdult}
                  onChange={handleAdultCheck}
                  className="w-5 h-5 rounded border-gray-300 text-indigo-600 mr-2 cursor-pointer"
                />
                <label
                  htmlFor="adultCheck"
                  className="text-sm font-bold text-indigo-800 cursor-pointer select-none"
                >
                  성인 회원입니다 (호칭 '님')
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    이름
                  </label>
                  <input
                    name="name"
                    className="w-full p-2 border rounded shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                    value={formData.name || ""}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    담당 강사
                  </label>
                  <select
                    name="teacher"
                    className="w-full p-2 border rounded shadow-sm focus:ring-2 focus:ring-indigo-500 outline-none font-bold"
                    value={formData.teacher || ""}
                    onChange={handleChange}
                  >
                    <option value="">미지정</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.name}>
                        {t.name} 선생님
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    학년{" "}
                    {isAdult && <span className="text-indigo-600">(성인)</span>}
                  </label>
                  <select
                    name="grade"
                    className={`w-full p-2 border rounded shadow-sm outline-none ${
                      isAdult
                        ? "bg-indigo-50 text-indigo-700 font-bold"
                        : "focus:ring-2 focus:ring-indigo-500"
                    }`}
                    value={isAdult ? "성인" : formData.grade || ""}
                    onChange={handleChange}
                  >
                    <option value="">선택</option>
                    {GRADE_OPTIONS.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    연락처
                  </label>
                  <input
                    name="phone"
                    className="w-full p-2 border rounded outline-none"
                    value={formData.phone || ""}
                    onChange={handleChange}
                    placeholder="010-0000-0000"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    수강 과목
                  </label>
                  <input
                    name="subject"
                    className="w-full p-2 border rounded outline-none"
                    value={formData.subject || ""}
                    onChange={handleChange}
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">
                    수강료
                  </label>
                  <input
                    name="tuitionFee"
                    type="number"
                    className="w-full p-2 border rounded outline-none text-right font-bold text-indigo-600"
                    value={formData.tuitionFee || ""}
                    onChange={handleChange}
                  />
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm mt-4">
                <label className="text-xs font-bold text-slate-500 mb-2 block flex items-center gap-1">
                  <Timer size={14} className="text-indigo-500" /> 요일별 수업
                  시간
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {DAYS.map((day) => (
                    <div key={day} className="space-y-1">
                      <div className="text-[10px] text-center font-bold text-slate-400">
                        {day}
                      </div>
                      <input
                        className={`w-full p-1.5 text-xs border rounded-lg text-center outline-none ${
                          formData.schedules?.[day]
                            ? "bg-indigo-50 border-indigo-200 font-bold text-indigo-700"
                            : "bg-slate-50"
                        }`}
                        value={formData.schedules?.[day] || ""}
                        onChange={(e) =>
                          handleScheduleChange(day, e.target.value)
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">
                  메모
                </label>
                <textarea
                  name="memo"
                  rows={3}
                  className="w-full p-2 border rounded resize-none outline-none shadow-sm"
                  value={formData.memo || ""}
                  onChange={handleChange}
                />
              </div>
            </div>
          )}
          {activeTab === "attendance" && (
            <div className="space-y-4 animate-in slide-in-from-right-2">
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex justify-between items-center shadow-sm">
                <div className="text-emerald-800 text-sm font-bold flex items-center">
                  <CheckCircle size={18} className="mr-2" /> 현재 총{" "}
                  {attHistory.length}회 출석
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => moveMonth(-1)}
                    className="px-3 py-1 bg-white border rounded text-xs hover:bg-slate-50 font-bold"
                  >
                    ◀ 이전
                  </button>
                  <button
                    onClick={() => moveMonth(1)}
                    className="px-3 py-1 bg-white border rounded text-xs hover:bg-slate-50 font-bold"
                  >
                    다음 ▶
                  </button>
                </div>
              </div>
              {renderCalendar("attendance")}
            </div>
          )}
          {activeTab === "payment" && (
            <div className="space-y-4 animate-in slide-in-from-right-2">
              <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex justify-between items-center shadow-sm">
                <div>
                  <span className="text-sm font-bold text-indigo-900">
                    결제액:{" "}
                  </span>
                  <input
                    type="number"
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    className="w-24 p-1 text-right font-bold border rounded"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => moveMonth(-1)}
                    className="px-3 py-1 bg-white border rounded text-xs font-bold"
                  >
                    ◀ 이전
                  </button>
                  <button
                    onClick={() => moveMonth(1)}
                    className="px-3 py-1 bg-white border rounded text-xs font-bold"
                  >
                    다음 ▶
                  </button>
                </div>
              </div>
              {renderCalendar("payment")}
            </div>
          )}
        </div>
        <div className="p-5 border-t bg-white flex justify-between items-center">
          {student?.id && student.status !== "pending" && (
            <button
              onClick={() => {
                if (confirm("삭제하시겠습니까?")) onDelete(student.id);
              }}
              className="text-rose-500 text-sm underline px-2 font-bold hover:text-rose-700"
            >
              원생 삭제
            </button>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-5 py-2.5 rounded-lg text-slate-500 hover:bg-slate-100 font-bold"
            >
              취소
            </button>
            <button
              onClick={handleSaveWrapper}
              className="px-8 py-2.5 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg flex items-center"
            >
              <Save size={18} className="mr-2" /> 저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// [PaymentView] - 안내 문자 호칭 변경 (성인 -> '님') 및 자동 계산 로직 적용
const PaymentView = ({
  students,
  showToast,
  onSavePayment,
  onUpdatePaymentHistory,
  onUpdateStudent,
}) => {
  const [filterDue, setFilterDue] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const [showMsgPreview, setShowMsgPreview] = useState(false);
  const [msgContent, setMsgContent] = useState("");

  // 수강 현황 계산 헬퍼
  const getStudentProgress = (s) => {
    const totalAttended = (s.attendanceHistory || []).filter(
      (h) => h.status === "present"
    ).length;
    const sessionUnit = parseInt(s.totalSessions) || 4;
    const totalPaidCapacity = (s.paymentHistory || []).length * sessionUnit;

    let currentUsage = totalAttended % sessionUnit;
    if (currentUsage === 0 && totalAttended > 0) currentUsage = sessionUnit;

    const isOverdue = totalAttended > totalPaidCapacity;
    const isCompleted = currentUsage === sessionUnit;

    return {
      currentUsage,
      sessionUnit,
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

  const list = useMemo(() => {
    return students.filter((s) => {
      const { isOverdue, isCompleted } = getStudentProgress(s);
      const isDue = !filterDue || isCompleted || isOverdue;
      const isReEnrolled = s.status === "재원";
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

  // [핵심 수정] 안내 문자 미리보기 생성 함수
  const handleOpenMsgPreview = (e, student) => {
    e.stopPropagation();

    // 1. 호칭 처리: 성인이면 '님', 아니면 '학생'
    const isAdult = student.grade === "성인";
    const titleName = isAdult ? `${student.name}님` : `${student.name} 학생`;

    const sessionUnit = parseInt(student.totalSessions) || 4;
    const tuition = parseInt(student.tuitionFee || 0).toLocaleString();

    // 출석 이력 (날짜순 정렬)
    const allAttendance = (student.attendanceHistory || [])
      .filter((h) => h.status === "present")
      .sort((a, b) => a.date.localeCompare(b.date));

    // 결제 이력
    const allPayments = (student.paymentHistory || []).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    const totalPaidCapacity = allPayments.length * sessionUnit;
    const lastPayment =
      allPayments.length > 0
        ? allPayments[allPayments.length - 1].date
        : "기록 없음";

    // 결제된 마지막 수업
    const lastCoveredSession = allAttendance[totalPaidCapacity - 1];
    const lastCoveredDate = lastCoveredSession
      ? lastCoveredSession.date.slice(5).replace("-", "/")
      : "없음";

    // 미납 회차 계산
    const unpaidSessions = allAttendance.slice(totalPaidCapacity);
    const unpaidDatesStr =
      unpaidSessions.length > 0
        ? unpaidSessions
            .map((h) => h.date.slice(5).replace("-", "/"))
            .join(", ")
        : "없음";

    // 최근 수업일자 (최근 12개)
    const recentSessions = allAttendance
      .slice(-12)
      .map((h) => h.date.slice(5).replace("-", "/"))
      .join(", ");

    // 다음 수업일(1회차) 자동 계산 로직
    let nextDateStr = "(예정)";
    let requestDateStr = "";

    // 마지막 수업일(없으면 오늘)
    const lastClassDateStr =
      allAttendance.length > 0
        ? allAttendance[allAttendance.length - 1].date
        : new Date().toISOString().split("T")[0];

    const daysKor = ["일", "월", "화", "수", "목", "금", "토"];
    let targetDayIdx = -1;

    // schedules에 등록된 첫 번째 요일을 기준 요일로 잡음
    if (student.schedules) {
      const scheduledDays = Object.keys(student.schedules);
      if (scheduledDays.length > 0) {
        targetDayIdx = daysKor.indexOf(scheduledDays[0]);
      }
    }
    // schedules 없으면 className(구 데이터) 확인
    if (targetDayIdx === -1 && student.className) {
      targetDayIdx = daysKor.indexOf(student.className);
    }

    if (targetDayIdx !== -1) {
      // 마지막 수업일 다음 날부터 검색 시작
      let d = new Date(lastClassDateStr);
      d.setDate(d.getDate() + 1);

      // 14일 이내로 다음 해당 요일 찾기
      for (let i = 0; i < 14; i++) {
        if (d.getDay() === targetDayIdx) {
          const m = d.getMonth() + 1;
          const dt = d.getDate();
          const dayName = daysKor[d.getDay()];

          nextDateStr = `${String(m).padStart(2, "0")}/${String(dt).padStart(
            2,
            "0"
          )}`;
          requestDateStr = `${m}/${dt}(${dayName})`;
          break;
        }
        d.setDate(d.getDate() + 1);
      }
    }

    // 계산 실패시 3일 뒤로 설정 (fallback)
    if (!requestDateStr) {
      const fallback = new Date();
      fallback.setDate(fallback.getDate() + 3);
      requestDateStr = `${fallback.getMonth() + 1}/${fallback.getDate()}(${
        daysKor[fallback.getDay()]
      })`;
    }

    // 문자 템플릿 생성
    const generatedMsg = `안녕하세요, J&C 음악학원입니다.

(시즌 인사)

수업료 결제 안내입니다. 아래 수업일자와 결제내용 확인하시어 결제 부탁드리겠습니다.
-------------------------------
- 과정명 : ${student.subject || "음악"} 과정 - ${titleName}
- 최종 결제일 : ${lastPayment.slice(5).replace("-", "/")}
- 수업일자 : ${recentSessions}
- 결제하신 수업 완료일 : ${lastCoveredDate}
- 새로운 1회차 수업 : ${nextDateStr}
- 미납회차 : ${unpaidDatesStr} ${
      unpaidSessions.length > 0 ? `(${unpaidSessions.length}회)` : ""
    }

- 결제금액 : ${sessionUnit}회 ${tuition}원 ${
      unpaidSessions.length > 0 ? `(미납 ${unpaidSessions.length}회 포함)` : ""
    }
- 결제요청일 : ${requestDateStr} 까지 결제 부탁드립니다.
(현장결제는 수업 당일까지, 온라인결제는 수업 전일까지 부탁드립니다)

- 결제계좌
하나은행 125-91025-766307 강열혁(제이앤씨음악학원)
- 결제방법: 방문(카드/현금), 계좌이체, 제로페이, 온라인 결제

* 당일취소와 노쇼는 수업 횟수에 포함되며, 해당 회차는 차감됩니다. 방역 이슈관련 회차는 차감되지 않습니다.

- 온라인 카드 결제를 원하시는 경우 알려주시면 발송드리겠습니다. 결제 선생(카카오톡 페이지) 페이지 보내드립니다.

- 이미 결제하신 경우 알려주시면 감사하겠습니다. 특히 제로페이의 경우 학생명 확인이 어려우니 꼭 알려주시면 감사하겠습니다.


항상 감사드립니다. (마무리 인사)

J&C 음악학원장 올림.`;

    setMsgContent(generatedMsg);
    setShowMsgPreview(true);
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
      {/* 미리보기 모달 */}
      {showMsgPreview && (
        <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col h-[85vh]">
            <div className="flex justify-between items-center p-4 border-b shrink-0">
              <h3 className="text-lg font-bold flex items-center text-indigo-900">
                <MessageSquareText className="mr-2" size={20} /> 안내 문자
                미리보기
              </h3>
              <button
                onClick={() => setShowMsgPreview(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-hidden flex flex-col">
              <div className="text-sm text-slate-500 mb-2 flex items-center shrink-0">
                <AlertCircle size={14} className="mr-1" /> 내용을 확인하고
                필요하면 직접 수정한 뒤 복사하세요.
              </div>
              <textarea
                className="w-full flex-1 border border-slate-300 rounded-lg p-4 text-sm font-sans leading-relaxed focus:outline-indigo-500 resize-none bg-slate-50"
                value={msgContent}
                onChange={(e) => setMsgContent(e.target.value)}
                spellCheck="false"
              />
            </div>

            <div className="p-4 border-t bg-slate-50 rounded-b-xl flex justify-end gap-3 shrink-0">
              <button
                onClick={() => setShowMsgPreview(false)}
                className="px-5 py-2.5 rounded-lg text-slate-600 hover:bg-slate-200 font-bold"
              >
                취소
              </button>
              <button
                onClick={handleConfirmCopy}
                className="px-6 py-2.5 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg flex items-center"
              >
                <Copy size={18} className="mr-2" /> 복사하기
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedStudent && (
        <PaymentDetailModal
          student={selectedStudent}
          onClose={() => setSelectedStudentId(null)}
          onSavePayment={onSavePayment}
          onUpdatePaymentHistory={onUpdatePaymentHistory}
          onUpdateStudent={onUpdateStudent}
          showToast={showToast}
        />
      )}

      <div className="flex flex-col md:flex-row justify-between items-center mb-4 shrink-0 gap-3">
        <div className="flex items-center">
          <h2 className="text-lg font-bold flex items-center mr-4">
            <CreditCard className="mr-2" /> 수납 관리
          </h2>
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
          <AlertCircle size={14} className="mr-1" />{" "}
          {filterDue ? "전체 보기" : "만료(재결제) 대상만 보기"}
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
              <th className="py-3 px-4 text-center">안내</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => {
              const { currentUsage, sessionUnit, displayStatus, statusColor } =
                getStudentProgress(s);
              return (
                <tr
                  key={s.id}
                  className="border-b hover:bg-slate-50 cursor-pointer"
                  onClick={() => setSelectedStudentId(s.id)}
                >
                  <td className="py-3 px-4 font-medium">
                    {s.name}{" "}
                    {s.subject && (
                      <span className="text-xs text-slate-500 ml-1">
                        ({s.subject})
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 font-bold text-indigo-600">
                    {s.tuitionFee ? Number(s.tuitionFee).toLocaleString() : 0}
                  </td>
                  <td className="py-3 px-4 font-mono font-bold text-slate-700">
                    {currentUsage} / {sessionUnit}
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`px-2 py-1 rounded text-xs ${statusColor}`}
                    >
                      {displayStatus}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={(e) => handleOpenMsgPreview(e, s)}
                      className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="안내 문자 미리보기"
                    >
                      <MessageSquareText size={18} />
                    </button>
                  </td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr>
                <td colSpan="5" className="py-10 text-center text-slate-400">
                  데이터가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// [Main App]
// // [App.js] 메인 컴포넌트 - ID 누락 및 경로 문제 해결
export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [currentUser, setCurrentUser] = useState(null);

  // 데이터 상태
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [consultations, setConsultations] = useState([]);
  const [reports, setReports] = useState([]);

  // UI 상태
  const [registerFromConsultation, setRegisterFromConsultation] =
    useState(null);
  const [message, setMessage] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
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

    signInAnonymously(auth).then(() => {
      console.log("Firebase 접속 성공");
      const safeAppId = APP_ID || "jnc-music-v2"; // 안전장치

      // 1. 학생
      onSnapshot(
        collection(db, "artifacts", safeAppId, "public", "data", "students"),
        (s) => setStudents(s.docs.map((d) => ({ ...d.data(), id: d.id })))
      );

      // 2. 강사
      onSnapshot(
        collection(db, "artifacts", safeAppId, "public", "data", "teachers"),
        (s) => setTeachers(s.docs.map((d) => ({ ...d.data(), id: d.id })))
      );

      // 3. 상담
      onSnapshot(
        collection(
          db,
          "artifacts",
          safeAppId,
          "public",
          "data",
          "consultations"
        ),
        (s) => setConsultations(s.docs.map((d) => ({ ...d.data(), id: d.id })))
      );

      // 4. [문제 해결] 보고서 데이터 (ID가 덮어씌워지지 않도록 순서 변경)
      onSnapshot(
        collection(db, "artifacts", safeAppId, "public", "data", "reports"),
        (s) => {
          const loadedReports = s.docs.map((d) => ({
            ...d.data(), // 1. 데이터를 먼저 펼치고
            id: d.id, // 2. ID를 나중에 덮어씌움 (ID 보장)
          }));
          setReports(loadedReports);
        }
      );
    });
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
    await batch.commit();
    showToast("기본 데이터 생성 완료");
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
  };

  // 2. [정의] 로그아웃 처리 함수
  const handleLogout = () => {
    if (window.confirm("로그아웃 하시겠습니까?")) {
      setCurrentUser(null);
      setActiveTab("dashboard");
    }
  };

  // 3. [정의] 학생 정보 저장 및 수정 (신규/수정 자동 판단 + 즉시 저장)
  // 원생 삭제 함수 추가
  const handleUpdateStudent = async (id, updatedData) => {
    try {
      const safeAppId = "jnc-music-v2";

      // [판별 로직] 상담 데이터(pending)를 처음 등록하는 경우인지 확인
      const isNewFromConsultation =
        !id ||
        (updatedData.status === "재원" &&
          id === updatedData.fromConsultationId);

      if (!isNewFromConsultation) {
        // ✅ [수정 모드] 기존에 'students' 컬렉션에 이미 존재하는 문서를 업데이트
        const studentRef = doc(
          db,
          "artifacts",
          safeAppId,
          "public",
          "data",
          "students",
          id
        );

        // 데이터 객체에서 id 필드가 중복 저장되지 않도록 추출 후 제거
        const { id: _, ...pureUpdateData } = updatedData;

        await updateDoc(studentRef, pureUpdateData);
        showToast("정보가 수정되었습니다.");
      } else {
        // ✨ [신규 등록 모드] 상담에서 넘어왔거나 아예 새로 만드는 경우 (문서 새로 생성)
        const studentsRef = collection(
          db,
          "artifacts",
          safeAppId,
          "public",
          "data",
          "students"
        );

        const { id: _, ...pureData } = updatedData;

        await addDoc(studentsRef, {
          ...pureData,
          createdAt: new Date().toISOString(),
        });
        showToast("새로운 원생으로 등록되었습니다.");
      }
    } catch (e) {
      console.error("저장 오류:", e);
      // 안전장치: 수정 실패 시(문서 없음 등) 신규 등록으로 재시도하거나 에러 안내
      if (e.message.includes("No document to update")) {
        handleUpdateStudent(null, updatedData);
      } else {
        showToast("저장에 실패했습니다.", "error");
      }
    }
  };
  // [기능 복구] 원생 정보를 영구 삭제하는 함수
  const handleDeleteStudent = async (studentId) => {
    if (
      !window.confirm(
        "정말로 삭제하시겠습니까? 서버 데이터도 영구히 삭제됩니다."
      )
    )
      return;

    try {
      const safeAppId = "jnc-music-v2";
      const studentRef = doc(
        db,
        "artifacts",
        safeAppId,
        "public",
        "data",
        "students",
        studentId
      );

      await deleteDoc(studentRef);
      showToast("원생 정보가 완전히 삭제되었습니다.");
    } catch (e) {
      console.error("❌ 삭제 실패:", e);
      showToast("삭제 중 오류가 발생했습니다.", "error");
    }
  };
  // 1. [본사에 물건 채우기] 실제 삭제 기능을 수행하는 함수

  // 5. [에러 해결 완료] 상담 -> 원생 등록 데이터 연동 함수
  const handleRegisterFromConsultation = (consultation) => {
    const isAdultData = consultation.type === "adult";

    const transferData = {
      ...consultation,
      name: consultation.name || "",
      phone: consultation.phone || "",
      subject: consultation.subject || "",
      grade: isAdultData ? "성인" : consultation.grade || "",
      fromConsultationId: consultation.id, // 보관함 이동용 ID
      status: "재원",
      registrationDate: new Date().toISOString().slice(0, 10),
      totalSessions: 4,
      schedules: {},
      teacher: teachers && teachers.length > 0 ? teachers[0].name : "",
    };

    setActiveTab("students");
    setRegisterFromConsultation(transferData);
    setTargetConsultation(null);
    showToast(`${consultation.name}님의 정보를 불러왔습니다.`);
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
        />
      </div>
    );
  }

  // ▲▲▲▲▲ [여기까지] return ( 바로 위에 있어야 합니다 ▲▲▲▲▲
  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
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
      />

      {/* 3. 좌측 사이드바 (3단 구조: 헤더 - 스크롤 메뉴 - 하단 고정) */}
      <div
        className={`fixed md:static inset-y-0 left-0 z-30 w-64 bg-white border-r transform transition-transform duration-300 ${
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
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            <Menu />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 w-full bg-slate-50">
          {activeTab === "dashboard" && (
            <DashboardView
              students={students}
              consultations={consultations}
              reports={reports}
              user={currentUser}
              onNavigateToConsultation={(consult) => {
                setTargetConsultation(consult);
                setActiveTab("consultations");
              }}
              onNavigate={(tab) => setActiveTab(tab)}
            />
          )}
          {activeTab === "timetable" && (
            <TeacherTimetableView
              students={students}
              teachers={teachers}
              user={currentUser}
            />
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
            />
          )}
          {activeTab === "payments" && currentUser.role === "admin" && (
            <PaymentView
              students={students}
              showToast={showToast}
              onSavePayment={handleSavePayment}
              onUpdatePaymentHistory={handleUpdatePaymentHistory}
              onUpdateStudent={handleUpdateStudent}
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

// [TeacherTimetableView] - 오늘 요일 자동 감지 + 안전장치 유지 버전
const TeacherTimetableView = ({ students, teachers, user }) => {
  // 1. [핵심 수정] 켜자마자 오늘 요일을 계산해서 기본값으로 넣습니다. (깜빡임 방지)
  const [selectedDay, setSelectedDay] = useState(() => {
    const todayNum = new Date().getDay(); // 0(일) ~ 6(토)
    const dayMap = ["일", "월", "화", "수", "목", "금", "토"];
    return dayMap[todayNum] || "월";
  });

  const DAYS = useMemo(() => ["월", "화", "수", "목", "금", "토", "일"], []);
  const HOURS = Array.from({ length: 10 }, (_, i) => i + 13); // 13시 ~ 22시

  const getSubjectColor = (subject) => {
    const map = {
      피아노: "bg-indigo-50 text-indigo-700 border-indigo-200",
      바이올린: "bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200",
      플루트: "bg-emerald-50 text-emerald-700 border-emerald-200",
      첼로: "bg-amber-50 text-amber-700 border-amber-200",
      성악: "bg-rose-50 text-rose-700 border-rose-200",
    };
    return map[subject] || "bg-slate-50 text-slate-600 border-slate-200";
  };

  const getLessonTime = useCallback(
    (student) => {
      if (!student) return null;
      if (student.status?.trim() !== "재원") return null;

      if (student.schedules && student.schedules[selectedDay])
        return student.schedules[selectedDay];
      if (student.className === selectedDay && student.time)
        return student.time;
      return null;
    },
    [selectedDay]
  );

  // [핵심] user 데이터가 들어오면 필터링 수행
  const activeTeachers = useMemo(() => {
    if (!user) return []; // 안전장치

    // 1. 강사 로그인: 내 이름과 일치하는 강사 정보 1개만 표시 (공백 제거 비교)
    if (user.role === "teacher") {
      // 내 이름의 공백을 모두 제거하고 비교 (이름 불일치 해결)
      const myNameClean = user.name.replace(/\s+/g, "");
      return teachers.filter((t) => t.name.replace(/\s+/g, "") === myNameClean);
    }

    // 2. 관리자 로그인: 전체 강사 표시
    return teachers;
  }, [teachers, user]);

  const getLessons = (teacherName, hour) => {
    return students.filter((s) => {
      // 이름 비교 시 공백 제거 (안전장치)
      const tName1 = (s.teacher || "").replace(/\s+/g, "");
      const tName2 = (teacherName || "").replace(/\s+/g, "");
      if (tName1 !== tName2) return false;

      const timeStr = getLessonTime(s);
      if (!timeStr) return false;

      const sHour = parseInt(timeStr.split(":")[0]);
      return sHour === hour;
    });
  };

  // user 데이터가 아직 안 왔으면 로딩 중 처리
  if (!user) return null;

  // 오늘 요일 계산 (UI 표시용)
  const currentDayLabel = ["일", "월", "화", "수", "목", "금", "토"][
    new Date().getDay()
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 h-full flex flex-col overflow-hidden animate-fade-in">
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 shrink-0 gap-4">
        <h2 className="text-xl font-bold flex items-center text-slate-800">
          <LayoutGrid className="mr-2 text-indigo-600" />
          {user.role === "admin" ? "강사별 주간 시간표" : "나의 수업 일정"}
        </h2>

        {/* 요일 선택 버튼 */}
        <div className="flex bg-slate-100 p-1 rounded-lg overflow-x-auto max-w-full no-scrollbar">
          {DAYS.map((day) => (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all whitespace-nowrap relative ${
                selectedDay === day
                  ? "bg-white text-indigo-600 shadow-sm ring-1 ring-indigo-100"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {day}
              {/* 오늘 요일인 경우 옆에 작은 점(Indicator) 표시 */}
              {day === currentDayLabel && (
                <span
                  className="ml-1 w-1.5 h-1.5 bg-red-400 rounded-full inline-block align-top"
                  title="오늘"
                ></span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto border rounded-xl bg-slate-50/50 relative">
        <div className="inline-block min-w-full">
          {/* 헤더 */}
          <div className="flex border-b bg-white sticky top-0 z-20 shadow-sm">
            <div className="w-[80px] p-4 text-center text-xs font-bold text-slate-400 border-r bg-slate-50 sticky left-0 z-30 shrink-0">
              TIME
            </div>

            {activeTeachers.length > 0 ? (
              <div className="flex flex-1 justify-center">
                {activeTeachers.map((t) => (
                  <div
                    key={t.id}
                    className="w-[160px] p-4 text-center text-base font-bold border-r text-slate-800 bg-white shrink-0"
                  >
                    {t.name} 선생님
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 p-10 text-center text-slate-400 font-medium">
                <p>표시할 강사 정보가 없습니다.</p>
                <p className="text-xs mt-2 opacity-70">
                  (Tip: 강사 관리 메뉴의 이름과 로그인 이름이 같은지
                  확인해주세요)
                </p>
              </div>
            )}
          </div>

          {/* 바디 */}
          <div className="divide-y divide-slate-200">
            {HOURS.map((hour) => (
              <div key={hour} className="flex min-h-[100px]">
                <div className="w-[80px] p-2 text-center text-xs font-bold text-slate-400 border-r bg-white flex flex-col justify-start pt-3 sticky left-0 z-10 shrink-0">
                  {hour}:00
                </div>
                {activeTeachers.length > 0 && (
                  <div className="flex flex-1 justify-center">
                    {activeTeachers.map((t) => {
                      const lessons = getLessons(t.name, hour);
                      return (
                        <div
                          key={t.id}
                          className="w-[160px] border-r p-2 bg-white hover:bg-slate-50 transition-colors shrink-0 flex flex-col gap-1"
                        >
                          {lessons.map((l, idx) => {
                            const timeTxt = getLessonTime(l);
                            return (
                              <div
                                key={idx}
                                className={`px-3 py-2 rounded-lg border text-xs shadow-sm cursor-pointer hover:scale-105 transition-transform ${getSubjectColor(
                                  l.subject
                                )}`}
                              >
                                <div className="font-bold flex justify-between items-center mb-1">
                                  <span className="text-sm truncate">
                                    {l.name}
                                  </span>
                                </div>
                                <div className="flex justify-between items-center opacity-80 text-[10px]">
                                  <span>{timeTxt}</span>
                                  <span>{l.grade}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
                {activeTeachers.length === 0 && (
                  <div className="flex-1 bg-transparent"></div>
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
