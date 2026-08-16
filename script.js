/* ============================================================
   RI-ERA'S KITCHEN
   CUSTOMER WEBSITE
   SCRIPT.JS - COMPLETE WORKING VERSION
   ============================================================ */

// Import Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getFirestore, collection, onSnapshot, addDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

// Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyAa_heOWyhd_M7AgCNiOqd_vkIg_Op49tU",
  authDomain: "ri-eras-kitchen.firebaseapp.com",
  projectId: "ri-eras-kitchen",
  storageBucket: "ri-eras-kitchen.firebasestorage.app",
  messagingSenderId: "458519215249",
  appId: "1:458519215249:web:46b6f60e3e8c0505a19330"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Collection References
const foodsRef = collection(db, "foods");
const categoriesRef = collection(db, "categories");
const ordersRef = collection(db, "orders");

/* ============================================================
   STATE
   ============================================================ */

let foods = [];
let categories = [];
let cart = [];
let selectedFood = null;
let selectedQuantity = 1;
let currentCategory = "all";
let currentSearch = "";
let dataLoaded = false;

/* ============================================================
   DOM HELPERS
   ============================================================ */

const byId = (id) => document.getElementById(id);
const $$ = (selector) => document.querySelectorAll(selector);

/* ============================================================
   INITIALIZATION
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
    console.log("🚀 DOM loaded, initializing...");
    
    initializeTheme();
    setupNavigation();
    setupMobileMenu();
    setupCart();
    setupFoodModal();
    setupCheckout();
    setupSearch();
    setupScrollNavigation();
    
    // Load data
    loadData();
});

/* ============================================================
   LOAD DATA
   ============================================================ */

function loadData() {
    console.log("📡 Loading data from Firestore...");
    
    // Show loading
    const loading = byId("menuLoading");
    const grid = byId("foodGrid");
    const empty = byId("emptyMenu");
    
    if (loading) loading.hidden = false;
    if (grid) grid.innerHTML = "";
    if (empty) empty.hidden = true;
    
    // Load categories first, then foods
    loadCategories();
}

/* ============================================================
   LOAD CATEGORIES
   ============================================================ */

function loadCategories() {
    console.log("🔍 Loading categories...");
    
    onSnapshot(
        categoriesRef,
        (snapshot) => {
            console.log("✅ Categories loaded. Count:", snapshot.size);
            
            categories = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            console.log("📋 Categories data:", categories);
            
            // After categories load, load foods
            loadFoods();
        },
        (error) => {
            console.error("❌ Categories error:", error);
            // Still try to load foods
            loadFoods();
        }
    );
}

/* ============================================================
   LOAD FOODS
   ============================================================ */

function loadFoods() {
    console.log("🔍 Loading foods...");
    
    onSnapshot(
        foodsRef,
        (snapshot) => {
            console.log("✅ Foods loaded. Count:", snapshot.size);
            
            foods = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            console.log("📋 Foods data:", foods);
            
            // ✅ HIDE LOADING - THIS IS THE KEY FIX
            hideLoading();
            
            // Render everything
            renderCategories();
            renderFoods();
            
            dataLoaded = true;
        },
        (error) => {
            console.error("❌ Foods error:", error);
            console.error("Error code:", error.code);
            console.error("Error message:", error.message);
            
            // ✅ HIDE LOADING ON ERROR TOO
            hideLoading();
            
            // Show error
            const container = byId("foodGrid");
            if (container) {
                container.innerHTML = `
                    <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px;">
                        <i class="fa-solid fa-triangle-exclamation" style="font-size: 48px; color: #dc2626; margin-bottom: 15px;"></i>
                        <h3 style="font-size: 20px; margin-bottom: 10px;">Failed to load menu</h3>
                        <p style="color: var(--text-soft); max-width: 400px; margin: 0 auto 20px;">
                            ${error.message || "Please check your connection and try again."}
                        </p>
                        <button onclick="location.reload()" class="primary-button">
                            <i class="fa-solid fa-rotate"></i> Retry
                        </button>
                    </div>
                `;
            }
            
            showToast("Unable to load menu", error.message || "Please refresh the page.", "error");
        }
    );
}

/* ============================================================
   HIDE LOADING - NEW FUNCTION
   ============================================================ */

function hideLoading() {
    const loading = byId("menuLoading");
    if (loading) {
        loading.hidden = true;
        loading.style.display = "none";
        console.log("✅ Loading spinner hidden");
    }
}

/* ============================================================
   RENDER CATEGORIES
   ============================================================ */

function renderCategories() {
    const container = byId("categories");
    if (!container) {
        console.error("❌ categories container not found");
        return;
    }

    // Get unique category names from both categories collection and foods
    const categoryNames = new Set();
    
    // Add from categories collection
    categories.forEach(category => {
        const name = category.name || category.title || category.category;
        if (name) categoryNames.add(name);
    });
    
    // Add from foods
    foods.forEach(food => {
        if (food.category) categoryNames.add(food.category);
    });

    const sortedNames = Array.from(categoryNames).sort();

    container.innerHTML = "";

    // All button
    const allButton = document.createElement("button");
    allButton.type = "button";
    allButton.className = "category-button" + (currentCategory === "all" ? " active" : "");
    allButton.dataset.category = "all";
    allButton.textContent = "All";
    container.appendChild(allButton);

    // Category buttons
    sortedNames.forEach(name => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "category-button" + (currentCategory === name ? " active" : "");
        button.dataset.category = name;
        button.textContent = name;
        container.appendChild(button);
    });

    // Add click events
    container.querySelectorAll(".category-button").forEach(button => {
        button.addEventListener("click", () => {
            currentCategory = button.dataset.category;
            container.querySelectorAll(".category-button").forEach(b => b.classList.remove("active"));
            button.classList.add("active");
            renderFoods();
        });
    });
}

/* ============================================================
   FILTER FOODS
   ============================================================ */

function getFilteredFoods() {
    return foods.filter(food => {
        // Check availability
        const available = food.available !== false;
        if (!available) return false;

        // Check category
        const category = String(food.category || "");
        const matchesCategory = currentCategory === "all" || category === currentCategory;

        // Check search
        const searchText = currentSearch.trim().toLowerCase();
        if (searchText) {
            const searchable = [food.name, food.description, food.category]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();
            if (!searchable.includes(searchText)) return false;
        }

        return matchesCategory;
    });
}

/* ============================================================
   RENDER FOODS
   ============================================================ */

function renderFoods() {
    const container = byId("foodGrid");
    const empty = byId("emptyMenu");
    
    if (!container) {
        console.error("❌ foodGrid not found");
        return;
    }

    // ✅ Ensure loading is hidden
    hideLoading();

    const filtered = getFilteredFoods();
    
    console.log("🔄 Rendering foods. Count:", filtered.length);

    if (!filtered.length) {
        container.innerHTML = "";
        if (empty) empty.hidden = false;
        return;
    }

    if (empty) empty.hidden = true;

    container.innerHTML = filtered.map(createFoodCard).join("");
    attachFoodCardEvents();
}

/* ============================================================
   FOOD CARD
   ============================================================ */

function createFoodCard(food) {
    const image = food.image || food.imageUrl || "";
    const name = food.name || "Unnamed Food";
    const description = food.description || "Freshly prepared with care.";
    const category = food.category || "Menu";
    const price = Number(food.price) || 0;

    return `
        <article class="food-card" data-food-id="${escapeHTML(food.id)}">
            <div class="food-card-image">
                ${image ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(name)}" loading="lazy">` : `<div class="food-card-placeholder"><i class="fa-solid fa-utensils"></i></div>`}
                <span class="food-card-category">${escapeHTML(category)}</span>
            </div>
            <div class="food-card-body">
                <h3>${escapeHTML(name)}</h3>
                <p>${escapeHTML(description)}</p>
                <div class="food-card-bottom">
                    <strong>${formatCurrency(price)}</strong>
                    <button type="button" class="food-card-button" data-id="${escapeHTML(food.id)}">
                        View <i class="fa-solid fa-arrow-right"></i>
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
    $$(".food-card").forEach(card => {
        card.addEventListener("click", event => {
            if (event.target.closest(".food-card-button")) return;
            openFoodModal(card.dataset.foodId);
        });
    });

    $$(".food-card-button").forEach(button => {
        button.addEventListener("click", event => {
            event.stopPropagation();
            openFoodModal(button.dataset.id);
        });
    });
}

/* ============================================================
   THEME
   ============================================================ */

function initializeTheme() {
    const savedTheme = localStorage.getItem("ri-eras-theme") || "light";
    setTheme(savedTheme);
}

function setTheme(theme) {
    const dark = theme === "dark";
    document.body.classList.toggle("dark-theme", dark);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    localStorage.setItem("ri-eras-theme", dark ? "dark" : "light");
    updateThemeUI(dark);
}

function toggleTheme() {
    const dark = !document.body.classList.contains("dark-theme");
    setTheme(dark ? "dark" : "light");
}

function updateThemeUI(dark) {
    const button = byId("themeToggle");
    if (button) {
        button.innerHTML = dark ? '<i class="fa-solid fa-sun"></i>' : '<i class="fa-solid fa-moon"></i>';
    }
}

byId("themeToggle")?.addEventListener("click", toggleTheme);

/* ============================================================
   NAVIGATION
   ============================================================ */

function setupNavigation() {
    $$(".nav-link").forEach(link => {
        link.addEventListener("click", () => {
            $$(".nav-link").forEach(item => item.classList.remove("active"));
            link.classList.add("active");
            closeMobileMenu();
        });
    });

    $$(".mobile-nav a").forEach(link => {
        link.addEventListener("click", closeMobileMenu);
    });
}

/* ============================================================
   MOBILE MENU
   ============================================================ */

function setupMobileMenu() {
    const button = byId("mobileMenuButton");
    if (!button) return;

    button.addEventListener("click", () => {
        const nav = byId("mobileNav");
        if (!nav) return;
        const opened = nav.classList.toggle("active");
        button.setAttribute("aria-expanded", opened);
        button.innerHTML = opened ? '<i class="fa-solid fa-xmark"></i>' : '<i class="fa-solid fa-bars"></i>';
    });
}

function closeMobileMenu() {
    const nav = byId("mobileNav");
    const button = byId("mobileMenuButton");
    nav?.classList.remove("active");
    if (button) {
        button.setAttribute("aria-expanded", "false");
        button.innerHTML = '<i class="fa-solid fa-bars"></i>';
    }
}

/* ============================================================
   FOOD MODAL
   ============================================================ */

function setupFoodModal() {
    byId("closeFoodModal")?.addEventListener("click", closeFoodModal);
    byId("decreaseQuantity")?.addEventListener("click", () => {
        if (selectedQuantity > 1) {
            selectedQuantity--;
            updateFoodQuantity();
        }
    });
    byId("increaseQuantity")?.addEventListener("click", () => {
        if (selectedQuantity < 99) {
            selectedQuantity++;
            updateFoodQuantity();
        }
    });
    byId("addToCartButton")?.addEventListener("click", addSelectedFoodToCart);
    byId("foodModal")?.addEventListener("click", event => {
        if (event.target.id === "foodModal") closeFoodModal();
    });
}

function openFoodModal(foodId) {
    const food = foods.find(item => item.id === foodId);
    if (!food) {
        showToast("Food unavailable", "This food could not be found.", "error");
        return;
    }

    selectedFood = food;
    selectedQuantity = 1;

    const image = food.image || food.imageUrl || "";
    const imageContainer = byId("foodModalImage");

    if (imageContainer) {
        imageContainer.innerHTML = image
            ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(food.name || "Food")}">`
            : `<div class="food-modal-placeholder"><i class="fa-solid fa-utensils"></i></div>`;
    }

    setText("foodModalCategory", food.category || "Menu");
    setText("foodModalName", food.name || "Unnamed Food");
    setText("foodModalDescription", food.description || "Freshly prepared with care.");
    setText("foodModalPrice", formatCurrency(food.price));
    updateFoodQuantity();

    const modal = byId("foodModal");
    if (!modal) return;

    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
}

function closeFoodModal() {
    const modal = byId("foodModal");
    if (!modal) return;
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    selectedFood = null;
}

function updateFoodQuantity() {
    setText("foodQuantity", selectedQuantity);
}

/* ============================================================
   CART
   ============================================================ */

function setupCart() {
    byId("cartButton")?.addEventListener("click", openCart);
    byId("closeCart")?.addEventListener("click", closeCart);
    byId("cartOverlay")?.addEventListener("click", closeCart);
    byId("checkoutButton")?.addEventListener("click", openCheckout);
    loadCart();
    updateCartUI();
}

function addSelectedFoodToCart() {
    if (!selectedFood) return;

    const existing = cart.find(item => item.id === selectedFood.id);

    if (existing) {
        existing.quantity += selectedQuantity;
    } else {
        cart.push({
            id: selectedFood.id,
            name: selectedFood.name || "Unnamed Food",
            price: Number(selectedFood.price) || 0,
            image: selectedFood.image || selectedFood.imageUrl || "",
            category: selectedFood.category || "",
            quantity: selectedQuantity
        });
    }

    saveCart();
    updateCartUI();
    closeFoodModal();
    openCart();

    showToast("Added to cart", `${selectedFood.name || "Food"} added to your order.`, "success");
}

function removeFromCart(foodId) {
    cart = cart.filter(item => item.id !== foodId);
    saveCart();
    updateCartUI();
}

function changeCartQuantity(foodId, change) {
    const item = cart.find(product => product.id === foodId);
    if (!item) return;

    item.quantity += change;

    if (item.quantity <= 0) {
        removeFromCart(foodId);
        return;
    }

    if (item.quantity > 99) item.quantity = 99;

    saveCart();
    updateCartUI();
}

function getCartTotal() {
    return cart.reduce((total, item) => total + (Number(item.price) * Number(item.quantity)), 0);
}

function getCartItemCount() {
    return cart.reduce((total, item) => total + Number(item.quantity), 0);
}

/* ============================================================
   CART UI
   ============================================================ */

function updateCartUI() {
    const container = byId("cartItems");
    const empty = byId("cartEmpty");
    const count = byId("cartCount");
    const total = byId("cartTotal");
    const checkoutButton = byId("checkoutButton");

    if (count) count.textContent = getCartItemCount();
    if (total) total.textContent = formatCurrency(getCartTotal());
    if (checkoutButton) checkoutButton.disabled = cart.length === 0;

    if (!container) return;

    if (!cart.length) {
        container.innerHTML = "";
        if (empty) empty.hidden = false;
        return;
    }

    if (empty) empty.hidden = true;
    container.innerHTML = cart.map(createCartItem).join("");
    attachCartEvents();
}

function createCartItem(item) {
    const image = item.image || "";

    return `
        <div class="cart-item" data-cart-id="${escapeHTML(item.id)}">
            <div class="cart-item-image">
                ${image ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(item.name)}">` : `<i class="fa-solid fa-utensils"></i>`}
            </div>
            <div class="cart-item-info">
                <h3>${escapeHTML(item.name)}</h3>
                <strong>${formatCurrency(item.price)}</strong>
                <div class="cart-item-controls">
                    <button type="button" class="cart-minus" data-id="${escapeHTML(item.id)}" aria-label="Decrease quantity">−</button>
                    <span>${item.quantity}</span>
                    <button type="button" class="cart-plus" data-id="${escapeHTML(item.id)}" aria-label="Increase quantity">+</button>
                </div>
            </div>
            <button type="button" class="cart-remove" data-id="${escapeHTML(item.id)}" aria-label="Remove ${escapeHTML(item.name)}">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
    `;
}

function attachCartEvents() {
    $$(".cart-minus").forEach(button => {
        button.addEventListener("click", () => changeCartQuantity(button.dataset.id, -1));
    });

    $$(".cart-plus").forEach(button => {
        button.addEventListener("click", () => changeCartQuantity(button.dataset.id, 1));
    });

    $$(".cart-remove").forEach(button => {
        button.addEventListener("click", () => removeFromCart(button.dataset.id));
    });
}

/* ============================================================
   CART STORAGE
   ============================================================ */

function loadCart() {
    try {
        const saved = localStorage.getItem("ri-eras-cart");
        if (!saved) return;
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) cart = parsed;
    } catch (error) {
        console.error("Cart loading error:", error);
        cart = [];
    }
}

function saveCart() {
    localStorage.setItem("ri-eras-cart", JSON.stringify(cart));
}

/* ============================================================
   OPEN / CLOSE CART
   ============================================================ */

function openCart() {
    const drawer = byId("cartDrawer");
    const overlay = byId("cartOverlay");
    if (!drawer) return;

    drawer.classList.add("active");
    overlay?.classList.add("active");
    document.body.classList.add("cart-open");
}

function closeCart() {
    const drawer = byId("cartDrawer");
    const overlay = byId("cartOverlay");

    drawer?.classList.remove("active");
    overlay?.classList.remove("active");
    document.body.classList.remove("cart-open");
}

/* ============================================================
   SEARCH
   ============================================================ */

function setupSearch() {
    const input = byId("foodSearch");
    if (!input) return;

    input.addEventListener("input", event => {
        currentSearch = event.target.value;
        renderFoods();
    });
}

/* ============================================================
   CHECKOUT
   ============================================================ */

function setupCheckout() {
    byId("closeCheckout")?.addEventListener("click", closeCheckout);
    byId("checkoutModal")?.addEventListener("click", event => {
        if (event.target.id === "checkoutModal") closeCheckout();
    });
    byId("checkoutForm")?.addEventListener("submit", handleCheckout);
}

function openCheckout() {
    if (!cart.length) {
        showToast("Your cart is empty", "Please add food before checking out.", "error");
        return;
    }

    setText("checkoutTotal", formatCurrency(getCartTotal()));
    closeCart();

    const modal = byId("checkoutModal");
    if (!modal) return;

    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
}

function closeCheckout() {
    const modal = byId("checkoutModal");
    if (!modal) return;
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
}

/* ============================================================
   PLACE ORDER
   ============================================================ */

async function handleCheckout(event) {
    event.preventDefault();

    if (!cart.length) {
        showToast("Your cart is empty", "Add something to your order first.", "error");
        return;
    }

    const name = byId("customerName")?.value.trim();
    const phone = byId("customerPhone")?.value.trim();
    const address = byId("customerAddress")?.value.trim();

    if (!name) {
        showToast("Name required", "Please enter your name.", "error");
        return;
    }

    if (!phone) {
        showToast("Phone required", "Please enter your phone number.", "error");
        return;
    }

    if (!address) {
        showToast("Address required", "Please enter your delivery address.", "error");
        return;
    }

    const placeOrderButton = byId("placeOrderButton");

    if (placeOrderButton) {
        placeOrderButton.disabled = true;
        placeOrderButton.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Placing Order...`;
    }

    try {
        const orderItems = cart.map(item => ({
            id: item.id,
            name: item.name,
            price: Number(item.price) || 0,
            quantity: Number(item.quantity) || 1,
            image: item.image || "",
            category: item.category || ""
        }));

        const total = getCartTotal();

        console.log("📝 Saving order:", {
            customerName: name,
            phone: phone,
            address: address,
            items: orderItems,
            total: total,
            status: "pending"
        });

        await addDoc(ordersRef, {
            customerName: name,
            phone: phone,
            address: address,
            items: orderItems,
            total: total,
            status: "pending",
            createdAt: serverTimestamp()
        });

        console.log("✅ Order saved successfully!");

        cart = [];
        saveCart();
        updateCartUI();
        byId("checkoutForm")?.reset();
        closeCheckout();

        showToast("Order placed successfully", "Thank you! Your order has been received.", "success");

    } catch (error) {
        console.error("❌ Order submission error:", error);
        showToast("Order failed", error.message || "We couldn't place your order. Please try again.", "error");
    } finally {
        if (placeOrderButton) {
            placeOrderButton.disabled = false;
            placeOrderButton.innerHTML = `Place Order <i class="fa-solid fa-check"></i>`;
        }
    }
}

/* ============================================================
   SCROLL NAVIGATION
   ============================================================ */

function setupScrollNavigation() {
    const sections = $$("main section[id]");
    if (!sections.length) return;

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const id = entry.target.id;
            $$(".nav-link").forEach(link => {
                link.classList.toggle("active", link.getAttribute("href") === `#${id}`);
            });
        });
    }, { threshold: 0.25 });

    sections.forEach(section => observer.observe(section));
}

/* ============================================================
   TOAST
   ============================================================ */

function showToast(title, message, type = "success") {
    const container = byId("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    const icon = type === "error" ? "fa-circle-exclamation" : type === "warning" ? "fa-triangle-exclamation" : "fa-circle-check";

    toast.innerHTML = `
        <div class="toast-icon"><i class="fa-solid ${icon}"></i></div>
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
        toast.classList.add("toast-hide");
        setTimeout(() => toast.remove(), 300);
    }, 4500);
}

/* ============================================================
   UTILITY FUNCTIONS
   ============================================================ */

function formatCurrency(value) {
    const amount = Number(value) || 0;
    return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 0
    }).format(amount);
}

function timestampValue(timestamp) {
    if (!timestamp) return 0;
    if (typeof timestamp.toMillis === "function") return timestamp.toMillis();
    if (timestamp.seconds) return Number(timestamp.seconds) * 1000;
    if (timestamp instanceof Date) return timestamp.getTime();
    return 0;
}

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function setText(id, value) {
    const element = byId(id);
    if (element) element.textContent = value ?? "";
}

/* ============================================================
   ESC KEY
   ============================================================ */

document.addEventListener("keydown", event => {
    if (event.key !== "Escape") return;
    closeFoodModal();
    closeCheckout();
    closeCart();
    closeMobileMenu();
});

console.log("✅ RI-ERA'S KITCHEN Customer website initialized.");