// /functions/api/site6.js

const ALLOWED_ORIGINS = [
    "https://tauraronwasa.pages.dev",
    "http://localhost:8080",
];
const REQUIRED_API_KEY = "@haruna66";

const COMPETITION_CODES = [
    "WC", "PL", "BL1", "SA", "FL1", "PD", "DED", "PPL", "BSA", "CL", "ELC", "CDR", "FAC",
];

const API_DELAY_MS = 3000;

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Aiki don tattara wasanni daga Leagues daban-daban kuma adana su a Firebase.
 */
async function updateFixtures(env) {
    const now = Date.now();
    const start = new Date(now);
    start.setDate(start.getDate() - 2); // Kwanaki 2 baya (Shekaran Jiya)
    const end = new Date(now);
    end.setDate(end.getDate() + 7); // Kwanaki 7 gaba
    
    const dateFrom = start.toISOString().split("T")[0];
    const dateTo = end.toISOString().split("T")[0];
    
    let allFixtures = [];
    
    // Kira API dayake gudanar League bayan League tare da jinkiri
    for (const competitionCode of COMPETITION_CODES) {
        const apiUrl = `https://api.football-data.org/v4/competitions/${competitionCode}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;
        
        try {
            const response = await fetch(apiUrl, {
                headers: { "X-Auth-Token": env.FOOTBALL_DATA_API_KEY6 },
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                if (response.status !== 404) {
                    console.error(`Error fetching ${competitionCode}: HTTP ${response.status}: ${errorText}`);
                }
            } else {
                const data = await response.json();
                const newMatches = data.matches || [];
                
                newMatches.forEach(match => {
                    if (!allFixtures.some(f => f.id === match.id)) {
                        allFixtures.push(match);
                    }
                });
            }
        } catch (error) {
            console.error(`Network Error for ${competitionCode}: ${error.message}`);
        }
        
        // Jinkiri na sakan 3
        await delay(API_DELAY_MS); 
    }
    
    // Rarraba wasanni ta ranar bugawa
    const categorized = {};
    allFixtures.forEach((f) => {
        const fixtureDate = new Date(f.utcDate).toISOString().split("T")[0]; 
        if (!categorized[fixtureDate]) categorized[fixtureDate] = [];
        categorized[fixtureDate].push(f);
    });
    
    // ===== SAVE TO FIREBASE =====
    const fbUrl = `https://tauraronwasa-default-rtdb.firebaseio.com/fixtures.json?auth=${env.FIREBASE_SECRET}`;
    
    const dataToSave = {
        fixtures: categorized, 
        lastUpdated: now
    };

    const fbRes = await fetch(fbUrl, {
        method: "PUT", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dataToSave),
    });
    
    if (!fbRes.ok) {
        const fbErr = await fbRes.text();
        throw new Error(`Firebase Error: ${fbRes.status}: ${fbErr}`);
    }
    
    return {
        status: "success",
        totalMatches: allFixtures.length,
        dateRange: `${dateFrom} -> ${dateTo}`,
    };
}

/**
 * Aiki don neman cikakken bayani (status) na wasa daya ta ID
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

        // 2. Kashi na Cekawar Izini (Authorization Check)
        const apiKey = url.searchParams.get('key');
        if (apiKey !== REQUIRED_API_KEY) {
            return new Response(JSON.stringify({ error: true, message: "Invalid API Key." }), { status: 401, headers });
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
