/* ==========================================================================
   HOTELIA - ADMIN DASHBOARD
   Per spec: Admin can view ALL bookings, confirm/reject/cancel reservations.
   API:
     GET  /api/admin/bookings?status=   → list bookings (filter by status)
     PATCH /api/admin/bookings/{id}/confirm
     PATCH /api/admin/bookings/{id}/reject
     PATCH /api/admin/bookings/{id}/cancel
     PATCH /api/admin/bookings/{id}/complete
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    let auth;
    try { auth = requireAdminAuth(); } catch { return; }

    loadPendingBookings(auth);
    setupAllBookingsSection(auth);
});

/* ════════════════════════════════════════
   PENDING BOOKINGS — shown in main table
   ════════════════════════════════════════ */
async function loadPendingBookings(auth) {
    const tbody = document.querySelector('.table-custom tbody');
    if (!tbody) return;

    tbody.innerHTML = `
        <tr>
            <td colspan="6" class="text-center py-4">
                <div class="spinner-border text-secondary" role="status"></div>
                <p class="mt-2 text-muted mb-0">Loading pending bookings...</p>
            </td>
        </tr>`;

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/bookings?status=Pending`, {
            headers: { 'Authorization': `Bearer ${auth.token}` }
        });

        if (!response.ok) throw new Error(await parseApiError(response));

        const bookings = await response.json();
        renderPendingBookings(tbody, bookings, auth);
    } catch (err) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4 text-danger">
                    <i class="fa-solid fa-triangle-exclamation me-2"></i>
                    ${err.message || 'Failed to load bookings.'}
                </td>
            </tr>`;
    }
}

function renderPendingBookings(tbody, bookings, auth) {
    if (!bookings || bookings.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-5 text-muted">
                    <i class="fa-solid fa-circle-check fa-2x mb-2 text-success d-block"></i>
                    No pending bookings — all caught up!
                </td>
            </tr>`;
        return;
    }

    tbody.innerHTML = bookings.map(b => buildPendingRow(b)).join('');
    attachRowListeners(tbody, auth);
}

function buildPendingRow(b) {
    const checkIn  = formatDate(b.checkIn);
    const checkOut = formatDate(b.checkOut);

    return `
        <tr id="booking-row-${b.id}">
            <td class="px-4 fw-bold text-muted">#BK-${b.id}</td>
            <td class="fw-semibold">${b.userName}</td>
            <td>${b.hotelName} — ${b.roomTypeName}</td>
            <td>${checkIn} → ${checkOut}</td>
            <td><span class="badge badge-pending">PENDING</span></td>
            <td class="text-end px-4">
                <button class="btn btn-sm btn-confirm me-1" data-action="confirm" data-id="${b.id}">
                    <i class="fa-solid fa-check me-1"></i>Confirm
                </button>
                <button class="btn btn-sm btn-reject me-1" data-action="reject" data-id="${b.id}">
                    <i class="fa-solid fa-xmark me-1"></i>Reject
                </button>
                <button class="btn btn-sm btn-outline-secondary" data-action="cancel" data-id="${b.id}">
                    <i class="fa-solid fa-ban me-1"></i>Cancel
                </button>
            </td>
        </tr>`;
}

/* ════════════════════════════════════════
   ALL BOOKINGS section — injected below management cards
   Spec: admin views all reservations, can cancel if needed
   ════════════════════════════════════════ */
function setupAllBookingsSection(auth) {
    const main = document.querySelector('main .container.admin-section');
    if (!main || document.getElementById('allBookingsSection')) return;

    const section = document.createElement('div');
    section.id = 'allBookingsSection';
    section.className = 'mt-5';
    section.innerHTML = `
        <div class="d-flex align-items-center mb-4">
            <i class="fa-solid fa-list-check fs-3 me-3" style="color:var(--primary-color);"></i>
            <h3 class="fw-bold text-dark m-0">All Reservations</h3>
        </div>

        <!-- Status filter tabs -->
        <div class="d-flex gap-2 flex-wrap mb-3" id="statusFilterBtns">
            <button class="btn btn-sm btn-dark active-filter" data-filter="">All</button>
            <button class="btn btn-sm btn-outline-warning text-dark" data-filter="Pending">Pending</button>
            <button class="btn btn-sm btn-outline-success" data-filter="Confirmed">Confirmed</button>
            <button class="btn btn-sm btn-outline-danger" data-filter="Rejected">Rejected</button>
            <button class="btn btn-sm btn-outline-secondary" data-filter="Cancelled">Cancelled</button>
            <button class="btn btn-sm btn-outline-primary" data-filter="Completed">Completed</button>
        </div>

        <div class="table-responsive table-custom">
            <table class="table table-hover mb-0">
                <thead>
                    <tr>
                        <th class="py-3 px-4">Booking Ref</th>
                        <th class="py-3">Guest</th>
                        <th class="py-3">Hotel & Room</th>
                        <th class="py-3">Dates</th>
                        <th class="py-3">Total</th>
                        <th class="py-3">Status</th>
                        <th class="py-3 text-end px-4">Actions</th>
                    </tr>
                </thead>
                <tbody id="allBookingsTbody">
                    <tr><td colspan="7" class="text-center py-4">
                        <div class="spinner-border text-secondary"></div>
                    </td></tr>
                </tbody>
            </table>
        </div>`;

    main.appendChild(section);

    // Filter buttons
    section.querySelectorAll('[data-filter]').forEach(btn => {
        btn.addEventListener('click', () => {
            section.querySelectorAll('[data-filter]').forEach(b => {
                b.classList.remove('active-filter', 'btn-dark');
                b.classList.add('btn-outline-secondary');
            });
            btn.classList.add('active-filter', 'btn-dark');
            btn.classList.remove('btn-outline-secondary');
            loadAllBookings(auth, btn.dataset.filter);
        });
    });

    loadAllBookings(auth, '');
}

async function loadAllBookings(auth, statusFilter) {
    const tbody = document.getElementById('allBookingsTbody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4">
        <div class="spinner-border text-secondary"></div></td></tr>`;

    try {
        const url = statusFilter
            ? `${API_BASE_URL}/api/admin/bookings?status=${statusFilter}`
            : `${API_BASE_URL}/api/admin/bookings`;

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${auth.token}` }
        });

        if (!response.ok) throw new Error(await parseApiError(response));

        const bookings = await response.json();
        renderAllBookings(tbody, bookings, auth);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-danger">
            ${err.message}</td></tr>`;
    }
}

function renderAllBookings(tbody, bookings, auth) {
    if (!bookings.length) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">No bookings found.</td></tr>`;
        return;
    }

    tbody.innerHTML = bookings.map(b => buildAllBookingRow(b)).join('');
    attachRowListeners(tbody, auth);
}

function buildAllBookingRow(b) {
    const checkIn  = formatDate(b.checkIn);
    const checkOut = formatDate(b.checkOut);
    const status   = (b.status || '').toLowerCase();

    const statusBadge = {
        pending:   '<span class="badge badge-pending">PENDING</span>',
        confirmed: '<span class="badge bg-success">CONFIRMED</span>',
        rejected:  '<span class="badge bg-danger">REJECTED</span>',
        cancelled: '<span class="badge bg-secondary">CANCELLED</span>',
        completed: '<span class="badge bg-primary">COMPLETED</span>',
    }[status] || `<span class="badge bg-light text-dark">${b.status}</span>`;

    let actions = '';
    if (status === 'pending') {
        actions = `
            <button class="btn btn-sm btn-confirm me-1" data-action="confirm" data-id="${b.id}">
                <i class="fa-solid fa-check"></i>
            </button>
            <button class="btn btn-sm btn-reject me-1" data-action="reject" data-id="${b.id}">
                <i class="fa-solid fa-xmark"></i>
            </button>
            <button class="btn btn-sm btn-outline-secondary" data-action="cancel" data-id="${b.id}" title="Cancel">
                <i class="fa-solid fa-ban"></i>
            </button>`;
    } else if (status === 'confirmed') {
        actions = `
            <button class="btn btn-sm btn-outline-primary me-1" data-action="complete" data-id="${b.id}" title="Mark Completed">
                <i class="fa-solid fa-flag-checkered"></i>
            </button>
            <button class="btn btn-sm btn-outline-secondary" data-action="cancel" data-id="${b.id}" title="Cancel">
                <i class="fa-solid fa-ban"></i>
            </button>`;
    } else {
        actions = `<span class="text-muted small">—</span>`;
    }

    return `
        <tr id="all-booking-row-${b.id}">
            <td class="px-4 fw-bold text-muted">#BK-${b.id}</td>
            <td class="fw-semibold">${b.userName}</td>
            <td>${b.hotelName}<br><small class="text-muted">${b.roomTypeName}</small></td>
            <td class="small">${checkIn}<br>→ ${checkOut}</td>
            <td class="fw-bold">$${b.totalPrice?.toFixed(2)}</td>
            <td>${statusBadge}</td>
            <td class="text-end px-4">${actions}</td>
        </tr>`;
}

/* ════════════════════════════════════════
   Shared action handlers (work for both tables)
   ════════════════════════════════════════ */
function attachRowListeners(container, auth) {
    container.querySelectorAll('[data-action][data-id]').forEach(btn => {
        btn.addEventListener('click', () => handleBookingAction(btn, auth));
    });
}

async function handleBookingAction(btn, auth) {
    const id     = btn.dataset.id;
    const action = btn.dataset.action;

    const confirmMessages = {
        confirm:  `Confirm booking #BK-${id}?`,
        reject:   `Reject booking #BK-${id}?`,
        cancel:   `Cancel booking #BK-${id}? This will restore room availability if confirmed.`,
        complete: `Mark booking #BK-${id} as Completed?`,
    };

    if (!confirm(confirmMessages[action] || 'Are you sure?')) return;

    // Disable all buttons in the row
    const rowId = btn.closest('tr')?.id;
    setRowLoading(rowId, true);

    try {
        const response = await fetch(
            `${API_BASE_URL}/api/admin/bookings/${id}/${action}`,
            {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${auth.token}` }
            }
        );

        if (!response.ok) throw new Error(await parseApiError(response));

        const toastMessages = {
            confirm:  `Booking #BK-${id} confirmed.`,
            reject:   `Booking #BK-${id} rejected.`,
            cancel:   `Booking #BK-${id} cancelled.`,
            complete: `Booking #BK-${id} marked as completed.`,
        };

        showAdminToast(toastMessages[action], action === 'reject' || action === 'cancel' ? 'error' : 'success');

        // Refresh both sections
        loadPendingBookings(auth);
        const currentFilter = document.querySelector('.active-filter')?.dataset?.filter ?? '';
        loadAllBookings(auth, currentFilter);
    } catch (err) {
        setRowLoading(rowId, false);
        showAdminToast(err.message || 'Action failed.', 'error');
    }
}

/* ── Helpers ── */
function setRowLoading(rowId, loading) {
    const row = rowId ? document.getElementById(rowId) : null;
    if (!row) return;
    row.querySelectorAll('button').forEach(b => {
        b.disabled = loading;
        if (loading) b.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
    });
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
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
    }, 4500);
}
