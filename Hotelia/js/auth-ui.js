/* ==========================================================================
   HOTELIA - SHARED AUTH UI HELPERS
   ========================================================================== */

function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const icon = btn.querySelector('i');
    if (input.type === 'password') {
        input.type = 'text';
        if (icon) {
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    } else {
        input.type = 'password';
        if (icon) {
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        }
    }
}

function setAuthMessage(text, type) {
    const box = document.getElementById('authMessage');
    if (!box) return;

    box.textContent = text || '';
    box.classList.remove('is-error', 'is-success', 'is-visible');

    if (!text) return;

    box.classList.add('is-visible', type === 'success' ? 'is-success' : 'is-error');
}

function setAuthLoading(button, loading, idleLabel) {
    if (!button) return;

    button.disabled = loading;
    const label = button.querySelector('span');

    if (loading) {
        button.dataset.idleLabel = label ? label.textContent : idleLabel;
        if (label) label.textContent = 'Please wait...';
        return;
    }

    if (label) {
        label.textContent = button.dataset.idleLabel || idleLabel || 'Submit';
    }
}
