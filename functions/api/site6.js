const ALLOWED_ORIGINS = [
    "https://tauraronwasa.pages.dev",
    "http://localhost:8080"
];
const REQUIRED_API_KEY = "@haruna66";
const DAY_KEYS = ['day_0', 'day_1', 'day_2', 'day_3', 'day_4', 'day_5'];

async function updateFixtures(env) {
    const now = Date.now();
    const today = new Date();
    const datesToFetch = [];
    const dateStrings = [];
    for (let i = -1; i <= 4; i++) { 
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        const dateStr = date.toISOString().split("T")[0];
        datesToFetch.push({ date, dateStr });
        dateStrings.push(dateStr);
    }
    const dateFrom = dateStrings[0];
    const dateTo = dateStrings[dateStrings.length - 1];
    let allFixtures = [];
    const apiUrl = `https://api.football-data.org/v4/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;
    const response = await fetch(apiUrl, {
        headers: { "X-Auth-Token": env.FOOTBALL_DATA_API_KEY6 }
    });
    if (!response.ok) throw new Error(`Football API Error: HTTP ${response.status}`);
    const data = await response.json();
    allFixtures = data.matches || [];
    const categorized = {};
    let totalFixtures = 0;
    datesToFetch.forEach(({ dateStr }, index) => {
        const key = DAY_KEYS[index];
        const matchesForDate = allFixtures
            .filter(f => new Date(f.utcDate).toISOString().split("T")[0] === dateStr)
            .filter(f => !["POSTPONED", "CANCELLED", "SUSPENDED"].includes(f.status));
        categorized[key] = { date: dateStr, matches: matchesForDate };
        totalFixtures += matchesForDate.length;
    });
    const fbUrl = `https://tauraronwasa-default-rtdb.firebaseio.com/fixtures.json?auth=${env.FIREBASE_SECRET}`;
    const dataToSave = { fixtures: categorized, lastUpdated: now };
    const fbRes = await fetch(fbUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSave)
    });
    if (!fbRes.ok) throw new Error(`Firebase Error: ${fbRes.status}`);
    return { status: "success", totalMatchesSaved: totalFixtures, dateRange: `${dateFrom} -> ${dateTo}` };
}

async function getMatchStatus(env, matchId) {
    const apiUrl = `https://api.football-data.org/v4/matches/${matchId}`;
    const response = await fetch(apiUrl, {
        headers: { "X-Auth-Token": env.FOOTBALL_DATA_API_KEY6 }
    });
    if (!response.ok) throw new Error(`Football API Status Error: HTTP ${response.status}`);
    const data = await response.json();
    const match = data.match;
    if (!match) throw new Error("Match not found or data incomplete");
    return { id: match.id, status: match.status, score: match.score, utcDate: match.utcDate };
}

export async function onRequest({ request, env }) {
    const url = new URL(request.url);
    const headers = { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-api-key, Origin"
    };
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    try {
        const pathSegments = url.pathname.split('/').filter(p => p.length > 0);
        if (pathSegments.length >= 3 && pathSegments[pathSegments.length - 2] === 'site6') {
            const matchId = pathSegments[pathSegments.length - 1];
            if (!isNaN(parseInt(matchId))) {
                const statusData = await getMatchStatus(env, matchId);
                return new Response(JSON.stringify(statusData), { headers });
            }
        }
        const apiKey = url.searchParams.get('key');
        if (apiKey !== REQUIRED_API_KEY)
            return new Response(JSON.stringify({ error: true, message: "Invalid API Key" }), { status: 401, headers });
        const result = await updateFixtures(env);
        return new Response(JSON.stringify(result), { headers });
    } catch (error) {
        return new Response(JSON.stringify({ error: true, message: error.message || "Internal Server Error" }), { status: 500, headers });
    }
}
