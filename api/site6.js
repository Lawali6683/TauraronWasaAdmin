const admin = require("firebase-admin");

// ENV VARIABLES
const FIREBASE_DATABASE_URL = process.env.FIREBASE_DATABASE_URL;
const SERVICE_ACCOUNT = process.env.FIREBASE_DATABASE_SDK
  ? JSON.parse(process.env.FIREBASE_DATABASE_SDK)
  : null;
const FOOTBALL_DATA_API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const REFRESH_INTERVAL_MINUTES = 1;

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

function toYMD(date) {
  return new Date(date).toISOString().split("T")[0];
}

async function logToFirebase(message, details = {}) {
  const logRef = db.ref("logs");
  await logRef.push({
    timestamp: new Date().toISOString(),
    message,
    ...details,
  });
  console.log("LOG:", message, details);
}

async function fetchFixturesFromApi(dateFrom, dateTo) {
  try {
    await logToFirebase("Fetching fixtures from API...", { dateFrom, dateTo });

    if (!FOOTBALL_DATA_API_KEY) {
      await logToFirebase("No API Key found!", {});
      return [];
    }

    const response = await fetch(
      `https://api.football-data.org/v4/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`,
      {
        headers: {
          "X-Auth-Token": FOOTBALL_DATA_API_KEY,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API failed: ${response.status} - ${errorText}`);
      await logToFirebase("Football API failed", {
        status: response.status,
        error: errorText,
      });
      return [];
    }

    const data = await response.json();
    await logToFirebase("Fixtures fetched successfully.", {
      total: data.matches?.length || 0,
    });
    return data.matches || [];
  } catch (error) {
    console.error("Error fetching API:", error);
    await logToFirebase("Error fetching Football API", { error: error.message });
    return [];
  }
}

async function runDataUpdate() {
  await logToFirebase("Starting data update process...");

  try {
    const now = Date.now();
    const lastUpdateRef = db.ref("/lastUpdated");
    const lastUpdated = (await lastUpdateRef.once("value")).val();

    if (lastUpdated && now - lastUpdated < REFRESH_INTERVAL_MINUTES * 60 * 1000) {
      await logToFirebase("Data still fresh, skipping.", { lastUpdated });
      return { status: "success", message: "Data still fresh." };
    }

    // Range: yau -> 14 days gaba
    const start = new Date(now);
    const end = new Date(now);
    end.setDate(end.getDate() + 14);

    const fixtures = await fetchFixturesFromApi(toYMD(start), toYMD(end));

    if (fixtures.length === 0) {
      const snapshot = await db.ref("/").once("value");
      const oldData = snapshot.val();
      if (oldData) {
        await logToFirebase("No new fixtures. Using cached data.");
        return { status: "success", message: "Using cached data." };
      }
      await logToFirebase("No fixtures available at all.");
      return { status: "error", message: "No fixtures available." };
    }

    // Rarrabe su zuwa kowace rana da aka samu
    const categorized = {};
    fixtures.forEach((f) => {
      const fixtureDate = toYMD(new Date(f.utcDate));
      if (!categorized[fixtureDate]) categorized[fixtureDate] = [];
      categorized[fixtureDate].push(f);
    });

    const updates = { fixtures: categorized, lastUpdated: now };
    await db.ref("/").set(updates);
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
  } catch (error) {
    console.error("Update failed:", error);
    await logToFirebase("Update failed", { error: error.message });
    return { status: "error", message: error.message };
  }
}

// Vercel handler
module.exports = async (req, res) => {
  try {
    const result = await runDataUpdate();
    res.status(200).json(result);
  } catch (error) {
    console.error("Handler failed:", error);
    await logToFirebase("Handler failed", { error: error.message });
    res.status(500).json({ status: "error", message: error.message });
  }
};
