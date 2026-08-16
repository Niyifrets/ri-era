import { auth } from "./firebase.js";

import {
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

const loginForm = document.getElementById("loginForm");
const loginBtn = document.getElementById("loginBtn");
const loginMessage = document.getElementById("loginMessage");

loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    loginBtn.disabled = true;
    loginBtn.textContent = "Logging in...";

    try {
        await signInWithEmailAndPassword(auth, email, password);
        loginMessage.textContent = "Login successful!";
        window.location.href = "admin.html";
    } catch (error) {
        console.error(error);
        loginMessage.textContent = "Invalid email or password.";
        loginBtn.disabled = false;
        loginBtn.textContent = "Login";
    }
});