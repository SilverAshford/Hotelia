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
    } else {
        nav.innerHTML = `
            <button class="nav-toggler" onclick="this.nextElementSibling.classList.toggle('open')" aria-label="Toggle navigation">
                <i class="fa-solid fa-bars"></i>
            </button>
            <div class="nav-collapse">
                <a href="index.html" class="btn btn-outline-light border-0">Home</a>
                <a href="signup.html" class="btn btn-outline-light border-0">Sign Up</a>
                <a href="login.html" class="btn btn-light" style="color:var(--primary-dark);font-weight:bold;">Login</a>
            </div>`;
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
        const [hotelResponse, ratingResponse] = await Promise.all([
            fetch(`${API_BASE_URL}/api/hotels/${hotelId}`),
            fetch(`${API_BASE_URL}/api/hotels/${hotelId}/rating`)
        ]);

        if (hotelResponse.status === 404) {
            showPageError('Hotel not found.');
            return;
        }
        if (!hotelResponse.ok || !ratingResponse.ok) {
            throw new Error('Failed to load hotel details.');
        }

        const hotel = await hotelResponse.json();
        const ratingData = await ratingResponse.json();
        
        renderHeroSection(hotel, ratingData);
        renderRoomTypes(hotel);
        loadHotelReviews(hotelId);
    } catch (err) {
        showPageError(err.message);
    }
}

/* ── Update hero section with real hotel data ── */
function renderHeroSection(hotel, ratingData) {
    const hero = document.querySelector('.hotel-hero .container .col-md-8');
    if (!hero) return;

    const starsHtml = buildStarsHtml(hotel.stars);

    // Build rating display
    let ratingDisplay = '';
    if (ratingData && ratingData.totalReviews > 0) {
        ratingDisplay = `
            <div class="rating-stars fs-4 text-warning">${buildStarsHtml(Math.round(ratingData.averageRating))}</div>
            <span class="fs-5">
                <strong>${ratingData.averageRating}</strong> / 5.0 
                <span>--- (${ratingData.totalReviews} review${ratingData.totalReviews !== 1 ? 's' : ''})</span>
            </span>`;
    } else {
        ratingDisplay = `
            <div class="rating-stars fs-4">${starsHtml}</div>
            <span class="fs-5">${hotel.stars}.0 Stars <span class="text-muted">(No reviews yet)</span></span>`;
    }

    hero.innerHTML = `
        <span class="badge bg-light text-dark mb-2 px-3 py-2 text-uppercase fw-bold" style="letter-spacing:1px;">
            ${hotel.stars}-Star Hotel
        </span>
        <h1 class="display-4 fw-bold mb-2">${hotel.name}</h1>
        <p class="fs-5 opacity-75 mb-3">
            <i class="fa-solid fa-location-dot me-2"></i>${hotel.city}
            ${hotel.address ? `<span class="opacity-75 small ms-2">— ${hotel.address}</span>` : ''}
        </p>
        <div class="d-flex flex-wrap align-items-center gap-2 gap-md-3" id="hotelRatingHero">
            ${ratingDisplay}
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
                        <a href="checkout.html?hotelId=${hotel.id}&roomTypeId=${room.id}&price=${room.basePrice}&checkIn=${checkIn}&checkOut=${checkOut}&hotelName=${encodeURIComponent(hotel.name)}&roomName=${encodeURIComponent(room.name)}&capacity=${room.capacity}"
                           class="btn btn-book text-decoration-none">
                            Book Now
                        </a>
                    </div>
                </div>
            </div>
        </div>`;
}

/* ── Helpers ── */
function buildStarsHtml(count, max = 5) {
    const clamped = Math.max(0, Math.min(count, max));
    const full = Math.floor(clamped);
    const half = clamped % 1 >= 0.5;
    let html = '';
    for (let i = 0; i < full; i++) html += '<i class="fa-solid fa-star"></i>';
    if (half && full < max) html += '<i class="fa-solid fa-star-half-stroke"></i>';
    const filled = full + (half ? 1 : 0);
    for (let i = filled; i < max; i++) html += '<i class="fa-regular fa-star"></i>';
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

/* ══════════════════════════════════════════════════════════════════════════
   REVIEWS SECTION
   ══════════════════════════════════════════════════════════════════════════ */

async function loadHotelReviews(hotelId) {
    const container = document.getElementById('reviewsContainer');
    const ratingDisplay = document.getElementById('averageRatingDisplay');

    try {
        // Load reviews and average rating in parallel
        const [reviewsRes, ratingRes] = await Promise.all([
            fetch(`${API_BASE_URL}/api/hotels/${hotelId}/reviews`),
            fetch(`${API_BASE_URL}/api/hotels/${hotelId}/rating`)
        ]);

        if (!reviewsRes.ok || !ratingRes.ok) throw new Error('Failed to load reviews.');

        const reviews = await reviewsRes.json();
        const ratingData = await ratingRes.json();

        // Display average rating
        if (ratingData.totalReviews > 0) {
            ratingDisplay.innerHTML = `
                <div class="d-flex align-items-center gap-2">
                    <div class="fs-2 fw-bold" style="color:var(--primary-color);">${ratingData.averageRating}</div>
                    <div class="text-start">
                        <div class="text-warning">${buildStarsHtml(Math.round(ratingData.averageRating))}</div>
                        <div class="small text-muted">${ratingData.totalReviews} review${ratingData.totalReviews !== 1 ? 's' : ''}</div>
                    </div>
                </div>`;
        } else {
            ratingDisplay.innerHTML = '<div class="text-muted small">No reviews yet</div>';
        }

        // Display reviews
        if (reviews.length === 0) {
            container.innerHTML = `
                <div class="text-center py-5 text-muted">
                    <i class="fa-solid fa-comment-slash fa-3x mb-3 opacity-50"></i>
                    <p class="mb-0">No reviews yet. Be the first to review this hotel!</p>
                </div>`;
            return;
        }

        container.innerHTML = reviews.map(renderReviewCard).join('');
    } catch (err) {
        container.innerHTML = `
            <div class="alert alert-warning text-center">
                <i class="fa-solid fa-triangle-exclamation me-2"></i>
                ${err.message || 'Could not load reviews.'}
            </div>`;
    }
}

function renderReviewCard(review) {
    const auth = getAuth();
    const isOwner = auth && getUserIdFromAuth(auth) === review.userId;
    
    const date = new Date(review.createdAt).toLocaleDateString('en-GB', { 
        day: 'numeric', month: 'short', year: 'numeric' 
    });

    const editBtnId = `edit-review-btn-${review.id}`;
    const deleteBtnId = `delete-review-btn-${review.id}`;

    const card = `
        <div class="card border-0 shadow-sm mb-3 p-4" id="review-${review.id}">
            <div class="d-flex justify-content-between align-items-start mb-3">
                <div class="d-flex align-items-center gap-3">
                    <div style="width:48px;height:48px;border-radius:50%;background:var(--primary-color);
                                color:#fff;display:flex;align-items:center;justify-content:center;
                                font-weight:bold;font-size:1.25rem;">
                        ${review.userName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div class="fw-bold">${review.userName}</div>
                        <div class="small text-muted">
                            <i class="fa-regular fa-calendar me-1"></i>${date}
                        </div>
                    </div>
                </div>
                <div class="d-flex align-items-center gap-3">
                    <div class="text-warning fs-5">
                        ${buildStarsHtml(review.rating)}
                    </div>
                    ${isOwner ? `
                        <div class="dropdown">
                            <button class="btn btn-sm btn-light" type="button" data-bs-toggle="dropdown">
                                <i class="fa-solid fa-ellipsis-vertical"></i>
                            </button>
                            <ul class="dropdown-menu dropdown-menu-end">
                                <li>
                                    <a class="dropdown-item" href="#" id="${editBtnId}">
                                        <i class="fa-solid fa-pen me-2"></i>Edit
                                    </a>
                                </li>
                                <li>
                                    <a class="dropdown-item text-danger" href="#" id="${deleteBtnId}">
                                        <i class="fa-solid fa-trash me-2"></i>Delete
                                    </a>
                                </li>
                            </ul>
                        </div>
                    ` : ''}
                </div>
            </div>
            ${review.comment ? `<p class="text-muted mb-0" id="review-comment-${review.id}">${escapeHtml(review.comment)}</p>` : ''}
        </div>`;

    // Attach event listeners after rendering
    setTimeout(() => {
        if (isOwner) {
            const editBtn = document.getElementById(editBtnId);
            const deleteBtn = document.getElementById(deleteBtnId);
            
            if (editBtn) {
                editBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    editReview(review.id, review.rating, review.comment || '');
                });
            }
            
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    deleteReview(review.id);
                });
            }
        }
    }, 0);

    return card;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function escapeForJs(text) {
    if (!text) return '';
    return text.replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '');
}

/* ══════════════════════════════════════════════════════════════════════════
   EDIT & DELETE REVIEWS
   ══════════════════════════════════════════════════════════════════════════ */

async function editReview(reviewId, currentRating, currentComment) {
    const auth = getAuth();
    if (!auth) {
        window.location.href = 'login.html';
        return;
    }

    // Create or update edit modal (replace legacy markup from older versions)
    let modal = document.getElementById('editReviewModal');
    if (modal && !modal.querySelector('button[data-rating]')) {
        modal.remove();
        modal = null;
    }
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'editReviewModal';
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header" style="background:var(--primary-color);color:#fff;">
                        <h5 class="modal-title fw-bold">
                            <i class="fa-solid fa-pen me-2"></i>
                            Edit Your Review
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-4">
                        <form id="editReviewForm">
                            <input type="hidden" id="editReviewId">
                            
                            <div class="mb-3">
                                <label class="form-label fw-bold">Rating *</label>
                                <div class="d-flex align-items-center gap-2 flex-wrap">
                                    <div class="d-flex gap-1" id="editRatingStars">
                                        ${[1, 2, 3, 4, 5].map(n => `
                                            <button type="button" class="edit-rating-star p-0 border-0 bg-transparent lh-1"
                                                    data-rating="${n}" aria-label="Rate ${n} star${n !== 1 ? 's' : ''}">
                                                <i class="fa-solid fa-star" style="font-size:2rem;color:#ddd;pointer-events:none;"></i>
                                            </button>`).join('')}
                                    </div>
                                    <span class="text-muted small" id="editRatingStarsLabel"></span>
                                </div>
                                <input type="hidden" id="editReviewRating" required>
                            </div>

                            <div class="mb-3">
                                <label class="form-label fw-bold">Comment (Optional)</label>
                                <textarea class="form-control" id="editReviewComment" rows="4" 
                                          maxlength="1000" placeholder="Share your experience..."></textarea>
                                <div class="form-text">Maximum 1000 characters</div>
                            </div>

                            <div id="editReviewFormMsg"></div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-dark px-4" id="updateReviewBtn">
                            <i class="fa-solid fa-check me-2"></i>Update Review
                        </button>
                    </div>
                </div>
            </div>`;
        document.body.appendChild(modal);

        // Setup update button
        document.getElementById('updateReviewBtn').addEventListener('click', () => submitEditReview(auth));
        initStarRatingPicker('editRatingStars', 'editReviewRating', 'editRatingStarsLabel');
    }

    // Fill form with existing data
    document.getElementById('editReviewId').value = reviewId;
    document.getElementById('editReviewComment').value = currentComment;
    document.getElementById('editReviewFormMsg').innerHTML = '';
    setStarRatingPickerValue('editRatingStars', 'editReviewRating', 'editRatingStarsLabel', currentRating);

    // Show modal
    new bootstrap.Modal(modal).show();
}

async function submitEditReview(auth) {
    const reviewId = parseInt(document.getElementById('editReviewId').value, 10);
    const rating = parseInt(document.getElementById('editReviewRating').value, 10);
    const comment = document.getElementById('editReviewComment').value.trim();
    const msgEl = document.getElementById('editReviewFormMsg');

    msgEl.innerHTML = '';

    if (!rating || rating < 1 || rating > 5) {
        msgEl.innerHTML = '<div class="alert alert-danger py-2">Please select a rating.</div>';
        return;
    }

    const btn = document.getElementById('updateReviewBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Updating...';

    try {
        const response = await fetch(`${API_BASE_URL}/api/reviews/${reviewId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth.token}`
            },
            body: JSON.stringify({ rating, comment: comment || null })
        });

        if (!response.ok) {
            const error = await parseApiError(response);
            throw new Error(error);
        }

        bootstrap.Modal.getInstance(document.getElementById('editReviewModal')).hide();
        
        showToast('Review updated successfully!', 'success');

        // Reload reviews
        const hotelId = getHotelIdFromUrl();
        setTimeout(() => loadHotelReviews(hotelId), 500);
    } catch (err) {
        msgEl.innerHTML = `<div class="alert alert-danger py-2">${err.message}</div>`;
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-check me-2"></i>Update Review';
    }
}

async function deleteReview(reviewId) {
    const auth = getAuth();
    if (!auth) {
        window.location.href = 'login.html';
        return;
    }

    if (!confirm('Are you sure you want to delete this review? This action cannot be undone.')) {
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/reviews/${reviewId}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${auth.token}`
            }
        });

        if (!response.ok) {
            const error = await parseApiError(response);
            throw new Error(error);
        }

        showToast('Review deleted successfully!', 'success');

        // Reload reviews
        const hotelId = getHotelIdFromUrl();
        setTimeout(() => loadHotelReviews(hotelId), 500);
    } catch (err) {
        showToast(err.message || 'Could not delete review.', 'error');
    }
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
