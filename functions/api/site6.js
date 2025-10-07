
const AUTH_KEY = "@haruna66"; 


async function updateFixtures(env) {
   
    const now = Date.now();
    const start = new Date(now);
    start.setDate(start.getDate() - 2); 
    const end = new Date(now);
    end.setDate(end.getDate() + 5);   
    
    const dateFrom = start.toISOString().split("T")[0];
    const dateTo = end.toISOString().split("T")[0];
    
   
    const apiUrl = `https://api.football-data.org/v4/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`; 

    
    const response = await fetch(apiUrl, {
      headers: { "X-Auth-Token": env.FOOTBALL_DATA_API_KEY6 },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Football API Error HTTP ${response.status}: ${errorText.substring(0, 100)}`);
    }

    const data = await response.json();
    const fixtures = data.matches || [];

   
    const categorized = {};
    fixtures.forEach((f) => {
      const fixtureDate = new Date(f.utcDate).toISOString().split("T")[0];
      if (!categorized[fixtureDate]) categorized[fixtureDate] = [];
      categorized[fixtureDate].push(f);
    });

    
    const fbUrl = `https://tauraronwasa-default-rtdb.firebaseio.com/fixtures.json?auth=${env.FIREBASE_SECRET}`;
    const fbRes = await fetch(fbUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(categorized), 
    });

    if (!fbRes.ok) {
      const fbErr = await fbRes.text();
      throw new Error(`Firebase Error HTTP ${fbRes.status}: ${fbErr.substring(0, 100)}`);
    }
    
    return {
        status: "success",
        total: fixtures.length
    };
}

export async function onRequest({ request, env }) {
   
    const url = new URL(request.url);
    const key = url.searchParams.get('key');
    
    if (key !== AUTH_KEY) {
        return new Response(JSON.stringify({ error: "Invalid API Key" }), { 
            status: 403, 
            headers: { 'Content-Type': 'application/json' }
        });
    }

   
    try {
        const result = await updateFixtures(env);        
      
        const origin = request.headers.get('Origin');
        const allowedOrigins = [
            "https://tauraronwasaadmin.pages.dev", 
            "http://localhost:8080"
        ];
        const corsHeaders = {
            'Access-Control-Allow-Methods': 'GET',
            'Access-Control-Allow-Headers': 'Content-Type',
        };
        
        if (allowedOrigins.includes(origin)) {
            corsHeaders['Access-Control-Allow-Origin'] = origin;
        } else {
             
             corsHeaders['Access-Control-Allow-Origin'] = allowedOrigins[0];
        }

        return new Response(JSON.stringify(result), {
            headers: { 
                "Content-Type": "application/json", 
                ...corsHeaders 
            },
        });
    } catch (error) {
        return new Response(JSON.stringify({ 
            error: true, 
            message: error.message 
        }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
}
