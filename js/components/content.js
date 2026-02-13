/* ============================================================
   CONTENT — Renders page content items into HTML
   Handles: paragraphs, headings, blockquotes, tables,
            bullets, tree-meta, tree-tier (augment trees)
   ============================================================ */

function renderContent(items) {
  let html = '';
  let bulletBuffer = [];
  let paraRun = 0;

  function flushBullets() {
    if (bulletBuffer.length) {
      html += '<ul class="c-bullets">'
        + bulletBuffer.map(b => '<li class="c-bullet">' + b + '</li>').join('')
        + '</ul>';
      bulletBuffer = [];
    }
  }

  items.forEach((item, idx) => {
    if (item.type === 'bullet') {
      flushBullets();
      bulletBuffer.push(item.text);
      paraRun = 0;
      return;
    }
    if (bulletBuffer.length) flushBullets();

    switch (item.type) {
      case 'paragraph': {
        const text = item.text;
        const stripped = text.replace(/<[^>]*>/g, '');
        const isBoldLead = text.startsWith('<strong>');
        const isShort = stripped.length < 80;
        paraRun++;
        if (isBoldLead) {
          html += '<div class="c-keypoint"><p class="c-keypoint-text">' + text + '</p></div>';
        } else if (isShort && paraRun <= 2) {
          html += '<p class="c-emphasis">' + text + '</p>';
        } else {
          if (paraRun > 1 && paraRun % 5 === 1) html += '<div class="c-break"></div>';
          html += '<p class="c-para">' + text + '</p>';
        }
        break;
      }
      case 'heading':
        paraRun = 0;
        html += '<h3 class="c-heading">' + item.text + '</h3>';
        break;
      case 'blockquote':
        paraRun = 0;
        html += '<div class="c-blockquote"><div class="c-bq-badge">CORP NOTICE</div>' + item.text + '</div>';
        break;
      case 'flavor':
        paraRun = 0;
        html += '<p class="c-flavor">' + item.text + '</p>';
        break;
      case 'numbered':
        paraRun = 0;
        html += '<div class="c-numbered"><span class="c-num-mark">' + item.num + '.</span>' + item.text + '</div>';
        break;
      case 'table':
        paraRun = 0;
        html += renderTable(item);
        break;

      // ---- AUGMENT TREE TYPES ----
      case 'tree-meta':
        paraRun = 0;
        html += '<div class="tree-meta">'
          + '<div class="tree-meta-row"><span class="tree-meta-label">Stat Lean</span><span class="tree-meta-val">' + esc(item.stat_lean) + '</span></div>'
          + '<div class="tree-meta-row"><span class="tree-meta-label">Theme</span><span class="tree-meta-val">' + esc(item.theme) + '</span></div>'
          + '<div class="tree-meta-row"><span class="tree-meta-label">Design</span><span class="tree-meta-val"><em>' + esc(item.design) + '</em></span></div>'
          + '</div>';
        break;

      case 'tree-tier':
        paraRun = 0;
        html += renderTreeTier(item);
        break;

      // ---- STRUCTURED DATA TYPES ----
      case 'corp-profile':
        paraRun = 0;
        html += renderCorpProfile(item);
        break;

      case 'kit-grid':
        paraRun = 0;
        html += renderKitGrid(item);
        break;

      default:
        paraRun = 0;
    }
  });
  flushBullets();
  return html;
}

function renderTable(item) {
  let html = '<div class="tbl-wrap"><table class="tbl">';
  if (item.headers && item.headers.length) {
    html += '<thead><tr>' + item.headers.map(h => '<th>' + h + '</th>').join('') + '</tr></thead>';
  }
  html += '<tbody>';
  if (item.rows) {
    html += item.rows.map(row =>
      '<tr>' + row.map(cell => '<td>' + cell + '</td>').join('') + '</tr>'
    ).join('');
  }
  html += '</tbody></table></div>';
  return html;
}

function renderTreeTier(tier) {
  const tierColors = {1: 'var(--tier1)', 2: 'var(--tier2)', 3: 'var(--tier3)', 4: 'var(--tier4)', 5: 'var(--tier5)'};
  const color = tierColors[tier.tier] || 'var(--accent)';

  let html = '<div class="tree-tier" style="--tier-color:' + color + '">'
    + '<div class="tree-tier-hdr">'
    + '<div class="tree-tier-badge">T' + tier.tier + '</div>'
    + '<div class="tree-tier-info">'
    + '<div class="tree-tier-title">' + esc(tier.title) + '</div>'
    + '<div class="tree-tier-req">' + esc(tier.req) + '</div>'
    + '</div></div>';

  if (tier.augments && tier.augments.length) {
    html += '<div class="tree-augments">';
    tier.augments.forEach(aug => {
      const isTradeoff = aug.effect.toLowerCase().includes('trade-off');
      html += '<div class="tree-aug' + (isTradeoff ? ' tradeoff' : '') + '">'
        + '<div class="tree-aug-hdr">'
        + '<span class="tree-aug-name">' + esc(aug.name) + '</span>'
        + '<span class="tree-aug-cost">' + esc(aug.cost) + '</span>'
        + '</div>'
        + '<div class="tree-aug-effect">' + esc(aug.effect) + '</div>'
        + '</div>';
    });
    html += '</div>';
  }

  if (tier.budget) {
    html += '<div class="tree-tier-budget">' + esc(tier.budget) + '</div>';
  }

  html += '</div>';
  return html;
}

/* --- Corporation profile card --- */
function renderCorpProfile(corp) {
  let html = '<div class="corp-profile">'
    + '<div class="corp-header">'
    + '<span class="corp-icon">' + corp.icon + '</span>'
    + '<div class="corp-header-info">'
    + '<div class="corp-name">' + esc(corp.name) + '</div>'
    + '<div class="corp-doctrine">' + esc(corp.doctrine) + '</div>'
    + '</div></div>'
    + '<div class="corp-grid">'
    + '<div class="corp-stat"><span class="corp-stat-label">Culture</span><span class="corp-stat-val">' + esc(corp.culture) + '</span></div>'
    + '<div class="corp-stat"><span class="corp-stat-label">Want</span><span class="corp-stat-val">' + esc(corp.want) + '</span></div>'
    + '<div class="corp-stat"><span class="corp-stat-label">Pay</span><span class="corp-stat-val">' + esc(corp.pay) + '</span></div>'
    + '<div class="corp-stat full"><span class="corp-stat-label">Vibe</span><span class="corp-stat-val">' + esc(corp.vibe) + '</span></div>'
    + '</div>';

  if (corp.contracts && corp.contracts.length) {
    html += '<div class="corp-contracts"><div class="corp-contracts-title">Contract Types</div>'
      + '<div class="corp-contracts-grid">';
    corp.contracts.forEach(c => {
      html += '<div class="corp-contract">'
        + '<div class="corp-contract-name">' + esc(c.name) + '</div>'
        + '<div class="corp-contract-desc">' + esc(c.desc) + '</div>'
        + '</div>';
    });
    html += '</div></div>';
  }
  html += '</div>';
  return html;
}

/* --- Kit selection grid --- */
function renderKitGrid(data) {
  let html = '<div class="kit-grid">';
  data.kits.forEach(kit => {
    html += '<div class="kit-card">'
      + '<div class="kit-card-hdr">'
      + '<span class="kit-card-icon">' + kit.icon + '</span>'
      + '<div><div class="kit-card-name">' + esc(kit.name) + '</div>'
      + '<div class="kit-card-lean">' + esc(kit.lean) + '</div></div>'
      + '</div>'
      + '<div class="kit-card-desc">' + esc(kit.desc) + '</div>'
      + '<div class="kit-card-details">'
      + '<div class="kit-detail"><span class="kit-detail-l">Tree</span><span class="kit-detail-v">' + esc(kit.tree) + '</span></div>'
      + '<div class="kit-detail"><span class="kit-detail-l">Augment</span><span class="kit-detail-v">' + esc(kit.aug) + '</span></div>'
      + '<div class="kit-detail"><span class="kit-detail-l">Ability</span><span class="kit-detail-v">' + esc(kit.ability) + '</span></div>'
      + '<div class="kit-detail full"><span class="kit-detail-l">Gear</span><span class="kit-detail-v">' + esc(kit.gear) + '</span></div>'
      + '</div></div>';
  });
  html += '</div>';
  return html;
}
