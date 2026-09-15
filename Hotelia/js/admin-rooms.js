/* ==========================================================================
   HOTELIA - ADMIN ROOM TYPES MANAGEMENT
   One page does everything:
     • Pick a hotel → see its room types
     • Add / Edit / Delete room types
     • Click "Manage Availability" on any room →
         set how many rooms are available from date A to date B
   
   API:
     GET  /api/hotels
     POST /api/admin/hotels/{hotelId}/room-types
     PUT  /api/admin/room-types/{id}
     DELETE /api/admin/room-types/{id}
     GET  /api/room-types/{id}/availability?from=&to=
     PUT  /api/admin/room-inventory  { roomTypeId, date, totalRooms }
   ========================================================================== */

let allHotels      = [];
let allRoomTypes   = [];   // rooms of the currently selected hotel
let selectedHotel  = null;
let editingRoom    = null;  // currently editing room (for validation)

document.addEventListener('DOMContentLoaded', () => {
    let auth;
    try { 
        auth = requireAdminAuth();
        // Only real Admin can access this page
        if (String(auth.role).toLowerCase() !== 'admin') {
            window.location.href = 'admin.html';
            return;
        }
    } catch { return; }

    injectModals();
    loadHotels(auth);
});

/* ════════════════════════════════════════
   STEP 1 — Load hotels into the selector
   ════════════════════════════════════════ */
async function loadHotels(auth) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/hotels`);
        if (!res.ok) throw new Error('Failed to load hotels.');
        allHotels = await res.json();
        buildHotelSelector(auth);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function buildHotelSelector(auth) {
    const container = document.querySelector('.container.admin-section');
    if (!container) return;

    // Insert hotel picker card before the table
    let picker = document.getElementById('hotelPickerCard');
    if (!picker) {
        picker = document.createElement('div');
        picker.id = 'hotelPickerCard';
        picker.className = 'filter-card mb-4';

        const tableSection = container.querySelector('.table-responsive');
        container.insertBefore(picker, tableSection);
    }

    picker.innerHTML = `
        <div class="row g-3 align-items-end">
            <div class="col-md-6">
                <label class="form-label fw-bold small text-muted text-uppercase">
                    <i class="fa-solid fa-building me-1"></i>Select Hotel
                </label>
                <select class="form-select" id="hotelPickerSelect">
                    <option value="">— Choose a hotel to see its rooms —</option>
                    ${allHotels.map(h => `<option value="${h.id}">${h.name} (${h.city})</option>`).join('')}
                </select>
            </div>
            <div class="col-md-6 d-flex align-items-end gap-2 room-picker-actions">
                <button class="btn btn-dark room-picker-btn" id="loadRoomsBtn">
                    <i class="fa-solid fa-eye me-2"></i>View Rooms
                </button>
                <button class="btn btn-add room-picker-btn" id="addRoomBtnTop" style="display:none;">
                    <i class="fa-solid fa-plus me-2"></i>Add Room Type
                </button>
            </div>
        </div>
        <div id="selectedHotelInfo" class="mt-3" style="display:none;"></div>`;

    document.getElementById('loadRoomsBtn')?.addEventListener('click', () => {
        const hotelId = parseInt(document.getElementById('hotelPickerSelect').value, 10);
        if (!hotelId) { showToast('Please select a hotel first.', 'error'); return; }
        selectedHotel = allHotels.find(h => h.id === hotelId);
        loadRoomTypes(auth, hotelId);
    });

    document.getElementById('addRoomBtnTop')?.addEventListener('click', () => {
        if (!selectedHotel) return;
        openRoomModal(null, auth);
    });

    // Also wire the original "Add Room Type" button in the header area
    document.querySelector('.btn-add')?.addEventListener('click', () => {
        if (!selectedHotel) { showToast('Select a hotel first.', 'error'); return; }
        openRoomModal(null, auth);
    });
}

/* ════════════════════════════════════════
   STEP 2 — Load room types for a hotel
   ════════════════════════════════════════ */
async function loadRoomTypes(auth, hotelId) {
    const tbody = document.querySelector('.table-custom tbody');
    if (!tbody) return;

    // Update the thead to match our new columns
    const thead = document.querySelector('.table-custom thead tr');
    if (thead) {
        thead.innerHTML = `
            <th class="py-3 px-4">Room Type</th>
            <th class="py-3">Capacity</th>
            <th class="py-3 text-center">Total Rooms</th>
            <th class="py-3 text-center">Booked</th>
            <th class="py-3 text-center">Available</th>
            <th class="py-3">Base Price / Night</th>
            <th class="py-3 text-end px-4">Actions</th>`;
    }

    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4">
        <div class="spinner-border text-secondary"></div>
        <p class="mt-2 text-muted mb-0">Loading rooms...</p></td></tr>`;

    // Show hotel info banner
    const infoEl = document.getElementById('selectedHotelInfo');
    if (infoEl && selectedHotel) {
        infoEl.style.display = 'block';
        infoEl.innerHTML = `
            <div class="d-flex align-items-center gap-3 p-3 rounded-3" 
                 style="background:var(--background-color);border:1px solid var(--border-color);">
                <i class="fa-solid fa-building fa-2x" style="color:var(--primary-color);"></i>
                <div>
                    <div class="fw-bold fs-6" style="color:var(--text-color);">${selectedHotel.name}</div>
                    <div class="small text-muted">
                        <i class="fa-solid fa-location-dot me-1"></i>${selectedHotel.city}
                        &nbsp;·&nbsp;
                        <i class="fa-solid fa-star text-warning me-1"></i>${selectedHotel.stars} Stars
                    </div>
                </div>
            </div>`;
    }
    document.getElementById('addRoomBtnTop').style.display = 'inline-flex';

    try {
        const res = await fetch(`${API_BASE_URL}/api/hotels/${hotelId}`);
        if (!res.ok) throw new Error('Failed to load hotel rooms.');
        const hotel = await res.json();
        allHotels = allHotels.map(h => h.id === hotel.id ? hotel : h); // update cache
        allRoomTypes = hotel.roomTypes || [];
        renderRoomsTable(tbody, allRoomTypes, auth);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-danger">${err.message}</td></tr>`;
    }
}

function renderRoomsTable(tbody, rooms, auth) {
    if (!rooms.length) {
        tbody.innerHTML = `
            <tr><td colspan="7" class="text-center py-5 text-muted">
                <i class="fa-solid fa-bed fa-2x mb-2 d-block opacity-50"></i>
                No room types yet. Click "Add Room Type" to create one.
            </td></tr>`;

        const mobileWrapper = document.getElementById('roomTypesMobileWrapper');
        if (mobileWrapper) {
            mobileWrapper.innerHTML = `<p class="text-center text-muted py-4">No room types yet. Click "Add Room Type" to create one.</p>`;
        }
        return;
    }

    // ── Desktop table rows ──
    tbody.innerHTML = rooms.map(r => {
        const total = r.totalRooms ?? 0;
        const booked = r.bookedRooms ?? 0;
        const available = r.availableRooms ?? total;
        const maxBooked = r.maxBookedRooms ?? 0;
        const availClass = available <= 0 ? 'text-danger' : available <= 2 ? 'text-warning' : 'text-success';

        return `
        <tr id="room-row-${r.id}">
            <td class="px-4">
                <div class="fw-semibold">${r.name}</div>
                <div class="text-muted small mt-1">
                    ${r.bedType || 'Standard bed'}
                    ${r.availableFrom && r.availableTo
                        ? ` · <i class="fa-regular fa-calendar me-1"></i>${formatDate(r.availableFrom)} → ${formatDate(r.availableTo)}`
                        : ''}
                </div>
                ${r.description ? `<div class="text-muted small mt-1">${truncate(r.description, 50)}</div>` : ''}
            </td>
            <td>
                <i class="fa-solid fa-user me-1 text-muted"></i>
                ${r.capacity} Person${r.capacity !== 1 ? 's' : ''}
            </td>
            <td class="text-center fw-bold">${total}</td>
            <td class="text-center fw-bold" style="color:var(--danger-color);">${booked}</td>
            <td class="text-center fw-bold ${availClass}">${available}</td>
            <td class="fw-bold" style="color:var(--success-color);">$${r.basePrice}</td>
            <td class="text-end px-2">
                <div class="d-flex justify-content-end gap-1 flex-wrap">
                    <button class="btn btn-sm btn-outline-dark" onclick="openAvailabilityPanel(${r.id}, '${escHtml(r.name)}', ${maxBooked})" title="View bookings for this room">
                        <i class="fa-solid fa-calendar-check"></i>
                    </button>
                    <button class="btn btn-sm btn-edit" onclick="openRoomModal(${r.id}, currentAuth)" title="Edit">
                        <i class="fa-solid fa-pen"></i>
                    </button>
                    <button class="btn btn-sm btn-delete" onclick="deleteRoomType(${r.id}, '${escHtml(r.name)}')" title="Delete">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join('');

    // ── Mobile cards ──
    const mobileWrapper = document.getElementById('roomTypesMobileWrapper');
    if (mobileWrapper) {
        mobileWrapper.innerHTML = rooms.map(r => {
            const imgSrc = hotelThumbFromName(selectedHotel?.name);

            return `
            <div class="room-mobile-card mb-3 p-3" id="room-card-mobile-${r.id}">
                <div class="d-flex gap-3 align-items-center mb-3">
                    <img src="${imgSrc}" alt="${r.name}" class="room-thumb-mobile rounded"
                         style="object-fit:cover;"
                         onerror="this.src='assets/hotel.jpg'">
                    <div>
                        <h5 class="fw-bold mb-1">${r.name}</h5>
                        <p class="text-muted small mb-0">
                            <i class="fa-solid fa-users me-1"></i>${r.capacity} Guest${r.capacity !== 1 ? 's' : ''}
                            ${r.bedType ? ` &bull; <i class="fa-solid fa-bed me-1"></i>${r.bedType}` : ''}
                        </p>
                        <p class="fw-bold small mb-0 mt-1" style="color:var(--success-color);">$${r.basePrice} / night</p>
                        <p class="small mb-0 mt-2">
                            <span class="badge bg-light text-dark border me-1">${r.totalRooms ?? 0} total</span>
                            <span class="badge bg-danger-subtle text-danger border me-1">${r.bookedRooms ?? 0} booked</span>
                            <span class="badge bg-success-subtle text-success border">${r.availableRooms ?? 0} available</span>
                        </p>
                        ${r.availableFrom && r.availableTo ? `<p class="text-muted small mb-0 mt-1"><i class="fa-solid fa-calendar me-1"></i>${formatDate(r.availableFrom)} → ${formatDate(r.availableTo)}</p>` : ''}
                        ${r.description ? `<p class="text-muted small mb-0 mt-1">${truncate(r.description, 60)}</p>` : ''}
                    </div>
                </div>
                <div class="d-flex gap-2 pt-2 border-top">
                    <button class="btn btn-outline-dark flex-fill" onclick="openAvailabilityPanel(${r.id}, '${escHtml(r.name)}', ${r.maxBookedRooms ?? 0})">
                        <i class="fa-solid fa-calendar-check me-1"></i>Bookings
                    </button>
                    <button class="btn btn-edit flex-fill" onclick="openRoomModal(${r.id}, currentAuth)">
                        <i class="fa-solid fa-pen me-1"></i>Edit
                    </button>
                    <button class="btn btn-delete flex-fill" onclick="deleteRoomType(${r.id}, '${escHtml(r.name)}')">
                        <i class="fa-solid fa-trash me-1"></i>Delete
                    </button>
                </div>
            </div>`;
        }).join('');
    }

    // Store auth for use in inline onclick
    window.currentAuth = auth;
}

/* ════════════════════════════════════════
   ROOM TYPE MODAL — Add / Edit
   ════════════════════════════════════════ */
function injectModals() {
    if (!document.getElementById('roomModal')) {
        document.body.insertAdjacentHTML('beforeend', `
        <div class="modal fade" id="roomModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header bg-dark text-white">
                        <h5 class="modal-title fw-bold" id="roomModalTitle">Add Room Type</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-4">
                        <form id="roomForm" novalidate>
                            <input type="hidden" id="roomIdField">
                            <div class="row g-3">
                                <div class="col-md-6">
                                    <label class="form-label fw-bold">Room Type Name *</label>
                                    <input type="text" class="form-control" id="roomName" placeholder="e.g. Luxury Suite" required>
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label fw-bold">Capacity *</label>
                                    <input type="number" class="form-control" id="roomCapacity" value="2" min="1" max="20">
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label fw-bold">Base Price / Night ($) *</label>
                                    <input type="number" class="form-control" id="roomPrice" min="1" required>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label fw-bold">Bed Type</label>
                                    <input type="text" class="form-control" id="roomBedType" placeholder="e.g. King Bed, Twin Beds">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label fw-bold">Total Rooms *</label>
                                    <input type="number" class="form-control" id="roomTotal" value="10" min="1"
                                           placeholder="e.g. 10 rooms">
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label fw-bold">Available From (Check-in) *</label>
                                    <input type="date" class="form-control" id="roomAvailableFrom" required>
                                </div>
                                <div class="col-md-6">
                                    <label class="form-label fw-bold">Available Until (Check-out) *</label>
                                    <input type="date" class="form-control" id="roomAvailableTo" required>
                                    <div class="form-text">The check-out date is not bookable as an overnight stay.</div>
                                </div>
                                <div class="col-12">
                                    <label class="form-label fw-bold">Description</label>
                                    <textarea class="form-control" id="roomDescription" rows="2"
                                              placeholder="Brief description of this room type..."></textarea>
                                </div>
                            </div>
                            <div id="roomFormMsg" class="mt-3"></div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-dark px-4" id="roomSaveBtn" onclick="saveRoomType()">
                            Save Room Type
                        </button>
                    </div>
                </div>
            </div>
        </div>`);
    }

    if (!document.getElementById('availabilityModal')) {
        document.body.insertAdjacentHTML('beforeend', `
        <div class="modal fade" id="availabilityModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-xl">
                <div class="modal-content">
                    <div class="modal-header" style="background:var(--header-gradient);">
                        <div>
                            <h5 class="modal-title fw-bold text-white" id="availModalTitle">
                                <i class="fa-solid fa-calendar-check me-2"></i>Room Bookings
                            </h5>
                            <p class="text-white opacity-75 small mb-0" id="availModalSubtitle"></p>
                        </div>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-4">

                        <!-- Active bookings for this room type -->
                        <div>
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <h6 class="fw-bold mb-0" style="color:var(--primary-color);">
                                    <i class="fa-solid fa-list-check me-2"></i>Active Bookings for This Room
                                </h6>
                                <button class="btn btn-sm btn-outline-dark" id="refreshRoomBookingsBtn">
                                    <i class="fa-solid fa-rotate-right me-1"></i>Refresh
                                </button>
                            </div>
                            <div id="roomBookingsList">
                                <div class="text-center text-muted py-3 small">Loading bookings...</div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        </div>`);
    }
}

/* ════════════════════════════════════════
   ROOM TYPE — Open modal
   ════════════════════════════════════════ */
function openRoomModal(id, auth) {
    document.getElementById('roomFormMsg').innerHTML = '';
    const isEdit = id !== null;
    document.getElementById('roomModalTitle').textContent = isEdit ? 'Edit Room Type' : 'Add Room Type';

    const totalInput = document.getElementById('roomTotal');

    if (isEdit) {
        const room = allRoomTypes.find(r => r.id === id);
        if (!room) return;
        editingRoom = room;  // Store for validation
        const minTotal = room.maxBookedRooms ?? 0;
        document.getElementById('roomIdField').value     = room.id;
        document.getElementById('roomName').value        = room.name;
        document.getElementById('roomCapacity').value    = room.capacity;
        document.getElementById('roomBedType').value     = room.bedType || '';
        document.getElementById('roomPrice').value       = room.basePrice;
        document.getElementById('roomDescription').value = room.description || '';
        totalInput.value       = room.totalRooms || 1;
        totalInput.min         = Math.max(1, minTotal);
        document.getElementById('roomAvailableFrom').value = room.availableFrom || getTodayDate();
        document.getElementById('roomAvailableTo').value = room.availableTo || getFutureDate(30);
    } else {
        editingRoom = null;  // Clear for new room
        document.getElementById('roomIdField').value     = '';
        document.getElementById('roomName').value        = '';
        document.getElementById('roomCapacity').value    = '2';
        document.getElementById('roomBedType').value     = '';
        document.getElementById('roomPrice').value       = '';
        document.getElementById('roomDescription').value = '';
        totalInput.value       = '10';
        totalInput.min         = '1';
        document.getElementById('roomAvailableFrom').value = getTodayDate();
        document.getElementById('roomAvailableTo').value = getFutureDate(30);
    }

    // Store auth on the save button for use in saveRoomType()
    document.getElementById('roomSaveBtn').dataset.authRef = 'window.currentAuth';
    window.currentAuth = auth;

    new bootstrap.Modal(document.getElementById('roomModal')).show();
}

/* ── Save room type ── */
async function saveRoomType() {
    const auth     = window.currentAuth;
    const id       = document.getElementById('roomIdField').value;
    const name     = document.getElementById('roomName').value.trim();
    const price    = parseFloat(document.getElementById('roomPrice').value);
    const availableFrom = document.getElementById('roomAvailableFrom').value;
    const availableTo = document.getElementById('roomAvailableTo').value;
    const totalRooms = parseInt(document.getElementById('roomTotal').value, 10);
    const hotelId  = selectedHotel?.id;
    const msgEl    = document.getElementById('roomFormMsg');
    msgEl.innerHTML = '';

    if (!name || isNaN(price) || price <= 0) {
        msgEl.innerHTML = `<div class="alert alert-danger py-2 mb-0">Room name and price are required.</div>`;
        return;
    }
    if (!id && !hotelId) {
        msgEl.innerHTML = `<div class="alert alert-danger py-2 mb-0">No hotel selected.</div>`;
        return;
    }
    if (!availableFrom || !availableTo || availableFrom >= availableTo) {
        msgEl.innerHTML = `<div class="alert alert-danger py-2 mb-0">Select a valid check-in and check-out period.</div>`;
        return;
    }
    if (isNaN(totalRooms) || totalRooms < 1) {
        msgEl.innerHTML = `<div class="alert alert-danger py-2 mb-0">Total rooms must be at least 1.</div>`;
        return;
    }

    const minTotal = editingRoom?.maxBookedRooms ?? 0;
    if (minTotal > 0 && totalRooms < minTotal) {
        msgEl.innerHTML = `<div class="alert alert-danger py-2 mb-0">
            <i class="fa-solid fa-exclamation-triangle me-2"></i>
            <strong>Cannot reduce rooms to ${totalRooms}!</strong><br>
            Currently <strong>${minTotal} rooms are booked</strong> on at least one night.<br>
            <strong>Solution:</strong> Go to "Manage Availability" → "Active Bookings" section and cancel the necessary bookings first,
            then you'll be able to reduce the room count.</div>`;
        return;
    }

    const btn = document.getElementById('roomSaveBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    const payload = {
        name,
        capacity:    parseInt(document.getElementById('roomCapacity').value, 10) || 2,
        bedType:     document.getElementById('roomBedType').value.trim() || 'Standard',
        basePrice:   price,
        description: document.getElementById('roomDescription').value.trim() || null,
        availableFrom,
        availableTo,
        totalRooms
    };

    try {
        const isEdit = !!id;
        const url    = isEdit
            ? `${API_BASE_URL}/api/admin/room-types/${id}`
            : `${API_BASE_URL}/api/admin/hotels/${hotelId}/room-types`;

        const res = await fetch(url, {
            method: isEdit ? 'PUT' : 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth.token}`
            },
            body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error(await parseApiError(res));

        const saved = await res.json();
        bootstrap.Modal.getInstance(document.getElementById('roomModal'))?.hide();

        const total = saved.totalRooms ?? totalRooms;
        const available = saved.availableRooms ?? total;
        const booked = saved.bookedRooms ?? 0;
        showToast(
            isEdit
                ? `Room updated — ${total} total, ${available} available now, ${booked} booked today.`
                : `Room added — ${total} total rooms, ${available} available now, ${booked} booked.`,
            'success'
        );
        loadRoomTypes(auth, hotelId);
    } catch (err) {
        msgEl.innerHTML = `<div class="alert alert-danger py-2 mb-0">${err.message}</div>`;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Room Type';
    }
}

/* ── Auto-seed inventory for 90 days when a room is first created ── */
/* ── Delete room type ── */
async function deleteRoomType(id, name) {
    if (!confirm(`Delete room type "${name}"?\n\nThis will also remove all its availability records.`)) return;

    const auth = window.currentAuth;
    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/room-types/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${auth.token}` }
        });

        if (!res.ok) throw new Error(await parseApiError(res));

        document.getElementById(`room-row-${id}`)?.remove();
        allRoomTypes = allRoomTypes.filter(r => r.id !== id);
        showToast('Room type deleted.', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

/* ════════════════════════════════════════
   AVAILABILITY MODAL
   ════════════════════════════════════════ */
let currentAvailRoomTypeId   = null;
let currentAvailRoomTypeName = '';
let currentAvailMaxBooked    = 0;

function openAvailabilityPanel(roomTypeId, roomTypeName, maxBooked = 0) {
    currentAvailRoomTypeId   = roomTypeId;
    currentAvailRoomTypeName = roomTypeName;
    currentAvailMaxBooked    = maxBooked;

    const room = allRoomTypes.find(r => r.id === roomTypeId);

    document.getElementById('availModalTitle').innerHTML =
        `<i class="fa-solid fa-calendar-check me-2"></i>Room Bookings`;
    document.getElementById('availModalSubtitle').textContent =
        `${roomTypeName} · ${selectedHotel?.name || ''} · ${room?.totalRooms ?? '?'} total rooms · ${room?.bookedRooms ?? 0} booked · ${room?.availableRooms ?? '?'} available`;

    // Wire refresh button
    replaceWithClone('refreshRoomBookingsBtn', () => loadRoomBookings());

    loadRoomBookings();

    new bootstrap.Modal(document.getElementById('availabilityModal')).show();
}

/* ── Apply: set N rooms available from date A to date B ── */
async function applyAvailabilityRange() {
    const auth       = window.currentAuth;
    const fromDate   = document.getElementById('availFrom').value;
    const toDate     = document.getElementById('availTo').value;
    const totalRooms = parseInt(document.getElementById('availTotalRooms').value, 10);
    const msgEl      = document.getElementById('availSetMsg');
    msgEl.innerHTML  = '';

    if (!fromDate || !toDate) {
        msgEl.innerHTML = `<div class="alert alert-danger py-2 mb-0">Please select both dates.</div>`;
        return;
    }
    if (fromDate >= toDate) {
        msgEl.innerHTML = `<div class="alert alert-danger py-2 mb-0">End date must be after start date.</div>`;
        return;
    }
    if (isNaN(totalRooms) || totalRooms < 1) {
        msgEl.innerHTML = `<div class="alert alert-danger py-2 mb-0">Available rooms must be at least 1.</div>`;
        return;
    }
    const minAllowed = Math.max(1, currentAvailMaxBooked);
    if (totalRooms < minAllowed) {
        msgEl.innerHTML = `<div class="alert alert-danger py-2 mb-0">
            <i class="fa-solid fa-exclamation-triangle me-2"></i>
            <strong>Cannot set ${totalRooms} rooms!</strong><br>
            At least <strong>${minAllowed} rooms are booked</strong> on some nights in this range.<br>
            <strong>Solution:</strong> Cancel bookings from "Active Bookings" section below first.</div>`;
        return;
    }

    const btn = document.getElementById('applyAvailBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Applying...';

    // Build list of dates in range [fromDate, toDate)
    const dates = [];
    const cursor = new Date(fromDate + 'T00:00:00');
    const end    = new Date(toDate   + 'T00:00:00');
    while (cursor < end) {
        dates.push(cursor.toISOString().split('T')[0]);
        cursor.setDate(cursor.getDate() + 1);
    }

    // Send all PUT requests in parallel
    const results = await Promise.allSettled(
        dates.map(date =>
            fetch(`${API_BASE_URL}/api/admin/room-inventory`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${auth.token}`
                },
                body: JSON.stringify({
                    roomTypeId: currentAvailRoomTypeId,
                    date,
                    totalRooms
                })
            })
        )
    );

    const failed = results.filter(r => r.status === 'rejected' || !r.value?.ok).length;
    const success = dates.length - failed;

    if (failed === 0) {
        msgEl.innerHTML = `
            <div class="alert alert-success py-2 mb-0">
                <i class="fa-solid fa-circle-check me-2"></i>
                Done! Set <strong>${totalRooms} rooms</strong> available 
                for <strong>${success} night${success !== 1 ? 's' : ''}</strong>
                (${formatDate(fromDate)} → ${formatDate(toDate)}).
            </div>`;
        loadAvailabilityView(); // Refresh the table
        if (selectedHotel?.id) loadRoomTypes(window.currentAuth, selectedHotel.id);
    } else {
        msgEl.innerHTML = `
            <div class="alert alert-warning py-2 mb-0">
                Applied to ${success} dates. ${failed} date(s) failed 
                (may already have bookings that prevent reduction).
            </div>`;
        loadAvailabilityView();
        if (selectedHotel?.id) loadRoomTypes(window.currentAuth, selectedHotel.id);
    }

    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-check me-2"></i>Apply to Range';
}

/* ── View current availability table ── */
async function loadAvailabilityView() {
    const auth  = window.currentAuth;
    const from  = document.getElementById('viewFrom').value;
    const to    = document.getElementById('viewTo').value;
    const tbody = document.getElementById('availTableBody');

    if (!from || !to || from >= to) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">
            Select a valid date range to view availability.</td></tr>`;
        return;
    }

    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-3">
        <div class="spinner-border text-secondary spinner-border-sm"></div></td></tr>`;

    try {
        const res = await fetch(
            `${API_BASE_URL}/api/room-types/${currentAvailRoomTypeId}/availability?from=${from}&to=${to}`
        );
        if (!res.ok) throw new Error('Failed to load availability.');
        const records = await res.json();
        renderAvailTable(tbody, records, auth);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-danger py-3">${err.message}</td></tr>`;
    }
}

function renderAvailTable(tbody, records, auth) {
    if (!records.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center text-muted py-3">
            No availability set for this range yet. Use the form above to set it.</td></tr>`;
        return;
    }

    tbody.innerHTML = records.map(r => {
        const avail = r.availableRooms;
        const statusBadge = avail <= 0
            ? '<span class="badge bg-danger">Sold Out</span>'
            : avail <= 2
                ? `<span class="badge bg-warning text-dark">Only ${avail} left</span>`
                : `<span class="badge bg-success">${avail} Available</span>`;

        return `
            <tr id="avail-row-${r.date}">
                <td class="px-3 fw-semibold small">${formatDate(r.date)}</td>
                <td class="text-center">${r.totalRooms}</td>
                <td class="text-center fw-bold" style="color:var(--danger-color);">${r.bookedRooms}</td>
                <td class="text-center fw-bold" style="color:var(--success-color);">${avail}</td>
                <td class="text-center">${statusBadge}</td>
                <td class="text-end px-3">
                    <input type="number" class="input-qty" 
                           value="${r.totalRooms}" min="${r.bookedRooms}" max="999"
                           id="qty-${r.date}" style="width:70px;">
                    <button class="btn btn-sm btn-outline-success ms-1 fw-bold"
                            onclick="saveOneDay('${r.date}', this, '${auth.token}')">
                        Save
                    </button>
                </td>
            </tr>`;
    }).join('');
}

/* ── Save a single date manually ── */
async function saveOneDay(date, btn, token) {
    const input = document.getElementById(`qty-${date}`);
    const totalRooms = parseInt(input?.value, 10);

    if (isNaN(totalRooms) || totalRooms < 0) {
        showToast('Invalid number of rooms.', 'error');
        return;
    }

    btn.disabled = true;
    btn.textContent = '...';

    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/room-inventory`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                roomTypeId: currentAvailRoomTypeId,
                date,
                totalRooms
            })
        });

        if (!res.ok) throw new Error(await parseApiError(res));

        btn.textContent = '✓';
        btn.className = 'btn btn-sm btn-success ms-1 fw-bold';
        showToast(`Saved: ${formatDate(date)}`, 'success');
        loadAvailabilityView();
        if (selectedHotel?.id) loadRoomTypes(window.currentAuth, selectedHotel.id);
        setTimeout(() => {
            btn.textContent = 'Save';
            btn.className = 'btn btn-sm btn-outline-success ms-1 fw-bold';
            btn.disabled = false;
        }, 2000);
    } catch (err) {
        showToast(err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Save';
    }
}

/* ── Active bookings for room type (cancel from rooms page) ── */
async function loadRoomBookings() {
    const auth = window.currentAuth;
    const listEl = document.getElementById('roomBookingsList');
    if (!listEl || !currentAvailRoomTypeId) return;

    listEl.innerHTML = `<div class="text-center text-muted py-4">
        <div class="spinner-border spinner-border-sm me-2"></div>
        <span>Loading bookings...</span>
    </div>`;

    try {
        const res = await fetch(
            `${API_BASE_URL}/api/admin/bookings?roomTypeId=${currentAvailRoomTypeId}`,
            { headers: { 'Authorization': `Bearer ${auth.token}` } }
        );
        if (!res.ok) throw new Error(await parseApiError(res));

        const bookings = (await res.json()).filter(b => {
            const s = (b.status || '').toLowerCase();
            return s === 'pending' || s === 'confirmed';
        });

        if (!bookings.length) {
            listEl.innerHTML = `
                <div class="alert alert-info py-4 text-center mb-0">
                    <i class="fa-solid fa-calendar-xmark fa-2x mb-2 d-block opacity-50"></i>
                    <p class="mb-0">No active bookings for this room type.</p>
                </div>`;
            return;
        }

        // Desktop table view
        const desktopTable = `
            <div class="table-responsive d-none d-md-block">
                <table class="table table-hover mb-0 align-middle">
                    <thead style="background:var(--background-color);">
                        <tr>
                            <th class="py-3 px-3">Booking Ref</th>
                            <th class="py-3">Guest Name</th>
                            <th class="py-3">Check-in</th>
                            <th class="py-3">Check-out</th>
                            <th class="py-3">Nights</th>
                            <th class="py-3">Total Price</th>
                            <th class="py-3 text-center">Status</th>
                            <th class="py-3 text-end px-3">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${bookings.map(b => {
                            const status = (b.status || '').toLowerCase();
                            const badge = status === 'confirmed'
                                ? '<span class="badge bg-success px-3 py-2">CONFIRMED</span>'
                                : '<span class="badge bg-warning text-dark px-3 py-2">PENDING</span>';
                            
                            const checkIn = new Date(b.checkIn);
                            const checkOut = new Date(b.checkOut);
                            const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
                            
                            return `
                            <tr>
                                <td class="px-3">
                                    <span class="badge bg-light text-dark border fw-bold" style="font-size:0.9rem;">
                                        #BK-${b.id}
                                    </span>
                                </td>
                                <td>
                                    <i class="fa-solid fa-user me-2 text-muted"></i>
                                    <span class="fw-semibold">${escHtml(b.userName)}</span>
                                </td>
                                <td>
                                    <i class="fa-solid fa-calendar-day me-1 text-success"></i>
                                    ${formatDate(b.checkIn)}
                                </td>
                                <td>
                                    <i class="fa-solid fa-calendar-day me-1 text-danger"></i>
                                    ${formatDate(b.checkOut)}
                                </td>
                                <td>
                                    <span class="badge bg-info text-white">${nights} ${nights === 1 ? 'night' : 'nights'}</span>
                                </td>
                                <td class="fw-bold" style="color:var(--success-color);">
                                    $${b.totalPrice?.toFixed(2) || '0.00'}
                                </td>
                                <td class="text-center">${badge}</td>
                                <td class="text-end px-3">
                                    <button class="btn btn-sm btn-danger"
                                            onclick="cancelRoomBooking(${b.id}, '${escHtml(b.userName)}')">
                                        <i class="fa-solid fa-ban me-1"></i>Cancel
                                    </button>
                                </td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>`;

        // Mobile card view
        const mobileCards = `
            <div class="d-block d-md-none">
                ${bookings.map(b => {
                    const status = (b.status || '').toLowerCase();
                    const badge = status === 'confirmed'
                        ? '<span class="badge bg-success">CONFIRMED</span>'
                        : '<span class="badge bg-warning text-dark">PENDING</span>';
                    
                    const checkIn = new Date(b.checkIn);
                    const checkOut = new Date(b.checkOut);
                    const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
                    
                    return `
                    <div class="card mb-3 shadow-sm">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-start mb-3">
                                <span class="badge bg-light text-dark border fw-bold">
                                    #BK-${b.id}
                                </span>
                                ${badge}
                            </div>
                            <h6 class="fw-bold mb-2">
                                <i class="fa-solid fa-user me-2 text-muted"></i>
                                ${escHtml(b.userName)}
                            </h6>
                            <div class="small text-muted mb-2">
                                <div class="mb-1">
                                    <i class="fa-solid fa-calendar-day me-1 text-success"></i>
                                    <strong>Check-in:</strong> ${formatDate(b.checkIn)}
                                </div>
                                <div class="mb-1">
                                    <i class="fa-solid fa-calendar-day me-1 text-danger"></i>
                                    <strong>Check-out:</strong> ${formatDate(b.checkOut)}
                                </div>
                                <div class="mb-1">
                                    <i class="fa-solid fa-moon me-1 text-info"></i>
                                    <strong>Duration:</strong> ${nights} ${nights === 1 ? 'night' : 'nights'}
                                </div>
                            </div>
                            <div class="d-flex justify-content-between align-items-center pt-2 border-top">
                                <span class="fw-bold fs-5" style="color:var(--success-color);">
                                    $${b.totalPrice?.toFixed(2) || '0.00'}
                                </span>
                                <button class="btn btn-sm btn-danger"
                                        onclick="cancelRoomBooking(${b.id}, '${escHtml(b.userName)}')">
                                    <i class="fa-solid fa-ban me-1"></i>Cancel Booking
                                </button>
                            </div>
                        </div>
                    </div>`;
                }).join('')}
            </div>`;

        listEl.innerHTML = desktopTable + mobileCards;
    } catch (err) {
        listEl.innerHTML = `<div class="alert alert-danger py-3 mb-0">
            <i class="fa-solid fa-exclamation-triangle me-2"></i>${err.message}
        </div>`;
    }
}

async function cancelRoomBooking(bookingId, guestName) {
    const auth = window.currentAuth;
    if (!auth) return;

    if (!confirm(`Cancel booking #BK-${bookingId} for ${guestName}?\nThis will restore room availability if confirmed.`)) {
        return;
    }

    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/bookings/${bookingId}/cancel`, {
            method: 'PATCH',
            headers: { 'Authorization': `Bearer ${auth.token}` }
        });
        if (!res.ok) throw new Error(await parseApiError(res));

        showToast(`Booking #BK-${bookingId} cancelled.`, 'success');
        loadRoomBookings();
        loadAvailabilityView();
        if (selectedHotel?.id) loadRoomTypes(auth, selectedHotel.id);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

/* ════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════ */
function replaceWithClone(id, handler) {
    const el = document.getElementById(id);
    if (!el) return;
    const clone = el.cloneNode(true);
    el.parentNode.replaceChild(clone, el);
    clone.addEventListener('click', handler);
}

function truncate(str, max) {
    if (!str || str.length <= max) return str || '';
    return str.slice(0, max) + '…';
}

function escHtml(str) {
    return (str || '').replace(/'/g, "\\'");
}

/**
 * Derives thumbnail path from hotel name — mirrors admin-hotels.js naming:
 *   "Grand Royal" → "assets/hotel_grand_royal.png"
 */
function hotelThumbFromName(hotelName) {
    if (!hotelName) return 'assets/hotel.jpg';
    const slug = hotelName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
    return `assets/hotel_${slug}.png`;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function toDateInputValue(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getTodayDate() {
    return toDateInputValue(new Date());
}

function getFutureDate(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return toDateInputValue(date);
}

function showToast(message, type) {
    let toast = document.getElementById('admin-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'admin-toast';
        toast.style.cssText = `
            position:fixed; bottom:2rem; right:2rem; z-index:9999;
            padding:1rem 1.5rem; border-radius:0.5rem; color:#fff;
            font-weight:600; box-shadow:0 4px 20px rgba(0,0,0,.2);
            transition:opacity 0.4s; max-width:380px;`;
        document.body.appendChild(toast);
    }
    toast.style.backgroundColor = type === 'success' ? '#28a745' : '#dc3545';
    toast.innerHTML = `<i class="fa-solid fa-${type === 'success' ? 'circle-check' : 'circle-xmark'} me-2"></i>${message}`;
    toast.style.display = 'block';
    toast.style.opacity = '1';
    clearTimeout(toast._t);
    toast._t = setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => { toast.style.display = 'none'; }, 400);
    }, 4500);
}

/* ════════════════════════════════════════
   EXPOSE FUNCTIONS TO WINDOW for inline onclick
   ════════════════════════════════════════ */
window.openRoomModal = openRoomModal;
window.saveRoomType = saveRoomType;
window.deleteRoomType = deleteRoomType;
window.saveOneDay = saveOneDay;
window.openAvailabilityPanel = openAvailabilityPanel;
window.cancelRoomBooking = cancelRoomBooking;
