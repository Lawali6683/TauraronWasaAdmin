function withCORSHeaders(response, origin) {
    const ALLOWED_ORIGINS = [
        "https://tauraronwasa.pages.dev",
        "https://leadwaypeace.pages.dev",
        "http://localhost:8080",
    ];
    if (ALLOWED_ORIGINS.includes(origin)) {
        response.headers.set("Access-Control-Allow-Origin", origin);
    } 
    response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type, x-api-key");
    response.headers.set("Access-Control-Max-Age", "86400");
    return response;
}

async function handleFootballDataRequest(request, env, origin) {
    const BASE_API_URL = "https://api.football-data.org/v4";
    const FOOTBALL_API_TOKEN = env.FOOTBALL_DATA_API_KEY6; 

    if (request.method === "OPTIONS") {
        return withCORSHeaders(new Response(null, { status: 204 }), origin);
    }
    
    const WORKER_API_KEY = request.headers.get("x-api-key");
    const EXPECTED_KEY = "@haruna66"; 
    if (WORKER_API_KEY !== EXPECTED_KEY) {
        const response = new Response(
            JSON.stringify({ error: true, message: "Invalid API Key" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            }
        );
        return withCORSHeaders(response, origin);
    }
    
    const contentType = request.headers.get("content-type") || "";
    if (request.method !== "POST" || !contentType.includes("application/json")) {
        const response = new Response(
            JSON.stringify({ error: true, message: "Invalid Request Method or Content-Type" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            }
        );
        return withCORSHeaders(response, origin);
    }

    try {
        const { action, teamId, playerId, timeZone } = await request.json();
        
        if (!FOOTBALL_API_TOKEN) {
            throw new Error("Football API Token ba'a sa shi ba.");
        }

        if (action.includes('history')) {
             throw new Error("Action da aka bayar ba daidai bane. Yi amfani da hanyar /ai don neman tarihi.");
        }
        
        let apiResponseData = {};
        switch (action) {
            case 'get_team_details':
                if (!teamId) throw new Error("ID na Kungiya ya ɓace.");
                
                const teamUrl = `${BASE_API_URL}/teams/${teamId}`;
                const teamRes = await fetch(teamUrl, {
                    headers: { 'X-Auth-Token': FOOTBALL_API_TOKEN }
                });
                if (!teamRes.ok) throw new Error(`Kuskure wajen ɗauko Bayanin Kungiya: ${teamRes.statusText}`);
                const teamData = await teamRes.json();
                
                const matchesUrl = `${BASE_API_URL}/teams/${teamId}/matches?timeZone=${timeZone || 'UTC'}&status=FINISHED,SCHEDULED,LIVE`; 
                const matchesRes = await fetch(matchesUrl, {
                    headers: { 'X-Auth-Token': FOOTBALL_API_TOKEN }
                });
                if (!matchesRes.ok) throw new Error(`Kuskure wajen ɗauko Wasanni: ${matchesRes.statusText}`);
                const matchesData = await matchesRes.json();
                
                if (teamData.squad) {
                    teamData.squad = teamData.squad.map(player => {
                        player.image = player.image || player.crestUrl || ''; 
                        return player;
                    });
                }

                apiResponseData = {
                    team: teamData,
                    matches: matchesData.matches 
                };
                break;
                
            case 'get_player_details':
                if (!playerId) throw new Error("ID na Dan Wasa ya ɓace.");
                
                const playerUrl = `${BASE_API_URL}/persons/${playerId}`;
                const playerRes = await fetch(playerUrl, {
                    headers: { 'X-Auth-Token': FOOTBALL_API_TOKEN }
                });
                if (!playerRes.ok) throw new Error(`Kuskure wajen ɗauko Bayanin Dan Wasa: ${playerRes.statusText}`);
                const playerData = await playerRes.json();
                
                playerData.image = playerData.image || playerData.crestUrl || '';

                apiResponseData = { person: playerData };
                break;
                
            default:
                throw new Error("Action da aka bayar ba daidai bane.");
        }
        
        const successResponse = new Response(
            JSON.stringify({ error: false, data: apiResponseData }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            }
        );
        return withCORSHeaders(successResponse, origin);
    } catch (error) {
        const errorResponse = new Response(
            JSON.stringify({ error: true, message: error.message }), {
                status: 500,
                headers: { "Content-Type": "application/json" },
            }
        );
        return withCORSHeaders(errorResponse, origin);
    }
}

async function handleAIRequest(request, env, origin) {
    
    if (request.method === "OPTIONS") {
        return withCORSHeaders(new Response(null, { status: 204 }), origin);
    }
    
    const TRANSLATE_API_KEY = env.TRANSLATE_API_KEY1; 
    const TRANSLATE_API_URL = "https://openrouter.ai/api/v1/chat/completions";
    const EXPECTED_KEY = "@haruna66"; 

    const WORKER_API_KEY = request.headers.get("x-api-key");
    if (WORKER_API_KEY !== EXPECTED_KEY) {
        const response = new Response(
            JSON.stringify({ error: true, message: "Maɓallin API bai daidaita ba." }),
            { status: 401, headers: { "Content-Type": "application/json" } }
        );
        return withCORSHeaders(response, origin);
    }
    
    const contentType = request.headers.get("content-type") || "";
    if (request.method !== "POST" || !contentType.includes("application/json")) {
        const response = new Response(
            JSON.stringify({ error: true, message: "Hanyar buƙata ko nau'in abun ciki bai daidaita ba." }),
            { status: 400, headers: { "Content-Type": "application/json" } }
        );
        return withCORSHeaders(response, origin);
    }

    try {
        const requestBody = await request.json();
        const { query } = requestBody;
        
        if (!query) {
            throw new Error("Tambaya ba ta nan.");
        }

        const chatRes = await fetch(TRANSLATE_API_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${TRANSLATE_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://tauraronwasa.pages.dev",
                "X-Title": "TauraronWasa",
            },
            body: JSON.stringify({
                model: "openai/gpt-4o-mini", 
                max_tokens: 400, // AN KAYYADE YADDA AKA BUƘATA
                messages: [
                    { role: "system", content: `Kai babban kwararre ne kuma mai ba da labari game da wasanni. Amsoshin ka suna da ilimi, bayyanannu, kuma cikin yaren da aka yi maka tambaya (Hausa ko Turanci). Ka tabbatar amsarka mai gamsarwa ce kuma babu kuskure. Kada ka ambaci cewa kai AI ne. Amsar ka ya kamata ta kasance a cikin alamar <response>...</response>.` },
                    { role: "user", content: query },
                ],
            }),
        });
        
        if (!chatRes.ok) {
            const text = await chatRes.text();
            throw new Error(`Chat API failed with status ${chatRes.status}: ${text}`);
        }
        
        const chatData = await chatRes.json();
        const content = chatData?.choices?.[0]?.message?.content;
        
        if (!content) {
            throw new Error("Ba a samu amsa daga AI ba.");
        }
        
        let responseText = content;
        const responseMatch = content.match(/<response>(.*?)<\/response>/is);
        if (responseMatch) responseText = responseMatch[1].trim();

        const finalResponse = new Response(
            JSON.stringify({ message: responseText, error: false }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );
        return withCORSHeaders(finalResponse, origin);
        
    } catch (e) {
        console.error("Kuskuren aiki na AI:", e.message);
        const errorResponse = new Response(
            JSON.stringify({ error: true, message: `An samu matsala yayin aikin binciken AI: ${e.message}` }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
        return withCORSHeaders(errorResponse, origin);
    }
}

export async function onRequest(context) {
    const { request, env } = context;
    const origin = request.headers.get("Origin") || "";
    const url = new URL(request.url);
    
    if (url.pathname.endsWith('/ai')) {
        return handleAIRequest(request, env, origin);
    } else {
        return handleFootballDataRequest(request, env, origin);
    }
}
