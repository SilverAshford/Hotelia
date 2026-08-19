/* ==========================================================================
   HOTELIA - ADMIN ROOM INVENTORY MANAGEMENT
   Handles: load hotels in select, load inventory by hotel + date range,
            set total rooms per date, bulk adjust
   API: GET /api/hotels
        GET /api/room-types/{id}/availability?from=&to=
        PUT /api/admin/room-inventory
        PATCH /api/admin/room-inventory/adjust
   ========================================================================== */

let inventoryHotels   = [];
let inventoryRoomTypes = [];

document.addEventListener('DOMContentLoaded', () => {
    let auth;
    try { auth = requireAdminAuth(); } catch { return; }

    populateHotelSelect(auth);
    setupLoadButton(auth);
    setupAdjustButton(auth);
});

/* ── Populate hotel select dropdown ── */
async function populateHotelSelect(auth) {
    const select = document.querySelector('.filter-card select');
    if (!select) return;

    select.innerHTML = '<option value="">Loading hotels...</option>';
    select.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/api/hotels`);
        if (!response.ok) throw new Error('Failed to load hotels.');

        inventoryHotels = await response.json();

        select.innerHTML = '<option value="">-- Select a hotel --</option>' +
            inventoryHotels.map(h => `<option value="${h.id}">${h.name}</option>`).join('');
        select.disabled = false;

        // Populate room type filter if needed
        select.addEventListener('change', () => {
            const hotel = inventoryHotels.find(h => h.id === parseInt(select.value, 10));
            inventoryRoomTypes = hotel?.roomTypes || [];
        });
    } catch (err) {
        select.innerHTML = `<option value="">Error loading hotels</option>`;
        showAdminToast(err.message, 'error');
    }
}

/* ── Load Inventory button ── */
function setupLoadButton(auth) {
    const loadBtn = document.querySelector('.filter-card button');
    if (!loadBtn) return;

    loadBtn.addEventListener('click', () => loadInventory(auth));
}

async function loadInventory(auth) {
    const select     = document.querySelector('.filter-card select');
    const dateInputs = document.querySelectorAll('.filter-card input[type="date"]');
    const hotelId    = parseInt(select?.value, 10);
    const fromDate   = dateInputs[0]?.value;
    const toDate     = dateInputs[1]?.value;

    const tbody = document.querySelector('.table-custom tbody');
    if (!tbody) return;

    if (!hotelId) {
        showAdminToast('Please select a hotel first.', 'error');
        return;
    }
    if (!fromDate || !toDate) {
        showAdminToast('Please select a date range.', 'error');
        return;
    }
    if (fromDate >= toDate) {
        showAdminToast('Start date must be before end date.', 'error');
        return;
    }

    // Get room types for the selected hotel
    const hotel = inventoryHotels.find(h => h.id === hotelId);
    const roomTypes = hotel?.roomTypes || [];

    if (!roomTypes.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-muted">No room types for this hotel.</td></tr>`;
        return;
    }

    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4"><div class="spinner-border text-secondary"></div></td></tr>`;

    try {
        // Load availability for each room type in parallel
        const requests = roomTypes.map(rt =>
            fetch(`${API_BASE_URL}/api/room-types/${rt.id}/availability?from=${fromDate}&to=${toDate}`)
                .then(r => r.ok ? r.json() : [])
                .then(records => records.map(rec => ({ ...rec, roomTypeId: rt.id, roomTypeName: rt.name })))
        );

        const results = await Promise.all(requests);
        const allRecords = results.flat();

        renderInventoryTable(tbody, allRecords, auth);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-danger text-center py-4">${err.message}</td></tr>`;
    }
}

function renderInventoryTable(tbody, records, auth) {
    if (!records.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-5 text-muted">
                    No inventory records found for this range.
                    <br><small>Use "Set Inventory" to add records first.</small>
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = records.map(r => {
        const isSoldOut = r.availableRooms <= 0;
        return `
            <tr id="inv-row-${r.roomTypeId}-${r.date}">
                <td class="px-4 fw-semibold">${formatDate(r.date)}</td>
                <td>${r.roomTypeName}</td>
                <td class="text-center">${r.totalRooms}</td>
                <td class="text-center text-danger fw-bold">${r.bookedRooms}</td>
                <td class="text-center">
                    <input type="number" class="input-qty"
                           value="${r.totalRooms}"
                           min="${r.bookedRooms}" max="999"
                           data-roomtype-id="${r.roomTypeId}"
                           data-date="${r.date}"
                           style="width:80px;">
                    ${isSoldOut ? '<span class="badge bg-danger ms-2">Sold Out</span>' : ''}
                </td>
                <td class="text-end px-4">
                    <button class="btn btn-sm btn-outline-success fw-bold"
                            onclick="saveInventoryRow(${r.roomTypeId}, '${r.date}', this, '${auth.token}')">
                        Save
                    </button>
                </td>
            </tr>`;
    }).join('');
}

/* ── Save a single inventory row ── */
async function saveInventoryRow(roomTypeId, date, btn, token) {
    const row   = document.getElementById(`inv-row-${roomTypeId}-${date}`);
    const input = row?.querySelector('input[type="number"]');
    const totalRooms = parseInt(input?.value, 10);

    if (isNaN(totalRooms) || totalRooms < 0) {
        showAdminToast('Invalid room count.', 'error');
        return;
    }

    btn.disabled = true;
    btn.textContent = '...';

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/room-inventory`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ roomTypeId, date, totalRooms })
        });

        if (!response.ok) throw new Error(await parseApiError(response));

        btn.textContent = 'Saved ✓';
        btn.className = 'btn btn-sm btn-success fw-bold';
        showAdminToast(`Inventory updated for ${formatDate(date)}.`, 'success');

        setTimeout(() => {
            btn.textContent = 'Save';
            btn.className = 'btn btn-sm btn-outline-success fw-bold';
            btn.disabled = false;
        }, 2000);
    } catch (err) {
        showAdminToast(err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Save';
    }
}

/* ── Bulk adjust panel ── */
function setupAdjustButton(auth) {
    // Inject adjust panel if not present
    const container = document.querySelector('.container.admin-section');
    if (!container || document.getElementById('adjustPanel')) return;

    const panel = document.createElement('div');
    panel.id = 'adjustPanel';
    panel.className = 'card p-4 mb-4 border-0 shadow-sm';
    panel.innerHTML = `
        <h5 class="fw-bold mb-3"><i class="fa-solid fa-sliders me-2" style="color:var(--primary-color);"></i>Bulk Adjust Inventory</h5>
        <div class="row g-3 align-items-end">
            <div class="col-md-3">
                <label class="form-label small text-muted text-uppercase fw-bold">Room Type ID</label>
                <input type="number" class="form-control" id="adjustRoomTypeId" placeholder="e.g. 1" min="1">
            </div>
            <div class="col-md-2">
                <label class="form-label small text-muted text-uppercase fw-bold">From</label>
                <input type="date" class="form-control" id="adjustFrom">
            </div>
            <div class="col-md-2">
                <label class="form-label small text-muted text-uppercase fw-bold">To</label>
                <input type="date" class="form-control" id="adjustTo">
            </div>
            <div class="col-md-2">
                <label class="form-label small text-muted text-uppercase fw-bold">Delta (+/-)</label>
                <input type="number" class="form-control" id="adjustDelta" placeholder="e.g. +5 or -2">
            </div>
            <div class="col-md-3">
                <button class="btn btn-dark w-100" id="applyAdjustBtn">Apply Adjustment</button>
            </div>
        </div>
        <div id="adjustMsg" class="mt-3"></div>`;

    // Insert before the table
    const tableDiv = container.querySelector('.table-responsive');
    if (tableDiv) container.insertBefore(panel, tableDiv);

    document.getElementById('applyAdjustBtn')?.addEventListener('click', () => applyAdjust(auth));
}

async function applyAdjust(auth) {
    const roomTypeId = parseInt(document.getElementById('adjustRoomTypeId')?.value, 10);
    const from       = document.getElementById('adjustFrom')?.value;
    const to         = document.getElementById('adjustTo')?.value;
    const delta      = parseInt(document.getElementById('adjustDelta')?.value, 10);
    const msgEl      = document.getElementById('adjustMsg');

    msgEl.innerHTML = '';

    if (isNaN(roomTypeId) || !from || !to || isNaN(delta)) {
        msgEl.innerHTML = `<div class="alert alert-danger py-2">All fields are required.</div>`;
        return;
    }

    const btn = document.getElementById('applyAdjustBtn');
    btn.disabled = true;
    btn.textContent = 'Applying...';

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/room-inventory/adjust`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${auth.token}`
            },
            body: JSON.stringify({ roomTypeId, from, to, delta })
        });

        if (!response.ok) throw new Error(await parseApiError(response));

        const result = await response.json();
        msgEl.innerHTML = `<div class="alert alert-success py-2">
            <i class="fa-solid fa-check me-2"></i>
            Adjusted ${result.updatedDates} date(s) by ${delta > 0 ? '+' : ''}${delta} rooms.
        </div>`;
        showAdminToast('Inventory adjusted successfully.', 'success');
    } catch (err) {
        msgEl.innerHTML = `<div class="alert alert-danger py-2">${err.message}</div>`;
    } finally {
        btn.disabled = false;
        btn.textContent = 'Apply Adjustment';
    }
}

/* ── Helpers ── */
function formatDate(dateStr) {
    if (!dateStr) return '';
    // dateStr might be "2026-08-15" from API (DateOnly)
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function showAdminToast(message, type) {
    let toast = document.getElementById('admin-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'admin-toast';
        toast.style.cssText = `
            position:fixed; bottom:2rem; right:2rem; z-index:9999;
            padding:1rem 1.5rem; border-radius:0.5rem; color:#fff;
            font-weight:600; box-shadow:0 4px 20px rgba(0,0,0,.2);
            transition:opacity 0.4s; max-width:360px;`;
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
    }, 4000);
}
