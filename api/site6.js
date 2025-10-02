
const admin = require("firebase-admin");

// === ENVIRONMENT VARIABLES ===
const FIREBASE_DATABASE_URL = process.env.FIREBASE_DATABASE_URL;
const SERVICE_ACCOUNT = process.env.FIREBASE_DATABASE_SDK
  ? JSON.parse(process.env.FIREBASE_DATABASE_SDK)
  : null;
const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const REFRESH_INTERVAL_MINUTES = 1;

// === FIREBASE INIT ===
if (!SERVICE_ACCOUNT || !FIREBASE_DATABASE_URL) {
  console.error("❌ Missing Firebase credentials. Check Vercel Environment Variables.");
} else if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(SERVICE_ACCOUNT),
    databaseURL: FIREBASE_DATABASE_URL,
  });
}

const db = admin.apps.length ? admin.database() : null;

// === HELPERS ===
function toYMD(date) {
  return new Date(date).toISOString().split("T")[0];
}

async function logToFirebase(message, details = {}) {
  if (!db) {
    console.warn("⚠️ Firebase not initialized. Logging to console only:", message, details);
    return;
  }
  try {
    const logRef = db.ref("logs");
    await logRef.push({
      timestamp: new Date().toISOString(),
      message,
      ...details,
    });
    console.log("✅ Logged to Firebase:", message, details);
  } catch (err) {
    console.error("❌ Failed to log to Firebase:", err.message);
  }
}

// === FETCH FIXTURES ===
async function fetchFixturesFromApi(dateFrom, dateTo) {
  try {
    const response = await fetch(
      `https://api.football-data.org/v4/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`,
      {
        headers: { "X-Auth-Token": FOOTBALL_DATA_API_KEY },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ API failed: ${response.status} - ${errorText}`);
      await logToFirebase("Football API failed", {
        status: response.status,
        error: errorText,
      });
      return [];
    }

    const data = await response.json();
    console.log("✅ Fixtures fetched:", data.matches?.length || 0);
    return data.matches || [];
  } catch (error) {
    console.error("❌ Error fetching API:", error.message);
    await logToFirebase("Error fetching Football API", { error: error.message });
    return [];
  }
}

// === UPDATE DATA ===
async function runDataUpdate() {
  const now = Date.now();

  let lastUpdated = null;
  if (db) {
    const lastUpdateRef = db.ref("/lastUpdated");
    lastUpdated = (await lastUpdateRef.once("value")).val();
  }

  if (lastUpdated && now - lastUpdated < REFRESH_INTERVAL_MINUTES * 60 * 1000) {
    console.log("ℹ️ Data still fresh, skipping update.");
    await logToFirebase("Data still fresh, skipping.", { lastUpdated });
    return { status: "success", message: "Data still fresh." };
  }

  const start = new Date(now);
  const end = new Date(now);
  end.setDate(end.getDate() + 14);

  const fixtures = await fetchFixturesFromApi(toYMD(start), toYMD(end));

  if (fixtures.length === 0) {
    if (db) {
      const snapshot = await db.ref("/").once("value");
      const oldData = snapshot.val();
      if (oldData) {
        console.log("⚠️ No new fixtures. Using cached data.");
        await logToFirebase("No new fixtures. Using cached data.");
        return { status: "success", message: "Using cached data." };
      }
    }
    console.log("❌ No fixtures available at all.");
    await logToFirebase("No fixtures available at all.");
    return { status: "error", message: "No fixtures available." };
  }

  // Categorize fixtures by date
  const categorized = {};
  fixtures.forEach((f) => {
    const fixtureDate = toYMD(new Date(f.utcDate));
    if (!categorized[fixtureDate]) categorized[fixtureDate] = [];
    categorized[fixtureDate].push(f);
  });

  if (db) {
    const updates = { fixtures: categorized, lastUpdated: now };
    await db.ref("/").set(updates);
  }

  console.log(`✅ Firebase updated with ${fixtures.length} fixtures.`);
  await logToFirebase("Firebase updated with new fixtures.", {
    total: fixtures.length,
    days: Object.keys(categorized).length,
  });

  return {
    status: "success",
    message: "Data updated.",
    total: fixtures.length,
    days: Object.keys(categorized).length,
  };
}

// === VERCEL HANDLER ===
module.exports = async (req, res) => {
  try {
    const result = await runDataUpdate();
    res.status(200).json(result);
  } catch (error) {
    console.error("❌ Update failed:", error.message);
    await logToFirebase("Update failed", { error: error.message });
    res.status(500).json({ status: "error", message: error.message });
  }
};
