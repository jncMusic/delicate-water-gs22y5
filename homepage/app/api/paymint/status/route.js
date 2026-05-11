// [Paymint 매장 개시상태 조회 - 2.6]
// GET /api/paymint/status
// 테스트 계정의 개시 상태 확인 (0000=개시, 1010=미신청/심사중, 1700=기가입)

const PAYMINT_BASE_URL =
  process.env.PAYMINT_BASE_URL || "https://erp-api.payssam.kr";
const PAYMINT_APIKEY = process.env.PAYMINT_APIKEY || "54C5SW2AWEYB0MVJ";
const PAYMINT_MEMBER = process.env.PAYMINT_MEMBER || "jncmusic";
const PAYMINT_MERCHANT =
  process.env.PAYMINT_MERCHANT || "jncmusic";
const CALLBACK_URL =
  process.env.PAYMINT_CALLBACK_URL || "https://jncmusic.kr/api/paymint/callback";

export async function GET() {
  try {
    const res = await fetch(`${PAYMINT_BASE_URL}/if/read/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apikey: PAYMINT_APIKEY,
        member: PAYMINT_MEMBER,
        merchant: PAYMINT_MERCHANT,
        callbackUrl: CALLBACK_URL,
      }),
    });
    const data = await res.json();
    console.log("[paymint/status]", JSON.stringify(data));
    // 0000=개시상태(bill/send 가능), 1010=미신청또는심사중, 1700=기가입된매장
    return Response.json(data);
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
