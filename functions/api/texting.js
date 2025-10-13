export async function onRequest(context) {
  const { request } = context;
  const contentType = request.headers.get("content-type") || "";
  if (request.method !== "POST" || !contentType.includes("application/json")) {
    return new Response(JSON.stringify({ error: true, message: "Invalid request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const body = await request.json();
    const query = (body.query || "").toLowerCase();

    // API key ɗinka daga SportMonks
    const SPORTMONKS_API_KEY = "22Wx1265roisUdQugjYeA2fzXnxh4TpeLNNoZ869Jffsezwfu6R9efED6LLg";

    let apiUrl = "";

    // Idan tambaya ta ƙunshi "matches today", "tomorrow", ko "next"
    if (query.includes("today")) {
      apiUrl = `https://api.sportmonks.com/api/v3/football/livescores?api_token=${SPORTMONKS_API_KEY}`;
    } else if (query.includes("tomorrow")) {
      apiUrl = `https://api.sportmonks.com/api/v3/football/fixtures/date/${getFutureDate(1)}?api_token=${SPORTMONKS_API_KEY}`;
    } else if (query.includes("next") || query.includes("jibi")) {
      apiUrl = `https://api.sportmonks.com/api/v3/football/fixtures/date/${getFutureDate(2)}?api_token=${SPORTMONKS_API_KEY}`;
    } else {
      apiUrl = `https://api.sportmonks.com/api/v3/football/livescores?api_token=${SPORTMONKS_API_KEY}`;
    }

    const res = await fetch(apiUrl);
    const data = await res.json();

    return new Response(JSON.stringify(data, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: true, message: err.message }), {
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
