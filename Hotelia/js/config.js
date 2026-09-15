/* ==========================================================================
   HOTELIA - API CONFIG, AUTH STORAGE & ROUTE GUARDS
   ========================================================================== */

const API_BASE_URL = 'http://localhost:5086';
const AUTH_STORAGE_KEY = 'hoteliaAuth';
const THEME_STORAGE_KEY = 'hoteliaTheme';

/* ════════════════════════════════════════
   THEME MANAGEMENT
   ════════════════════════════════════════ */
const THEMES = {
    default: { label: 'Purple',    icon: '💜', value: 'default' },
    ocean:   { label: 'Ocean Blue',    icon: '💙', value: 'ocean'   },
    forest:  { label: 'Forest Green',  icon: '💚', value: 'forest'  },
    rose:    { label: 'Rose Gold',     icon: '🌸', value: 'rose'    },
    slate:   { label: 'Slate Dark',    icon: '🌑', value: 'slate'   },
    sunset:  { label: 'Sunset Orange', icon: '🧡', value: 'sunset'  },
};

function applyTheme(themeName) {
    const valid = THEMES[themeName] ? themeName : 'default';
    if (valid === 'default') {
        document.body.removeAttribute('data-theme');
    } else {
        document.body.setAttribute('data-theme', valid);
    }
}

function saveTheme(themeName) {
    localStorage.setItem(THEME_STORAGE_KEY, themeName);
    applyTheme(themeName);
}

function getSavedTheme() {
    return localStorage.getItem(THEME_STORAGE_KEY) || 'default';
}

(function initTheme() {
    const apply = () => applyTheme(getSavedTheme());
    if (document.body) { apply(); }
    else { document.addEventListener('DOMContentLoaded', apply); }
})();

/* ════════════════════════════════════════
   AUTH STORAGE
   ════════════════════════════════════════ */
function saveAuth(data, remember) {
    const userId = data.userId ?? getUserIdFromToken(data.token);
    const payload = JSON.stringify({
        token:     data.token,
        userId:    userId,
        email:     data.email,
        name:      data.name,
        role:      data.role,
        expiresAt: data.expiresAt,
        createdAt: data.createdAt
    });
    localStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
    if (remember) { localStorage.setItem(AUTH_STORAGE_KEY, payload); }
    else          { sessionStorage.setItem(AUTH_STORAGE_KEY, payload); }
}

function getAuth() {
    const raw = sessionStorage.getItem(AUTH_STORAGE_KEY) || localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    try {
        const data = JSON.parse(raw);
        if (data.expiresAt && new Date(data.expiresAt) <= new Date()) {
            clearAuth();
            return null;
        }
        if (data.userId == null && data.token) {
            data.userId = getUserIdFromToken(data.token);
        }
        return data;
    } catch {
        clearAuth();
        return null;
    }
}

function clearAuth() {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_STORAGE_KEY);
}

/** Resolve logged-in user id from stored auth (supports sessions saved before userId was added). */
function getUserIdFromAuth(auth) {
    if (!auth) return null;
    if (auth.userId != null && auth.userId !== '') {
        const id = parseInt(auth.userId, 10);
        return Number.isNaN(id) ? null : id;
    }
    return getUserIdFromToken(auth.token);
}

function getUserIdFromToken(token) {
    if (!token) return null;
    try {
        const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        const raw = payload.sub
            ?? payload.nameid
            ?? payload['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier'];
        if (raw == null) return null;
        const id = parseInt(raw, 10);
        return Number.isNaN(id) ? null : id;
    } catch {
        return null;
    }
}

function redirectAfterLogin(role) {
    const roleStr = String(role).toLowerCase();
    if (roleStr === 'admin') {
        window.location.href = 'admin.html';
    } else {
        window.location.href = 'index.html';
    }
}

/* ════════════════════════════════════════
   ROUTE GUARDS
   Call these at the TOP of each page's DOMContentLoaded
   ════════════════════════════════════════ */

/**
 * Require a logged-in USER (not admin).
 * If not logged in → redirect to login.html (saving the return URL).
 * If admin tries to access user page → redirect to admin.html.
 * Returns the auth object on success, never returns on redirect.
 */
function requireUserAuth() {
    const auth = getAuth();
    if (!auth) {
        // Save intended destination so login can redirect back
        sessionStorage.setItem('loginRedirect', window.location.href);
        window.location.replace('login.html');
        throw new Error('redirect');
    }
    if (String(auth.role).toLowerCase() === 'admin') {
        window.location.replace('admin.html');
        throw new Error('redirect');
    }
    return auth;
}

/**
 * Require a logged-in ADMIN.
 * If not logged in → redirect to login.html.
 * If regular user → redirect to index.html with an error flag.
 * Returns the auth object on success, never returns on redirect.
 */
function requireAdminAuth() {
    const auth = getAuth();
    if (!auth) {
        sessionStorage.setItem('loginRedirect', window.location.href);
        window.location.replace('login.html');
        throw new Error('redirect');
    }
    const roleStr = String(auth.role).toLowerCase();
    if (roleStr !== 'admin') {
        // Block regular users from admin pages entirely
        window.location.replace('index.html?denied=1');
        throw new Error('redirect');
    }
    return auth;
}

/**
 * Require NO login (login / signup pages).
 * If already logged in → redirect to their home page.
 */
function requireGuest() {
    const auth = getAuth();
    if (auth) {
        redirectAfterLogin(auth.role);
        throw new Error('redirect');
    }
}

/* ════════════════════════════════════════
   LOGOUT HELPERS
   ════════════════════════════════════════ */

/** User logout → back to home */
function logoutUser() {
    clearAuth();
    window.location.href = 'index.html';
}

/** Admin logout → back to login */
function logoutAdmin() {
    clearAuth();
    window.location.href = 'login.html';
}

/* ════════════════════════════════════════
   ERROR PARSER
   ════════════════════════════════════════ */
/* ════════════════════════════════════════
   INTERACTIVE STAR RATING (survives Font Awesome SVG replacement)
   ════════════════════════════════════════ */
function initStarRatingPicker(containerId, hiddenInputId, labelId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container || container.dataset.starPickerInit) return;
    container.dataset.starPickerInit = '1';

    const starSelector = options.starSelector || '[data-rating]';

    container.addEventListener('click', (e) => {
        const star = e.target.closest(starSelector);
        if (!star || !container.contains(star)) return;
        e.preventDefault();
        const rating = parseInt(star.dataset.rating, 10);
        const input = document.getElementById(hiddenInputId);
        if (input) input.value = rating;
        updateStarRatingPickerDisplay(containerId, labelId, rating, false, options);
    });

    container.addEventListener('mouseover', (e) => {
        const star = e.target.closest(starSelector);
        if (!star || !container.contains(star)) return;
        updateStarRatingPickerDisplay(containerId, labelId, parseInt(star.dataset.rating, 10), true, options);
    });

    container.addEventListener('mouseleave', () => {
        const input = document.getElementById(hiddenInputId);
        const raw = input ? input.value : '';
        const rating = raw === '' ? 0 : parseInt(raw, 10);
        updateStarRatingPickerDisplay(containerId, labelId, rating, false, options);
    });
}

function updateStarRatingPickerDisplay(containerId, labelId, rating, isHover = false, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const starSelector = options.starSelector || '[data-rating]';
    container.querySelectorAll(starSelector).forEach(star => {
        const starRating = parseInt(star.dataset.rating, 10);
        const active = rating > 0 && starRating <= rating;
        const color = active ? (isHover ? '#ffb300' : '#ffc107') : '#ddd';
        const icon = star.querySelector('i, svg');
        if (icon) icon.style.color = color;
        else star.style.color = color;
    });

    if (!labelId) return;
    const label = document.getElementById(labelId);
    if (!label) return;
    label.textContent = rating > 0
        ? `${rating} star${rating !== 1 ? 's' : ''} selected`
        : (options.emptyLabel || 'Click to select rating');
}

function setStarRatingPickerValue(containerId, hiddenInputId, labelId, rating, options = {}) {
    const input = document.getElementById(hiddenInputId);
    if (input) input.value = rating > 0 ? String(rating) : '';
    updateStarRatingPickerDisplay(containerId, labelId, rating, false, options);
}

async function parseApiError(response) {
    try {
        const body = await response.json();
        if (body.error)  return body.error;
        if (body.title)  return body.title;
        if (body.errors && typeof body.errors === 'object') {
            const firstKey = Object.keys(body.errors)[0];
            const msg = body.errors[firstKey]?.[0];
            if (msg) return msg;
        }
    } catch { /* body wasn't JSON */ }

    // Fallback by status code
    if (response.status === 0)   return 'Cannot reach the API. Start the backend and SQL Server.';
    if (response.status === 401) return 'Session expired. Please log in again.';
    if (response.status === 403) return 'You are not authorized to perform this action.';
    if (response.status === 404) return 'Resource not found.';
    if (response.status >= 500)  return 'Server error. Please try again later.';
    return 'Request failed. Please try again.';
}