// [결제선생 승인동기화 콜백 - Paymint 2.2]
// POST /api/paymint/callback
// Paymint에서 결제 승인 후 이 URL로 결과를 전송
// appr_state: F=결제완료, W=미결제, C=취소, D=파기
//
// 결제완료(F) 시 messageLogs의 billId로 학생 조회 → paymentHistory 자동 추가
// (billId 중복 체크로 재호출 시 중복 저장 방지)

import { initializeApp, getApps } from "firebase/app";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDc6bGpzvxNALaxvrhZxSMxuHAvqQJozSE",
  authDomain: "jnc-music-dashboard.firebaseapp.com",
  projectId: "jnc-music-dashboard",
  storageBucket: "jnc-music-dashboard.firebasestorage.app",
  messagingSenderId: "228282757928",
  appId: "1:228282757928:web:6fae515d207d8a61e0961d",
};
const APP_ID = "jnc-music-v2";

function getDb() {
  const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return { db: getFirestore(app), auth: getAuth(app) };
}

async function ensureAuth(auth) {
  if (!auth.currentUser) {
    try {
      await signInAnonymously(auth);
    } catch (e) {
      console.error("[Paymint callback] 익명 로그인 실패:", e.message);
    }
  }
}

function parseApprDate(apprDt) {
  // Paymint appr_dt 예: "20260423153045" (YYYYMMDDHHmmss)
  if (!apprDt || typeof apprDt !== "string") return new Date().toISOString().slice(0, 10);
  const s = apprDt.replace(/[^0-9]/g, "");
  if (s.length < 8) return new Date().toISOString().slice(0, 10);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

async function autoRecordPayment(data) {
  const { bill_id, appr_state, appr_price, appr_dt } = data;
  if (appr_state !== "F") return { recorded: false, reason: `appr_state=${appr_state}` };
  if (!bill_id) return { recorded: false, reason: "no bill_id" };

  const { db, auth } = getDb();
  await ensureAuth(auth);

  // 1. messageLogs에서 bill_id로 학생 조회
  const logsRef = collection(db, "artifacts", APP_ID, "public", "data", "messageLogs");
  const logQuery = query(logsRef, where("billId", "==", bill_id));
  const logSnap = await getDocs(logQuery);
  if (logSnap.empty) {
    return { recorded: false, reason: `messageLogs에 bill_id=${bill_id} 없음` };
  }

  // 가장 최근 로그 사용 (같은 billId로 다수 기록 시)
  const logDocs = logSnap.docs.map((d) => ({ id: d.id, ref: d.ref, ...d.data() }));
  const latestLog = logDocs.sort((a, b) =>
    (b.createdAt || "").localeCompare(a.createdAt || "")
  )[0];
  const studentId = latestLog.studentId;
  if (!studentId) return { recorded: false, reason: "studentId 없음" };

  // 2. 학생 문서 조회
  const studentRef = doc(db, "artifacts", APP_ID, "public", "data", "students", studentId);
  const studentSnap = await getDoc(studentRef);
  if (!studentSnap.exists()) {
    return { recorded: false, reason: `student ${studentId} 없음` };
  }
  const student = studentSnap.data();

  // 3. 중복 저장 방지: 이미 동일 billId가 paymentHistory에 있으면 skip
  const existingHistory = student.paymentHistory || [];
  const alreadyRecorded = existingHistory.some((p) => p.billId === bill_id);
  if (alreadyRecorded) {
    return { recorded: false, reason: "이미 기록됨 (중복 방지)", studentId, billId: bill_id };
  }

  // 4. paymentHistory 항목 추가
  const payDate = parseApprDate(appr_dt);
  const amount = Math.round(Number(appr_price || student.tuitionFee || 0));
  const totalSessions = student.totalSessions || 4;

  const newItem = {
    date: payDate,
    amount,
    type: "tuition",
    sessionStartDate: payDate,
    totalSessions,
    method: "결제선생",
    billId: bill_id,
    apprDt: appr_dt || "",
    source: "paymint-callback",
    createdAt: new Date().toISOString(),
  };

  const updatedHistory = [...existingHistory, newItem];
  await updateDoc(studentRef, {
    paymentHistory: updatedHistory,
    lastPaymentDate: payDate,
    sessionsCompleted: 0,
    lastPaymentMethod: "결제선생",
  });

  // 5. messageLog에 결제완료 표시 (삭제하지 않고 paidAt 추가)
  try {
    await updateDoc(latestLog.ref, {
      paidAt: payDate,
      paidAmount: amount,
      apprState: appr_state,
    });
  } catch (logErr) {
    console.error("[Paymint callback] messageLog 업데이트 실패:", logErr.message);
  }

  return { recorded: true, studentId, billId: bill_id, amount, payDate };
}

export async function POST(request) {
  try {
    const data = await request.json();
    console.log("[Paymint callback] 수신:", JSON.stringify({
      bill_id: data.bill_id,
      appr_state: data.appr_state,
      appr_price: data.appr_price,
      appr_dt: data.appr_dt,
    }));

    // 결제완료(F) 시 자동 기록 — 실패해도 Paymint에는 성공 응답 (재전송 방지)
    try {
      const result = await autoRecordPayment(data);
      console.log("[Paymint callback] 자동기록 결과:", JSON.stringify(result));
    } catch (recordErr) {
      console.error("[Paymint callback] 자동기록 예외:", recordErr.message);
    }

    // Paymint가 기대하는 응답: { code: "0000", msg: "성공하였습니다." }
    return Response.json({ code: "0000", msg: "성공하였습니다." });
  } catch (e) {
    console.error("[Paymint callback] 처리 오류:", e.message);
    return Response.json({ code: "9999", msg: e.message });
  }
}
