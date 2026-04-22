// 청구서파기 파라미터 탐색용 임시 GET 라우트 (검수 후 삭제)
// GET /api/paymint/destroy-test?phone=YYY&price=ZZZ&mode=read|send|destroy

const PAYMINT_BASE_URL =
  process.env.PAYMINT_BASE_URL || "https://stg.paymint.co.kr/partner";
const PAYMINT_APIKEY = process.env.PAYMINT_APIKEY || "TEST-API-KEY-TALK";
const PAYMINT_MEMBER = process.env.PAYMINT_MEMBER || "TEST-MEMBER-FOR-API";
const PAYMINT_MERCHANT =
  process.env.PAYMINT_MERCHANT || "TEST-MERCHANT-FOR-API";
const PAYMINT_CORP_NUM = process.env.PAYMINT_CORP_NUM || "2208875476";

import { createHash } from "crypto";

function sha256hex(str) {
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
  const mode = searchParams.get("mode") || "full";
  const existingBillId = searchParams.get("billId");

  const base = { apikey: PAYMINT_APIKEY, member: PAYMINT_MEMBER, merchant: PAYMINT_MERCHANT };

  // mode=read: 기존 billId로 조회해서 전체 응답 확인
  if (mode === "read" && existingBillId) {
    const r1 = await callPaymint("/if/bill/read", { ...base, bill_id: existingBillId });
    const r2 = await callPaymint("/if/bill/read", { ...base, billId: existingBillId });
    return Response.json({ mode: "read", billId: existingBillId, snake: r1, camel: r2 });
  }

  // 신규 청구서 발송
  const billId = makeBillId();
  const hash = sha256hex(`${billId},${phone},${price}`);
  const sendBody = {
    ...base,
    corp_num: PAYMINT_CORP_NUM,
    phone,
    price,
    bill_id: billId,
    hash,
    msg: "검수테스트",
    name: "검수",
  };
  const sendResult = await callPaymint("/if/bill/send", sendBody);

  if (mode === "send") {
    return Response.json({ mode: "send", billId, sendResult });
  }

  if (!sendResult.data || sendResult.data.code !== "0000") {
    return Response.json({ SUCCESS: false, step: "send", billId, sendResult });
  }

  // 발송 성공 → Paymint가 반환한 전체 데이터 확인 후 파기 시도
  const paymintData = sendResult.data;

  // paymintData에서 추출 가능한 ID 필드들
  const ids = {
    ourBillId: billId,
    paymintBillId: paymintData.bill_id,
    paymintBillIdCamel: paymintData.billId,
    paymintBillKey: paymintData.bill_key,
    paymintBillSeq: paymintData.bill_seq,
    paymintBillSeqCamel: paymintData.billSeq,
    paymintId: paymintData.id,
  };

  if (mode === "inspect") {
    return Response.json({ mode: "inspect", billId, paymintData, ids });
  }

  // destroy 시도: camelCase billId 우선, 그 다음 Paymint 응답의 ID들
  const destroyVariants = [
    { label: "camel_our", body: { ...base, billId } },
    { label: "snake_our", body: { ...base, bill_id: billId } },
    ...(paymintData.bill_id ? [{ label: "snake_paymint", body: { ...base, bill_id: paymintData.bill_id } }] : []),
    ...(paymintData.billId ? [{ label: "camel_paymint", body: { ...base, billId: paymintData.billId } }] : []),
    ...(paymintData.bill_seq ? [{ label: "billSeq_snake", body: { ...base, bill_seq: paymintData.bill_seq } }] : []),
    ...(paymintData.billSeq ? [{ label: "billSeq_camel", body: { ...base, billSeq: paymintData.billSeq } }] : []),
    { label: "camel+corp", body: { ...base, billId, corp_num: PAYMINT_CORP_NUM } },
    { label: "camel+phone+price", body: { ...base, billId, phone, price } },
    { label: "camel+hash", body: { ...base, billId, hash: sha256hex(billId) } },
    { label: "camel+hash2", body: { ...base, billId, hash: sha256hex(`${billId},${phone},${price}`) } },
  ];

  const destroyResults = [];
  let winner = null;
  for (const v of destroyVariants) {
    const r = await callPaymint("/if/bill/destroy", v.body);
    destroyResults.push({ label: v.label, ...r });
    if (r.data && r.data.code === "0000") {
      winner = { label: v.label, body: v.body, response: r };
      break;
    }
  }

  return Response.json({
    SUCCESS: !!winner,
    billId,
    paymintSendData: paymintData,
    ids,
    winner,
    destroyResults,
  });
}
