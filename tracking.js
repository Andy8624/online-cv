// ============================================================
//  SILENT TRACKING — CV Duong Lap Khang
//  Placeholders below are injected by GitHub Actions (sed).
//  FIREBASE_CONFIG secret must be a single-line JSON string,
//  e.g.: {"apiKey":"…","authDomain":"…","projectId":"…",
//         "storageBucket":"…","messagingSenderId":"…","appId":"…"}
//  Do NOT use the pipe character "|" inside secret values.
// ============================================================
(async () => {
  try {
    // ====== CONFIG — filled at build time by CI/CD ======
    const firebaseConfig = JSON.parse('__FIREBASE_CONFIG__');
    const BOT_TOKEN = "__BOT_TOKEN__";
    const CHAT_ID   = "__CHAT_ID__";
    // =====================================================

    const [
      { initializeApp },
      { getFirestore, doc, getDoc, setDoc, updateDoc, increment },
      fpModule
    ] = await Promise.all([
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"),
      import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"),
      import("https://openfpcdn.io/fingerprintjs/v4")
    ]);

    const app = initializeApp(firebaseConfig);
    const db  = getFirestore(app);

    const fpAgent = await fpModule.load();
    const [fpResult, ipRes] = await Promise.all([
      fpAgent.get(),
      fetch("https://api.ipify.org?format=json").then(r => r.json())
    ]);

    const visitorId = fpResult.visitorId;
    const ip        = ipRes.ip;
    const userAgent = navigator.userAgent;
    const now       = new Date().toISOString();

    const ref  = doc(db, "analytics", visitorId);
    const snap = await getDoc(ref);
    let visitCount = 1;

    if (snap.exists()) {
      await updateDoc(ref, {
        ip,
        userAgent,
        timestamp:  now,
        visitCount: increment(1)
      });
      visitCount = (snap.data().visitCount || 0) + 1;
    } else {
      await setDoc(ref, {
        ip,
        userAgent,
        timestamp:  now,
        visitCount: 1
      });
    }

    await sendToTelegram(ip, visitorId, visitCount, userAgent);

    async function sendToTelegram(ip, visitorId, visitCount, ua) {
      if (!BOT_TOKEN || !CHAT_ID) return;
      const device  = /Mobile|Android|iPhone/i.test(ua) ? "📱 Mobile" : "💻 Desktop";
      const browser = extractBrowser(ua);
      const text = [
        "🚨 *Có người vừa xem CV!*",
        "",
        `${device} — ${browser}`,
        `🌐 IP: \`${ip}\``,
        `🔑 Visitor: \`${visitorId}\``,
        `👁️ Lần truy cập thứ: *${visitCount}*`,
        `🕐 ${now}`
      ].join("\n");

      await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: "Markdown" })
      });
    }

    function extractBrowser(ua) {
      if (/Edg\//i.test(ua))                              return "Edge";
      if (/OPR|Opera/i.test(ua))                          return "Opera";
      if (/Chrome/i.test(ua) && !/Edg/i.test(ua))        return "Chrome";
      if (/Safari/i.test(ua) && !/Chrome/i.test(ua))     return "Safari";
      if (/Firefox/i.test(ua))                            return "Firefox";
      return "Unknown";
    }

  } catch (_) { /* Silent fail — tracking error must not break the page */ }
})();
