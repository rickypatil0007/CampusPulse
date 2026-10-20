import { API } from '../api.js';
import { CONFIG } from '../config.js';
import { requireAuth } from '../auth.js';
import { showToast, showConfirmModal } from '../ui.js';

let allRegistrations = [];
let currentTab = 'ALL';

document.addEventListener('DOMContentLoaded', async () => {
  const user = requireAuth();
  if (!user) return;

  setupNav(user);
  setupTabs();

  await fetchRegistrations();
});

async function fetchRegistrations() {
  try {
    const res = await API.get('/me/registrations');
    if (res.success && Array.isArray(res.data)) {
      allRegistrations = res.data;
      renderTable();
    } else {
      throw new Error('Unexpected response format');
    }
  } catch (err) {
    console.error('Failed to load registrations:', err);
    const tbody = document.getElementById('registrationsTableBody');
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 3rem; color: var(--color-coral);">
            <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">⚠️</div>
            <p><strong>Failed to load registrations:</strong> ${err.message}</p>
          </td>
        </tr>
      `;
    }
  }
}

function setupTabs() {
  const pills = document.querySelectorAll('.tab-pill');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentTab = pill.dataset.tab;
      renderTable();
    });
  });
}

function renderTable() {
  const tbody = document.getElementById('registrationsTableBody');
  if (!tbody) return;

  let filtered = allRegistrations;
  if (currentTab !== 'ALL') {
    filtered = allRegistrations.filter(r => r.status === currentTab);
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 3rem; color: var(--color-ink-muted);">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📭</div>
          <p><strong>No registrations found in this category.</strong></p>
          <a href="events.html" class="btn btn-secondary btn-sm" style="margin-top: 0.5rem;">Find Events &rarr;</a>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(r => {
    const event = r.events || {
      id: r.event_id,
      title: 'College Event',
      category: 'General',
      starts_at: r.registered_at,
      venue: 'Campus'
    };

    const dateObj = new Date(event.starts_at);
    const dateFormatted = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const regDateObj = new Date(r.registered_at);
    const regFormatted = regDateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    let statusBadge = '';
    let canCancel = false;

    if (r.status === 'CONFIRMED') {
      statusBadge = `<span class="badge-status badge-confirmed">CONFIRMED 🎟️</span>`;
      canCancel = true;
    } else if (r.status === 'WAITLISTED') {
      const rank = r.queueRank || r.waitlist_number || 1;
      statusBadge = `<span class="badge-status badge-waitlist">WAITLISTED (#${rank}) ⏳</span>`;
      canCancel = true;
    } else {
      statusBadge = `<span class="badge-status badge-cancelled">CANCELLED</span>`;
    }

    return `
      <tr>
        <td>
          <div style="font-weight: 700; color: var(--color-ink);">${escapeHtml(event.title)}</div>
          <span style="font-size: var(--text-xs); color: var(--color-ink-muted); font-family: var(--font-mono);">
            Ref: ${r.id.slice(0, 10)}
          </span>
        </td>
        <td>
          <div>${dateFormatted}</div>
          <div style="font-size: var(--text-xs); color: var(--color-ink-muted);">📍 ${escapeHtml(event.venue)}</div>
        </td>
        <td>
          ${statusBadge}
        </td>
        <td style="font-size: var(--text-xs); color: var(--color-ink-muted);">
          ${regFormatted}
        </td>
        <td>
          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <a href="event.html?id=${event.id || r.event_id}" class="btn btn-ghost btn-sm" style="padding: 0.25rem 0.5rem;">
              View
            </a>
            ${canCancel ? `
              <button class="btn btn-secondary btn-sm cancel-btn" data-event-id="${event.id || r.event_id}" data-is-waitlist="${r.status === 'WAITLISTED'}" style="padding: 0.25rem 0.5rem;">
                ${r.status === 'WAITLISTED' ? 'Withdraw' : 'Cancel'}
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Attach cancel listeners
  tbody.querySelectorAll('.cancel-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const eventId = e.currentTarget.dataset.eventId;
      const isWaitlist = e.currentTarget.dataset.isWaitlist === 'true';
      promptCancel(eventId, isWaitlist);
    });
  });
}

function promptCancel(eventId, isWaitlist) {
  showConfirmModal({
    title: isWaitlist ? 'Withdraw from Waitlist?' : 'Cancel Confirmed Reservation?',
    message: isWaitlist
      ? 'Are you sure you want to withdraw from the waiting list? You will lose your queue position.'
      : 'Are you sure you want to cancel your confirmed seat? It will be automatically promoted to the next waiting student!',
    confirmText: 'Yes, Cancel',
    cancelText: 'Keep Registration',
    onConfirm: async () => {
      try {
        const res = await API.post(`/events/${eventId}/cancel`);
        if (res.success) {
          showToast('Registration updated.', 'info');
          await fetchRegistrations();
        }
      } catch (err) {
        showToast(err.message || 'Cancellation failed.', 'error');
      }
    }
  });
}

function setupNav(user) {
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mainNav = document.getElementById('mainNav');
  if (mobileMenuBtn && mainNav) {
    mobileMenuBtn.addEventListener('click', () => mainNav.classList.toggle('nav-open'));
  }

  const badge = document.getElementById('navUserBadge');
  if (badge) {
    document.getElementById('navUserName').textContent = user.full_name || 'Student';
    document.getElementById('navUserAvatar').textContent = (user.full_name || 'S')[0].toUpperCase();
  }

  if (user.role === 'admin') {
    const adminLink = document.getElementById('navAdminLink');
    if (adminLink) adminLink.style.display = 'inline-block';
  }

  document.getElementById('navLogoutBtn')?.addEventListener('click', () => {
    localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
    localStorage.removeItem(CONFIG.STORAGE_KEYS.USER_PROFILE);
    showToast('Logged out.', 'info');
    setTimeout(() => window.location.href = 'index.html', 300);
  });
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
