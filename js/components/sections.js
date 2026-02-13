/* ============================================================
   SECTIONS — Collapse / expand section toggle logic
   ============================================================ */

let allCollapsed = false;

function toggleAllSections() {
  allCollapsed = !allCollapsed;
  document.querySelectorAll('.section').forEach(s => {
    if (s.querySelector('.sec-hdr')) {
      if (allCollapsed) s.classList.add('collapsed');
      else s.classList.remove('collapsed');
    }
  });
  const btn = document.getElementById('expandBtn');
  if (btn) btn.textContent = allCollapsed ? '▶ Expand' : '▼ Collapse';
}

function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('collapsed');
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    // Flash highlight
    el.style.transition = 'box-shadow 0.3s';
    el.style.boxShadow = '0 0 0 2px var(--accent)';
    setTimeout(() => { el.style.boxShadow = 'none'; }, 1200);
  }
  closeSidebar();
}
