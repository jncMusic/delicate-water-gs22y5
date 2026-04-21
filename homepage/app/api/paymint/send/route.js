// [결제선생(Paymint) 청구서 발송 API Route]
// POST /api/paymint/send
// body: { studentId, studentName, phone, price }
//
// Paymint 2.1 발송요청: POST {PAYMINT_BASE_URL}/if/bill/send
// Hash: SHA-256 of (bill_id)*price  (phone 미포함 공식)

import crypto from "crypto";

const PAYMINT_BASE_URL =
  process.env.PAYMINT_BASE_URL || "https://stg.paymint.co.kr/partner";
const PAYMINT_APIKEY =
  process.env.PAYMINT_APIKEY || "TEST-API-KEY-TALK";
const PAYMINT_MEMBER =
  process.env.PAYMINT_MEMBER || "TEST-MEMBER-FOR-API";
const PAYMINT_MERCHANT =
  process.env.PAYMINT_MERCHANT || "TEST-MERCHANT-FOR-API";
const CALLBACK_URL =
  process.env.PAYMINT_CALLBACK_URL || "https://jncmusic.kr/api/paymint/callback";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function generateBillId(studentId) {
  // 20자리: YYYYMMDDHHmmss(14) + studentId 끝 6자리
  const ts = new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, "")
    .slice(0, 14);
  const suffix = (studentId || "")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(-6)
    .padStart(6, "0");
  return (ts + suffix).slice(0, 20);
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request) {
  try {
    const { studentId, studentName, phone, price } = await request.json();

    if (!studentName) {
      return Response.json(
        { success: false, error: "학생 이름이 필요합니다." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const priceNum = Math.round(Number(price || 0));
    if (priceNum <= 0) {
      return Response.json(
        { success: false, error: "결제금액이 없습니다. 학생 프로필에서 수강료를 입력해주세요." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const priceStr = String(priceNum);
    const billId = generateBillId(studentId);
    const cleanPhone = (phone || "").replace(/[^0-9]/g, "");

    // Hash: phone 있으면 SHA-256(bill_id*phone*price), 없으면 SHA-256(bill_id*price)
    const hash = crypto
      .createHash("sha256")
      .update(cleanPhone ? `${billId}*${cleanPhone}*${priceStr}` : `${billId}*${priceStr}`)
      .digest("hex");

    // 유효기간: 발송일 기준 +1개월
    const expire = new Date();
    expire.setMonth(expire.getMonth() + 1);
    const expireStr = expire.toISOString().slice(0, 10);

    const payload = {
      apikey: PAYMINT_APIKEY,
      member: PAYMINT_MEMBER,
      merchant: PAYMINT_MERCHANT,
      bill: {
        bill_id: billId,
        product_nm: "수강료 결제 안내",
        phone: cleanPhone,
        message: `${studentName} 학생의 수강료 ${priceNum.toLocaleString()}원 결제 안내입니다.`,
        member_nm: studentName,
        member_ref: cleanPhone,
        price: priceStr,
        hash,
        expire_dt: expireStr,
        callbackURL: CALLBACK_URL,
      },
    };

    const paymintRes = await fetch(`${PAYMINT_BASE_URL}/if/bill/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(payload),
    });

    const data = await paymintRes.json();

    if (data.code !== "0000") {
      return Response.json(
        { success: false, error: data.msg || "결제선생 발송 실패", code: data.code },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    return Response.json(
      { success: true, billId, shortURL: data.shortURL, code: data.code },
      { headers: CORS_HEADERS }
    );
  } catch (e) {
    return Response.json(
      { success: false, error: e.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
