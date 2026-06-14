/** Spotlight-style command bar */
(function () {
  const input = () => document.getElementById('commandBarInput');
  const results = () => document.getElementById('commandBarResults');
  let currentItems = [];
  let activeIndex = -1;

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
    currentItems = items || [];
    activeIndex = currentItems.length ? 0 : -1;
    if (!items.length) {
      box.hidden = true;
      return;
    }
    box.innerHTML = items
      .slice(0, 8)
      .map((c, index) => {
        const label = c.label || c.title || 'Open';
        const meta = c.keywords ? `<small>${c.keywords}</small>` : '';
        return `<button type="button" class="command-item ${index === 0 ? 'active' : ''}" data-index="${index}" data-url="${c.url || ''}"><span>${label}</span>${meta}</button>`;
      })
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

  function setActive(index) {
    const box = results();
    if (!box || box.hidden || !currentItems.length) return;
    activeIndex = (index + Math.min(currentItems.length, 8)) % Math.min(currentItems.length, 8);
    box.querySelectorAll('.command-item').forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.index) === activeIndex);
    });
  }

  function openItem(item) {
    if (!item?.url) return false;
    if (window.SAAMSSpa?.navigate) window.SAAMSSpa.navigate(item.url);
    else window.location.href = item.url;
    results()?.setAttribute('hidden', '');
    return true;
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
          const box = results();
          if (box) box.hidden = true;
          return;
        }
        render(await search(q));
      }, 200);
    });
    el.addEventListener('keydown', async (e) => {
      if (e.key === 'Escape') {
        results()?.setAttribute('hidden', '');
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive(activeIndex + 1);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive(activeIndex - 1);
        return;
      }
      if (e.key !== 'Enter') return;
      const q = el.value.trim();
      if (!q) return;
      e.preventDefault();
      if (!currentItems.length) {
        render(await search(q));
      }
      const item = currentItems[activeIndex] || currentItems[0];
      if (!openItem(item) && window.SAAMS?.role === 'mentor') {
        window.location.href = `${window.SAAMS.urls.submissions}?q=${encodeURIComponent(q)}`;
      } else if (!item && window.SAAMS?.role === 'student') {
        window.location.href = `${window.SAAMS.urls.achievements}?q=${encodeURIComponent(q)}`;
      }
    });
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        el.focus();
      }
    });
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.command-bar-wrap')) {
        results()?.setAttribute('hidden', '');
      }
    });
  });
})();
