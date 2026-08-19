/* ============================================================
   RI-ERA'S KITCHEN - MAIN WEBSITE JAVASCRIPT
   LOCATION: Akwa-Ibom, Nigeria
   ============================================================ */

import { db } from "./firebase.js";
import {
    formatCurrency,
    escapeHTML,
    timestampValue,
    formatDateShort,
    truncateText,
    getFirebaseErrorMessage
} from "./utils.js";

import {
    collection,
    addDoc,
    onSnapshot,
    serverTimestamp,
    query,
    where
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

/* ============================================================
   FIRESTORE COLLECTIONS
   ============================================================ */

const foodsRef = collection(db, "foods");
const categoriesRef = collection(db, "categories");
const ordersRef = collection(db, "orders");
const blogRef = collection(db, "blog");

/* ============================================================
   STATE
   ============================================================ */

let foods = [];
let categories = [];
let blogPosts = [];
let cart = [];
let selectedFood = null;
let selectedQuantity = 1;
let currentCategory = "all";
let currentSearch = "";
let isLoading = true;
let blogLoading = true;

/* ============================================================
   DOM HELPERS
   ============================================================ */

const byId = (id) => document.getElementById(id);
const $ = (selector) => document.querySelector(selector);
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
    setupSearch();
    setupScrollNavigation();
    setupFAQ();
    loadCart();
    listenForFoods();
    listenForCategories();
    listenForBlogPosts();
    listenForFeaturedFoods();
    updateCartUI();
});

/* ============================================================
   NAVIGATION
   ============================================================ */

function setupNavigation() {
    // Highlight active page based on current URL
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    $$(".nav-link").forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPage) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

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
        button.innerHTML = opened
            ? '<i class="fa-solid fa-xmark"></i>'
            : '<i class="fa-solid fa-bars"></i>';
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
   FIRESTORE - FOODS
   ============================================================ */

function listenForFoods() {
    const q = query(foodsRef, where("available", "==", true));

    onSnapshot(q,
        snapshot => {
            foods = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            foods.sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt));
            
            // Check if both foods and categories are loaded
            checkAndRender();
            
            // Render featured foods on homepage
            const featuredContainer = byId("featuredGrid");
            if (featuredContainer) {
                renderFeaturedFoods();
            }
        },
        error => {
            console.error("Foods loading error:", error);
            hideLoading();
            showToast("Unable to load menu", "Please refresh the page and try again.", "error");
            
            // Show error in featured section too
            const featuredContainer = byId("featuredGrid");
            const loading = byId("featuredLoading");
            if (loading) {
                loading.style.display = "none";
                loading.hidden = true;
            }
            if (featuredContainer) {
                featuredContainer.innerHTML = `
                    <div class="empty-state" style="grid-column: 1 / -1; padding: 40px; text-align: center;">
                        <i class="fa-solid fa-circle-exclamation" style="font-size: 30px; color: var(--danger);"></i>
                        <p style="color: var(--text-muted); margin-top: 10px;">Unable to load menu. Please refresh the page.</p>
                    </div>
                `;
            }
        }
    );
}

/* ============================================================
   FIRESTORE - CATEGORIES
   ============================================================ */

function listenForCategories() {
    onSnapshot(categoriesRef,
        snapshot => {
            categories = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            // Check if both foods and categories are loaded
            checkAndRender();
        },
        error => {
            console.error("Categories loading error:", error);
            // Still try to render foods even if categories fail
            checkAndRender();
        }
    );
}

/* ============================================================
   CHECK AND RENDER (HANDLES LOADING STATE)
   ============================================================ */

function checkAndRender() {
    // Only render if we have foods (categories are optional)
    if (foods.length > 0 || !isLoading) {
        hideLoading();
        renderCategories();
        renderFoods();
    }
}

/* ============================================================
   HIDE LOADING SPINNER
   ============================================================ */

function hideLoading() {
    const loading = byId("menuLoading");
    if (loading) {
        loading.style.display = "none";
        loading.hidden = true;
    }
    isLoading = false;
}

/* ============================================================
   SHOW LOADING SPINNER
   ============================================================ */

function showLoading() {
    const loading = byId("menuLoading");
    if (loading) {
        loading.style.display = "flex";
        loading.hidden = false;
    }
    isLoading = true;
}

/* ============================================================
   RENDER CATEGORIES
   ============================================================ */

function renderCategories() {
    const container = byId("categories");
    if (!container) return;

    const categoryNames = [];

    categories.forEach(category => {
        const name = category.name || category.title || category.category;
        if (name && !categoryNames.includes(name)) {
            categoryNames.push(name);
        }
    });

    foods.forEach(food => {
        const name = food.category;
        if (name && !categoryNames.includes(name)) {
            categoryNames.push(name);
        }
    });

    categoryNames.sort((a, b) => String(a).localeCompare(String(b)));

    container.innerHTML = "";

    const allButton = document.createElement("button");
    allButton.type = "button";
    allButton.className = "category-button";
    allButton.dataset.category = "all";
    allButton.textContent = "All";
    if (currentCategory === "all") allButton.classList.add("active");
    container.appendChild(allButton);

    categoryNames.forEach(categoryName => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "category-button";
        button.dataset.category = String(categoryName);
        button.textContent = categoryName;
        if (currentCategory === String(categoryName)) button.classList.add("active");
        container.appendChild(button);
    });

    $$(".category-button").forEach(button => {
        button.addEventListener("click", () => {
            currentCategory = button.dataset.category;
            $$(".category-button").forEach(item => item.classList.remove("active"));
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
        const available = food.available !== false;
        if (!available) return false;

        const category = String(food.category || "");
        const searchText = currentSearch.trim().toLowerCase();

        const searchable = [food.name, food.description, food.category]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        const matchesCategory = currentCategory === "all" || category === String(currentCategory);
        const matchesSearch = !searchText || searchable.includes(searchText);

        return matchesCategory && matchesSearch;
    });
}

/* ============================================================
   RENDER FOODS
   ============================================================ */

function renderFoods() {
    const container = byId("foodGrid");
    const empty = byId("emptyMenu");

    if (!container) return;

    const filtered = getFilteredFoods();

    if (!filtered.length) {
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
                ${image
                    ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(name)}" loading="lazy">`
                    : `<div class="food-card-placeholder"><i class="fa-solid fa-utensils"></i></div>`
                }
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

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeFoodModal();
            closeCheckout();
            closeCart();
            closeMobileMenu();
            closeAllBlogDetails();
        }
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
        placeOrderButton.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin"></i>
            Placing Order...
        `;
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

        await addDoc(ordersRef, {
            customerName: name,
            phone: phone,
            address: address,
            items: orderItems,
            total: total,
            status: "pending",
            location: "Akwa-Ibom, Nigeria",
            createdAt: serverTimestamp()
        });

        cart = [];
        saveCart();
        updateCartUI();

        byId("checkoutForm")?.reset();
        closeCheckout();

        showToast("Order placed successfully", "Thank you! Your order has been received.", "success");

    } catch (error) {
        console.error("Order submission error:", error);
        showToast("Order failed", "We couldn't place your order. Please try again.", "error");

    } finally {
        if (placeOrderButton) {
            placeOrderButton.disabled = false;
            placeOrderButton.innerHTML = `
                Place Order
                <i class="fa-solid fa-check"></i>
            `;
        }
    }
}

/* ============================================================
   SCROLL NAVIGATION
   ============================================================ */

function setupScrollNavigation() {
    // Only run on pages with sections
    const sections = $$("main section[id]");
    if (!sections.length) return;

    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;

            const id = entry.target.id;

            $$(".nav-link").forEach(link => {
                const href = link.getAttribute('href');
                if (href && href.includes(`#${id}`)) {
                    link.classList.add('active');
                } else {
                    link.classList.remove('active');
                }
            });
        });
    }, { threshold: 0.25 });

    sections.forEach(section => observer.observe(section));
}

/* ============================================================
   FAQ ACCORDION
   ============================================================ */

function setupFAQ() {
    const faqItems = document.querySelectorAll('.faq-item');
    
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        if (!question) return;
        
        question.addEventListener('click', () => {
            const isActive = item.classList.contains('active');
            
            // Close all other items
            faqItems.forEach(other => {
                other.classList.remove('active');
                const otherQuestion = other.querySelector('.faq-question');
                if (otherQuestion) {
                    otherQuestion.setAttribute('aria-expanded', 'false');
                }
            });
            
            // Toggle current item
            if (!isActive) {
                item.classList.add('active');
                question.setAttribute('aria-expanded', 'true');
            }
        });
    });
}

/* ============================================================
   BLOG / NEWS (Homepage Preview)
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

function renderBlogPosts() {
    const container = byId("homeBlogGrid");
    const loading = byId("homeBlogLoading");

    if (!container) {
        // Not on homepage, skip
        return;
    }

    if (loading) {
        loading.style.display = "none";
        loading.hidden = true;
    }

    if (!blogPosts.length) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1; padding: 40px;">
                <i class="fa-solid fa-newspaper" style="font-size: 30px; color: var(--text-muted);"></i>
                <p style="color: var(--text-muted); margin-top: 10px;">No posts yet. Check back soon!</p>
            </div>
        `;
        return;
    }

    // Show only latest 3 posts on homepage
    const latestPosts = blogPosts.slice(0, 3);
    container.innerHTML = latestPosts.map(createBlogCard).join("");
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

function hideBlogLoading() {
    const loading = byId("homeBlogLoading");
    if (loading) {
        loading.style.display = "none";
        loading.hidden = true;
    }
}

/* ============================================================
   FEATURED FOODS (Homepage)
   ============================================================ */

function listenForFeaturedFoods() {
    const container = byId("featuredGrid");
    if (!container) {
        // Not on homepage, skip
        return;
    }

    // Initial render after a short delay to ensure foods are loaded
    setTimeout(() => {
        renderFeaturedFoods();
    }, 500);

    // Also re-render when foods change (the foods listener already handles this)
    // We'll use a setInterval to check periodically until foods are loaded
    let attempts = 0;
    const maxAttempts = 10;
    
    const checkAndRender = setInterval(() => {
        attempts++;
        if (foods.length > 0) {
            renderFeaturedFoods();
            clearInterval(checkAndRender);
        } else if (attempts >= maxAttempts) {
            // Show empty state after max attempts
            const container = byId("featuredGrid");
            const loading = byId("featuredLoading");
            
            if (loading) {
                loading.style.display = "none";
                loading.hidden = true;
            }
            
            if (container) {
                container.innerHTML = `
                    <div class="empty-state" style="grid-column: 1 / -1; padding: 40px; text-align: center;">
                        <i class="fa-solid fa-utensils" style="font-size: 30px; color: var(--text-muted);"></i>
                        <p style="color: var(--text-muted); margin-top: 10px;">No menu items available. Check back soon!</p>
                    </div>
                `;
            }
            clearInterval(checkAndRender);
        }
    }, 500);
}

function renderFeaturedFoods() {
    const container = byId("featuredGrid");
    const loading = byId("featuredLoading");

    if (!container) return;

    // Hide loading
    if (loading) {
        loading.style.display = "none";
        loading.hidden = true;
    }

    // Get available foods
    const availableFoods = foods.filter(food => food.available !== false);
    
    // Get 4 random foods or first 4
    const featured = availableFoods.length > 4 ? 
        [...availableFoods].sort(() => 0.5 - Math.random()).slice(0, 4) : 
        availableFoods.slice(0, 4);

    if (!featured.length) {
        container.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1; padding: 40px; text-align: center;">
                <i class="fa-solid fa-utensils" style="font-size: 30px; color: var(--text-muted);"></i>
                <p style="color: var(--text-muted); margin-top: 10px;">No menu items available. Check back soon!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = featured.map(createFeaturedCard).join("");
    
    // Attach click events to featured food cards
    container.querySelectorAll(".food-card").forEach(card => {
        card.addEventListener("click", (event) => {
            if (event.target.closest(".food-card-button")) return;
            const foodId = card.dataset.foodId;
            if (foodId) {
                // Find the food in the foods array
                const food = foods.find(item => item.id === foodId);
                if (food) {
                    openFoodModal(foodId);
                }
            }
        });
    });

    // Attach click events to featured food buttons
    container.querySelectorAll(".food-card-button").forEach(button => {
        button.addEventListener("click", (event) => {
            event.stopPropagation();
            const foodId = button.dataset.id;
            if (foodId) {
                openFoodModal(foodId);
            }
        });
    });
}

function createFeaturedCard(food) {
    const image = food.image || food.imageUrl || "";
    const name = food.name || "Unnamed Food";
    const description = food.description || "Freshly prepared with care.";
    const category = food.category || "Menu";
    const price = Number(food.price) || 0;

    return `
        <article class="food-card" data-food-id="${escapeHTML(food.id)}">
            <div class="food-card-image">
                ${image
                    ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(name)}" loading="lazy">`
                    : `<div class="food-card-placeholder"><i class="fa-solid fa-utensils"></i></div>`
                }
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
   CONTACT FORM
   ============================================================ */

function setupContactForm() {
    const form = byId("contactForm");
    if (!form) return;

    form.addEventListener("submit", handleContactForm);
}

async function handleContactForm(event) {
    event.preventDefault();

    const name = byId("contactName")?.value.trim();
    const email = byId("contactEmail")?.value.trim();
    const subject = byId("contactSubject")?.value.trim();
    const message = byId("contactMessage")?.value.trim();

    if (!name || !email || !subject || !message) {
        showToast("Please fill in all fields", "All fields are required.", "error");
        return;
    }

    const button = byId("contactSubmit");
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Sending...`;

    try {
        // Here you can send the message to Firestore or email
        // For now, just show success
        await new Promise(resolve => setTimeout(resolve, 1000));

        showToast("Message sent!", "We'll get back to you soon.", "success");
        form.reset();

    } catch (error) {
        console.error("Contact form error:", error);
        showToast("Failed to send message", "Please try again later.", "error");

    } finally {
        button.disabled = false;
        button.innerHTML = originalText;
    }
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
   CLOSE ALL BLOG DETAILS
   ============================================================ */

function closeAllBlogDetails() {
    const modals = document.querySelectorAll(".blog-detail-modal");
    modals.forEach(modal => {
        if (modal.parentNode) {
            modal.remove();
        }
    });
    document.body.classList.remove("modal-open");
}

/* ============================================================
   UTILITY FUNCTIONS
   ============================================================ */

function setText(id, value) {
    const element = byId(id);
    if (element) element.textContent = value ?? "";
}

function showElement(id) {
    const element = byId(id);
    if (element) {
        element.style.display = "block";
        element.hidden = false;
    }
}

function hideElement(id) {
    const element = byId(id);
    if (element) {
        element.style.display = "none";
        element.hidden = true;
    }
}

/* ============================================================
   CONSOLE
   ============================================================ */

console.log("RI-ERA'S KITCHEN — Akwa-Ibom, Nigeria");
console.log("Luxury meals, delivered with love.");
