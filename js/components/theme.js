/* ============================================================
   THEME — Dark / Light mode toggle
   ============================================================ */

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  const next = cur === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('arcane-theme', next);
  updateThemeBtn();
}

function updateThemeBtn() {
  const t = document.documentElement.getAttribute('data-theme');
  const btn = document.getElementById('themeBtn');
  if (btn) btn.textContent = t === 'dark' ? '☀ Light' : '☾ Dark';
}

function restoreTheme() {
  const saved = localStorage.getItem('arcane-theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
  updateThemeBtn();
}
