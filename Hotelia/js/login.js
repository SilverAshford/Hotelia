/* ==========================================================================
   HOTELIA - LOGIN
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // Already logged in? Send to their home
    const existing = getAuth();
    if (existing) {
        redirectAfterLogin(existing.role);
        return;
    }

    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const email     = document.getElementById('loginEmail')?.value.trim();
        const password  = document.getElementById('loginPassword')?.value;
        const remember  = document.getElementById('rememberMe')?.checked === true;
        const submitBtn = loginForm.querySelector('.btn-auth-primary');

        setAuthMessage('');
        setAuthLoading(submitBtn, true, 'Sign In');

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            if (!response.ok) throw new Error(await parseApiError(response));

            const data = await response.json();
            saveAuth(data, remember);
            setAuthMessage('Signed in successfully. Redirecting...', 'success');

            // If there's a saved redirect URL (e.g. user tried to book), go there
            const savedRedirect = sessionStorage.getItem('loginRedirect');
            sessionStorage.removeItem('loginRedirect');

            if (savedRedirect && String(data.role).toLowerCase() !== 'admin') {
                window.location.href = savedRedirect;
            } else {
                redirectAfterLogin(data.role);
            }
        } catch (error) {
            const message = error instanceof TypeError
                ? 'Cannot reach the API. Start SQL Server and run the backend.'
                : error.message;
            setAuthMessage(message, 'error');
            setAuthLoading(submitBtn, false, 'Sign In');
        }
    });
});
