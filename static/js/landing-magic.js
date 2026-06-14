(function () {
  const hero = document.querySelector('.landing-hero');
  const layer = document.querySelector('.magic-cursor-layer');

  if (!hero || !layer) return;

  document.querySelectorAll('.welcome-bg-video').forEach((video) => {
    video.playbackRate = 0.35;
    video.defaultPlaybackRate = 0.35;
    video.play().catch(() => {});
  });

  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) return;

  let lastTrail = 0;
  let lastRipple = 0;
  const types = [
    'cursor-petal',
    'cursor-petal',
    'cursor-petal',
    'cursor-soft-petal',
    'cursor-soft-petal',
    'cursor-particle',
    'cursor-spark',
    'cursor-butterfly'
  ];

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function makeElement(className, x, y) {
    const el = document.createElement('span');
    el.className = className;
    el.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    layer.appendChild(el);
    return el;
  }

  function animateTrail(x, y) {
    const className = types[Math.floor(Math.random() * types.length)];
    const el = makeElement(className, x + randomBetween(-8, 8), y + randomBetween(-8, 8));
    const startX = x + randomBetween(-10, 10);
    const startY = y + randomBetween(-10, 10);
    const driftX = randomBetween(-46, 46);
    const driftY = randomBetween(-70, -24);
    const rotate = randomBetween(-120, 120);
    const duration = randomBetween(1250, 2200);
    const scale = className.includes('petal') ? randomBetween(0.62, 1.1) : randomBetween(0.72, 1.15);

    el.animate([
      { transform: `translate3d(${startX}px, ${startY}px, 0) rotate(0deg) scale(${scale * 0.68})`, opacity: 0 },
      { opacity: className.includes('petal') ? 0.76 : 0.86, offset: 0.16 },
      { transform: `translate3d(${startX + driftX * 0.52}px, ${startY + driftY * 0.5}px, 0) rotate(${rotate * 0.45}deg) scale(${scale})`, opacity: 0.72, offset: 0.52 },
      { transform: `translate3d(${startX + driftX}px, ${startY + driftY}px, 0) rotate(${rotate}deg) scale(${scale * 0.92})`, opacity: 0 }
    ], {
      duration,
      easing: 'cubic-bezier(.2,.75,.2,1)',
      fill: 'forwards'
    }).onfinish = () => el.remove();
  }

  function animateRipple(x, y) {
    const el = makeElement('cursor-ripple', x - 8, y - 8);
    el.animate([
      { transform: `translate3d(${x - 8}px, ${y - 8}px, 0) scale(0.4)`, opacity: 0.72 },
      { transform: `translate3d(${x - 8}px, ${y - 8}px, 0) scale(8)`, opacity: 0 }
    ], {
      duration: 850,
      easing: 'cubic-bezier(.16,.84,.44,1)',
      fill: 'forwards'
    }).onfinish = () => el.remove();
  }

  function updateParallax(event) {
    const rect = hero.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const px = ((x / rect.width) - 0.5) * 2;
    const py = ((y / rect.height) - 0.5) * 2;

    hero.style.setProperty('--mouse-x', `${(x / rect.width) * 100}%`);
    hero.style.setProperty('--mouse-y', `${(y / rect.height) * 100}%`);
    hero.style.setProperty('--parallax-x', (px * 18).toFixed(2));
    hero.style.setProperty('--parallax-y', (py * 18).toFixed(2));
  }

  hero.addEventListener('pointermove', (event) => {
    updateParallax(event);

    const rect = hero.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    const now = performance.now();

    if (now - lastTrail > 52) {
      animateTrail(x, y);
      if (Math.random() > 0.58) {
        animateTrail(x + randomBetween(-12, 12), y + randomBetween(-12, 12));
      }
      lastTrail = now;
    }

    if (now - lastRipple > 420) {
      animateRipple(x, y);
      lastRipple = now;
    }
  }, { passive: true });

  hero.addEventListener('pointerleave', () => {
    hero.style.setProperty('--parallax-x', '0');
    hero.style.setProperty('--parallax-y', '0');
    hero.style.setProperty('--mouse-x', '50%');
    hero.style.setProperty('--mouse-y', '42%');
  });
})();
