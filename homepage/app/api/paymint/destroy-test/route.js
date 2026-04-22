// 청구서파기 파라미터 탐색용 임시 GET 라우트 (검수 후 삭제)
// GET /api/paymint/destroy-test?billId=XXX&phone=YYY&price=ZZZ

const PAYMINT_BASE_URL =
  process.env.PAYMINT_BASE_URL || "https://stg.paymint.co.kr/partner";
const PAYMINT_APIKEY = process.env.PAYMINT_APIKEY || "TEST-API-KEY-TALK";
const PAYMINT_MEMBER = process.env.PAYMINT_MEMBER || "TEST-MEMBER-FOR-API";
const PAYMINT_MERCHANT =
  process.env.PAYMINT_MERCHANT || "TEST-MERCHANT-FOR-API";
const PAYMINT_CORP_NUM = process.env.PAYMINT_CORP_NUM || "2208875476";

async function tryDestroy(label, bodyObj) {
  try {
    const res = await fetch(`${PAYMINT_BASE_URL}/if/bill/destroy`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(bodyObj),
    });
    const text = await res.text();
    let parsed;
    try { parsed = JSON.parse(text); } catch { parsed = text; }
    return { label, status: res.status, result: parsed };
  } catch (e) {
    return { label, error: e.message };
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const billId = searchParams.get("billId") || "22088754760422051452";
  const phone = searchParams.get("phone") || "01040289803";
  const price = parseInt(searchParams.get("price") || "100000", 10);

  const base = { apikey: PAYMINT_APIKEY, member: PAYMINT_MEMBER, merchant: PAYMINT_MERCHANT };

  const variants = [
    // 1. camelCase billId
    { label: "camelCase_billId", ...base, billId },
    // 2. snake_case bill_id (baseline)
    { label: "snake_bill_id", ...base, bill_id: billId },
    // 3. + corp_num
    { label: "snake+corp_num", ...base, bill_id: billId, corp_num: PAYMINT_CORP_NUM },
    // 4. camelCase + corp_num
    { label: "camel+corp_num", ...base, billId, corp_num: PAYMINT_CORP_NUM },
    // 5. + phone + price
    { label: "snake+phone+price", ...base, bill_id: billId, phone, price },
    // 6. camelCase + phone + price
    { label: "camel+phone+price", ...base, billId, phone, price },
    // 7. only apikey + bill_id
    { label: "minimal_snake", apikey: PAYMINT_APIKEY, bill_id: billId },
    // 8. only apikey + billId
    { label: "minimal_camel", apikey: PAYMINT_APIKEY, billId },
    // 9. member only (no merchant)
    { label: "no_merchant", apikey: PAYMINT_APIKEY, member: PAYMINT_MEMBER, bill_id: billId },
    // 10. apikey + member + corp_num + bill_id
    { label: "member+corp+snake", apikey: PAYMINT_APIKEY, member: PAYMINT_MEMBER, corp_num: PAYMINT_CORP_NUM, bill_id: billId },
    // 11. all fields camelCase
    { label: "all_camel", apiKey: PAYMINT_APIKEY, member: PAYMINT_MEMBER, merchant: PAYMINT_MERCHANT, billId, corpNum: PAYMINT_CORP_NUM },
    // 12. snake + billNo
    { label: "bill_no", ...base, bill_no: billId },
    // 13. snake + order_id
    { label: "order_id", ...base, order_id: billId },
    // 14. nested bill object camelCase
    { label: "nested_camel", ...base, bill: { billId } },
    // 15. only snake, with reason
    { label: "snake+reason", ...base, bill_id: billId, reason: "검수" },
  ];

  const results = [];
  for (const v of variants) {
    const { label, ...body } = v;
    const r = await tryDestroy(label, body);
    results.push(r);
    // 성공하면 바로 반환
    if (r.result && r.result.code === "0000") {
      return Response.json({ SUCCESS: true, winner: r, allTried: results });
    }
  }

  return Response.json({ SUCCESS: false, billId, results });
}
