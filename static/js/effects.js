(function () {
  const celebrate = document.body.dataset.celebrate;
  if (celebrate && typeof confetti === 'function') {
    confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
  }
})();
