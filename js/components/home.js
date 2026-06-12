/* ============================================================
   HOME — Cover sheet + book index
   The packet the corp hands you on day one.
   ============================================================ */

function renderHome(manifest) {
  let html = '<div class="cover">'
    + '<div class="cover-seal">WELLSPRING-ALIGNED CONTRACTOR SERVICES · FORM AS-000</div>'
    + '<h1 class="cover-title">Arcane Steel</h1>'
    + '<hr class="cover-rule">'
    + '<div class="cover-sys">Contractor Document System</div>'
    + '<div class="cover-issue">Issue 2026.06 · Ground-Up Rebuild · Supersedes All Prior Printings</div>'
    + '<div class="cover-notice">'
    + 'Welcome to the contractor program. This document system contains everything '
    + 'you are authorized to know. Read it in order. Sign nothing you haven’t read, '
    + 'and read nothing you weren’t issued. We are so glad you’re here.'
    + '<span class="cover-notice-sig">— Contractor Relations, Onboarding Division</span>'
    + '</div>'
    + '</div>';

  // --- Book index: sections grouped by book ---
  const bookOrder = ['player', 'gm', 'annex', 'world', 'meta'];
  const grouped = {};
  manifest.sections.forEach(section => {
    const book = section.book || 'meta';
    (grouped[book] = grouped[book] || []).push(section);
  });

  html += '<div class="books">';
  bookOrder.forEach(bookKey => {
    const sections = grouped[bookKey];
    if (!sections || !sections.length) return;
    const bk = window._books[bookKey] || window._books.meta;
    const pageCount = sections.reduce((n, s) => n + s.pages.length, 0);

    html += '<div class="book" data-book="' + esc(bookKey) + '">'
      + '<div class="book-hdr">'
      + '<span class="book-no">' + esc(bk.no) + '</span>'
      + '<span class="book-title">' + esc(bk.label) + '</span>'
      + '</div>'
      + '<div class="book-toc">';

    sections.forEach(section => {
      const firstPage = section.pages[0];
      html += '<div class="book-sec" onclick="navigateTo(\'' + firstPage.id + '\')">'
        + '<span class="book-sec-ico">' + section.icon + '</span>'
        + '<span>' + esc(section.title) + '</span>'
        + '<span class="book-sec-count">' + section.pages.length + '</span>'
        + '</div>';
    });

    html += '</div>'
      + '<div class="book-foot">' + esc(bk.cls) + ' · ' + pageCount + ' DOCUMENTS</div>'
      + '</div>';
  });
  html += '</div>';

  return html;
}
