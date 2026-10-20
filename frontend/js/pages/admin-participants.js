import { API } from '../api.js';
import { CONFIG } from '../config.js';
import { requireAdmin } from '../auth.js';
import { mergeSort } from '../utils/merge-sort.js';
import { showToast } from '../ui.js';

let eventsList = [];
let currentEventData = null;
let currentSort = 'byName';

document.addEventListener('DOMContentLoaded', async () => {
  const admin = requireAdmin();
  if (!admin) return;

  setupNav(admin);

  // Load events for dropdown
  await loadEventsDropdown();

  // Attach dropdown listener
  const dropdown = document.getElementById('eventSelectDropdown');
  dropdown?.addEventListener('change', async (e) => {
    const selectedId = e.target.value;
    if (selectedId) {
      await loadParticipantData(selectedId);
    }
  });

  // Attach Sort listener
  const sortSelect = document.getElementById('sortRosterDropdown');
  sortSelect?.addEventListener('change', (e) => {
    currentSort = e.target.value;
    if (currentEventData) {
      renderConfirmedTable(currentEventData.confirmed || []);
    }
  });

  // Check URL query for event ID
  const urlId = new URLSearchParams(window.location.search).get('id');
  if (urlId && dropdown) {
    dropdown.value = urlId;
    await loadParticipantData(urlId);
  } else if (eventsList.length > 0 && dropdown) {
    dropdown.value = eventsList[0].id;
    await loadParticipantData(eventsList[0].id);
  }
});

async function loadEventsDropdown() {
  try {
    const res = await API.get('/events?status=ALL');
    if (res.success && Array.isArray(res.data)) {
      eventsList = res.data;
      const dropdown = document.getElementById('eventSelectDropdown');
      if (dropdown) {
        dropdown.innerHTML = eventsList.map(e => `
          <option value="${e.id}">${escapeHtml(e.title)} (${e.confirmed_count || 0}/${e.capacity} seats)</option>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Failed to load events for dropdown:', err);
    showToast('Failed to load events list.', 'error');
  }
}

async function loadParticipantData(eventId) {
  try {
    const res = await API.get(`/admin/events/${eventId}/participants`);
    if (res.success && res.data) {
      currentEventData = res.data;
      renderBanner();
      renderFifoTrack();
      renderConfirmedTable(currentEventData.confirmed || []);
      renderWaitlistTable(currentEventData.waitlist || []);
    }
  } catch (err) {
    console.error('Failed to load participants:', err);
    showToast('Failed to load rosters for this event.', 'error');
  }
}

function renderBanner() {
  const banner = document.getElementById('eventMetaBanner');
  if (!banner || !currentEventData) return;

  banner.style.display = 'flex';
  document.getElementById('bannerEventTitle').textContent = currentEventData.event.title;
  document.getElementById('bannerCapacity').textContent = currentEventData.event.capacity;
  document.getElementById('bannerConfirmedCount').textContent = currentEventData.confirmed.length;
  document.getElementById('bannerWaitlistCount').textContent = currentEventData.waitlist.length;
  
  const statusEl = document.getElementById('bannerStatus');
  if (statusEl) {
    statusEl.textContent = currentEventData.event.status || 'PUBLISHED';
    statusEl.className = `badge-status badge-${(currentEventData.event.status || 'confirmed').toLowerCase()}`;
  }
}

function renderFifoTrack() {
  const section = document.getElementById('fifoVisualLaneSection');
  const track = document.getElementById('queueTrack');
  if (!section || !track || !currentEventData) return;

  section.style.display = 'block';
  const waitlist = currentEventData.waitlist || [];

  if (waitlist.length === 0) {
    track.innerHTML = `
      <div style="padding: 1.5rem; text-align: center; width: 100%; color: var(--color-ink-muted);">
        🟢 <strong>Queue is currently empty.</strong> All applicants have received confirmed seats.
      </div>
    `;
    return;
  }

  track.innerHTML = waitlist.map((c, idx) => {
    const isHead = idx === 0;
    return `
      <div class="queue-candidate-card ${isHead ? 'head-candidate' : ''}">
        <span class="rank-tag">#${c.queueRank || idx + 1}</span>
        <div style="font-weight: 800; font-size: var(--text-sm); margin-bottom: 0.25rem;">
          ${escapeHtml(c.fullName)}
        </div>
        <div style="font-size: var(--text-xs); color: var(--color-ink-muted); margin-bottom: 0.5rem; word-break: break-all;">
          ${escapeHtml(c.email || '')}
        </div>
        <div style="font-family: var(--font-display); font-size: var(--text-xs); font-weight: 800; color: ${isHead ? 'var(--color-green-dark)' : '#B45309'};">
          ${isHead ? '🚀 NEXT IN LINE (Auto-Promote)' : `In Queue Position #${idx + 1}`}
        </div>
      </div>
    `;
  }).join('');
}

function renderConfirmedTable(confirmed) {
  const countEl = document.getElementById('confirmedTableCount');
  if (countEl) countEl.textContent = confirmed.length;

  const tbody = document.getElementById('confirmedTableBody');
  if (!tbody) return;

  if (confirmed.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" style="text-align: center; padding: 2rem; color: var(--color-ink-muted);">
          No confirmed attendees yet for this event.
        </td>
      </tr>
    `;
    return;
  }

  // Merge Sort Comparators for Attendees
  const comparators = {
    byName: (a, b) => (a.fullName || '').localeCompare(b.fullName || ''),
    byDate: (a, b) => new Date(a.confirmedAt) - new Date(b.confirmedAt),
    byEmail: (a, b) => (a.email || '').localeCompare(b.email || '')
  };

  const sorted = mergeSort(confirmed, comparators[currentSort] || comparators.byName);

  tbody.innerHTML = sorted.map(a => {
    const dateObj = new Date(a.confirmedAt);
    const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    return `
      <tr>
        <td>
          <strong>${escapeHtml(a.fullName)}</strong>
          <div style="font-size: var(--text-xs); font-family: var(--font-mono); color: var(--color-ink-muted);">
            ID: ${a.id}
          </div>
        </td>
        <td>${escapeHtml(a.email || '—')}</td>
        <td><span class="badge-status badge-confirmed">CONFIRMED 🎟️</span></td>
        <td style="font-size: var(--text-xs); color: var(--color-ink-muted);">${dateStr}</td>
      </tr>
    `;
  }).join('');
}

function renderWaitlistTable(waitlist) {
  const countEl = document.getElementById('waitlistTableCount');
  if (countEl) countEl.textContent = waitlist.length;

  const tbody = document.getElementById('waitlistTableBody');
  if (!tbody) return;

  if (waitlist.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 2rem; color: var(--color-ink-muted);">
          No students currently on the waiting list.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = waitlist.map(w => {
    const dateObj = new Date(w.waitlistedAt);
    const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    return `
      <tr>
        <td>
          <span class="queue-rank-badge" style="font-size: var(--text-xs); padding: 0.2rem 0.5rem;">
            Rank #${w.queueRank}
          </span>
        </td>
        <td><strong>${escapeHtml(w.fullName)}</strong></td>
        <td>${escapeHtml(w.email || '—')}</td>
        <td style="font-size: var(--text-xs); color: var(--color-ink-muted);">${dateStr}</td>
        <td>
          <span style="font-size: var(--text-xs); font-weight: 700; color: ${w.queueRank === 1 ? 'var(--color-green-dark)' : '#B45309'};">
            ${w.queueRank === 1 ? '🥇 Position 1 (Next promoted)' : `Position ${w.queueRank}`}
          </span>
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
