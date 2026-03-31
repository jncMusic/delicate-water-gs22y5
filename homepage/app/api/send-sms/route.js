// [알리고 SMS 발송 API Route]
// POST /api/send-sms
// body: { receiver: "010-xxxx-xxxx", msg: "내용", title?: "제목" }
//
// 환경변수 (Vercel 프로젝트 Settings > Environment Variables):
//   ALIGO_API_KEY   — 알리고 API 키
//   ALIGO_USER_ID   — 알리고 계정 ID
//   ALIGO_SENDER    — 발신번호 (예: 0222655020)
//
// 알리고 관리자 > 계정 설정 > IP 보안 설정을 OFF로 설정해야 합니다.

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
    const { receiver, msg, title } = await request.json();

    if (!receiver || !msg) {
      return Response.json(
        { success: false, error: "receiver와 msg는 필수입니다." },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const apiKey    = process.env.ALIGO_API_KEY;
    const userId    = process.env.ALIGO_USER_ID;
    const sender    = process.env.ALIGO_SENDER;

    if (!apiKey || !userId || !sender) {
      return Response.json(
        { success: false, error: "알리고 환경변수 미설정 (ALIGO_API_KEY, ALIGO_USER_ID, ALIGO_SENDER)" },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const form = new URLSearchParams();
    form.append("key",      apiKey);
    form.append("user_id",  userId);
    form.append("sender",   sender);
    form.append("receiver", receiver);
    form.append("msg",      msg);
    if (title) form.append("title", title);

    const aligoRes = await fetch("https://apis.aligo.in/send/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });

    const result = await aligoRes.json();

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
