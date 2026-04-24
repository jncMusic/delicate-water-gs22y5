// [결제선생 승인취소 - Paymint 2.3]
// POST /api/paymint/cancel
// body: { billId }

const PAYMINT_BASE_URL =
  process.env.PAYMINT_BASE_URL || "https://erp-api.payssam.kr";
const PAYMINT_APIKEY = process.env.PAYMINT_APIKEY || "54C5SW2AWEYB0MVJ";
const PAYMINT_MEMBER = process.env.PAYMINT_MEMBER || "jncmusic";
const PAYMINT_MERCHANT =
  process.env.PAYMINT_MERCHANT || "jncmusic";

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

    const paymintRes = await fetch(`${PAYMINT_BASE_URL}/if/bill/cancel`, {
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
    console.log("[paymint/cancel] bill_id:", billId, "response:", JSON.stringify(data));

    if (data.code !== "0000") {
      return Response.json(
        { success: false, error: data.msg || "승인취소 실패", code: data.code },
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
