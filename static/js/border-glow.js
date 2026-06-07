(function () {
  document.querySelectorAll('[data-border-glow]').forEach((card) => {
    card.classList.add('border-glow-card');
    card.dataset.borderGlowEnhanced = 'true';
  });
})();
