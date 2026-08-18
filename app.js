import { db } from "./firebase.js";

import {
    collection,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";


// ========================================
// SETTINGS
// ========================================

// CHANGE THIS TO RI-ERA'S REAL WHATSAPP NUMBER
// Format: country code + number, without +
// Example: 2348012345678

const WHATSAPP_NUMBER = "2340000000000";


let foods = [];
let selectedFood = null;
let selectedQuantity = 1;
let currentCategory = "all";


// ========================================
// DOM
// ========================================

const menuGrid =
    document.getElementById("menuGrid");

const categoryFilters =
    document.getElementById("categoryFilters");

const orderModal =
    document.getElementById("orderModal");

const orderForm =
    document.getElementById("orderForm");

const themeToggle =
    document.getElementById("themeToggle");

const siteLogo =
    document.getElementById("siteLogo");

const footerLogo =
    document.getElementById("footerLogo");


// ========================================
// LOAD MENU
// ========================================

async function loadMenu() {

    try {

        const foodsQuery = query(
            collection(db, "foods"),
            where("available", "==", true)
        );

        const snapshot =
            await getDocs(foodsQuery);


        foods = snapshot.docs.map(doc => ({

            id: doc.id,

            ...doc.data()

        }));


        createCategories();

        displayFoods();

    } catch (error) {

        console.error(
            "Could not load menu:",
            error
        );

        menuGrid.innerHTML = `
            <div class="menu-error">
                <p>
                    We're unable to load our menu right now.
                </p>

                <button onclick="location.reload()">
                    Try Again
                </button>
            </div>
        `;

    }

}


// ========================================
// CATEGORIES
// ========================================

function createCategories() {

    const categories =
        [...new Set(
            foods
                .map(food => food.category)
                .filter(Boolean)
        )];


    categoryFilters.innerHTML = `

        <button
            class="category-button active"
            data-category="all"
        >
            All
        </button>

        ${categories.map(category => `

            <button
                class="category-button"
                data-category="${escapeHtml(category)}"
            >
                ${escapeHtml(category)}
            </button>

        `).join("")}

    `;


    document
        .querySelectorAll(".category-button")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    document
                        .querySelectorAll(".category-button")
                        .forEach(btn =>
                            btn.classList.remove("active")
                        );


                    button.classList.add("active");


                    currentCategory =
                        button.dataset.category;


                    displayFoods();

                }
            );

        });

}


// ========================================
// DISPLAY FOODS
// ========================================

function displayFoods() {

    const filteredFoods =
        currentCategory === "all"

            ? foods

            : foods.filter(
                food =>
                    food.category === currentCategory
            );


    if (!filteredFoods.length) {

        menuGrid.innerHTML = `

            <div class="menu-empty">

                <span>🍽️</span>

                <p>
                    No meals available in this category.
                </p>

            </div>

        `;

        return;

    }


    menuGrid.innerHTML =
        filteredFoods.map(createFoodCard).join("");


    document
        .querySelectorAll(".food-order-button")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    openOrderModal(
                        button.dataset.id
                    );

                }
            );

        });

}


// ========================================
// FOOD CARD
// ========================================

function createFoodCard(food) {

    const price =
        Number(food.price || 0);


    const image =
        food.imageUrl ||
        food.image ||
        "";


    return `

        <article class="food-card">

            <div class="food-image">

                ${
                    image

                    ? `
                        <img
                            src="${escapeHtml(image)}"
                            alt="${escapeHtml(food.name || "Food")}"
                            loading="lazy"
                        >
                    `

                    : `
                        <div class="food-image-placeholder">
                            🍽️
                        </div>
                    `
                }

            </div>


            <div class="food-info">

                ${
                    food.category

                    ? `
                        <span class="food-category">
                            ${escapeHtml(food.category)}
                        </span>
                    `

                    : ""
                }


                <h3>
                    ${escapeHtml(food.name || "Unnamed Meal")}
                </h3>


                ${
                    food.description

                    ? `
                        <p>
                            ${escapeHtml(food.description)}
                        </p>
                    `

                    : ""
                }


                <div class="food-bottom">

                    <strong>
                        ₦${price.toLocaleString()}
                    </strong>


                    <button
                        class="food-order-button"
                        data-id="${food.id}"
                    >
                        Order
                    </button>

                </div>

            </div>

        </article>

    `;

}


// ========================================
// ORDER MODAL
// ========================================

function openOrderModal(foodId) {

    selectedFood =
        foods.find(food => food.id === foodId);


    if (!selectedFood) return;


    selectedQuantity = 1;


    document.getElementById(
        "selectedFoodId"
    ).value = selectedFood.id;


    document.getElementById(
        "selectedFoodName"
    ).textContent = selectedFood.name;


    document.getElementById(
        "selectedFoodPrice"
    ).textContent =
        `₦${Number(selectedFood.price || 0).toLocaleString()}`;


    updateQuantity();


    orderModal.classList.add("show");

    orderModal.setAttribute(
        "aria-hidden",
        "false"
    );


    document.body.classList.add("modal-open");

}


// ========================================
// CLOSE MODAL
// ========================================

function closeOrderModal() {

    orderModal.classList.remove("show");

    orderModal.setAttribute(
        "aria-hidden",
        "true"
    );

    document.body.classList.remove(
        "modal-open"
    );

}


document
    .getElementById("closeOrderModal")
    .addEventListener(
        "click",
        closeOrderModal
    );


document
    .querySelector(".modal-overlay")
    .addEventListener(
        "click",
        closeOrderModal
    );


// ========================================
// QUANTITY
// ========================================

document
    .getElementById("increaseQuantity")
    .addEventListener(
        "click",
        () => {

            selectedQuantity++;

            updateQuantity();

        }
    );


document
    .getElementById("decreaseQuantity")
    .addEventListener(
        "click",
        () => {

            if (selectedQuantity > 1) {

                selectedQuantity--;

                updateQuantity();

            }

        }
    );


function updateQuantity() {

    document.getElementById(
        "quantity"
    ).textContent = selectedQuantity;


    const total =
        Number(selectedFood?.price || 0)
        * selectedQuantity;


    document.getElementById(
        "orderTotal"
    ).textContent =
        `₦${total.toLocaleString()}`;

}


// ========================================
// WHATSAPP ORDER
// ========================================

orderForm.addEventListener(
    "submit",
    event => {

        event.preventDefault();


        if (!selectedFood) return;


        const address =
            document
                .getElementById("deliveryAddress")
                .value.trim();


        const phone =
            document
                .getElementById("customerPhone")
                .value.trim();


        const note =
            document
                .getElementById("orderNote")
                .value.trim();


        const price =
            Number(selectedFood.price || 0);


        const total =
            price * selectedQuantity;


        let message =

`Hello RI-ERA'S KITCHEN 👋

I would like to place an order.

🍽️ *Order*
${selectedFood.name}

📦 Quantity:
${selectedQuantity}

💰 Price:
₦${price.toLocaleString()}

💵 Estimated Total:
₦${total.toLocaleString()}

📍 Delivery Address:
${address}

📞 Phone:
${phone}`;


        if (note) {

            message += `

📝 Extra Instructions:
${note}`;

        }


        message += `

Please confirm my order. Thank you! ❤️`;


        const whatsappUrl =
            `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;


        window.open(
            whatsappUrl,
            "_blank"
        );


        closeOrderModal();

    }
);


// ========================================
// THEME
// ========================================

const savedTheme =
    localStorage.getItem(
        "riEraCustomerTheme"
    ) || "light";


setTheme(savedTheme);


themeToggle.addEventListener(
    "click",
    () => {

        const current =
            document.body.dataset.theme;


        const newTheme =
            current === "light"
                ? "dark"
                : "light";


        setTheme(newTheme);

    }
);


function setTheme(theme) {

    document.body.dataset.theme =
        theme;


    localStorage.setItem(
        "riEraCustomerTheme",
        theme
    );


    if (theme === "dark") {

        themeToggle.textContent = "☀️";

        siteLogo.src = "logo-dark.png";

        footerLogo.src = "logo-dark.png";

    } else {

        themeToggle.textContent = "🌙";

        siteLogo.src = "logo-light.png";

        footerLogo.src = "logo-light.png";

    }

}


// ========================================
// MOBILE MENU
// ========================================

const mobileMenuButton =
    document.getElementById(
        "mobileMenuButton"
    );


const mobileMenu =
    document.getElementById(
        "mobileMenu"
    );


mobileMenuButton.addEventListener(
    "click",
    () => {

        mobileMenu.classList.toggle(
            "show"
        );

    }
);


mobileMenu
    .querySelectorAll("a")
    .forEach(link => {

        link.addEventListener(
            "click",
            () => {

                mobileMenu.classList.remove(
                    "show"
                );

            }
        );

    });


// ========================================
// HELPERS
// ========================================

function escapeHtml(value) {

    return String(value)

        .replaceAll("&", "&amp;")

        .replaceAll("<", "&lt;")

        .replaceAll(">", "&gt;")

        .replaceAll('"', "&quot;")

        .replaceAll("'", "&#039;");

}


// ========================================
// START
// ========================================

loadMenu();