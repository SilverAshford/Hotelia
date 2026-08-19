/* ==========================================================================
   HOTELIA - MY BOOKINGS PAGE
   Handles: loading user bookings, cancel booking
   API: GET /api/me/bookings  |  PATCH /api/bookings/{id}/cancel
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    let auth;
    try { auth = requireUserAuth(); } catch { return; }

    updateNavForAuthState(auth);
    loadMyBookings(auth);

    const params = new URLSearchParams(window.location.search);
    if (params.get('booked') === '1') {
        showToast('Booking submitted successfully! It is now pending confirmation.', 'success');
    }
});

/* ── Nav ── */
function updateNavForAuthState(auth) {
    const nav = document.querySelector('header nav.navig');
    if (!nav) return;
    nav.innerHTML = `
        <a href="index.html" class="btn btn-outline-light border-0">Home</a>
        <a href="profile.html" class="btn btn-outline-light border-0">
            <i class="fa-solid fa-user-circle me-1"></i>${auth.name}
        </a>
        <button onclick="logoutUser()" class="btn btn-outline-light">Logout</button>`;
}

/* ── Nav ── */
function updateNavForAuthState(auth) {
    const nav = document.querySelector('header nav.navig');
    if (!nav) return;
    nav.innerHTML = `
        <a href="index.html" class="btn btn-outline-light border-0">Home</a>
        <a href="profile.html" class="btn btn-outline-light border-0">
            <i class="fa-solid fa-user-circle me-1"></i>${auth.name}
        </a>
        <button onclick="handleLogout()" class="btn btn-outline-light">Logout</button>`;
}

function handleLogout() {
    clearAuth();
    window.location.href = 'index.html';
}

/* ── Load bookings ── */
async function loadMyBookings(auth) {
    const container = getBookingsContainer();
    container.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-secondary" role="status"></div>
            <p class="mt-3 text-muted">Loading your bookings...</p>
        </div>`;

    try {
        const response = await fetch(`${API_BASE_URL}/api/me/bookings`, {
            headers: { 'Authorization': `Bearer ${auth.token}` }
        });

        if (!response.ok) throw new Error(await parseApiError(response));

        const bookings = await response.json();
        renderBookings(container, bookings, auth);
    } catch (err) {
        container.innerHTML = `
            <div class="alert alert-warning text-center">
                <i class="fa-solid fa-triangle-exclamation me-2"></i>
                ${err.message || 'Could not load bookings.'}
            </div>`;
    }
}

/* ── Get or locate bookings container ── */
function getBookingsContainer() {
    let el = document.getElementById('bookings-container');
    if (el) return el;

    // Wrap the existing static cards area
    const section = document.querySelector('.row .col-lg-10');
    if (section) {
        section.id = 'bookings-container';
        return section;
    }

    // Fallback: use main
    const main = document.querySelector('main .container');
    const div = document.createElement('div');
    div.id = 'bookings-container';
    if (main) main.appendChild(div);
    return div;
}

/* ── Render booking cards ── */
function renderBookings(container, bookings, auth) {
    if (!bookings || bookings.length === 0) {
        container.innerHTML = `
            <div class="text-center py-5 text-muted">
                <i class="fa-solid fa-calendar-xmark fa-3x mb-3 opacity-50"></i>
                <h4>No bookings yet.</h4>
                <a href="index.html" class="btn btn-dark mt-3">Browse Hotels</a>
            </div>`;
        return;
    }

    container.innerHTML = bookings.map(b => buildBookingCard(b)).join('');

    // Attach cancel listeners
    container.querySelectorAll('[data-cancel-id]').forEach(btn => {
        btn.addEventListener('click', () => handleCancel(btn, auth));
    });
}

/* ── Build a single booking card ── */
function buildBookingCard(b) {
    const status = (b.status || '').toLowerCase();
    const statusBadge = `<span class="status-badge status-${status}">${capitalize(b.status)}</span>`;

    const checkInFmt  = formatDate(b.checkIn);
    const checkOutFmt = formatDate(b.checkOut);

    const actionBtn = buildActionButton(b);

    return `
        <div class="booking-card" id="booking-${b.id}">
            <div class="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mb-3">
                <div class="d-flex align-items-center gap-3 mb-3 mb-md-0">
                    ${statusBadge}
                    <span class="text-muted fw-bold">Booking ID: #BK-${b.id}</span>
                </div>
                <div class="fs-5 fw-bold" style="color:var(--text-color);">$${b.totalPrice.toFixed(2)}</div>
            </div>

            <div class="d-flex flex-column flex-md-row gap-4 align-items-md-center">
                <img src="assets/hotel_test.png" alt="${b.hotelName}"
                     class="hotel-thumb" style="object-fit:cover;"
                     onerror="this.src='assets/hotel_test.png'">
                <div class="flex-grow-1">
                    <h5 class="fw-bold mb-1">${b.roomTypeName}</h5>
                    <p class="text-muted mb-2">
                        <i class="fa-solid fa-building me-2"></i>${b.hotelName}
                    </p>
                    <p class="mb-0 fs-6">
                        <i class="fa-regular fa-calendar me-2 text-muted"></i>
                        ${checkInFmt}
                        <i class="fa-solid fa-arrow-right mx-2 text-muted"></i>
                        ${checkOutFmt}
                        (${b.nights} Night${b.nights !== 1 ? 's' : ''})
                    </p>
                </div>
                <div class="mt-3 mt-md-0 d-flex gap-2">
                    ${actionBtn}
                </div>
            </div>
        </div>`;
}

/* ── Action button depending on status ── */
function buildActionButton(b) {
    const status = (b.status || '').toLowerCase();

    // Per spec: user can only cancel a CONFIRMED booking
    if (status === 'confirmed') {
        return `<button class="btn btn-action btn-cancel"
                        data-cancel-id="${b.id}"
                        data-status="Confirmed">
                    Cancel Booking
                </button>`;
    }
    if (status === 'pending') {
        return `<span class="text-muted small">
                    <i class="fa-solid fa-clock me-1"></i> Awaiting confirmation
                </span>`;
    }
    if (status === 'rejected') {
        return `<span class="text-muted small">
                    <i class="fa-solid fa-circle-info me-1"></i> Rooms unavailable
                </span>`;
    }
    if (status === 'cancelled') {
        return `<span class="text-muted small">
                    <i class="fa-solid fa-ban me-1"></i> Cancelled
                </span>`;
    }
    if (status === 'completed') {
        return `<span class="text-success small fw-bold">
                    <i class="fa-solid fa-circle-check me-1"></i> Completed
                </span>`;
    }
    return '';
}

/* ── Cancel a booking ── */
async function handleCancel(btn, auth) {
    const bookingId = btn.dataset.cancelId;
    if (!confirm('Are you sure you want to cancel this booking?')) return;

    btn.disabled = true;
    btn.textContent = 'Cancelling...';

    try {
        const response = await fetch(`${API_BASE_URL}/api/bookings/${bookingId}/cancel`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${auth.token}` }
        });

        if (!response.ok) throw new Error(await parseApiError(response));

        showToast('Booking cancelled successfully.', 'success');

        // Reload the list
        loadMyBookings(auth);
    } catch (err) {
        showToast(err.message || 'Could not cancel booking.', 'error');
        btn.disabled = false;
        btn.textContent = btn.dataset.status === 'Pending' ? 'Cancel Request' : 'Cancel Booking';
    }
}

/* ── Helpers ── */
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function showToast(message, type) {
    let toast = document.getElementById('hotelia-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'hotelia-toast';
        toast.style.cssText = `
            position:fixed; bottom:2rem; right:2rem; z-index:9999;
            padding:1rem 1.5rem; border-radius:0.5rem; color:#fff;
            font-weight:600; box-shadow:0 4px 20px rgba(0,0,0,.2);
            transition:opacity 0.4s; max-width:360px;`;
        document.body.appendChild(toast);
    }
    toast.style.backgroundColor = type === 'success' ? '#28a745' : '#dc3545';
    toast.innerHTML = `<i class="fa-solid fa-${type === 'success' ? 'circle-check' : 'circle-xmark'} me-2"></i>${message}`;
    toast.style.opacity = '1';
    toast.style.display = 'block';

    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => { toast.style.display = 'none'; }, 400);
    }, 4000);
}
