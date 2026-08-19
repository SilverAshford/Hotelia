/* ==========================================================================
   HOTELIA - CHECKOUT PAGE
   Handles: pre-filling booking summary from URL params, submitting booking to API
   API: POST /api/bookings  (requires JWT)
   URL params: hotelId, roomTypeId, price, checkIn, checkOut, hotelName, roomName
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // Guard: must be a logged-in non-admin user
    // requireUserAuth() redirects to login.html if not logged in,
    // saving current URL so login can bounce back here.
    let auth;
    try { auth = requireUserAuth(); } catch { return; }

    updateNavForAuthState(auth);
    prefillFromUrlParams();
    setupFormSubmit(auth);
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

/* ── Read URL params and fill booking summary sidebar ── */
function prefillFromUrlParams() {
    const params = new URLSearchParams(window.location.search);

    const hotelId    = params.get('hotelId');
    const roomTypeId = params.get('roomTypeId');
    const checkIn    = params.get('checkIn');
    const checkOut   = params.get('checkOut');
    const price      = parseFloat(params.get('price')) || 0;
    const hotelName  = params.get('hotelName') || 'Selected Hotel';
    const roomName   = params.get('roomName')  || 'Selected Room';

    // Fill dates into named inputs
    const checkInInput  = document.getElementById('checkInDate');
    const checkOutInput = document.getElementById('checkOutDate');
    if (checkIn  && checkInInput)  checkInInput.value  = checkIn;
    if (checkOut && checkOutInput) checkOutInput.value = checkOut;

    // Live recalculation when user changes dates
    checkInInput?.addEventListener('change',  () => updateSummary(hotelName, roomName, checkInInput.value, checkOutInput?.value, price));
    checkOutInput?.addEventListener('change', () => updateSummary(hotelName, roomName, checkInInput?.value, checkOutInput.value, price));

    updateSummary(hotelName, roomName, checkIn, checkOut, price);
}

function updateSummary(hotelName, roomName, checkIn, checkOut, pricePerNight) {
    const nights = calcNights(checkIn, checkOut);
    const subtotal = pricePerNight * nights;

    const roomNameEl   = document.querySelector('.checkout-card .fw-bold.mb-1');
    const hotelNameEl  = document.querySelector('.checkout-card .text-muted.small.mb-0');
    const priceEl      = document.querySelector('.summary-box .d-flex:nth-child(1) .fw-semibold');
    const durationEl   = document.querySelector('.summary-box .d-flex:nth-child(2) .fw-semibold');
    const taxesEl      = document.querySelector('.summary-box .d-flex:nth-child(3) .fw-semibold');
    const totalEl      = document.querySelector('.total-price');

    if (roomNameEl)  roomNameEl.textContent  = roomName;
    if (hotelNameEl) hotelNameEl.textContent = hotelName;
    if (priceEl)     priceEl.textContent     = `$${pricePerNight}`;
    if (durationEl)  durationEl.textContent  = `${nights} Night${nights !== 1 ? 's' : ''}`;
    if (taxesEl)     taxesEl.textContent     = `$0`;   // API handles pricing
    if (totalEl)     totalEl.textContent     = `$${subtotal.toFixed(2)}`;
}

function calcNights(checkIn, checkOut) {
    if (!checkIn || !checkOut) return 1;
    const diff = (new Date(checkOut) - new Date(checkIn)) / (1000 * 60 * 60 * 24);
    return diff > 0 ? diff : 1;
}

/* ── Form submit → POST /api/bookings ── */
function setupFormSubmit(auth) {
    const submitBtn = document.querySelector('.btn-submit');
    if (!submitBtn) return;

    submitBtn.removeAttribute('onclick');
    submitBtn.addEventListener('click', async () => {
        const params = new URLSearchParams(window.location.search);

        const hotelId    = parseInt(params.get('hotelId'), 10);
        const roomTypeId = parseInt(params.get('roomTypeId'), 10);

        const checkIn  = document.getElementById('checkInDate')?.value;
        const checkOut = document.getElementById('checkOutDate')?.value;

        // Validate
        if (!hotelId || !roomTypeId) {
            showCheckoutMessage('Missing hotel or room info. Please go back and select a room.', 'error');
            return;
        }
        if (!checkIn || !checkOut) {
            showCheckoutMessage('Please select check-in and check-out dates.', 'error');
            return;
        }
        if (new Date(checkIn) >= new Date(checkOut)) {
            showCheckoutMessage('Check-out must be after check-in.', 'error');
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Processing...';

        try {
            const response = await fetch(`${API_BASE_URL}/api/bookings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${auth.token}`
                },
                body: JSON.stringify({
                    hotelId,
                    roomTypeId,
                    checkIn,
                    checkOut
                })
            });

            if (!response.ok) {
                throw new Error(await parseApiError(response));
            }

            // Success — go to bookings page
            window.location.href = 'my_bookings.html?booked=1';
        } catch (err) {
            showCheckoutMessage(err.message, 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit Reservation';
        }
    });
}

/* ── Show message near submit button ── */
function showCheckoutMessage(text, type) {
    let msgEl = document.getElementById('checkoutMessage');
    if (!msgEl) {
        msgEl = document.createElement('div');
        msgEl.id = 'checkoutMessage';
        msgEl.className = 'alert mt-3 text-center';
        const submitBtn = document.querySelector('.btn-submit');
        if (submitBtn) submitBtn.insertAdjacentElement('afterend', msgEl);
    }
    msgEl.className = `alert mt-3 text-center ${type === 'error' ? 'alert-danger' : 'alert-success'}`;
    msgEl.innerHTML = `<i class="fa-solid fa-${type === 'error' ? 'circle-xmark' : 'circle-check'} me-2"></i>${text}`;
    msgEl.style.display = 'block';
}
