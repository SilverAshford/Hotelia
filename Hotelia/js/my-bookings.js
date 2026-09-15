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
        <button class="nav-toggler" onclick="this.nextElementSibling.classList.toggle('open')" aria-label="Toggle navigation">
            <i class="fa-solid fa-bars"></i>
        </button>
        <div class="nav-collapse">
            <a href="index.html" class="btn btn-outline-light border-0">Home</a>
            <a href="profile.html" class="btn btn-outline-light border-0">
                <i class="fa-solid fa-user-circle me-1"></i>${auth.name}
            </a>
            <button onclick="logoutUser()" class="btn btn-outline-light">Logout</button>
        </div>`;
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

    // Attach review listeners
    container.querySelectorAll('.btn-review').forEach(btn => {
        btn.addEventListener('click', () => openReviewModal(btn, auth));
    });
}

/* ── Build a single booking card ── */
function buildBookingCard(b) {
    const status = (b.status || '').toLowerCase();
    const statusBadge = `<span class="status-badge status-${status}">${capitalize(b.status)}</span>`;

    const checkInFmt  = formatDate(b.checkIn);
    const checkOutFmt = formatDate(b.checkOut);

    const actionBtn = buildActionButton(b);

    // Derive thumbnail path from hotel name — same logic used by admin when uploading
    const imgSrc = hotelThumbFromName(b.hotelName);

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
                <img src="${imgSrc}" alt="${b.hotelName}"
                     class="hotel-thumb" style="object-fit:cover;"
                     onerror="this.src='assets/hotel.jpg'">
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

    // User can cancel CONFIRMED bookings
    if (status === 'confirmed') {
        return `
            <button class="btn btn-action btn-cancel"
                    data-cancel-id="${b.id}"
                    data-status="Confirmed">
                Cancel Booking
            </button>
            <button class="btn btn-action btn-review"
                    data-booking-id="${b.id}"
                    data-hotel-id="${b.hotelId}"
                    data-hotel-name="${escapeHtml(b.hotelName)}"
                    style="background:var(--primary-color);color:#fff;">
                <i class="fa-solid fa-star me-1"></i>Leave Review
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
        return `
            <button class="btn btn-action btn-review"
                    data-booking-id="${b.id}"
                    data-hotel-id="${b.hotelId}"
                    data-hotel-name="${escapeHtml(b.hotelName)}"
                    style="background:var(--primary-color);color:#fff;">
                <i class="fa-solid fa-star me-1"></i>Leave Review
            </button>`;
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

/**
 * Derives the thumbnail path from the hotel name.
 * Mirrors the naming logic in admin-hotels.js → updateSuggestedPath():
 *   "Grand Royal"  → "assets/hotel_grand_royal.png"
 *   "Sea View Resort" → "assets/hotel_sea_view_resort.png"
 */
function hotelThumbFromName(hotelName) {
    if (!hotelName) return 'assets/hotel.jpg';
    const slug = hotelName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
    return `assets/hotel_${slug}.png`;
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

/* ══════════════════════════════════════════════════════════════════════════
   REVIEW MODAL
   ══════════════════════════════════════════════════════════════════════════ */

function openReviewModal(btn, auth) {
    const hotelId = btn.dataset.hotelId;
    const hotelName = btn.dataset.hotelName;

    // Create modal if doesn't exist (replace legacy markup from older versions)
    let modal = document.getElementById('reviewModal');
    if (modal && !modal.querySelector('button[data-rating]')) {
        modal.remove();
        modal = null;
    }
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'reviewModal';
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header" style="background:var(--primary-color);color:#fff;">
                        <h5 class="modal-title fw-bold">
                            <i class="fa-solid fa-star me-2"></i>
                            Leave a Review
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-4">
                        <h6 class="fw-bold mb-3" id="reviewHotelName"></h6>
                        <form id="reviewForm">
                            <input type="hidden" id="reviewHotelId">
                            
                            <div class="mb-3">
                                <label class="form-label fw-bold">Rating *</label>
                                <div class="d-flex align-items-center gap-2 flex-wrap">
                                    <div class="d-flex gap-1" id="ratingStars">
                                        ${[1, 2, 3, 4, 5].map(n => `
                                            <button type="button" class="rating-star p-0 border-0 bg-transparent lh-1"
                                                    data-rating="${n}" aria-label="Rate ${n} star${n !== 1 ? 's' : ''}">
                                                <i class="fa-solid fa-star" style="font-size:2rem;color:#ddd;pointer-events:none;"></i>
                                            </button>`).join('')}
                                    </div>
                                    <span class="text-muted small" id="ratingStarsLabel">Click to select rating</span>
                                </div>
                                <input type="hidden" id="reviewRating" value="" required>
                            </div>

                            <div class="mb-3">
                                <label class="form-label fw-bold">Comment (Optional)</label>
                                <textarea class="form-control" id="reviewComment" rows="4" 
                                          maxlength="1000" placeholder="Share your experience..."></textarea>
                                <div class="form-text">Maximum 1000 characters</div>
                            </div>

                            <div id="reviewFormMsg"></div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-dark px-4" id="submitReviewBtn">
                            <i class="fa-solid fa-paper-plane me-2"></i>Submit Review
                        </button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modal);

        // Setup submit button
        document.getElementById('submitReviewBtn').addEventListener('click', () => submitReview(auth));
        initStarRatingPicker('ratingStars', 'reviewRating', 'ratingStarsLabel');
    }

    // Fill hotel info
    document.getElementById('reviewHotelId').value = hotelId;
    document.getElementById('reviewHotelName').textContent = hotelName;
    document.getElementById('reviewComment').value = '';
    document.getElementById('reviewFormMsg').innerHTML = '';
    setStarRatingPickerValue('ratingStars', 'reviewRating', 'ratingStarsLabel', 0);

    // Show modal
    new bootstrap.Modal(modal).show();
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

async function submitReview(auth) {
    const hotelId = parseInt(document.getElementById('reviewHotelId').value, 10);
    const rating = parseInt(document.getElementById('reviewRating').value, 10);
    const comment = document.getElementById('reviewComment').value.trim();
    const msgEl = document.getElementById('reviewFormMsg');

    msgEl.innerHTML = '';

    if (!rating || rating < 1 || rating > 5) {
        msgEl.innerHTML = '<div class="alert alert-danger py-2">Please select a rating.</div>';
        return;
    }

    const btn = document.getElementById('submitReviewBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Submitting...';

    try {
        const response = await fetch(`${API_BASE_URL}/api/reviews`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth.token}`
            },
            body: JSON.stringify({ hotelId, rating, comment: comment || null })
        });

        if (!response.ok) {
            const error = await parseApiError(response);
            throw new Error(error);
        }

        bootstrap.Modal.getInstance(document.getElementById('reviewModal')).hide();
        showToast('Review submitted successfully! Thank you for your feedback.', 'success');

        // Reload bookings to update UI
        setTimeout(() => loadMyBookings(auth), 500);
    } catch (err) {
        msgEl.innerHTML = `<div class="alert alert-danger py-2">${err.message}</div>`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-paper-plane me-2"></i>Submit Review';
    }
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
