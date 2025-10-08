// Ajiye wannan code a: /functions/api/site6.js

const ALLOWED_DOMAINS = [
    "https://tauraronwasaadmin.pages.dev",
    "http://localhost:8080"
];

const AUTH_KEY = "@haruna66";

/**
 * Aiki don neman data daga Football-Data API da adana su a Firebase
 */
async function updateFixtures(env) {
    const now = Date.now();
    const start = new Date(now);
    start.setDate(start.getDate() - 2); // Kwanaki 2 da suka wuce
    const end = new Date(now);
    end.setDate(end.getDate() + 7); // Kwanaki 7 masu zuwa
    
    const dateFrom = start.toISOString().split("T")[0];
    const dateTo = end.toISOString().split("T")[0];
    
    const apiUrl = `https://api.football-data.org/v4/matches?dateFrom=${dateFrom}&dateTo=${dateTo}&status=FINISHED,SCHEDULED,IN_PLAY,PAUSED,SUSPENDED,POSTPONED,TIMED,CANCELLED`;
    
    const response = await fetch(apiUrl, {
        headers: { "X-Auth-Token": env.FOOTBALL_DATA_API_KEY6 },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Football API Error: HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const fixtures = data.matches || [];

    const categorized = {};
    fixtures.forEach((f) => {
        const fixtureDate = new Date(f.utcDate).toISOString().split("T")[0]; 
        if (!categorized[fixtureDate]) categorized[fixtureDate] = [];
        categorized[fixtureDate].push(f);
    });

    // **GYARA MAI MUHIMMANCI:** Ajiye data a ƙarƙashin '/fixtures'
    const fbUrl = `https://tauraronwasa-default-rtdb.firebaseio.com/fixtures.json?auth=${env.FIREBASE_SECRET}`;
    
    // Tabbatar an yi JSON.stringify({ fixtures: categorized, lastUpdated: now }) 
    // Yadda code na site zai karanta { fixtures: { 'YYYY-MM-DD': [...] }, lastUpdated: time }
    const fbRes = await fetch(fbUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixtures: categorized, lastUpdated: now }),
    });

    if (!fbRes.ok) {
        const fbErr = await fbRes.text();
        throw new Error(`Firebase Error: ${fbRes.status}: ${fbErr}`);
    }
    
    return {
        status: "success",
        total: fixtures.length,
        dateRange: `${dateFrom} → ${dateTo}`,
        lastUpdated: new Date().toISOString()
    };
}

/**
 * Aiki don neman cikakken bayani (status) na wasa daya ta ID
 */
async function fetchMatchStatus(matchId, env) {
    const apiUrl = `https://api.football-data.org/v4/matches/${matchId}`;
    
    const response = await fetch(apiUrl, {
        headers: { "X-Auth-Token": env.FOOTBALL_DATA_API_KEY6 },
    });

    if (!response.ok) {
        throw new Error(`Kuskuren API na Status: HTTP ${response.status}`);
    }

    const data = await response.json();
    return data.match || {}; 
}

// Babban Export don Cloudflare Pages Function Handler
export async function onRequest({ request, env }) {
    const url = new URL(request.url);
    const requestOrigin = request.headers.get('Origin');
    const isAllowedOrigin = ALLOWED_DOMAINS.includes(requestOrigin);
    
    const headers = {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": isAllowedOrigin ? requestOrigin : '*', 
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers });
    }
    
    const key = url.searchParams.get('key');
    if (key !== AUTH_KEY) {
        return new Response(JSON.stringify({ error: true, message: "Ba a ba da izini ba (Invalid Key)" }), {
            status: 403, headers
        });
    }
    
    const path = url.pathname;
    
    // Hanyar karɓar Match Status (misali: /api/site6/status/123456)
    if (path.startsWith("/api/site6/status/")) {
        const matchId = path.substring(path.lastIndexOf('/') + 1); 
        
        if (!matchId || isNaN(matchId)) {
            return new Response(JSON.stringify({ error: true, message: "ID na Wasa bai dace ba." }), {
                status: 400, headers
            });
        }
        
        try {
            const matchData = await fetchMatchStatus(matchId, env);
            return new Response(JSON.stringify(matchData), { headers });
        } catch (error) {
            console.error(`Fetch Match Status Failed: ${error.message}`);
            return new Response(JSON.stringify({ error: true, message: error.message }), {
                status: 500, headers
            });
        }
    } 
    // Hanyar Babban Data (Update Fixtures)
    else if (path === "/api/site6" || path === "/site6") { 
        try {
            const result = await updateFixtures(env);
            return new Response(JSON.stringify(result), { headers });
        } catch (error) {
            console.error(`Update Fixtures Failed: ${error.message}`);
            return new Response(JSON.stringify({ error: true, message: error.message }), {
                status: 500, headers
            });
        }
    } else {
        return new Response(JSON.stringify({ error: true, message: "Babu wannan hanya (Endpoint) a nan." }), {
            status: 404, headers
        });
    }
};
