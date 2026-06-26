// [결제선생 파기 검수 전용 테스트 라우트 - 임시]
// GET /api/paymint/destroy-test?phone=01012345678&price=20000
// 발송 → 즉시 파기 → bill_id 반환 (검수 완료 후 삭제 예정)

import crypto from "crypto";

const PAYMINT_BASE_URL =
  process.env.PAYMINT_BASE_URL || "https://stg.paymint.co.kr/partner";
const PAYMINT_APIKEY = process.env.PAYMINT_APIKEY || "TEST-API-KEY-TALK";
const PAYMINT_MEMBER = process.env.PAYMINT_MEMBER || "TEST-MEMBER-FOR-API";
const PAYMINT_MERCHANT =
  process.env.PAYMINT_MERCHANT || "TEST-MERCHANT-FOR-API";
const CALLBACK_URL =
  process.env.PAYMINT_CALLBACK_URL || "https://jncmusic.kr/api/paymint/callback";
const PAYMINT_CORP_NUM = process.env.PAYMINT_CORP_NUM || "2208875476";

function generateBillId() {
  const ts = new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, "")
    .slice(4, 14);
  return PAYMINT_CORP_NUM + ts;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = (searchParams.get("phone") || "01040289803").replace(/[^0-9]/g, "");
    const priceStr = searchParams.get("price") || "20000";
    const priceNum = Math.round(Number(priceStr));

    // 1. 발송
    const billId = generateBillId();
    const sendHash = crypto
      .createHash("sha256")
      .update(`${billId},${phone},${priceStr}`)
      .digest("hex");

    const expire = new Date();
    expire.setMonth(expire.getMonth() + 1);
    const expireStr = expire.toISOString().slice(0, 10);

    const sendPayload = {
      apikey: PAYMINT_APIKEY,
      member: PAYMINT_MEMBER,
      merchant: PAYMINT_MERCHANT,
      bill: {
        bill_id: billId,
        product_nm: "파기 검수 테스트",
        phone,
        message: `[파기 검수용] ${priceNum.toLocaleString()}원 테스트 청구서 — 클릭 불필요`,
        member_nm: "파기테스트",
        price: priceStr,
        hash: sendHash,
        expire_dt: expireStr,
        callbackURL: CALLBACK_URL,
      },
    };

    const sendRes = await fetch(`${PAYMINT_BASE_URL}/if/bill/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(sendPayload),
    });
    const sendData = await sendRes.json();

    if (sendData.code !== "0000") {
      return Response.json({
        step: "send",
        success: false,
        error: sendData.msg,
        code: sendData.code,
        billId,
      });
    }

    // 2. 즉시 파기 (결제 전 미결제 상태)
    const destroyHash = crypto
      .createHash("sha256")
      .update(`${billId},${priceStr}`)
      .digest("hex");

    const destroyRes = await fetch(`${PAYMINT_BASE_URL}/if/bill/destroy`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        apikey: PAYMINT_APIKEY,
        member: PAYMINT_MEMBER,
        merchant: PAYMINT_MERCHANT,
        bill_id: billId,
        price: priceStr,
        hash: destroyHash,
      }),
    });
    const destroyData = await destroyRes.json();

    return Response.json({
      step: "complete",
      billId,
      send: { code: sendData.code, msg: sendData.msg, shortURL: sendData.shortURL },
      destroy: { code: destroyData.code, msg: destroyData.msg },
      success: destroyData.code === "0000",
      reportToPaymint: destroyData.code === "0000"
        ? `✅ 청구서 파기 검수용 bill_id: ${billId}`
        : `❌ 파기 실패 — ${destroyData.msg}`,
    });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500 });
  }
}
