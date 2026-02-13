/* ============================================================
   PROGRESS — Reading progress bar
   ============================================================ */

function updateProgress() {
  const fill = document.getElementById('progressFill');
  if (!fill) return;
  const h = document.documentElement.scrollHeight - window.innerHeight;
  fill.style.width = h > 0 ? ((window.scrollY / h) * 100) + '%' : '0%';
}
