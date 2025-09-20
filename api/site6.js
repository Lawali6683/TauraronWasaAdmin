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

// Sabon tsarin log
async function logToFirebase(message) {
    try {
        const logsRef = db.ref('logs');
        await logsRef.push({
            timestamp: admin.database.ServerValue.TIMESTAMP,
            message: message
        });
    } catch (error) {
        console.error("Failed to write log to Firebase:", error);
    }
}

// Aikin goge tsoffin logs
async function clearLogs() {
    try {
        await db.ref('logs').remove();
        console.log("Old logs cleared successfully.");
    } catch (error) {
        console.error("Failed to clear old logs:", error);
    }
}

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
        const logMessage = `[API Fetch] Starting API fetch from ${from} to ${to}...`;
        console.log(logMessage);
        await logToFirebase(logMessage);

        const resp = await fetch(url, { headers });

        if (!resp.ok) {
            const text = await resp.text();
            const errorMessage = `[API Error] API-Sports fetch failed. Status: ${resp.status}, Response: ${text}`;
            console.error(errorMessage);
            await logToFirebase(errorMessage);
            return [];
        }

        const payload = await resp.json();
        const successMessage = `[API Success] Successfully fetched ${payload.results || 0} fixtures.`;
        console.log(successMessage);
        await logToFirebase(successMessage);
        return payload.response || [];

    } catch (error) {
        const errorMessage = `[API Error] Error during API fetch: ${error.message}`;
        console.error(errorMessage);
        await logToFirebase(errorMessage);
        return [];
    }
}

async function runDataUpdate() {
    // Fara da goge logs
    await clearLogs();

    const startMessage = "Starting data update process...";
    console.log(startMessage);
    await logToFirebase(startMessage);

    const lastUpdateRef = db.ref('/lastUpdated');
    const lastUpdateSnapshot = await lastUpdateRef.once('value');
    const lastUpdated = lastUpdateSnapshot.val();
    const now = Date.now();

    if (lastUpdated && (now - lastUpdated) < REFRESH_INTERVAL_MINUTES * 60 * 1000) {
        const freshDataMessage = "Data is still fresh. Skipping update.";
        console.log(freshDataMessage);
        await logToFirebase(freshDataMessage);
        return { status: "success", message: "Data is up to date." };
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const end = new Date(now);
    // Neman wasanni na kwanaki 7 masu zuwa
    end.setDate(end.getDate() + 7);

    const from = toYMD(yesterday);
    const to = toYMD(end);

    const fixtures = await fetchFixturesFromApi(from, to);

    // Kuskure: idan ba a samu data daga API ba
    if (fixtures.length === 0) {
        const noFixturesMessage = "[Error] API returned no fixtures.";
        console.error(noFixturesMessage);
        await logToFirebase(noFixturesMessage);
        return { status: "error", message: "matsala daga api football", details: "API returned no fixtures. Check API key or if any matches are scheduled." };
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
        next6: []
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
            if (daysDiff === 4) categorized.next3.push(f);
            if (daysDiff === 5) categorized.next4.push(f);
            if (daysDiff === 6) categorized.next5.push(f);
            if (daysDiff === 7) categorized.next6.push(f);
        }
    });

    const updates = {};
    updates['/yesterday'] = categorized.yesterday;
    updates['/today'] = categorized.today;
    updates['/tomorrow'] = categorized.tomorrow;
    updates['/next1'] = categorized.next1;
    updates['/next2'] = categorized.next2;
    updates['/next3'] = categorized.next3;
    updates['/next4'] = categorized.next4;
    updates['/next5'] = categorized.next5;
    updates['/next6'] = categorized.next6;
    updates['/lastUpdated'] = now;

    try {
        await db.ref('/').update(updates);
        const successMessage = "Firebase data updated successfully.";
        console.log(successMessage);
        await logToFirebase(successMessage);
        return {
            status: "success",
            message: "Data updated successfully.",
            counts: {
                yesterday: categorized.yesterday.length,
                today: categorized.today.length,
                tomorrow: categorized.tomorrow.length,
                next1: categorized.next1.length,
                next2: categorized.next2.length,
                next3: categorized.next3.length,
                next4: categorized.next4.length,
                next5: categorized.next5.length,
                next6: categorized.next6.length
            }
        };
    } catch (error) {
        const firebaseErrorMessage = `[Firebase Error] Error updating Firebase data: ${error.message}`;
        console.error(firebaseErrorMessage);
        await logToFirebase(firebaseErrorMessage);
        return { status: "error", message: "matsala daga firebace", details: error.message };
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
            const unauthorizedMessage = "Unauthorized request. Invalid API Key.";
            console.error(unauthorizedMessage);
            await logToFirebase(unauthorizedMessage);
            return res.status(401).json({ error: "Unauthorized request" });
        }

        if (req.method !== "POST") {
            const methodNotAllowedMessage = "Method not allowed";
            console.error(methodNotAllowedMessage);
            await logToFirebase(methodNotAllowedMessage);
            return res.status(405).json({ error: methodNotAllowedMessage });
        }

        const result = await runDataUpdate();
        return res.status(200).json(result);

    } catch (error) {
        const serverErrorMessage = `[Server Error] Server error: ${error.message}`;
        console.error(serverErrorMessage);
        await logToFirebase(serverErrorMessage);
        return res.status(500).json({ error: "Internal server error", details: error.message });
    }
};
