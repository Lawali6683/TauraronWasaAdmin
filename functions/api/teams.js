
function withCORSHeaders(response, origin) {
    const ALLOWED_ORIGINS = [
        "https://tauraronwasaadmin.pages.dev",
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

export async function onRequest(context) {
    const { request, env } = context;
    const origin = request.headers.get("Origin");
    const WORKER_API_KEY = request.headers.get("x-api-key");
    const EXPECTED_KEY = "@haruna66"; // Wannan shine key din da ka bayar
    const BASE_API_URL = "https://api.football-data.org/v4";
    const FOOTBALL_API_TOKEN = env.FOOTBALL_API_TOKEN; // An ɗauka za'a sa TOKEN a Cloudflare Environment Variables

    // CORS Preflight Request (OPTIONS)
    if (request.method === "OPTIONS") {
        return withCORSHeaders(new Response(null, { status: 204 }), origin);
    }

    // Tabbatar da API Key
    if (WORKER_API_KEY !== EXPECTED_KEY) {
        const response = new Response(
            JSON.stringify({ error: true, message: "Invalid API Key" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            }
        );
        return withCORSHeaders(response, origin);
    }

    // Tabbatar da Method da Content-Type
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
            throw new Error("Football API Token ba'a sa shi ba (A wajen Env Vars)");
        }

        let apiResponseData = {};

        switch (action) {
            case 'get_team_details':
                if (!teamId) throw new Error("ID na Kungiya ya ɓace.");
                
                // 1. Kira API don Bayanin Kungiya
                const teamUrl = `${BASE_API_URL}/teams/${teamId}`;
                const teamRes = await fetch(teamUrl, {
                    headers: { 'X-Auth-Token': FOOTBALL_API_TOKEN }
                });
                if (!teamRes.ok) throw new Error(`Kuskure wajen ɗauko Bayanin Kungiya: ${teamRes.statusText}`);
                const teamData = await teamRes.json();

                // 2. Kira API don Wasannin Kungiya
                // Na ƙara 'timeZone' a matsayin parameter a Request
                const matchesUrl = `${BASE_API_URL}/teams/${teamId}/matches?timeZone=${timeZone || 'UTC'}&status=FINISHED,SCHEDULED,LIVE`; 
                const matchesRes = await fetch(matchesUrl, {
                    headers: { 'X-Auth-Token': FOOTBALL_API_TOKEN }
                });
                if (!matchesRes.ok) throw new Error(`Kuskure wajen ɗauko Wasanni: ${matchesRes.statusText}`);
                const matchesData = await matchesRes.json();
                
                // Hada Bayanan
                apiResponseData = {
                    team: teamData,
                    matches: matchesData.matches // Dawo da wasannin kawai
                };
                break;
                
            case 'get_player_details':
                if (!playerId) throw new Error("ID na Dan Wasa ya ɓace.");
                
                // Kira API don Bayanin Dan Wasa
                const playerUrl = `${BASE_API_URL}/persons/${playerId}`;
                const playerRes = await fetch(playerUrl, {
                    headers: { 'X-Auth-Token': FOOTBALL_API_TOKEN }
                });
                if (!playerRes.ok) throw new Error(`Kuskure wajen ɗauko Bayanin Dan Wasa: ${playerRes.statusText}`);
                const playerData = await playerRes.json();
                
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
