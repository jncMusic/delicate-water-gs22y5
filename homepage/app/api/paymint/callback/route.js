// [결제선생 승인동기화 콜백 - Paymint 2.2]
// POST /api/paymint/callback
// appr_state: F=결제완료, W=미결제, C=취소, D=파기
//
// 결제완료(F) 시 messageLogs의 billId로 학생 조회 → paymentHistory 자동 추가
// Firebase SDK 대신 Firestore REST API 사용 (서버 라우트 webpack 호환)

const FIREBASE_API_KEY = "AIzaSyDc6bGpzvxNALaxvrhZxSMxuHAvqQJozSE";
const PROJECT_ID = "jnc-music-dashboard";
const APP_ID = "jnc-music-v2";
const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const DATA_PATH = `artifacts/${APP_ID}/public/data`;

// Firestore value → JS
function fromFsValue(fv) {
  if (!fv) return null;
  if ("nullValue" in fv) return null;
  if ("stringValue" in fv) return fv.stringValue;
  if ("booleanValue" in fv) return fv.booleanValue;
  if ("integerValue" in fv) return parseInt(fv.integerValue, 10);
  if ("doubleValue" in fv) return fv.doubleValue;
  if ("timestampValue" in fv) return fv.timestampValue;
  if ("arrayValue" in fv) return (fv.arrayValue.values || []).map(fromFsValue);
  if ("mapValue" in fv)
    return Object.fromEntries(
      Object.entries(fv.mapValue.fields || {}).map(([k, v]) => [k, fromFsValue(v)])
    );
  return null;
}

// JS → Firestore value
function toFsValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number")
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFsValue) } };
  if (typeof v === "object")
    return {
      mapValue: {
        fields: Object.fromEntries(
          Object.entries(v).map(([k, val]) => [k, toFsValue(val)])
        ),
      },
    };
  return { stringValue: String(v) };
}

// Firestore document fields → JS object
function docToObj(doc) {
  return Object.fromEntries(
    Object.entries(doc.fields || {}).map(([k, v]) => [k, fromFsValue(v)])
  );
}

// 익명 ID 토큰 발급 (signUp with returnSecureToken)
async function getAnonIdToken() {
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ returnSecureToken: true }),
    }
  );
  if (!res.ok) throw new Error(`익명 인증 실패: ${res.status}`);
  const data = await res.json();
  return data.idToken;
}

// messageLogs 컬렉션에서 billId로 조회
async function findLogsByBillId(token, billId) {
  const parent = `${FS_BASE}/${DATA_PATH}`;
  const res = await fetch(`${parent}:runQuery`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "messageLogs" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "billId" },
            op: "EQUAL",
            value: { stringValue: billId },
          },
        },
      },
    }),
  });
  const rows = await res.json();
  return (Array.isArray(rows) ? rows : [])
    .filter((r) => r.document)
    .map((r) => ({ name: r.document.name, ...docToObj(r.document) }));
}

// 학생 문서 조회
async function getStudent(token, studentId) {
  const name = `${FS_BASE}/${DATA_PATH}/students/${studentId}`;
  const res = await fetch(name, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  const doc = await res.json();
  return { id: studentId, ...docToObj(doc) };
}

// 학생 문서 부분 업데이트
async function updateStudent(token, studentId, updates) {
  const name = `${FS_BASE}/${DATA_PATH}/students/${studentId}`;
  const fields = Object.fromEntries(
    Object.entries(updates).map(([k, v]) => [k, toFsValue(v)])
  );
  const mask = Object.keys(updates)
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join("&");
  const res = await fetch(`${name}?${mask}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) throw new Error(`학생 업데이트 실패: ${res.status}`);
}

// messageLog 문서 부분 업데이트
async function updateLog(token, docName, updates) {
  const fields = Object.fromEntries(
    Object.entries(updates).map(([k, v]) => [k, toFsValue(v)])
  );
  const mask = Object.keys(updates)
    .map((k) => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
    .join("&");
  const res = await fetch(`${docName}?${mask}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ fields }),
  });
  if (!res.ok) {
    console.error("[callback] messageLog 업데이트 실패:", res.status);
  }
}

function parseApprDate(apprDt) {
  const s = String(apprDt || "").replace(/[^0-9]/g, "");
  if (s.length < 8) return new Date().toISOString().slice(0, 10);
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

async function autoRecordPayment(data) {
  const { bill_id, appr_state, appr_price, appr_dt } = data;
  if (appr_state !== "F") return { recorded: false, reason: `appr_state=${appr_state}` };
  if (!bill_id) return { recorded: false, reason: "no bill_id" };

  const token = await getAnonIdToken();

  // 1. billId로 messageLog 조회
  const logs = await findLogsByBillId(token, bill_id);
  if (!logs.length) return { recorded: false, reason: `bill_id=${bill_id} 로그 없음` };

  const latestLog = logs.sort((a, b) =>
    (b.createdAt || "").localeCompare(a.createdAt || "")
  )[0];
  const studentId = latestLog.studentId;
  if (!studentId) return { recorded: false, reason: "studentId 없음" };

  // 2. 학생 문서 조회
  const student = await getStudent(token, studentId);
  if (!student) return { recorded: false, reason: `student ${studentId} 없음` };

  // 3. 중복 방지
  const existingHistory = student.paymentHistory || [];
  if (existingHistory.some((p) => p.billId === bill_id)) {
    return { recorded: false, reason: "이미 기록됨 (중복 방지)", studentId, billId: bill_id };
  }

  // 4. paymentHistory 추가 + 학생 업데이트
  const payDate = parseApprDate(appr_dt);
  const amount = Math.round(Number(appr_price || student.tuitionFee || 0));
  const newItem = {
    date: payDate,
    amount,
    type: "tuition",
    sessionStartDate: payDate,
    totalSessions: student.totalSessions || 4,
    method: "결제선생",
    billId: bill_id,
    apprDt: appr_dt || "",
    source: "paymint-callback",
    createdAt: new Date().toISOString(),
  };
  await updateStudent(token, studentId, {
    paymentHistory: [...existingHistory, newItem],
    lastPaymentDate: payDate,
    sessionsCompleted: 0,
    lastPaymentMethod: "결제선생",
  });

  // 5. messageLog에 paidAt 마킹 (삭제하지 않고 이력 보존)
  await updateLog(token, latestLog.name, {
    paidAt: payDate,
    paidAmount: amount,
    apprState: appr_state,
  });

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

    // 자동 기록 — 실패해도 Paymint에 성공 응답 (재전송 방지)
    try {
      const result = await autoRecordPayment(data);
      console.log("[Paymint callback] 자동기록:", JSON.stringify(result));
    } catch (e) {
      console.error("[Paymint callback] 자동기록 예외:", e.message);
    }

    return Response.json({ code: "0000", msg: "성공하였습니다." });
  } catch (e) {
    console.error("[Paymint callback] 오류:", e.message);
    return Response.json({ code: "9999", msg: e.message });
  }
}
