// [Paymint Hash 검증용 - 배포 확인 후 삭제]
// GET /api/paymint/hashtest
// 테스트 계정 corp_num(2208875476)으로 가능한 모든 공식 검증

import crypto from "crypto";

function sha256(s) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export async function GET() {
  const DOC_HASH = "a8213f399e45e854be91a1339e8c5deee2dd27c4cbb889343b538c316bb45fa6";
  const CORP = "2208875476";
  const SEQ = "100000001";      // 문서 예제 sequential 부분
  const PHONE = "01012347435";  // 문서 예제 phone
  const PRICE = "18234";        // 문서 예제 price

  const cases = [
    // 하이픈 포맷 (문서 예제 스타일)
    { label: "hyphen_no_phone",   input: `${CORP}-${SEQ}*${PRICE}` },
    { label: "hyphen_with_phone", input: `${CORP}-${SEQ}*${PHONE}*${PRICE}` },
    // 하이픈 없는 포맷 (현재 우리 방식)
    { label: "nohyphen_no_phone",   input: `${CORP}${SEQ}*${PRICE}` },
    { label: "nohyphen_with_phone", input: `${CORP}${SEQ}*${PHONE}*${PRICE}` },
    // 원래 문서 placeholder 그대로 (비교용)
    { label: "placeholder_no_phone",   input: `사업자번호-${SEQ}*${PRICE}` },
    { label: "placeholder_with_phone", input: `사업자번호-${SEQ}*${PHONE}*${PRICE}` },
  ];

  const results = cases.map(({ label, input }) => {
    const hash = sha256(input);
    return { label, input, hash, match: hash === DOC_HASH };
  });

  const found = results.find((r) => r.match);

  return Response.json({
    doc_hash: DOC_HASH,
    winner: found ? found.label : "none",
    results,
  });
}
