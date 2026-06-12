/* ============================================================
   PAGE — Renders a single content page from JSON
   ============================================================ */

function renderPage(pageData, manifest) {
  let html = '<div class="container">';

  // --- Document banner (corp chrome) ---
  const meta = window._docIndex[pageData.id];
  if (meta) {
    const book = window._books[meta.book] || window._books.meta;
    html += '<div class="doc-banner">'
      + '<span class="doc-banner-no">' + esc(meta.docNo) + '</span>'
      + '<span class="doc-banner-book">' + esc(book.no + ' — ' + book.label) + '</span>'
      + '<span class="doc-banner-class">' + esc(book.cls) + '</span>'
      + '</div>';
  }

  // --- Header ---
  html += '<div class="pg-hdr">';
  if (pageData.subtitle) {
    html += '<div class="pg-sub">' + esc(pageData.subtitle) + '</div>';
  }
  html += '<h1 class="pg-title">' + esc(pageData.title) + '</h1>';
  html += '<div class="pg-rev">REV 2026.06 · GROUND-UP REBUILD · THIS PRINTING SUPERSEDES ALL PRIOR ISSUES</div>';
  html += '</div>';

  // --- Content ---
  html += '<div class="pg-body">' + renderContent(pageData.content) + '</div>';

  // --- Prev / Next ---
  const allPages = [];
  manifest.sections.forEach(s => s.pages.forEach(p => {
    allPages.push(p);
    if (p.children) p.children.forEach(c => allPages.push(c));
  }));
  const idx = allPages.findIndex(p => p.id === pageData.id);

  html += '<div class="pg-nav">';
  if (idx > 0) {
    const prev = allPages[idx - 1];
    html += '<a class="pg-nav-link" onclick="navigateTo(\'' + prev.id + '\')">'
      + '<span class="pg-nav-lbl">← Previous</span>'
      + '<span class="pg-nav-t">' + esc(prev.title) + '</span></a>';
  }
  if (idx < allPages.length - 1) {
    const next = allPages[idx + 1];
    html += '<a class="pg-nav-link next" onclick="navigateTo(\'' + next.id + '\')">'
      + '<span class="pg-nav-lbl">Next →</span>'
      + '<span class="pg-nav-t">' + esc(next.title) + '</span></a>';
  }
  html += '</div></div>';

  return html;
}
