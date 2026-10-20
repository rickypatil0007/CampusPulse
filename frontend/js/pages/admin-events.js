import { API } from '../api.js';
import { CONFIG } from '../config.js';
import { requireAdmin } from '../auth.js';
import { showToast, showConfirmModal, setButtonLoading } from '../ui.js';

let allEvents = [];
let currentFilter = 'ALL';

document.addEventListener('DOMContentLoaded', async () => {
  const admin = requireAdmin();
  if (!admin) return;

  setupNav(admin);
  setupFilters();
  setupModals();

  await fetchEvents();

  // Check if ?edit=ID is in URL
  const editId = new URLSearchParams(window.location.search).get('edit');
  if (editId) {
    const target = allEvents.find(e => e.id === editId);
    if (target) openEditModal(target);
  }
});

async function fetchEvents() {
  const grid = document.getElementById('eventsManageGrid');
  if (grid) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem;">
        <span class="spinner-8bit" style="width: 28px; height: 28px; border-width: 4px; border-color: var(--color-purple); border-top-color: transparent;"></span>
        <p style="margin-top: 1rem; font-weight: 700;">Loading events...</p>
      </div>
    `;
  }

  try {
    const res = await API.get('/events?status=ALL');
    if (res.success && Array.isArray(res.data)) {
      allEvents = res.data;
      renderEvents();
    }
  } catch (err) {
    console.error('Failed to load events:', err);
    showToast('Failed to load events from server.', 'error');
  }
}

function setupFilters() {
  const pills = document.querySelectorAll('#statusFilterPills .tab-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentFilter = pill.dataset.filter;
      renderEvents();
    });
  });
}

function renderEvents() {
  const grid = document.getElementById('eventsManageGrid');
  if (!grid) return;

  let filtered = allEvents;
  if (currentFilter !== 'ALL') {
    filtered = allEvents.filter(e => e.status === currentFilter);
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: var(--color-surface); border: var(--border-strong); border-radius: var(--radius-card);">
        <div style="font-size: 3rem; margin-bottom: 0.5rem;">📁</div>
        <h3>No Events Found</h3>
        <p style="color: var(--color-ink-muted);">No events found matching status '${currentFilter}'.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(evt => {
    const confirmed = evt.confirmed_count || 0;
    const capacity = evt.capacity || 1;
    const waitlist = evt.waitlist_count || 0;
    const pct = Math.min(100, Math.round((confirmed / capacity) * 100));

    const dateObj = new Date(evt.starts_at);
    const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    let statusBadge = '<span class="badge-status badge-confirmed">PUBLISHED</span>';
    if (evt.status === 'DRAFT') {
      statusBadge = '<span class="badge-status badge-waitlist">DRAFT</span>';
    } else if (evt.status === 'CANCELLED') {
      statusBadge = '<span class="badge-status badge-cancelled">CANCELLED</span>';
    }

    return `
      <article class="manage-card">
        <div class="manage-card-header">
          <div>
            <span class="category-sticker" style="position: static; display: inline-block; margin-bottom: 0.25rem;">
              ${escapeHtml(evt.category)}
            </span>
            <h3 style="margin: 0.25rem 0 0 0; font-size: var(--text-base);">${escapeHtml(evt.title)}</h3>
          </div>
          <div>${statusBadge}</div>
        </div>

        <div class="manage-card-body">
          <div>
            <p style="font-size: var(--text-xs); color: var(--color-ink-muted); margin: 0.25rem 0;">
              📍 <strong>Venue:</strong> ${escapeHtml(evt.venue)}
            </p>
            <p style="font-size: var(--text-xs); color: var(--color-ink-muted); margin: 0.25rem 0 1rem 0;">
              📅 <strong>Schedule:</strong> ${dateStr} at ${timeStr}
            </p>

            <div class="capacity-container" style="margin-bottom: 0.75rem;">
              <div class="capacity-header">
                <span>Capacity:</span>
                <span><strong>${confirmed}</strong> / ${capacity} seats (${pct}%)</span>
              </div>
              <div class="capacity-bar" style="height: 10px;">
                <div class="capacity-fill ${pct >= 100 ? 'full' : ''}" style="width: ${pct}%;"></div>
              </div>
            </div>

            <div style="font-size: var(--text-xs); color: var(--color-ink-muted); margin-bottom: 1rem; font-weight: 700;">
              ${waitlist > 0 ? `⏳ Waiting list: ${waitlist} students in queue` : `🟢 No students currently waiting`}
            </div>
          </div>

          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; border-top: var(--border-subtle); padding-top: 1rem;">
            <a href="admin-participants.html?id=${evt.id}" class="btn btn-secondary btn-sm" style="flex: 1;">
              👥 Rosters
            </a>
            <button class="btn btn-ghost btn-sm edit-evt-btn" data-event-id="${evt.id}">
              ✏️ Edit
            </button>
            ${evt.status === 'DRAFT' ? `
              <button class="btn btn-primary btn-sm publish-evt-btn" data-event-id="${evt.id}">
                🚀 Publish
              </button>
            ` : ''}
            ${evt.status !== 'CANCELLED' ? `
              <button class="btn btn-ghost btn-sm cancel-evt-btn" data-event-id="${evt.id}" style="color: var(--color-coral);">
                ✖️ Cancel
              </button>
            ` : ''}
          </div>
        </div>
      </article>
    `;
  }).join('');

  // Attach buttons
  grid.querySelectorAll('.edit-evt-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.eventId;
      const target = allEvents.find(ev => ev.id === id);
      if (target) openEditModal(target);
    });
  });

  grid.querySelectorAll('.publish-evt-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.eventId;
      handlePublishEvent(id);
    });
  });

  grid.querySelectorAll('.cancel-evt-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = e.currentTarget.dataset.eventId;
      handleCancelEvent(id);
    });
  });
}

function setupModals() {
  const createModal = document.getElementById('createEventModal');
  const openCreateBtn = document.getElementById('openCreateModalBtn');
  const closeCreateBtn = document.getElementById('closeCreateModalBtn');
  const cancelCreateBtn = document.getElementById('cancelCreateModalBtn');
  const createForm = document.getElementById('createEventForm');

  if (openCreateBtn && createModal) {
    openCreateBtn.addEventListener('click', () => {
      createForm.reset();
      // Set default startsAt to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      document.getElementById('createStartsAt').value = tomorrow.toISOString().slice(0, 16);
      createModal.style.display = 'flex';
    });
  }

  const closeCreate = () => { if (createModal) createModal.style.display = 'none'; };
  closeCreateBtn?.addEventListener('click', closeCreate);
  cancelCreateBtn?.addEventListener('click', closeCreate);

  // Submit Create Event
  createForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submitCreateBtn');
    setButtonLoading(submitBtn, true);

    const payload = {
      title: document.getElementById('createTitle').value.trim(),
      category: document.getElementById('createCategory').value,
      capacity: parseInt(document.getElementById('createCapacity').value, 10),
      starts_at: new Date(document.getElementById('createStartsAt').value).toISOString(),
      venue: document.getElementById('createVenue').value.trim(),
      description: document.getElementById('createDescription').value.trim(),
      status: document.getElementById('createStatus').value
    };

    try {
      const res = await API.post('/admin/events', payload);
      if (res.success) {
        showToast('Event created successfully!', 'success');
        closeCreate();
        await fetchEvents();
      }
    } catch (err) {
      showToast(err.message || 'Failed to create event.', 'error');
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });

  // Edit Modal Setup
  const editModal = document.getElementById('editEventModal');
  const closeEditBtn = document.getElementById('closeEditModalBtn');
  const cancelEditBtn = document.getElementById('cancelEditModalBtn');
  const editForm = document.getElementById('editEventForm');

  const closeEdit = () => { if (editModal) editModal.style.display = 'none'; };
  closeEditBtn?.addEventListener('click', closeEdit);
  cancelEditBtn?.addEventListener('click', closeEdit);

  editForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = document.getElementById('submitEditBtn');
    const id = document.getElementById('editEventId').value;
    const target = allEvents.find(ev => ev.id === id);

    const newCap = parseInt(document.getElementById('editCapacity').value, 10);
    if (target && newCap < (target.confirmed_count || 0)) {
      showToast(`Cannot reduce capacity to ${newCap}. There are ${target.confirmed_count} confirmed attendees!`, 'error');
      return;
    }

    setButtonLoading(submitBtn, true);

    const payload = {
      title: document.getElementById('editTitle').value.trim(),
      capacity: newCap,
      venue: document.getElementById('editVenue').value.trim(),
      description: document.getElementById('editDescription').value.trim()
    };

    try {
      const res = await API.patch(`/admin/events/${id}`, payload);
      if (res.success) {
        showToast('Event updated successfully!', 'success');
        closeEdit();
        await fetchEvents();
      }
    } catch (err) {
      showToast(err.message || 'Update failed.', 'error');
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });
}

function openEditModal(evt) {
  const modal = document.getElementById('editEventModal');
  if (!modal) return;

  document.getElementById('editEventId').value = evt.id;
  document.getElementById('editTitle').value = evt.title || '';
  document.getElementById('editCapacity').value = evt.capacity || 50;
  document.getElementById('editCapacityNotice').textContent = 
    `Min capacity: cannot be below confirmed count (${evt.confirmed_count || 0} attendees).`;
  document.getElementById('editVenue').value = evt.venue || '';
  document.getElementById('editDescription').value = evt.description || '';

  modal.style.display = 'flex';
}

function handlePublishEvent(id) {
  showConfirmModal({
    title: 'Publish Event?',
    message: 'Publishing will immediately make this event discoverable and open for student registrations.',
    confirmText: 'Yes, Publish Event',
    cancelText: 'Keep as Draft',
    onConfirm: async () => {
      try {
        const res = await API.post(`/admin/events/${id}/publish`);
        if (res.success) {
          showToast('Event published to live schedule!', 'success');
          await fetchEvents();
        }
      } catch (err) {
        showToast(err.message || 'Publishing failed.', 'error');
      }
    }
  });
}

function handleCancelEvent(id) {
  showConfirmModal({
    title: 'Cancel Entire Event?',
    message: 'Are you sure you want to cancel this event? Registration will close and all attendees will be notified.',
    confirmText: 'Yes, Cancel Event',
    cancelText: 'Keep Active',
    onConfirm: async () => {
      try {
        const res = await API.post(`/admin/events/${id}/cancel`);
        if (res.success) {
          showToast('Event marked as CANCELLED.', 'info');
          await fetchEvents();
        }
      } catch (err) {
        showToast(err.message || 'Cancellation failed.', 'error');
      }
    }
  });
}

function setupNav(admin) {
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mainNav = document.getElementById('mainNav');
  if (mobileMenuBtn && mainNav) {
    mobileMenuBtn.addEventListener('click', () => mainNav.classList.toggle('nav-open'));
  }

  const badge = document.getElementById('navUserBadge');
  if (badge) {
    document.getElementById('navUserName').textContent = admin.full_name || 'Admin';
    document.getElementById('navUserAvatar').textContent = (admin.full_name || 'A')[0].toUpperCase();
  }

  document.getElementById('navLogoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.USER_PROFILE);
    showToast('Admin logged out.', 'info');
    setTimeout(() => window.location.href = 'index.html', 300);
  });
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
