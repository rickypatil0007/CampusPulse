import { API } from '../api.js';
import { CONFIG } from '../config.js';
import { requireAdmin } from '../auth.js';
import { showToast } from '../ui.js';

document.addEventListener('DOMContentLoaded', async () => {
  const admin = requireAdmin();
  if (!admin) return;

  setupNav(admin);

  await Promise.all([
    fetchSummaryMetrics(),
    fetchEventsLedger()
  ]);
});

async function fetchSummaryMetrics() {
  try {
    const res = await API.get('/admin/summary');
    if (res.success && res.data) {
      const d = res.data;
      document.getElementById('metricTotalEvents').textContent = d.totalEvents || 0;
      document.getElementById('metricPublishedEvents').textContent = `${d.publishedEvents || 0} Published`;
      document.getElementById('metricConfirmedSeats').textContent = d.totalConfirmed || 0;
      document.getElementById('metricWaitlistCount').textContent = d.totalWaitlisted || 0;
      document.getElementById('metricUtilization').textContent = `${d.utilizationRate || 0}%`;
      document.getElementById('metricCapacityRatio').textContent = `${d.totalConfirmed || 0} / ${d.totalCapacity || 0} Total Seats`;
    }
  } catch (err) {
    console.error('Failed to fetch admin summary:', err);
    showToast('Failed to load metrics. Server check required.', 'error');
  }
}

async function fetchEventsLedger() {
  const tbody = document.getElementById('adminEventsTableBody');
  try {
    const res = await API.get('/events?status=ALL');
    if (res.success && Array.isArray(res.data)) {
      renderTable(res.data);
    }
  } catch (err) {
    console.error('Failed to load events ledger:', err);
    if (tbody) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--color-coral);">
            Failed to load events: ${err.message}
          </td>
        </tr>
      `;
    }
  }
}

function renderTable(events) {
  const tbody = document.getElementById('adminEventsTableBody');
  if (!tbody) return;

  if (events.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align: center; padding: 3rem; color: var(--color-ink-muted);">
          No events created yet. Click "Create New Event" to get started!
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = events.map(evt => {
    const confirmed = evt.confirmed_count || 0;
    const capacity = evt.capacity || 1;
    const waitlist = evt.waitlist_count || 0;
    const pct = Math.min(100, Math.round((confirmed / capacity) * 100));
    const isFull = confirmed >= capacity;

    const dateObj = new Date(evt.starts_at);
    const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    let statusBadge = '<span class="badge-status badge-confirmed">PUBLISHED</span>';
    if (evt.status === 'DRAFT') {
      statusBadge = '<span class="badge-status badge-waitlist">DRAFT</span>';
    } else if (evt.status === 'CANCELLED') {
      statusBadge = '<span class="badge-status badge-cancelled">CANCELLED</span>';
    }

    return `
      <tr>
        <td>
          <div style="font-weight: 700; color: var(--color-ink);">${escapeHtml(evt.title)}</div>
          <span style="font-size: var(--text-xs); color: var(--color-ink-muted);">
            Category: <strong>${escapeHtml(evt.category)}</strong>
          </span>
        </td>
        <td>
          <div>${dateStr} at ${timeStr}</div>
          <div style="font-size: var(--text-xs); color: var(--color-ink-muted);">📍 ${escapeHtml(evt.venue)}</div>
        </td>
        <td style="min-width: 160px;">
          <div style="display: flex; justify-content: space-between; font-size: var(--text-xs); font-weight: 700; margin-bottom: 0.25rem;">
            <span>${confirmed} / ${capacity}</span>
            <span>${pct}%</span>
          </div>
          <div class="capacity-bar" style="height: 10px;">
            <div class="capacity-fill ${isFull ? 'full' : (pct > 75 ? 'high' : '')}" style="width: ${pct}%;"></div>
          </div>
        </td>
        <td>
          ${waitlist > 0 ? `
            <span class="badge-status badge-waitlist" style="font-size: var(--text-xs);">
              ⏳ ${waitlist} in Queue
            </span>
          ` : `
            <span style="font-size: var(--text-xs); color: var(--color-ink-muted);">Queue Empty</span>
          `}
        </td>
        <td>
          ${statusBadge}
        </td>
        <td>
          <div style="display: flex; gap: 0.5rem;">
            <a href="admin-participants.html?id=${evt.id}" class="btn btn-primary btn-sm" style="padding: 0.25rem 0.6rem; font-size: var(--text-xs);">
              👥 Rosters
            </a>
            <a href="admin-events.html?edit=${evt.id}" class="btn btn-secondary btn-sm" style="padding: 0.25rem 0.6rem; font-size: var(--text-xs);">
              ✏️ Edit
            </a>
          </div>
        </td>
      </tr>
    `;
  }).join('');
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
