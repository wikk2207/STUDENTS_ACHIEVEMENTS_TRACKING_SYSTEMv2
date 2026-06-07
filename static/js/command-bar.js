/** Spotlight-style command bar */
(function () {
  const input = () => document.getElementById('commandBarInput');
  const results = () => document.getElementById('commandBarResults');

  async function search(q) {
    const url = window.SAAMS?.urls?.commandSearch;
    if (!url || !q) return [];
    try {
      const res = await fetch(`${url}?q=${encodeURIComponent(q)}`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.commands || data.results || data || [];
    } catch (_) {
      return [];
    }
  }

  function render(items) {
    const box = results();
    if (!box) return;
    if (!items.length) {
      box.hidden = true;
      return;
    }
    box.innerHTML = items
      .slice(0, 8)
      .map(
        (c) =>
          `<button type="button" class="command-item" data-url="${c.url || ''}">${c.label || c.title}</button>`
      )
      .join('');
    box.hidden = false;
    box.querySelectorAll('.command-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const u = btn.dataset.url;
        if (u) {
          if (window.SAAMSSpa?.navigate) window.SAAMSSpa.navigate(u);
          else window.location.href = u;
        }
        box.hidden = true;
      });
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const el = input();
    if (!el) return;
    let timer;
    el.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const q = el.value.trim();
        if (q.length < 2) {
          results()?.hidden = true;
          return;
        }
        render(await search(q));
      }, 200);
    });
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        el.focus();
      }
    });
  });
})();
