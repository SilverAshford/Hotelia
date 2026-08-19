/* ==========================================================================
   HOTELIA - HOTEL DETAILS PAGE
   Handles: loading hotel info + room types from API using ?id= query param
   API: GET /api/hotels/{id}
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    updateNavForAuthState();

    const hotelId = getHotelIdFromUrl();
    if (!hotelId) {
        showPageError('No hotel specified. Please go back and select a hotel.');
        return;
    }

    loadHotelDetails(hotelId);
});

/* ── Nav state — shows Profile if logged in, Login/Signup if not ── */
function updateNavForAuthState() {
    const auth = getAuth();
    const nav = document.querySelector('header nav.navig');
    if (!nav) return;

    if (auth) {
        nav.innerHTML = `
            <a href="index.html" class="btn btn-outline-light border-0">Home</a>
            <a href="profile.html" class="btn btn-outline-light border-0">
                <i class="fa-solid fa-user-circle me-1"></i>${auth.name}
            </a>
            <button onclick="logoutUser()" class="btn btn-outline-light">Logout</button>`;
    } else {
        nav.innerHTML = `
            <a href="index.html" class="btn btn-outline-light border-0">Home</a>
            <a href="signup.html" class="btn btn-outline-light border-0">Sign Up</a>
            <a href="login.html" class="btn btn-light" style="color:var(--primary-dark);font-weight:bold;">Login</a>`;
    }
}

/* ── Get hotel ID from URL ── */
function getHotelIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const id = parseInt(params.get('id'), 10);
    return isNaN(id) ? null : id;
}

/* ── Load hotel from API ── */
async function loadHotelDetails(hotelId) {
    try {
        const response = await fetch(`${API_BASE_URL}/api/hotels/${hotelId}`);
        if (response.status === 404) {
            showPageError('Hotel not found.');
            return;
        }
        if (!response.ok) throw new Error('Failed to load hotel details.');

        const hotel = await response.json();
        renderHeroSection(hotel);
        renderRoomTypes(hotel);
    } catch (err) {
        showPageError(err.message);
    }
}

/* ── Update hero section with real hotel data ── */
function renderHeroSection(hotel) {
    const hero = document.querySelector('.hotel-hero .container .col-md-8');
    if (!hero) return;

    const starsHtml = buildStarsHtml(hotel.stars);

    hero.innerHTML = `
        <span class="badge bg-light text-dark mb-2 px-3 py-2 text-uppercase fw-bold" style="letter-spacing:1px;">
            ${hotel.stars}-Star Hotel
        </span>
        <h1 class="display-4 fw-bold mb-2">${hotel.name}</h1>
        <p class="fs-5 opacity-75 mb-3">
            <i class="fa-solid fa-location-dot me-2"></i>${hotel.city}
            ${hotel.address ? `<span class="opacity-75 small ms-2">— ${hotel.address}</span>` : ''}
        </p>
        <div class="d-flex align-items-center gap-3">
            <div class="rating-stars fs-4">${starsHtml}</div>
            <span class="fs-5">${hotel.stars}.0 Stars</span>
        </div>
        ${hotel.description ? `<p class="mt-3 opacity-85 fs-6">${hotel.description}</p>` : ''}
    `;

    document.title = `Hotelia - ${hotel.name}`;
}

/* ── Render room type cards ── */
function renderRoomTypes(hotel) {
    const container = document.querySelector('.row.g-4');
    if (!container) return;

    if (!hotel.roomTypes || hotel.roomTypes.length === 0) {
        container.innerHTML = `
            <div class="col-12 text-center py-5 text-muted">
                <i class="fa-solid fa-bed fa-3x mb-3 opacity-50"></i>
                <p>No room types available for this hotel.</p>
            </div>`;
        return;
    }

    container.innerHTML = hotel.roomTypes.map(room => buildRoomCard(hotel, room)).join('');
}

/* ── Single room card HTML ── */
function buildRoomCard(hotel, room) {
    const icon = getRoomIcon(room.name);

    // Prefer dates from URL (passed from search), otherwise use defaults
    const params   = new URLSearchParams(window.location.search);
    const checkIn  = params.get('checkIn')  || getDefaultCheckIn();
    const checkOut = params.get('checkOut') || getDefaultCheckOut();

    return `
        <div class="col-md-4">
            <div class="room-card h-100 d-flex flex-column">
                <div class="room-img">
                    <img src="assets/hotel_test.png" alt="${room.name}"
                         style="width:100%;height:100%;object-fit:cover;border-radius:inherit;"
                         onerror="this.style.display='none';this.parentElement.innerHTML='<i class=\\'fa-solid ${icon}\\'></i>'">
                </div>
                <div class="p-4 d-flex flex-column flex-grow-1">
                    <h4 class="fw-bold mb-2">${room.name}</h4>
                    <p class="text-muted small mb-3">${room.description || 'Comfortable and well-equipped room for a perfect stay.'}</p>
                    <ul class="list-unstyled mb-4">
                        <li class="mb-2">
                            <i class="fa-solid fa-user-group me-2 text-muted"></i>
                            Capacity: ${room.capacity} Person${room.capacity !== 1 ? 's' : ''}
                        </li>
                        ${room.bedType ? `
                        <li class="mb-2">
                            <i class="fa-solid fa-bed me-2 text-muted"></i>
                            ${room.bedType}
                        </li>` : ''}
                        <li>
                            <i class="fa-solid fa-wifi me-2 text-muted"></i>
                            Free Wi-Fi
                        </li>
                    </ul>
                    <div class="mt-auto d-flex align-items-center justify-content-between">
                        <div class="room-price">
                            $${room.basePrice}
                            <span class="fs-6 text-muted fw-normal">/ night</span>
                        </div>
                        <a href="checkout.html?hotelId=${hotel.id}&roomTypeId=${room.id}&price=${room.basePrice}&checkIn=${checkIn}&checkOut=${checkOut}&hotelName=${encodeURIComponent(hotel.name)}&roomName=${encodeURIComponent(room.name)}"
                           class="btn btn-book text-decoration-none">
                            Book Now
                        </a>
                    </div>
                </div>
            </div>
        </div>`;
}

/* ── Helpers ── */
function buildStarsHtml(count) {
    const full = Math.floor(count);
    const half = count % 1 >= 0.5;
    let html = '';
    for (let i = 0; i < full; i++) html += '<i class="fa-solid fa-star"></i>';
    if (half) html += '<i class="fa-solid fa-star-half-stroke"></i>';
    return html;
}

function getRoomIcon(name) {
    if (!name) return 'fa-bed';
    const lower = name.toLowerCase();
    if (lower.includes('suite') || lower.includes('luxury')) return 'fa-crown';
    if (lower.includes('family')) return 'fa-people-roof';
    return 'fa-bed';
}

function getDefaultCheckIn() {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
}

function getDefaultCheckOut() {
    const d = new Date();
    d.setDate(d.getDate() + 4);
    return d.toISOString().split('T')[0];
}

function showPageError(message) {
    const main = document.querySelector('main');
    if (main) {
        main.innerHTML = `
            <div class="container py-5 text-center">
                <div class="alert alert-warning d-inline-block px-5 py-4">
                    <i class="fa-solid fa-triangle-exclamation fa-2x mb-3"></i>
                    <p class="mb-2 fw-bold">${message}</p>
                    <a href="index.html" class="btn btn-dark mt-2">Back to Home</a>
                </div>
            </div>`;
    }
}
