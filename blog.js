/* ============================================================
   RI-ERA'S KITCHEN - BLOG LISTING
   LOCATION: Akwa-Ibom, Nigeria
   ============================================================ */

import { db } from "./firebase.js";
import {
    escapeHTML,
    timestampValue,
    formatDateShort,
    truncateText,
    getFirebaseErrorMessage
} from "./utils.js";

import {
    collection,
    onSnapshot,
    query,
    where
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

/* ============================================================
   FIRESTORE COLLECTIONS
   ============================================================ */

const blogRef = collection(db, "blog");

/* ============================================================
   STATE
   ============================================================ */

let blogPosts = [];
let blogLoading = true;

/* ============================================================
   DOM HELPERS
   ============================================================ */

const byId = (id) => document.getElementById(id);
const $$ = (selector) => document.querySelectorAll(selector);

/* ============================================================
   INITIALIZATION
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {
    setupNavigation();
    setupMobileMenu();
    setupCart();
    setupFoodModal();
    setupCheckout();
    loadCart();
    listenForBlogPosts();
    updateCartUI();
});

/* ============================================================
   NAVIGATION
   ============================================================ */

function setupNavigation() {
    // Navigation links are static - no need for active state management
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
        button.innerHTML = opened
            ? '<i class="fa-solid fa-xmark"></i>'
            : '<i class="fa-solid fa-bars"></i>';
    });
}

/* ============================================================
   FIRESTORE - BLOG POSTS
   ============================================================ */

function listenForBlogPosts() {
    const q = query(blogRef, where("published", "==", true));

    onSnapshot(q,
        snapshot => {
            blogPosts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            blogPosts.sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt));
            blogLoading = false;
            renderBlogPosts();
        },
        error => {
            console.error("Blog loading error:", error);
            blogLoading = false;
            hideBlogLoading();
            showToast("Unable to load news", "Please refresh the page and try again.", "error");
        }
    );
}

/* ============================================================
   RENDER BLOG POSTS
   ============================================================ */

function renderBlogPosts() {
    const container = byId("blogGrid");
    const empty = byId("blogEmpty");
    const loading = byId("blogLoading");

    if (loading) {
        loading.style.display = "none";
        loading.hidden = true;
    }

    if (!container) return;

    if (!blogPosts.length) {
        container.innerHTML = "";
        if (empty) {
            empty.style.display = "block";
            empty.hidden = false;
        }
        return;
    }

    if (empty) {
        empty.style.display = "none";
        empty.hidden = true;
    }

    container.innerHTML = blogPosts.map(createBlogCard).join("");
    attachBlogCardEvents();
}

function hideBlogLoading() {
    const loading = byId("blogLoading");
    if (loading) {
        loading.style.display = "none";
        loading.hidden = true;
    }
}

function createBlogCard(post) {
    const image = post.image || "";
    const excerpt = post.excerpt || truncateText(post.content || "", 120);

    return `
        <article class="blog-card" data-blog-id="${escapeHTML(post.id)}">
            <div class="blog-card-image">
                ${image
                    ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(post.title || "Blog Post")}" loading="lazy">`
                    : `<div class="no-image"><i class="fa-solid fa-newspaper"></i></div>`
                }
            </div>
            <div class="blog-card-body">
                <span class="blog-date">${formatDateShort(post.createdAt)}</span>
                <h3>${escapeHTML(post.title || "Untitled")}</h3>
                <p>${escapeHTML(excerpt)}</p>
                <a href="blog-post.html?id=${escapeHTML(post.id)}" class="blog-read-more">
                    Read More <i class="fa-solid fa-arrow-right"></i>
                </a>
            </div>
        </article>
    `;
}

function attachBlogCardEvents() {
    // Events are handled by the anchor links
}

/* ============================================================
   CART FUNCTIONS (Shared with other pages)
   ============================================================ */

let cart = [];

function loadCart() {
    try {
        const saved = localStorage.getItem("ri-eras-cart");
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed)) cart = parsed;
        }
    } catch (error) {
        console.error("Cart loading error:", error);
        cart = [];
    }
}

function saveCart() {
    localStorage.setItem("ri-eras-cart", JSON.stringify(cart));
}

function getCartItemCount() {
    return cart.reduce((total, item) => total + Number(item.quantity), 0);
}

function getCartTotal() {
    return cart.reduce((total, item) => total + (Number(item.price) * Number(item.quantity)), 0);
}

function updateCartUI() {
    const count = byId("cartCount");
    const total = byId("cartTotal");
    const checkoutButton = byId("checkoutButton");

    if (count) count.textContent = getCartItemCount();
    if (total) total.textContent = new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 0
    }).format(getCartTotal());
    if (checkoutButton) checkoutButton.disabled = cart.length === 0;
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

function openCart() {
    const drawer = byId("cartDrawer");
    const overlay = byId("cartOverlay");
    if (!drawer) return;

    drawer.classList.add("active");
    overlay?.classList.add("active");
    document.body.classList.add("cart-open");
    
    renderCartItems();
}

function closeCart() {
    const drawer = byId("cartDrawer");
    const overlay = byId("cartOverlay");

    drawer?.classList.remove("active");
    overlay?.classList.remove("active");
    document.body.classList.remove("cart-open");
}

function renderCartItems() {
    const container = byId("cartItems");
    const empty = byId("cartEmpty");

    if (!container) return;

    if (!cart.length) {
        container.innerHTML = "";
        if (empty) {
            empty.style.display = "flex";
            empty.hidden = false;
        }
        return;
    }

    if (empty) {
        empty.style.display = "none";
        empty.hidden = true;
    }

    container.innerHTML = cart.map(createCartItem).join("");
    attachCartEvents();
}

function createCartItem(item) {
    const image = item.image || "";

    return `
        <div class="cart-item" data-cart-id="${escapeHTML(item.id)}">
            <div class="cart-item-image">
                ${image
                    ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(item.name)}">`
                    : `<i class="fa-solid fa-utensils"></i>`
                }
            </div>
            <div class="cart-item-info">
                <h3>${escapeHTML(item.name)}</h3>
                <strong>${new Intl.NumberFormat("en-NG", {
                    style: "currency",
                    currency: "NGN",
                    maximumFractionDigits: 0
                }).format(item.price)}</strong>
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
   CART SETUP
   ============================================================ */

function setupCart() {
    byId("cartButton")?.addEventListener("click", openCart);
    byId("closeCart")?.addEventListener("click", closeCart);
    byId("cartOverlay")?.addEventListener("click", closeCart);
    byId("checkoutButton")?.addEventListener("click", () => {
        window.location.href = "index.html#checkout";
    });
}

/* ============================================================
   FOOD MODAL (Shared with other pages)
   ============================================================ */

function setupFoodModal() {
    // Food modal is not used on blog page
    byId("closeFoodModal")?.addEventListener("click", closeFoodModal);
    byId("foodModal")?.addEventListener("click", event => {
        if (event.target.id === "foodModal") closeFoodModal();
    });
}

function closeFoodModal() {
    const modal = byId("foodModal");
    if (!modal) return;
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
}

function openFoodModal() {
    // Not used on blog page
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

function closeCheckout() {
    const modal = byId("checkoutModal");
    if (!modal) return;
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
}

async function handleCheckout(event) {
    event.preventDefault();
    showToast("Coming Soon", "Checkout is available on the homepage.", "info");
}

/* ============================================================
   TOAST
   ============================================================ */

function showToast(title, message, type = "success") {
    const container = byId("toastContainer");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    const icon = type === "error"
        ? "fa-circle-exclamation"
        : type === "warning"
            ? "fa-triangle-exclamation"
            : type === "info"
                ? "fa-circle-info"
                : "fa-circle-check";

    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fa-solid ${icon}"></i>
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

    toast.querySelector(".toast-close")?.addEventListener("click", () => {
        toast.remove();
    });

    setTimeout(() => {
        toast.classList.add("toast-hide");
        setTimeout(() => toast.remove(), 300);
    }, 4500);
}

/* ============================================================
   CONSOLE
   ============================================================ */

console.log("RI-ERA'S KITCHEN Blog — Akwa-Ibom, Nigeria");
console.log("Stay updated with our latest news.");