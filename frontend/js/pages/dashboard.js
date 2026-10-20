import { API } from '../api.js';
import { CONFIG } from '../config.js';
import { requireAuth } from '../auth.js';
import { showToast, showConfirmModal } from '../ui.js';

let registrations = [];

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Guard route: requires authenticated student/user
  const user = requireAuth();
  if (!user) return;

  setupNav(user);
  populateProfile(user);

  // 2. Fetch student registrations
  await loadDashboardData();
});

function populateProfile(user) {
  document.getElementById('studentGreeting').textContent = `Welcome back, ${user.full_name || 'Student'}! 🎓`;
  document.getElementById('studentEmail').textContent = user.email || '';
}

async function loadDashboardData() {
  try {
    const res = await API.get('/me/registrations');
    if (res.success && Array.isArray(res.data)) {
      registrations = res.data;
      updateStats();
      renderConfirmedPasses();
      renderWaitlistSpots();
    }
  } catch (err) {
    console.error('Failed to load dashboard:', err);
    showToast('Failed to load registrations. Check server status.', 'error');
  }
}

function updateStats() {
  const confirmed = registrations.filter(r => r.status === 'CONFIRMED');
  const waitlisted = registrations.filter(r => r.status === 'WAITLISTED');

  document.getElementById('statConfirmedCount').textContent = confirmed.length;
  document.getElementById('statWaitlistCount').textContent = waitlisted.length;

  // Find next upcoming confirmed event
  const now = new Date();
  const upcoming = confirmed
    .filter(r => r.events && new Date(r.events.starts_at) > now)
    .sort((a, b) => new Date(a.events.starts_at) - new Date(b.events.starts_at));

  if (upcoming.length > 0) {
    const nextEvent = upcoming[0].events;
    const diffMs = new Date(nextEvent.starts_at) - now;
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    document.getElementById('statNextEventDays').textContent = diffDays <= 1 ? 'Tomorrow!' : `${diffDays} Days`;
    document.getElementById('statNextEventTitle').textContent = nextEvent.title;
  } else if (confirmed.length > 0 && confirmed[0].events) {
    document.getElementById('statNextEventDays').textContent = 'Ready 🎟️';
    document.getElementById('statNextEventTitle').textContent = confirmed[0].events.title;
  } else {
    document.getElementById('statNextEventDays').textContent = '—';
    document.getElementById('statNextEventTitle').textContent = 'No upcoming events';
  }
}

function renderConfirmedPasses() {
  const container = document.getElementById('confirmedPassesContainer');
  if (!container) return;

  const confirmed = registrations.filter(r => r.status === 'CONFIRMED');

  if (confirmed.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; background: var(--color-surface); border: var(--border-strong); border-radius: var(--radius-card);">
        <div style="font-size: 3rem; margin-bottom: 0.5rem;">🎟️</div>
        <h3>No Confirmed Event Passes</h3>
        <p style="color: var(--color-ink-muted); margin-bottom: 1.5rem;">You haven't reserved any tickets yet. Explore upcoming hackathons and workshops!</p>
        <a href="events.html" class="btn btn-primary btn-sm">Browse Live Events &rarr;</a>
      </div>
    `;
    return;
  }

  container.innerHTML = confirmed.map(r => {
    const event = r.events || { title: 'College Event', starts_at: new Date().toISOString(), venue: 'Campus' };
    const dateObj = new Date(event.starts_at);
    const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    return `
      <article class="ticket-pass-card">
        <div class="ticket-pass-top">
          <span class="badge-status badge-confirmed">🎟️ CONFIRMED PASS</span>
          <span style="font-family: var(--font-mono); font-size: var(--text-xs); font-weight: 700; color: var(--color-ink-muted);">
            #${r.id.slice(0, 8)}
          </span>
        </div>
        
        <div class="ticket-pass-body">
          <div>
            <h3 style="margin-bottom: 0.5rem; font-size: var(--text-lg);">${escapeHtml(event.title)}</h3>
            <div style="font-size: var(--text-sm); color: var(--color-ink-muted); margin-bottom: 1rem;">
              <p style="margin: 0.2rem 0;">📍 <strong>Venue:</strong> ${escapeHtml(event.venue)}</p>
              <p style="margin: 0.2rem 0;">📅 <strong>Date:</strong> ${dateStr} at ${timeStr}</p>
            </div>
          </div>

          <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
            <a href="event.html?id=${event.id || r.event_id}" class="btn btn-secondary btn-sm" style="flex: 1;">
              View Details
            </a>
            <button class="btn btn-ghost btn-sm cancel-reg-btn" data-event-id="${event.id || r.event_id}">
              Cancel Seat
            </button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  // Attach cancel handlers
  container.querySelectorAll('.cancel-reg-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const eventId = e.currentTarget.dataset.eventId;
      handleCancelSeat(eventId);
    });
  });
}

function renderWaitlistSpots() {
  const container = document.getElementById('waitlistSpotsContainer');
  if (!container) return;

  const waitlisted = registrations.filter(r => r.status === 'WAITLISTED');

  if (waitlisted.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; background: var(--color-surface); border: var(--border-strong); border-radius: var(--radius-card);">
        <div style="font-size: 3rem; margin-bottom: 0.5rem;">🎉</div>
        <h3>No Active Waiting Lists</h3>
        <p style="color: var(--color-ink-muted); margin: 0;">You're not currently in queue for any filled events.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = waitlisted.map(r => {
    const event = r.events || { title: 'College Event', starts_at: new Date().toISOString(), venue: 'Campus' };
    const rank = r.queueRank || r.waitlist_number || 1;

    return `
      <article class="ticket-pass-card" style="border-color: #D97706;">
        <div class="ticket-pass-top" style="background: var(--color-yellow-light);">
          <span class="queue-rank-badge">⏳ Queue Rank: #${rank}</span>
          <span style="font-family: var(--font-mono); font-size: var(--text-xs); font-weight: 700; color: #92400E;">FIFO ACTIVE</span>
        </div>

        <div class="ticket-pass-body">
          <div>
            <h3 style="margin-bottom: 0.5rem; font-size: var(--text-lg);">${escapeHtml(event.title)}</h3>
            <p style="font-size: var(--text-sm); color: var(--color-ink-muted); margin-bottom: 1rem;">
              You are currently <strong>#${rank}</strong> in the FIFO waiting list. If any registered attendee cancels, you will be atomically promoted!
            </p>
          </div>

          <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
            <a href="event.html?id=${event.id || r.event_id}" class="btn btn-secondary btn-sm" style="flex: 1;">
              Event Page
            </a>
            <button class="btn btn-ghost btn-sm withdraw-waitlist-btn" data-event-id="${event.id || r.event_id}">
              Withdraw
            </button>
          </div>
        </div>
      </article>
    `;
  }).join('');

  container.querySelectorAll('.withdraw-waitlist-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const eventId = e.currentTarget.dataset.eventId;
      handleWithdrawWaitlist(eventId);
    });
  });
}

function handleCancelSeat(eventId) {
  showConfirmModal({
    title: 'Cancel Confirmed Ticket?',
    message: 'Are you sure you want to cancel your seat? It will be immediately granted to the next student waiting in line.',
    confirmText: 'Yes, Release My Seat',
    cancelText: 'Keep My Ticket',
    onConfirm: async () => {
      try {
        const res = await API.post(`/events/${eventId}/cancel`);
        if (res.success) {
          showToast('Ticket cancelled. Seat released to FIFO queue.', 'info');
          await loadDashboardData();
        }
      } catch (err) {
        showToast(err.message || 'Failed to cancel seat.', 'error');
      }
    }
  });
}

function handleWithdrawWaitlist(eventId) {
  showConfirmModal({
    title: 'Withdraw from Waiting List?',
    message: 'Are you sure you want to withdraw? You will forfeit your position in the FIFO queue.',
    confirmText: 'Yes, Withdraw',
    cancelText: 'Stay in Queue',
    onConfirm: async () => {
      try {
        const res = await API.post(`/events/${eventId}/cancel`);
        if (res.success) {
          showToast('Withdrawn from waiting list.', 'info');
          await loadDashboardData();
        }
      } catch (err) {
        showToast(err.message || 'Failed to withdraw.', 'error');
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
