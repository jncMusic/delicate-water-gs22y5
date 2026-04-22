// [Paymint 다중 해시 공식 실전 테스트 - 배포 후 삭제]
// GET /api/paymint/send-test?phone=010XXXXXXXX

import crypto from "crypto";

const PAYMINT_BASE_URL =
  process.env.PAYMINT_BASE_URL || "https://stg.paymint.co.kr/partner";
const PAYMINT_APIKEY = process.env.PAYMINT_APIKEY || "TEST-API-KEY-TALK";
const PAYMINT_MEMBER = process.env.PAYMINT_MEMBER || "TEST-MEMBER-FOR-API";
const PAYMINT_MERCHANT = process.env.PAYMINT_MERCHANT || "TEST-MERCHANT-FOR-API";
const PAYMINT_CORP_NUM = process.env.PAYMINT_CORP_NUM || "2208875476";
const CALLBACK_URL =
  process.env.PAYMINT_CALLBACK_URL || "https://jncmusic.kr/api/paymint/callback";

const h = (s) => crypto.createHash("sha256").update(s).digest("hex");
const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");

let counter = 0;
function makeBillId() {
  counter++;
  const ts = new Date().toISOString().replace(/[-:T.Z]/g, "").slice(4, 14);
  return `${PAYMINT_CORP_NUM}${ts.slice(0, 8)}${String(counter).padStart(2, "0")}`;
}

async function t(label, phone, price, inputStr, hash) {
  const billId = makeBillId();
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
    return { label, billId, input: inputStr, hash, code: data.code, msg: data.msg, ok: data.code === "0000" };
  } catch (e) {
    return { label, billId, input: inputStr, hash, error: e.message, ok: false };
  }
}

export async function GET(request) {
  counter = 0;
  const ph = new URL(request.url).searchParams.get("phone") || "01000000000";
  const pr = "25000";
  const bid = () => `${PAYMINT_CORP_NUM}${new Date().toISOString().replace(/[-:T.Z]/g,"").slice(4,14).slice(0,8)}XX`;

  const results = [];

  // 기존 공식들 (이미 실패, 비교용으로 1개만)
  results.push(await t("①lower_no_phone",   ph, pr, `${bid()}*${pr}`,  h(`${bid()}*${pr}`)));

  // member/merchant/apikey 포함 공식
  const b2 = makeBillId(); const i2 = `${b2}*${PAYMINT_MEMBER}*${pr}`;
  results.push(await t("②bid_member_price",  ph, pr, i2, h(i2)));

  const b3 = makeBillId(); const i3 = `${b3}*${PAYMINT_MERCHANT}*${pr}`;
  results.push(await t("③bid_merchant_price", ph, pr, i3, h(i3)));

  const b4 = makeBillId(); const i4 = `${b4}*${PAYMINT_APIKEY}*${pr}`;
  results.push(await t("④bid_apikey_price",  ph, pr, i4, h(i4)));

  const b5 = makeBillId(); const i5 = `${b5}*${PAYMINT_MEMBER}*${ph}*${pr}`;
  results.push(await t("⑤bid_member_phone_price", ph, pr, i5, h(i5)));

  const b6 = makeBillId(); const i6 = `${b6}*${PAYMINT_APIKEY}*${ph}*${pr}`;
  results.push(await t("⑥bid_apikey_phone_price", ph, pr, i6, h(i6)));

  // 구분자 없는 단순 연결
  const b7 = makeBillId(); const i7 = `${b7}${ph}${pr}`;
  results.push(await t("⑦concat_no_sep", ph, pr, i7, h(i7)));

  const b8 = makeBillId(); const i8 = `${b8}${pr}`;
  results.push(await t("⑧concat_bid_price", ph, pr, i8, h(i8)));

  // MD5
  const b9 = makeBillId(); const i9 = `${b9}*${pr}`;
  results.push(await t("⑨md5_no_phone", ph, pr, i9, md5(i9)));

  const b10 = makeBillId(); const i10 = `${b10}*${ph}*${pr}`;
  results.push(await t("⑩md5_with_phone", ph, pr, i10, md5(i10)));

  const winner = results.find((r) => r.ok);
  return Response.json({ winner: winner?.label ?? "none", results });
}
