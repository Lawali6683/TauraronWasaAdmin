import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyBG7QKbb1h1ZMsfJS4ZmN9rOnRHS-HY41U",
    authDomain: "tauraronwasa.firebaseapp.com",
    databaseURL: "https://tauraronwasa-default-rtdb.firebaseio.com",
    projectId: "tauraronwasa",
    storageBucket: "tauraronwasa.firebasestorage.app",
    messagingSenderId: "968039206653",
    appId: "1:968039206653:web:37c755990bacb43aedf894"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const database = getDatabase(app);

export { app, analytics, auth, database, firebaseConfig };