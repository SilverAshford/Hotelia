/* ==========================================================================
   HOTELIA - ADMIN PROFILE PAGE
   Shows admin info, theme picker, and admin-only quick links.
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    let auth;
    try { auth = requireAdminAuth(); } catch { return; }

    renderAdminInfo(auth);
    renderThemePicker();
});

/* ── Fill admin info ── */
function renderAdminInfo(auth) {
    const avatarEl = document.getElementById('profileAvatar');
    if (avatarEl) {
        avatarEl.innerHTML = `<span style="font-size:2.2rem;font-weight:700;color:var(--primary-dark)">
            ${getInitials(auth.name)}
        </span>`;
    }
    setText('profileName',  auth.name);
    setText('profileRole',  '🔑 Administrator');
    setText('infoName',     auth.name);
    setText('infoEmail',    auth.email);
    setText('infoRole',     'Admin');

    const createdAtEl = document.getElementById('infoCreatedAt');
    if (createdAtEl) {
        createdAtEl.textContent = auth.createdAt
            ? new Date(auth.createdAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : '—';
    }
}

/* ── Theme Picker (same as user profile) ── */
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

function getInitials(name) {
    if (!name) return '?';
    return name.trim().split(' ').map(w => w[0].toUpperCase()).slice(0, 2).join('');
}
