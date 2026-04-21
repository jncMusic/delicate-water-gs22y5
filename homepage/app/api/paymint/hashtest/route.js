// [Paymint Hash 검증용 - 배포 확인 후 삭제]
// GET /api/paymint/hashtest
// 공식 예제값으로 해시 검증: bill_id="사업자번호-100000001", price="18234"
// 예상 결과: a8213f399e45e854be91a1339e8c5deee2dd27c4cbb889343b538c316bb45fa6

import crypto from "crypto";

export async function GET() {
  const cases = [
    {
      label: "docs_example_no_phone",
      input: "사업자번호-100000001*18234",
    },
    {
      label: "docs_example_with_phone",
      input: "사업자번호-100000001*01012347435*18234",
    },
    {
      label: "numeric_only_no_phone",
      input: "00000000001234567890*18234",
    },
  ];

  const results = cases.map(({ label, input }) => ({
    label,
    input,
    hash: crypto.createHash("sha256").update(input).digest("hex"),
  }));

  const docHash = "a8213f399e45e854be91a1339e8c5deee2dd27c4cbb889343b538c316bb45fa6";

  return Response.json({
    expected_doc_hash: docHash,
    results,
    match: results.map((r) => ({ label: r.label, matches: r.hash === docHash })),
  });
}
