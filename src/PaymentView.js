// =================================================================
// PaymentView.js - 결제/수납센터 (4탭: 수납현황 / 발송센터 / 결제확인 / 수납관리)
// App.js에서 분리. 기존 함수/state 시그니처는 그대로 유지하고 UI만 4탭 구조로 재구성.
// =================================================================
import React, { useState, useMemo, useEffect } from "react";
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
  History,
  CalendarDays,
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

const sendKyuljesaengnim = async (student, override = {}) => {
  const sessions = override.sessions ?? getEffectiveSessions(student);
  const price = override.price ?? Number(student.tuitionFee || 0);
  const isAdult = student.grade === "성인";
  const nameSuffix = isAdult ? "님" : " 학생";
  const formattedName = `[J&C]${student.subject || ""}-${student.name}${nameSuffix}`;
  const formattedSubject = `${student.subject ? student.subject + " " : ""}1:1 개인레슨 ${sessions}회`;
  // paymentHistory 기준으로 최종결제일 계산 (lastPaymentDate 필드는 stale할 수 있음)
  const sortedPays = (student.paymentHistory || []).sort((a, b) => a.date.localeCompare(b.date));
  const computedLastPayDate = sortedPays.length > 0 ? sortedPays[sortedPays.length - 1].date : (student.lastPaymentDate || "");
  const note = computedLastPayDate ? `최종결제일: ${computedLastPayDate}` : "";
  const res = await fetch(PAYMINT_SEND_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      studentId: student.id,
      studentName: formattedName,
      phone: student.phone || "",
      price: String(price),
      subject: formattedSubject,
      totalSessions: sessions,
      lastPaymentDate: computedLastPayDate,
      note,
    }),
  });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "결제선생 발송 실패");
  return data;
};

// 청구서 상태 조회: F=결제완료, W=미결제, C=취소, D=파기
const readBillState = async (billId) => {
  const url = PAYMINT_SEND_URL.replace("/send", "/read");
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ billId }) });
  return res.json();
};

// 청구서 파기: /destroy (billId + price 필요)
const destroyBill = async (billId, price) => {
  const url = PAYMINT_SEND_URL.replace("/send", "/destroy");
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ billId, price }) });
  const data = await res.json();
  if (!data.success) throw new Error(data.error || "파기 실패");
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
// KyuljePreviewModal - 결제선생 발송 전 미리보기 확인 모달
// -----------------------------------------------------------------
const KyuljePreviewRow = ({ label, children }) => (
  <div className="flex items-start justify-between gap-3 py-2 border-b border-slate-100 last:border-b-0">
    <span className="text-xs text-slate-400 shrink-0 mt-0.5 w-20">{label}</span>
    <span className="text-sm text-slate-800 text-right flex-1">{children}</span>
  </div>
);

const SESSION_OPTIONS = [2, 4, 8];

const KyuljePreviewModal = ({ student, onConfirm, onClose, sending }) => {
  const baseSessions = getEffectiveSessions(student);
  const baseFee = Number(student?.tuitionFee || 0);
  const perSession = baseSessions > 0 ? Math.round(baseFee / baseSessions) : 0;

  const defaultSessions = SESSION_OPTIONS.includes(baseSessions) ? baseSessions : 4;
  const [selectedSessions, setSelectedSessions] = React.useState(defaultSessions);
  const [priceInput, setPriceInput] = React.useState(String(Math.round(perSession * defaultSessions)));

  if (!student) return null;

  const handleSessionChange = (s) => {
    setSelectedSessions(s);
    setPriceInput(String(Math.round(perSession * s)));
  };

  const finalPrice = Number(priceInput.replace(/[^0-9]/g, "")) || 0;
  const isAdult = student.grade === "성인";
  const nameSuffix = isAdult ? "님" : " 학생";
  const formattedName = `[J&C]${student.subject || ""}-${student.name}${nameSuffix}`;
  const computedLastPay = (() => {
    const sorted = [...(student.paymentHistory || [])].sort((a, b) => a.date.localeCompare(b.date));
    return sorted.length > 0 ? sorted[sorted.length - 1].date : (student.lastPaymentDate || "");
  })();
  const note = computedLastPay ? `최종결제일: ${computedLastPay}` : "";

  return (
    <div className="fixed inset-0 bg-black/70 z-[220] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
          <div>
            <p className="text-base font-bold text-slate-800">💳 결제선생 발송 확인</p>
            <p className="text-xs text-slate-400 mt-0.5">회차와 금액을 확인 후 발송하세요.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 active:bg-slate-100 p-2">
            <X size={18} />
          </button>
        </div>

        {/* 회차 선택 */}
        <div className="px-5 pt-4 pb-2">
          <p className="text-xs text-slate-400 mb-2 font-medium">결제 회차 선택</p>
          <div className="flex gap-2">
            {SESSION_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => handleSessionChange(s)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-bold border-2 transition-colors ${
                  selectedSessions === s
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-slate-500 border-slate-200 hover:border-indigo-300 hover:text-indigo-600"
                }`}
              >
                {s}회
              </button>
            ))}
          </div>
        </div>

        {/* 내용 */}
        <div className="px-5 py-2">
          <KyuljePreviewRow label="받는 사람">
            <span className="font-bold text-slate-900">{formattedName}</span>
          </KyuljePreviewRow>
          <KyuljePreviewRow label="연락처">{student.phone || "—"}</KyuljePreviewRow>
          <KyuljePreviewRow label="품목">1:1 개인레슨 {selectedSessions}회</KyuljePreviewRow>
          <KyuljePreviewRow label="청구 금액">
            <div className="flex items-center gap-1">
              <input
                type="text"
                inputMode="numeric"
                value={priceInput ? Number(priceInput).toLocaleString() : ""}
                onChange={(e) => setPriceInput(e.target.value.replace(/[^0-9]/g, ""))}
                className="w-28 text-right border border-indigo-300 rounded-lg px-2 py-1 text-sm font-bold text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <span className="text-slate-500 text-sm">원</span>
            </div>
          </KyuljePreviewRow>
          <KyuljePreviewRow label="안내 메시지">
            {note || <span className="text-slate-300">—</span>}
          </KyuljePreviewRow>
        </div>

        {/* 버튼 */}
        <div className="px-5 pb-5 pt-3 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 font-bold hover:bg-slate-50 active:bg-slate-100 transition-colors"
          >
            취소
          </button>
          <button
            onClick={() => onConfirm({ sessions: selectedSessions, price: finalPrice })}
            disabled={sending || finalPrice <= 0}
            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white rounded-xl text-sm font-bold transition-colors"
          >
            {sending ? "발송 중..." : `✓ ${finalPrice.toLocaleString()}원 발송`}
          </button>
        </div>
      </div>
    </div>
  );
};

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
  const [kyuljePreviewStudent, setKyuljePreviewStudent] = useState(null);
  const [kyuljeSending, setKyuljeSending] = useState(false);

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

  const handleSendAll = async (s, kyuljeOverride = {}) => {
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
        const result = await sendKyuljesaengnim(s, kyuljeOverride);
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
              className="text-slate-400 hover:text-slate-600 active:bg-slate-100 p-2"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <div className="w-32 sm:w-44 shrink-0 border-r overflow-y-auto bg-slate-50">
            {students.map((s, idx) => {
              const lastNotif = getLastNotif(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => setActiveIdx(idx)}
                  className={`w-full text-left px-2 py-2 sm:px-3 sm:py-2.5 border-b text-sm transition-colors ${
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
                    onClick={() => {
                      const ch = sendChannels[activeStudent.id] || { sms: true, kyuljesaengnim: false };
                      if (ch.kyuljesaengnim) setKyuljePreviewStudent(activeStudent);
                      else handleSendAll(activeStudent);
                    }}
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
      {kyuljePreviewStudent && (
        <KyuljePreviewModal
          student={kyuljePreviewStudent}
          sending={kyuljeSending}
          onClose={() => setKyuljePreviewStudent(null)}
          onConfirm={async (override) => {
            setKyuljeSending(true);
            await handleSendAll(kyuljePreviewStudent, override);
            setKyuljeSending(false);
            setKyuljePreviewStudent(null);
          }}
        />
      )}
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
  onDeleteMessageLog,
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

  // ── 결제선생 미리보기 (공통) ───────────────────────────────────
  const [kyuljePreviewStudent, setKyuljePreviewStudent] = useState(null);
  const [kyuljeSending, setKyuljeSending] = useState(false);

  const handleKyuljeSend = async (student, override = {}) => {
    try {
      const result = await sendKyuljesaengnim(student, override);
      if (onSaveMessageLog)
        await onSaveMessageLog({
          studentId: student.id, studentName: student.name, phone: student.phone || "",
          sentAt: toLocalDateStr(), channels: ["결제선생"], messageType: "결제안내",
          sentBy: user?.name || "원장", billId: result.billId, shortURL: result.shortURL,
        });
      showToast(`${student.name} 결제선생 발송 완료`, "success");
    } catch (e) {
      showToast("결제선생 발송 실패: " + e.message, "error");
    }
  };

  // ── 결제확인(confirm) 탭 상태 ─────────────────────────────────
  const [paymentMethods, setPaymentMethods] = useState({});
  const [completedPeriod, setCompletedPeriod] = useState("today");
  const [dueSortOrder, setDueSortOrder] = useState("desc"); // "asc" | "desc"
  const [processQuickPay, setProcessQuickPay] = useState(null);
  const [processPayDate, setProcessPayDate] = useState(toLocalDateStr());
  const [processPaySessions, setProcessPaySessions] = useState(4);
  const [processPayAmount, setProcessPayAmount] = useState("");
  const [isProcessSaving, setIsProcessSaving] = useState(false);

  // 결제 예정자 선택 시 해당 학생의 회차로 초기화
  React.useEffect(() => {
    if (processQuickPay) {
      setProcessPaySessions(getEffectiveSessions(processQuickPay));
    }
  }, [processQuickPay]);

  // ── 수납현황(today) 빠른 결제입력 상태 ───────────────────────
  const [quickPayStudent, setQuickPayStudent] = useState(null);
  const [quickPayDate, setQuickPayDate] = useState("");
  const [quickPaySessions, setQuickPaySessions] = useState(4);
  const [quickPayAmount, setQuickPayAmount] = useState("");

  // 수납현황 학생 선택 시 해당 학생의 회차로 초기화
  React.useEffect(() => {
    if (quickPayStudent) {
      setQuickPaySessions(getEffectiveSessions(quickPayStudent));
    }
  }, [quickPayStudent]);

  // ── 히스토리(history) 탭 상태 ────────────────────────────────
  const [historyPeriod, setHistoryPeriod] = useState("month"); // "day" | "week" | "month"

  // ── 수납관리(manage) 탭 필터 ─────────────────────────────────
  const [manageFilter, setManageFilter] = useState(""); // "" | "target" | "unpaid"

  // ── 결제선생 파기 확인 ────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState(null); // log 객체

  // ── 결제선생 청구서 Paymint 상태 (F/W/C/D) ───────────────────
  const [billStates, setBillStates] = useState({});
  const fetchBillState = async (billId) => {
    setBillStates((prev) => ({ ...prev, [billId]: { ...prev[billId], loading: true } }));
    try {
      const data = await readBillState(billId);
      setBillStates((prev) => ({ ...prev, [billId]: { state: data.state, price: data.price, loading: false } }));
    } catch {
      setBillStates((prev) => ({ ...prev, [billId]: { state: "ERR", loading: false } }));
    }
  };

  // kyulje 탭 진입 시 미조회 청구서 일괄 자동 조회
  useEffect(() => {
    if (activeTab !== "kyulje") return;
    kyuljeLogsData.forEach(({ log }) => {
      if (log.billId && !billStates[log.billId]) fetchBillState(log.billId);
    });
  }, [activeTab]); // kyuljeLogsData 변경 시 재조회 불필요 (billStates 확인 후 skip)

  // ── 수강 진척도 헬퍼 (순수 누적 모델: T vs P) ──────────────────
  // T = 총 출석 슬롯(오늘 이하, 당일취소=1, 연강=count), P = 총 결제 회차
  // 날짜·sessionStartDate와 무관 → 결제일이 수업일과 겹쳐도 중복 카운트 없음
  // T < P: 수강 중 / T == P: 수강권 만료(결제 대상) / T > P: 미납 초과
  const getStudentProgress = (s) => {
    const unit = getEffectiveSessions(s);
    const sortedPayments = [...(s.paymentHistory || [])].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    const todayStr = toLocalDateStr();

    // 총 출석 슬롯 (미래 예약 출석은 제외)
    let T = 0;
    for (const h of (s.attendanceHistory || [])) {
      if (h.status !== "present" && h.status !== "canceled") continue;
      if (h.date > todayStr) continue;
      T += h.status === "canceled" ? 1 : (h.count || 1);
    }

    // 총 결제 회차
    let P = 0;
    for (const p of sortedPayments) {
      P += p.totalSessions > 0 ? p.totalSessions : unit;
    }

    const lastPay = sortedPayments.length > 0 ? sortedPayments[sortedPayments.length - 1] : null;
    const lastPayUnit = lastPay
      ? (lastPay.totalSessions > 0 ? lastPay.totalSessions : unit)
      : unit;
    const previousCovered = P - lastPayUnit;

    // 현재 사이클 진척: 미납초과 시 초과분 그대로 노출(예: 5/4), 그 외 클램프
    const currentUsage = sortedPayments.length > 0
      ? Math.max(0, T - previousCovered)
      : 0;

    const isOverdue = sortedPayments.length > 0 && T > P;
    const isCompleted = sortedPayments.length > 0 && T === P;

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

  // paymentHistory 기반 최종결제일 (lastPaymentDate 필드는 stale할 수 있음)
  const getComputedLastPayDate = (s) => {
    const sorted = [...(s.paymentHistory || [])].sort((a, b) => a.date.localeCompare(b.date));
    return sorted.length > 0 ? sorted[sorted.length - 1].date : (s.lastPaymentDate || "");
  };

  // 마지막 결제 사이클의 N회차 소진 날짜 계산 (누적 모델: 이전 결제 커버분 다음 N회)
  const getPaymentDueDate = (s) => {
    const unit = getEffectiveSessions(s);
    const sortedPayments = [...(s.paymentHistory || [])].sort((a, b) => a.date.localeCompare(b.date));
    if (sortedPayments.length === 0) return "";
    let P = 0;
    for (const p of sortedPayments) P += p.totalSessions > 0 ? p.totalSessions : unit;

    // 출석 슬롯을 날짜순으로 분해 (연강=count, 당일취소=1)
    const slots = [];
    [...(s.attendanceHistory || [])]
      .filter((h) => h.status === "present" || h.status === "canceled")
      .sort((a, b) => a.date.localeCompare(b.date))
      .forEach((h) => {
        const cnt = h.status === "canceled" ? 1 : (h.count || 1);
        for (let i = 0; i < cnt; i++) slots.push(h.date);
      });

    // 마지막 결제가 커버하는 마지막 슬롯(= P번째) 소진일
    const dueIdx = P - 1;
    if (dueIdx < slots.length) return slots[dueIdx];
    return slots.length > 0 ? slots[slots.length - 1] : "";
  };

  // ── 강사 목록 (드롭다운) ──────────────────────────────────────
  const teacherOptions = useMemo(() => {
    const set = new Set();
    students.forEach((s) => { if (s.teacher) set.add(s.teacher); });
    return Array.from(set).sort();
  }, [students]);

  // ── 발송 상태 (none / sms-only / done) ───────────────────────
  const getNotifStatus = (studentId, since = null) => {
    let logs = messageLogs.filter((l) => l.studentId === studentId);
    // since(보통 마지막 결제일) 이후 발송만 집계 → "이번 사이클" 기준 판정
    if (since) logs = logs.filter((l) => l.sentAt > since);
    if (!logs.length) return "none";
    // 같은 날 SMS + 결제선생 각각 발송 시 채널 병합 후 판정
    const dedupeMap = {};
    logs.forEach((log) => {
      const key = log.sentAt;
      if (!dedupeMap[key]) {
        dedupeMap[key] = { sentAt: key, channels: [...(log.channels || (log.channel ? ["sms"] : []))] };
      } else {
        (log.channels || []).forEach((ch) => {
          if (!dedupeMap[key].channels.includes(ch)) dedupeMap[key].channels.push(ch);
        });
      }
    });
    const latest = Object.values(dedupeMap).sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0];
    const ch = latest.channels;
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

  // 안내 발송일 레이블: 30일 이내 "N일 전", 이후 "오래됨"
  const notifAgeLabel = (dateStr) => {
    if (!dateStr) return "";
    const days = Math.round((new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24));
    if (days === 0) return "(오늘)";
    if (days <= 30) return `(${days}일 전)`;
    return "(오래됨)";
  };

  // 안내일 이후 paymentHistory에 실제 결제가 있으면 결제완료로 표시
  const isPaidAfterNotif = (student, notifDate) => {
    if (!notifDate) return false;
    return (student.paymentHistory || []).some((p) => p.date > notifDate);
  };

  // 마지막 결제일 반환
  const getLastPaymentDate = (student) => {
    const pays = [...(student.paymentHistory || [])].sort((a, b) => b.date.localeCompare(a.date));
    return pays.length > 0 ? pays[0].date : null;
  };

  // ── 최근 10일 회차 완료 학생 (수납현황 탭) ───────────────────
  const thisWeekCycleComplete = useMemo(() => {
    const todayStr = toLocalDateStr();
    const d10 = new Date();
    d10.setDate(d10.getDate() - 10);
    const tenDaysAgoStr = toLocalDateStr(d10);
    return students.filter((s) => {
      if (s.status !== "재원") return false;
      const history = s.attendanceHistory || [];
      const recentRecord = history.find(
        (h) => h.date >= tenDaysAgoStr && h.date <= todayStr &&
               (h.status === "present" || h.status === "canceled")
      );
      if (!recentRecord) return false;
      const { isCompleted, isOverdue } = getStudentProgress(s);
      return isCompleted || isOverdue;
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

  // ── 최근 결제자 목록 (기간별) ─────────────────────────────────
  const [recentPaidPeriod, setRecentPaidPeriod] = useState("week");
  const recentPaidList = useMemo(() => {
    const now = new Date();
    const d = new Date(now);
    if (recentPaidPeriod === "today") {
      d.setDate(d.getDate());
    } else if (recentPaidPeriod === "week") {
      d.setDate(d.getDate() - 6);
    } else {
      d.setDate(d.getDate() - 29);
    }
    const startStr = toLocalDateStr(d);
    const todayStr = toLocalDateStr();
    const results = [];
    students.filter((s) => s.status === "재원").forEach((s) => {
      (s.paymentHistory || []).forEach((p) => {
        if (p.date >= startStr && p.date <= todayStr) {
          // 결제일 이전 발송 이력 확인
          const notifLog = (messageLogs || [])
            .filter((l) => l.studentId === s.id && l.sentAt <= p.date)
            .sort((a, b) => b.sentAt.localeCompare(a.sentAt))[0] || null;
          results.push({ student: s, payment: p, notifLog });
        }
      });
    });
    return results.sort((a, b) => b.payment.date.localeCompare(a.payment.date) || a.student.name.localeCompare(b.student.name));
  }, [students, messageLogs, recentPaidPeriod]);

  // ── 1주일 이내 결제 안내 대상 (발송센터 탭) ──────────────────
  const weeklyDueList = useMemo(() => {
    const todayStr = toLocalDateStr();
    const d7 = new Date();
    d7.setDate(d7.getDate() - 7);
    const weekAgoStr = toLocalDateStr(d7);
    return students.filter((s) => {
      if (s.status !== "재원") return false;
      const { isCompleted, isOverdue } = getStudentProgress(s);
      if (!isCompleted && !isOverdue) return false;
      // 지난 7일 이내(오늘 포함) 수업이 있어야 포함
      return (s.attendanceHistory || []).some(
        (h) => h.date >= weekAgoStr && h.date <= todayStr &&
          (h.status === "present" || h.status === "canceled")
      );
    });
  }, [students]);

  // ── 1주일 이내 결제선생 발송 이력 (수납현황 탭) ──────────────
  const weeklyKyuljeHistory = useMemo(() => {
    const d7 = new Date();
    d7.setDate(d7.getDate() - 7);
    const weekAgoStr = toLocalDateStr(d7);
    // studentId+날짜 기준 중복 병합
    const dedupeMap = {};
    (messageLogs || []).forEach((log) => {
      if (!(log.channels || []).includes("결제선생")) return;
      if (log.sentAt < weekAgoStr) return;
      const student = students.find((s) => s.id === log.studentId);
      if (student && student.status !== "재원") return;
      const key = `${log.studentId}__${log.sentAt}`;
      if (!dedupeMap[key]) {
        dedupeMap[key] = { ...log, channels: [...(log.channels || [])] };
      } else {
        (log.channels || []).forEach((ch) => {
          if (!dedupeMap[key].channels.includes(ch)) dedupeMap[key].channels.push(ch);
        });
      }
    });
    return Object.values(dedupeMap)
      .map((log) => {
        const student = students.find((s) => s.id === log.studentId);
        const paidAfter = student
          ? (student.paymentHistory || []).find((p) => p.date >= log.sentAt)
          : null;
        return { log, student, paidAfter };
      })
      .sort((a, b) => b.log.sentAt.localeCompare(a.log.sentAt));
  }, [messageLogs, students]);

  // ── 결제선생 전체 발송 이력 (결제선생 탭) ──────────────────────
  const kyuljeLogsData = useMemo(() => {
    // studentId+날짜 기준 중복 병합
    const dedupeMap = {};
    (messageLogs || [])
      .filter((log) => (log.channels || []).includes("결제선생"))
      .forEach((log) => {
        const key = `${log.studentId}__${log.sentAt}`;
        if (!dedupeMap[key]) {
          dedupeMap[key] = { ...log, channels: [...(log.channels || [])] };
        } else {
          (log.channels || []).forEach((ch) => {
            if (!dedupeMap[key].channels.includes(ch)) dedupeMap[key].channels.push(ch);
          });
        }
      });
    return Object.values(dedupeMap)
      .map((log) => {
        const student = students.find((s) => s.id === log.studentId);
        const paidAfter = student
          ? (student.paymentHistory || []).find((p) => p.date >= log.sentAt)
          : null;
        return { log, student, paidAfter };
      })
      .sort((a, b) => b.log.sentAt.localeCompare(a.log.sentAt));
  }, [messageLogs, students]);

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
      // 이번 사이클(마지막 결제일 이후) 안내 발송 여부 → 발송한 학생은 하단
      const aDone = getNotifStatus(a.id, getLastPaymentDate(a)) !== "none";
      const bDone = getNotifStatus(b.id, getLastPaymentDate(b)) !== "none";
      if (aDone !== bDone) return aDone ? 1 : -1;
      // 상단(미발송) 그룹은 결제 도래일이 이른 순으로
      const dueA = getPaymentDueDate(a) || "9999";
      const dueB = getPaymentDueDate(b) || "9999";
      return dueA.localeCompare(dueB);
    });
    return filtered;
  }, [students, sentFilter, searchTerm, selectedTeacher, filterWeek, messageLogs]);

  // ── 결제확인(confirm) 탭 계산 ─────────────────────────────────
  const processableStudents = useMemo(() =>
    students
      .filter((s) => {
        const { isCompleted, isOverdue } = getStudentProgress(s);
        if (s.status !== "재원" || (!isCompleted && !isOverdue)) return false;
        if (!searchTerm) return true;
        return (
          s.name.includes(searchTerm) ||
          (s.subject && s.subject.includes(searchTerm)) ||
          (s.teacher && s.teacher.includes(searchTerm))
        );
      })
      .sort((a, b) => {
        const da = getPaymentDueDate(a);
        const db = getPaymentDueDate(b);
        if (!da && !db) return a.name.localeCompare(b.name, "ko");
        if (!da) return 1;
        if (!db) return -1;
        return dueSortOrder === "asc" ? da.localeCompare(db) : db.localeCompare(da);
      }),
    [students, dueSortOrder, searchTerm]
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
        if (s.status !== "재원") return false; // 휴원/퇴원 제외
        // 필터: 결제 대상자(만료/초과) 또는 미납자(초과만)
        if (manageFilter === "target" || manageFilter === "unpaid") {
          const { isCompleted, isOverdue } = getStudentProgress(s);
          if (manageFilter === "target" && !isCompleted && !isOverdue) return false;
          if (manageFilter === "unpaid" && !isOverdue) return false;
        }
        return (
          s.name.includes(searchTerm) ||
          (s.subject && s.subject.includes(searchTerm)) ||
          (s.teacher && s.teacher.includes(searchTerm))
        );
      })
      .filter((s) => !selectedTeacher || s.teacher === selectedTeacher)
      .sort((a, b) => a.name.localeCompare(b.name, "ko"));
  }, [students, searchTerm, selectedTeacher, manageFilter]);

  // ── 히스토리(history) 탭 데이터 ──────────────────────────────
  const historyData = useMemo(() => {
    const allPayments = [];
    // 학생별로 (날짜+금액) 기준 중복 제거 후 수집 (휴원/퇴원 제외)
    students.forEach((s) => {
      if (s.status !== "재원") return; // 휴원/퇴원생 제외
      const seen = new Set();
      (s.paymentHistory || []).forEach((p) => {
        if (!p.date) return;
        const key = `${p.date}__${p.amount}`;
        if (seen.has(key)) return; // 동일 날짜+금액 중복은 한 번만 표시
        seen.add(key);
        allPayments.push({ student: s, payment: p });
      });
    });

    const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];
    const getMondayStr = (dateStr) => {
      const d = new Date(dateStr + "T00:00:00");
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      return toLocalDateStr(d);
    };

    const groups = {};
    allPayments.forEach(({ student: s, payment: p }) => {
      let key;
      if (historyPeriod === "month") key = p.date.substring(0, 7);
      else if (historyPeriod === "week") key = getMondayStr(p.date);
      else key = p.date;

      if (!groups[key]) groups[key] = { key, items: [], total: 0, methods: {} };
      groups[key].items.push({ student: s, payment: p });
      groups[key].total += Number(p.amount || 0);
      const m = p.method || "기타";
      groups[key].methods[m] = (groups[key].methods[m] || 0) + Number(p.amount || 0);
    });

    const formatLabel = (key) => {
      if (historyPeriod === "month") {
        const [y, m] = key.split("-");
        return `${y}년 ${parseInt(m)}월`;
      } else if (historyPeriod === "week") {
        const d = new Date(key + "T00:00:00");
        const end = new Date(d);
        end.setDate(end.getDate() + 6);
        const fmt = (dt) => `${dt.getMonth() + 1}/${dt.getDate()}`;
        return `${fmt(d)} ~ ${fmt(end)}`;
      } else {
        const d = new Date(key + "T00:00:00");
        return `${d.getMonth() + 1}/${d.getDate()} (${DAYS_KO[d.getDay()]})`;
      }
    };

    return Object.values(groups)
      .sort((a, b) => b.key.localeCompare(a.key))
      .map((g) => ({ ...g, label: formatLabel(g.key) }));
  }, [students, historyPeriod]);

  // ── 발송 히스토리 데이터 (결제선생 채널 필터) ──────────────────
  const sendHistoryData = useMemo(() => {
    const DAYS_KO = ["일", "월", "화", "수", "목", "금", "토"];
    const getMondayStr = (dateStr) => {
      const d = new Date(dateStr + "T00:00:00");
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      return toLocalDateStr(d);
    };
    const formatLabel = (key) => {
      if (historyPeriod === "month") {
        const [y, m] = key.split("-");
        return `${y}년 ${parseInt(m)}월`;
      } else if (historyPeriod === "week") {
        const d = new Date(key + "T00:00:00");
        const end = new Date(d);
        end.setDate(end.getDate() + 6);
        const fmt = (dt) => `${dt.getMonth() + 1}/${dt.getDate()}`;
        return `${fmt(d)} ~ ${fmt(end)}`;
      } else {
        const d = new Date(key + "T00:00:00");
        return `${d.getMonth() + 1}/${d.getDate()} (${DAYS_KO[d.getDay()]})`;
      }
    };

    const groups = {};
    (messageLogs || []).forEach((log) => {
      const date = log.sentAt;
      if (!date) return;
      // 휴원/퇴원생 제외
      const logStudent = students.find((s) => s.id === log.studentId);
      if (logStudent && logStudent.status !== "재원") return;
      let key;
      if (historyPeriod === "month") key = date.substring(0, 7);
      else if (historyPeriod === "week") key = getMondayStr(date);
      else key = date;

      if (!groups[key]) groups[key] = { key, dedupeMap: {} };
      const dedupeKey = `${log.studentId}__${log.sentAt}`;
      if (!groups[key].dedupeMap[dedupeKey]) {
        groups[key].dedupeMap[dedupeKey] = { ...log, channels: [...(log.channels || [])] };
      } else {
        (log.channels || []).forEach((ch) => {
          if (!groups[key].dedupeMap[dedupeKey].channels.includes(ch)) {
            groups[key].dedupeMap[dedupeKey].channels.push(ch);
          }
        });
      }
    });

    return Object.values(groups)
      .sort((a, b) => b.key.localeCompare(a.key))
      .map((g) => {
        const items = Object.values(g.dedupeMap);
        // 채널별 실제 발송 횟수 (한 로그에 두 채널이 있으면 각각 1씩 카운트)
        let kyuljeCount = 0;
        let smsCount = 0;
        const paidStudentIds = new Set();
        items.forEach((l) => {
          const ch = l.channels || [];
          if (ch.includes("결제선생")) kyuljeCount++;
          if (ch.includes("sms")) smsCount++;
          const st = students.find((s) => s.id === l.studentId);
          if (st && (st.paymentHistory || []).find((p) => p.date >= l.sentAt)) {
            paidStudentIds.add(l.studentId);
          }
        });
        const payCount = paidStudentIds.size;
        return { key: g.key, items, label: formatLabel(g.key), kyuljeCount, smsCount, payCount };
      });
  }, [messageLogs, historyPeriod, students]);

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

  const [quickPaySaving, setQuickPaySaving] = useState(false);
  const handleQuickPaySave = async () => {
    if (!quickPayStudent || !quickPayDate || quickPaySaving) return;
    setQuickPaySaving(true);
    try {
      const amount = parseInt(quickPayAmount) || parseInt(quickPayStudent.tuitionFee || 0);
      await onSavePayment(
        quickPayStudent.id,
        quickPayDate,
        amount,
        quickPayDate,
        "",
        quickPaySessions
      );
      showToast(`${quickPayStudent.name} 결제 완료 저장`, "success");
      setQuickPayStudent(null);
      setQuickPayDate("");
      setQuickPaySessions(4);
      setQuickPayAmount("");
    } catch (e) {
      showToast("저장 오류: " + e.message, "error");
    } finally {
      setQuickPaySaving(false);
    }
  };

  // ── 탭 메타 정보 ─────────────────────────────────────────────
  const TABS = [
    { id: "today", label: "수납현황", icon: <Bell size={14} />, badge: thisWeekCycleComplete.length || null },
    { id: "send", label: "발송센터", icon: <Send size={14} />, badge: sendList.filter(s => getNotifStatus(s.id) === "none").length || null },
    { id: "confirm", label: "결제확인", icon: <CreditCard size={14} />, badge: processableStudents.length || null },
    { id: "manage", label: "수납관리", icon: <Users size={14} />, badge: null },
    { id: "kyulje", label: "결제선생", icon: <CreditCard size={14} />, badge: kyuljeLogsData.length || null },
    { id: "history", label: "히스토리", icon: <History size={14} />, badge: null },
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
              <button onClick={() => setShowMsgPreview(false)} className="text-slate-400 hover:text-slate-600 active:bg-slate-100 p-2">
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
                onClick={() => {
                  setShowMsgPreview(false);
                  setKyuljePreviewStudent(msgStudent);
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
      {quickPayStudent && (() => {
        const baseSessions = getEffectiveSessions(quickPayStudent);
        const baseFee = Number(quickPayStudent.tuitionFee || 0);
        const perSession = baseSessions > 0 ? Math.round(baseFee / baseSessions) : 0;
        const displayAmount = quickPayAmount || String(Math.round(perSession * quickPaySessions));
        return (
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
                <label className="block text-xs font-bold text-slate-500 mb-1">결제 회차</label>
                <div className="flex gap-2">
                  {[2, 4, 8].map((s) => (
                    <button key={s} type="button"
                      onClick={() => { setQuickPaySessions(s); setQuickPayAmount(String(Math.round(perSession * s))); }}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold border-2 transition-colors ${
                        quickPaySessions === s ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-500 border-slate-200 hover:border-indigo-300"
                      }`}>{s}회</button>
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-500 mb-1">결제금액</label>
                <div className="flex items-center gap-1">
                  <input type="text" inputMode="numeric"
                    value={displayAmount ? Number(displayAmount).toLocaleString() : ""}
                    onChange={(e) => setQuickPayAmount(e.target.value.replace(/[^0-9]/g, ""))}
                    className="flex-1 p-3 border border-indigo-300 rounded-xl bg-slate-50 text-sm font-bold text-indigo-600 focus:outline-indigo-500 text-right" />
                  <span className="text-slate-500 text-sm shrink-0">원</span>
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-2">
                <button onClick={() => { setQuickPayStudent(null); setQuickPayDate(""); setQuickPaySessions(4); setQuickPayAmount(""); }}
                  className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg font-bold">취소</button>
                <button onClick={handleQuickPaySave} disabled={!quickPayDate || quickPaySaving}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 shadow-md disabled:opacity-40">
                  {quickPaySaving ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── 결제확인 탭: 수납 완료 처리 모달 ────────────────────── */}
      {processQuickPay && (() => {
        const st = processQuickPay.student;
        const baseSessions = getEffectiveSessions(st);
        const baseFee = Number(st.tuitionFee || 0);
        const perSession = baseSessions > 0 ? Math.round(baseFee / baseSessions) : 0;
        const displayAmount = processPayAmount || String(Math.round(perSession * processPaySessions));
        return (
          <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6">
              <h3 className="text-lg font-bold mb-1 flex items-center text-emerald-700">
                <CreditCard className="mr-2" size={20} /> 수납 완료 처리
              </h3>
              <p className="text-sm text-slate-500 mb-1">{st.name} ({st.subject})</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium mb-3 inline-block ${
                processQuickPay.method === "계좌이체" ? "bg-emerald-100 text-emerald-700" : "bg-indigo-100 text-indigo-700"
              }`}>{processQuickPay.method}</span>
              <div className="mb-3">
                <label className="block text-xs font-bold text-slate-500 mb-1">결제일자</label>
                <input type="date" value={processPayDate} onChange={(e) => setProcessPayDate(e.target.value)}
                  className="w-full p-3 border rounded-xl bg-slate-50 focus:outline-emerald-500 text-sm" />
              </div>
              <div className="mb-3">
                <label className="block text-xs font-bold text-slate-500 mb-1">결제 회차</label>
                <div className="flex gap-2">
                  {[2, 4, 8].map((s) => (
                    <button key={s} type="button"
                      onClick={() => { setProcessPaySessions(s); setProcessPayAmount(String(Math.round(perSession * s))); }}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold border-2 transition-colors ${
                        processPaySessions === s ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-500 border-slate-200 hover:border-indigo-300"
                      }`}>{s}회</button>
                  ))}
                </div>
              </div>
              <div className="mb-4">
                <label className="block text-xs font-bold text-slate-500 mb-1">결제금액</label>
                <div className="flex items-center gap-1">
                  <input type="text" inputMode="numeric"
                    value={displayAmount ? Number(displayAmount).toLocaleString() : ""}
                    onChange={(e) => setProcessPayAmount(e.target.value.replace(/[^0-9]/g, ""))}
                    className="flex-1 p-3 border border-indigo-300 rounded-xl bg-slate-50 text-sm font-bold text-indigo-600 focus:outline-indigo-500 text-right" />
                  <span className="text-slate-500 text-sm shrink-0">원</span>
                </div>
              </div>
              <div className="flex gap-2 justify-end mt-2">
                <button onClick={() => { setProcessQuickPay(null); setProcessPaySessions(4); setProcessPayAmount(""); }} className="px-4 py-2 text-slate-500 hover:bg-slate-100 rounded-lg font-bold">취소</button>
                <button
                  disabled={!processPayDate || isProcessSaving}
                  onClick={async () => {
                    if (!processPayDate || isProcessSaving) return;
                    setIsProcessSaving(true);
                    try {
                      const amount = parseInt(processPayAmount) || parseInt(st.tuitionFee || 0);
                      await onSavePayment(st.id, processPayDate, amount, processPayDate, processQuickPay.method, processPaySessions);
                      showToast(`${st.name} 수납 완료`, "success");
                      setProcessQuickPay(null);
                      setProcessPaySessions(4);
                      setProcessPayAmount("");
                    } catch (e) {
                      showToast("저장 오류: " + e.message, "error");
                    } finally {
                      setIsProcessSaving(false);
                    }
                  }}
                  className="px-6 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 shadow-md disabled:opacity-40"
                >{isProcessSaving ? "저장 중..." : "완료 처리"}</button>
              </div>
            </div>
          </div>
        );
      })()}

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
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
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
          <div className="flex-1 min-h-0 overflow-auto">
          <div className="p-5 flex flex-col gap-5">
            {/* 이번주 회차 완료 → 결제 안내 대상 */}
            <div className="border rounded-xl overflow-hidden flex flex-col">
              <div className="bg-amber-50 px-4 py-2.5 flex items-center justify-between border-b shrink-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <Bell size={15} className="text-amber-600" />
                  <span className="font-bold text-amber-700 text-sm">최근 10일 회차 완료 — 결제 안내 대상</span>
                  <span className="bg-amber-200 text-amber-800 text-xs px-1.5 py-0.5 rounded-full">{thisWeekCycleComplete.length}명</span>
                  {thisWeekCycleComplete.length > 0 && (
                    <span className="text-amber-900 font-bold text-sm">
                      총 {thisWeekCycleComplete.reduce((sum, s) => sum + (Number(s.tuitionFee) || 0), 0).toLocaleString()}원
                    </span>
                  )}
                </div>
                {thisWeekCycleComplete.length > 0 && (
                  <button
                    onClick={() => setActiveTab("send")}
                    className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 flex items-center gap-1"
                  >
                    <Send size={12} /> 발송센터로 이동
                  </button>
                )}
              </div>

              {thisWeekCycleComplete.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-sm">
                  최근 10일 이내 회차가 완료된 학생이 없습니다.
                </div>
              ) : (
                <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-slate-50 border-b text-xs text-slate-400 uppercase">
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
                    {thisWeekCycleComplete.map((s) => {
                      const { currentUsage, sessionUnit, isOverdue } = getStudentProgress(s);
                      const notifSt = getNotifStatus(s.id);
                      return (
                        <tr key={s.id} className="hover:bg-amber-50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold">{s.name}</div>
                            <div className="text-xs text-slate-400">{s.subject}</div>
                          </td>
                          <td className="py-3 px-4 text-slate-600">{s.teacher || "-"}</td>
                          <td className="py-3 px-4 text-center">
                            {isOverdue ? (
                              <span className="inline-block bg-rose-100 text-rose-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                {currentUsage}/{sessionUnit}회 미납초과
                              </span>
                            ) : (
                              <span className="inline-block bg-amber-100 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">
                                {currentUsage}회차 완료
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-indigo-600">
                            {Number(s.tuitionFee || 0).toLocaleString()}원
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-500">
                            {(() => { const d = getComputedLastPayDate(s); return d ? `${parseInt(d.slice(5, 7))}월 ${parseInt(d.slice(8, 10))}일` : <span className="text-slate-300">없음</span>; })()}
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
                                onClick={(e) => { e.stopPropagation(); setKyuljePreviewStudent(s); }}
                                className="px-2 py-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 active:bg-emerald-200 font-medium"
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
                </div>
              )}
            </div>


            {/* 1주일 이내 결제선생 발송 이력 */}
            <div className="border rounded-xl overflow-hidden flex flex-col">
              <div className="bg-blue-50 px-4 py-2.5 flex items-center gap-2 border-b shrink-0">
                <Send size={15} className="text-blue-600" />
                <span className="font-bold text-blue-700 text-sm">1주일 이내 결제선생 발송 이력</span>
                <span className="bg-blue-200 text-blue-800 text-xs px-1.5 py-0.5 rounded-full">{weeklyKyuljeHistory.length}건</span>
                {weeklyKyuljeHistory.length > 0 && (
                  <>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                      결제 {weeklyKyuljeHistory.filter(r => r.paidAfter).length}건
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                      미납 {weeklyKyuljeHistory.filter(r => !r.paidAfter).length}건
                    </span>
                  </>
                )}
              </div>
              {weeklyKyuljeHistory.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-sm">1주일 이내 결제선생 발송 이력이 없습니다.</div>
              ) : (
                <div className="overflow-auto max-h-64">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 border-b text-xs text-slate-400 uppercase">
                      <tr>
                        <th className="py-2.5 px-4 text-left">이름 / 과목</th>
                        <th className="py-2.5 px-4 text-left">강사</th>
                        <th className="py-2.5 px-4 text-left">발송일</th>
                        <th className="py-2.5 px-4 text-left">결제 여부</th>
                        <th className="py-2.5 px-4 text-center">액션</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {weeklyKyuljeHistory.map(({ log, student: s, paidAfter }, i) => (
                        <tr key={`${log.studentId}-${log.sentAt}-${i}`} className="hover:bg-blue-50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="font-semibold">{log.studentName || s?.name || "-"}</div>
                            <div className="text-xs text-slate-400">{s?.subject || ""}</div>
                          </td>
                          <td className="py-3 px-4 text-slate-600">{s?.teacher || "-"}</td>
                          <td className="py-3 px-4 text-xs text-slate-500">{log.sentAt}</td>
                          <td className="py-3 px-4">
                            {paidAfter ? (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                                ✅ {paidAfter.date} · {Number(paidAfter.amount || 0).toLocaleString()}원
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">
                                ⏳ 미납
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            {!paidAfter && s && (
                              <button
                                onClick={() => { setQuickPayStudent(s); setQuickPayDate(toLocalDateStr()); }}
                                className="px-3 py-1 text-xs bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 font-bold"
                              >
                                결제 완료 ✓
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* 오늘 결제 완료 목록 */}
            <div className="border rounded-xl overflow-hidden flex flex-col">
              <div className="bg-emerald-50 px-4 py-2.5 flex items-center gap-2 border-b shrink-0">
                <CheckCircle size={15} className="text-emerald-600" />
                <span className="font-bold text-emerald-700 text-sm">최근 결제자</span>
                <span className="bg-emerald-200 text-emerald-800 text-xs px-1.5 py-0.5 rounded-full">{recentPaidList.length}건</span>
                <div className="ml-auto flex rounded-lg overflow-hidden border border-emerald-200 text-xs">
                  {[["today", "오늘"], ["week", "7일"], ["month", "30일"]].map(([val, label]) => (
                    <button
                      key={val}
                      onClick={() => setRecentPaidPeriod(val)}
                      className={`px-2.5 py-1 font-medium transition-colors ${recentPaidPeriod === val ? "bg-emerald-600 text-white" : "bg-white text-emerald-700 hover:bg-emerald-50"}`}
                    >{label}</button>
                  ))}
                </div>
              </div>
              {recentPaidList.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-sm">해당 기간 결제 내역이 없습니다.</div>
              ) : (
                <div className="overflow-auto max-h-72">
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-slate-50 border-b text-xs text-slate-400 uppercase">
                      <tr>
                        <th className="py-2.5 px-4 text-left">이름 / 과목</th>
                        <th className="py-2.5 px-4 text-left">강사</th>
                        <th className="py-2.5 px-4 text-center">결제일</th>
                        <th className="py-2.5 px-4 text-right">금액</th>
                        <th className="py-2.5 px-4 text-center">방법</th>
                        <th className="py-2.5 px-4 text-center">안내</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {recentPaidList.map(({ student: s, payment: p, notifLog }, i) => {
                        const methodColor = p.method === "결제선생" ? "bg-blue-100 text-blue-700" :
                          p.method === "현장" ? "bg-indigo-100 text-indigo-700" :
                          p.method === "계좌이체" ? "bg-emerald-100 text-emerald-700" :
                          "bg-slate-100 text-slate-600";
                        const notifCh = notifLog?.channels || [];
                        return (
                          <tr key={`${s.id}-${p.date}-${i}`} className="hover:bg-emerald-50 transition-colors cursor-pointer" onClick={() => onOpenStudentDetail?.(s)}>
                            <td className="py-2.5 px-4">
                              <div className="font-medium">{s.name}</div>
                              <div className="text-xs text-slate-400">{s.subject}</div>
                            </td>
                            <td className="py-2.5 px-4 text-slate-600 text-xs">{s.teacher || "-"}</td>
                            <td className="py-2.5 px-4 text-center text-xs text-slate-500">
                              {p.date.slice(5).replace("-", "/")}
                            </td>
                            <td className="py-2.5 px-4 text-right font-bold text-indigo-600">
                              {Number(p.amount || 0).toLocaleString()}원
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              {p.method ? (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${methodColor}`}>{p.method}</span>
                              ) : <span className="text-slate-300">-</span>}
                            </td>
                            <td className="py-2.5 px-4 text-center text-xs">
                              {notifLog ? (
                                notifCh.includes("결제선생") ? (
                                  <span className="text-blue-600 font-medium">💳 발송</span>
                                ) : notifCh.includes("sms") ? (
                                  <span className="text-amber-600 font-medium">📱 문자</span>
                                ) : (
                                  <span className="text-slate-400">발송</span>
                                )
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {recentPaidList.length > 0 && (
                <div className="px-4 py-2 bg-slate-50 border-t text-xs text-slate-500 flex justify-between">
                  <span>합계 {recentPaidList.length}건</span>
                  <span className="font-bold text-indigo-700">
                    {recentPaidList.reduce((sum, { payment: p }) => sum + Number(p.amount || 0), 0).toLocaleString()}원
                  </span>
                </div>
              )}
            </div>
          </div>
          </div>
        )}

        {/* ============================================================
            탭 2: 발송센터 (send)
            - 결제가 필요한 전체 학생 목록 (미납/만료)
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
                <span className="text-slate-400 mx-1">/</span>
                <span className="font-bold text-rose-600">
                  {sendList.reduce((sum, s) => sum + (Number(s.tuitionFee) || 0), 0).toLocaleString()}원
                </span>
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
                    <th className="py-3 px-4 text-left hidden sm:table-cell">강사</th>
                    <th className="py-3 px-4 text-right">원비</th>
                    <th className="py-3 px-4 text-left">상태</th>
                    <th className="py-3 px-4 text-left">최종결제일</th>
                    <th className="py-3 px-4 text-left hidden sm:table-cell">마지막 안내</th>
                    <th className="py-3 px-4 text-center">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {sendList.length === 0 ? (
                    <tr><td colSpan={8} className="py-12 text-center text-slate-400">결제 안내가 필요한 학생이 없습니다.</td></tr>
                  ) : sendList.map((s) => {
                    const { displayStatus, statusColor } = getStudentProgress(s);
                    const lastNotif = getLastNotifDate(s.id);
                    const lastPay = getLastPaymentDate(s);
                    // 이번 사이클(마지막 결제일 이후) 기준 안내 발송 상태
                    const cycleNotifSt = getNotifStatus(s.id, lastPay);
                    return (
                      <tr
                        key={s.id}
                        className={`border-b transition-colors cursor-pointer ${selectedIds.includes(s.id) ? "bg-indigo-50" : cycleNotifSt === "done" ? "bg-slate-50/60 hover:bg-slate-100" : "hover:bg-slate-50"}`}
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
                        <td className="py-3 px-4 text-slate-600 hidden sm:table-cell">{s.teacher || "-"}</td>
                        <td className="py-3 px-4 text-right font-bold text-indigo-600">
                          {s.tuitionFee ? Number(s.tuitionFee).toLocaleString() : 0}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor}`}>{displayStatus}</span>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500">
                          {(() => { const d = getComputedLastPayDate(s); return d ? `${d.slice(2,4)}/${d.slice(5,7)}/${d.slice(8,10)}` : <span className="text-slate-300">-</span>; })()}
                        </td>
                        <td className="py-3 px-4 text-xs hidden sm:table-cell">
                          {cycleNotifSt === "done" ? (
                            <span className="font-medium text-slate-400">
                              ✅ 안내완료 {lastNotif ? `(${lastNotif.slice(5,7)}/${lastNotif.slice(8,10)})` : ""}
                            </span>
                          ) : cycleNotifSt === "sms-only" ? (
                            <span className="font-medium text-amber-600">
                              🟡 SMS발송 {lastNotif ? `(${lastNotif.slice(5,7)}/${lastNotif.slice(8,10)})` : ""}
                            </span>
                          ) : (
                            <span className="text-rose-500 font-medium">🔴 미발송</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1">
                            <button
                              onClick={(e) => handleOpenMsgPreview(e, s)}
                              className="p-1.5 text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100 rounded-lg transition-colors"
                              title="안내 문자 미리보기"
                            >
                              <MessageSquareText size={16} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setKyuljePreviewStudent(s); }}
                              className="px-2 py-1 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 active:bg-emerald-200 font-medium"
                              title="결제선생 발송"
                            >💳</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
                <div className="flex rounded border border-rose-200 overflow-hidden text-xs ml-1">
                  <button
                    onClick={() => setDueSortOrder("desc")}
                    className={`px-2 py-1 font-medium transition-colors ${dueSortOrder === "desc" ? "bg-rose-600 text-white" : "bg-white text-rose-500 hover:bg-rose-50"}`}
                    title="최근 도래순 (내림차순)"
                  >최근순</button>
                  <button
                    onClick={() => setDueSortOrder("asc")}
                    className={`px-2 py-1 font-medium transition-colors ${dueSortOrder === "asc" ? "bg-rose-600 text-white" : "bg-white text-rose-500 hover:bg-rose-50"}`}
                    title="오래된 도래순 (오름차순)"
                  >오래된순</button>
                </div>
                {processableStudents.length > 0 && (
                  <span className="ml-auto text-rose-700 font-bold text-sm">
                    총 {processableStudents.reduce((sum, s) => sum + Number(s.tuitionFee || 0), 0).toLocaleString()}원
                  </span>
                )}
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b text-xs text-slate-400 uppercase">
                  <tr>
                    <th className="py-2.5 px-4 text-left">이름 / 과목</th>
                    <th className="py-2.5 px-4 text-left hidden sm:table-cell">강사</th>
                    <th className="py-2.5 px-4 text-right">원비</th>
                    <th className="py-2.5 px-4 text-left">최종결제일</th>
                    <th className="py-2.5 px-4 text-left">도래일 {dueSortOrder === "asc" ? "↑" : "↓"}</th>
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
                          <span className={`text-xs px-1.5 py-0.5 rounded ${statusColor}`}>{displayStatus}</span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 hidden sm:table-cell">{s.teacher || "-"}</td>
                        <td className="py-3 px-4 text-right font-bold text-indigo-600">
                          {Number(s.tuitionFee || 0).toLocaleString()}원
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-500">{getComputedLastPayDate(s) || "-"}</td>
                        <td className="py-3 px-4 text-xs">
                          {(() => {
                            const d = getPaymentDueDate(s);
                            if (!d) return <span className="text-slate-300">-</span>;
                            const days = Math.round((new Date() - new Date(d + "T00:00:00")) / 86400000);
                            return (
                              <span className={days >= 14 ? "font-bold text-rose-600" : days >= 7 ? "font-semibold text-amber-600" : "text-slate-500"}>
                                {d.slice(5).replace("-", "/")}
                                {days > 0 && <span className="ml-1 text-xs">({days}일 경과)</span>}
                              </span>
                            );
                          })()}
                        </td>
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
                              className="px-3 py-1.5 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 active:bg-blue-200 font-medium"
                            >
                              📱 문자 발송
                            </button>
                          ) : method ? (
                            <button
                              onClick={() => { setProcessQuickPay({ student: s, method }); setProcessPayDate(toLocalDateStr()); }}
                              className="px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 active:bg-emerald-200 font-medium"
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
                  {recentlyPaidList.length > 0 && (
                    <span className="text-emerald-700 font-bold text-sm">
                      총 {recentlyPaidList.reduce((sum, { payment: p }) => sum + Number(p.amount || 0), 0).toLocaleString()}원
                    </span>
                  )}
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
                    <th className="py-2.5 px-4 text-left hidden sm:table-cell">강사</th>
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
                      <td className="py-2.5 px-4 text-slate-600 hidden sm:table-cell">{s.teacher || "-"}</td>
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
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-sm font-medium text-slate-600">필터:</span>
            {[
              { key: "", label: "전체" },
              { key: "target", label: "결제 대상자" },
              { key: "unpaid", label: "미납자" },
            ].map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setManageFilter(key)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium border transition-colors ${
                  manageFilter === key
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-slate-600 border-slate-300 hover:border-indigo-400"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="border rounded-xl overflow-auto flex-1 min-h-0">
            <div className="bg-slate-50 px-4 py-2.5 flex items-center gap-2 border-b">
              <Users size={15} className="text-slate-600" />
              <span className="font-bold text-slate-700 text-sm">재원생 수납 현황</span>
              <span className="bg-slate-200 text-slate-700 text-xs px-1.5 py-0.5 rounded-full">{manageList.length}명</span>
              {manageFilter && (
                <span className="text-xs text-indigo-500 font-medium">
                  ({manageFilter === "target" ? "결제 대상자만" : "미납자만"})
                </span>
              )}
            </div>
            <table className="w-full text-sm min-w-[600px]">
              <thead className="sticky top-0 bg-slate-50 border-b">
                <tr className="text-slate-400 text-xs uppercase">
                  <th className="py-3 px-4 text-left">이름 / 과목</th>
                  <th className="py-3 px-4 text-left hidden sm:table-cell">강사</th>
                  <th className="py-3 px-4 text-right">원비</th>
                  <th className="py-3 px-4 text-center hidden sm:table-cell">진척도</th>
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
                      <td className="py-3 px-4 text-slate-600 hidden sm:table-cell">{s.teacher || "-"}</td>
                      <td className="py-3 px-4 text-right font-bold text-indigo-600">
                        {s.tuitionFee ? Number(s.tuitionFee).toLocaleString() : 0}
                      </td>
                      <td className="py-3 px-4 text-center font-mono font-bold text-slate-700 hidden sm:table-cell">
                        {currentUsage} / {sessionUnit}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColor}`}>{displayStatus}</span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">{getComputedLastPayDate(s) || "-"}</td>
                      <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={(e) => handleOpenMsgPreview(e, s)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100 rounded-lg transition-colors"
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

        {/* ============================================================
            탭 5: 결제선생 (kyulje)
            - 결제선생 채널 발송 이력 전체 조회 + 파기
        ============================================================ */}
        {activeTab === "kyulje" && (() => {
          // 통합 상태: Paymint 상태(F/W/C/D) + 수납 여부를 하나의 뱃지로 표시
          const getRowStatus = (log, paidAfter, bs) => {
            if (bs?.loading) return { text: "조회 중...", cls: "bg-slate-100 text-slate-400" };
            if (bs?.state === "D") return { text: "파기됨", cls: "bg-rose-100 text-rose-700" };
            if (bs?.state === "F") return { text: "결제(카드)", cls: "bg-emerald-100 text-emerald-700" };
            if (bs?.state === "C") return { text: "승인취소", cls: "bg-orange-100 text-orange-700" };
            if (paidAfter) return { text: `수납 ${paidAfter.date.slice(5).replace("-","/")} ${Number(paidAfter.amount||0).toLocaleString()}원`, cls: "bg-blue-100 text-blue-700" };
            if (bs?.state === "W") return { text: "미결제", cls: "bg-amber-100 text-amber-700" };
            if (!log.billId) return { text: "발송완료", cls: "bg-indigo-50 text-indigo-500" };
            return { text: "조회 중...", cls: "bg-slate-100 text-slate-400" };
          };
          return (
          <div className="flex-1 flex flex-col min-h-0 p-5 gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <CreditCard size={14} className="text-blue-500" />
              <span>결제선생 발송 이력 · 총 <span className="font-bold text-slate-700">{kyuljeLogsData.length}건</span></span>
              <span className="text-xs text-slate-400">(탭 진입 시 자동 상태 조회)</span>
            </div>
            <div className="border rounded-xl overflow-auto flex-1 min-h-0">
              {kyuljeLogsData.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-sm">결제선생 발송 이력이 없습니다.</div>
              ) : (
                <table className="w-full text-sm min-w-[560px]">
                  <thead className="sticky top-0 bg-slate-50 border-b text-xs text-slate-400 uppercase">
                    <tr>
                      <th className="py-3 px-4 text-left">이름 / 과목</th>
                      <th className="py-3 px-4 text-left">강사</th>
                      <th className="py-3 px-4 text-left">발송일</th>
                      <th className="py-3 px-4 text-center">상태</th>
                      <th className="py-3 px-4 text-center">파기</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {kyuljeLogsData.map(({ log, student, paidAfter }, i) => {
                      const bs = log.billId ? billStates[log.billId] : null;
                      const rowStatus = getRowStatus(log, paidAfter, bs);
                      const isDestroyed = bs?.state === "D";
                      return (
                      <tr key={`${log.id || log.studentId}-${i}`} className={`${isDestroyed ? "bg-rose-50 opacity-60" : "hover:bg-slate-50"} ${student && student.status !== "재원" ? "opacity-50" : ""}`}>
                        <td className="py-3 px-4 font-medium">
                          {log.studentName || "-"}
                          {student?.subject && <span className="text-xs text-slate-400 ml-1">({student.subject})</span>}
                          {student && student.status !== "재원" && (
                            <span className="ml-1 text-xs text-red-400">({student.status})</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-xs">{student?.teacher || "-"}</td>
                        <td className="py-3 px-4 text-slate-500 text-xs">{log.sentAt}</td>
                        <td className="py-3 px-4 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${rowStatus.cls}`}>{rowStatus.text}</span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {isDestroyed ? (
                            <span className="text-xs text-rose-300">파기됨</span>
                          ) : deleteConfirm?.id === log.id || (deleteConfirm && !log.id && deleteConfirm._idx === i) ? (
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={async () => {
                                  try {
                                    if (log.billId) await destroyBill(log.billId, String(student?.tuitionFee || 0));
                                  } catch (e) {
                                    showToast?.("Paymint 파기 실패: " + e.message, "error");
                                  }
                                  if (onDeleteMessageLog) await onDeleteMessageLog(log);
                                  setDeleteConfirm(null);
                                  if (log.billId) fetchBillState(log.billId);
                                }}
                                className="text-xs px-2 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700"
                              >확인</button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="text-xs px-2 py-1 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300"
                              >취소</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(log.id ? { id: log.id } : { _idx: i })}
                              className="text-xs px-2 py-1 text-red-400 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200"
                            >파기</button>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
          );
        })()}

        {/* ============================================================
            탭 6: 히스토리 (history)
            - 일간/주간/월간 기간별 수납 합계 + 건수 + 결제방법 분류
        ============================================================ */}
        {activeTab === "history" && (
          <div className="flex-1 overflow-auto min-h-0">
          <div className="p-5 flex flex-col gap-4">
            {/* 기간 선택 + 전체 총액 */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex rounded-lg overflow-hidden border border-slate-200 text-sm">
                {[["month", "월간"], ["week", "주간"], ["day", "일간"]].map(([val, label]) => (
                  <button
                    key={val}
                    onClick={() => setHistoryPeriod(val)}
                    className={`px-4 py-1.5 font-medium transition-colors ${historyPeriod === val ? "bg-indigo-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <CalendarDays size={15} className="text-indigo-500" />
                <span>전체 {historyData.length}개 기간</span>
                <span className="font-bold text-indigo-700">
                  합계 {historyData.reduce((sum, g) => sum + g.total, 0).toLocaleString()}원
                </span>
              </div>
            </div>

            {/* ── 수납 히스토리 ── */}
            <div className="border rounded-xl overflow-hidden">
              <div className="bg-indigo-50 px-4 py-2.5 flex items-center gap-2 border-b">
                <CreditCard size={14} className="text-indigo-600" />
                <span className="font-bold text-indigo-700 text-sm">수납 내역</span>
                <span className="text-xs text-indigo-400">{historyData.reduce((s, g) => s + g.items.length, 0)}건</span>
                <span className="ml-auto font-bold text-indigo-700 text-sm">
                  합계 {historyData.reduce((s, g) => s + g.total, 0).toLocaleString()}원
                </span>
              </div>
              {historyData.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-sm">수납 내역이 없습니다.</div>
              ) : (
                <div className="flex flex-col divide-y">
                  {historyData.map((group) => {
                    const methodColors = {
                      현장: "bg-indigo-100 text-indigo-700",
                      계좌이체: "bg-emerald-100 text-emerald-700",
                      결제선생: "bg-blue-100 text-blue-700",
                      기타: "bg-slate-100 text-slate-600",
                    };
                    return (
                      <details key={group.key} className="group">
                        <summary className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 list-none">
                          <ChevronRight size={14} className="text-slate-400 group-open:rotate-90 transition-transform shrink-0" />
                          <span className="font-semibold text-slate-700 text-sm">{group.label}</span>
                          <span className="text-xs text-slate-400">{group.items.length}건</span>
                          <span className="ml-auto font-bold text-indigo-700 text-sm">{group.total.toLocaleString()}원</span>
                          <div className="flex gap-1 flex-wrap">
                            {Object.entries(group.methods).map(([m, amt]) => (
                              <span key={m} className={`text-xs px-2 py-0.5 rounded-full font-medium ${methodColors[m] || "bg-slate-100 text-slate-600"}`}>
                                {m} {amt.toLocaleString()}원
                              </span>
                            ))}
                          </div>
                        </summary>
                        <table className="w-full text-sm border-t">
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {group.items
                              .sort((a, b) => b.payment.date.localeCompare(a.payment.date))
                              .map(({ student: s, payment: p }, i) => (
                                <tr key={`${s.id}-${p.date}-${i}`} className="hover:bg-slate-50">
                                  <td className="py-2 px-6 font-medium">
                                    {s.name}
                                    {s.subject && <span className="text-xs text-slate-400 ml-1">({s.subject})</span>}
                                  </td>
                                  <td className="py-2 px-4 text-slate-500">{s.teacher || "-"}</td>
                                  <td className="py-2 px-4 text-slate-500 text-xs">{p.date}</td>
                                  <td className="py-2 px-4 text-right font-bold text-indigo-600">
                                    {Number(p.amount || 0).toLocaleString()}원
                                  </td>
                                  <td className="py-2 px-4">
                                    {p.method ? (
                                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${methodColors[p.method] || "bg-slate-100 text-slate-600"}`}>
                                        {p.method}
                                      </span>
                                    ) : <span className="text-slate-300 text-xs">-</span>}
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </details>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ── 결제선생 발송 히스토리 ── */}
            <div className="border rounded-xl overflow-hidden">
              <div className="bg-blue-50 px-4 py-2.5 flex items-center gap-2 border-b flex-wrap">
                <Send size={14} className="text-blue-600" />
                <span className="font-bold text-blue-700 text-sm">발송 내역</span>
                <span className="text-xs text-blue-400">{sendHistoryData.reduce((s, g) => s + g.items.length, 0)}건 발송</span>
                {sendHistoryData.reduce((s, g) => s + g.kyuljeCount, 0) > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                    결제선생 {sendHistoryData.reduce((s, g) => s + g.kyuljeCount, 0)}건
                  </span>
                )}
                {sendHistoryData.reduce((s, g) => s + g.smsCount, 0) > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium">
                    SMS {sendHistoryData.reduce((s, g) => s + g.smsCount, 0)}건
                  </span>
                )}
                {sendHistoryData.reduce((s, g) => s + g.payCount, 0) > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                    수납 {sendHistoryData.reduce((s, g) => s + g.payCount, 0)}건
                  </span>
                )}
              </div>
              {sendHistoryData.length === 0 ? (
                <div className="py-10 text-center text-slate-400 text-sm">발송 내역이 없습니다.</div>
              ) : (
                <div className="flex flex-col divide-y">
                  {sendHistoryData.map((group) => (
                    <details key={group.key} className="group">
                      <summary className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 list-none">
                        <ChevronRight size={14} className="text-slate-400 group-open:rotate-90 transition-transform shrink-0" />
                        <span className="font-semibold text-slate-700 text-sm">{group.label}</span>
                        <span className="text-xs text-slate-400">{group.items.length}건 발송</span>
                        {group.kyuljeCount > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">결제선생 {group.kyuljeCount}</span>
                        )}
                        {group.smsCount > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-medium">SMS {group.smsCount}</span>
                        )}
                        {group.payCount > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">수납 {group.payCount}</span>
                        )}
                      </summary>
                      <table className="w-full text-sm border-t">
                        <thead className="bg-slate-50 text-xs text-slate-400 uppercase">
                          <tr>
                            <th className="py-2 px-6 text-left">이름</th>
                            <th className="py-2 px-4 text-left">발송일</th>
                            <th className="py-2 px-4 text-left">채널</th>
                            <th className="py-2 px-4 text-left">발송자</th>
                            <th className="py-2 px-4 text-left">결제확인</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {group.items
                            .sort((a, b) => b.sentAt.localeCompare(a.sentAt))
                            .map((log, i) => {
                              const channels = log.channels || [];
                              const hasKyulje = channels.includes("결제선생");
                              const hasSms = channels.includes("sms");
                              const student = students.find((s) => s.id === log.studentId);
                              const paidAfterSend = student
                                ? (student.paymentHistory || []).find((p) => p.date >= log.sentAt)
                                : null;
                              return (
                                <tr key={`${log.studentId}-${log.sentAt}-${i}`} className="hover:bg-slate-50">
                                  <td className="py-2 px-6 font-medium">{log.studentName || "-"}</td>
                                  <td className="py-2 px-4 text-slate-500 text-xs">{log.sentAt}</td>
                                  <td className="py-2 px-4">
                                    <div className="flex gap-1 flex-wrap">
                                      {hasKyulje && (
                                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700">결제선생</span>
                                      )}
                                      {hasSms && (
                                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-violet-100 text-violet-700">SMS</span>
                                      )}
                                      {!hasKyulje && !hasSms && (
                                        <span className="text-xs text-slate-300">-</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="py-2 px-4 text-slate-400 text-xs">{log.sentBy || "-"}</td>
                                  <td className="py-2 px-4">
                                    {paidAfterSend ? (
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                                        ✅ {paidAfterSend.date} {Number(paidAfterSend.amount || 0).toLocaleString()}원
                                      </span>
                                    ) : (
                                      <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-600 font-medium">⏳ 미확인</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </details>
                  ))}
                </div>
              )}
            </div>
          </div>
          </div>
        )}
      </div>
      {kyuljePreviewStudent && (
        <KyuljePreviewModal
          student={kyuljePreviewStudent}
          sending={kyuljeSending}
          onClose={() => setKyuljePreviewStudent(null)}
          onConfirm={async (override) => {
            setKyuljeSending(true);
            await handleKyuljeSend(kyuljePreviewStudent, override);
            setKyuljeSending(false);
            setKyuljePreviewStudent(null);
          }}
        />
      )}
    </div>
  );
};
