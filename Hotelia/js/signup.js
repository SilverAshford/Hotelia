/* ==========================================================================
   HOTELIA - SIGNUP (REGISTER)
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    const existing = getAuth();
    if (existing) {
        redirectAfterLogin(existing.role);
        return;
    }

    const registerForm = document.getElementById('registerForm');
    if (!registerForm) return;

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const name = document.getElementById('signupName')?.value.trim();
        const email = document.getElementById('signupEmail')?.value.trim();
        const password = document.getElementById('signupPassword')?.value;
        const confirmPassword = document.getElementById('signupConfirmPassword')?.value;
        const submitBtn = registerForm.querySelector('.btn-auth-primary');

        setAuthMessage('');

        if (password !== confirmPassword) {
            setAuthMessage('Passwords do not match. Please verify your password.', 'error');
            return;
        }

        if (password.length < 6) {
            setAuthMessage('Password must be at least 6 characters.', 'error');
            return;
        }

        setAuthLoading(submitBtn, true, 'Create Account');

        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, password })
            });

            if (!response.ok) {
                throw new Error(await parseApiError(response));
            }

            const data = await response.json();
            saveAuth(data, true);
            setAuthMessage('Account created. Redirecting...', 'success');
            redirectAfterLogin(data.role);
        } catch (error) {
            const message = error instanceof TypeError
                ? 'Cannot reach the API. Start SQL Server and run the backend.'
                : error.message;
            setAuthMessage(message, 'error');
            setAuthLoading(submitBtn, false, 'Create Account');
        }
    });
});
