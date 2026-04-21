// [결제선생 승인동기화 콜백 - Paymint 2.2]
// POST /api/paymint/callback
// Paymint에서 결제 승인 후 이 URL로 결과를 전송
// appr_state: F=결제완료, W=미결제, C=취소, D=파기

export async function POST(request) {
  try {
    const data = await request.json();

    // Paymint가 기대하는 응답: { code: "0000", msg: "성공하였습니다." }
    // 향후: 결제 완료 시 Firestore 기록 업데이트 가능
    console.log("[Paymint callback]", JSON.stringify({
      bill_id: data.bill_id,
      appr_state: data.appr_state,
      appr_price: data.appr_price,
      appr_dt: data.appr_dt,
    }));

    return Response.json({ code: "0000", msg: "성공하였습니다." });
  } catch (e) {
    return Response.json({ code: "9999", msg: e.message });
  }
}
