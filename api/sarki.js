const admin = require("firebase-admin");
const API_AUTH_KEY = process.env.API_AUTH_KEY;
const FIREBASE_DATABASE_URL = process.env.FIREBASE_DATABASE_URL;
const SERVICE_ACCOUNT = process.env.FIREBASE_DATABASE_SDK ?
  JSON.parse(process.env.FIREBASE_DATABASE_SDK) :
  null;

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(SERVICE_ACCOUNT),
    databaseURL: FIREBASE_DATABASE_URL,
  });
}

const db = admin.database();

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "https://tauraronwasa.pages.dev, https://www.tauraronwasa.com");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, x-api-key");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const authHeader = req.headers["x-api-key"];

  if (!authHeader || authHeader !== API_AUTH_KEY) {
    return res.status(401).json({
      error: "Unauthorized request"
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Method not allowed"
    });
  }

  try {
    const sarkiId = "Sarki";
    const sarkiRef = db.ref(sarkiId);
    
    const newSarkiData = {
      userUid: req.body.userUid,
      fullName: req.body.fullName,
      profileLogo: req.body.profileLogo,
      teamLogo: req.body.teamLogo,
      commentText: req.body.commentText,
      commentTime: req.body.commentTime,
      team1Logo: req.body.team1Logo,
      team1Name: req.body.team1Name,
      team2Logo: req.body.team2Logo,
      team2Name: req.body.team2Name,
      sarkiLove: 0, 
      isActive: true,
      timestamp: admin.database.ServerValue.TIMESTAMP
    };

    // Ajiye sabon data a shafin "Sarki"
    await sarkiRef.set(newSarkiData);

    // Tabbatar an yi nasara
    res.status(200).json({
      message: "An adana bayanan sarki cikin nasara",
      data: newSarkiData
    });

  } catch (error) {
    console.error("Kuskure wajen ajiye bayanai a Firebase:", error);
    res.status(500).json({
      error: "Kuskure wajen ajiye bayanai",
      details: error.message
    });
  }
};
