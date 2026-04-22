// 청구서파기 검증용 임시 GET 라우트 (검수 후 삭제)
// GET /api/paymint/destroy-test?phone=YYY&price=ZZZ

import { createHash } from "crypto";

const PAYMINT_BASE_URL =
  process.env.PAYMINT_BASE_URL || "https://stg.paymint.co.kr/partner";
const PAYMINT_APIKEY = process.env.PAYMINT_APIKEY || "TEST-API-KEY-TALK";
const PAYMINT_MEMBER = process.env.PAYMINT_MEMBER || "TEST-MEMBER-FOR-API";
const PAYMINT_MERCHANT =
  process.env.PAYMINT_MERCHANT || "TEST-MERCHANT-FOR-API";
const PAYMINT_CORP_NUM = process.env.PAYMINT_CORP_NUM || "2208875476";

function sha256(str) {
  return createHash("sha256").update(str, "utf8").digest("hex");
}

function makeBillId() {
  const now = new Date();
  const pad = (n, l = 2) => String(n).padStart(l, "0");
  const ts =
    pad(now.getMonth() + 1) +
    pad(now.getDate()) +
    pad(now.getHours()) +
    pad(now.getMinutes()) +
    pad(now.getSeconds());
  return PAYMINT_CORP_NUM + ts;
}

async function callPaymint(path, body) {
  const res = await fetch(`${PAYMINT_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  return { status: res.status, data: parsed };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get("phone") || "01040289803";
  const price = parseInt(searchParams.get("price") || "100000", 10);
  const existingBillId = searchParams.get("billId");
  const base = { apikey: PAYMINT_APIKEY, member: PAYMINT_MEMBER, merchant: PAYMINT_MERCHANT };

  // 기존 billId 제공 시 send 단계 스킵, 바로 파기 시도
  if (existingBillId) {
    const destroyHash = sha256(`${existingBillId},${price}`);
    const destroyResult = await callPaymint("/if/bill/destroy", {
      ...base,
      bill_id: existingBillId,
      price,
      hash: destroyHash,
    });
    return Response.json({
      SUCCESS: destroyResult.data?.code === "0000",
      billId: existingBillId,
      price,
      destroyHash,
      destroyResponse: destroyResult.data,
    });
  }

  // 신규 청구서 발송
  const billId = makeBillId();
  const sendHash = sha256(`${billId},${phone},${price}`);
  const sendResult = await callPaymint("/if/bill/send", {
    ...base,
    corp_num: PAYMINT_CORP_NUM,
    phone,
    price,
    bill_id: billId,
    hash: sendHash,
    msg: "검수테스트",
    name: "검수",
  });

  if (!sendResult.data || sendResult.data.code !== "0000") {
    return Response.json({ SUCCESS: false, step: "send", billId, sendResult });
  }

  // 파기: SHA-256(bill_id + "," + price) — Paymint 확인된 공식
  const destroyHash = sha256(`${billId},${price}`);
  const destroyResult = await callPaymint("/if/bill/destroy", {
    ...base,
    bill_id: billId,
    price,
    hash: destroyHash,
  });

  const success = destroyResult.data && destroyResult.data.code === "0000";

  return Response.json({
    SUCCESS: success,
    billId,
    price,
    destroyHash,
    sendResponse: sendResult.data,
    destroyResponse: destroyResult.data,
  });
}
