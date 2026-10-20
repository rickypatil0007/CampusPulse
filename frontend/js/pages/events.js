import { API } from '../api.js';
import { CONFIG } from '../config.js';
import { mergeSort, Comparators } from '../utils/merge-sort.js';
import { showToast } from '../ui.js';

let rawEvents = [];
let currentCategory = 'All';
let currentSearch = '';
let currentSort = 'byDateAscending';

document.addEventListener('DOMContentLoaded', async () => {
  // Mobile Nav Toggle & Auth check
  setupNav();

  // Load events
  await fetchEvents();

  // Attach search listener
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      currentSearch = e.target.value.toLowerCase().trim();
      renderEvents();
    });
  }

  // Attach Merge Sort listener
  const sortDropdown = document.getElementById('sortDropdown');
  if (sortDropdown) {
    sortDropdown.addEventListener('change', (e) => {
      currentSort = e.target.value;
      renderEvents();
    });
  }

  // Attach Category Pills listener
  const pills = document.querySelectorAll('.pill-filter');
  pills.forEach(pill => {
    pill.addEventListener('click', () => {
      pills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentCategory = pill.dataset.category;
      renderEvents();
    });
  });
});

async function fetchEvents() {
  const container = document.getElementById('eventsGridContainer');
  if (container) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem;">
        <span class="spinner-8bit" style="width: 28px; height: 28px; border-width: 4px; border-color: var(--color-purple); border-top-color: transparent;"></span>
        <p style="margin-top: 1rem; font-weight: 700;">Loading live college events...</p>
      </div>
    `;
  }

  try {
    const res = await API.get('/events');
    if (res.success && Array.isArray(res.data)) {
      rawEvents = res.data;
      renderEvents();
    } else {
      throw new Error('Unexpected response format.');
    }
  } catch (err) {
    console.error('Failed to fetch events:', err);
    if (container) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; background: var(--color-surface); border: var(--border-strong); border-radius: var(--radius-card);">
          <div style="font-size: 3rem;">⚠️</div>
          <h3>Failed to Load Events</h3>
          <p>${err.message}</p>
          <button class="btn btn-primary btn-sm" onclick="window.location.reload()">Retry Connection</button>
        </div>
      `;
    }
  }
}

function renderEvents() {
  const container = document.getElementById('eventsGridContainer');
  if (!container) return;

  // 1. Filter by Category & Search keyword
  let filtered = rawEvents.filter(evt => {
    const matchesCat = currentCategory === 'All' || 
      evt.category.toLowerCase() === currentCategory.toLowerCase();
    
    const matchesSearch = !currentSearch ||
      evt.title.toLowerCase().includes(currentSearch) ||
      (evt.description || '').toLowerCase().includes(currentSearch) ||
      evt.venue.toLowerCase().includes(currentSearch);

    return matchesCat && matchesSearch;
  });

  // 2. Client-Side Algorithmic Merge Sort
  const comparator = Comparators[currentSort] || Comparators.byDateAscending;
  const sorted = mergeSort(filtered, comparator);

  if (sorted.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1rem; background: var(--color-surface); border: var(--border-strong); border-radius: var(--radius-card); box-shadow: var(--shadow-small);">
        <div style="font-size: 3.5rem;">🔍</div>
        <h3>No Events Found</h3>
        <p>No published events match your filter '${currentCategory}' and search '${currentSearch}'.</p>
      </div>
    `;
    return;
  }

  // 3. Render Collectible Festival Event Cards
  container.innerHTML = sorted.map(evt => {
    const dateObj = new Date(evt.starts_at);
    const month = dateObj.toLocaleString('en-US', { month: 'short' });
    const day = dateObj.getDate();
    const time = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const confirmed = evt.confirmed_count || 0;
    const capacity = evt.capacity || 1;
    const remaining = Math.max(0, capacity - confirmed);
    const pct = Math.min(100, Math.round((confirmed / capacity) * 100));
    const isFull = confirmed >= capacity;

    const themeClass = `theme-${(evt.category || 'general').toLowerCase()}`;
    const icon = getCategoryIcon(evt.category);

    return `
      <article class="event-card">
        <div class="card-banner ${themeClass}">
          <span class="category-sticker">${evt.category}</span>
          <div class="card-date-badge">
            <div class="card-date-month">${month}</div>
            <div class="card-date-day">${day}</div>
          </div>
          <div class="card-illustration">${icon}</div>
        </div>

        <div class="card-body">
          <h3 class="card-title">${escapeHtml(evt.title)}</h3>
          
          <div class="card-meta">
            <div class="meta-item"><span>📍</span> <span>${escapeHtml(evt.venue)}</span></div>
            <div class="meta-item"><span>⏰</span> <span>${time}</span></div>
          </div>

          <div class="capacity-container">
            <div class="capacity-header">
              <span>${isFull ? '🔴 Capacity Full' : '🟢 Seats Available'}</span>
              <span><strong>${confirmed}</strong> / ${capacity} (${remaining} left)</span>
            </div>
            <div class="capacity-bar">
              <div class="capacity-fill ${isFull ? 'full' : (pct > 75 ? 'high' : '')}" style="width: ${pct}%;"></div>
            </div>
          </div>

          <div class="card-actions">
            ${isFull ? `
              <span class="badge-status badge-waitlist">⏳ Waitlist Active (${evt.waitlist_count || 0})</span>
              <a href="event.html?id=${evt.id}" class="btn btn-secondary btn-sm">Join Waitlist &rarr;</a>
            ` : `
              <span class="badge-status badge-confirmed">🎟️ Open (${remaining} Left)</span>
              <a href="event.html?id=${evt.id}" class="btn btn-primary btn-sm">Register Now &rarr;</a>
            `}
          </div>
        </div>
      </article>
    `;
  }).join('');
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

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
