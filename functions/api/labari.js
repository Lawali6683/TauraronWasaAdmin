const ALLOWED_ORIGINS = [
    "https://tauraronwasa.pages.dev",
    "http://localhost:8080",
];
const REQUIRED_API_KEY = "@haruna66";
const TRANSLATE_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const MAX_GPT_TOKENS = 350;

function withCORSHeaders(response, origin) {
    const headers = response.headers;
    headers.set("Access-Control-Allow-Origin", ALLOWED_ORIGINS.includes(origin) ? origin : "*");
    headers.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, x-api-key");
    headers.set("Access-Control-Max-Age", "86400");
    return new Response(response.body, { status: response.status, headers });
}

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
        throw new Error("Ba a sami bayanin wasan ba daga Football API.");
    }
    
    return {
        id: match.id,
        status: match.status,
        score: match.score,
        homeTeamName: match.homeTeam.name,
        awayTeamName: match.awayTeam.name,
        utcDate: match.utcDate,
        homeTeam: match.homeTeam,
        awayTeam: match.awayTeam,
        competition: match.competition,
    };
}

async function getGPTAnalysis(env, homeName, awayName) {
    const systemPrompt = `Kai babban kwararre ne kuma mai ba da labari game da wasanni. Amsoshin ka suna da ilimi, bayyanannu, kuma cikin yaren da aka yi maka tambaya (Hausa).
Dole ne ka bi waɗannan ƙa'idoji:

1. Yi amfani da binciken yanar gizo (Web Search) don nemo bayanan tarihi, yawan haduwa, nasarori, canjaras, da kuma fitattun yan wasa/moment a tsakanin waɗannan ƙungiyoyin.

2. Tsara amsar ka a cikin alamar <response>...</response> kawai.

3. Ka ba da labarin cikin yaren **Hausa** mai inganci, ciki har da kiran kungiyoyin da sunaye na Hausa da kwararru ke amfani da su.
4. Tsawon rubutun kada ya wuce ${MAX_GPT_TOKENS} tokens.`;
    
    const userQuery = `Ka ba ni cikakken nazari da labarin tarihi mai zafi tsakanin ƙungiyoyin **${homeName}** da **${awayName}**. Ka shiga cikin tarihi: yawan haduwa, sakamakon haduwa (nasara, tashi, canjaras), wani babban ɗan wasa ko mai zura kwallaye tsakaninsu, da kuma kowane wasa mai zafi da suka taɓa yi (misali: final ko gasa mai mahimmanci). Tsawon amsar ya kasance aƙalla sakin layi 4.`;
    try {
        const chatRes = await fetch(TRANSLATE_API_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${env.TRANSLATE_API_KEY1}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://tauraronwasa.pages.dev",
                "X-Title": "TauraronWasa",
            },
            body: JSON.stringify({
                model: "openai/gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userQuery },
                ],
                max_tokens: MAX_GPT_TOKENS,
            }),
        });

        if (!chatRes.ok) {
            const text = await chatRes.text();
            throw new Error(`Chat API failed: ${chatRes.status}.`);
        }
        
        const chatData = await chatRes.json();
        const content = chatData?.choices?.[0]?.message?.content;
        
        if (!content) {
            return { response_text: "Ba a samu labarin tarihi daga AI ba." };
        }
        
        const responseMatch = content.match(/<response>(.*?)<\/response>/is);
        const responseText = responseMatch ? responseMatch[1].trim() : content;
        
        return { response_text: responseText };
    } catch (e) {
        console.error("GPT Analysis Error:", e.message);
        return { response_text: `An kasa samun labarin tarihi saboda matsalar AI. (${e.message})` };
    }
}

export async function onRequest({ request, env }) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    if (request.method === "OPTIONS") {
        return withCORSHeaders(new Response(null, { status: 204 }), origin);
    }
    
    if (request.method !== "POST") {
        return withCORSHeaders(new Response(JSON.stringify({ error: true, message: "Hanyar bukata bata daidaita ba." }), { status: 405 }), origin);
    }
    
    const apiKey = request.headers.get("x-api-key");
    if (apiKey !== REQUIRED_API_KEY) {
        return withCORSHeaders(new Response(JSON.stringify({ error: true, message: "Invalid API Key." }), { status: 401 }), origin);
    }
    try {
        const { matchId, homeName, awayName } = await request.json();
        
        if (!matchId || !homeName || !awayName) {
            throw new Error("Ba a kammala bayanan wasan ba. (matchId, homeName, awayName)");
        }
        
        const [matchStatusResult, gptAnalysisResult] = await Promise.allSettled([
            getMatchStatus(env, matchId),
            getGPTAnalysis(env, homeName, awayName)
        ]);

        const finalResponse = {};

        // 1. Tabbatar da Match Status
        if (matchStatusResult.status === 'fulfilled') {
            finalResponse.matchStatus = matchStatusResult.value;
            finalResponse.matchStatusError = null;
        } else {
            // An samu kuskure a Football API. A ajiye bayanin kuskuren.
            finalResponse.matchStatus = null;
            finalResponse.matchStatusError = `Football Data Error: ${matchStatusResult.reason.message}`;
        }
        
        // 2. Tabbatar da GPT Analysis
        if (gptAnalysisResult.status === 'fulfilled') {
            finalResponse.gptAnalysis = gptAnalysisResult.value;
        } else {
            // An samu kuskure a GPT Analysis.
            finalResponse.gptAnalysis = { response_text: `An kasa samun nazari na AI. Kuskure: ${gptAnalysisResult.reason.message}` };
        }
        
        const response = new Response(JSON.stringify(finalResponse), { 
            status: 200, 
            headers: { "Content-Type": "application/json" }
        });
        
        return withCORSHeaders(response, origin);
        
    } catch (error) {
        console.error("Fatal Error:", error.message);
        const response = new Response(JSON.stringify({ error: true, message: error.message }), { 
            status: 500, 
            headers: { "Content-Type": "application/json" } 
        });
        return withCORSHeaders(response, origin);
    }
}
