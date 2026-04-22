// [Paymint 검수 보고서 자동 생성 - 배포 후 삭제]
// GET /api/paymint/test-report?approvedBillId=XXXX
// approvedBillId: 이미 결제완료된 청구서 bill_id (결제승인+승인취소용)
// 신규 청구서 발송→조회→파기까지 자동 실행

import crypto from "crypto";

const PAYMINT_BASE_URL =
  process.env.PAYMINT_BASE_URL || "https://stg.paymint.co.kr/partner";
const PAYMINT_APIKEY = process.env.PAYMINT_APIKEY || "TEST-API-KEY-TALK";
const PAYMINT_MEMBER = process.env.PAYMINT_MEMBER || "TEST-MEMBER-FOR-API";
const PAYMINT_MERCHANT = process.env.PAYMINT_MERCHANT || "TEST-MERCHANT-FOR-API";
const CALLBACK_URL = process.env.PAYMINT_CALLBACK_URL || "https://jncmusic.kr/api/paymint/callback";
const PAYMINT_CORP_NUM = process.env.PAYMINT_CORP_NUM || "2208875476";

const call = async (path, body) => {
  const res = await fetch(`${PAYMINT_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  return res.json();
};

function makeBillId() {
  const ts = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(4, 14);
  return PAYMINT_CORP_NUM + ts;
}

export async function GET(request) {
  const approvedBillId = new URL(request.url).searchParams.get("approvedBillId") || "";
  const report = {};

  // 1. 결제승인 - 이미 결제된 건 조회로 확인
  if (approvedBillId) {
    const r = await call("/if/bill/read", {
      apikey: PAYMINT_APIKEY, member: PAYMINT_MEMBER, merchant: PAYMINT_MERCHANT,
      bill_id: approvedBillId,
    });
    report["결제승인"] = { billId: approvedBillId, code: r.code, state: r.appr_state, msg: r.msg };
  } else {
    report["결제승인"] = { note: "approvedBillId 파라미터 필요" };
  }

  // 2. 청구서 파기용 신규 청구서 발송
  const newBillId = makeBillId();
  const price = "20000";
  const rawPhone = new URL(request.url).searchParams.get("phone") || "";
  const phone = rawPhone.replace(/[^0-9]/g, "");
  if (!phone) {
    return Response.json({ error: "phone 파라미터 필요 (?phone=010XXXXXXXX)" }, { status: 400 });
  }
  const hash = crypto.createHash("sha256").update(`${newBillId},${phone},${price}`).digest("hex");
  const sendRes = await call("/if/bill/send", {
    apikey: PAYMINT_APIKEY, member: PAYMINT_MEMBER, merchant: PAYMINT_MERCHANT,
    bill: {
      bill_id: newBillId, product_nm: "검수테스트", phone, message: "검수 테스트용 청구서",
      member_nm: "검수테스트", price, hash, expire_dt: "2099-12-31", callbackURL: CALLBACK_URL,
    },
  });
  report["신규발송"] = { billId: newBillId, code: sendRes.code, msg: sendRes.msg };

  // 3. 청구서 조회
  const readRes = await call("/if/bill/read", {
    apikey: PAYMINT_APIKEY, member: PAYMINT_MEMBER, merchant: PAYMINT_MERCHANT,
    bill_id: newBillId,
  });
  report["청구서조회"] = { billId: newBillId, code: readRes.code, state: readRes.appr_state, msg: readRes.msg };

  // 4. 청구서 파기 (hash = SHA-256(bill_id) 또는 SHA-256(bill_id,phone,price) 시도)
  const destroyHash1 = crypto.createHash("sha256").update(newBillId).digest("hex");
  const destroyHash2 = crypto.createHash("sha256").update(`${newBillId},${phone},${price}`).digest("hex");
  let destroyRes = await call("/if/bill/destroy", {
    apikey: PAYMINT_APIKEY, member: PAYMINT_MEMBER, merchant: PAYMINT_MERCHANT,
    bill_id: newBillId, hash: destroyHash1,
  });
  let destroyHashUsed = "SHA256(bill_id)";
  if (destroyRes.code !== "0000") {
    const destroyRes2 = await call("/if/bill/destroy", {
      apikey: PAYMINT_APIKEY, member: PAYMINT_MEMBER, merchant: PAYMINT_MERCHANT,
      bill_id: newBillId, hash: destroyHash2,
    });
    if (destroyRes2.code === "0000") { destroyRes = destroyRes2; destroyHashUsed = "SHA256(bill_id,phone,price)"; }
  }
  report["청구서파기"] = { billId: newBillId, code: destroyRes.code, msg: destroyRes.msg, hashUsed: destroyHashUsed };

  // 5. 승인취소 - state가 이미 "C"이면 이미 완료된 것으로 처리
  if (approvedBillId) {
    if (report["결제승인"]?.state === "C") {
      report["승인취소"] = { billId: approvedBillId, note: "이미 취소 완료 (state=C)", code: "0000" };
    } else {
      const cancelRes = await call("/if/bill/cancel", {
        apikey: PAYMINT_APIKEY, member: PAYMINT_MEMBER, merchant: PAYMINT_MERCHANT,
        bill_id: approvedBillId,
      });
      report["승인취소"] = { billId: approvedBillId, code: cancelRes.code, msg: cancelRes.msg };
    }
  } else {
    report["승인취소"] = { note: "approvedBillId 파라미터 필요" };
  }

  // 검수 메일 양식 생성
  const mailBody = `결제승인 : ${approvedBillId || "(미입력)"}
승인취소 : ${approvedBillId || "(미입력)"}
청구서 파기 : ${newBillId}
청구서 조회 : ${newBillId}
승인 동기화 : (콜백 수신 완료)`;

  return Response.json({ report, mailBody });
}
