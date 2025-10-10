// /functions/api/site6.js

const ALLOWED_ORIGINS = [
    "https://tauraronwasa.pages.dev",
    "http://localhost:8080",
];
const REQUIRED_API_KEY = "@haruna66";

// Ba a buƙatar COMPETITION_CODES kuma.

// Fixed Keys din da za mu yi amfani da su a Firebase (day_0: Jiya -> day_5: Kwana 4 gaba)
const DAY_KEYS = [
    'day_0', 'day_1', 'day_2', 'day_3', 'day_4', 'day_5' 
];

// An cire delay saboda yanzu muna kiran API sau daya kacal

/**
 * Aiki don tattara wasanni daga Leagues daban-daban kuma adana su a Firebase.
 * Yanzu an yi amfani da babban API guda daya mai neman dukkan wasanni tsakanin kwanaki.
 */
async function updateFixtures(env) {
    const now = Date.now();
    const today = new Date();
    
    // Nemi kwanaki 6 (Jiya, Yau, Gobe, Jibi, Gata, Citta)
    const datesToFetch = [];
    const dateStrings = [];
    
    // Fara daga i = -1 (Jiya) zuwa i = 4 (Kwana 4 gaba). Total 6 days.
    for (let i = -1; i <= 4; i++) { 
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        // Fitar da ISO Date string (YYYY-MM-DD)
        const dateStr = date.toISOString().split("T")[0];
        datesToFetch.push({ date: date, dateStr: dateStr });
        dateStrings.push(dateStr);
    }
    
    const dateFrom = dateStrings[0]; // Jiya
    const dateTo = dateStrings[dateStrings.length - 1]; // Kwana 4 Gaba
    
    let allFixtures = [];

    // KIRAN API GUDA DAYA MAI NEMO DUKKAN WASANNI A KWANA 6
    const apiUrl = `https://api.football-data.org/v4/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;
    
    try {
        console.log(`Fetching fixtures from ${dateFrom} to ${dateTo}...`);
        const response = await fetch(apiUrl, {
            headers: { "X-Auth-Token": env.FOOTBALL_DATA_API_KEY6 },
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Football API Error: HTTP ${response.status}: ${errorText}`);
        }
        
        const data = await response.json();
        allFixtures = data.matches || [];
        
    } catch (error) {
        console.error(`Fatal API Fetch Error: ${error.message}`);
        throw new Error(`Kuskure wajen karɓar matches daga API: ${error.message}`);
    }
    
    // Rarraba wasanni ta hanyar Fixed Day Keys (day_0, day_1, day_2, etc.)
    const categorized = {};
    let totalFixtures = 0;
    
    datesToFetch.forEach(({ dateStr }, index) => {
        const key = DAY_KEYS[index];
        const matchesForDate = allFixtures
            .filter(f => new Date(f.utcDate).toISOString().split("T")[0] === dateStr)
            // Cire wasannin da aka dage ko aka soke
            .filter(f => !["POSTPONED", "CANCELLED", "SUSPENDED"].includes(f.status));

        // Adana date na ranar da kuma matches
        categorized[key] = { 
            date: dateStr, 
            matches: matchesForDate 
        };
        totalFixtures += matchesForDate.length;
    });
    
    // ===== SAVE TO FIREBASE (PUT zai goge tsohon data duka) =====
    const fbUrl = `https://tauraronwasa-default-rtdb.firebaseio.com/fixtures.json?auth=${env.FIREBASE_SECRET}`;
    
    const dataToSave = {
        fixtures: categorized, // Yana da Fixed Keys
        lastUpdated: now,
    };

    const payload = JSON.stringify(dataToSave);
    
    const fbRes = await fetch(fbUrl, {
        method: "PUT", // PUT zai goge tsohon data duka ya sabunta da sabon tsarin
        headers: { "Content-Type": "application/json" },
        body: payload,
    });
    
    if (!fbRes.ok) {
        const fbErr = await fbRes.text();
        throw new Error(`Firebase Error: ${fbRes.status}: ${fbErr}`);
    }
    
    return {
        status: "success",
        totalMatchesSaved: totalFixtures,
        dateRange: `${dateFrom} -> ${dateTo}`,
    };
}

/**
 * Aiki don neman cikakken bayani (status) na wasa daya ta ID (Wannan yana nan yadda yake)
 */
async function getMatchStatus(env, matchId) {
    const apiUrl = `https://api.football-data.org/v4/matches/${matchId}`;
    
    const response = await fetch(apiUrl, {
        headers: { "X-Auth-Token": env.FOOTBALL_DATA_API_KEY6 },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Football API Status Error: HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const match = data.match;
    if (!match) {
        throw new Error("Match not found or data is incomplete.");
    }
    
    return {
        id: match.id,
        status: match.status,
        score: match.score,
        utcDate: match.utcDate,
    };
}

export async function onRequest({ request, env }) {
    const url = new URL(request.url);
    
    const headers = { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, x-api-key, Origin",
    };

    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers });
    }
    
    try {
        const pathSegments = url.pathname.split('/').filter(p => p.length > 0);
        
        // 1. Kashi na Neman Match Status
        if (pathSegments.length >= 3 && pathSegments[pathSegments.length - 2] === 'site6') {
            const matchId = pathSegments[pathSegments.length - 1]; 
            
            if (!isNaN(parseInt(matchId))) {
                const statusData = await getMatchStatus(env, matchId);
                return new Response(JSON.stringify(statusData), { headers });
            }
        }

        // 2. Kashi na Cekawar Izini
        const apiKey = url.searchParams.get('key');
        if (apiKey !== REQUIRED_API_KEY) {
            return new Response(JSON.stringify({ error: true, message: "Invalid API Key" }), { status: 401, headers });
        }
        
        // 3. Kashi na Update Fixtures 
        const result = await updateFixtures(env);
        return new Response(JSON.stringify(result), { headers });
        
    } catch (error) {
        console.error(error.stack);
        return new Response(JSON.stringify({ error: true, message: error.message || "Internal Server Error" }), { 
            status: 500, 
            headers 
        });
    }
}
