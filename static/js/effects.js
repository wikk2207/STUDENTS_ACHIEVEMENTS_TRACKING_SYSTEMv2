(function () {
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function hideLoader() {
    const loader = document.getElementById('saamsLoader');
    if (!loader) return;
    if (document.body.classList.contains('landing-page')) {
      loader.remove();
      return;
    }
    window.setTimeout(() => loader.classList.add('loader-hidden'), 360);
    window.setTimeout(() => loader.remove(), 950);
  }

  function celebrateIfNeeded() {
    const celebrate = document.body.dataset.celebrate;
    if (celebrate && typeof confetti === 'function') {
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
    }
  }

  function initReveal() {
    if (document.body.classList.contains('landing-page')) {
      return;
    }

    const selectors = [
      '.auth-card',
      '.page-header',
      '.kpi-card',
      '.feature-card',
      '.glass-panel',
      '.surface-card',
      '.table-glass',
      '.profile-card-details',
      '.hero-actions',
      '.voice-commands-landing'
    ];
    const items = Array.from(document.querySelectorAll(selectors.join(',')))
      .filter((el, index, all) => all.indexOf(el) === index && !el.closest('.sidebar') && !el.closest('.topbar'));

    items.forEach((el, index) => {
      el.classList.add('reveal-item');
      el.style.setProperty('--reveal-delay', `${Math.min(index * 45, 360)}ms`);
    });

    if (prefersReducedMotion || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('revealed'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0.12 });

    items.forEach((el) => observer.observe(el));
    window.setTimeout(() => {
      items.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.top < window.innerHeight && rect.bottom > 0) {
          el.classList.add('revealed');
          observer.unobserve(el);
        }
      });
    }, 180);
  }

  function initHoverMotion() {
    const hoverSelectors = [
      '.auth-glow-card',
      '.kpi-card',
      '.feature-card',
      '.glass-panel',
      '.surface-card',
      '.profile-card-details',
      '.table-glass'
    ];

    document.querySelectorAll(hoverSelectors.join(',')).forEach((el) => {
      if (el.closest('.sidebar') || el.closest('.topbar') || el.classList.contains('landing-cockpit')) return;
      el.classList.add('motion-hover');
    });

    document.querySelectorAll('.auth-glow-card, .card-3d').forEach((card) => {
      card.classList.add('motion-hover-3d');
      if (prefersReducedMotion) return;

      card.addEventListener('pointermove', (event) => {
        const rect = card.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width;
        const y = (event.clientY - rect.top) / rect.height;
        card.style.setProperty('--card-x', `${x * 100}%`);
        card.style.setProperty('--card-y', `${y * 100}%`);
        card.style.setProperty('--tilt-x', `${(x - 0.5) * 6}deg`);
        card.style.setProperty('--tilt-y', `${(0.5 - y) * 6}deg`);
        card.style.setProperty('--hover-y', '-4px');
      }, { passive: true });

      card.addEventListener('pointerleave', () => {
        card.style.setProperty('--tilt-x', '0deg');
        card.style.setProperty('--tilt-y', '0deg');
        card.style.setProperty('--hover-y', '0');
        card.style.setProperty('--card-x', '50%');
        card.style.setProperty('--card-y', '20%');
      });
    });

    document.querySelectorAll('.btn, .nav-link, .command-item, .theme-switcher, input, select, textarea').forEach((el) => {
      el.classList.add('micro-pop');
    });
  }

  function initParallax() {
    if (prefersReducedMotion) return;
    const root = document.documentElement;
    window.addEventListener('pointermove', (event) => {
      const px = ((event.clientX / window.innerWidth) - 0.5) * 2;
      const py = ((event.clientY / window.innerHeight) - 0.5) * 2;
      root.style.setProperty('--global-parallax-x', (px * 10).toFixed(2));
      root.style.setProperty('--global-parallax-y', (py * 10).toFixed(2));
    }, { passive: true });
  }

  function initCursor() {
    if (prefersReducedMotion || window.matchMedia('(pointer: coarse)').matches) return;

    const glow = document.createElement('span');
    glow.className = 'cursor-glow';
    document.body.appendChild(glow);

    let lastSpark = 0;

    window.addEventListener('pointermove', (event) => {
      glow.style.transform = `translate3d(${event.clientX - 18}px, ${event.clientY - 18}px, 0)`;

      const now = Date.now();
      if (now - lastSpark < 95) return;
      lastSpark = now;

      const spark = document.createElement('span');
      spark.className = 'cursor-sparkle';
      document.body.appendChild(spark);
      const driftX = (Math.random() - 0.5) * 38;
      const driftY = -18 - Math.random() * 30;
      spark.animate([
        { transform: `translate3d(${event.clientX}px, ${event.clientY}px, 0) scale(0.7)`, opacity: 0 },
        { opacity: 0.85, offset: 0.2 },
        { transform: `translate3d(${event.clientX + driftX}px, ${event.clientY + driftY}px, 0) scale(1.25)`, opacity: 0 }
      ], {
        duration: 900,
        easing: 'cubic-bezier(.2,.8,.2,1)',
        fill: 'forwards'
      }).onfinish = () => spark.remove();
    }, { passive: true });
  }

  document.addEventListener('DOMContentLoaded', () => {
    celebrateIfNeeded();
    initReveal();
    initHoverMotion();
    initParallax();
    initCursor();
    hideLoader();
  });

  window.addEventListener('pageshow', hideLoader);
})();
