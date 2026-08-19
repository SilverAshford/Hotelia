/* ==========================================================================
   HOTELIA - ADMIN HOTELS MANAGEMENT
   Handles: list hotels, add hotel (modal + PNG upload), edit hotel, delete hotel
   API: GET /api/hotels
        POST /api/admin/hotels
        PUT  /api/admin/hotels/{id}
        DELETE /api/admin/hotels/{id}

   Image strategy:
     1. Admin picks a .png file → live preview shown immediately
     2. "Save to assets" uses File System Access API (showSaveFilePicker)
        to write the file directly to the project's assets/ folder
     3. Fallback for browsers without the API: auto-download + instructions
   ========================================================================== */

let allHotels = [];
let _selectedImageFile = null;   // holds the File object selected by the admin

document.addEventListener('DOMContentLoaded', () => {
    let auth;
    try { auth = requireAdminAuth(); } catch { return; }

    injectHotelModal();
    loadHotels(auth);

    document.querySelector('.btn-add')
        ?.addEventListener('click', () => openHotelModal(null));
});

/* ════════════════════════════════════════
   LOAD & RENDER
   ════════════════════════════════════════ */
async function loadHotels(auth) {
    const tbody = document.querySelector('.table-custom tbody');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4">
        <div class="spinner-border text-secondary"></div></td></tr>`;

    try {
        const res = await fetch(`${API_BASE_URL}/api/hotels`);
        if (!res.ok) throw new Error('Failed to load hotels.');
        allHotels = await res.json();
        renderHotelsTable(tbody, allHotels);
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-danger text-center py-4">${err.message}</td></tr>`;
    }
}

function renderHotelsTable(tbody, hotels) {
    if (!hotels.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-5 text-muted">
            No hotels found. Add one!</td></tr>`;
        return;
    }

    tbody.innerHTML = hotels.map(h => {
        const thumb = h.thumbnailUrl
            ? `<img src="${h.thumbnailUrl}" alt=""
                    style="width:44px;height:32px;object-fit:cover;border-radius:4px;"
                    onerror="this.src='assets/hotel_test.png'">`
            : `<span class="text-muted"><i class="fa-solid fa-image"></i></span>`;
        return `
        <tr id="hotel-row-${h.id}">
            <td class="px-4 fw-bold text-muted">#HTL-${String(h.id).padStart(2,'0')}</td>
            <td>
                <div class="d-flex align-items-center gap-2">
                    ${thumb}
                    <span class="fw-semibold">${h.name}</span>
                </div>
            </td>
            <td>${h.city}${h.address ? ', ' + h.address : ''}</td>
            <td><i class="fa-solid fa-star text-warning me-1"></i>${h.stars}</td>
            <td><span class="badge bg-success">Active</span></td>
            <td class="text-end px-4">
                <button class="btn btn-sm btn-edit me-1" onclick="openHotelModal(${h.id})">
                    <i class="fa-solid fa-pen"></i>
                </button>
                <button class="btn btn-sm btn-delete" onclick="deleteHotel(${h.id},'${escHtml(h.name)}')">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        </tr>`;
    }).join('');
}

/* ════════════════════════════════════════
   MODAL INJECTION (once)
   ════════════════════════════════════════ */
function injectHotelModal() {
    if (document.getElementById('hotelModal')) return;

    document.body.insertAdjacentHTML('beforeend', `
    <div class="modal fade" id="hotelModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-lg">
        <div class="modal-content">

          <div class="modal-header bg-dark text-white">
            <h5 class="modal-title fw-bold" id="hotelModalTitle">Add Hotel</h5>
            <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
          </div>

          <div class="modal-body p-4">
            <form id="hotelForm" novalidate>
              <input type="hidden" id="hotelIdField">
              <div class="row g-3">

                <div class="col-md-6">
                  <label class="form-label fw-bold">Hotel Name *</label>
                  <input type="text" class="form-control" id="hotelName" required>
                </div>
                <div class="col-md-4">
                  <label class="form-label fw-bold">City *</label>
                  <input type="text" class="form-control" id="hotelCity" required>
                </div>
                <div class="col-md-2">
                  <label class="form-label fw-bold">Stars</label>
                  <select class="form-select" id="hotelStars">
                    <option value="1">1 ★</option>
                    <option value="2">2 ★</option>
                    <option value="3">3 ★</option>
                    <option value="4">4 ★</option>
                    <option value="5" selected>5 ★</option>
                  </select>
                </div>

                <div class="col-12">
                  <label class="form-label fw-bold">Address</label>
                  <input type="text" class="form-control" id="hotelAddress" placeholder="123 Main St.">
                </div>

                <div class="col-12">
                  <label class="form-label fw-bold">Description</label>
                  <textarea class="form-control" id="hotelDescription" rows="2"></textarea>
                </div>

                <!-- ═══ Image Upload ═══ -->
                <div class="col-12">
                  <label class="form-label fw-bold">
                    Hotel Thumbnail
                    <span class="badge bg-secondary ms-1 fw-normal">PNG only</span>
                  </label>

                  <div class="d-flex gap-3 align-items-start">

                    <!-- Preview -->
                    <div id="imgPreviewBox"
                         style="width:120px;height:80px;border-radius:8px;overflow:hidden;
                                border:2px dashed var(--border-color);flex-shrink:0;
                                background:var(--background-color);
                                display:flex;align-items:center;justify-content:center;">
                      <i class="fa-solid fa-image fa-2x text-muted" id="imgPreviewIcon"></i>
                      <img id="imgPreviewImg" src="" alt="preview"
                           style="display:none;width:100%;height:100%;object-fit:cover;">
                    </div>

                    <div class="flex-grow-1">
                      <!-- File input -->
                      <input type="file" class="form-control mb-2"
                             id="hotelImageFile"
                             accept=".png,image/png"
                             onchange="handleImageSelect(this)">

                      <div class="form-text mb-2">
                        Choose a <strong>.png</strong> file.
                        It will be saved directly to the <code>assets/</code> folder.
                      </div>

                      <!-- Auto-filled path (readonly) -->
                      <input type="text" class="form-control form-control-sm"
                             id="hotelThumbnail"
                             placeholder="assets/hotel_name.png  (auto-filled after saving)"
                             readonly
                             style="font-family:monospace;font-size:0.8rem;
                                    background:var(--background-color);">

                      <!-- Save to disk button -->
                      <button type="button"
                              class="btn btn-sm btn-dark mt-2 w-100"
                              id="saveToDiskBtn"
                              style="display:none;"
                              onclick="saveImageToDisk()">
                        <i class="fa-solid fa-floppy-disk me-2"></i>
                        Save PNG to assets folder
                      </button>

                      <div id="imgSaveStatus" class="mt-2 small"></div>
                    </div>
                  </div>
                </div>
                <!-- ═══ end image ═══ -->

              </div>
              <div id="hotelFormMsg" class="mt-3"></div>
            </form>
          </div>

          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-dark px-4" id="hotelSaveBtn" onclick="saveHotel()">
              Save Hotel
            </button>
          </div>

        </div>
      </div>
    </div>`);
}

/* ════════════════════════════════════════
   IMAGE HANDLING
   ════════════════════════════════════════ */

function handleImageSelect(input) {
    const file = input.files?.[0];
    _selectedImageFile = null;
    document.getElementById('imgSaveStatus').innerHTML = '';

    if (!file) { resetImagePreview(); return; }

    // PNG validation
    if (file.type !== 'image/png' && !file.name.toLowerCase().endsWith('.png')) {
        document.getElementById('imgSaveStatus').innerHTML =
            `<span class="text-danger">
                <i class="fa-solid fa-circle-xmark me-1"></i>Only .png files are accepted.
             </span>`;
        resetImagePreview();
        input.value = '';
        return;
    }

    _selectedImageFile = file;

    // Live preview via FileReader
    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById('imgPreviewIcon').style.display = 'none';
        const img = document.getElementById('imgPreviewImg');
        img.src = e.target.result;
        img.style.display = 'block';
    };
    reader.readAsDataURL(file);

    updateSuggestedPath();
    document.getElementById('saveToDiskBtn').style.display = 'block';
    document.getElementById('imgSaveStatus').innerHTML =
        `<span class="text-warning">
            <i class="fa-solid fa-triangle-exclamation me-1"></i>
            Click <strong>"Save PNG to assets folder"</strong> to write the file to disk,
            then click <em>Save Hotel</em>.
         </span>`;
}

/* Build the suggested filename from the hotel name */
function updateSuggestedPath() {
    if (!_selectedImageFile) return;
    const name = document.getElementById('hotelName')?.value.trim();
    const base = name
        ? 'hotel_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') + '.png'
        : _selectedImageFile.name.replace(/[^a-z0-9._-]/gi, '_');
    document.getElementById('hotelThumbnail').value = `assets/${base}`;
}

function resetImagePreview() {
    document.getElementById('imgPreviewIcon').style.display = '';
    const img = document.getElementById('imgPreviewImg');
    img.src = '';
    img.style.display = 'none';
    document.getElementById('hotelThumbnail').value = '';
    document.getElementById('saveToDiskBtn').style.display = 'none';
    _selectedImageFile = null;
}

/* Write the PNG to disk using the File System Access API */
async function saveImageToDisk() {
    if (!_selectedImageFile) return;

    updateSuggestedPath();
    const suggestedName = document.getElementById('hotelThumbnail').value.replace('assets/', '');
    const statusEl = document.getElementById('imgSaveStatus');

    /* ── Modern: File System Access API ── */
    if (window.showSaveFilePicker) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName,
                types: [{ description: 'PNG Image', accept: { 'image/png': ['.png'] } }],
                startIn: 'desktop'
            });

            const writable = await handle.createWritable();
            await writable.write(_selectedImageFile);
            await writable.close();

            // Update path to the actual chosen name
            const finalName = handle.name;
            document.getElementById('hotelThumbnail').value = `assets/${finalName}`;
            document.getElementById('saveToDiskBtn').style.display = 'none';

            statusEl.innerHTML = `
                <span class="text-success fw-bold">
                    <i class="fa-solid fa-circle-check me-1"></i>
                    Saved! Path: <code>assets/${finalName}</code>
                    — make sure the file is inside the <strong>assets/</strong> folder.
                </span>`;
        } catch (err) {
            if (err.name !== 'AbortError') {
                statusEl.innerHTML = `<span class="text-danger">${err.message}</span>`;
            }
        }
        return;
    }

    /* ── Fallback: auto-download ── */
    const url = URL.createObjectURL(_selectedImageFile);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = suggestedName;
    a.click();
    URL.revokeObjectURL(url);

    statusEl.innerHTML = `
        <span class="text-info">
            <i class="fa-solid fa-circle-info me-1"></i>
            File downloaded as <strong>${suggestedName}</strong>.
            Move it into the <code>assets/</code> folder,
            then the path <code>assets/${suggestedName}</code> will work.
        </span>`;
}

/* ════════════════════════════════════════
   OPEN MODAL
   ════════════════════════════════════════ */
function openHotelModal(id) {
    // Reset state
    document.getElementById('hotelFormMsg').innerHTML  = '';
    document.getElementById('imgSaveStatus').innerHTML = '';
    resetImagePreview();
    document.getElementById('hotelImageFile').value = '';

    const isEdit = id !== null;
    document.getElementById('hotelModalTitle').textContent = isEdit ? 'Edit Hotel' : 'Add New Hotel';

    if (isEdit) {
        const hotel = allHotels.find(h => h.id === id);
        if (!hotel) return;
        document.getElementById('hotelIdField').value     = hotel.id;
        document.getElementById('hotelName').value        = hotel.name;
        document.getElementById('hotelCity').value        = hotel.city;
        document.getElementById('hotelAddress').value     = hotel.address || '';
        document.getElementById('hotelDescription').value = hotel.description || '';
        document.getElementById('hotelStars').value       = hotel.stars;
        document.getElementById('hotelThumbnail').value   = hotel.thumbnailUrl || '';

        // Show current image in preview
        if (hotel.thumbnailUrl) {
            document.getElementById('imgPreviewIcon').style.display = 'none';
            const img = document.getElementById('imgPreviewImg');
            img.src = hotel.thumbnailUrl;
            img.style.display = 'block';
            img.onerror = () => {
                img.style.display = 'none';
                document.getElementById('imgPreviewIcon').style.display = '';
            };
        }
    } else {
        document.getElementById('hotelIdField').value     = '';
        document.getElementById('hotelName').value        = '';
        document.getElementById('hotelCity').value        = '';
        document.getElementById('hotelAddress').value     = '';
        document.getElementById('hotelDescription').value = '';
        document.getElementById('hotelStars').value       = '5';
        document.getElementById('hotelThumbnail').value   = '';
    }

    // Auto-update suggested path whenever hotel name changes
    const nameInput = document.getElementById('hotelName');
    nameInput.removeEventListener('input', updateSuggestedPath); // avoid duplicates
    nameInput.addEventListener('input', updateSuggestedPath);

    new bootstrap.Modal(document.getElementById('hotelModal')).show();
}

/* ════════════════════════════════════════
   SAVE (create / update)
   ════════════════════════════════════════ */
async function saveHotel() {
    const auth  = getAuth();
    const id    = document.getElementById('hotelIdField').value;
    const name  = document.getElementById('hotelName').value.trim();
    const city  = document.getElementById('hotelCity').value.trim();
    const msgEl = document.getElementById('hotelFormMsg');
    msgEl.innerHTML = '';

    if (!name || !city) {
        msgEl.innerHTML = `<div class="alert alert-danger py-2 mb-0">Hotel name and city are required.</div>`;
        return;
    }

    const btn = document.getElementById('hotelSaveBtn');
    btn.disabled    = true;
    btn.textContent = 'Saving...';

    const payload = {
        name,
        city,
        address:      document.getElementById('hotelAddress').value.trim()     || null,
        description:  document.getElementById('hotelDescription').value.trim() || null,
        stars:        parseInt(document.getElementById('hotelStars').value, 10),
        thumbnailUrl: document.getElementById('hotelThumbnail').value.trim()   || null
    };

    try {
        const isEdit = !!id;
        const res = await fetch(
            isEdit ? `${API_BASE_URL}/api/admin/hotels/${id}` : `${API_BASE_URL}/api/admin/hotels`,
            {
                method: isEdit ? 'PUT' : 'POST',
                headers: {
                    'Content-Type':  'application/json',
                    'Authorization': `Bearer ${auth.token}`
                },
                body: JSON.stringify(payload)
            }
        );

        if (!res.ok) throw new Error(await parseApiError(res));

        bootstrap.Modal.getInstance(document.getElementById('hotelModal'))?.hide();
        showAdminToast(`Hotel ${isEdit ? 'updated' : 'added'} successfully.`, 'success');
        loadHotels(auth);
    } catch (err) {
        msgEl.innerHTML = `<div class="alert alert-danger py-2 mb-0">${err.message}</div>`;
    } finally {
        btn.disabled    = false;
        btn.textContent = 'Save Hotel';
    }
}

/* ════════════════════════════════════════
   DELETE
   ════════════════════════════════════════ */
async function deleteHotel(id, name) {
    if (!confirm(`Delete hotel "${name}"? This will also remove all its room types.`)) return;

    const auth = getAuth();
    try {
        const res = await fetch(`${API_BASE_URL}/api/admin/hotels/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${auth.token}` }
        });

        if (!res.ok) throw new Error(await parseApiError(res));

        document.getElementById(`hotel-row-${id}`)?.remove();
        allHotels = allHotels.filter(h => h.id !== id);
        showAdminToast('Hotel deleted.', 'success');
    } catch (err) {
        showAdminToast(err.message, 'error');
    }
}

/* ════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════ */
function escHtml(str) {
    return (str || '').replace(/'/g, "\\'");
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
