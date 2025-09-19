const admin = require("firebase-admin");
const API_SPORTS_KEY = "05f61aa60db010cadf163c033ec253c0";

// Tabbatar an saita environment variables a Vercel
const FIREBASE_DATABASE_URL = process.env.FIREBASE_DATABASE_URL;
const SERVICE_ACCOUNT = process.env.FIREBASE_DATABASE_SDK ?
    JSON.parse(process.env.FIREBASE_DATABASE_SDK) :
    null;

// Tabbatar an haɗa da Firebase
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

// Helper function don tsara kwanan wata
function toYMD(date) {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

// Helper function don neman data daga API
async function fetchFixturesFromApi(from, to) {
    const url = `${API_BASE_URL}?from=${from}&to=${to}`;
    const headers = {
        'x-apisports-key': API_SPORTS_KEY,
    };

    console.log(`Starting API fetch from ${from} to ${to}...`);
    const resp = await fetch(url, { headers });
    
    if (!resp.ok) {
        const text = await resp.text();
        console.error(`API-Sports fetch failed. Status: ${resp.status}, Response: ${text}`);
        throw new Error(`API-Sports error ${resp.status}: ${text}`);
    }
    const payload = await resp.json();
    console.log(`Successfully fetched ${payload.results} fixtures.`);
    return payload.response || [];
}

// Rarraba data
function categorizeFixtures(fixtures) {
    const now = new Date();
    const result = {
        yesterday: [],
        today: [],
        tomorrow: [],
        next1: [],
        next2: [],
        liveMatches: []
    };

    fixtures.sort((a, b) => new Date(a.fixture.date) - new Date(b.fixture.date));

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const today = now;
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    const next1 = new Date(now);
    next1.setDate(now.getDate() + 2);
    const next2 = new Date(now);
    next2.setDate(now.getDate() + 3);

    const yesterdayYMD = toYMD(yesterday);
    const todayYMD = toYMD(today);
    const tomorrowYMD = toYMD(tomorrow);
    const next1YMD = toYMD(next1);
    const next2YMD = toYMD(next2);

    for (const f of fixtures) {
        const fixtureDate = new Date(f.fixture.date);
        const dYMD = toYMD(fixtureDate);

        const status = f.fixture?.status?.short;
        if (status === 'LIVE' || status === 'IN_PLAY' || status === 'HT' || status === 'ET') {
            result.liveMatches.push(f);
        }

        if (dYMD === yesterdayYMD) {
            result.yesterday.push(f);
        } else if (dYMD === todayYMD) {
            result.today.push(f);
        } else if (dYMD === tomorrowYMD) {
            result.tomorrow.push(f);
        } else if (dYMD === next1YMD) {
            result.next1.push(f);
        } else if (dYMD === next2YMD) {
            result.next2.push(f);
        }
    }
    return result;
}

// Aikin da zai dinga gudana a kan Cron Job
async function runDataUpdate() {
    try {
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const end = new Date(now);
        end.setDate(now.getDate() + 3);

        const from = toYMD(yesterday);
        const to = toYMD(end);

        const fixtures = await fetchFixturesFromApi(from, to);
        const categorized = categorizeFixtures(fixtures);

        const updates = {};
        updates['/liveMatches'] = categorized.liveMatches;
        updates['/yesterday'] = categorized.yesterday;
        updates['/today'] = categorized.today;
        updates['/tomorrow'] = categorized.tomorrow;
        updates['/next1'] = categorized.next1;
        updates['/next2'] = categorized.next2;

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

    } catch (e) {
        console.error("Error during data update:", e.message);
        return { status: "error", message: `Server error: ${e.message}` };
    }
}

// Main handler for Vercel
module.exports = async (req, res) => {
    // Tabbatar da CORS
    res.setHeader("Access-Control-Allow-Origin", "https://tauraronwasa.pages.dev");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");
    
    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }
    
    // Tabbatar da API key
    const authHeader = req.headers["x-api-key"];
    if (!authHeader || authHeader !== API_SPORTS_KEY) {
        console.error("Unauthorized request. Invalid API Key.");
        return res.status(401).json({ error: "Unauthorized request" });
    }

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    console.log("Starting manual data update request...");
    const result = await runDataUpdate();
    return res.status(200).json(result);
};
