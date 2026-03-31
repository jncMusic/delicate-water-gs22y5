// Vercel Serverless Function - jncmusic.vercel.app/api/send-sms
// CRA 앱과 같은 origin → CORS 불필요

const RELAY_URL = "http://1.234.88.73/sms-relay.php";
const RELAY_TOKEN = "JNC_SMS_RELAY_2026";

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "POST only" });
  }

  const { receiver, msg, title } = req.body || {};

  if (!receiver || !msg) {
    return res.status(400).json({ success: false, error: "receiver와 msg는 필수입니다." });
  }

  try {
    const response = await fetch(RELAY_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Relay-Token": RELAY_TOKEN,
      },
      body: JSON.stringify({ receiver, msg, title }),
    });

    const result = await response.json();
    const success = String(result.result_code) === "1";
    return res.status(success ? 200 : 400).json({ success, ...result });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
};
