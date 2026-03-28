// [알리고 SMS 발송 API Route]
// POST /api/send-sms
// body: { receiver: "010-xxxx-xxxx", msg: "내용", title?: "제목" }
// Vercel → Cafe24 서버(등록된 IP) → Aligo 중계 방식

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Cafe24 서버 주소 (알리고 IP 등록된 서버)
const RELAY_URL = process.env.SMS_RELAY_URL || "http://1.234.88.73/api/send-sms";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request) {
  try {
    const body = await request.json();

    if (!body.receiver || !body.msg) {
      return Response.json({ success: false, error: "receiver와 msg는 필수입니다." }, { status: 400, headers: CORS_HEADERS });
    }

    // 서버→서버 요청이므로 CORS/Mixed Content 없음
    const relayRes = await fetch(RELAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const result = await relayRes.json();
    return Response.json(result, { status: relayRes.status, headers: CORS_HEADERS });
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: CORS_HEADERS });
  }
}
