/* ==========================================================================
   HOTELIA - CHECKOUT PAGE
   Handles: pre-filling booking summary from URL params, submitting booking to API
   API: POST /api/bookings  (requires JWT)
        GET /api/room-types/{id}/availability?from=&to=
   URL params: hotelId, roomTypeId, price, checkIn, checkOut, hotelName, roomName
   ========================================================================== */

let roomCapacity = 2;  // Will be loaded from URL or API
let roomTypeId   = null;
let pricePerNight = 0;

document.addEventListener('DOMContentLoaded', () => {
    // Guard: must be a logged-in non-admin user
    // requireUserAuth() redirects to login.html if not logged in,
    // saving current URL so login can bounce back here.
    let auth;
    try { auth = requireUserAuth(); } catch { return; }

    updateNavForAuthState(auth);
    displayAccountInfo(auth);
    prefillFromUrlParams(auth);
    setupFormSubmit(auth);
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
            <a href="my_bookings.html" class="btn btn-outline-light border-0">My Bookings</a>
            <a href="profile.html" class="btn btn-outline-light border-0">
                <i class="fa-solid fa-user-circle me-1"></i>${auth.name}
            </a>
            <button onclick="logoutUser()" class="btn btn-outline-light">Logout</button>
        </div>`;
}

/* ── Display account info ── */
function displayAccountInfo(auth) {
    const nameEl  = document.getElementById('accountName');
    const emailEl = document.getElementById('accountEmail');
    if (nameEl)  nameEl.textContent  = auth.name;
    if (emailEl) emailEl.textContent = auth.email;
}

/* ── Read URL params and fill booking summary sidebar ── */
async function prefillFromUrlParams(auth) {
    const params = new URLSearchParams(window.location.search);

    const hotelId    = parseInt(params.get('hotelId'), 10);
    roomTypeId       = parseInt(params.get('roomTypeId'), 10);
    const checkIn    = params.get('checkIn');
    const checkOut   = params.get('checkOut');
    pricePerNight    = parseFloat(params.get('price')) || 0;
    const hotelName  = params.get('hotelName') || 'Selected Hotel';
    const roomName   = params.get('roomName')  || 'Selected Room';
    const capacity   = parseInt(params.get('capacity'), 10) || 2;

    // Store capacity
    roomCapacity = capacity;

    // Build guest count dropdown (1 to capacity)
    const guestSelect = document.getElementById('guestCount');
    if (guestSelect) {
        guestSelect.innerHTML = '';
        for (let i = 1; i <= roomCapacity; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = `${i} Guest${i > 1 ? 's' : ''}`;
            if (i === 1) opt.selected = true;
            guestSelect.appendChild(opt);
        }
    }

    // Update capacity help text
    const capacityHelp = document.getElementById('capacityHelp');
    if (capacityHelp) {
        capacityHelp.textContent = `This room can accommodate up to ${roomCapacity} guest${roomCapacity > 1 ? 's' : ''}.`;
    }

    // Fill dates into inputs
    const checkInInput  = document.getElementById('checkInDate');
    const checkOutInput = document.getElementById('checkOutDate');
    
    // Set min date to today
    const today = new Date().toISOString().split('T')[0];
    if (checkInInput) {
        checkInInput.value = checkIn || today;
        checkInInput.min = today;
    }
    if (checkOutInput) {
        const minCheckOut = checkIn || today;
        const nextDay = new Date(minCheckOut);
        nextDay.setDate(nextDay.getDate() + 1);
        checkOutInput.value = checkOut || nextDay.toISOString().split('T')[0];
        checkOutInput.min = nextDay.toISOString().split('T')[0];
    }

    // Update checkout min when checkin changes
    checkInInput?.addEventListener('change', () => {
        const newMin = new Date(checkInInput.value);
        newMin.setDate(newMin.getDate() + 1);
        if (checkOutInput) {
            checkOutInput.min = newMin.toISOString().split('T')[0];
            if (checkOutInput.value <= checkInInput.value) {
                checkOutInput.value = newMin.toISOString().split('T')[0];
            }
        }
        updateSummaryAndValidate(hotelName, roomName, auth);
    });

    // Live recalculation when user changes dates or guest count
    checkOutInput?.addEventListener('change', () => updateSummaryAndValidate(hotelName, roomName, auth));
    guestSelect?.addEventListener('change', () => updateSummaryAndValidate(hotelName, roomName, auth));

    // Initial summary update
    updateSummaryAndValidate(hotelName, roomName, auth);
}

async function updateSummaryAndValidate(hotelName, roomName, auth) {
    const checkInInput  = document.getElementById('checkInDate');
    const checkOutInput = document.getElementById('checkOutDate');
    const guestSelect   = document.getElementById('guestCount');

    const checkIn  = checkInInput?.value;
    const checkOut = checkOutInput?.value;
    const guests   = parseInt(guestSelect?.value, 10) || 1;

    updateSummary(hotelName, roomName, checkIn, checkOut, guests);

    // Check availability if we have valid dates
    if (checkIn && checkOut && roomTypeId) {
        await checkAvailability(checkIn, checkOut, auth);
    }
}

function updateSummary(hotelName, roomName, checkIn, checkOut, guests) {
    const nights = calcNights(checkIn, checkOut);
    const subtotal = pricePerNight * nights;

    // Update sidebar summary
    document.getElementById('summaryRoomName').textContent  = roomName;
    document.getElementById('summaryHotelName').textContent = hotelName;
    document.getElementById('summaryPrice').textContent     = `$${pricePerNight}`;
    document.getElementById('summaryNights').textContent    = `${nights} Night${nights !== 1 ? 's' : ''}`;
    document.getElementById('summaryGuests').textContent    = `${guests} Guest${guests !== 1 ? 's' : ''}`;
    document.getElementById('summaryTotal').textContent     = `$${subtotal.toFixed(2)}`;

    // Update night count in form
    const nightCountInput = document.getElementById('nightCount');
    if (nightCountInput) {
        nightCountInput.value = `${nights} night${nights !== 1 ? 's' : ''}`;
    }
}

/* ── Check availability from API ── */
async function checkAvailability(checkIn, checkOut, auth) {
    const statusEl = document.getElementById('availabilityStatus');
    if (!statusEl) {
        // Create status element if not exists
        const form = document.getElementById('bookingForm');
        const div = document.createElement('div');
        div.id = 'availabilityStatus';
        div.className = 'alert mt-3';
        form?.appendChild(div);
    }

    const status = document.getElementById('availabilityStatus');
    status.innerHTML = '<i class="fa-solid fa-spinner fa-spin me-2"></i>Checking availability...';
    status.className = 'alert alert-info mt-3';
    status.style.display = 'block';

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/room-types/${roomTypeId}/availability?from=${checkIn}&to=${checkOut}`
        );

        if (!response.ok) throw new Error('Could not check availability.');

        const records = await response.json();
        const nights = calcNights(checkIn, checkOut);

        // Check if all nights are available
        const allAvailable = records.length >= nights && records.every(r => r.availableRooms > 0);

        if (allAvailable) {
            status.innerHTML = '<i class="fa-solid fa-circle-check me-2"></i>Great news! This room is available for your selected dates.';
            status.className = 'alert alert-success mt-3';
            document.querySelector('.btn-submit').disabled = false;
        } else {
            status.innerHTML = '<i class="fa-solid fa-circle-xmark me-2"></i>Sorry, this room is not available for all selected dates. Please choose different dates.';
            status.className = 'alert alert-danger mt-3';
            document.querySelector('.btn-submit').disabled = true;
        }
    } catch (err) {
        status.innerHTML = `<i class="fa-solid fa-triangle-exclamation me-2"></i>${err.message}`;
        status.className = 'alert alert-warning mt-3';
    }
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

        const hotelId = parseInt(params.get('hotelId'), 10);
        const checkIn  = document.getElementById('checkInDate')?.value;
        const checkOut = document.getElementById('checkOutDate')?.value;
        const guests   = parseInt(document.getElementById('guestCount')?.value, 10);

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
        if (guests > roomCapacity) {
            showCheckoutMessage(`This room can only accommodate ${roomCapacity} guest${roomCapacity > 1 ? 's' : ''}.`, 'error');
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
                    checkOut,
                    guests  // Add guests field
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
