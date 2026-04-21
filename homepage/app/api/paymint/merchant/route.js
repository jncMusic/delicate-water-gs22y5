// [결제선생 가맹점 정보 조회 - Paymint 2.8]
// GET /api/paymint/merchant
// 테스트 계정의 사업자번호(corp_um) 확인용

const PAYMINT_BASE_URL =
  process.env.PAYMINT_BASE_URL || "https://stg.paymint.co.kr/partner";
const PAYMINT_APIKEY = process.env.PAYMINT_APIKEY || "TEST-API-KEY-TALK";
const PAYMINT_MEMBER = process.env.PAYMINT_MEMBER || "TEST-MEMBER-FOR-API";
const PAYMINT_MERCHANT =
  process.env.PAYMINT_MERCHANT || "TEST-MERCHANT-FOR-API";

export async function GET() {
  try {
    const res = await fetch(`${PAYMINT_BASE_URL}/if/read/merchant`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: PAYMINT_APIKEY,
        member: PAYMINT_MEMBER,
        merchant: PAYMINT_MERCHANT,
      }),
    });

    const data = await res.json();
    console.log("[paymint/merchant]", JSON.stringify(data));
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
