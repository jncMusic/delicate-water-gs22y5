// [결제선생 청구서 상태 조회 - Paymint 2.5]
// POST /api/paymint/read
// body: { billId }
// appr_state: F=결제완료, W=미결제, C=취소, D=파기

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

    const paymintRes = await fetch(`${PAYMINT_BASE_URL}/if/bill/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json", charset: "UTF-8" },
      body: JSON.stringify({
        apikey: PAYMINT_APIKEY,
        member: PAYMINT_MEMBER,
        merchant: PAYMINT_MERCHANT,
        bill_id: billId,
      }),
    });

    const data = await paymintRes.json();

    if (data.code !== "0000") {
      return Response.json(
        { success: false, error: data.msg, code: data.code },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // appr_state: F=결제완료, W=미결제, C=취소, D=파기
    return Response.json(
      {
        success: true,
        billId,
        state: data.appr_state,
        price: data.appr_price,
        approvedAt: data.appr_dt,
        payType: data.appr_pay_type,
        code: data.code,
      },
      { headers: CORS_HEADERS }
    );
  } catch (e) {
    return Response.json(
      { success: false, error: e.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
