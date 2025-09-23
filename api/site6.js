const admin = require("firebase-admin");
const FIREBASE_DATABASE_URL = process.env.FIREBASE_DATABASE_URL;
const SERVICE_ACCOUNT = process.env.FIREBASE_DATABASE_SDK ? JSON.parse(process.env.FIREBASE_DATABASE_SDK) : null;
const FOOTBALL_DATA_API_KEY = "05f61aa60db010cadf163c033ec253c0";
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
  const d = new Date(date);
  return d.toISOString().split("T")[0];
}

async function logToFirebase(message, details = {}) {
  const logRef = db.ref("logs");
  await logRef.push({
    timestamp: new Date().toISOString(),
    message,
    ...details,
  });
}

async function fetchFixturesFromApi(dateFrom, dateTo) {
  try {
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
      console.error(`API request failed: ${response.status} - ${errorText}`);
      await logToFirebase("Football API request failed", {
        status: response.status,
        message: errorText,
      });
      return [];
    }

    const data = await response.json();
    return data.matches || [];
  } catch (error) {
    console.error("Error fetching data from Football API:", error);
    await logToFirebase("Error fetching data from Football API", {
      error: error.message,
    });
    return [];
  }
}

async function runDataUpdate() {
  const now = Date.now();
  const lastUpdateRef = db.ref("/lastUpdated");
  const lastUpdated = (await lastUpdateRef.once("value")).val();

  if (lastUpdated && now - lastUpdated < REFRESH_INTERVAL_MINUTES * 60 * 1000) {
    await logToFirebase("Data is still fresh, skipping update.", { lastUpdated });
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
      await logToFirebase("No new fixtures. Using cached data.");
      return { status: "success", message: "Using cached data." };
    }
    await logToFirebase("No fixtures available at all. Skipping update.");
    return { status: "error", message: "No fixtures available at all." };
  }

  const liveMatches = fixtures.filter(
    (f) => f.status === "IN_PLAY" || f.status === "PAUSED"
  );
  if (liveMatches.length === 0) {
    await logToFirebase("No live matches. Skipping full update to save resources.");
    return { status: "success", message: "No live matches. Using cached data." };
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
  const yesterdayYMD = toYMD(new Date(now - 86400000));

  fixtures.forEach((f) => {
    const fixtureDate = new Date(f.utcDate);
    const dYMD = toYMD(fixtureDate);
    const daysDiff = Math.ceil((fixtureDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

    if (dYMD === todayYMD) categorized.today.push(f);
    else if (dYMD === yesterdayYMD) categorized.yesterday.push(f);
    else if (daysDiff >= 1 && daysDiff < 2) categorized.tomorrow.push(f);
    else if (daysDiff >= 2 && daysDiff < 3) categorized.next1.push(f);
    else if (daysDiff >= 3 && daysDiff < 4) categorized.next2.push(f);
    else if (daysDiff >= 4 && daysDiff < 5) categorized.next3.push(f);
    else if (daysDiff >= 5 && daysDiff < 6) categorized.next4.push(f);
    else if (daysDiff >= 6 && daysDiff < 7) categorized.next5.push(f);
    else if (daysDiff >= 7 && daysDiff < 8) categorized.next6.push(f);
  });

  const updates = { ...categorized, lastUpdated: now };
  await db.ref("/").update(updates);
  await logToFirebase("Firebase updated with new fixtures.", {
    counts: {
      today: categorized.today.length,
      tomorrow: categorized.tomorrow.length,
      liveMatches: liveMatches.length,
    },
  });

  return { status: "success", message: "Data updated.", counts: updates };
}

module.exports = async (req, res) => {
  try {
    const result = await runDataUpdate();
    res.status(200).json(result);
  } catch (error) {
    console.error("Failed to run data update:", error);
    res.status(500).json({ status: "error", message: "Failed to run data update.", error: error.message });
  }
};
