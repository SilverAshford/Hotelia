/* ==========================================================================
   HOTELIA - ANALYTICS DASHBOARD
   Handles: loading analytics data from API and displaying charts/stats
   API: GET /api/admin/analytics/*
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    let auth;
    try { 
        auth = requireAdminAuth();
        // Only real Admin can access analytics
        if (String(auth.role).toLowerCase() !== 'admin') {
            window.location.href = 'admin.html';
            return;
        }
    } catch { return; }

    loadAnalytics(auth);
});

async function loadAnalytics(auth) {
    try {
        // Load all analytics in parallel
        const [overview, revenue, occupancy, topHotels, bookingStatus] = await Promise.all([
            fetchAnalytics(auth, 'overview'),
            fetchAnalytics(auth, 'revenue'),
            fetchAnalytics(auth, 'occupancy'),
            fetchAnalytics(auth, 'top-hotels'),
            fetchAnalytics(auth, 'booking-status')
        ]);

        renderOverview(overview);
        renderRevenue(revenue);
        renderOccupancy(occupancy);
        renderTopHotels(topHotels);
        renderBookingStatus(bookingStatus);
    } catch (err) {
        showAnalyticsError(err.message);
    }
}

async function fetchAnalytics(auth, endpoint) {
    const response = await fetch(`${API_BASE_URL}/api/admin/analytics/${endpoint}`, {
        headers: { 'Authorization': `Bearer ${auth.token}` }
    });

    if (!response.ok) throw new Error(`Failed to load ${endpoint}`);
    return await response.json();
}

/* ═══ Overview Cards ═══ */
function renderOverview(data) {
    document.getElementById('totalHotels').textContent = data.totalHotels || 0;
    document.getElementById('totalUsers').textContent = data.totalUsers || 0;
    document.getElementById('totalBookings').textContent = data.totalBookings || 0;
    document.getElementById('pendingBookings').textContent = data.pendingBookings || 0;
}

/* ═══ Revenue ═══ */
function renderRevenue(data) {
    document.getElementById('totalRevenue').textContent = `$${data.totalRevenue?.toFixed(2) || '0.00'}`;
    document.getElementById('avgBooking').textContent = `$${data.averageBookingValue?.toFixed(2) || '0.00'}`;
}

/* ═══ Occupancy ═══ */
function renderOccupancy(data) {
    document.getElementById('occupancyRate').textContent = `${data.averageOccupancy || 0}%`;
    document.getElementById('totalRooms').textContent = data.totalRooms || 0;
    document.getElementById('bookedRooms').textContent = data.bookedRooms || 0;
    document.getElementById('availableRooms').textContent = data.availableRooms || 0;
}

/* ═══ Top Hotels Table ═══ */
function renderTopHotels(hotels) {
    const container = document.getElementById('topHotelsTable');
    
    if (!hotels || hotels.length === 0) {
        container.innerHTML = '<p class="text-muted text-center py-4">No data available</p>';
        return;
    }

    const rows = hotels.map((h, idx) => `
        <div class="d-flex justify-content-between align-items-center py-2 px-3 mb-2 rounded-3" 
             style="background:var(--background-color);">
            <div class="d-flex align-items-center gap-3">
                <div class="fw-bold fs-5" style="color:var(--primary-color);width:30px;">
                    #${idx + 1}
                </div>
                <div>
                    <div class="fw-semibold">${h.hotelName}</div>
                    <div class="small text-muted">${h.bookings} booking${h.bookings !== 1 ? 's' : ''}</div>
                </div>
            </div>
            <div class="fw-bold" style="color:var(--success-color);">
                $${h.revenue.toFixed(2)}
            </div>
        </div>
    `).join('');

    container.innerHTML = rows;
}

/* ═══ Booking Status Distribution ═══ */
function renderBookingStatus(statuses) {
    const container = document.getElementById('bookingStatusList');
    
    if (!statuses || statuses.length === 0) {
        container.innerHTML = '<p class="text-muted text-center py-4">No data available</p>';
        return;
    }

    const total = statuses.reduce((sum, s) => sum + s.count, 0);
    
    const statusColors = {
        Pending: '#f9a825',
        Confirmed: '#1976d2',
        Completed: '#388e3c',
        Rejected: '#d32f2f',
        Cancelled: '#757575'
    };

    const items = statuses.map(s => {
        const percentage = total > 0 ? ((s.count / total) * 100).toFixed(1) : 0;
        const color = statusColors[s.status] || '#999';
        
        return `
            <div class="mb-3">
                <div class="d-flex justify-content-between mb-1">
                    <span class="fw-semibold">${s.status}</span>
                    <span class="text-muted">${s.count} (${percentage}%)</span>
                </div>
                <div class="progress" style="height:8px;">
                    <div class="progress-bar" role="progressbar" 
                         style="width:${percentage}%;background-color:${color};">
                    </div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = items;
}

/* ═══ Error Handling ═══ */
function showAnalyticsError(message) {
    const main = document.querySelector('main .admin-section');
    if (main) {
        main.innerHTML = `
            <div class="alert alert-danger text-center">
                <i class="fa-solid fa-triangle-exclamation me-2"></i>
                ${message || 'Failed to load analytics.'}
            </div>`;
    }
}
