/* ============================================================
   SHARED UTILITY FUNCTIONS
   ============================================================ */

export function formatCurrency(value) {
    const amount = Number(value) || 0;
    return new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 0
    }).format(amount);
}

export function timestampValue(timestamp) {
    if (!timestamp) return 0;
    if (typeof timestamp.toMillis === "function") {
        return timestamp.toMillis();
    }
    if (timestamp.seconds) {
        return Number(timestamp.seconds) * 1000;
    }
    if (timestamp instanceof Date) {
        return timestamp.getTime();
    }
    if (typeof timestamp === "string") {
        return new Date(timestamp).getTime() || 0;
    }
    if (typeof timestamp === "number") {
        return timestamp;
    }
    return 0;
}

export function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export function formatDate(value) {
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

export function formatDateShort(value) {
    const time = timestampValue(value);
    if (!time) return "—";
    return new Intl.DateTimeFormat("en-NG", {
        day: "numeric",
        month: "short",
        year: "numeric"
    }).format(new Date(time));
}

export function getFirebaseErrorMessage(error) {
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

export function truncateText(text, maxLength = 10000) {
    if (!text) return "";
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
}