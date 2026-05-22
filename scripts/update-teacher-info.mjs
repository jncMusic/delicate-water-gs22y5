// 강사 주민번호/계좌번호 Firestore 업데이트 스크립트
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDc6bGpzvxNALaxvrhZxSMxuHAvqQJozSE",
  authDomain: "jnc-music-dashboard.firebaseapp.com",
  projectId: "jnc-music-dashboard",
  storageBucket: "jnc-music-dashboard.firebasestorage.app",
  messagingSenderId: "228282757928",
  appId: "1:228282757928:web:6fae515d207d8a61e0961d",
};

const APP_ID = "jnc-music-v2";

// 입력 데이터: { name, residentId, bankName, bankAccount }
const TEACHER_DATA = [
  { name: "태유민",  residentId: "010425-3058618", bankName: "국민", bankAccount: "937702-01-136343" },
  { name: "조국화",  residentId: "900109-2156319", bankName: "국민", bankAccount: "726902-00-006511" },
  { name: "이상현",  residentId: "930520-1034410", bankName: "신한", bankAccount: "110-355-213102" },
  { name: "민숙현",  residentId: "840127-2093812", bankName: "국민", bankAccount: "994402-01-135750" },
  { name: "김소형",  residentId: "830112-2162610", bankName: "신한", bankAccount: "110-095-780533" },
  { name: "남선오",  residentId: "030930-3012011", bankName: "카카오", bankAccount: "3333-212113556" },
  { name: "이윤석",  residentId: "921215-1121221", bankName: "우리", bankAccount: "1002-349-640313" },
  { name: "천가희",  residentId: "040109-4177313", bankName: "국민", bankAccount: "82840-100009938" },
  { name: "문세영",  residentId: "980803-2927417", bankName: "우리", bankAccount: "1002-943-621868" },
  { name: "권시문",  residentId: "931207-1784020", bankName: "신한", bankAccount: "110-477-250997" },
  { name: "최지영",  residentId: "930912-2054413", bankName: "국민", bankAccount: "833402-04-104397" },
  { name: "공성윤",  residentId: "950616-1065611", bankName: "신한", bankAccount: "110-489-580752" },
  { name: "김여빈",  residentId: "930307-2861421", bankName: "국민", bankAccount: "455402-01-409985" },
  { name: "한수정",  residentId: "",              bankName: "하나", bankAccount: "3489105-6380507" },
  { name: "김주원",  residentId: "",              bankName: "국민", bankAccount: "16702-04782185" },
  { name: "김맑음",  residentId: "",              bankName: "신한", bankAccount: "110-251-281558" },
  { name: "이연재",  residentId: "",              bankName: "국민", bankAccount: "743201-04192939" },
];

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

async function run() {
  await signInAnonymously(auth);

  const teachersRef = collection(db, "artifacts", APP_ID, "public", "data", "teachers");
  const snap = await getDocs(teachersRef);

  let updated = 0, notFound = [];

  for (const entry of TEACHER_DATA) {
    const match = snap.docs.find((d) => d.data().name === entry.name);
    if (!match) {
      notFound.push(entry.name);
      continue;
    }
    await updateDoc(doc(db, "artifacts", APP_ID, "public", "data", "teachers", match.id), {
      residentId: entry.residentId,
      bankName: entry.bankName,
      bankAccount: entry.bankAccount,
    });
    console.log(`✅ ${entry.name} 업데이트 완료`);
    updated++;
  }

  console.log(`\n총 ${updated}명 업데이트 완료.`);
  if (notFound.length) console.log(`⚠️  강사 미발견: ${notFound.join(", ")}`);
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
