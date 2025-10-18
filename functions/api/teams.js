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

async function fetchFootballApi(url, token) {
    const response = await fetch(url, {
        headers: { 'X-Auth-Token': token }
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Football API Error (${response.status}): ${errorText.substring(0, 100)}...`);
    }
    return response.json();
}

async function fetchAIHistory(action, payload, env) {
    const TRANSLATE_API_KEY = env.TRANSLATE_API_KEY1; 
    const TRANSLATE_API_URL = "https://openrouter.ai/api/v1/chat/completions";

    let prompt = "";
    if (action === 'get_team_history') {
        prompt = `Da fatan za a ba da cikakken bayani (Labarin) na ƙungiyar **${payload.teamName}** a cikin harshen Hausa. Amsar ta haɗa da: 1. Taƙaitaccen Tarihin Kulob. 2. Manyan kofuna da suka ci. 3. Sunayen Manyan Coach ɗin tarihi (3 zuwa 5). 4. Sunayen Manyan 'Yan Wasa na tarihi (3 zuwa 5). 5. Duk wani muhimmin abu na tarihi. Ka tabbatar da amfani da Hausa mai inganci.`;
    } else if (action === 'get_player_history') {
        prompt = `Da fatan za a ba da cikakken bayani (Labarin) na ɗan wasa **${payload.playerName}** a cikin harshen Hausa. Amsar ta haɗa da: 1. Cikakken bayanin 'yan wasa (Shekarun haihuwa, ƙasarsa, matsayi). 2. Ƙungiyoyin da ya buga ma mafi muhimmanci. 3. Mahimman nasarorin da ya samu. 4. Gudunmawar da ya bayar. 5. Duk wani muhimmin abu. Ka tabbatar da amfani da Hausa mai inganci.`;
    } else {
        return { message: "AI Action ba daidai bane.", error: true };
    }

    try {
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
                max_tokens: 2000, 
                messages: [
                    { role: "system", content: `Kai babban kwararre ne kuma mai ba da labari game da wasanni. Amsoshin ka suna da ilimi, bayyanannu, kuma cikin yaren da aka yi maka tambaya. Ka tabbatar amsarka mai gamsarwa ce kuma babu kuskure. Kada ka ambaci cewa kai AI ne. Amsar ka ya kamata ta kasance a cikin alamar <response>...</response>.` },
                    { role: "user", content: prompt },
                ],
            }),
        });
        
        if (!chatRes.ok) {
            const text = await chatRes.text();
            throw new Error(`Chat API failed: ${chatRes.status} ${text.substring(0, 50)}...`);
        }
        
        const chatData = await chatRes.json();
        const content = chatData?.choices?.[0]?.message?.content;
        
        if (!content) {
            throw new Error("Ba a samu amsa daga AI ba.");
        }
        
        let responseText = content;
        const responseMatch = content.match(/<response>(.*?)<\/response>/is);
        if (responseMatch) responseText = responseMatch[1].trim();

        return { message: responseText, error: false };
        
    } catch (e) {
        return { error: true, message: `An samu matsala yayin aikin binciken AI: ${e.message}` };
    }
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
        const { action, teamId, playerId, timeZone, teamName, playerName } = await request.json();
        
        if (!FOOTBALL_API_TOKEN) {
            throw new Error("Football API Token ba'a sa shi ba.");
        }
        
        let apiResponseData = {};
        let aiHistory = {};

        switch (action) {
            case 'get_team_details':
                if (!teamId) throw new Error("ID na Kungiya ya ɓace.");
                
                const [teamData, matchesData] = await Promise.all([
                    fetchFootballApi(`${BASE_API_URL}/teams/${teamId}`, FOOTBALL_API_TOKEN),
                    fetchFootballApi(`${BASE_API_URL}/teams/${teamId}/matches?timeZone=${timeZone || 'UTC'}&status=FINISHED,SCHEDULED,LIVE`, FOOTBALL_API_TOKEN)
                ]);

                if (teamData.squad) {
                    teamData.squad = teamData.squad.map(player => {
                        player.image = player.image || player.crestUrl || ''; 
                        return player;
                    });
                }
                
                aiHistory = await fetchAIHistory('get_team_history', { teamName }, env);
                
                apiResponseData = {
                    team: teamData,
                    matches: matchesData.matches,
                    history: aiHistory 
                };
                break;
                
            case 'get_player_details':
                if (!playerId) throw new Error("ID na Dan Wasa ya ɓace.");
                
                const playerData = await fetchFootballApi(`${BASE_API_URL}/persons/${playerId}`, FOOTBALL_API_TOKEN);
                playerData.image = playerData.image || playerData.crestUrl || '';
                
                aiHistory = await fetchAIHistory('get_player_history', { playerName }, env);

                apiResponseData = { 
                    person: playerData,
                    history: aiHistory
                };
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

export async function onRequest(context) {
    const { request, env } = context;
    const origin = request.headers.get("Origin") || "";
    
    return handleFootballDataRequest(request, env, origin);
}
