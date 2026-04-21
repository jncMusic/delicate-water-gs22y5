// [Paymint 다중 해시 공식 실전 테스트 - 배포 후 삭제]
// GET /api/paymint/send-test
// 여러 hash 공식으로 실제 Paymint API에 전송해 어떤 공식이 통과되는지 확인

import crypto from "crypto";

const PAYMINT_BASE_URL =
  process.env.PAYMINT_BASE_URL || "https://stg.paymint.co.kr/partner";
const PAYMINT_APIKEY = process.env.PAYMINT_APIKEY || "TEST-API-KEY-TALK";
const PAYMINT_MEMBER = process.env.PAYMINT_MEMBER || "TEST-MEMBER-FOR-API";
const PAYMINT_MERCHANT = process.env.PAYMINT_MERCHANT || "TEST-MERCHANT-FOR-API";
const PAYMINT_CORP_NUM = process.env.PAYMINT_CORP_NUM || "2208875476";
const CALLBACK_URL =
  process.env.PAYMINT_CALLBACK_URL || "https://jncmusic.kr/api/paymint/callback";

function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}
function hmac(key, s) {
  return crypto.createHmac("sha256", key).update(s).digest("hex");
}

function makeBillId(suffix) {
  const ts = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(4, 12); // MMDDHHmm
  return `${PAYMINT_CORP_NUM}-${ts}${suffix}`;
}

async function tryFormula(label, billId, phone, price, hashFn) {
  const hash = hashFn(billId, phone, price);
  const payload = {
    apikey: PAYMINT_APIKEY,
    member: PAYMINT_MEMBER,
    merchant: PAYMINT_MERCHANT,
    bill: {
      bill_id: billId,
      product_nm: "해시테스트",
      phone,
      message: "해시공식 테스트",
      member_nm: "테스트",
      price,
      hash,
      expire_dt: "2099-12-31",
      callbackURL: CALLBACK_URL,
    },
  };
  try {
    const res = await fetch(`${PAYMINT_BASE_URL}/if/bill/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return { label, billId, hashInput: `[${label}]`, hash, code: data.code, msg: data.msg, ok: data.code === "0000" };
  } catch (e) {
    return { label, billId, hash, error: e.message, ok: false };
  }
}

export async function GET(request) {
  const phone = new URL(request.url).searchParams.get("phone") || "01000000000";
  const price = "25000"; // 테스트 최소금액 2만원 이상

  const results = [];

  // 공식 1: SHA-256(bill_id*price) — phone 없이
  results.push(await tryFormula(
    "sha256_no_phone",
    makeBillId("01"),
    phone, price,
    (bid, _ph, pr) => sha256(`${bid}*${pr}`)
  ));

  // 공식 2: SHA-256(bill_id*phone*price) — 현재 방식
  results.push(await tryFormula(
    "sha256_with_phone",
    makeBillId("02"),
    phone, price,
    (bid, ph, pr) => sha256(`${bid}*${ph}*${pr}`)
  ));

  // 공식 3: SHA-256(price*bill_id) — 역순
  results.push(await tryFormula(
    "sha256_price_bid",
    makeBillId("03"),
    phone, price,
    (bid, _ph, pr) => sha256(`${pr}*${bid}`)
  ));

  // 공식 4: HMAC-SHA256(apikey, bill_id*price)
  results.push(await tryFormula(
    "hmac_apikey_no_phone",
    makeBillId("04"),
    phone, price,
    (bid, _ph, pr) => hmac(PAYMINT_APIKEY, `${bid}*${pr}`)
  ));

  // 공식 5: HMAC-SHA256(apikey, bill_id*phone*price)
  results.push(await tryFormula(
    "hmac_apikey_with_phone",
    makeBillId("05"),
    phone, price,
    (bid, ph, pr) => hmac(PAYMINT_APIKEY, `${bid}*${ph}*${pr}`)
  ));

  // 공식 6: SHA-256(bill_id*phone*price) — 하이픈 없는 bill_id
  const nohyphenBid = `${PAYMINT_CORP_NUM}0421${String(Date.now()).slice(-6)}`;
  results.push(await tryFormula(
    "sha256_nohyphen_with_phone",
    nohyphenBid,
    phone, price,
    (bid, ph, pr) => sha256(`${bid}*${ph}*${pr}`)
  ));

  const winner = results.find((r) => r.ok);
  return Response.json({ winner: winner?.label ?? "none", results });
}
