// [Paymint 다중 해시 공식 실전 테스트 - 배포 후 삭제]
// GET /api/paymint/send-test?phone=010XXXXXXXX
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

const sha256lower = (s) => crypto.createHash("sha256").update(s).digest("hex");
const sha256upper = (s) => crypto.createHash("sha256").update(s).digest("hex").toUpperCase();
const hmacLower = (key, s) => crypto.createHmac("sha256", key).update(s).digest("hex");

function makeBillId(suffix2) {
  const ts = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(4, 14);
  return `${PAYMINT_CORP_NUM}${ts.slice(0, 8)}${suffix2}`;
}

async function tryFormula(label, billId, phone, price, hashFn) {
  const hashInput = hashFn._input ? hashFn._input(billId, phone, price) : "?";
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
    return { label, billId, hashInput, hash, code: data.code, msg: data.msg, ok: data.code === "0000" };
  } catch (e) {
    return { label, billId, hashInput, hash, error: e.message, ok: false };
  }
}

function fn(fn_, inputFn) { fn_._input = inputFn; return fn_; }

export async function GET(request) {
  const phone = new URL(request.url).searchParams.get("phone") || "01000000000";
  const price = "25000";

  const results = [];

  // 소문자
  results.push(await tryFormula("lower_no_phone",   makeBillId("01"), phone, price,
    fn((b,_,p) => sha256lower(`${b}*${p}`),        (b,_,p) => `${b}*${p}`)));
  results.push(await tryFormula("lower_with_phone", makeBillId("02"), phone, price,
    fn((b,ph,p) => sha256lower(`${b}*${ph}*${p}`), (b,ph,p) => `${b}*${ph}*${p}`)));

  // 대문자 (UPPERCASE)
  results.push(await tryFormula("upper_no_phone",   makeBillId("03"), phone, price,
    fn((b,_,p) => sha256upper(`${b}*${p}`),        (b,_,p) => `${b}*${p}`)));
  results.push(await tryFormula("upper_with_phone", makeBillId("04"), phone, price,
    fn((b,ph,p) => sha256upper(`${b}*${ph}*${p}`), (b,ph,p) => `${b}*${ph}*${p}`)));

  // HMAC (소문자)
  results.push(await tryFormula("hmac_no_phone",    makeBillId("05"), phone, price,
    fn((b,_,p) => hmacLower(PAYMINT_APIKEY, `${b}*${p}`),        (b,_,p) => `HMAC(${b}*${p})`)));
  results.push(await tryFormula("hmac_with_phone",  makeBillId("06"), phone, price,
    fn((b,ph,p) => hmacLower(PAYMINT_APIKEY, `${b}*${ph}*${p}`), (b,ph,p) => `HMAC(${b}*${ph}*${p})`)));

  // 역순
  results.push(await tryFormula("lower_price_first", makeBillId("07"), phone, price,
    fn((b,_,p) => sha256lower(`${p}*${b}`), (b,_,p) => `${p}*${b}`)));

  const winner = results.find((r) => r.ok);
  return Response.json({ winner: winner?.label ?? "none", results });
}
