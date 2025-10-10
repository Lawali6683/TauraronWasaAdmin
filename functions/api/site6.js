// /functions/api/site6.js

const ALLOWED_ORIGINS = [
    "https://tauraronwasa.pages.dev",
    "http://localhost:8080",
];
const REQUIRED_API_KEY = "@haruna66";

// Jerin gasa (competitions) da kuke buƙata
const COMPETITION_CODES = [
    "WC", "PL", "BL1", "SA", "FL1", "PD", "DED", "PPL", "BSA", "CL", "ELC", "CDR", "FAC",
];

const API_DELAY_MS = 3000; // Jinkiri tsakanin kiran API don guje wa yawan requests

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Fixed Keys din da za mu yi amfani da su a Firebase (day_0: Shekaran Jiya -> day_8: Kwana 6 gaba)
const DAY_KEYS = [
    'day_0', 'day_1', 'day_2', 'day_3', 'day_4', 'day_5', 'day_6', 'day_7', 'day_8'
];

/**
 * Aiki don tattara wasanni daga Leagues daban-daban kuma adana su a Firebase.
 */
async function updateFixtures(env) {
    const now = Date.now();
    const today = new Date();
    
    // An yi gyara anan: Muna amfani da UTC date don kiyaye daidaito
    const datesToFetch = [];
    const dateStrings = [];
    
    for (let i = -2; i <= 6; i++) { 
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        // Fitar da ISO Date string (YYYY-MM-DD)
        const dateStr = date.toISOString().split("T")[0];
        datesToFetch.push({ date: date, dateStr: dateStr });
        dateStrings.push(dateStr);
    }
    
    const dateFrom = dateStrings[0];
    const dateTo = dateStrings[dateStrings.length - 1];
    
    let allFixtures = [];
    let apiFetchStatus = {}; // Don logging

    // Kira API League bayan League tare da jinkiri
    for (const competitionCode of COMPETITION_CODES) {
        // Football Data API yana amfani da UTC a bayan fage
        const apiUrl = `https://api.football-data.org/v4/competitions/${competitionCode}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;
        
        try {
            const response = await fetch(apiUrl, {
                headers: { "X-Auth-Token": env.FOOTBALL_DATA_API_KEY6 },
            });
            
            apiFetchStatus[competitionCode] = response.status;
            
            if (!response.ok) {
                // Tunda muna da jinkiri, zamu iya samun matsala.
                if (response.status !== 404 && response.status !== 400) {
                    console.error(`Error fetching ${competitionCode}: HTTP ${response.status}`);
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
        
        await delay(API_DELAY_MS); 
    }
    
    // Rarraba wasanni ta hanyar Fixed Day Keys (day_0, day_1, day_2, etc.)
    const categorized = {};
    let totalFixtures = 0;
    
    datesToFetch.forEach(({ dateStr }, index) => {
        const key = DAY_KEYS[index];
        const matchesForDate = allFixtures
            // An gyara anan: Muna amfani da ISO string wajen filter
            .filter(f => new Date(f.utcDate).toISOString().split("T")[0] === dateStr)
            // Cire wasannin da aka dage ko aka soke
            .filter(f => !["POSTPONED", "CANCELLED", "SUSPENDED"].includes(f.status));

        // Adana date na ranar da kuma matches
        categorized[key] = { 
            // Wannan dateStr shine yake bayyana ranar a Site Code
            date: dateStr, 
            matches: matchesForDate 
        };
        totalFixtures += matchesForDate.length;
    });
    
    // ===== SAVE TO FIREBASE (PUT zai goge tsohon data duka) =====
    const fbUrl = `https://tauraronwasa-default-rtdb.firebaseio.com/fixtures.json?auth=${env.FIREBASE_SECRET}`;
    
    // YANZU DATA ZA A AJIYE TANA KUNSHE DA FICTURES DA FIXED KEYS KAWAI
    const dataToSave = {
        fixtures: categorized, // Wannan yana da FIXED KEYS (day_0, day_1,...)
        lastUpdated: now,
        // Ana iya cire wannan don rage girman data: apiStatus: apiFetchStatus 
    };

    // A nan ne gyaran Rikicin Keys yake: 
    // Maimakon PUT kai tsaye ga babban root, zamu tabbatar mun saka shi a karkashin 'fixtures' key
    // A gaskiya, PUT a .json?auth=... a kan root yana nufin gogewa da sabuntawa.
    // Idan kuna ganin kwanakin ne a root, yana nufin cewa a baya an yi PUT ba tare da 'fixtures' wrapper ba.
    // Don tabbatar da cewa ba za ku sake samun Date Keys a root ba, za mu yi PUT kai tsaye zuwa /fixtures
    
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
        apiStatusSummary: apiFetchStatus,
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
