/* ==========================================================================
   HOTELIA - USER PROFILE PAGE
   Guard: regular users only. Admins are redirected to admin.html.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    let auth;
    try { auth = requireUserAuth(); } catch { return; }

    renderUserInfo(auth);
    renderThemePicker();
    // Hide admin link slot — this page is user-only
    const slot = document.getElementById('adminLinkSlot');
    if (slot) slot.style.display = 'none';

    // Delete account
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', () => deleteAccount(auth));
});

/* ── Fill user info ── */
function renderUserInfo(auth) {
    // Info card fields
    setText('infoName',   auth.name);
    setText('infoEmail',  auth.email);
    setText('infoRole',   'User');

    const createdAtEl = document.getElementById('infoCreatedAt');
    if (createdAtEl) {
        createdAtEl.textContent = auth.createdAt
            ? new Date(auth.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '—';
    }

    // Update nav to show user's name
    const nav = document.querySelector('header nav.navig');
    if (nav) {
        nav.innerHTML = `
            <a href="profile.html" class="btn btn-light fw-bold" style="color:var(--primary-dark)">
                <i class="fa-solid fa-user-circle me-1"></i>${auth.name}
            </a>
            <button onclick="logoutUser()" class="btn btn-outline-light">Logout</button>`;
    }
}

/* ── Theme Picker ── */
function renderThemePicker() {
    const grid = document.getElementById('themeGrid');
    if (!grid) return;

    const current = getSavedTheme();
    grid.innerHTML = Object.values(THEMES).map(theme => `
        <button class="theme-btn ${theme.value === current ? 'active' : ''}"
                onclick="selectTheme('${theme.value}')"
                id="theme-btn-${theme.value}"
                title="${theme.label}">
            <div class="theme-swatch swatch-${theme.value}"></div>
            <span class="theme-name">${theme.label}</span>
        </button>`).join('');
}

function selectTheme(themeName) {
    saveTheme(themeName);
    document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`theme-btn-${themeName}`)?.classList.add('active');
}

/* ── Helpers ── */
function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value || '—';
}

/* ── Delete Account ── */
async function deleteAccount(auth) {
    const btn     = document.getElementById('confirmDeleteBtn');
    const spinner = document.getElementById('deleteSpinner');

    btn.disabled = true;
    spinner.classList.remove('d-none');

    try {
        const res = await fetch(`${API_BASE_URL}/api/me`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${auth.token}` }
        });

        if (!res.ok) {
            const msg = await parseApiError(res);
            throw new Error(msg);
        }

        // Success — wipe local session and redirect
        clearAuth();
        window.location.replace('index.html');

    } catch (err) {
        btn.disabled = false;
        spinner.classList.add('d-none');

        // Show error inside modal
        let alertEl = document.getElementById('deleteErrorAlert');
        if (!alertEl) {
            alertEl = document.createElement('div');
            alertEl.id = 'deleteErrorAlert';
            alertEl.className = 'alert alert-danger mt-3 mb-0 small';
            document.querySelector('#deleteAccountModal .modal-body').appendChild(alertEl);
        }
        alertEl.textContent = err.message || 'Something went wrong. Please try again.';
    }
}
