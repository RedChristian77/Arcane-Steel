/* ============================================================
   HOME — Landing page with section grid
   ============================================================ */

function renderHome(manifest) {
  let html = '<div class="hero">'
    + '<h1 class="hero-title">ARCANE STEEL</h1>'
    + '<hr class="hero-rule">'
    + '<div class="hero-sub">Contractor\'s Handbook</div>'
    + '<div class="hero-ver">v0.3 · Playtest Draft</div>'
    + '<div class="hero-tag">'
    + 'A Tabletop RPG of Corporate Dystopia, Dimensional Rifts,<br>'
    + 'and the Grind That Never Stops.<br>'
    + '<em>Sign your waiver.</em>'
    + '</div></div>';

  html += '<div class="home-sections">';
  manifest.sections.forEach(section => {
    html += '<div class="home-sec">'
      + '<div class="home-sec-hdr">'
      + '<span class="home-sec-ico">' + section.icon + '</span>'
      + '<span class="home-sec-title">' + esc(section.title) + '</span>'
      + '</div>'
      + '<div class="home-sec-pages">';
    section.pages.forEach(page => {
      html += '<a class="home-page-link" onclick="navigateTo(\'' + page.id + '\')">'
        + esc(page.title) + '</a>';
    });
    html += '</div></div>';
  });

  // Builder card
  html += '<div class="home-sec home-sec-builder">'
    + '<div class="home-sec-hdr">'
    + '<span class="home-sec-ico">⚙</span>'
    + '<span class="home-sec-title">Character Builder</span>'
    + '</div>'
    + '<div class="home-sec-pages">'
    + '<a class="home-page-link" href="builder.html">Launch Builder →</a>'
    + '</div></div>';

  html += '</div>';
  return html;
}
