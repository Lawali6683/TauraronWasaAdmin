const ALLOWED_DOMAINS = [
    "https://tauraronwasaadmin.pages.dev",
    "http://localhost:8080"
];

const AUTH_KEY = "@haruna66";


async function fetchFixturesForDate(dateStr, env) {
    const apiUrl = `https://api.football-data.org/v4/matches?dateFrom=${dateStr}&dateTo=${dateStr}`;
    
    const response = await fetch(apiUrl, {
        headers: { "X-Auth-Token": env.FOOTBALL_DATA_API_KEY6 },
    });

    if (!response.ok) {
        const errorText = await response.text();
        
        throw new Error(`Football API Error for ${dateStr}: HTTP ${response.status}: ${errorText}`); 
    }

    const data = await response.json();
    return data.matches || []; 
}


async function fetchAndSaveAllFixtures(todayKey, env) {
    const datesToFetch = [];
    const today = new Date(todayKey);
    
    
    for (let i = -2; i <= 6; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        datesToFetch.push(date.toISOString().split("T")[0]);
    }

    // Tura dukkan requests tare
    const allPromises = datesToFetch.map(dateStr => 
        fetchFixturesForDate(dateStr, env).then(fixtures => ({ dateStr, fixtures }))
    );

    const results = await Promise.all(allPromises);

    const categorized = {};
    let totalFixtures = 0;

    results.forEach(item => {
        categorized[item.dateStr] = item.fixtures;
        totalFixtures += item.fixtures.length;
    });

    // ===== SAVE TO FIREBASE =====
    const fbUrl = `https://tauraronwasa-default-rtdb.firebaseio.com/fixtures.json?auth=${env.FIREBASE_SECRET}`;
    
    const fbRes = await fetch(fbUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixtures: categorized, lastUpdated: Date.now() }),
    });

    if (!fbRes.ok) {
        const fbErr = await fbRes.text();
        throw new Error(`Firebase Error: ${fbRes.status}: ${fbErr}`);
    }
    
    return {
        status: "success",
        total: totalFixtures,
        dateRange: `${datesToFetch[0]} → ${datesToFetch[datesToFetch.length - 1]}`,
    };
}


async function updateFixturesHandler(url, env) {
    const todayKey = url.searchParams.get('today');
    const isLiveUpdate = url.searchParams.get('type') === 'live';

    if (!todayKey) {
        throw new Error("Wajibi ne a turo kwanan wata (today) tare da request.");
    }
    
    if (isLiveUpdate) {
       
        return { status: "live_update_triggered", message: "Live update request received and processed." };
    } 
    
    
    return await fetchAndSaveAllFixtures(todayKey, env);
}



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
            const result = await updateFixturesHandler(url, env);
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
