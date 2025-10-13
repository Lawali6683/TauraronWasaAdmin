export async function onRequest(context) {
  const { request } = context;

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: true, message: "Sai POST request kawai ake yarda." }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const body = await request.json();
    const query = (body.query || "").toLowerCase();

    const SPORTMONKS_API_KEY = "22Wx1265roisUdQugjYeA2fzXnxh4TpeLNNoZ869Jffsezwfu6R9efED6LLg";

    let apiUrl = "";

    // Duba irin request ɗin
    if (query.includes("today")) {
      apiUrl = `https://api.sportmonks.com/api/v3/football/livescores?api_token=${SPORTMONKS_API_KEY}`;
    } else if (query.includes("tomorrow")) {
      apiUrl = `https://api.sportmonks.com/api/v3/football/fixtures/date/${getFutureDate(1)}?api_token=${SPORTMONKS_API_KEY}`;
    } else if (query.includes("jibi") || query.includes("next")) {
      apiUrl = `https://api.sportmonks.com/api/v3/football/fixtures/date/${getFutureDate(2)}?api_token=${SPORTMONKS_API_KEY}`;
    } else {
      return new Response(JSON.stringify({ error: true, message: "Ba a gane irin request ɗin ba." }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const apiResponse = await fetch(apiUrl);

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      return new Response(JSON.stringify({
        error: true,
        message: `API ya dawo da kuskure (HTTP ${apiResponse.status})`,
        details: errorText
      }), {
        status: apiResponse.status,
        headers: { "Content-Type": "application/json" }
      });
    }

    const data = await apiResponse.json();

    return new Response(JSON.stringify({
      success: true,
      source_url: apiUrl,
      data
    }, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({
      error: true,
      message: "An samu kuskure a wajen aikin API.",
      details: err.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

function getFutureDate(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
