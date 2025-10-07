
const ALLOWED_ORIGINS = [
    "https://tauraronwasaadmin.pages.dev",
    "http://localhost:8080",
];


const REQUIRED_API_KEY = "@haruna66";


async function updateFixtures(env) {
    const now = Date.now();
    const start = new Date(now);
    // Kwanaki 2 da suka wuce
    start.setDate(start.getDate() - 2); 
    const end = new Date(now);
    // Kwanaki 7 masu zuwa
    end.setDate(end.getDate() + 7);
    
    const dateFrom = start.toISOString().split("T")[0];
    const dateTo = end.toISOString().split("T")[0];
    
   
    const apiUrl = `https://api.football-data.org/v4/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;
    
    // ===== FETCH FIXTURES =====
    const response = await fetch(apiUrl, {
        headers: { "X-Auth-Token": env.FOOTBALL_DATA_API_KEY6 },
    });
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Football API Error: HTTP ${response.status}: ${errorText} at ${apiUrl}`);
        throw new Error(`Football API Error: ${response.status}`);
    }
    const data = await response.json();
    const fixtures = data.matches || [];
    
    // ===== CATEGORIZE BY DATE =====
    const categorized = {};
    fixtures.forEach((f) => {
       
        const fixtureDate = new Date(f.utcDate).toISOString().split("T")[0]; 
        if (!categorized[fixtureDate]) categorized[fixtureDate] = [];
        categorized[fixtureDate].push(f);
    });
    
    // ===== SAVE TO FIREBASE =====
    const fbUrl = `https://tauraronwasa-default-rtdb.firebaseio.com/fixtures.json?auth=${env.FIREBASE_SECRET}`;
    const fbRes = await fetch(fbUrl, {
        method: "PUT", // PUT zai maye gurbin dukkan data
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixtures: categorized, lastUpdated: now }),
    });
    if (!fbRes.ok) {
        const fbErr = await fbRes.text();
        console.error(`Firebase Error: ${fbRes.status}: ${fbErr} at ${fbUrl}`);
        throw new Error(`Firebase Error: ${fbRes.status}`);
    }
    
    return {
        status: "success",
        totalMatches: fixtures.length,
        dateRange: `${dateFrom} -> ${dateTo}`,
        lastUpdated: new Date(now).toISOString()
    };
}


async function getMatchStatus(env, matchId) {
    const apiUrl = `https://api.football-data.org/v4/matches/${matchId}`;
    
    const response = await fetch(apiUrl, {
        headers: { "X-Auth-Token": env.FOOTBALL_DATA_API_KEY6 },
    });
    
    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Football API Status Error: HTTP ${response.status}: ${errorText} at ${apiUrl}`);
        throw new Error(`Football API Status Error: ${response.status}`);
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


export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);
        const path = url.pathname;
        
        
        const headers = { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*", 
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, x-api-key, Origin"
        };
        
       
        if (request.method === "OPTIONS") {
            return new Response(null, { status: 204, headers });
        }
        
        try {
          
            if (path === "/api/site6") {
               
                const origin = request.headers.get("Origin");
                const apiKey = request.headers.get("x-api-key");
                
                if (!ALLOWED_ORIGINS.includes(origin) && origin !== "https://tauraronwasaadmin.pages.dev") { 
                    return new Response(JSON.stringify({ error: true, message: "Origin is not allowed." }), { status: 403, headers });
                }
                
                if (apiKey !== REQUIRED_API_KEY) {
                    return new Response(JSON.stringify({ error: true, message: "Invalid API Key." }), { status: 401, headers });
                }

                
                const result = await updateFixtures(env);
                return new Response(JSON.stringify(result), { headers });
            }

            
            if (path.startsWith("/api/site6-status/")) {
                const parts = path.split("/");
                const matchId = parts[parts.length - 1]; 
                
                if (isNaN(parseInt(matchId))) {
                    return new Response(JSON.stringify({ error: true, message: "Invalid match ID." }), { status: 400, headers });
                }
                
                const statusData = await getMatchStatus(env, matchId);
                return new Response(JSON.stringify(statusData), { headers });
            }

           
            return new Response(JSON.stringify({ message: "Welcome to site6 API. Use /api/site6 or /api/site6-status/:matchId" }), { headers });

        } catch (error) {
            console.error(error.stack);
            return new Response(JSON.stringify({ error: true, message: error.message || "Internal Server Error" }), { 
                status: 500, 
                headers 
            });
        }
    }
};
