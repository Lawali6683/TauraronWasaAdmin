
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key");
    
    if (req.method === "OPTIONS") {
        return res.status(204).end();
    }
    
    const authHeader = req.headers["x-api-key"];
    if (!authHeader || authHeader !== "@haruna66") {
        console.error("Unauthorized request. Invalid API Key.");
        return res.status(401).json({ error: "Unauthorized request" });
    }

    if (req.method !== "POST") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const result = await runDataUpdate();
    return res.status(200).json(result);
};
