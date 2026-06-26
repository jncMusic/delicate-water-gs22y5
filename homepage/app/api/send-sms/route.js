// [알리고 SMS 발송 API Route]
// POST /api/send-sms
// body: { receiver: "010-xxxx-xxxx", msg: "내용", title?: "제목" }
//
// Vercel → Cafe24 릴레이 서버(1.234.88.73) → 알리고
// 알리고 IP 보안에 1.234.88.73 등록 필요

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const RELAY_URL = "http://1.234.88.73/sms-relay.php";
const RELAY_TOKEN = "JNC_SMS_RELAY_2026";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request) {
  try {
    const { receiver, msg, title } = await request.json();

    if (!receiver || !msg) {
      return Response.json(
        { success: false, error: "receiver와 msg는 필수입니다." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const relayRes = await fetch(RELAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Relay-Token": RELAY_TOKEN,
      },
      body: JSON.stringify({ receiver, msg, title }),
    });

    const result = await relayRes.json();

    // 알리고 result_code: 1 = 성공
    const success = String(result.result_code) === "1";
    return Response.json(
      { success, ...result },
      { status: success ? 200 : 400, headers: CORS_HEADERS }
    );
  } catch (e) {
    return Response.json(
      { success: false, error: e.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
