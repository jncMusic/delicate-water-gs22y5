// [알리고 SMS 발송 API Route]
// POST /api/send-sms
// body: { receiver: "010-xxxx-xxxx", msg: "내용", title?: "제목" }

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// 바이트 계산 (EUC-KR 기준: 한글 2바이트, 영문/숫자 1바이트)
const getByteLength = (str) => {
  let bytes = 0;
  for (const ch of str) {
    bytes += ch.charCodeAt(0) > 127 ? 2 : 1;
  }
  return bytes;
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request) {
  try {
    const { receiver, msg, title } = await request.json();

    if (!receiver || !msg) {
      return Response.json({ success: false, error: "receiver와 msg는 필수입니다." }, { status: 400, headers: CORS_HEADERS });
    }

    const byteLen = getByteLength(msg);
    // 90바이트 초과 시 LMS, 결제 안내는 항상 LMS
    const msgType = byteLen > 90 ? "LMS" : "SMS";

    const params = new URLSearchParams({
      key:      process.env.ALIGO_API_KEY,
      user_id:  process.env.ALIGO_USER_ID,
      sender:   process.env.ALIGO_SENDER,
      receiver: receiver.replace(/[^0-9]/g, ""),
      msg:      msg,
      msg_type: msgType,
    });

    if (msgType === "LMS") {
      params.append("title", title || "수업료 결제 안내");
    }

    const aligoRes = await fetch("https://apis.aligo.in/send/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    });

    const result = await aligoRes.json();

    // result_code >= 0 이면 성공 (음수일 때 실패)
    if (parseInt(result.result_code) >= 0) {
      return Response.json({ success: true, msg_id: result.msg_id }, { headers: CORS_HEADERS });
    } else {
      return Response.json({ success: false, error: result.message }, { status: 400, headers: CORS_HEADERS });
    }
  } catch (e) {
    return Response.json({ success: false, error: e.message }, { status: 500, headers: CORS_HEADERS });
  }
}
