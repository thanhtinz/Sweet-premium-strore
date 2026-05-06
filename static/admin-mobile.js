/**
 * Admin Mobile — hamburger toggle + overlay for admin sidebar
 * Complements admin.js by injecting overlay element and nav-close behavior.
 * NOTE: admin.js already creates the hamburger button (#admin-hamburger) and
 * binds its click handler, so we do NOT add a duplicate click handler here.
 */

(function initAdminMobile() {
  // Wait for DOM + admin shell to be ready
  const observer = new MutationObserver(() => {
    const wrap = qs('#admin-wrap');
    if (!wrap || !wrap.querySelector('.admin-layout')) return;

    // Only inject once
    if (wrap.querySelector('.admin-sidebar-overlay')) return;

    // Create overlay if admin.js didn't create one
    if (!qs('#admin-sidebar-overlay', wrap)) {
      const overlay = document.createElement('div');
      overlay.className = 'admin-sidebar-overlay';
      overlay.id = 'admin-sidebar-overlay';
      wrap.appendChild(overlay);

      // Close on overlay click
      overlay.addEventListener('click', () => {
        qs('#admin-sidebar', wrap)?.classList.remove('open');
        overlay.classList.remove('open');
      });
    }

    // Close on nav click (mobile)
    qsa('.admin-nav-item', wrap).forEach(item => {
      item.addEventListener('click', () => {
        if (window.innerWidth <= 1024) {
          qs('#admin-sidebar', wrap)?.classList.remove('open');
          qs('#admin-sidebar-overlay', wrap)?.classList.remove('open');
        }
      });
    });
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
