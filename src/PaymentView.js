// =================================================================
// PaymentView.js - 결제/수납센터 (4탭: 수납현황 / 발송센터 / 결제확인 / 수납관리)
// App.js에서 분리. 기존 함수/state 시그니처는 그대로 유지하고 UI만 4탭 구조로 재구성.
// =================================================================
import React, { useState, useMemo } from "react";
import {
  MessageSquareText,
  CreditCard,
  Search,
  X,
  AlertCircle,
  Copy,
  CheckCircle,
  Bell,
  Users,
  TrendingUp,
  Send,
  ChevronRight,
} from "lucide-react";

// -----------------------------------------------------------------
// 헬퍼 (App.js와 동일한 로직 - 모듈 단위 재정의)
// -----------------------------------------------------------------
const SMS_API_URL = process.env.REACT_APP_SMS_API_URL || "/api/send-sms";
const PAYMINT_SEND_URL =
  process.env.REACT_APP_PAYMINT_API_URL || "https://jncmusic.kr/api/paymint/send";

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

const sendKyuljesaengnim = async (student) => {
  const res = await fetch(PAYMINT_SEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studentId: student.id,
      studentName: student.name,
      phone: student.phone || "",
      price: String(student.tuitionFee || 0),
      subject: student.subject || "",
      totalSessions: student.totalSessions || 4,
      lastPaymentDate: student.lastPaymentDate || "",
    }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "결제선생 발송 실패");
  return data;
};

const toLocalDateStr = (date = new Date()) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const getEffectiveSessions = (student) => {
  const saved = parseInt(student.totalSessions);
  if (!isNaN(saved) && saved > 0) return saved;
  const scheduleCount = Object.keys(student.schedules || {}).length;
  return scheduleCount >= 2 ? 8 : 4;
};

// -----------------------------------------------------------------
// BulkMessageModal - 일괄 메시지 발송 (기존 로직 유지, generatePaymentMessage는 prop으로 전달)
// -----------------------------------------------------------------
export const BulkMessageModal = ({
  students,
  messageLogs,
  paymentUrl,
  onSaveLog,
  onClose,
  showToast,
  user,
  generatePaymentMessage,
}) => {
  const today = new Date().toISOString().split("T")[0];
  const [sent, setSent] = useState({});
  const [msgStyle, setMsgStyle] = useState("detailed");
  const [messages, setMessages] = useState(() => {
    const init = {};
    students.forEach((s) => {
      init[s.id] = generatePaymentMessage(s, paymentUrl, "detailed");
    });
    return init;
  });
  const [activeIdx, setActiveIdx] = useState(0);
  const [sendChannels, setSendChannels] = useState(() =>
    Object.fromEntries(
      students.map((s) => [s.id, { sms: true, kyuljesaengnim: false }])
    )
  );

  const handleStyleChange = (style) => {
    setMsgStyle(style);
    const updated = {};
    students.forEach((s) => {
      updated[s.id] = generatePaymentMessage(s, paymentUrl, style);
    });
    setMessages(updated);
  };

  const activeStudent = students[activeIdx];

  const handleCopySingle = (studentId) => {
    const msg = messages[studentId];
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(msg)
        .then(() => showToast("복사되었습니다.", "success"));
    }
  };

  const handleCopyAll = () => {
    const combined = students
      .map((s) => `=== ${s.name} ===\n${messages[s.id]}`)
      .join("\n\n");
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(combined)
        .then(() => showToast(`${students.length}명 전체 복사 완료`, "success"));
    }
  };

  const [sending, setSending] = useState({});

  const handleMarkSent = async (s, channels = ["sms"], extra = {}) => {
    if (sent[s.id]) return;
    try {
      if (onSaveLog) {
        await onSaveLog({
          studentId: s.id,
          studentName: s.name,
          phone: s.phone || "",
          sentAt: today,
          channels,
          messageType: "결제안내",
          sentBy: user?.name || "원장",
          ...extra,
        });
      }
      setSent((prev) => ({ ...prev, [s.id]: true }));
      showToast(`${s.name} 발송 완료 처리되었습니다.`, "success");
    } catch (e) {
      showToast("저장 오류: " + e.message, "error");
    }
  };

  const handleSendAll = async (s) => {
    const ch = sendChannels[s.id] || { sms: true, kyuljesaengnim: false };
    const channelArr = [];
    let kyuljesaengnimExtra = {};
    if (ch.sms && s.phone) {
      setSending((prev) => ({ ...prev, [s.id]: true }));
      try {
        await sendAligoSms(s.phone, messages[s.id]);
        channelArr.push("sms");
        showToast(`${s.name} 문자 발송 완료`, "success");
      } catch (e) {
        showToast(`${s.name} 문자 발송 실패: ${e.message}`, "error");
      } finally {
        setSending((prev) => ({ ...prev, [s.id]: false }));
      }
    } else if (ch.sms && !s.phone) {
      showToast(`${s.name}: 연락처가 없습니다.`, "warning");
    }
    if (ch.kyuljesaengnim) {
      try {
        const result = await sendKyuljesaengnim(s);
        channelArr.push("결제선생");
        kyuljesaengnimExtra = {
          billId: result.billId,
          shortURL: result.shortURL,
        };
        const urlNote = result.shortURL ? ` (링크: ${result.shortURL})` : "";
        showToast(`${s.name} 결제선생 발송 완료${urlNote}`, "success");
      } catch (e) {
        showToast(`${s.name} 결제선생 발송 실패: ${e.message}`, "error");
      }
    }
    if (channelArr.length) await handleMarkSent(s, channelArr, kyuljesaengnimExtra);
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
        <div className="flex justify-between items-center p-4 border-b shrink-0">
          <h3 className="text-lg font-bold flex items-center text-indigo-900">
            <MessageSquareText className="mr-2" size={20} />
            일괄 안내 메시지 ({students.length}명)
          </h3>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-bold">
              <button
                onClick={() => handleStyleChange("detailed")}
                className={`px-3 py-1.5 transition-colors ${
                  msgStyle === "detailed"
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                상세
              </button>
              <button
                onClick={() => handleStyleChange("simple")}
                className={`px-3 py-1.5 transition-colors ${
                  msgStyle === "simple"
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-slate-500 hover:bg-slate-50"
                }`}
              >
                간결
              </button>
            </div>
            <button
              onClick={handleCopyAll}
              className="px-3 py-1.5 text-xs border border-indigo-300 text-indigo-700 rounded-lg font-bold hover:bg-indigo-50 flex items-center gap-1"
            >
              <Copy size={13} /> 전체 복사
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-44 shrink-0 border-r overflow-y-auto bg-slate-50">
            {students.map((s, idx) => {
              const lastNotif = getLastNotif(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveIdx(idx)}
                  className={`w-full text-left px-3 py-2.5 border-b text-sm transition-colors ${
                    activeIdx === idx
                      ? "bg-indigo-100 border-l-4 border-l-indigo-600"
                      : "hover:bg-white"
                  }`}
                >
                  <div className="font-medium truncate">{s.name}</div>
                  <div className="text-xs text-slate-400 truncate">{s.subject}</div>
                  {sent[s.id] && (
                    <div className="text-xs text-emerald-600 font-bold mt-0.5">
                      ✓ 발송완료
                    </div>
                  )}
                  {!sent[s.id] && lastNotif && (
                    <div className="text-xs text-slate-400 mt-0.5">
                      최근: {lastNotif}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {activeStudent && (
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 pt-3 pb-2 shrink-0 flex-wrap gap-2">
                <div>
                  <span className="font-bold text-slate-800">
                    {activeStudent.name}
                  </span>
                  <span className="text-xs text-slate-500 ml-2">
                    {activeStudent.phone || "연락처 없음"}
                  </span>
                  {(() => {
                    const lastNotif = getLastNotif(activeStudent.id);
                    return lastNotif ? (
                      <span className="text-xs text-emerald-600 ml-2">
                        최근 안내: {lastNotif}
                      </span>
                    ) : null;
                  })()}
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-3 text-sm border rounded-lg px-3 py-1.5 bg-slate-50">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sendChannels[activeStudent.id]?.sms ?? true}
                        onChange={(e) =>
                          setSendChannels((prev) => ({
                            ...prev,
                            [activeStudent.id]: {
                              ...prev[activeStudent.id],
                              sms: e.target.checked,
                            },
                          }))
                        }
                        className="accent-blue-600"
                      />
                      📱 문자
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={
                          sendChannels[activeStudent.id]?.kyuljesaengnim ?? false
                        }
                        onChange={(e) =>
                          setSendChannels((prev) => ({
                            ...prev,
                            [activeStudent.id]: {
                              ...prev[activeStudent.id],
                              kyuljesaengnim: e.target.checked,
                            },
                          }))
                        }
                        className="accent-emerald-600"
                      />
                      💳 결제선생
                    </label>
                  </div>
                  <button
                    onClick={() => handleCopySingle(activeStudent.id)}
                    className="px-3 py-1.5 text-xs border rounded-lg font-bold flex items-center gap-1 hover:bg-slate-50"
                  >
                    <Copy size={13} /> 복사
                  </button>
                  <button
                    onClick={() => handleSendAll(activeStudent)}
                    disabled={!!sent[activeStudent.id] || !!sending[activeStudent.id]}
                    className={`px-3 py-1.5 text-xs rounded-lg font-bold flex items-center gap-1 transition-colors ${
                      sent[activeStudent.id]
                        ? "bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-default"
                        : sending[activeStudent.id]
                        ? "bg-blue-100 text-blue-600 border border-blue-200 cursor-wait"
                        : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                    }`}
                  >
                    {sent[activeStudent.id]
                      ? "✓ 발송완료"
                      : sending[activeStudent.id]
                      ? "발송 중..."
                      : "발송하기"}
                  </button>
                  <button
                    onClick={() => handleMarkSent(activeStudent)}
                    disabled={!!sent[activeStudent.id]}
                    className={`px-3 py-1.5 text-xs rounded-lg font-bold flex items-center gap-1 transition-colors ${
                      sent[activeStudent.id]
                        ? "bg-emerald-100 text-emerald-700 border border-emerald-200 cursor-default"
                        : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                    }`}
                  >
                    {sent[activeStudent.id] ? "✓ 완료" : "완료 처리"}
                  </button>
                </div>
              </div>
              <textarea
                className="flex-1 mx-4 mb-4 border rounded-xl p-4 text-sm font-sans leading-relaxed focus:outline-indigo-500 resize-none bg-slate-50"
                value={messages[activeStudent.id] || ""}
                onChange={(e) =>
                  setMessages((prev) => ({
                    ...prev,
                    [activeStudent.id]: e.target.value,
                  }))
                }
                spellCheck="false"
              />
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-slate-50 rounded-b-2xl flex justify-between items-center shrink-0">
          <span className="text-xs text-slate-500">
            발송 완료:{" "}
            <span className="font-bold text-emerald-600">
              {Object.values(sent).filter(Boolean).length}
            </span>{" "}
            / {students.length}명
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-200 text-slate-700 rounded-lg font-bold hover:bg-slate-300"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};

// -----------------------------------------------------------------
// PaymentView - 4탭 구조
// Props:
//   students, showToast, onSavePayment, onUpdatePaymentHistory,
//   onUpdateStudent, messageLogs, onSaveMessageLog, paymentUrl,
//   user, generatePaymentMessage, onOpenStudentDetail
// -----------------------------------------------------------------
export const PaymentView = ({
  students,
  showToast,
  onSavePayment,
  onUpdatePaymentHistory,
  onUpdateStudent,
  messageLogs = [],
  onSaveMessageLog,
  paymentUrl = "",
  user,
  generatePaymentMessage,
  onOpenStudentDetail,
}) => {
  // ── 탭 상태 (today | send | confirm | manage) ──────────────────
  const [activeTab, setActiveTab] = useState("today");

  // ── 공통 필터 상태 ─────────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState("");

  // ── 발송센터(send) 탭 상태 ────────────────────────────────────
  const [sentFilter, setSentFilter] = useState("");  // "" | "none" | "sms-only" | "done"
  const [filterWeek, setFilterWeek] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showBulkModal, setShowBulkModal] = useState(false);

  // ── 개별 메시지 미리보기 상태 ──────────────────────────────────
  const [showMsgPreview, setShowMsgPreview] = useState(false);
  const [msgContent, setMsgContent] = useState("");
  const [msgStudent, setMsgStudent] = useState(null);
  const [msgSending, setMsgSending] = useState(false);
  const [msgStyle, setMsgStyle] = useState("detailed");

  // ── 결제확인(confirm) 탭 상태 ─────────────────────────────────
  const [paymentMethods, setPaymentMethods] = useState({});
  const [completedPeriod, setCompletedPeriod] = useState("today");
  const [processQuickPay, setProcessQuickPay] = useState(null);
  const [processPayDate, setProcessPayDate] = useState(toLocalDateStr());

  // ── 수납현황(today) 빠른 결제입력 상태 ───────────────────────
  const [quickPayStudent, setQuickPayStudent] = useState(null);
  const [quickPayDate, setQuickPayDate] = useState("");

  // ── 수강 진척도 헬퍼 ──────────────────────────────────────────
  const getStudentProgress = (s) => {
    const totalAttended = (s.attendanceHistory || [])
      .filter((h) => h.status === "present" || h.status === "canceled")
      .reduce((sum, h) => sum + (h.status === "canceled" ? 1 : (h.count || 1)), 0);
    const sessionUnit = getEffectiveSessions(s);
    const sortedPayments = [...(s.paymentHistory || [])].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    const scheduleBasedUnit =
      Object.keys(s.schedules || {}).length >= 2 ? 8 : 4;
    const legacyFallback =
      sortedPayments.find((p) => p.totalSessions > 0)?.totalSessions ||
      scheduleBasedUnit;
    const totalPaidCapacity = sortedPayments.reduce(
      (sum, p) => sum + (p.totalSessions || legacyFallback),
      0
    );
    const remainingCapacity = totalPaidCapacity - totalAttended;
    const lastPayUnit =
      sortedPayments.length > 0
        ? sortedPayments[sortedPayments.length - 1].totalSessions || legacyFallback
        : sessionUnit;
    const lastCycleStart = Math.max(0, totalPaidCapacity - lastPayUnit);
    let currentUsage = Math.max(0, totalAttended - lastCycleStart);
    if (currentUsage === 0 && totalAttended > 0 && remainingCapacity <= 0)
      currentUsage = lastPayUnit;
    const isOverdue = remainingCapacity < 0;
    const isCompleted = remainingCapacity === 0 && totalPaidCapacity > 0;
    return {
      currentUsage,
      sessionUnit: lastPayUnit,
      isOverdue,
      isCompleted,
      displayStatus: isOverdue ? "미납 (초과)" : isCompleted ? "수강권 만료" : "수강 중",
      statusColor: isOverdue
        ? "bg-rose-100 text-rose-700 font-bold"
        : isCompleted
        ? "bg-amber-100 text-amber-700 font-bold"
        : "bg-emerald-100 text-emerald-700",
    };
  };

  // ── 강사 목록 (드롭다운) ──────────────────────────────────────
  const teacherOptions = useMemo(() => {
    const set = new Set();
    students.forEach((s) => { if (s.teacher) set.add(s.teacher); });
    return Array.from(set).sort();
  }, [students]);

  // ── 발송 상태 (none / sms-only / done) ───────────────────────
  const getNotifStatus = (studentId) => {
    const logs = messageLogs
      .filter((l) => l.studentId === studentId)
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    if (!logs.length) return "none";
    const latest = logs[0];
    const ch = latest.channels || (latest.channel ? ["sms"] : []);
    if (ch.includes("결제선생")) return "done";
    if (ch.includes("sms")) return "sms-only";
    return "none";
  };

  const getLastNotifDate = (studentId) => {
    const logs = messageLogs
      .filter((l) => l.studentId === studentId)
      .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
    return logs.length > 0 ? logs[0].sentAt : null;
  };

  const isThisMonth = (dateStr) => {
    if (!dateStr) return false;
    return dateStr.slice(0, 7) === new Date().toISOString().slice(0, 7);
  };

  // ── 오늘 회차 완료 학생 (수납현황 탭) ────────────────────────
  // 오늘 출석 기록이 있고, 해당 출석으로 결제 주기(4회/8회)가 꽉 찬 학생
  const todayCycleComplete = useMemo(() => {
    const todayStr = toLocalDateStr();
    return students.filter((s) => {
      if (s.status !== "재원") return false;
      const history = s.attendanceHistory || [];
      const todayRecord = history.find(
        (h) => h.date === todayStr && (h.status === "present" || h.status === "canceled")
      );
      if (!todayRecord) return false;
      const total = getEffectiveSessions(s);
      const sessions = history
        .filter((h) => h.status === "present" || h.status === "canceled")
        .sort((a, b) => a.date.localeCompare(b.date));
      let cumulative = 0;
      for (const h of sessions) {
        const cnt = h.status === "canceled" ? 1 : (h.count || 1);
        cumulative += cnt;
        if (h.date === todayStr) return cumulative % total === 0;
        if (h.date > todayStr) break;
      }
      return false;
    });
  }, [students]);

  // ── 오늘 결제 완료 목록 ───────────────────────────────────────
  const todayPaidList = useMemo(() => {
    const todayStr = toLocalDateStr();
    const results = [];
    students.filter((s) => s.status === "재원").forEach((s) => {
      (s.paymentHistory || []).forEach((p) => {
        if (p.date === todayStr) results.push({ student: s, payment: p });
      });
    });
    return results.sort((a, b) => b.payment.date.localeCompare(a.payment.date));
  }, [students]);

  // ── 발송센터(send) 탭 필터링 목록 ────────────────────────────
  const sendList = useMemo(() => {
    const today = new Date();
    const dayOfWeek = (today.getDay() + 6) % 7;
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - dayOfWeek);
    weekStart.setHours(0, 0, 0, 0);
    const weekStartStr = weekStart.toISOString().split("T")[0];

    const filtered = students.filter((s) => {
      const { isOverdue, isCompleted } = getStudentProgress(s);
      const isDue = isCompleted || isOverdue;
      if (!isDue) return false;
      if (s.status !== "재원") return false;
      const matchesSearch =
        s.name.includes(searchTerm) ||
        (s.subject && s.subject.includes(searchTerm)) ||
        (s.teacher && s.teacher.includes(searchTerm));
      const matchesTeacher = !selectedTeacher || s.teacher === selectedTeacher;
      const notifStatus = getNotifStatus(s.id);
      const matchesSent =
        sentFilter === "none" ? notifStatus === "none" :
        sentFilter === "sms-only" ? notifStatus === "sms-only" :
        sentFilter === "done" ? notifStatus === "done" : true;
      const lastNotif = messageLogs
        .filter((l) => l.studentId === s.id)
        .sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0]?.sentAt || null;
      const matchesWeek =
        !filterWeek || ((isCompleted || isOverdue) && (!lastNotif || lastNotif < weekStartStr));
      return matchesSearch && matchesTeacher && matchesSent && matchesWeek;
    });

    filtered.sort((a, b) => {
      const da = messageLogs
        .filter((l) => l.studentId === a.id)
        .sort((x, y) => y.sentAt.localeCompare(x.sentAt))[0]?.sentAt || "";
      const db = messageLogs
        .filter((l) => l.studentId === b.id)
        .sort((x, y) => y.sentAt.localeCompare(x.sentAt))[0]?.sentAt || "";
      return da.localeCompare(db);
    });
    return filtered;
  }, [students, sentFilter, searchTerm, selectedTeacher, filterWeek, messageLogs]);

  // ── 결제확인(confirm) 탭 계산 ─────────────────────────────────
  const processableStudents = useMemo(() =>
    students
      .filter((s) => {
        const { isCompleted, isOverdue } = getStudentProgress(s);
        return s.status === "재원" && (isCompleted || isOverdue);
      })
      .sort((a, b) => a.name.localeCompare(b.name, "ko")),
    [students]
  );

  const recentlyPaidList = useMemo(() => {
    const now = new Date();
    let cutoff;
    if (completedPeriod === "today") {
      cutoff = toLocalDateStr(now);
    } else if (completedPeriod === "week") {
      const d = new Date(now);
      d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
      cutoff = toLocalDateStr(d);
    } else {
      cutoff = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    }
    const results = [];
    students.filter((s) => s.status === "재원").forEach((s) => {
      (s.paymentHistory || []).forEach((p) => {
        if (p.date >= cutoff) results.push({ student: s, payment: p });
      });
    });
    return results.sort((a, b) => b.payment.date.localeCompare(a.payment.date));
  }, [students, completedPeriod]);

  const getMethodForStudent = (s) => paymentMethods[s.id] || s.lastPaymentMethod || "";

  // ── 수납관리(manage) 탭 전체 목록 ────────────────────────────
  const manageList = useMemo(() => {
    return students
      .filter((s) => {
        if (s.status !== "재원") return false;
        return (
          s.name.includes(searchTerm) ||
          (s.subject && s.subject.includes(searchTerm)) ||
          (s.teacher && s.teacher.includes(searchTerm))
        );
      })
      .filter((s) => !selectedTeacher || s.teacher === selectedTeacher)
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [students, searchTerm, selectedTeacher]);

  // ── 이벤트 핸들러 ─────────────────────────────────────────────
  const toggleSelect = (id) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const handleOpenMsgPreview = (e, student, style = msgStyle) => {
    e.stopPropagation();
    setMsgContent(generatePaymentMessage(student, paymentUrl, style));
    setMsgStudent(student);
    setShowMsgPreview(true);
  };

  const handleQuickPaySave = async () => {
    if (!quickPayStudent || !quickPayDate) return;
    try {
      await onSavePayment(
        quickPayStudent.id,
        quickPayDate,
        parseInt(quickPayStudent.tuitionFee || 0),
        quickPayDate
      );
      showToast(`${quickPayStudent.name} 결제 완료 저장`, "success");
      setQuickPayStudent(null);
      setQuickPayDate("");
    } catch (e) {
      showToast("저장 오류: " + e.message, "error");
    }
  };

  // ── 탭 메타 정보 ─────────────────────────────────────────────
  const TABS = [
    { id: "today", label: "수납현황", icon: <Bell size={14} />, badge: todayCycleComplete.length || null },
    { id: "send", label: "발송센터", icon: <Send size={14} />, badge: sendList.filter(s => getNotifStatus(s.id) === "none").length || null },
    { id: "confirm", label: "결제확인", icon: <CreditCard size={14} />, badge: processableStudents.length || null },
    { id: "manage", label: "수납관리", icon: <Users size={14} />, badge: null },
  ];

  // =================================================================
  // 인라인 모달 렌더링 (개별 메시지 미리보기 / 빠른 결제입력 2종)
  // =================================================================
  return (
    <div className="bg-white rounded-xl shadow-sm border h-full flex flex-col overflow-hidden animate-fade-in relative">

      {/* ── 개별 메시지 미리보기 모달 ─────────────────────────── */}
      {showMsgPreview && (
        <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm">
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
              <div className="flex items-center justify-between mb-2 shrink-0">
                <div className="text-sm text-slate-500 flex items-center">
                  <AlertCircle size={14} className="mr-1" /> 내용을 확인하고 필요하면 직접 수정한 뒤 복사하세요.
                </div>
                <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-bold">
                  {["detailed", "simple"].map((s) => (
                    <button
                      key={s}
                      onClick={() => {
                        setMsgStyle(s);
                        setMsgContent(generatePaymentMessage(msgStudent, paymentUrl, s));
                      }}
                      className={`px-3 py-1 transition-colors ${msgStyle === s ? "bg-indigo-600 text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}
                    >
                      {s === "detailed" ? "상세" : "간결"}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                className="w-full flex-1 border border-slate-300 rounded-lg p-4 text-sm font-sans leading-relaxed focus:outline-indigo-500 resize-none bg-slate-50"
                value={msgContent}
                onChange={(e) => setMsgContent(e.target.value)}
                spellCheck="false"
              />
            </div>
            <div className="p-4 border-t bg-slate-50 rounded-b-xl flex justify-end gap-3 shrink-0 flex-wrap">
              <button onClick={() => setShowMsgPreview(false)} className="px-5 py-2.5 rounded-lg text-slate-600 hover:bg-slate-200 font-bold">취소</button>
              <button
                onClick={() => {
                  if (navigator.clipboard) {
                    navigator.clipboard.writeText(msgContent).then(() => {
                      showToast("안내 문구가 복사되었습니다!", "success");
                      setShowMsgPreview(false);
                    });
                  }
                }}
                className="px-6 py-2.5 rounded-lg bg-indigo-600 text-white font-bold hover:bg-indigo-700 shadow-lg flex items-center"
              >
                <Copy size={18} className="mr-2" /> 복사하기
              </button>
              {msgStudent?.phone && (
                <button
                  onClick={async () => {
                    setMsgSending(true);
                    try {
                      await sendAligoSms(msgStudent.phone, msgContent);
                      if (onSaveMessageLog)
                        await onSaveMessageLog({ studentId: msgStudent.id, studentName: msgStudent.name, phone: msgStudent.phone, sentAt: new Date().toISOString().split("T")[0], channels: ["sms"], messageType: "결제안내", sentBy: user?.name || "원장" });
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
              <button
                onClick={async () => {
                  try {
                    const result = await sendKyuljesaengnim(msgStudent);
                    if (onSaveMessageLog)
                      await onSaveMessageLog({ studentId: msgStudent.id, studentName: msgStudent.name, phone: msgStudent.phone || "", sentAt: new Date().toISOString().split("T")[0], channels: ["결제선생"], messageType: "결제안내", sentBy: user?.name || "원장", billId: result.billId, shortURL: result.shortURL });
                    showToast(`${msgStudent.name} 결제선생 발송 완료`, "success");
                    setShowMsgPreview(false);
                  } catch (e) {
                    showToast("결제선생 발송 실패: " + e.message, "error");
                  }
                }}
                disabled={msgSending}
                className="px-6 py-2.5 rounded-lg bg-emerald-600 text-white font-bold hover:bg-emerald-700 shadow-lg flex items-center disabled:opacity-60"
              >
                💳 결제선생
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 수납현황 탭: 빠른 결제입력 모달 ─────────────────────── */}
      {quickPayStudent && (
        <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold mb-1 flex items-center text-emerald-700">
              <CreditCard className="mr-2" size={20} /> 결제 완료 입력
            </h3>
            <p className="text-sm text-slate-500 mb-4">{quickPayStudent.name} ({quickPayStudent.subject})</p>
            <div className="mb-4">
              <label className="block text-xs font-bold text-slate-500 mb-1">결제일자</label>
              <input type="date" value={quickPayDate} onChange={(e) => setQuickPayDate(e.target.value)}
                className="w-full p-3 border rounded-xl bg-slate-50 focus:outline-emerald-500 text-sm" />
            </div>
            <div className="mb-3">
              <label className="block text-xs font-bold text-slate-500 mb-1">결제금액</label>
              <div className="p-3 border rounded-xl bg-slate-50 text-sm font-bold text-indigo-600">
                {Number(quickPayStudent.tuitionFee || 0).toLocaleString()}원
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => { setQuickPayStudent(null); setQuickPayDate(""); }}
                className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg font-bold">취소</button>
              <button onClick={handleQuickPaySave} disabled={!quickPayDate}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 shadow-md disabled:opacity-40">저장</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 결제확인 탭: 수납 완료 처리 모달 ────────────────────── */}
      {processQuickPay && (
        <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold mb-1 flex items-center text-emerald-700">
              <CreditCard className="mr-2" size={20} /> 수납 완료 처리
            </h3>
            <p className="text-sm text-slate-500 mb-1">{processQuickPay.student.name} ({processQuickPay.student.subject})</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium mb-4 inline-block ${
              processQuickPay.method === "계좌이체" ? "bg-emerald-100 text-emerald-700" : "bg-indigo-100 text-indigo-700"
            }`}>{processQuickPay.method}</span>
            <div className="mb-4 mt-3">
              <label className="block text-xs font-bold text-slate-500 mb-1">결제일자</label>
              <input type="date" value={processPayDate} onChange={(e) => setProcessPayDate(e.target.value)}
                className="w-full p-3 border rounded-xl bg-slate-50 focus:outline-emerald-500 text-sm" />
            </div>
            <div className="mb-3">
              <label className="block text-xs font-bold text-slate-500 mb-1">결제금액</label>
              <div className="p-3 border rounded-xl bg-slate-50 text-sm font-bold text-indigo-600">
                {Number(processQuickPay.student.tuitionFee || 0).toLocaleString()}원
              </div>
            </div>
            <div className="flex gap-2 justify-end mt-4">
              <button onClick={() => setProcessQuickPay(null)} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg font-bold">취소</button>
              <button
                onClick={async () => {
                  if (!processPayDate) return;
                  try {
                    await onSavePayment(processQuickPay.student.id, processPayDate, parseInt(processQuickPay.student.tuitionFee || 0), processPayDate, processQuickPay.method);
                    showToast(`${processQuickPay.student.name} 수납 완료`, "success");
                    setProcessQuickPay(null);
                  } catch (e) {
                    showToast("저장 오류: " + e.message, "error");
                  }
                }}
                disabled={!processPayDate}
                className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 shadow-md disabled:opacity-40"
              >완료 처리</button>
            </div>
          </div>
        </div>
      )}

      {/* ── 발송센터 탭: 일괄 메시지 모달 ───────────────────────── */}
      {showBulkModal && (
        <BulkMessageModal
          students={sendList.filter((s) => selectedIds.includes(s.id))}
          messageLogs={messageLogs}
          paymentUrl={paymentUrl}
          onSaveLog={onSaveMessageLog}
          onClose={() => setShowBulkModal(false)}
          showToast={showToast}
          user={user}
          generatePaymentMessage={generatePaymentMessage}
        />
      )}

      {/* ── 헤더: 탭 네비게이션 + 공통 검색 ───────────────────── */}
      <div className="px-5 pt-4 pb-0 shrink-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <CreditCard size={20} className="text-indigo-600" /> 결제/수납센터
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input
                placeholder="이름, 과목, 강사 검색"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 pr-4 py-1.5 border rounded-lg text-sm bg-slate-50 focus:outline-indigo-500 w-44"
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
          </div>
        </div>

        {/* 탭 버튼 */}
        <div className="flex border-b">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setSelectedIds([]); }}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                activeTab === tab.id
                  ? "border-indigo-600 text-indigo-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.badge > 0 && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                  activeTab === tab.id ? "bg-indigo-100 text-indigo-700" : "bg-slate-200 text-slate-600"
                }`}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── 탭 콘텐츠 ─────────────────────────────────────────── */}
      {/* today/confirm: 카드 스택 → 내부 overflow-auto로 스크롤  */}
      {/* send/manage: 테이블 고정 높이 → flex-col + 테이블 overflow-auto */}
      <div className="flex-1 min-h-0 flex flex-col">

        {/* ============================================================
            탭 1: 수납현황 (today)
            - 오늘 4회/8회차 완료 학생 (결제 안내 대상)
            - 오늘 결제 완료 목록
        ============================================================ */}
        {activeTab === "today" && (
          <div className="flex-1 overflow-auto p-5 flex flex-col gap-5 min-h-0">
            {/* 오늘 회차 완료 → 결제 안내 대상 */}
            <div className="border rounded-xl overflow-hidden">
              <div className="bg-amber-50 px-4 py-2.5 flex items-center justify-between border-b">
                <div className="flex items-center gap-2">
                  <Bell size={15} className="text-amber-600" />
                  <span className="font-bold text-amber-700 text-sm">오늘 회차 완료 — 결제 안내 대상</span>
                  <span className="bg-amber-200 text-amber-800 text-xs px-1.5 py-0.5 rounded-full">{todayCycleComplete.length}명</span>
                </div>
                {todayCycleComplete.length > 0 && (
                  <button
                    onClick={() => {
                      setSelectedIds(todayCycleComplete.map((s) => s.id));
                      setActiveTab("send");
                    }}
                    className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-1"
                  >
                    <Send size={12} /> 발송센터로 이동
                  </button>
                )}
              </div>

              {todayCycleComplete.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-sm">
                  오늘 회차가 완료된 학생이 없습니다.
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b text-xs text-slate-400 uppercase">
                    <tr>
                      <th className="py-2.5 px-4 text-left">이름 / 과목</th>
                      <th className="py-2.5 px-4 text-left">강사</th>
                      <th className="py-2.5 px-4 text-center">완료 회차</th>
                      <th className="py-2.5 px-4 text-right">원비</th>
                      <th className="py-2.5 px-4 text-left">최종결제일</th>
                      <th className="py-2.5 px-4 text-center">안내 발송</th>
                      <th className="py-2.5 px-4 text-center">결제 완료</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {todayCycleComplete.map((s) => {
                      const total = getEffectiveSessions(s);
                      const notifSt = getNotifStatus(s.id);
                      return (
                        <tr key={s.id} className="hover:bg-amber-50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold">{s.name}</div>
                            <div className="text-xs text-slate-400">{s.subject}</div>
                          </td>
                          <td className="py-3 px-4 text-slate-600">{s.teacher || "-"}</td>
                          <td className="py-3 px-4 text-center">
                            <span className="inline-block bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">
                              {total}회차 완료
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-indigo-600">
                            {Number(s.tuitionFee || 0).toLocaleString()}원
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-500">
                            {s.lastPaymentDate
                              ? `${parseInt(s.lastPaymentDate.slice(5, 7))}월 ${parseInt(s.lastPaymentDate.slice(8, 10))}일`
                              : <span className="text-slate-300">없음</span>}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {notifSt !== "none" && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium mr-1 ${
                                  notifSt === "done" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                }`}>
                                  {notifSt === "done" ? "🟢 발송완료" : "🟡 SMS만"}
                                </span>
                              )}
                              <button
                                onClick={(e) => handleOpenMsgPreview(e, s)}
                                className="px-2 py-1 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 font-medium"
                              >
                                <MessageSquareText size={12} className="inline mr-0.5" />안내
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); sendKyuljesaengnim(s).then(async (result) => { if (onSaveMessageLog) await onSaveMessageLog({ studentId: s.id, studentName: s.name, phone: s.phone || "", sentAt: toLocalDateStr(), channels: ["결제선생"], messageType: "결제안내", sentBy: user?.name || "원장", billId: result.billId, shortURL: result.shortURL }); showToast(`${s.name} 결제선생 발송 완료`, "success"); }).catch(err => showToast("결제선생 발송 실패: " + err.message, "error")); }}
                                className="px-2 py-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 font-medium"
                              >
                                💳
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => { setQuickPayStudent(s); setQuickPayDate(toLocalDateStr()); }}
                              className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold shadow-sm"
                            >
                              결제 완료 ✓
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* 오늘 결제 완료 목록 */}
            <div className="border rounded-xl overflow-hidden">
              <div className="bg-emerald-50 px-4 py-2.5 flex items-center gap-2 border-b">
                <CheckCircle size={15} className="text-emerald-600" />
                <span className="font-bold text-emerald-700 text-sm">오늘 결제 완료</span>
                <span className="bg-emerald-200 text-emerald-800 text-xs px-1.5 py-0.5 rounded-full">{todayPaidList.length}건</span>
              </div>
              {todayPaidList.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-sm">오늘 결제 완료된 내역이 없습니다.</div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b text-xs text-slate-400 uppercase">
                    <tr>
                      <th className="py-2.5 px-4 text-left">이름 / 과목</th>
                      <th className="py-2.5 px-4 text-left">강사</th>
                      <th className="py-2.5 px-4 text-right">금액</th>
                      <th className="py-2.5 px-4 text-center">결제방법</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {todayPaidList.map(({ student: s, payment: p }, i) => (
                      <tr key={`${s.id}-${i}`} className="hover:bg-emerald-50 transition-colors">
                        <td className="py-2.5 px-4">
                          <div className="font-medium">{s.name}</div>
                          <div className="text-xs text-slate-400">{s.subject}</div>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">{s.teacher || "-"}</td>
                        <td className="py-2.5 px-4 text-right font-bold text-indigo-600">
                          {Number(p.amount || 0).toLocaleString()}원
                        </td>
                        <td className="py-2.5 px-4 text-center">
                          {p.method ? (
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              p.method === "결제선생" ? "bg-blue-100 text-blue-700" :
                              p.method === "현장" ? "bg-indigo-100 text-indigo-700" :
                              p.method === "계좌이체" ? "bg-emerald-100 text-emerald-700" :
                              "bg-slate-100 text-slate-600"
                            }`}>{p.method}</span>
                          ) : <span className="text-slate-300">-</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* ============================================================
            탭 2: 발송센터 (send)
            - 미납/만료 학생 목록 + 발송 필터
            - 체크박스 → 일괄 메시지 발송 (BulkMessageModal)
            - 개별 row → 미리보기 / 결제선생 직발송
        ============================================================ */}
        {activeTab === "send" && (
          <div className="flex-1 flex flex-col min-h-0 p-5 gap-3">
            {/* 필터 바 */}
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                onClick={() => setFilterWeek(!filterWeek)}
                className={`px-3 py-1.5 rounded text-sm border flex items-center gap-1 transition-colors ${filterWeek ? "bg-violet-50 border-violet-300 text-violet-700 font-bold" : "bg-white hover:bg-slate-50"}`}
              >
                <Bell size={13} /> {filterWeek ? "주간 해제" : "주간 미발송"}
              </button>
              <button
                onClick={() => setSentFilter(
                  sentFilter === "" ? "none" :
                  sentFilter === "none" ? "sms-only" :
                  sentFilter === "sms-only" ? "done" : ""
                )}
                className={`px-3 py-1.5 rounded text-sm border flex items-center gap-1 transition-colors font-medium ${
                  sentFilter === "none" ? "bg-rose-50 border-rose-300 text-rose-700" :
                  sentFilter === "sms-only" ? "bg-amber-50 border-amber-300 text-amber-700" :
                  sentFilter === "done" ? "bg-emerald-50 border-emerald-300 text-emerald-700" :
                  "bg-white hover:bg-slate-50"
                }`}
              >
                <MessageSquareText size={13} />
                {sentFilter === "none" ? "🔴 미발송만" : sentFilter === "sms-only" ? "🟡 결제선생 미발송" : sentFilter === "done" ? "🟢 발송완료" : "발송 필터"}
              </button>
              <span className="text-sm text-slate-500 ml-1">
                미납/만료 <span className="font-bold text-rose-600">{sendList.length}명</span>
              </span>
            </div>

            {/* 일괄 선택 액션 바 */}
            {selectedIds.length > 0 && (
              <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5 shrink-0">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-indigo-700 font-bold">{selectedIds.length}명 선택됨</span>
                  <span className="text-slate-500">|</span>
                  <span className="text-slate-600">
                    총{" "}
                    <span className="font-bold text-rose-600">
                      {sendList.filter(s => selectedIds.includes(s.id)).reduce((sum, s) => sum + (Number(s.tuitionFee) || 0), 0).toLocaleString()}원
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setSelectedIds([])} className="px-3 py-1.5 text-xs text-slate-500 hover:bg-indigo-100 rounded-lg font-bold">선택 해제</button>
                  <button
                    onClick={() => setShowBulkModal(true)}
                    className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-bold hover:bg-indigo-700 shadow-sm flex items-center gap-1"
                  >
                    <MessageSquareText size={14} /> 메시지 생성 ({selectedIds.length})
                  </button>
                </div>
              </div>
            )}

            {/* 학생 목록 */}
            <div className="border rounded-xl overflow-auto flex-1 min-h-0">
              <table className="w-full text-sm min-w-[600px]">
                <thead className="sticky top-0 bg-slate-50 border-b">
                  <tr className="text-slate-400 text-xs uppercase">
                    <th className="py-3 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={sendList.length > 0 && selectedIds.length === sendList.length}
                        onChange={() => setSelectedIds(selectedIds.length === sendList.length ? [] : sendList.map(s => s.id))}
                        className="w-4 h-4 rounded accent-indigo-600"
                      />
                    </th>
                    <th className="py-3 px-4 text-left">이름 / 과목</th>
                    <th className="py-3 px-4 text-left">강사</th>
                    <th className="py-3 px-4 text-right">원비</th>
                    <th className="py-3 px-4 text-left">상태</th>
                    <th className="py-3 px-4 text-left">최종결제일</th>
                    <th className="py-3 px-4 text-left">마지막 안내</th>
                    <th className="py-3 px-4 text-center">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {sendList.map((s) => {
                    const { displayStatus, statusColor } = getStudentProgress(s);
                    const lastNotif = getLastNotifDate(s.id);
                    const notifSt = getNotifStatus(s.id);
                    return (
                      <tr
                        key={s.id}
                        className={`border-b transition-colors cursor-pointer ${selectedIds.includes(s.id) ? "bg-indigo-50" : "hover:bg-slate-50"}`}
                        onClick={() => toggleSelect(s.id)}
                      >
                        <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(s.id)}
                            onChange={() => toggleSelect(s.id)}
                            className="w-4 h-4 rounded accent-indigo-600"
                          />
                        </td>
                        <td className="py-3 px-4 font-medium">
                          {s.name}
                          {s.subject && <span className="text-xs text-slate-500 ml-1">({s.subject})</span>}
                          {s.phone && <div className="text-xs text-slate-400">{s.phone}</div>}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{s.teacher || "-"}</td>
                        <td className="py-3 px-4 text-right font-bold text-indigo-600">
                          {s.tuitionFee ? Number(s.tuitionFee).toLocaleString() : 0}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor}`}>{displayStatus}</span>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500">
                          {s.lastPaymentDate
                            ? `${parseInt(s.lastPaymentDate.slice(5,7))}/${parseInt(s.lastPaymentDate.slice(8,10))}`
                            : <span className="text-slate-300">-</span>}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {notifSt === "done" ? (
                            <span className={`font-medium ${isThisMonth(lastNotif) ? "text-emerald-600" : "text-emerald-400"}`}>
                              🟢 {lastNotif}{!isThisMonth(lastNotif) && " (지난달)"}
                            </span>
                          ) : notifSt === "sms-only" ? (
                            <span className={`font-medium ${isThisMonth(lastNotif) ? "text-amber-600" : "text-amber-400"}`}>
                              🟡 {lastNotif}{!isThisMonth(lastNotif) && " (지난달)"}
                            </span>
                          ) : (
                            <span className="text-rose-400">🔴 미발송</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={(e) => handleOpenMsgPreview(e, s)}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                              title="안내 문자 미리보기"
                            >
                              <MessageSquareText size={16} />
                            </button>
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  const result = await sendKyuljesaengnim(s);
                                  if (onSaveMessageLog)
                                    await onSaveMessageLog({ studentId: s.id, studentName: s.name, phone: s.phone || "", sentAt: toLocalDateStr(), channels: ["결제선생"], messageType: "결제안내", sentBy: user?.name || "원장", billId: result.billId, shortURL: result.shortURL });
                                  showToast(`${s.name} 결제선생 발송 완료`, "success");
                                } catch (err) {
                                  showToast("결제선생 발송 실패: " + err.message, "error");
                                }
                              }}
                              className="px-2 py-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 font-medium"
                              title="결제선생 발송"
                            >
                              💳
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {sendList.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        결제 안내가 필요한 학생이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================
            탭 3: 결제확인 (confirm)
            - 결제 예정자 (미납/만료) + 결제방법 선택 → 수납 완료 처리
            - 결제 완료자 (기간별 필터)
        ============================================================ */}
        {activeTab === "confirm" && (
          <div className="flex-1 overflow-auto p-5 flex flex-col gap-5 min-h-0">
            {/* 결제 예정자 */}
            <div className="border rounded-xl overflow-hidden shrink-0">
              <div className="bg-rose-50 px-4 py-2.5 flex items-center gap-2 border-b">
                <AlertCircle size={15} className="text-rose-600" />
                <span className="font-bold text-rose-700 text-sm">결제 예정자</span>
                <span className="bg-rose-200 text-rose-800 text-xs px-1.5 py-0.5 rounded-full">{processableStudents.length}명</span>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b text-xs text-slate-400 uppercase">
                  <tr>
                    <th className="py-2.5 px-4 text-left">이름 / 과목</th>
                    <th className="py-2.5 px-4 text-left">강사</th>
                    <th className="py-2.5 px-4 text-right">원비</th>
                    <th className="py-2.5 px-4 text-left">최종결제일</th>
                    <th className="py-2.5 px-4 text-center">결제방법</th>
                    <th className="py-2.5 px-4 text-center w-32">액션</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {processableStudents.map((s) => {
                    const method = getMethodForStudent(s);
                    const { displayStatus, statusColor } = getStudentProgress(s);
                    return (
                      <tr key={s.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4">
                          <div className="font-medium">{s.name}</div>
                          <div className="text-xs text-slate-400">{s.subject}</div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusColor}`}>{displayStatus}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-600">{s.teacher || "-"}</td>
                        <td className="py-3 px-4 text-right font-bold text-indigo-600">
                          {Number(s.tuitionFee || 0).toLocaleString()}원
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500">{s.lastPaymentDate || "-"}</td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1 justify-center">
                            {["현장", "계좌이체", "기타", "결제선생"].map((m) => (
                              <button
                                key={m}
                                onClick={() => setPaymentMethods((prev) => ({ ...prev, [s.id]: m }))}
                                className={`px-2 py-0.5 text-xs rounded border font-medium transition-all ${
                                  method === m
                                    ? m === "결제선생" ? "bg-blue-600 text-white border-blue-600" : "bg-indigo-600 text-white border-indigo-600"
                                    : "bg-white text-slate-500 border-slate-200 hover:bg-slate-50"
                                }`}
                              >
                                {m}
                              </button>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {method === "결제선생" ? (
                            <button
                              onClick={(e) => handleOpenMsgPreview(e, s)}
                              className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 font-medium"
                            >
                              📱 문자 발송
                            </button>
                          ) : method ? (
                            <button
                              onClick={() => { setProcessQuickPay({ student: s, method }); setProcessPayDate(toLocalDateStr()); }}
                              className="px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 font-medium"
                            >
                              ✅ 수납 완료
                            </button>
                          ) : (
                            <span className="text-slate-300 text-xs">방법 선택</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {processableStudents.length === 0 && (
                    <tr><td colSpan={6} className="py-10 text-center text-slate-400">결제 예정자가 없습니다.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 결제 완료자 */}
            <div className="border rounded-xl overflow-hidden">
              <div className="bg-emerald-50 px-4 py-2.5 flex items-center justify-between border-b">
                <div className="flex items-center gap-2">
                  <CheckCircle size={15} className="text-emerald-600" />
                  <span className="font-bold text-emerald-700 text-sm">결제 완료자</span>
                  <span className="bg-emerald-200 text-emerald-800 text-xs px-1.5 py-0.5 rounded-full">{recentlyPaidList.length}건</span>
                </div>
                <div className="flex rounded-lg overflow-hidden border border-emerald-200 text-xs">
                  {[["today", "오늘"], ["week", "이번 주"], ["month", "이번 달"]].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setCompletedPeriod(val)}
                      className={`px-3 py-1 font-medium transition-colors ${completedPeriod === val ? "bg-emerald-600 text-white" : "bg-white text-emerald-600 hover:bg-emerald-50"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b text-xs text-slate-400 uppercase">
                  <tr>
                    <th className="py-2.5 px-4 text-left">이름 / 과목</th>
                    <th className="py-2.5 px-4 text-left">강사</th>
                    <th className="py-2.5 px-4 text-left">결제일</th>
                    <th className="py-2.5 px-4 text-right">금액</th>
                    <th className="py-2.5 px-4 text-center">결제방법</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {recentlyPaidList.map(({ student: s, payment: p }, i) => (
                    <tr key={`${s.id}-${i}`} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4">
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-slate-400">{s.subject}</div>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">{s.teacher || "-"}</td>
                      <td className="py-2.5 px-4 text-slate-600">{p.date}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-indigo-600">
                        {Number(p.amount || 0).toLocaleString()}원
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {p.method ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            p.method === "결제선생" ? "bg-blue-100 text-blue-700" :
                            p.method === "현장" ? "bg-indigo-100 text-indigo-700" :
                            p.method === "계좌이체" ? "bg-emerald-100 text-emerald-700" :
                            "bg-slate-100 text-slate-600"
                          }`}>{p.method}</span>
                        ) : <span className="text-slate-300">-</span>}
                      </td>
                    </tr>
                  ))}
                  {recentlyPaidList.length === 0 && (
                    <tr><td colSpan={5} className="py-8 text-center text-slate-400">
                      {completedPeriod === "today" ? "오늘" : completedPeriod === "week" ? "이번 주" : "이번 달"} 결제 완료자가 없습니다.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================
            탭 4: 수납관리 (manage)
            - 재원생 전체 목록 + 수강 진척도 + 상태
            - 행 클릭 → onOpenStudentDetail (App.js의 PaymentDetailModal)
        ============================================================ */}
        {activeTab === "manage" && (
          <div className="flex-1 flex flex-col min-h-0 p-5">
          <div className="border rounded-xl overflow-auto flex-1 min-h-0">
            <div className="bg-slate-50 px-4 py-2.5 flex items-center gap-2 border-b">
              <Users size={15} className="text-slate-600" />
              <span className="font-bold text-slate-700 text-sm">재원생 수납 현황</span>
              <span className="bg-slate-200 text-slate-700 text-xs px-1.5 py-0.5 rounded-full">{manageList.length}명</span>
            </div>
            <table className="w-full text-sm min-w-[600px]">
              <thead className="sticky top-0 bg-slate-50 border-b">
                <tr className="text-slate-400 text-xs uppercase">
                  <th className="py-3 px-4 text-left">이름 / 과목</th>
                  <th className="py-3 px-4 text-left">강사</th>
                  <th className="py-3 px-4 text-right">원비</th>
                  <th className="py-3 px-4 text-center">진척도</th>
                  <th className="py-3 px-4 text-left">상태</th>
                  <th className="py-3 px-4 text-left">최종결제일</th>
                  <th className="py-3 px-4 text-center">안내</th>
                </tr>
              </thead>
              <tbody>
                {manageList.map((s) => {
                  const { currentUsage, sessionUnit, displayStatus, statusColor } = getStudentProgress(s);
                  return (
                    <tr
                      key={s.id}
                      className="border-b hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => onOpenStudentDetail && onOpenStudentDetail(s)}
                    >
                      <td className="py-3 px-4 font-medium">
                        {s.name}
                        {s.subject && <span className="text-xs text-slate-500 ml-1">({s.subject})</span>}
                        {s.phone && <div className="text-xs text-slate-400">{s.phone}</div>}
                      </td>
                      <td className="py-3 px-4 text-slate-600">{s.teacher || "-"}</td>
                      <td className="py-3 px-4 text-right font-bold text-indigo-600">
                        {s.tuitionFee ? Number(s.tuitionFee).toLocaleString() : 0}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                        {currentUsage} / {sessionUnit}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor}`}>{displayStatus}</span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">{s.lastPaymentDate || "-"}</td>
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => handleOpenMsgPreview(e, s)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="안내 문자 미리보기"
                        >
                          <MessageSquareText size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {manageList.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400">검색 결과가 없습니다.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          </div>
        )}
      </div>
    </div>
  );
};
