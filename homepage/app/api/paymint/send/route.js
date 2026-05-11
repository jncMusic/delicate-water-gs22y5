// [결제선생(Paymint) 청구서 발송 API Route]
// POST /api/paymint/send
// body: { studentId, studentName, phone, price }
//
// Paymint 2.1 발송요청: POST {PAYMINT_BASE_URL}/if/bill/send
// Hash: phone 있으면 SHA-256(bill_id*phone*price), 없으면 SHA-256(bill_id*price)

import crypto from "crypto";

const PAYMINT_BASE_URL =
  process.env.PAYMINT_BASE_URL || "https://erp-api.payssam.kr";
const PAYMINT_APIKEY =
  process.env.PAYMINT_APIKEY || "54C5SW2AWEYB0MVJ";
const PAYMINT_MEMBER =
  process.env.PAYMINT_MEMBER || "jncmusic";
const PAYMINT_MERCHANT =
  process.env.PAYMINT_MERCHANT || "jncmusic";
const CALLBACK_URL =
  process.env.PAYMINT_CALLBACK_URL || "https://jncmusic.kr/api/paymint/callback";
// 개발: bill_id = 사업자번호(10자리) + 10자리 자유롭게 (총 20자리)
const PAYMINT_CORP_NUM = process.env.PAYMINT_CORP_NUM || "5199600545";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function generateBillId() {
  // 개발: 사업자번호(10자리) + MMDDHHmmss(10자리) = 20자리
  // 운영: 동일 구조, PAYMINT_CORP_NUM만 실제 사업자번호로 교체
  const ts = new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, "")
    .slice(4, 14); // MMDDHHmmss
  return PAYMINT_CORP_NUM + ts;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request) {
  try {
    const { studentId, studentName, phone, price, subject, totalSessions, lastPaymentDate, note } = await request.json();

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
    const billId = generateBillId();
    const cleanPhone = (phone || "").replace(/[^0-9]/g, "");

    if (!cleanPhone) {
      return Response.json(
        { success: false, error: "전화번호가 없습니다. 학생 프로필에 전화번호를 입력해주세요." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Hash: phone 있으면 SHA-256(bill_id,phone,price), 없으면 SHA-256(bill_id,price)
    // 구분자는 쉼표(,) — 문서의 "*" 표기는 실제로 "," (Paymint 확인)
    const hash = crypto
      .createHash("sha256")
      .update(cleanPhone ? `${billId},${cleanPhone},${priceStr}` : `${billId},${priceStr}`)
      .digest("hex");

    // 유효기간: 발송일 기준 +1개월
    const expire = new Date();
    expire.setMonth(expire.getMonth() + 1);
    const expireStr = expire.toISOString().slice(0, 10);

    // 품목: subject 그대로 사용 (중복 방지)
    const productNm = subject || "수강료 결제 안내";
    // 메시지: PaymentView에서 전달된 note 우선, 없으면 최종결제일만
    const message = note || (lastPaymentDate
      ? `최종결제일: ${lastPaymentDate.replace(/-/g, "/")}`
      : "");

    const payload = {
      apikey: PAYMINT_APIKEY,
      member: PAYMINT_MEMBER,
      merchant: PAYMINT_MERCHANT,
      bill: {
        bill_id: billId,
        product_nm: productNm,
        phone: cleanPhone,
        message,
        member_nm: studentName,
        price: priceStr,
        hash,
        expire_dt: expireStr,
        callbackURL: CALLBACK_URL,
      },
    };

    const hashInput = cleanPhone ? `${billId},${cleanPhone},${priceStr}` : `${billId},${priceStr}`;
    console.log("[paymint/send] bill_id:", billId);
    console.log("[paymint/send] cleanPhone:", cleanPhone);
    console.log("[paymint/send] priceStr:", priceStr);
    console.log("[paymint/send] hash_input:", hashInput);
    console.log("[paymint/send] hash:", hash);
    console.log("[paymint/send] payload:", JSON.stringify(payload));

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
