document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.getElementById('sidebar');
  document.getElementById('sidebarToggle')?.addEventListener('click', () => {
    sidebar?.classList.toggle('open');
  });

  initThemeSwitcher();

  loadNotifications();

  const search = document.getElementById('commandBarInput') || document.getElementById('globalSearch');
  search?.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter') return;
    const q = search.value.trim();
    if (!q) return;
    const res = await fetch(`/api/search/achievements?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    if (data.length && window.SAAMS.role === 'student') {
      window.location.href = window.SAAMS.urls.achievements + `?q=${encodeURIComponent(q)}`;
    }
  });

});

function initThemeSwitcher() {
  if (document.body.classList.contains('landing-page') || !window.SAAMS?.isAuthenticated) {
    return;
  }

  const themes = ['light', 'bw', 'red-cream-black'];
  const labels = {
    light: 'Current Theme',
    bw: 'B/W Theme',
    'red-cream-black': 'Red Cream Black',
  };
  const html = document.documentElement;
  const saved = localStorage.getItem('saams-theme');
  const initialTheme = themes.includes(saved) ? saved : html.dataset.theme || 'light';

  const applyTheme = (theme) => {
    html.dataset.theme = theme;
    localStorage.setItem('saams-theme', theme);
    document.querySelectorAll('#themeSwitcher, #globalThemeSwitcher, .theme-switcher').forEach((btn) => {
      const label = labels[theme] || labels.light;
      btn.title = `Switch Theme: ${label}`;
      const text = btn.querySelector('span');
      if (text) {
        text.textContent = label;
      } else {
        const icon = btn.querySelector('i');
        btn.textContent = ` ${label}`;
        if (icon) {
          btn.prepend(icon);
        }
      }
    });
  };

  applyTheme(initialTheme);

  document.addEventListener('click', (event) => {
    const btn = event.target.closest('#themeSwitcher, #globalThemeSwitcher, .theme-switcher');
    if (!btn) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const current = themes.includes(html.dataset.theme) ? html.dataset.theme : 'light';
    const next = themes[(themes.indexOf(current) + 1) % themes.length];
    applyTheme(next);
  }, true);
}

async function loadNotifications() {
  const dropdown = document.getElementById('notificationDropdown');
  if (!dropdown || !window.SAAMS?.isAuthenticated) return;
  try {
    const res = await fetch(window.SAAMS.urls.notifications);
    const items = await res.json();
    dropdown.innerHTML = '<li><h6 class="dropdown-header">Notifications</h6></li>';
    if (!items.length) {
      dropdown.innerHTML += '<li><span class="dropdown-item-text text-muted">No notifications</span></li>';
      return;
    }
    items.forEach((n) => {
      dropdown.innerHTML += `<li><a class="dropdown-item ${n.is_read ? '' : 'fw-bold'}" data-notification-id="${n.id}" href="${n.url || '#'}">${n.title}: ${n.message?.slice(0, 60)}</a></li>`;
    });
    dropdown.querySelectorAll('[data-notification-id]').forEach((item) => {
      item.addEventListener('click', async () => {
        const id = item.dataset.notificationId;
        if (!id || item.classList.contains('notification-read-pending')) return;
        item.classList.add('notification-read-pending');
        try {
          await fetch(`/api/notifications/${id}/read`, {
            method: 'POST',
            headers: { 'X-CSRFToken': window.SAAMS?.csrfToken || '' },
          });
          item.classList.remove('fw-bold');
          const badge = document.querySelector('.topbar .badge-notify');
          if (badge) {
            const next = Math.max(0, Number.parseInt(badge.textContent, 10) - 1);
            if (next) {
              badge.textContent = String(next);
            } else {
              badge.remove();
            }
          }
        } catch (_) {}
      });
    });
  } catch (_) {}
}

const CHART_COLORS = ['#7C3AED', '#A855F7', '#C084FC', '#DDD6FE', '#EDE9FE', '#F3E8FF', '#E9D5FF'];

function initStudentCharts() {
  const catEl = document.getElementById('categoryChart');
  if (!catEl || !window.SAAMS?.isAuthenticated) return;
  fetch('/api/analytics/student')
    .then((r) => r.json())
    .then((data) => {
      if (catEl) {
        new Chart(catEl, {
          type: 'doughnut',
          data: {
            labels: Object.keys(data.category || {}),
            datasets: [{ data: Object.values(data.category || {}), backgroundColor: CHART_COLORS }],
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } },
        });
      }
      const statusEl = document.getElementById('statusChart');
      if (statusEl) {
        new Chart(statusEl, {
          type: 'pie',
          data: {
            labels: Object.keys(data.status || {}),
            datasets: [{ data: Object.values(data.status || {}), backgroundColor: CHART_COLORS }],
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } },
        });
      }
      const levelEl = document.getElementById('levelChart');
      if (levelEl) {
        new Chart(levelEl, {
          type: 'bar',
          data: {
            labels: Object.keys(data.level || {}),
            datasets: [{ data: Object.values(data.level || {}), backgroundColor: '#7C3AED' }],
          },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
        });
      }
      const monthlyEl = document.getElementById('monthlyChart');
      if (monthlyEl) {
        new Chart(monthlyEl, {
          type: 'line',
          data: {
            labels: Object.keys(data.monthly || {}),
            datasets: [{
              label: 'Activities per month',
              data: Object.values(data.monthly || {}),
              borderColor: '#7C3AED',
              tension: 0.4,
              fill: true,
              backgroundColor: 'rgba(124,58,237,0.1)',
            }],
          },
          options: { responsive: true, maintainAspectRatio: false },
        });
      }
    });
}

function initMentorCharts() {
  const el = document.getElementById('mentorCategoryChart');
  if (!el) return;
  fetch('/api/analytics/mentor')
    .then((r) => r.json())
    .then((data) => {
      new Chart(el, {
        type: 'bar',
        data: {
          labels: Object.keys(data.category || {}),
          datasets: [{ label: 'Submissions', data: Object.values(data.category || {}), backgroundColor: '#7C3AED' }],
        },
        options: { responsive: true, maintainAspectRatio: false },
      });
      const deptEl = document.getElementById('mentorDeptChart');
      if (deptEl) {
        new Chart(deptEl, {
          type: 'pie',
          data: {
            labels: Object.keys(data.department || {}),
            datasets: [{ data: Object.values(data.department || {}), backgroundColor: ['#7C3AED', '#A855F7', '#C084FC', '#E9D5FF'] }],
          },
          options: { responsive: true, maintainAspectRatio: false },
        });
      }
    });
}

window.initStudentCharts = initStudentCharts;
window.initMentorCharts = initMentorCharts;
