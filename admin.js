/* ============================================================
   RI-ERA'S KITCHEN - ADMIN PANEL
   LOCATION: Akwa-Ibom, Nigeria
   ============================================================ */

import { db, auth } from "./firebase.js";
import {
    formatCurrency,
    escapeHTML,
    timestampValue,
    formatDate,
    formatDateShort,
    getFirebaseErrorMessage,
    truncateText
} from "./utils.js";
import {
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_UPLOAD_PRESET
} from "./cloudinary.js";

import {
    collection,
    doc,
    addDoc,
    getDoc,
    updateDoc,
    deleteDoc,
    onSnapshot,
    serverTimestamp,
    setDoc
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import {
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

/* ============================================================
   COLLECTIONS
   ============================================================ */

const foodsRef = collection(db, "foods");
const categoriesRef = collection(db, "categories");
const ordersRef = collection(db, "orders");
const settingsRef = collection(db, "settings");
const blogRef = collection(db, "blog");

/* ============================================================
   STATE
   ============================================================ */

let currentUser = null;
let foods = [];
let categories = [];
let orders = [];
let blogPosts = [];
let editingFoodId = null;
let foodImageUrl = "";
let foodBeingDeleted = null;
let editingBlogId = null;
let blogImageUrl = "";
let blogBeingDeleted = null;

/* ============================================================
   DOM HELPERS
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
    updateAdminInformation();
    setupNavigation();
    setupButtons();
    setupModalEvents();
    setupFilters();
    setupSettings();
    listenForFoods();
    listenForCategories();
    listenForOrders();
    listenForBlogPosts();
    await loadBusinessSettings();
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
        await signOut(auth);
        window.location.href = "login.html";
    } catch (error) {
        console.error(error);
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
        });
    });

    $$("[data-section-target]").forEach(button => {
        button.addEventListener("click", () => {
            const section = button.dataset.sectionTarget;
            switchSection(section);
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
        dashboard: { title: "Dashboard", subtitle: "Welcome back to your kitchen dashboard." },
        foods: { title: "Foods", subtitle: "Add and manage your kitchen menu." },
        categories: { title: "Categories", subtitle: "Manage your food categories." },
        blog: { title: "Blog Posts", subtitle: "Share news and updates with your customers." },
        orders: { title: "Orders", subtitle: "View and manage customer orders from Akwa-Ibom." },
        settings: { title: "Settings", subtitle: "Manage your website settings." }
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
        byId(id)?.addEventListener("click", () => openFoodModal());
    });

    byId("addCategoryBtn")?.addEventListener("click", () => openCategoryModal());
    byId("addBlogBtn")?.addEventListener("click", () => openBlogModal());
    byId("saveBusinessSettings")?.addEventListener("click", saveBusinessSettings);
}

/* ============================================================
   FOOD LISTENER
   ============================================================ */

function listenForFoods() {
    onSnapshot(foodsRef,
        snapshot => {
            foods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            foods.sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt));
            renderFoods();
            renderRecentFoods();
            updateFoodStats();
            populateCategoryFilters();
        },
        error => {
            console.error("Foods error:", error);
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
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-utensils"></i>
                <p>No foods found.</p>
            </div>
        `;
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
                ${image
                    ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(food.name || "Food")}" loading="lazy">`
                    : `<div class="food-image-placeholder"><i class="fa-solid fa-utensils"></i></div>`
                }
                <span class="food-availability ${available ? "" : "unavailable"}">
                    ${available ? "Available" : "Unavailable"}
                </span>
            </div>
            <div class="food-admin-body">
                <h3>${escapeHTML(food.name || "Unnamed Food")}</h3>
                <p class="food-admin-category">${escapeHTML(food.category || "Uncategorized")}</p>
                ${food.description ? `<p class="food-admin-description">${escapeHTML(food.description)}</p>` : ""}
                <div class="food-admin-price">${formatCurrency(food.price)}</div>
                <div class="food-admin-actions">
                    <button type="button" class="edit-food" data-id="${escapeHTML(food.id)}">
                        <i class="fa-solid fa-pen"></i> Edit
                    </button>
                    <button type="button" class="delete-food" data-id="${escapeHTML(food.id)}">
                        <i class="fa-solid fa-trash"></i> Delete
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
        button.addEventListener("click", () => openFoodModal(button.dataset.id));
    });

    $$(".delete-food").forEach(button => {
        button.addEventListener("click", () => openDeleteModal(button.dataset.id, "food"));
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
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-utensils"></i>
                <p>No foods added yet.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = recent.map(food => {
        const image = food.image || food.imageUrl || "";
        return `
            <div class="recent-food-item">
                <div class="recent-food-image">
                    ${image
                        ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(food.name || "Food")}">`
                        : `<i class="fa-solid fa-utensils"></i>`
                    }
                </div>
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
   BLOG LISTENER
   ============================================================ */

function listenForBlogPosts() {
    onSnapshot(blogRef,
        snapshot => {
            blogPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            blogPosts.sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt));
            renderBlogPosts();
        },
        error => {
            console.error("Blog error:", error);
            showToast("Blog error", "Unable to load blog posts.", "error");
        }
    );
}

/* ============================================================
   RENDER BLOG POSTS
   ============================================================ */

function renderBlogPosts() {
    const container = byId("blogAdminGrid");
    if (!container) return;

    if (!blogPosts.length) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-newspaper"></i>
                <p>No blog posts yet. Create your first post!</p>
            </div>
        `;
        return;
    }

    container.innerHTML = blogPosts.map(createBlogCard).join("");
    attachBlogCardEvents();
}

/* ============================================================
   BLOG CARD
   ============================================================ */

function createBlogCard(post) {
    const image = post.image || "";
    const isPublished = post.published !== false;
    const excerpt = post.excerpt || truncateText(post.content || "", 100);

    return `
        <article class="blog-admin-card" data-blog-id="${escapeHTML(post.id)}">
            <div class="blog-admin-image">
                ${image
                    ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(post.title || "Blog Post")}" loading="lazy">`
                    : `<div class="no-image"><i class="fa-solid fa-image"></i></div>`
                }
                <span class="blog-admin-status ${isPublished ? "" : "draft"}">
                    ${isPublished ? "Published" : "Draft"}
                </span>
            </div>
            <div class="blog-admin-body">
                <h3>${escapeHTML(post.title || "Untitled Post")}</h3>
                <p class="blog-admin-excerpt">${escapeHTML(excerpt)}</p>
                <p class="blog-admin-date">${formatDateShort(post.createdAt)}</p>
                <div class="blog-admin-actions">
                    <button type="button" class="edit-blog" data-id="${escapeHTML(post.id)}">
                        <i class="fa-solid fa-pen"></i> Edit
                    </button>
                    <button type="button" class="delete-blog" data-id="${escapeHTML(post.id)}">
                        <i class="fa-solid fa-trash"></i> Delete
                    </button>
                </div>
            </div>
        </article>
    `;
}

/* ============================================================
   BLOG CARD EVENTS
   ============================================================ */

function attachBlogCardEvents() {
    $$(".edit-blog").forEach(button => {
        button.addEventListener("click", () => openBlogModal(button.dataset.id));
    });

    $$(".delete-blog").forEach(button => {
        button.addEventListener("click", () => openDeleteModal(button.dataset.id, "blog"));
    });
}

/* ============================================================
   BLOG MODAL
   ============================================================ */

function openBlogModal(postId = null) {
    const modal = byId("blogModal");
    const form = byId("blogForm");

    if (!modal || !form) {
        console.error("Blog modal/form not found.");
        return;
    }

    editingBlogId = postId;
    form.reset();
    hideFormMessage("blogFormError");
    resetBlogUploadProgress();

    if (postId) {
        const post = blogPosts.find(item => item.id === postId);
        if (!post) return;

        byId("blogId").value = post.id;
        byId("blogTitle").value = post.title || "";
        byId("blogExcerpt").value = post.excerpt || "";
        byId("blogContent").value = post.content || "";
        byId("blogPublished").checked = post.published !== false;

        blogImageUrl = post.image || "";
        updateBlogImagePreview(blogImageUrl);

        byId("blogModalTitle").textContent = "Edit Blog Post";
        const subtitle = modal.querySelector(".modal-header p");
        if (subtitle) subtitle.textContent = "Update your blog post.";
    } else {
        byId("blogId").value = "";
        blogImageUrl = "";
        updateBlogImagePreview("");

        byId("blogModalTitle").textContent = "New Blog Post";
        const subtitle = modal.querySelector(".modal-header p");
        if (subtitle) subtitle.textContent = "Share news and updates with your customers.";
    }

    showModal(modal);
}

function closeBlogModal() {
    closeModal(byId("blogModal"));
    editingBlogId = null;
    blogImageUrl = "";
}

/* ============================================================
   BLOG IMAGE UPLOAD
   ============================================================ */

async function uploadBlogImage(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
        showBlogError("Please select an image file.");
        event.target.value = "";
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        showBlogError("Image is too large. Please choose an image below 10MB.");
        event.target.value = "";
        return;
    }

    resetBlogUploadProgress();
    showBlogUploadProgress();

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
                byId("blogProgressFill").style.width = `${percent}%`;
                byId("blogProgressText").textContent = `Uploading ${percent}%`;
            });

            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    resolve(JSON.parse(xhr.responseText));
                } else {
                    let message = "Cloudinary upload failed.";
                    try {
                        const result = JSON.parse(xhr.responseText);
                        message = result.error?.message || message;
                    } catch { /* ignore */ }
                    reject(new Error(message));
                }
            };

            xhr.onerror = () => {
                reject(new Error("Network error while uploading to Cloudinary."));
            };

            xhr.send(formData);
        });

        const result = await upload;
        blogImageUrl = result.secure_url;
        updateBlogImagePreview(blogImageUrl);

        byId("blogProgressFill").style.width = "100%";
        byId("blogProgressText").textContent = "Upload complete";

        showToast("Image uploaded", "Blog image uploaded successfully.", "success");

    } catch (error) {
        console.error("Cloudinary upload error:", error);
        showBlogError(error.message || "Image upload failed.");
        resetBlogUploadProgress();
    }
}

/* ============================================================
   BLOG IMAGE PREVIEW
   ============================================================ */

function updateBlogImagePreview(url) {
    const preview = byId("blogImagePreview");
    if (!preview) return;

    if (!url) {
        preview.innerHTML = `
            <div class="image-placeholder">
                <i class="fa-solid fa-image"></i>
                <span>Cover Image</span>
            </div>
        `;
        return;
    }

    preview.innerHTML = `<img src="${escapeHTML(url)}" alt="Blog cover preview">`;
}

/* ============================================================
   BLOG UPLOAD PROGRESS
   ============================================================ */

function showBlogUploadProgress() {
    const progress = byId("blogUploadProgress");
    if (!progress) return;
    progress.hidden = false;
    progress.style.display = "block";
}

function resetBlogUploadProgress() {
    const progress = byId("blogUploadProgress");
    const fill = byId("blogProgressFill");
    const text = byId("blogProgressText");

    if (fill) fill.style.width = "0%";
    if (text) text.textContent = "Uploading 0%";
    if (progress) {
        progress.hidden = true;
        progress.style.display = "none";
    }
}

/* ============================================================
   SAVE BLOG POST
   ============================================================ */

async function saveBlogPost(event) {
    event.preventDefault();
    hideFormMessage("blogFormError");

    const title = byId("blogTitle").value.trim();
    const excerpt = byId("blogExcerpt").value.trim();
    const content = byId("blogContent").value.trim();
    const published = byId("blogPublished").checked;

    if (!title) {
        showBlogError("Please enter a post title.");
        return;
    }

    if (!content) {
        showBlogError("Please enter the post content.");
        return;
    }

    const saveButton = byId("saveBlogBtn");
    const saveText = byId("saveBlogText");
    const saveLoader = byId("saveBlogLoader");

    setSavingState(saveButton, saveText, saveLoader, true);

    try {
        const data = {
            title,
            excerpt: excerpt || truncateText(content, 120),
            content,
            published,
            image: blogImageUrl || "",
            updatedAt: serverTimestamp()
        };

        if (editingBlogId) {
            await updateDoc(doc(db, "blog", editingBlogId), data);
            showToast("Post updated", `${title} has been updated.`, "success");
        } else {
            data.createdAt = serverTimestamp();
            data.createdBy = currentUser.uid;
            await addDoc(blogRef, data);
            showToast("Post published", `${title} has been published.`, "success");
        }

        closeBlogModal();

    } catch (error) {
        console.error("Save blog error:", error);
        showBlogError(getFirebaseErrorMessage(error));

    } finally {
        setSavingState(saveButton, saveText, saveLoader, false);
    }
}

/* ============================================================
   DELETE MODAL
   ============================================================ */

function openDeleteModal(id, type = "food") {
    let item, name, message;

    if (type === "food") {
        item = foods.find(f => f.id === id);
        if (!item) return;
        name = item.name || "this food";
        foodBeingDeleted = id;
        message = `Are you sure you want to delete "${name}"? This action cannot be undone.`;
    } else if (type === "blog") {
        item = blogPosts.find(p => p.id === id);
        if (!item) return;
        name = item.title || "this post";
        blogBeingDeleted = id;
        message = `Are you sure you want to delete "${name}"? This action cannot be undone.`;
    }

    byId("deleteMessage").textContent = message;
    byId("deleteModal").dataset.deleteType = type;
    showModal(byId("deleteModal"));
}

/* ============================================================
   CONFIRM DELETE
   ============================================================ */

async function confirmDelete() {
    const type = byId("deleteModal").dataset.deleteType || "food";
    const button = byId("confirmDeleteBtn");
    button.disabled = true;

    try {
        if (type === "food") {
            if (!foodBeingDeleted) return;
            await deleteDoc(doc(db, "foods", foodBeingDeleted));
            showToast("Food deleted", "The food item has been removed.", "success");
            foodBeingDeleted = null;
        } else if (type === "blog") {
            if (!blogBeingDeleted) return;
            await deleteDoc(doc(db, "blog", blogBeingDeleted));
            showToast("Post deleted", "The blog post has been removed.", "success");
            blogBeingDeleted = null;
        }

        closeModal(byId("deleteModal"));

    } catch (error) {
        console.error(error);
        showToast("Delete failed", getFirebaseErrorMessage(error), "error");

    } finally {
        button.disabled = false;
    }
}

/* ============================================================
   MODAL EVENTS
   ============================================================ */

function setupModalEvents() {
    $$("[data-close-modal]").forEach(element => {
        element.addEventListener("click", () => {
            const modal = element.closest(".modal");
            closeModal(modal);
        });
    });

    byId("confirmDeleteBtn")?.addEventListener("click", confirmDelete);
    byId("foodForm")?.addEventListener("submit", saveFood);
    byId("categoryForm")?.addEventListener("submit", saveCategory);
    byId("blogForm")?.addEventListener("submit", saveBlogPost);
    byId("foodImage")?.addEventListener("change", uploadFoodImage);
    byId("blogImage")?.addEventListener("change", uploadBlogImage);

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            $$(".modal").forEach(modal => closeModal(modal));
            closeSidebar();
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
   CLOUDINARY FOOD IMAGE UPLOAD
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
                    } catch { /* ignore */ }
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
   FOOD IMAGE PREVIEW
   ============================================================ */

function updateFoodImagePreview(url) {
    const preview = byId("foodImagePreview");
    if (!preview) return;

    if (!url) {
        preview.innerHTML = `
            <div class="image-placeholder">
                <i class="fa-solid fa-image"></i>
                <span>Food Image</span>
            </div>
        `;
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
    onSnapshot(categoriesRef,
        snapshot => {
            categories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            categories.sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
            populateCategorySelect();
            populateCategoryFilters();
            renderCategories();
        },
        error => {
            console.error("Categories error:", error);
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
        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-layer-group"></i>
                <p>No categories yet.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = categories.map(category => {
        const foodCount = foods.filter(food => food.category === category.name).length;
        return `
            <div class="category-card" data-category-id="${escapeHTML(category.id)}">
                <div class="category-icon">
                    <i class="fa-solid fa-utensils"></i>
                </div>
                <div class="category-info">
                    <strong>${escapeHTML(category.name)}</strong>
                    <span>${foodCount} ${foodCount === 1 ? "food" : "foods"}</span>
                </div>
                <button type="button" class="category-delete" data-id="${escapeHTML(category.id)}">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
    }).join("");

    $$(".category-delete").forEach(button => {
        button.addEventListener("click", () => deleteCategory(button.dataset.id));
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

    const exists = categories.some(category =>
        String(category.name).toLowerCase() === name.toLowerCase()
    );

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
        showToast("Cannot delete category",
            `${category.name} is being used by ${usedBy.length} food item(s).`,
            "error"
        );
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
   FOOD FILTERS
   ============================================================ */

function setupFilters() {
    byId("foodSearch")?.addEventListener("input", () => renderFoods());
    byId("categoryFilter")?.addEventListener("change", () => renderFoods());
    byId("availabilityFilter")?.addEventListener("change", () => renderFoods());
    byId("orderSearch")?.addEventListener("input", () => renderOrders());
    byId("orderStatusFilter")?.addEventListener("change", () => renderOrders());
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
    onSnapshot(ordersRef,
        snapshot => {
            orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            orders.sort((a, b) => timestampValue(b.createdAt) - timestampValue(a.createdAt));
            updateOrderStats();
            renderOrders();
        },
        error => {
            console.error("Orders error:", error);
            showToast("Orders error", "Unable to load orders.", "error");
        }
    );
}

/* ============================================================
   ORDER STATISTICS
   ============================================================ */

function updateOrderStats() {
    const pending = orders.filter(order => (order.status || "pending") === "pending").length;

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
    if (!tbody) return;

    const search = (byId("orderSearch")?.value || "").trim().toLowerCase();
    const status = byId("orderStatusFilter")?.value || "all";

    const filtered = orders.filter(order => {
        const customer = String(order.customerName || order.name || "").toLowerCase();
        const phone = String(order.phone || order.customerPhone || "").toLowerCase();
        const orderNumber = String(order.orderNumber || order.id).toLowerCase();

        const matchesSearch = !search ||
            customer.includes(search) ||
            phone.includes(search) ||
            orderNumber.includes(search);

        const matchesStatus = status === "all" || (order.status || "pending") === status;

        return matchesSearch && matchesStatus;
    });

    if (!filtered.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="table-empty">
                    <i class="fa-solid fa-bag-shopping"></i>
                    <p>No orders found.</p>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(createOrderRow).join("");

    $$(".view-order").forEach(button => {
        button.addEventListener("click", () => openOrderModal(button.dataset.id));
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
                    <i class="fa-solid fa-eye"></i>
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
                <div class="customer-detail">
                    <span>Location</span>
                    <strong>Akwa-Ibom, Nigeria</strong>
                </div>
            </div>
            <div class="order-items">
                <h4>Items</h4>
                ${items.length
                    ? items.map(item => {
                        const quantity = Number(item.quantity) || 1;
                        const price = Number(item.price) || 0;
                        return `
                            <div class="order-item">
                                <div>
                                    <strong>${escapeHTML(item.name || "Food")}</strong>
                                    <span>Qty: ${quantity}</span>
                                </div>
                                <strong>${formatCurrency(price * quantity)}</strong>
                            </div>
                        `;
                    }).join("")
                    : `<p>No item details available.</p>`
                }
            </div>
            <div class="order-total">
                <span>Total</span>
                <strong>${formatCurrency(order.total || order.totalAmount || 0)}</strong>
            </div>
            <div class="form-group">
                <label for="orderStatusUpdate">Order Status</label>
                <select id="orderStatusUpdate">
                    ${["pending", "confirmed", "preparing", "completed", "cancelled"].map(s =>
                        `<option value="${s}" ${status === s ? "selected" : ""}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
                    ).join("")}
                </select>
            </div>
            <div class="modal-actions">
                <button type="button" class="primary-button" id="saveOrderStatus">Save Status</button>
            </div>
        </div>
    `;

    showModal(modal);

    byId("saveOrderStatus")?.addEventListener("click", () => saveOrderStatus(id));
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
    }
}

/* ============================================================
   SETTINGS
   ============================================================ */

function setupSettings() {
    // Settings are handled in the load/save functions below
}

/* ============================================================
   LOAD BUSINESS SETTINGS
   ============================================================ */

async function loadBusinessSettings() {
    try {
        const docRef = doc(db, "settings", "business");
        const snapshot = await getDoc(docRef);

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
            location: "Akwa-Ibom, Nigeria",
            updatedAt: serverTimestamp()
        };

        const docRef = doc(db, "settings", "business");
        await setDoc(docRef, data, { merge: true });

        showToast("Settings saved", "Business information has been saved.", "success");

    } catch (error) {
        console.error(error);
        showToast("Save failed", getFirebaseErrorMessage(error), "error");

    } finally {
        button.disabled = false;
        button.innerHTML = original;
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
   FORM ERRORS
   ============================================================ */

function showFoodError(message) {
    showFormMessage("foodFormError", message);
}

function showCategoryError(message) {
    showFormMessage("categoryFormError", message);
}

function showBlogError(message) {
    showFormMessage("blogFormError", message);
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
   UTILITY
   ============================================================ */

function setText(id, value) {
    const element = byId(id);
    if (element) element.textContent = value;
}

/* ============================================================
   INITIAL CONSOLE
   ============================================================ */

console.log("RI-ERA'S KITCHEN Admin — Akwa-Ibom, Nigeria");
console.log("Luxury meals management dashboard.");