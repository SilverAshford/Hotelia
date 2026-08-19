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

document.addEventListener('DOMContentLoaded', () => {
    let auth;
    try { auth = requireAdminAuth(); } catch { return; }

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
            <div class="col-md-6 d-flex align-items-end gap-2">
                <button class="btn btn-dark px-4" id="loadRoomsBtn">
                    <i class="fa-solid fa-eye me-2"></i>View Rooms
                </button>
                <button class="btn btn-add" id="addRoomBtnTop" style="display:none;">
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
            <th class="py-3">Bed Type</th>
            <th class="py-3">Base Price / Night</th>
            <th class="py-3">Availability Window</th>
            <th class="py-3 text-end px-4">Actions</th>`;
    }

    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4">
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
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-danger">${err.message}</td></tr>`;
    }
}

function renderRoomsTable(tbody, rooms, auth) {
    if (!rooms.length) {
        tbody.innerHTML = `
            <tr><td colspan="6" class="text-center py-5 text-muted">
                <i class="fa-solid fa-bed fa-2x mb-2 d-block opacity-50"></i>
                No room types yet. Click "Add Room Type" to create one.
            </td></tr>`;
        return;
    }

    tbody.innerHTML = rooms.map(r => `
        <tr id="room-row-${r.id}">
            <td class="px-4">
                <div class="fw-semibold">${r.name}</div>
                ${r.description ? `<div class="text-muted small mt-1">${truncate(r.description, 50)}</div>` : ''}
            </td>
            <td>
                <i class="fa-solid fa-user me-1 text-muted"></i>
                ${r.capacity} Person${r.capacity !== 1 ? 's' : ''}
            </td>
            <td>${r.bedType || '<span class="text-muted">—</span>'}</td>
            <td class="fw-bold" style="color:var(--success-color);">$${r.basePrice}</td>
            <td>
                <button class="btn btn-sm btn-outline-dark" 
                        onclick="openAvailabilityPanel(${r.id}, '${escHtml(r.name)}')">
                    <i class="fa-solid fa-calendar-days me-1"></i>Manage Dates
                </button>
            </td>
            <td class="text-end px-4">
                <button class="btn btn-sm btn-edit me-1" onclick="openRoomModal(${r.id}, currentAuth)">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="btn btn-sm btn-delete" onclick="deleteRoomType(${r.id}, '${escHtml(r.name)}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        </tr>`).join('');

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
                                    <label class="form-label fw-bold">Total Rooms in Hotel</label>
                                    <input type="number" class="form-control" id="roomTotal" value="10" min="1"
                                           placeholder="How many physical rooms exist">
                                    <div class="form-text">This will set availability for the booking period.</div>
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
                                <i class="fa-solid fa-calendar-days me-2"></i>Manage Availability
                            </h5>
                            <p class="text-white opacity-75 small mb-0" id="availModalSubtitle"></p>
                        </div>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body p-4">

                        <!-- Set availability form -->
                        <div class="p-3 rounded-3 mb-4" 
                             style="background:var(--background-color);border:1px solid var(--border-color);">
                            <h6 class="fw-bold mb-3" style="color:var(--primary-color);">
                                <i class="fa-solid fa-calendar-plus me-2"></i>
                                Set Room Availability for a Date Range
                            </h6>
                            <p class="text-muted small mb-3">
                                Define how many rooms of this type are available for booking
                                between a start and end date. Every night in that range will be set to the same number.
                            </p>
                            <div class="row g-3 align-items-end">
                                <div class="col-md-3">
                                    <label class="form-label fw-bold small text-muted text-uppercase">From Date *</label>
                                    <input type="date" class="form-control" id="availFrom">
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label fw-bold small text-muted text-uppercase">To Date *</label>
                                    <input type="date" class="form-control" id="availTo">
                                </div>
                                <div class="col-md-3">
                                    <label class="form-label fw-bold small text-muted text-uppercase">
                                        Available Rooms *
                                    </label>
                                    <input type="number" class="form-control" id="availTotalRooms" 
                                           min="1" value="10" placeholder="e.g. 10">
                                </div>
                                <div class="col-md-3">
                                    <button class="btn btn-dark w-100" id="applyAvailBtn">
                                        <i class="fa-solid fa-check me-2"></i>Apply to Range
                                    </button>
                                </div>
                            </div>
                            <div id="availSetMsg" class="mt-3"></div>
                        </div>

                        <!-- View current availability -->
                        <div class="d-flex justify-content-between align-items-center mb-3">
                            <h6 class="fw-bold mb-0" style="color:var(--primary-color);">
                                <i class="fa-solid fa-table me-2"></i>Current Availability
                            </h6>
                            <div class="d-flex gap-2">
                                <input type="date" class="form-control form-control-sm" id="viewFrom" style="width:150px;">
                                <input type="date" class="form-control form-control-sm" id="viewTo" style="width:150px;">
                                <button class="btn btn-sm btn-outline-dark" id="refreshAvailBtn">
                                    <i class="fa-solid fa-rotate-right me-1"></i>Load
                                </button>
                            </div>
                        </div>

                        <div class="table-responsive table-custom" style="max-height:320px;overflow-y:auto;">
                            <table class="table table-hover mb-0">
                                <thead>
                                    <tr>
                                        <th class="py-2 px-3">Date</th>
                                        <th class="py-2 text-center">Total Rooms</th>
                                        <th class="py-2 text-center">Booked</th>
                                        <th class="py-2 text-center">Available</th>
                                        <th class="py-2 text-center">Status</th>
                                        <th class="py-2 text-end px-3">Edit</th>
                                    </tr>
                                </thead>
                                <tbody id="availTableBody">
                                    <tr><td colspan="6" class="text-center text-muted py-3">
                                        Set a date range above and click "Load" to view.
                                    </td></tr>
                                </tbody>
                            </table>
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

    // Hide total rooms field on edit (makes no sense to re-set)
    document.getElementById('roomTotal').closest('.col-md-6').style.display = isEdit ? 'none' : '';

    if (isEdit) {
        const room = allRoomTypes.find(r => r.id === id);
        if (!room) return;
        document.getElementById('roomIdField').value     = room.id;
        document.getElementById('roomName').value        = room.name;
        document.getElementById('roomCapacity').value    = room.capacity;
        document.getElementById('roomBedType').value     = room.bedType || '';
        document.getElementById('roomPrice').value       = room.basePrice;
        document.getElementById('roomDescription').value = room.description || '';
        document.getElementById('roomTotal').value       = 10;
    } else {
        document.getElementById('roomIdField').value     = '';
        document.getElementById('roomName').value        = '';
        document.getElementById('roomCapacity').value    = '2';
        document.getElementById('roomBedType').value     = '';
        document.getElementById('roomPrice').value       = '';
        document.getElementById('roomDescription').value = '';
        document.getElementById('roomTotal').value       = '10';
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

    const btn = document.getElementById('roomSaveBtn');
    btn.disabled = true;
    btn.textContent = 'Saving...';

    const payload = {
        name,
        capacity:    parseInt(document.getElementById('roomCapacity').value, 10) || 2,
        bedType:     document.getElementById('roomBedType').value.trim() || null,
        basePrice:   price,
        description: document.getElementById('roomDescription').value.trim() || null
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

        // If adding new room, also set initial inventory for 30 days
        if (!isEdit) {
            const newRoom = await res.json();
            const totalRooms = parseInt(document.getElementById('roomTotal').value, 10) || 10;
            await setInitialInventory(auth, newRoom.id, totalRooms);
        }

        bootstrap.Modal.getInstance(document.getElementById('roomModal'))?.hide();
        showToast(`Room type ${isEdit ? 'updated' : 'added'} successfully.`, 'success');
        loadRoomTypes(auth, hotelId);
    } catch (err) {
        msgEl.innerHTML = `<div class="alert alert-danger py-2 mb-0">${err.message}</div>`;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Save Room Type';
    }
}

/* ── Auto-seed inventory for 90 days when a room is first created ── */
async function setInitialInventory(auth, roomTypeId, totalRooms) {
    const today = new Date();
    const end   = new Date();
    end.setDate(today.getDate() + 90);

    const promises = [];
    const current = new Date(today);
    while (current < end) {
        const dateStr = current.toISOString().split('T')[0];
        promises.push(
            fetch(`${API_BASE_URL}/api/admin/room-inventory`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${auth.token}`
                },
                body: JSON.stringify({ roomTypeId, date: dateStr, totalRooms })
            })
        );
        current.setDate(current.getDate() + 1);
    }
    // Fire all in parallel, ignore individual failures silently
    await Promise.allSettled(promises);
}

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

function openAvailabilityPanel(roomTypeId, roomTypeName) {
    currentAvailRoomTypeId   = roomTypeId;
    currentAvailRoomTypeName = roomTypeName;

    document.getElementById('availModalTitle').innerHTML =
        `<i class="fa-solid fa-calendar-days me-2"></i>Manage Availability`;
    document.getElementById('availModalSubtitle').textContent =
        `${roomTypeName}  ·  ${selectedHotel?.name || ''}`;

    // Reset messages
    document.getElementById('availSetMsg').innerHTML = '';
    document.getElementById('availTableBody').innerHTML =
        `<tr><td colspan="6" class="text-center text-muted py-3">Set a date range and click "Load" to view.</td></tr>`;

    // Default dates: today → today + 30
    const today = new Date();
    const in30  = new Date(); in30.setDate(today.getDate() + 30);
    const fmt   = d => d.toISOString().split('T')[0];

    document.getElementById('availFrom').value         = fmt(today);
    document.getElementById('availTo').value           = fmt(in30);
    document.getElementById('availTotalRooms').value   = '10';
    document.getElementById('viewFrom').value          = fmt(today);
    document.getElementById('viewTo').value            = fmt(in30);

    // Wire buttons (remove old listeners by cloning)
    replaceWithClone('applyAvailBtn', () => applyAvailabilityRange());
    replaceWithClone('refreshAvailBtn', () => loadAvailabilityView());

    // Auto-load current availability
    loadAvailabilityView();

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
    } else {
        msgEl.innerHTML = `
            <div class="alert alert-warning py-2 mb-0">
                Applied to ${success} dates. ${failed} date(s) failed 
                (may already have bookings that prevent reduction).
            </div>`;
        loadAvailabilityView();
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

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
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
