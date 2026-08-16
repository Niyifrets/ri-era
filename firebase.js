import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAa_heOWyhd_M7AgCNiOqd_vkIg_Op49tU",
  authDomain: "ri-eras-kitchen.firebaseapp.com",
  projectId: "ri-eras-kitchen",
  storageBucket: "ri-eras-kitchen.firebasestorage.app",
  messagingSenderId: "458519215249",
  appId: "1:458519215249:web:46b6f60e3e8c0505a19330"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };