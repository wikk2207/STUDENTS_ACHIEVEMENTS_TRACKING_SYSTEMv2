/**
 * Smooth page transitions + guide continuity across navigations.
 */
(function () {
  const STYLE_ID = 'saams-spa-styles';

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #main-content { transition: opacity 0.35s ease, transform 0.35s ease; }
      #main-content.saams-page-exit { opacity: 0; transform: translateY(8px); pointer-events: none; }
      #main-content.saams-page-enter { animation: saamsPageEnter 0.45s ease forwards; }
      @keyframes saamsPageEnter {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: none; }
      }
      .page-skeleton { padding: 1rem 0; }
      .skeleton-line { height: 14px; background: linear-gradient(90deg,#e2e8f0 25%,#f8fafc 50%,#e2e8f0 75%); background-size: 200% 100%; animation: saamsShimmer 1.2s infinite; border-radius: 6px; margin-bottom: 10px; }
      .skeleton-line.w-75 { width: 75%; } .skeleton-line.w-50 { width: 50%; }
      @keyframes saamsShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
    `;
    document.head.appendChild(s);
  }

  function navigate(url, options = {}) {
    if (!url || url === window.location.pathname) {
      options.onArrived?.();
      return;
    }
    const delay = options.delay ?? 420;
    const main = document.getElementById('main-content');
    if (main) main.classList.add('saams-page-exit');
    setTimeout(() => {
      window.location.href = url;
    }, delay);
  }

  function onPageReady() {
    injectStyles();
    const main = document.getElementById('main-content');
    if (main) {
      main.classList.remove('saams-page-exit');
      main.classList.add('saams-page-enter');
      setTimeout(() => main.classList.remove('saams-page-enter'), 500);
    }
    if (window.AuthFlow?.resume) {
      setTimeout(() => window.AuthFlow.resume(), 500);
    }
    if (window.UploadFlow?.resumePendingUpload) {
      setTimeout(() => window.UploadFlow.resumePendingUpload(), 600);
    }
  }

  function bindSmoothLinks() {
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href]');
      if (!a || a.target === '_blank' || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (a.hasAttribute('download') || a.dataset.noSpa !== undefined) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) return;
      try {
        const url = new URL(href, window.location.origin);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname && url.search === window.location.search) return;
        e.preventDefault();
        navigate(url.pathname + url.search + url.hash);
      } catch (_) {}
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    onPageReady();
    bindSmoothLinks();
  });

  window.SAAMSSpa = { navigate, onPageReady };
})();
