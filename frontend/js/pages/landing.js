import { triggerConfetti, showToast } from '../ui.js';
import { CONFIG } from '../config.js';

document.addEventListener('DOMContentLoaded', () => {
  // ========================================================================
  // 1. MOBILE MENU TOGGLE
  // ========================================================================
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mainNav = document.getElementById('mainNav');

  if (mobileMenuBtn && mainNav) {
    mobileMenuBtn.addEventListener('click', () => {
      mainNav.classList.toggle('nav-open');
    });
  }

  // ========================================================================
  // 2. USER AUTHENTICATION STATE IN NAVBAR
  // ========================================================================
  const token = localStorage.getItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
  const profileRaw = localStorage.getItem(CONFIG.STORAGE_KEYS.USER_PROFILE);
  const navLoginBtn = document.getElementById('navLoginBtn');
  const navSignupBtn = document.getElementById('navSignupBtn');
  const navUserBadge = document.getElementById('navUserBadge');
  const navDashboardLink = document.getElementById('navDashboardLink');
  const navAdminLink = document.getElementById('navAdminLink');
  const navUserName = document.getElementById('navUserName');
  const navUserAvatar = document.getElementById('navUserAvatar');
  const navLogoutBtn = document.getElementById('navLogoutBtn');

  if (token && profileRaw) {
    try {
      const profile = JSON.parse(profileRaw);
      if (navLoginBtn) navLoginBtn.style.display = 'none';
      if (navSignupBtn) navSignupBtn.style.display = 'none';
      if (navUserBadge) navUserBadge.style.display = 'inline-flex';
      if (navDashboardLink) navDashboardLink.style.display = 'inline-block';

      if (navUserName) navUserName.textContent = profile.full_name || 'Student';
      if (navUserAvatar) navUserAvatar.textContent = (profile.full_name || 'S')[0].toUpperCase();

      if (profile.role === 'admin' && navAdminLink) {
        navAdminLink.style.display = 'inline-block';
      }
    } catch (e) {
      console.error('Failed to parse cached profile:', e);
    }
  }

  if (navLogoutBtn) {
    navLogoutBtn.addEventListener('click', () => {
      localStorage.removeItem(CONFIG.STORAGE_KEYS.AUTH_TOKEN);
      localStorage.removeItem(CONFIG.STORAGE_KEYS.USER_PROFILE);
      showToast('Logged out successfully.', 'info');
      setTimeout(() => window.location.reload(), 400);
    });
  }

  // ========================================================================
  // 3. SCROLL-TRIGGERED REVEAL ANIMATIONS (IntersectionObserver)
  // ========================================================================
  const observerOptions = {
    root: null,
    rootMargin: '0px 0px -60px 0px',
    threshold: 0.15
  };

  const revealObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  document.querySelectorAll('.reveal-on-scroll').forEach(el => {
    revealObserver.observe(el);
  });

  // ========================================================================
  // 4. INTERACTIVE LIVE FIFO WAITLIST SIMULATION
  // ========================================================================
  const btnSimulate = document.getElementById('btnSimulateCancel');
  let simulationState = 0;

  if (btnSimulate) {
    btnSimulate.addEventListener('click', () => {
      if (simulationState === 0) {
        // Step 1: Jordan cancels, Liam promoted
        const chipJordan = document.getElementById('chipStudent3');
        const chipLiam = document.getElementById('chipWaitlist1');
        const chipMaya = document.getElementById('chipWaitlist2');

        if (chipJordan && chipLiam) {
          chipJordan.style.transition = 'all 0.3s ease-out';
          chipJordan.style.opacity = '0.3';
          chipJordan.style.textDecoration = 'line-through';
          chipJordan.textContent = '❌ Jordan T. (Cancelled)';

          setTimeout(() => {
            chipJordan.remove();
            chipLiam.className = 'queue-chip confirmed';
            chipLiam.innerHTML = '🎉 Seat 3: Liam K. (Promoted! 🎟️)';
            triggerConfetti();
            showToast('Jordan cancelled. Liam K. promoted from Waitlist #1 to Confirmed!', 'success');

            if (chipMaya) {
              chipMaya.innerHTML = '⏳ Rank 1: Maya R. (Shifted to #1)';
            }
          }, 350);
        }
        btnSimulate.textContent = 'Reset Simulation 🔄';
        simulationState = 1;
      } else {
        // Reset lane
        const lane = document.getElementById('demoQueueLane');
        if (lane) {
          lane.innerHTML = `
            <div class="queue-chip confirmed" id="chipStudent1">🎟️ Seat 1: Alex M. (Confirmed)</div>
            <div class="queue-chip confirmed" id="chipStudent2">🎟️ Seat 2: Priya S. (Confirmed)</div>
            <div class="queue-chip confirmed" id="chipStudent3">🎟️ Seat 3: Jordan T. (Confirmed)</div>
            <span style="font-weight: 800; color: var(--color-muted);">&#x2502; WAITLIST &rarr;</span>
            <div class="queue-chip" id="chipWaitlist1">⏳ Rank 1: Liam K. (Waitlisted)</div>
            <div class="queue-chip" id="chipWaitlist2">⏳ Rank 2: Maya R. (Waitlisted)</div>
          `;
        }
        btnSimulate.textContent = 'Simulate Seat Cancellation 🔄';
        simulationState = 0;
        showToast('Waitlist lane reset to initial state.', 'info');
      }
    });
  }
});
