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
    default: { label: 'Warm Brown',    icon: '🤎', value: 'default' },
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
    const payload = JSON.stringify({
        token:     data.token,
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

function redirectAfterLogin(role) {
    if (String(role).toLowerCase() === 'admin') {
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
    if (String(auth.role).toLowerCase() !== 'admin') {
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
