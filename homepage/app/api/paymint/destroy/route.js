// [결제선생 청구서 파기 - Paymint 2.4]
// POST /api/paymint/destroy
// body: { billId }

const PAYMINT_BASE_URL =
  process.env.PAYMINT_BASE_URL || "https://stg.paymint.co.kr/partner";
const PAYMINT_APIKEY = process.env.PAYMINT_APIKEY || "TEST-API-KEY-TALK";
const PAYMINT_MEMBER = process.env.PAYMINT_MEMBER || "TEST-MEMBER-FOR-API";
const PAYMINT_MERCHANT =
  process.env.PAYMINT_MERCHANT || "TEST-MERCHANT-FOR-API";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request) {
  try {
    const { billId } = await request.json();

    if (!billId) {
      return Response.json(
        { success: false, error: "billId가 필요합니다." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const paymintRes = await fetch(`${PAYMINT_BASE_URL}/if/bill/destroy`, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        apikey: PAYMINT_APIKEY,
        member: PAYMINT_MEMBER,
        merchant: PAYMINT_MERCHANT,
        bill_id: billId,
      }),
    });

    const data = await paymintRes.json();
    console.log("[paymint/destroy] bill_id:", billId, "response:", JSON.stringify(data));

    if (data.code !== "0000") {
      return Response.json(
        { success: false, error: data.msg || "청구서 파기 실패", code: data.code },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    return Response.json(
      { success: true, billId, code: data.code },
      { headers: CORS_HEADERS }
    );
  } catch (e) {
    return Response.json(
      { success: false, error: e.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
