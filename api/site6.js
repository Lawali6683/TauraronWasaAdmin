const admin = require("firebase-admin");
const API_SPORTS_KEY = process.env.API_KEY;

const FIREBASE_DATABASE_URL = process.env.FIREBASE_DATABASE_URL;

const SERVICE_ACCOUNT = process.env.FIREBASE_DATABASE_SDK ?
    JSON.parse(process.env.FIREBASE_DATABASE_SDK) :
    null;

if (!SERVICE_ACCOUNT || !FIREBASE_DATABASE_URL) {
    console.error("ERROR: Missing Firebase credentials. Please check your Vercel environment variables.");
    process.exit(1);
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(SERVICE_ACCOUNT),
        databaseURL: FIREBASE_DATABASE_URL,
    });
}
const db = admin.database();
const API_BASE_URL = 'https://v3.football.api-sports.io/fixtures';

const REFRESH_INTERVAL_MINUTES = 30;

const ALLOWED_ORIGINS = [
    "https://tauraronwasa.pages.dev",
    "https://leadwaypeace.pages.dev",
    "http://localhost:8080",
];

function toYMD(date) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

async function fetchFixturesFromApi(from, to) {
    const url = `${API_BASE_URL}?from=${from}&to=${to}`;
    const headers = {
        'x-apisports-key': API_SPORTS_KEY,
    };
    try {
        console.log(`Starting API fetch from ${from} to ${to}...`);
        const resp = await fetch(url, { headers });

        if (!resp.ok) {
            const text = await resp.text();
            console.error(`API-Sports fetch failed. Status: ${resp.status}, Response: ${text}`);
            return [];
        }

        const payload = await resp.json();
        console.log(`Successfully fetched ${payload.results || 0} fixtures.`);
        return payload.response || [];
    } catch (error) {
        console.error("Error during API fetch:", error);
        return [];
    }
}

async function runDataUpdate() {
    console.log("Starting data update process...");

    const lastUpdateRef = db.ref('/lastUpdated');
    const lastUpdateSnapshot = await lastUpdateRef.once('value');
    const lastUpdated = lastUpdateSnapshot.val();
    const now = Date.now();

    if (lastUpdated && (now - lastUpdated) < REFRESH_INTERVAL_MINUTES * 60 * 1000) {
        console.log("Data is still fresh. Skipping update.");
        return { status: "success", message: "Data is up to date." };
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const end = new Date(now);
    end.setDate(end.getDate() + 3);

    const from = toYMD(yesterday);
    const to = toYMD(end);

    const fixtures = await fetchFixturesFromApi(from, to);

    if (fixtures.length === 0) {
        console.log("No new fixtures to update. Firebase data will not be changed.");
        return { status: "success", message: "No new data fetched from API." };
    }

    const categorized = {
        yesterday: [],
        today: [],
        tomorrow: [],
        next1: [],
        next2: [],
        liveMatches: []
    };

    const todayYMD = toYMD(new Date());
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayYMD = toYMD(yesterdayDate);

    fixtures.forEach(f => {
        const fixtureDate = new Date(f.fixture.date);
        const dYMD = toYMD(fixtureDate);

        if (dYMD === todayYMD) {
            categorized.today.push(f);
        } else if (dYMD === yesterdayYMD) {
            categorized.yesterday.push(f);
        } else {
            const oneDay = 1000 * 60 * 60 * 24;
            const today = new Date();
            const timeDiff = fixtureDate.getTime() - today.getTime();
            const daysDiff = Math.ceil(timeDiff / oneDay);

            if (daysDiff === 1) categorized.tomorrow.push(f);
            if (daysDiff === 2) categorized.next1.push(f);
            if (daysDiff === 3) categorized.next2.push(f);
        }
    });

    const updates = {};
    updates['/liveMatches'] = categorized.liveMatches;
    updates['/yesterday'] = categorized.yesterday;
    updates['/today'] = categorized.today;
    updates['/tomorrow'] = categorized.tomorrow;
    updates['/next1'] = categorized.next1;
    updates['/next2'] = categorized.next2;
    updates['/lastUpdated'] = now;

    try {
        await db.ref('/').update(updates);
        console.log("Firebase data updated successfully.");
        return {
            status: "success",
            message: "Data updated successfully.",
            counts: {
                yesterday: categorized.yesterday.length,
                today: categorized.today.length,
                tomorrow: categorized.tomorrow.length,
                next1: categorized.next1.length,
                next2: categorized.next2.length,
                live: categorized.liveMatches.length
            }
        };
    } catch (error) {
        console.error("Error updating Firebase data:", error);
        return { status: "error", message: "Failed to update Firebase.", details: error.message };
    }
}

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

        if (req.method === "OPTIONS") {
            return res.status(204).end();
        }

        const authHeader = req.headers["x-api-key"];
        if (!authHeader || authHeader !== "@haruna66") {
            console.error("Unauthorized request. Invalid API Key.");
            return res.status(401).json({ error: "Unauthorized request" });
        }

        if (req.method !== "POST") {
            return res.status(405).json({ error: "Method not allowed" });
        }

        const result = await runDataUpdate();
        return res.status(200).json(result);

    } catch (error) {
        console.error("Server error:", error);
        return res.status(500).json({ error: "Internal server error", details: error.message });
    }
};
