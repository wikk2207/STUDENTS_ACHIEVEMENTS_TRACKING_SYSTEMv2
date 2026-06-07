/** Sidebar gooey nav — highlights active link */
(function () {
  document.querySelectorAll('[data-gooey-nav]').forEach((root) => {
    const items = root.querySelectorAll('nav ul li');
    items.forEach((li) => {
      li.addEventListener('mouseenter', () => li.classList.add('gooey-hover'));
      li.addEventListener('mouseleave', () => li.classList.remove('gooey-hover'));
    });
  });
})();
