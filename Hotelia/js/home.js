/* ==========================================================================
   HOTELIA - HOME PAGE
   Handles: hotel search by city + dates, availability check, nav auth state
   API: GET /api/hotels?city=
        GET /api/room-types/{id}/availability?from=&to=
   ========================================================================== */

// Stored search params to pass to hotel_details
let _searchCheckIn  = '';
let _searchCheckOut = '';

document.addEventListener('DOMContentLoaded', () => {
    updateNavForAuthState();
    setDefaultDates();
    loadFeaturedHotels();

    document.querySelector('.modern-search-bar')
        ?.addEventListener('submit', handleSearch);

    const params = new URLSearchParams(window.location.search);
    if (params.get('denied') === '1') showAccessDeniedBanner();
});

/* ── Set default dates (today + 1 and today + 4) ── */
function setDefaultDates() {
    const checkInEl  = document.getElementById('checkIn');
    const checkOutEl = document.getElementById('checkOut');
    if (!checkInEl || !checkOutEl) return;

    const today = new Date();
    const in1   = new Date(today); in1.setDate(today.getDate() + 1);
    const in4   = new Date(today); in4.setDate(today.getDate() + 4);

    const fmt = d => d.toISOString().split('T')[0];
    checkInEl.value  = fmt(in1);
    checkInEl.min    = fmt(today);
    checkOutEl.value = fmt(in4);

    // Keep checkout always after checkin
    checkInEl.addEventListener('change', () => {
        checkOutEl.min = checkInEl.value;
        if (checkOutEl.value <= checkInEl.value) {
            const next = new Date(checkInEl.value);
            next.setDate(next.getDate() + 1);
            checkOutEl.value = next.toISOString().split('T')[0];
        }
    });
}

/* ── Nav ── */
function updateNavForAuthState() {
    const auth = getAuth();
    const nav  = document.querySelector('header nav.navig');
    if (!nav) return;

    if (auth) {
        nav.innerHTML = `
            <a href="profile.html" class="btn btn-outline-light">
                <i class="fa-solid fa-user-circle me-1"></i>${auth.name}
            </a>
            <button onclick="logoutUser()" class="btn btn-light"
                    style="color:var(--primary-dark);font-weight:bold;">Logout</button>`;
    }
}

function showAccessDeniedBanner() {
    const main = document.querySelector('main');
    if (!main) return;
    const div = document.createElement('div');
    div.className = 'container mt-3';
    div.innerHTML = `
        <div class="alert alert-warning alert-dismissible d-flex align-items-center gap-2" role="alert">
            <i class="fa-solid fa-shield-halved"></i>
            <span>Access denied. That page is for administrators only.</span>
            <button type="button" class="btn-close ms-auto" data-bs-dismiss="alert"></button>
        </div>`;
    main.insertAdjacentElement('afterbegin', div);
}

/* ════════════════════════════════════════
   SEARCH
   ════════════════════════════════════════ */
function handleSearch(e) {
    e.preventDefault();
    const city     = document.getElementById('destination')?.value.trim();
    const checkIn  = document.getElementById('checkIn')?.value;
    const checkOut = document.getElementById('checkOut')?.value;

    if (checkIn && checkOut && checkIn >= checkOut) {
        showSearchError('Check-out must be after check-in.');
        return;
    }

    _searchCheckIn  = checkIn  || '';
    _searchCheckOut = checkOut || '';

    loadFeaturedHotels(city, checkIn, checkOut);
}

function showSearchError(msg) {
    let errEl = document.getElementById('searchError');
    if (!errEl) {
        errEl = document.createElement('div');
        errEl.id = 'searchError';
        errEl.className = 'container mt-2';
        document.querySelector('.modern-search-bar')
            ?.insertAdjacentElement('afterend', errEl);
    }
    errEl.innerHTML = `<div class="alert alert-danger py-2 text-center">${msg}</div>`;
    setTimeout(() => { errEl.innerHTML = ''; }, 4000);
}

/* ════════════════════════════════════════
   LOAD HOTELS  (city filter only from API,
   availability check done client-side per hotel)
   ════════════════════════════════════════ */
async function loadFeaturedHotels(city = '', checkIn = '', checkOut = '') {
    const section = getOrCreateHotelsSection();
    showHotelsLoading(section);

    try {
        const url = city
            ? `${API_BASE_URL}/api/hotels?city=${encodeURIComponent(city)}`
            : `${API_BASE_URL}/api/hotels`;

        const res = await fetch(url);
        if (!res.ok) throw new Error('Failed to load hotels.');
        const hotels = await res.json();

        if (checkIn && checkOut) {
            // Filter hotels that have at least one room available in the date range
            await renderHotelsWithAvailability(section, hotels, city, checkIn, checkOut);
        } else {
            renderHotels(section, hotels, city, '', '');
        }
    } catch (err) {
        showHotelsError(section, err.message);
    }
}

/* ── When dates are given: check each hotel's room availability ── */
async function renderHotelsWithAvailability(section, hotels, city, checkIn, checkOut) {
    if (!hotels.length) {
        renderHotels(section, [], city, checkIn, checkOut);
        return;
    }

    // Show skeleton while checking
    showHotelsLoading(section, `Checking availability for ${formatDate(checkIn)} → ${formatDate(checkOut)}...`);

    // For each hotel, check if any of its room types has at least one available night
    const availabilityResults = await Promise.all(
        hotels.map(async hotel => {
            const roomTypes = hotel.roomTypes || [];
            if (!roomTypes.length) return { hotel, available: false, minAvailablePrice: null };

            // Check all room types in parallel
            const roomChecks = await Promise.all(
                roomTypes.map(rt => checkRoomAvailability(rt.id, checkIn, checkOut, rt.basePrice))
            );

            const availableRooms = roomChecks.filter(r => r.available);
            const minPrice = availableRooms.length
                ? Math.min(...availableRooms.map(r => r.basePrice))
                : null;

            return { hotel, available: availableRooms.length > 0, minAvailablePrice: minPrice };
        })
    );

    const availableHotels = availabilityResults.filter(r => r.available);
    renderHotels(section, availableHotels.map(r => r.hotel), city, checkIn, checkOut,
                 Object.fromEntries(availableHotels.map(r => [r.hotel.id, r.minAvailablePrice])));
}

/* ── Check if a room type has availability for every night in range ── */
async function checkRoomAvailability(roomTypeId, checkIn, checkOut, basePrice) {
    try {
        const res = await fetch(
            `${API_BASE_URL}/api/room-types/${roomTypeId}/availability?from=${checkIn}&to=${checkOut}`
        );
        if (!res.ok) return { available: false, basePrice };
        const records = await res.json();

        // Must have a record for every night, each with availableRooms > 0
        const nights = daysBetween(checkIn, checkOut);
        if (records.length < nights) return { available: false, basePrice };

        const allAvailable = records.every(r => r.availableRooms > 0);
        return { available: allAvailable, basePrice };
    } catch {
        return { available: false, basePrice };
    }
}

/* ════════════════════════════════════════
   RENDER
   ════════════════════════════════════════ */
function getOrCreateHotelsSection() {
    let s = document.getElementById('hotels-results-section');
    if (s) return s;
    s = document.createElement('section');
    s.id = 'hotels-results-section';
    s.className = 'py-5';
    s.style.backgroundColor = 'var(--background-color, #f7f4ef)';
    document.querySelector('main')?.appendChild(s);
    return s;
}

function showHotelsLoading(section, msg = 'Loading hotels...') {
    section.innerHTML = `
        <div class="container">
            <div class="text-center py-5">
                <div class="spinner-border text-secondary" role="status"
                     style="width:3rem;height:3rem;"></div>
                <p class="mt-3 text-muted">${msg}</p>
            </div>
        </div>`;
}

function showHotelsError(section, message) {
    section.innerHTML = `
        <div class="container">
            <div class="alert alert-warning text-center" role="alert">
                <i class="fa-solid fa-triangle-exclamation me-2"></i>
                ${message || 'Could not load hotels. Make sure the API is running.'}
            </div>
        </div>`;
}

function renderHotels(section, hotels, searchQuery, checkIn, checkOut, priceOverrides = {}) {
    if (!hotels || hotels.length === 0) {
        const dateMsg = checkIn && checkOut
            ? ` for ${formatDate(checkIn)} → ${formatDate(checkOut)}`
            : '';
        section.innerHTML = `
            <div class="container">
                <div class="text-center py-5 text-muted">
                    <i class="fa-solid fa-magnifying-glass fa-3x mb-3 opacity-50"></i>
                    <h4>No available hotels found${searchQuery ? ` in "${searchQuery}"` : ''}${dateMsg}.</h4>
                    <p class="mb-3">Try different dates or a different destination.</p>
                    <button class="btn btn-dark px-4" onclick="loadFeaturedHotels()">
                        <i class="fa-solid fa-rotate-right me-2"></i>Show all hotels
                    </button>
                </div>
            </div>`;
        return;
    }

    let heading = searchQuery
        ? `Results for <span style="color:var(--primary-color)">"${searchQuery}"</span>`
        : 'Featured Hotels';

    if (checkIn && checkOut) {
        heading += ` <span class="fs-6 fw-normal text-muted ms-2">
            <i class="fa-regular fa-calendar me-1"></i>
            ${formatDate(checkIn)} → ${formatDate(checkOut)}
            &nbsp;·&nbsp; ${daysBetween(checkIn, checkOut)} night${daysBetween(checkIn, checkOut) !== 1 ? 's' : ''}
        </span>`;
    }

    const cards = hotels.map(hotel => {
        const overridePrice = priceOverrides[hotel.id] ?? null;
        return buildHotelCard(hotel, checkIn, checkOut, overridePrice);
    }).join('');

    section.innerHTML = `
        <div class="container py-3">
            <h2 class="fw-bold mb-4" style="color:var(--text-color)">${heading}</h2>
            <div class="row g-4">${cards}</div>
        </div>`;
}

/* ── Single hotel card ── */
function buildHotelCard(hotel, checkIn, checkOut, availableMinPrice) {
    const stars    = buildStars(hotel.stars);
    const minPrice = availableMinPrice ?? getMinPrice(hotel.roomTypes);
    const img      = hotel.thumbnailUrl
        ? `<img src="${hotel.thumbnailUrl}" alt="${hotel.name}"
               class="card-img-top" style="height:200px;object-fit:cover;"
               onerror="this.src='assets/hotel_test.png'">`
        : `<img src="assets/hotel_test.png" alt="${hotel.name}"
               class="card-img-top" style="height:200px;object-fit:cover;">`;

    // Pass dates to hotel_details so the "Book Now" button uses them
    const dateParams = checkIn && checkOut
        ? `&checkIn=${checkIn}&checkOut=${checkOut}`
        : '';

    const availBadge = checkIn && checkOut
        ? `<span class="badge bg-success mb-2">
               <i class="fa-solid fa-circle-check me-1"></i>Available
           </span>`
        : '';

    return `
        <div class="col-md-6 col-lg-4">
            <div class="card h-100 shadow-sm border-0 rounded-3 overflow-hidden">
                ${img}
                <div class="card-body p-4 d-flex flex-column">
                    ${availBadge}
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <h5 class="fw-bold mb-0" style="color:var(--text-color)">${hotel.name}</h5>
                        <div class="text-warning small">${stars}</div>
                    </div>
                    <p class="text-muted small mb-3">
                        <i class="fa-solid fa-location-dot me-1"></i>${hotel.city}
                    </p>
                    ${hotel.description
                        ? `<p class="text-muted small mb-3 flex-grow-1">${truncate(hotel.description, 90)}</p>`
                        : '<div class="flex-grow-1"></div>'}
                    <div class="d-flex justify-content-between align-items-center mt-auto">
                        <div>
                            ${minPrice !== null
                                ? `<span class="fw-bold fs-5" style="color:var(--success-color)">$${minPrice}</span>
                                   <span class="text-muted small">/ night</span>`
                                : `<span class="text-muted small">Prices vary</span>`}
                        </div>
                        <a href="hotel_details.html?id=${hotel.id}${dateParams}"
                           class="btn btn-sm btn-dark px-3">
                            View Rooms
                        </a>
                    </div>
                </div>
            </div>
        </div>`;
}

/* ════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════ */
function buildStars(count) {
    let html = '';
    for (let i = 0; i < Math.floor(count); i++) html += '<i class="fa-solid fa-star"></i>';
    if (count % 1 >= 0.5) html += '<i class="fa-solid fa-star-half-stroke"></i>';
    return html;
}

function getMinPrice(roomTypes) {
    if (!roomTypes?.length) return null;
    return Math.min(...roomTypes.map(r => r.basePrice));
}

function truncate(str, max) {
    if (!str) return '';
    return str.length <= max ? str : str.slice(0, max) + '…';
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysBetween(from, to) {
    return Math.round((new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24));
}
