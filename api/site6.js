const admin = require("firebase-admin");
const fetch = require("node-fetch"); // idan Node < 18
const API_KEY = process.env.API_KEY;
const FIREBASE_DATABASE_URL = process.env.FIREBASE_DATABASE_URL;

const SERVICE_ACCOUNT = process.env.FIREBASE_DATABASE_SDK
  ? JSON.parse(process.env.FIREBASE_DATABASE_SDK)
  : null;

if (!SERVICE_ACCOUNT || !FIREBASE_DATABASE_URL) {
  console.error("ERROR: Missing Firebase credentials.");
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(SERVICE_ACCOUNT),
    databaseURL: FIREBASE_DATABASE_URL,
  });
}

const db = admin.database();
const REFRESH_INTERVAL_MINUTES = 30;

const ALLOWED_ORIGINS = [
  "https://tauraronwasa.pages.dev",
  "https://leadwaypeace.pages.dev",
  "http://localhost:8080",
];

// ============== Utility ==============
function toYMD(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ============== Fetch Fixtures ==============
async function fetchFixturesFromApi(from, to) {
  const url = `https://v3.football.api-sports.io/fixtures?from=${from}&to=${to}`;
  const headers = { "x-apisports-key": API_KEY };

  try {
    const resp = await fetch(url, { headers });
    if (!resp.ok) {
      const text = await resp.text();
      console.error(`[API Error] ${resp.status} - ${text}`);
      return [];
    }

    const payload = await resp.json();
    if (!payload.response || payload.response.length === 0) {
      console.error(`[API Empty] ${JSON.stringify(payload.parameters)}`);
      return [];
    }

    console.log(`[API Success] Fixtures: ${payload.response.length}`);
    return payload.response;
  } catch (err) {
    console.error(`[API Error] ${err.message}`);
    return [];
  }
}

// ============== Update Function ==============
async function runDataUpdate() {
  const now = Date.now();
  const lastUpdateRef = db.ref("/lastUpdated");
  const lastUpdated = (await lastUpdateRef.once("value")).val();

  if (lastUpdated && now - lastUpdated < REFRESH_INTERVAL_MINUTES * 60 * 1000) {
    return { status: "success", message: "Data is still fresh." };
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const end = new Date(now);
  end.setDate(end.getDate() + 7);

  const fixtures = await fetchFixturesFromApi(toYMD(yesterday), toYMD(end));

  if (fixtures.length === 0) {
    const snapshot = await db.ref("/").once("value");
    const oldData = snapshot.val();
    if (oldData) {
      console.warn("No new fixtures. Returning cached data.");
      return { status: "success", message: "Using cached data.", data: oldData };
    }
    return { status: "error", message: "No fixtures available at all." };
  }

  const categorized = {
    yesterday: [],
    today: [],
    tomorrow: [],
    next1: [],
    next2: [],
    next3: [],
    next4: [],
    next5: [],
    next6: [],
  };

  const todayYMD = toYMD(new Date());
  const yesterdayYMD = toYMD(new Date(Date.now() - 86400000));

  fixtures.forEach((f) => {
    const fixtureDate = new Date(f.fixture.date);
    const dYMD = toYMD(fixtureDate);

    if (dYMD === todayYMD) categorized.today.push(f);
    else if (dYMD === yesterdayYMD) categorized.yesterday.push(f);
    else {
      const daysDiff = Math.ceil(
        (fixtureDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      if (daysDiff === 1) categorized.tomorrow.push(f);
      if (daysDiff === 2) categorized.next1.push(f);
      if (daysDiff === 3) categorized.next2.push(f);
      if (daysDiff === 4) categorized.next3.push(f);
      if (daysDiff === 5) categorized.next4.push(f);
      if (daysDiff === 6) categorized.next5.push(f);
      if (daysDiff === 7) categorized.next6.push(f);
    }
  });

  const updates = { ...categorized, lastUpdated: now };

  await db.ref("/").update(updates);
  console.log("Firebase updated with new fixtures.");
  return { status: "success", message: "Data updated.", counts: updates };
}

// ============== Main Handler ==============
module.exports = async (req, res) => {
  try {
    const origin = req.headers.origin;
    if (!ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", "null");
      return res.status(403).json({ error: "Forbidden origin" });
    }
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");

    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.headers["x-api-key"] !== "@haruna66") {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const result = await runDataUpdate();
    return res.status(200).json(result);
  } catch (error) {
    console.error(`[Server Error] ${error.message}`);
    return res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
};
