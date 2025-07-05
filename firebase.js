
  import { initializeApp } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.9.1/firebase-analytics.js";
  
  // Your web app's Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyBG7QKbb1h1ZMsfJS4ZmN9rOnRHS-HY41U",
    authDomain: "tauraronwasa.firebaseapp.com",
    databaseURL: "https://tauraronwasa-default-rtdb.firebaseio.com",
    projectId: "tauraronwasa",
    storageBucket: "tauraronwasa.firebasestorage.app",
    messagingSenderId: "968039206653",
    appId: "1:968039206653:web:37c755990bacb43aedf894"
  };

 // Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Export so other files can use them
export { app, analytics, firebaseConfig };
