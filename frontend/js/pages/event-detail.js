import { API } from '../api.js';
import { CONFIG } from '../config.js';
import { showToast, showConfirmModal, triggerConfetti, setButtonLoading } from '../ui.js';

let currentEvent = null;
let userRegistration = null;
let currentProfile = null;

document.addEventListener('DOMContentLoaded', async () => {
  setupNav();

  const urlParams = new URLSearchParams(window.location.search);
  const eventId = urlParams.get('id');

  if (!eventId) {
    showError('No event ID specified. Please select an event from the schedule.');
    return;
  }

  await loadEventData(eventId);
});

async function loadEventData(eventId) {
  const loadingEl = document.getElementById('loadingState');
  const contentEl = document.getElementById('eventDetailContent');

  try {
    // 1. Fetch Event Details
    const res = await API.get(`/events/${eventId}`);
    if (!res.success || !res.data) {
      throw new Error('Event not found or failed to load.');
    }
    currentEvent = res.data;

    // 2. Check User Registration Status if logged in
    const token = localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
    const profileRaw = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_PROFILE);
    if (token && profileRaw) {
      try {
        currentProfile = JSON.parse(profileRaw);
        const regRes = await API.get('/me/registrations');
        if (regRes.success && Array.isArray(regRes.data)) {
          userRegistration = regRes.data.find(
            r => (r.event_id === eventId || r.events?.id === eventId) && r.status !== 'CANCELLED'
          );
        }
      } catch (authErr) {
        console.warn('Could not retrieve user registration status:', authErr);
      }
    }

    // 3. Render Page
    renderHeader();
    renderDescription();
    renderRegistrationCard();

    if (loadingEl) loadingEl.style.display = 'none';
    if (contentEl) contentEl.style.display = 'block';

  } catch (err) {
    console.error('Error loading event:', err);
    showError(err.message || 'Unable to load event details.');
  }
}

function renderHeader() {
  const container = document.getElementById('headerContainer');
  if (!container || !currentEvent) return;

  const dateObj = new Date(currentEvent.starts_at);
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
  const formattedTime = dateObj.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  const category = currentEvent.category || 'General';
  const themeClass = `theme-${category.toLowerCase()}`;
  const icon = getCategoryIcon(category);

  container.innerHTML = `
    <div class="detail-hero-banner ${themeClass}">
      <span class="category-sticker" style="top: 1.5rem; left: 1.5rem;">${escapeHtml(category)}</span>
      <div class="detail-banner-icon">${icon}</div>
      <div style="position: relative; z-index: 2;">
        <h1 style="color: #FFFFFF; text-shadow: 3px 3px 0px rgba(0,0,0,0.8); margin-bottom: 0.25rem; font-size: clamp(1.75rem, 4vw, 2.75rem);">
          ${escapeHtml(currentEvent.title)}
        </h1>
        <p style="color: rgba(255,255,255,0.95); font-weight: 700; margin: 0; font-size: var(--text-base); text-shadow: 2px 2px 0px rgba(0,0,0,0.6);">
          Organized by ${escapeHtml(currentEvent.organizer || 'College Student Council')}
        </p>
      </div>
    </div>

    <div class="detail-header-body">
      <div class="meta-box-grid">
        <div class="meta-box">
          <div class="meta-box-label">📅 Date</div>
          <div class="meta-box-value">${formattedDate}</div>
        </div>
        <div class="meta-box">
          <div class="meta-box-label">⏰ Time</div>
          <div class="meta-box-value">${formattedTime}</div>
        </div>
        <div class="meta-box">
          <div class="meta-box-label">📍 Venue</div>
          <div class="meta-box-value">${escapeHtml(currentEvent.venue || 'Main Auditorium')}</div>
        </div>
        <div class="meta-box">
          <div class="meta-box-label">👥 Total Capacity</div>
          <div class="meta-box-value">${currentEvent.capacity} Attendees</div>
        </div>
      </div>
    </div>
  `;
}

function renderDescription() {
  const container = document.getElementById('eventDescription');
  if (!container || !currentEvent) return;

  const desc = currentEvent.description || 'Join us for this exciting campus event! Check out the details and reserve your seat below.';
  
  // Format line breaks
  container.innerHTML = desc.split('\n\n').map(p => `<p style="margin-bottom: 1rem;">${escapeHtml(p)}</p>`).join('');
}

function renderRegistrationCard() {
  const card = document.getElementById('registrationCard');
  if (!card || !currentEvent) return;

  const confirmed = currentEvent.confirmed_count || 0;
  const capacity = currentEvent.capacity || 1;
  const remaining = Math.max(0, capacity - confirmed);
  const pct = Math.min(100, Math.round((confirmed / capacity) * 100));
  const isFull = confirmed >= capacity;
  const waitlistCount = currentEvent.waitlist_count || 0;

  // Case 1: User is already CONFIRMED
  if (userRegistration && userRegistration.status === 'CONFIRMED') {
    card.innerHTML = `
      <div class="ticket-badge-confirmed">
        <div style="font-size: 2.5rem; margin-bottom: 0.25rem;">🎟️</div>
        <h3 style="color: var(--color-green-dark); margin-bottom: 0.25rem;">Confirmed Ticket</h3>
        <p style="font-size: var(--text-sm); font-weight: 700; margin: 0;">
          You hold a reserved seat!
        </p>
        <div style="font-family: var(--font-mono); font-size: var(--text-xs); margin-top: 0.5rem; color: var(--color-ink-muted);">
          Ticket Ref: ${userRegistration.id}
        </div>
      </div>

      <div style="margin-bottom: 1.5rem; font-size: var(--text-sm);">
        <p><strong>Attendee:</strong> ${escapeHtml(currentProfile?.full_name || 'Student')}</p>
        <p><strong>Status:</strong> <span class="badge-status badge-confirmed">CONFIRMED</span></p>
        <p style="color: var(--color-ink-muted); font-size: var(--text-xs);">
          Please arrive 15 minutes before start time with your college ID card.
        </p>
      </div>

      <button id="cancelRegistrationBtn" class="btn btn-secondary btn-full">
        Cancel Registration
      </button>

      <div class="dsa-badge-notice">
        <span>🔄</span>
        <span>FIFO Queue: If you cancel, the first waitlisted student will be immediately promoted.</span>
      </div>
    `;

    document.getElementById('cancelRegistrationBtn')?.addEventListener('click', handleCancelRegistration);
    return;
  }

  // Case 2: User is on the WAITING LIST
  if (userRegistration && userRegistration.status === 'WAITLISTED') {
    const queueRank = userRegistration.queueRank || userRegistration.waitlist_number || 1;
    card.innerHTML = `
      <div class="ticket-badge-waitlist">
        <div style="font-size: 2.5rem; margin-bottom: 0.25rem;">⏳</div>
        <h3 style="color: #B45309; margin-bottom: 0.25rem;">Waiting List Position</h3>
        <div style="font-size: 2.25rem; font-family: var(--font-display); font-weight: 800; color: #B45309;">
          #${queueRank}
        </div>
        <p style="font-size: var(--text-sm); font-weight: 700; margin: 0;">
          In FIFO Waiting Queue
        </p>
      </div>

      <p style="font-size: var(--text-sm); line-height: 1.6; margin-bottom: 1.5rem;">
        You will be automatically promoted to <strong>CONFIRMED</strong> as soon as a registered attendee cancels their reservation.
      </p>

      <button id="withdrawWaitlistBtn" class="btn btn-secondary btn-full">
        Withdraw from Waitlist
      </button>

      <div class="dsa-badge-notice">
        <span>⚡</span>
        <span>O(1) FIFO Dequeue: Guaranteed chronological order of arrival.</span>
      </div>
    `;

    document.getElementById('withdrawWaitlistBtn')?.addEventListener('click', handleCancelRegistration);
    return;
  }

  // Case 3: User is NOT registered yet
  card.innerHTML = `
    <h3 style="margin-bottom: 1rem;">Reservation Status</h3>

    <div class="capacity-container" style="margin-bottom: 1.5rem;">
      <div class="capacity-header">
        <span>${isFull ? '🔴 Venue Full' : '🟢 Seats Available'}</span>
        <span><strong>${confirmed}</strong> / ${capacity}</span>
      </div>
      <div class="capacity-bar" style="height: 14px;">
        <div class="capacity-fill ${isFull ? 'full' : (pct > 75 ? 'high' : '')}" style="width: ${pct}%;"></div>
      </div>
      <div style="display: flex; justify-content: space-between; margin-top: 0.5rem; font-size: var(--text-xs); color: var(--color-ink-muted); font-weight: 700;">
        <span>${remaining} seats remaining</span>
        <span>${waitlistCount} currently waiting</span>
      </div>
    </div>

    ${!currentProfile ? `
      <div style="background: var(--color-paper); border: var(--border-medium); border-radius: var(--radius-sm); padding: 1rem; margin-bottom: 1.25rem; text-align: center;">
        <p style="font-weight: 700; font-size: var(--text-sm); margin-bottom: 0.75rem;">
          Sign in to secure your seat or join the waiting list.
        </p>
        <a href="login.html?redirect=${encodeURIComponent(window.location.href)}" class="btn btn-primary btn-full">
          Sign In to Register &rarr;
        </a>
      </div>
    ` : isFull ? `
      <p style="font-size: var(--text-sm); color: var(--color-ink-muted); margin-bottom: 1rem;">
        All confirmed seats have been claimed. You can join the <strong>FIFO Waiting List</strong> to be automatically promoted if a seat opens up.
      </p>
      <button id="registerActionBtn" class="btn btn-warning btn-full btn-lg">
        ⏳ Join Waiting List (Queue #${waitlistCount + 1})
      </button>
    ` : `
      <p style="font-size: var(--text-sm); color: var(--color-ink-muted); margin-bottom: 1rem;">
        Registration is free for all current college students. Immediate confirmation guaranteed.
      </p>
      <button id="registerActionBtn" class="btn btn-primary btn-full btn-lg">
        🎟️ Register for Event (Free Ticket)
      </button>
    `}

    <div class="dsa-badge-notice">
      <span>🛡️</span>
      <span>Composite Hash Check: Prevents accidental or duplicate registrations.</span>
    </div>
  `;

  document.getElementById('registerActionBtn')?.addEventListener('click', handleRegister);
}

async function handleRegister(e) {
  const btn = e.currentTarget;
  if (!currentEvent) return;

  setButtonLoading(btn, true);

  try {
    const res = await API.post(`/events/${currentEvent.id}/register`);
    if (res.success && res.data) {
      if (res.data.status === 'CONFIRMED') {
        triggerConfetti();
        showToast('🎉 Seat confirmed! You are registered for this event.', 'success');
      } else if (res.data.status === 'WAITLISTED') {
        showToast(`⏳ Event full. You are #${res.data.waitlistPosition} on the waiting list.`, 'info');
      }

      // Reload state
      await loadEventData(currentEvent.id);
    }
  } catch (err) {
    console.error('Registration failed:', err);
    showToast(err.message || 'Registration request could not be processed.', 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}

function handleCancelRegistration() {
  if (!currentEvent) return;

  const isWaitlist = userRegistration?.status === 'WAITLISTED';
  const title = isWaitlist ? 'Withdraw from Waiting List?' : 'Cancel Confirmed Ticket?';
  const message = isWaitlist 
    ? 'Are you sure you want to withdraw from the waiting list? You will lose your current queue position.'
    : 'Are you sure you want to cancel your seat? Your seat will be immediately and automatically offered to the next student in the FIFO waiting list!';

  showConfirmModal({
    title,
    message,
    confirmText: 'Yes, Cancel Registration',
    cancelText: 'Keep My Spot',
    onConfirm: async () => {
      try {
        const res = await API.post(`/events/${currentEvent.id}/cancel`);
        if (res.success) {
          showToast('Your registration has been cancelled.', 'info');
          userRegistration = null;
          await loadEventData(currentEvent.id);
        }
      } catch (err) {
        console.error('Cancellation failed:', err);
        showToast(err.message || 'Unable to cancel registration.', 'error');
      }
    }
  });
}

function showError(msg) {
  const loadingEl = document.getElementById('loadingState');
  if (loadingEl) {
    loadingEl.innerHTML = `
      <div style="background: var(--color-surface); border: var(--border-strong); border-radius: var(--radius-card); padding: 3rem 1.5rem; max-width: 500px; margin: 0 auto; box-shadow: var(--shadow-small);">
        <div style="font-size: 3.5rem; margin-bottom: 1rem;">⚠️</div>
        <h3>Unable to Display Event</h3>
        <p style="margin-bottom: 1.5rem;">${escapeHtml(msg)}</p>
        <a href="events.html" class="btn btn-primary btn-sm">&larr; Return to Events Schedule</a>
      </div>
    `;
  }
}

function setupNav() {
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mainNav = document.getElementById('mainNav');
  if (mobileMenuBtn && mainNav) {
    mobileMenuBtn.addEventListener('click', () => mainNav.classList.toggle('nav-open'));
  }

  const token = localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
  const profileRaw = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_PROFILE);
  if (token && profileRaw) {
    try {
      const profile = JSON.parse(profileRaw);
      document.getElementById('navLoginBtn')?.remove();
      document.getElementById('navSignupBtn')?.remove();
      
      const badge = document.getElementById('navUserBadge');
      if (badge) {
        badge.style.display = 'inline-flex';
        document.getElementById('navUserName').textContent = profile.full_name || 'Student';
        document.getElementById('navUserAvatar').textContent = (profile.full_name || 'S')[0].toUpperCase();
      }

      const dashLink = document.getElementById('navDashboardLink');
      if (dashLink) dashLink.style.display = 'inline-block';

      if (profile.role === 'admin') {
        const adminLink = document.getElementById('navAdminLink');
        if (adminLink) adminLink.style.display = 'inline-block';
      }

      document.getElementById('navLogoutBtn')?.addEventListener('click', () => {
        localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
        localStorage.removeItem(CONFIG.STORAGE_KEYS.USER_PROFILE);
        showToast('Logged out.', 'info');
        setTimeout(() => window.location.reload(), 300);
      });
    } catch {}
  }
}

function getCategoryIcon(category) {
  const map = {
    hackathon: '💻',
    workshop: '🛠️',
    technical: '⚡',
    cultural: '🎸',
    sports: '♟️',
    entrepreneurship: '💡'
  };
  return map[(category || '').toLowerCase()] || '🎟️';
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
