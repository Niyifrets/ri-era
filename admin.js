/* ============================================================
   RI-ERA'S KITCHEN
   ADMIN.JS - COMPLETE WITH AUTO-LOGOUT
   ============================================================ */

import { db, auth } from "./firebase.js";

import {
    collection,
    doc,
    addDoc,
    getDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

/* ============================================================
   CLOUDINARY
   ============================================================ */

const CLOUDINARY_CLOUD_NAME = "mv4aaxlt";
const CLOUDINARY_UPLOAD_PRESET = "ri-eras-kitchen";

/* ============================================================
   COLLECTIONS
   ============================================================ */

const foodsRef = collection(db, "foods");
const categoriesRef = collection(db, "categories");
const ordersRef = collection(db, "orders");

/* ============================================================
   STATE
   ============================================================ */

let currentUser = null;
let foods = [];
let categories = [];
let orders = [];
let editingFoodId = null;
let foodImageUrl = "";
let foodBeingDeleted = null;

/* ============================================================
   AUTO-LOGOUT SETTINGS
   ============================================================ */

const AUTO_LOGOUT_TIME = 30; // Time in minutes before auto-logout
const AUTO_LOGOUT_MS = AUTO_LOGOUT_TIME * 60 * 1000; // Convert to milliseconds
const WARNING_TIME = 60; // Show warning 60 seconds before logout
let logoutTimer = null;
let warningTimer = null;
let countdownInterval = null;

/* ============================================================
   DOM HELPER
   ============================================================ */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);
const byId = (id) => document.getElementById(id);

/* ============================================================
   AUTHENTICATION
   ============================================================ */

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    currentUser = user;
    console.log("✅ Admin authenticated:", user.email);
    
    updateAdminInformation();
    initializeTheme();
    setupNavigation();
    setupButtons();
    setupModalEvents();
    setupFilters();
    setupSettings();
    listenForFoods();
    listenForCategories();
    listenForOrders();
    await loadBusinessSettings();
    
    // Start auto-logout timer
    startAutoLogoutTimer();
    setupActivityListeners();
});

/* ============================================================
   AUTO-LOGOUT FUNCTIONS
   ============================================================ */

function startAutoLogoutTimer() {
    // Clear any existing timers
    clearTimeout(logoutTimer);
    clearTimeout(warningTimer);
    clearInterval(countdownInterval);
    
    console.log(`⏰ Auto-logout timer started: ${AUTO_LOGOUT_TIME} minutes`);
    
    // Set warning timer (show warning before logout)
    const warningTime = AUTO_LOGOUT_MS - (WARNING_TIME * 1000);
    
    if (warningTime > 0) {
        warningTimer = setTimeout(() => {
            showAutoLogoutWarning();
        }, warningTime);
    }
    
    // Set logout timer
    logoutTimer = setTimeout(() => {
        performAutoLogout();
    }, AUTO_LOGOUT_MS);
}

function showAutoLogoutWarning() {
    console.log("⚠️ Auto-logout warning: You will be logged out in 1 minute");
    
    // Remove existing warning modal if any
    removeWarningModal();
    
    // Create warning modal
    const warningModal = document.createElement('div');
    warningModal.id = 'sessionWarningModal';
    warningModal.className = 'modal active';
    warningModal.setAttribute('aria-hidden', 'false');
    
    warningModal.innerHTML = `
        <div class="modal-overlay"></div>
        <div class="modal-container small-modal" style="max-width: 450px; text-align: center;">
            <div style="margin-bottom: 20px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 48px; height: 48px; color: var(--warning); margin: 0 auto 15px; display: block;">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <h2 style="font-family: 'Playfair Display', serif; margin-bottom: 8px;">Session Expiring</h2>
                <p style="color: var(--text-soft); font-size: 14px; line-height: 1.6;">
                    You will be automatically logged out in <strong id="logoutCountdown" style="color: var(--warning); font-size: 20px;">${WARNING_TIME}</strong> seconds due to inactivity.
                </p>
                <p style="color: var(--text-muted); font-size: 12px; margin-top: 8px;">
                    Click "Stay Logged In" to continue your session.
                </p>
            </div>
            <div style="display: flex; gap: 10px; justify-content: center;">
                <button type="button" class="primary-button" id="stayLoggedInBtn" style="min-width: 140px;">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width: 16px; height: 16px;">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    </svg>
                    Stay Logged In
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(warningModal);
    
    // Start countdown
    let seconds = WARNING_TIME;
    const countdownElement = document.getElementById('logoutCountdown');
    
    countdownInterval = setInterval(() => {
        seconds--;
        if (countdownElement) {
            countdownElement.textContent = seconds;
        }
        
        if (seconds <= 0) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
    }, 1000);
    
    // Add event listener for stay logged in button
    document.getElementById('stayLoggedInBtn')?.addEventListener('click', () => {
        resetAutoLogoutTimer();
        removeWarningModal();
        showToast("Session Extended", "Your session has been extended.", "success");
    });
    
    // Also reset timer if user clicks anywhere on the page
    document.addEventListener('click', resetAutoLogoutTimer, { once: true });
    document.addEventListener('keydown', resetAutoLogoutTimer, { once: true });
    document.addEventListener('scroll', resetAutoLogoutTimer, { once: true });
    document.addEventListener('mousemove', resetAutoLogoutTimer, { once: true });
    document.addEventListener('touchstart', resetAutoLogoutTimer, { once: true });
}

function removeWarningModal() {
    const warningModal = document.getElementById('sessionWarningModal');
    if (warningModal) {
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        warningModal.remove();
    }
}

async function performAutoLogout() {
    console.log("⏰ Auto-logout triggered - logging out...");
    
    try {
        clearTimeout(logoutTimer);
        clearTimeout(warningTimer);
        clearInterval(countdownInterval);
        removeWarningModal();
        
        showToast(
            "Session Expired",
            "You have been logged out due to inactivity.",
            "warning"
        );
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        await signOut(auth);
        window.location.href = "login.html";
        
    } catch (error) {
        console.error("Auto-logout error:", error);
        window.location.href = "login.html";
    }
}

function resetAutoLogoutTimer() {
    console.log("🔄 Activity detected - resetting auto-logout timer");
    removeWarningModal();
    startAutoLogoutTimer();
}

function setupActivityListeners() {
    const events = [
        'click',
        'keydown',
        'scroll',
        'mousemove',
        'touchstart',
        'touchmove',
        'wheel'
    ];
    
    const resetHandler = () => {
        resetAutoLogoutTimer();
        // Re-attach listeners (they fire once per reset)
        setupActivityListeners();
    };
    
    events.forEach(event => {
        document.removeEventListener(event, resetHandler);
        document.addEventListener(event, resetHandler, { once: true });
    });
}

/* ============================================================
   PAGE VISIBILITY (Tab switching)
   ============================================================ */

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        console.log("👀 Admin panel hidden (tab switched)");
    } else {
        console.log("👀 Admin panel visible again - resetting timer");
        resetAutoLogoutTimer();
    }
});

/* ============================================================
   BEFOREUNLOAD (Page close/refresh)
   ============================================================ */

window.addEventListener('beforeunload', () => {
    clearTimeout(logoutTimer);
    clearTimeout(warningTimer);
    clearInterval(countdownInterval);
    removeWarningModal();
});

/* ============================================================
   ONLINE/OFFLINE STATUS
   ============================================================ */

window.addEventListener('online', () => {
    console.log("📶 Network reconnected - resetting timer");
    resetAutoLogoutTimer();
});

window.addEventListener('offline', () => {
    console.log("📶 Network disconnected - timer continues");
});

/* ============================================================
   ADMIN INFORMATION
   ============================================================ */

function updateAdminInformation() {
    const name = currentUser.displayName || currentUser.email?.split("@")[0] || "Admin";
    const email = currentUser.email || "";

    if (byId("adminName")) byId("adminName").textContent = name;
    if (byId("adminEmail")) byId("adminEmail").textContent = email;
    if (byId("settingsAdminName")) byId("settingsAdminName").textContent = name;
    if (byId("settingsAdminEmail")) byId("settingsAdminEmail").textContent = email;
}

/* ============================================================
   LOGOUT
   ============================================================ */

byId("logoutBtn")?.addEventListener("click", async () => {
    try {
        clearTimeout(logoutTimer);
        clearTimeout(warningTimer);
        clearInterval(countdownInterval);
        removeWarningModal();
        
        await signOut(auth);
        window.location.href = "login.html";
    } catch (error) {
        console.error("Logout error:", error);
        showToast("Logout failed", "Please try again.", "error");
    }
});

/* ============================================================
   NAVIGATION
   ============================================================ */

function setupNavigation() {
    $$(".nav-item[data-section]").forEach(button => {
        button.addEventListener("click", () => {
            const section = button.dataset.section;
            switchSection(section);
            closeSidebar();
            resetAutoLogoutTimer();
        });
    });

    $$("[data-section-target]").forEach(button => {
        button.addEventListener("click", () => {
            const section = button.dataset.sectionTarget;
            switchSection(section);
            resetAutoLogoutTimer();
        });
    });
}

function switchSection(section) {
    $$(".nav-item[data-section]").forEach(item => {
        item.classList.toggle("active", item.dataset.section === section);
    });

    $$(".admin-section").forEach(sectionElement => {
        sectionElement.classList.remove("active");
    });

    const target = byId(`${section}Section`);
    if (target) target.classList.add("active");

    const titles = {
        dashboard: { 
            title: "Dashboard", 
            subtitle: "Welcome back to your kitchen dashboard." 
        },
        foods: { 
            title: "Foods", 
            subtitle: "Add and manage your kitchen menu." 
        },
        categories: { 
            title: "Categories", 
            subtitle: "Manage your food categories." 
        },
        orders: { 
            title: "Orders", 
            subtitle: "View and manage customer orders." 
        },
        settings: { 
            title: "Settings", 
            subtitle: "Manage your website settings." 
        }
    };

    if (titles[section]) {
        byId("pageTitle").textContent = titles[section].title;
        byId("pageSubtitle").textContent = titles[section].subtitle;
    }
}

/* ============================================================
   SIDEBAR
   ============================================================ */

function setupSidebar() {
    byId("menuButton")?.addEventListener("click", openSidebar);
    byId("sidebarClose")?.addEventListener("click", closeSidebar);
    byId("sidebarOverlay")?.addEventListener("click", closeSidebar);
}

function openSidebar() {
    byId("sidebar")?.classList.add("open");
    byId("sidebarOverlay")?.classList.add("active");
}

function closeSidebar() {
    byId("sidebar")?.classList.remove("open");
    byId("sidebarOverlay")?.classList.remove("active");
}

/* ============================================================
   BUTTONS
   ============================================================ */

function setupButtons() {
    setupSidebar();

    ["dashboardAddFoodBtn", "quickAddFood", "addFoodBtn"].forEach(id => {
        byId(id)?.addEventListener("click", () => {
            openFoodModal();
            resetAutoLogoutTimer();
        });
    });

    byId("addCategoryBtn")?.addEventListener("click", () => {
        openCategoryModal();
        resetAutoLogoutTimer();
    });
    
    byId("topThemeToggle")?.addEventListener("click", toggleTheme);
    byId("themeToggle")?.addEventListener("click", toggleTheme);

    byId("settingsThemeToggle")?.addEventListener("change", (event) => {
        setTheme(event.target.checked ? "dark" : "light");
        resetAutoLogoutTimer();
    });

    byId("saveBusinessSettings")?.addEventListener("click", saveBusinessSettings);
}

/* ============================================================
   THEME
   ============================================================ */

function initializeTheme() {
    const saved = localStorage.getItem("ri-eras-theme") || "dark";
    setTheme(saved);
}

function setTheme(theme) {
    const dark = theme === "dark";
    document.body.classList.toggle("dark-theme", dark);
    document.body.classList.toggle("light-theme", !dark);
    localStorage.setItem("ri-eras-theme", dark ? "dark" : "light");
    updateThemeUI(dark);
}

function toggleTheme() {
    const dark = !document.body.classList.contains("dark-theme");
    setTheme(dark ? "dark" : "light");
}

function updateThemeUI(dark) {
    const themeIcon = byId("themeIcon");
    const themeText = byId("themeText");
    const topThemeIcon = byId("topThemeIcon");
    const settingsToggle = byId("settingsThemeToggle");

    if (themeIcon) themeIcon.className = dark ? "fa-solid fa-sun" : "fa-solid fa-moon";
    if (themeText) themeText.textContent = dark ? "Light Mode" : "Dark Mode";
    if (topThemeIcon) topThemeIcon.className = dark ? "fa-solid fa-sun" : "fa-solid fa-moon";
    if (settingsToggle) settingsToggle.checked = dark;
    updateLogos(dark);
}

function updateLogos(dark) {
    const logo = dark ? "logo-dark.png" : "logo-light.png";
    const sidebarLogo = byId("sidebarLogo");
    if (sidebarLogo) sidebarLogo.src = logo;
}

/* ============================================================
   FOOD LISTENER
   ============================================================ */

function listenForFoods() {
    console.log("🔍 Listening for foods...");
    
    onSnapshot(
        foodsRef,
        snapshot => {
            console.log("📦 Foods snapshot received. Size:", snapshot.size);
            
            foods = snapshot.docs.map(document => ({
                id: document.id,
                ...document.data()
            }));

            foods.sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt));

            renderFoods();
            renderRecentFoods();
            updateFoodStats();
            populateCategoryFilters();
        },
        error => {
            console.error("❌ Foods error:", error);
            showToast("Foods error", "Unable to load foods.", "error");
        }
    );
}

/* ============================================================
   FOOD STATISTICS
   ============================================================ */

function updateFoodStats() {
    const available = foods.filter(food => food.available !== false).length;
    setText("totalFoods", foods.length);
    setText("availableFoods", available);
}

/* ============================================================
   RENDER FOODS
   ============================================================ */

function renderFoods(list = null) {
    const container = byId("foodAdminGrid");
    if (!container) return;

    const foodList = list || getFilteredFoods();

    if (!foodList.length) {
        container.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4h16v16H4V4z"/><path d="M8 8h8v8H8V8z"/><path d="M12 12l4-4"/><path d="M12 12l-4 4"/><path d="M12 12l4 4"/><path d="M12 12l-4-4"/></svg><p>No foods found.</p></div>`;
        return;
    }

    container.innerHTML = foodList.map(createFoodCard).join("");
    attachFoodCardEvents();
}

/* ============================================================
   FOOD CARD
   ============================================================ */

function createFoodCard(food) {
    const image = food.image || food.imageUrl || "";
    const available = food.available !== false;

    return `
        <article class="food-admin-card" data-food-id="${escapeHTML(food.id)}">
            <div class="food-admin-image">
                ${image ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(food.name || "Food")}" loading="lazy">` : `<div class="food-image-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4h16v16H4V4z"/><path d="M8 8h8v8H8V8z"/><path d="M12 12l4-4"/><path d="M12 12l-4 4"/><path d="M12 12l4 4"/><path d="M12 12l-4-4"/></svg></div>`}
                <span class="food-availability ${available ? "" : "unavailable"}">${available ? "Available" : "Unavailable"}</span>
            </div>
            <div class="food-admin-body">
                <h3>${escapeHTML(food.name || "Unnamed Food")}</h3>
                <p class="food-admin-category">${escapeHTML(food.category || "Uncategorized")}</p>
                ${food.description ? `<p class="food-admin-description">${escapeHTML(food.description)}</p>` : ""}
                <div class="food-admin-price">${formatCurrency(food.price)}</div>
                <div class="food-admin-actions">
                    <button type="button" class="edit-food" data-id="${escapeHTML(food.id)}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Edit
                    </button>
                    <button type="button" class="delete-food" data-id="${escapeHTML(food.id)}">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        Delete
                    </button>
                </div>
            </div>
        </article>
    `;
}

/* ============================================================
   FOOD CARD EVENTS
   ============================================================ */

function attachFoodCardEvents() {
    $$(".edit-food").forEach(button => {
        button.addEventListener("click", () => {
            openFoodModal(button.dataset.id);
            resetAutoLogoutTimer();
        });
    });

    $$(".delete-food").forEach(button => {
        button.addEventListener("click", () => {
            openDeleteModal(button.dataset.id);
            resetAutoLogoutTimer();
        });
    });
}

/* ============================================================
   RECENT FOODS
   ============================================================ */

function renderRecentFoods() {
    const container = byId("recentFoods");
    if (!container) return;

    const recent = foods.slice(0, 5);

    if (!recent.length) {
        container.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4h16v16H4V4z"/><path d="M8 8h8v8H8V8z"/><path d="M12 12l4-4"/><path d="M12 12l-4 4"/><path d="M12 12l4 4"/><path d="M12 12l-4-4"/></svg><p>No foods added yet.</p></div>`;
        return;
    }

    container.innerHTML = recent.map(food => {
        const image = food.image || food.imageUrl || "";
        return `
            <div class="recent-food-item">
                <div class="recent-food-image">${image ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(food.name || "Food")}">` : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4h16v16H4V4z"/><path d="M8 8h8v8H8V8z"/><path d="M12 12l4-4"/><path d="M12 12l-4 4"/><path d="M12 12l4 4"/><path d="M12 12l-4-4"/></svg>`}</div>
                <div class="recent-food-info">
                    <strong>${escapeHTML(food.name || "Unnamed Food")}</strong>
                    <span>${escapeHTML(food.category || "Uncategorized")}</span>
                </div>
                <div class="recent-food-price">${formatCurrency(food.price)}</div>
            </div>
        `;
    }).join("");
}

/* ============================================================
   FOOD MODAL
   ============================================================ */

function openFoodModal(foodId = null) {
    const modal = byId("foodModal");
    const form = byId("foodForm");

    if (!modal || !form) {
        console.error("Food modal/form not found.");
        return;
    }

    editingFoodId = foodId;
    form.reset();
    hideFormMessage("foodFormError");
    resetUploadProgress();

    if (foodId) {
        const food = foods.find(item => item.id === foodId);
        if (!food) return;

        byId("foodId").value = food.id;
        byId("foodName").value = food.name || "";
        byId("foodPrice").value = food.price ?? "";
        byId("foodCategory").value = food.category || "";
        byId("foodDescription").value = food.description || "";
        byId("foodAvailable").checked = food.available !== false;
        foodImageUrl = food.image || food.imageUrl || "";
        updateFoodImagePreview(foodImageUrl);
        byId("foodModalTitle").textContent = "Edit Food";
        const subtitle = modal.querySelector(".modal-header p");
        if (subtitle) subtitle.textContent = "Update this menu item.";
    } else {
        byId("foodId").value = "";
        foodImageUrl = "";
        updateFoodImagePreview("");
        byId("foodModalTitle").textContent = "Add Food";
        const subtitle = modal.querySelector(".modal-header p");
        if (subtitle) subtitle.textContent = "Add a new item to your menu.";
    }

    showModal(modal);
}

function closeFoodModal() {
    closeModal(byId("foodModal"));
    editingFoodId = null;
    foodImageUrl = "";
}

/* ============================================================
   MODAL EVENTS
   ============================================================ */

function setupModalEvents() {
    $$("[data-close-modal]").forEach(element => {
        element.addEventListener("click", () => {
            const modal = element.closest(".modal");
            closeModal(modal);
            resetAutoLogoutTimer();
        });
    });

    byId("confirmDeleteBtn")?.addEventListener("click", confirmDeleteFood);
    byId("foodForm")?.addEventListener("submit", saveFood);
    byId("categoryForm")?.addEventListener("submit", saveCategory);
    byId("foodImage")?.addEventListener("change", uploadFoodImage);

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            $$(".modal").forEach(modal => closeModal(modal));
            closeSidebar();
            resetAutoLogoutTimer();
        }
    });
}

function showModal(modal) {
    if (!modal) return;
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
}

function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
}

/* ============================================================
   CLOUDINARY IMAGE UPLOAD
   ============================================================ */

async function uploadFoodImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        showFoodError("Please select an image file.");
        event.target.value = "";
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        showFoodError("Image is too large. Please choose an image below 10MB.");
        event.target.value = "";
        return;
    }

    if (CLOUDINARY_UPLOAD_PRESET === "YOUR_UPLOAD_PRESET") {
        showFoodError("Cloudinary upload preset has not been added to admin.js yet.");
        return;
    }

    resetUploadProgress();
    showUploadProgress();

    try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("upload_preset", CLOUDINARY_UPLOAD_PRESET);

        const xhr = new XMLHttpRequest();

        const upload = new Promise((resolve, reject) => {
            xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`);

            xhr.upload.addEventListener("progress", event => {
                if (!event.lengthComputable) return;
                const percent = Math.round((event.loaded / event.total) * 100);
                byId("progressFill").style.width = `${percent}%`;
                byId("progressText").textContent = `Uploading ${percent}%`;
            });

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(JSON.parse(xhr.responseText));
                } else {
                    let message = "Cloudinary upload failed.";
                    try {
                        const result = JSON.parse(xhr.responseText);
                        message = result.error?.message || message;
                    } catch { /* Ignore */ }
                    reject(new Error(message));
                }
            };

            xhr.onerror = () => {
                reject(new Error("Network error while uploading to Cloudinary."));
            };

            xhr.send(formData);
        });

        const result = await upload;
        foodImageUrl = result.secure_url;
        updateFoodImagePreview(foodImageUrl);
        byId("progressFill").style.width = "100%";
        byId("progressText").textContent = "Upload complete";
        showToast("Image uploaded", "Food image uploaded successfully.", "success");

    } catch (error) {
        console.error("Cloudinary upload error:", error);
        showFoodError(error.message || "Image upload failed.");
        resetUploadProgress();
    }
}

/* ============================================================
   IMAGE PREVIEW
   ============================================================ */

function updateFoodImagePreview(url) {
    const preview = byId("foodImagePreview");
    if (!preview) return;

    if (!url) {
        preview.innerHTML = `<div class="image-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg><span>Food Image</span></div>`;
        return;
    }

    preview.innerHTML = `<img src="${escapeHTML(url)}" alt="Food preview">`;
}

/* ============================================================
   UPLOAD PROGRESS
   ============================================================ */

function showUploadProgress() {
    const progress = byId("uploadProgress");
    if (!progress) return;
    progress.hidden = false;
    progress.style.display = "block";
}

function resetUploadProgress() {
    const progress = byId("uploadProgress");
    const fill = byId("progressFill");
    const text = byId("progressText");

    if (fill) fill.style.width = "0%";
    if (text) text.textContent = "Uploading 0%";
    if (progress) {
        progress.hidden = true;
        progress.style.display = "none";
    }
}

/* ============================================================
   SAVE FOOD
   ============================================================ */

async function saveFood(event) {
    event.preventDefault();
    hideFormMessage("foodFormError");

    const name = byId("foodName").value.trim();
    const price = Number(byId("foodPrice").value);
    const category = byId("foodCategory").value;
    const description = byId("foodDescription").value.trim();
    const available = byId("foodAvailable").checked;

    if (!name) {
        showFoodError("Please enter the food name.");
        return;
    }

    if (Number.isNaN(price) || price < 0) {
        showFoodError("Please enter a valid price.");
        return;
    }

    if (!category) {
        showFoodError("Please select a category.");
        return;
    }

    const saveButton = byId("saveFoodBtn");
    const saveText = byId("saveFoodText");
    const saveLoader = byId("saveFoodLoader");

    setSavingState(saveButton, saveText, saveLoader, true);

    try {
        const data = {
            name,
            price,
            category,
            description,
            available,
            image: foodImageUrl || "",
            updatedAt: serverTimestamp()
        };

        if (editingFoodId) {
            await updateDoc(doc(db, "foods", editingFoodId), data);
            showToast("Food updated", `${name} has been updated successfully.`, "success");
        } else {
            data.createdAt = serverTimestamp();
            data.createdBy = currentUser.uid;
            await addDoc(foodsRef, data);
            showToast("Food added", `${name} has been added to your menu.`, "success");
        }

        closeFoodModal();

    } catch (error) {
        console.error("Save food error:", error);
        showFoodError(getFirebaseErrorMessage(error));
    } finally {
        setSavingState(saveButton, saveText, saveLoader, false);
        resetAutoLogoutTimer();
    }
}

/* ============================================================
   SAVING STATE
   ============================================================ */

function setSavingState(button, text, loader, loading) {
    if (!button) return;
    button.disabled = loading;
    if (text) text.hidden = loading;
    if (loader) loader.hidden = !loading;
}

/* ============================================================
   CATEGORY LISTENER
   ============================================================ */

function listenForCategories() {
    console.log("🔍 Listening for categories...");
    
    onSnapshot(
        categoriesRef,
        snapshot => {
            console.log("📦 Categories snapshot received. Size:", snapshot.size);
            
            categories = snapshot.docs.map(document => ({
                id: document.id,
                ...document.data()
            }));

            categories.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

            populateCategorySelect();
            populateCategoryFilters();
            renderCategories();
        },
        error => {
            console.error("❌ Categories error:", error);
            showToast("Categories error", "Unable to load categories.", "error");
        }
    );
}

/* ============================================================
   CATEGORY SELECT
   ============================================================ */

function populateCategorySelect() {
    const select = byId("foodCategory");
    if (!select) return;

    const current = select.value;
    select.innerHTML = `<option value="">Select category</option>`;

    categories.forEach(category => {
        const option = document.createElement("option");
        option.value = category.name;
        option.textContent = category.name;
        select.appendChild(option);
    });

    if (current) select.value = current;
}

/* ============================================================
   CATEGORY FILTERS
   ============================================================ */

function populateCategoryFilters() {
    const filter = byId("categoryFilter");
    if (!filter) return;

    const current = filter.value;
    filter.innerHTML = `<option value="all">All Categories</option>`;

    categories.forEach(category => {
        const option = document.createElement("option");
        option.value = category.name;
        option.textContent = category.name;
        filter.appendChild(option);
    });

    if ([...filter.options].some(option => option.value === current)) {
        filter.value = current;
    }
}

/* ============================================================
   RENDER CATEGORIES
   ============================================================ */

function renderCategories() {
    const container = byId("categoriesGrid");
    if (!container) return;

    if (!categories.length) {
        container.innerHTML = `<div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg><p>No categories yet.</p></div>`;
        return;
    }

    container.innerHTML = categories.map(category => {
        const foodCount = foods.filter(food => food.category === category.name).length;
        return `
            <div class="category-card" data-category-id="${escapeHTML(category.id)}">
                <div class="category-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16v16H4V4z"/><path d="M8 8h8v8H8V8z"/><path d="M12 12l4-4"/><path d="M12 12l-4 4"/><path d="M12 12l4 4"/><path d="M12 12l-4-4"/></svg></div>
                <div class="category-info">
                    <strong>${escapeHTML(category.name)}</strong>
                    <span>${foodCount} ${foodCount === 1 ? "food" : "foods"}</span>
                </div>
                <button type="button" class="category-delete" data-id="${escapeHTML(category.id)}">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>
        `;
    }).join("");

    $$(".category-delete").forEach(button => {
        button.addEventListener("click", () => {
            deleteCategory(button.dataset.id);
            resetAutoLogoutTimer();
        });
    });
}

/* ============================================================
   CATEGORY MODAL
   ============================================================ */

function openCategoryModal() {
    const modal = byId("categoryModal");
    const form = byId("categoryForm");

    if (!modal || !form) return;

    form.reset();
    hideFormMessage("categoryFormError");
    showModal(modal);
}

/* ============================================================
   SAVE CATEGORY
   ============================================================ */

async function saveCategory(event) {
    event.preventDefault();
    hideFormMessage("categoryFormError");

    const name = byId("categoryName").value.trim();

    if (!name) {
        showCategoryError("Please enter a category name.");
        return;
    }

    const exists = categories.some(category => String(category.name).toLowerCase() === name.toLowerCase());

    if (exists) {
        showCategoryError("This category already exists.");
        return;
    }

    const button = byId("saveCategoryBtn");
    const original = button.innerHTML;

    button.disabled = true;
    button.innerHTML = `<span class="loader small"></span> Saving...`;

    try {
        await addDoc(categoriesRef, {
            name,
            createdAt: serverTimestamp(),
            createdBy: currentUser.uid
        });

        showToast("Category added", `${name} has been created.`, "success");
        closeModal(byId("categoryModal"));

    } catch (error) {
        console.error("Category error:", error);
        showCategoryError(getFirebaseErrorMessage(error));
    } finally {
        button.disabled = false;
        button.innerHTML = original;
        resetAutoLogoutTimer();
    }
}

/* ============================================================
   DELETE CATEGORY
   ============================================================ */

async function deleteCategory(id) {
    const category = categories.find(item => item.id === id);
    if (!category) return;

    const usedBy = foods.filter(food => food.category === category.name);

    if (usedBy.length) {
        showToast("Cannot delete category", `${category.name} is being used by ${usedBy.length} food item(s).`, "error");
        return;
    }

    const confirmed = window.confirm(`Delete "${category.name}"?`);
    if (!confirmed) return;

    try {
        await deleteDoc(doc(db, "categories", id));
        showToast("Category deleted", `${category.name} has been removed.`, "success");
    } catch (error) {
        console.error(error);
        showToast("Delete failed", getFirebaseErrorMessage(error), "error");
    }
}

/* ============================================================
   DELETE FOOD MODAL
   ============================================================ */

function openDeleteModal(id) {
    const food = foods.find(item => item.id === id);
    if (!food) return;

    foodBeingDeleted = id;
    byId("deleteMessage").textContent = `Are you sure you want to delete "${food.name}"? This action cannot be undone.`;
    showModal(byId("deleteModal"));
}

/* ============================================================
   CONFIRM DELETE FOOD
   ============================================================ */

async function confirmDeleteFood() {
    if (!foodBeingDeleted) return;

    const id = foodBeingDeleted;
    const button = byId("confirmDeleteBtn");
    button.disabled = true;

    try {
        await deleteDoc(doc(db, "foods", id));
        showToast("Food deleted", "The food item has been removed.", "success");
        foodBeingDeleted = null;
        closeModal(byId("deleteModal"));
    } catch (error) {
        console.error(error);
        showToast("Delete failed", getFirebaseErrorMessage(error), "error");
    } finally {
        button.disabled = false;
        resetAutoLogoutTimer();
    }
}

/* ============================================================
   FOOD FILTERS
   ============================================================ */

function setupFilters() {
    byId("foodSearch")?.addEventListener("input", () => {
        renderFoods();
        resetAutoLogoutTimer();
    });
    
    byId("categoryFilter")?.addEventListener("change", () => {
        renderFoods();
        resetAutoLogoutTimer();
    });
    
    byId("availabilityFilter")?.addEventListener("change", () => {
        renderFoods();
        resetAutoLogoutTimer();
    });
    
    byId("orderSearch")?.addEventListener("input", () => {
        renderOrders();
        resetAutoLogoutTimer();
    });
    
    byId("orderStatusFilter")?.addEventListener("change", () => {
        renderOrders();
        resetAutoLogoutTimer();
    });
}

/* ============================================================
   FILTER FOODS
   ============================================================ */

function getFilteredFoods() {
    const search = (byId("foodSearch")?.value || "").trim().toLowerCase();
    const category = byId("categoryFilter")?.value || "all";
    const availability = byId("availabilityFilter")?.value || "all";

    return foods.filter(food => {
        const matchesSearch = !search ||
            String(food.name || "").toLowerCase().includes(search) ||
            String(food.description || "").toLowerCase().includes(search) ||
            String(food.category || "").toLowerCase().includes(search);

        const matchesCategory = category === "all" || food.category === category;
        const isAvailable = food.available !== false;
        const matchesAvailability = availability === "all" ||
            (availability === "available" && isAvailable) ||
            (availability === "unavailable" && !isAvailable);

        return matchesSearch && matchesCategory && matchesAvailability;
    });
}

/* ============================================================
   ORDERS LISTENER
   ============================================================ */

function listenForOrders() {
    console.log("🔍 Listening for orders...");
    
    onSnapshot(
        ordersRef,
        snapshot => {
            console.log("📦 Orders snapshot received. Size:", snapshot.size);
            
            orders = snapshot.docs.map(document => ({
                id: document.id,
                ...document.data()
            }));

            console.log("📋 Orders data:", orders);

            orders.sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt));

            updateOrderStats();
            renderOrders();
        },
        error => {
            console.error("❌ Orders error:", error);
            console.error("Error code:", error.code);
            console.error("Error message:", error.message);
            showToast("Orders error", "Unable to load orders. Check console for details.", "error");
        }
    );
}

/* ============================================================
   ORDER STATISTICS
   ============================================================ */

function updateOrderStats() {
    console.log("📊 Updating order stats. Total orders:", orders.length);
    
    const pending = orders.filter(order => (order.status || "pending") === "pending").length;

    console.log("📊 Pending orders:", pending);

    setText("totalOrders", orders.length);
    setText("pendingOrders", pending);
    setText("pendingOrdersBadge", pending);

    const dot = byId("notificationDot");
    if (dot) dot.hidden = pending === 0;
}

/* ============================================================
   RENDER ORDERS
   ============================================================ */

function renderOrders() {
    const tbody = byId("ordersTableBody");
    if (!tbody) {
        console.error("❌ ordersTableBody not found");
        return;
    }

    console.log("🔄 Rendering orders. Count:", orders.length);

    const search = (byId("orderSearch")?.value || "").trim().toLowerCase();
    const status = byId("orderStatusFilter")?.value || "all";

    const filtered = orders.filter(order => {
        const customer = String(order.customerName || order.name || "").toLowerCase();
        const phone = String(order.phone || order.customerPhone || "").toLowerCase();
        const orderNumber = String(order.orderNumber || order.id).toLowerCase();

        const matchesSearch = !search || customer.includes(search) || phone.includes(search) || orderNumber.includes(search);
        const matchesStatus = status === "all" || (order.status || "pending") === status;

        return matchesSearch && matchesStatus;
    });

    console.log("🔄 Filtered orders:", filtered.length);

    if (!filtered.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="table-empty">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                    <p>${orders.length === 0 ? "No orders yet. Place a test order from the customer website." : "No orders match your filters."}</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(createOrderRow).join("");

    $$(".view-order").forEach(button => {
        button.addEventListener("click", () => {
            openOrderModal(button.dataset.id);
            resetAutoLogoutTimer();
        });
    });
}

/* ============================================================
   ORDER ROW
   ============================================================ */

function createOrderRow(order) {
    const number = order.orderNumber || order.id.slice(0, 6).toUpperCase();
    const customer = order.customerName || order.name || "Unknown Customer";
    const total = order.total || order.totalAmount || 0;
    const status = order.status || "pending";

    return `
        <tr>
            <td><span class="order-number">#${escapeHTML(number)}</span></td>
            <td>
                <div class="order-customer">
                    <strong>${escapeHTML(customer)}</strong>
                    <span>${escapeHTML(order.phone || order.customerPhone || "No phone")}</span>
                </div>
            </td>
            <td>${formatCurrency(total)}</td>
            <td><span class="status-badge status-${escapeHTML(status)}">${escapeHTML(status)}</span></td>
            <td>${formatDate(order.createdAt)}</td>
            <td>
                <button type="button" class="table-action view-order" data-id="${escapeHTML(order.id)}" title="View order">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                </button>
            </td>
        </tr>
    `;
}

/* ============================================================
   ORDER MODAL
   ============================================================ */

function openOrderModal(id) {
    const order = orders.find(item => item.id === id);
    if (!order) return;

    const modal = byId("orderModal");
    const details = byId("orderDetails");

    if (!modal || !details) return;

    const items = Array.isArray(order.items) ? order.items : [];
    const status = order.status || "pending";

    details.innerHTML = `
        <div class="order-details">
            <div class="order-detail-header">
                <div>
                    <h3>Order #${escapeHTML(order.orderNumber || id.slice(0, 6).toUpperCase())}</h3>
                    <p>${formatDate(order.createdAt)}</p>
                </div>
                <span class="status-badge status-${escapeHTML(status)}">${escapeHTML(status)}</span>
            </div>
            <div class="order-customer-details">
                <div class="customer-detail">
                    <span>Customer</span>
                    <strong>${escapeHTML(order.customerName || order.name || "Unknown")}</strong>
                </div>
                <div class="customer-detail">
                    <span>Phone</span>
                    <strong>${escapeHTML(order.phone || order.customerPhone || "Not provided")}</strong>
                </div>
                <div class="customer-detail">
                    <span>Address</span>
                    <strong>${escapeHTML(order.address || "Not provided")}</strong>
                </div>
            </div>
            <div class="order-items">
                <h4>Items</h4>
                ${items.length ? items.map(item => {
                    const quantity = Number(item.quantity) || 1;
                    const price = Number(item.price) || 0;
                    return `
                        <div class="order-item">
                            <div>
                                <strong>${escapeHTML(item.name || "Food")}</strong>
                                <span>Qty: ${quantity}</span>
                            </div>
                            <strong class="order-item-price">${formatCurrency(price * quantity)}</strong>
                        </div>
                    `;
                }).join("") : `<p>No item details available.</p>`}
            </div>
            <div class="order-total">
                <span>Total</span>
                <strong>${formatCurrency(order.total || order.totalAmount || 0)}</strong>
            </div>
            <div class="form-group">
                <label for="orderStatusUpdate">Order Status</label>
                <select id="orderStatusUpdate">
                    <option value="pending" ${status === "pending" ? "selected" : ""}>Pending</option>
                    <option value="confirmed" ${status === "confirmed" ? "selected" : ""}>Confirmed</option>
                    <option value="preparing" ${status === "preparing" ? "selected" : ""}>Preparing</option>
                    <option value="completed" ${status === "completed" ? "selected" : ""}>Completed</option>
                    <option value="cancelled" ${status === "cancelled" ? "selected" : ""}>Cancelled</option>
                </select>
            </div>
            <div class="modal-actions">
                <button type="button" class="primary-button" id="saveOrderStatus">Save Status</button>
            </div>
        </div>
    `;

    showModal(modal);

    byId("saveOrderStatus")?.addEventListener("click", () => {
        saveOrderStatus(id);
        resetAutoLogoutTimer();
    });
}

/* ============================================================
   SAVE ORDER STATUS
   ============================================================ */

async function saveOrderStatus(id) {
    const select = byId("orderStatusUpdate");
    if (!select) return;

    const status = select.value;
    const button = byId("saveOrderStatus");
    button.disabled = true;

    try {
        await updateDoc(doc(db, "orders", id), {
            status,
            updatedAt: serverTimestamp()
        });

        showToast("Order updated", "Order status has been updated.", "success");
        closeModal(byId("orderModal"));

    } catch (error) {
        console.error(error);
        showToast("Update failed", getFirebaseErrorMessage(error), "error");
    } finally {
        button.disabled = false;
        resetAutoLogoutTimer();
    }
}

/* ============================================================
   SETTINGS
   ============================================================ */

function setupSettings() {
    // Additional settings setup if needed
}

/* ============================================================
   LOAD BUSINESS SETTINGS
   ============================================================ */

async function loadBusinessSettings() {
    try {
        const ref = doc(db, "settings", "business");
        const snapshot = await getDoc(ref);

        if (!snapshot.exists()) return;

        const data = snapshot.data();

        if (byId("businessName") && data.name) {
            byId("businessName").value = data.name;
        }

        if (byId("businessPhone") && data.phone) {
            byId("businessPhone").value = data.phone;
        }

    } catch (error) {
        console.error("Settings load error:", error);
    }
}

/* ============================================================
   SAVE BUSINESS SETTINGS
   ============================================================ */

async function saveBusinessSettings() {
    const button = byId("saveBusinessSettings");
    const original = button.innerHTML;

    button.disabled = true;
    button.innerHTML = `<span class="loader small"></span> Saving...`;

    try {
        const data = {
            name: byId("businessName").value.trim(),
            phone: byId("businessPhone").value.trim(),
            updatedAt: serverTimestamp()
        };

        const ref = doc(db, "settings", "business");
        const existing = await getDoc(ref);

        if (existing.exists()) {
            await updateDoc(ref, data);
        } else {
            await addDoc(collection(db, "settings"), data);
        }

        showToast("Settings saved", "Business information has been saved.", "success");

    } catch (error) {
        console.error(error);
        showToast("Save failed", getFirebaseErrorMessage(error), "error");
    } finally {
        button.disabled = false;
        button.innerHTML = original;
        resetAutoLogoutTimer();
    }
}

/* ============================================================
   TOAST
   ============================================================ */

function showToast(title, message, type = "success") {
    const container = byId("toastContainer");
    if (!container) return;

    const icons = {
        success: "fa-circle-check",
        error: "fa-circle-xmark",
        warning: "fa-triangle-exclamation",
        info: "fa-circle-info"
    };

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fa-solid ${icons[type] || icons.info}"></i>
        </div>
        <div class="toast-content">
            <strong>${escapeHTML(title)}</strong>
            <p>${escapeHTML(message)}</p>
        </div>
        <button type="button" class="toast-close" aria-label="Close notification">
            <i class="fa-solid fa-xmark"></i>
        </button>
    `;

    container.appendChild(toast);

    toast.querySelector(".toast-close")?.addEventListener("click", () => toast.remove());

    setTimeout(() => {
        toast.classList.add("hide");
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

/* ============================================================
   FORM ERROR
   ============================================================ */

function showFoodError(message) {
    showFormMessage("foodFormError", message);
}

function showCategoryError(message) {
    showFormMessage("categoryFormError", message);
}

function showFormMessage(id, message) {
    const element = byId(id);
    if (!element) return;
    element.textContent = message;
    element.hidden = false;
}

function hideFormMessage(id) {
    const element = byId(id);
    if (!element) return;
    element.textContent = "";
    element.hidden = true;
}

/* ============================================================
   HELPERS
   ============================================================ */

function setText(id, value) {
    const element = byId(id);
    if (element) element.textContent = value;
}

function formatCurrency(value) {
    const amount = Number(value) || 0;
    return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 0
    }).format(amount);
}

function timestampValue(value) {
    if (!value) return 0;
    if (typeof value.toMillis === "function") return value.toMillis();
    if (typeof value.toDate === "function") return value.toDate().getTime();
    if (value instanceof Date) return value.getTime();
    if (typeof value === "string") return new Date(value).getTime() || 0;
    if (typeof value === "number") return value;
    return 0;
}

function formatDate(value) {
    const time = timestampValue(value);
    if (!time) return "—";
    return new Intl.DateTimeFormat("en-NG", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
    }).format(new Date(time));
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getFirebaseErrorMessage(error) {
    const code = error?.code || "";
    const messages = {
        "permission-denied": "You don't have permission to perform this action.",
        "failed-precondition": "Firebase could not complete this request.",
        "unavailable": "Firebase is temporarily unavailable. Check your network connection.",
        "network-request-failed": "Network request failed. Please check your internet connection.",
        "auth/network-request-failed": "Firebase Authentication network request failed.",
        "not-found": "The requested item could not be found."
    };
    return messages[code] || error?.message || "Something went wrong.";
}

/* ============================================================
   CLICK OUTSIDE / GENERAL MODAL HANDLING
   ============================================================ */

$$(".modal").forEach(modal => {
    modal.addEventListener("click", event => {
        if (event.target === modal) {
            closeModal(modal);
            resetAutoLogoutTimer();
        }
    });
});

/* ============================================================
   INITIAL CONSOLE MESSAGE
   ============================================================ */

console.log("✅ RI-ERA'S KITCHEN Admin initialized.");
console.log(`⏰ Auto-logout set to ${AUTO_LOGOUT_TIME} minutes of inactivity.`);
console.log("📁 Firebase Project:", "ri-eras-kitchen");
console.log("☁️ Cloudinary Cloud:", CLOUDINARY_CLOUD_NAME);