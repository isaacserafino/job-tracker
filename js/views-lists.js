'use strict';

/* ------------------------------------------------------------------ *
 *  Prospects
 * ------------------------------------------------------------------ */
function fitMatchesFilter(p, key) {
  const fit = fitScore(p);
  if (key === 'unscored') return !fit.configured;
  if (!fit.configured) return false;
  if (key === 'blocked') return fit.blocked;
  if (key === 'strong') return !fit.blocked && fit.score >= 80;
  if (key === 'good') return !fit.blocked && fit.score >= 60;
  return true;
}

function filteredProspects() {
  const f = UI.prospect;
  let list = [...db.prospects];
  if (UI.q) {
    const q = UI.q.toLowerCase();
    list = list.filter(p => [
      prospectOrgLabel(p), p.title, p.level, p.category, p.location, p.salary, p.notes,
      sourceName(p.sourceId),
      ...db.settings.attributes.flatMap(attr => orgAttrValues(employerOrg(p), attr.id)),
    ].join(' ').toLowerCase().includes(q));
  }
  if (f.status !== 'all') list = list.filter(p => p.status === f.status);
  if (f.mode !== 'all') list = list.filter(p => p.workMode === f.mode);
  if (f.source !== 'all') list = list.filter(p => p.sourceId === f.source);
  if (f.company !== 'all') list = list.filter(p => p.companyId === f.company);
  if (f.agency !== 'all') list = list.filter(p => p.agencyId === f.agency);
  if (f.level !== 'all') list = list.filter(p => p.level === f.level);
  if (f.category !== 'all') list = list.filter(p => p.category === f.category);
  Object.entries(f.attrs || {}).forEach(([attrId, value]) => {
    if (!value || value === 'all') return;
    list = list.filter(p => {
      const actual = orgAttrValues(employerOrg(p), attrId);
      if (value === '__none__') return actual.length === 0;
      return actual.some(v => fitValueMatches('', v, value));
    });
  });
  if (f.fit !== 'all') list = list.filter(p => fitMatchesFilter(p, f.fit));

  if (f.sort === 'company') list.sort((a, b) => prospectOrgName(a).localeCompare(prospectOrgName(b)));
  else if (f.sort === 'added') list.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  else if (f.sort === 'fit') {
    list.sort((a, b) => {
      const fa = fitScore(a), fb = fitScore(b);
      const av = fa.configured ? (fa.blocked ? -1 : fa.score) : -2;
      const bv = fb.configured ? (fb.blocked ? -1 : fb.score) : -2;
      return bv - av || prospectOrgName(a).localeCompare(prospectOrgName(b));
    });
  }
  else if (f.sort === 'applied') {
    list.sort((a, b) => {
      if (!a.appliedAt && !b.appliedAt) return 0;
      if (!a.appliedAt) return 1;
      if (!b.appliedAt) return -1;
      return b.appliedAt.localeCompare(a.appliedAt);
    });
  } else if (f.sort === 'followup') {
    list.sort((a, b) => {
      if (!a.nextFollowUp && !b.nextFollowUp) return 0;
      if (!a.nextFollowUp) return 1;
      if (!b.nextFollowUp) return -1;
      return a.nextFollowUp.localeCompare(b.nextFollowUp);
    });
  } else {
    list.sort((a, b) => String(b.lastActivityAt).localeCompare(String(a.lastActivityAt)));
  }
  return list;
}

function orgOptionsHtml(kind, selected) {
  const list = db.orgs.filter(o => o.kind === kind).sort((a, b) => a.name.localeCompare(b.name));
  return `<option value="all">All ${kind === 'company' ? 'companies' : 'agencies'}</option>` +
    list.map(o => `<option value="${o.id}" ${selected === o.id ? 'selected' : ''}>${esc(o.name)}</option>`).join('');
}

function renderProspects() {
  const counts = { all: db.prospects.length };
  STATUS_KEYS.forEach(k => { counts[k] = db.prospects.filter(p => p.status === k).length; });
  const sourceOptions = db.sources
    .map(s => `<option value="${s.id}" ${UI.prospect.source === s.id ? 'selected' : ''}>${esc(s.name)}</option>`)
    .join('');
  const levels = [...new Set([...JOB_LEVELS, ...db.prospects.map(p => p.level).filter(Boolean)])];
  const categories = [...new Set([...JOB_CATEGORIES, ...db.prospects.map(p => p.category).filter(Boolean)])];
  const attrs = db.settings.attributes;

  return `<div class="toolbar">
    <input class="control search" type="search" id="prospectSearch" placeholder="Search organization, title, attribute…" value="${esc(UI.q)}">
    <select class="control" data-prospect-filter="company" aria-label="Filter by company">
      ${orgOptionsHtml('company', UI.prospect.company)}
    </select>
    <select class="control" data-prospect-filter="agency" aria-label="Filter by agency">
      ${orgOptionsHtml('agency', UI.prospect.agency)}
    </select>
    <select class="control" data-prospect-filter="level" aria-label="Filter by job level">
      <option value="all">All levels</option>
      ${levels.map(l => `<option value="${l}" ${UI.prospect.level === l ? 'selected' : ''}>${esc(l)}</option>`).join('')}
    </select>
    <select class="control" data-prospect-filter="category" aria-label="Filter by job category">
      <option value="all">All categories</option>
      ${categories.map(c => `<option value="${c}" ${UI.prospect.category === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
    </select>
    <select class="control" data-prospect-filter="mode" aria-label="Filter by work mode">
      <option value="all">All work modes</option>
      ${Object.entries(WORK_MODES).map(([k, v]) => `<option value="${k}" ${UI.prospect.mode === k ? 'selected' : ''}>${v.label}</option>`).join('')}
    </select>
    <select class="control" data-prospect-filter="source" aria-label="Filter by source">
      <option value="all">All sources</option>
      ${sourceOptions}
    </select>
    <select class="control" data-prospect-filter="fit" aria-label="Filter by fit">
      <option value="all">All fit levels</option>
      <option value="strong" ${UI.prospect.fit === 'strong' ? 'selected' : ''}>Strong fit · 80+</option>
      <option value="good" ${UI.prospect.fit === 'good' ? 'selected' : ''}>Good fit · 60+</option>
      <option value="blocked" ${UI.prospect.fit === 'blocked' ? 'selected' : ''}>Off brief</option>
      <option value="unscored" ${UI.prospect.fit === 'unscored' ? 'selected' : ''}>Not scored</option>
    </select>
    <select class="control" data-prospect-filter="sort" aria-label="Sort prospects">
      <option value="activity" ${UI.prospect.sort === 'activity' ? 'selected' : ''}>Last activity</option>
      <option value="fit" ${UI.prospect.sort === 'fit' ? 'selected' : ''}>Best fit</option>
      <option value="applied" ${UI.prospect.sort === 'applied' ? 'selected' : ''}>Date applied</option>
      <option value="followup" ${UI.prospect.sort === 'followup' ? 'selected' : ''}>Next follow-up</option>
      <option value="added" ${UI.prospect.sort === 'added' ? 'selected' : ''}>Recently added</option>
      <option value="company" ${UI.prospect.sort === 'company' ? 'selected' : ''}>Organization A–Z</option>
    </select>
  </div>

  ${attrs.length ? `<div class="toolbar advanced-filters">
    <span class="filter-label">Organization attributes</span>
    ${attrs.map(attr => `
      <select class="control" data-attr-filter="${attr.id}" aria-label="Filter by ${esc(attr.label)}">
        <option value="all">${esc(attr.label)}: any</option>
        ${attributeChoices(attr).map(v => `<option value="${esc(v)}" ${UI.prospect.attrs?.[attr.id] === v ? 'selected' : ''}>${esc(v)}</option>`).join('')}
        <option value="__none__" ${UI.prospect.attrs?.[attr.id] === '__none__' ? 'selected' : ''}>Not set</option>
      </select>`).join('')}
    <button class="chip" data-action="clear-prospect-filters">Clear filters</button>
    <button class="link-btn" data-action="nav" data-view="preferences">Edit attributes →</button>
  </div>` : `<div class="toolbar advanced-filters">
    <span class="filter-label">No organization attributes defined.</span>
    <button class="link-btn" data-action="nav" data-view="preferences">Add attributes and fit preferences →</button>
  </div>`}

  <div class="status-chips">
    <button class="chip ${UI.prospect.status === 'all' ? 'active' : ''}" data-action="prospect-status" data-status="all">All <span class="n">${counts.all}</span></button>
    ${STATUS_KEYS.map(k => `<button class="chip ${UI.prospect.status === k ? 'active' : ''}" data-action="prospect-status" data-status="${k}">${STATUS[k].label} <span class="n">${counts[k]}</span></button>`).join('')}
  </div>

  <div id="prospectResults">${prospectResultsHtml()}</div>`;
}

function prospectResultsHtml() {
  const list = filteredProspects();
  if (!list.length) {
    return `<div class="card">${emptyState(
      db.prospects.length ? 'No prospects match these filters' : 'No prospects yet',
      db.prospects.length
        ? 'Try clearing the search or filters.'
        : 'Add a prospect when you find a role worth pursuing, and link the source it came from.',
      `<div class="row-actions">${db.prospects.length ? '<button class="btn subtle" data-action="clear-prospect-filters">Clear filters</button>' : '<button class="btn primary" data-action="add-prospect">Add a prospect</button>'}</div>`
    )}</div>`;
  }

  return `<div class="result-meta">${list.length} of ${db.prospects.length} prospects</div>
  <div class="table-wrap">
    <table>
      <thead><tr>
        <th>Organization / role</th><th>Status</th><th>Fit</th><th>Work mode</th>
        <th class="col-source">Source</th><th class="col-activity">Last activity</th>
        <th>Next follow-up</th><th class="col-materials">Materials</th>
      </tr></thead>
      <tbody>
        ${list.map(p => {
          const fit = fitScore(p);
          const mats = db.materials.filter(m => p.materialIds.includes(m.id));
          const src = sourceById(p.sourceId);
          const agency = agencyOrg(p);
          return `<tr data-row-prospect="${p.id}">
            <td>
              <div class="cell-title">${esc(prospectOrgLabel(p))} ${isSnoozed(p) ? '<span class="pill stone tiny">Snoozed</span>' : ''}</div>
              <div class="cell-sub">${esc(p.title)}${p.level ? ` · ${esc(p.level)}` : ''}${p.category ? ` · ${esc(p.category)}` : ''}${p.salary ? ` · ${esc(p.salary)}` : ''}</div>
              ${agency ? `<div class="cell-sub agency-line">Via ${esc(agency.name)}</div>` : ''}
            </td>
            <td>
              <select class="status-select ${p.status}" data-status-for="${p.id}" aria-label="Status for ${esc(prospectOrgName(p))}">
                ${STATUS_KEYS.map(k => `<option value="${k}" ${p.status === k ? 'selected' : ''}>${STATUS[k].label}</option>`).join('')}
              </select>
            </td>
            <td>${fitBadgeHtml(fit)}<div class="cell-sub">${fit.configured ? esc(fitTierLabel(fit.tier)) : ''}</div></td>
            <td>
              <div>${modeChip(p.workMode)}</div>
              ${p.location ? `<div class="cell-sub">${esc(p.location)}</div>` : ''}
            </td>
            <td class="col-source">${src ? `<span class="source-name">${esc(src.name)}</span><div class="cell-sub">${esc(src.kind)}</div>` : '<span class="faint">—</span>'}</td>
            <td class="col-activity"><span title="${fmt(p.lastActivityAt, { year: true })}">${rel(p.lastActivityAt)}</span></td>
            <td>${p.nextFollowUp ? `<span class="${dueTone(p.nextFollowUp)}">${dueLabel(p.nextFollowUp)}</span>` : '<span class="faint">—</span>'}</td>
            <td class="col-materials">${mats.length ? `<span class="mat-count">${mats.map(m => typeBadge(m.type)).join('')}</span>` : '<span class="faint">—</span>'}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>`;
}

/* ------------------------------------------------------------------ *
 *  Companies & agencies
 * ------------------------------------------------------------------ */
function orgAttributeChips(org) {
  const chips = [];
  db.settings.attributes.forEach(attr => {
    orgAttrValues(org, attr.id).forEach(value => {
      chips.push(`<span class="attr-chip">${esc(attr.label)}: <b>${esc(value)}</b></span>`);
    });
  });
  return chips.length ? `<div class="attr-chips">${chips.join('')}</div>` : '<div class="cell-sub">No custom attributes set</div>';
}

function orgResultsHtml() {
  const kind = UI.org.kind;
  const q = UI.org.q.trim().toLowerCase();
  let list = [...db.orgs];
  if (kind !== 'all') list = list.filter(o => o.kind === kind);
  if (q) list = list.filter(o => [
    o.name, o.industry, o.website, o.notes,
    ...db.settings.attributes.flatMap(attr => orgAttrValues(o, attr.id)),
  ].join(' ').toLowerCase().includes(q));
  list.sort((a, b) => a.name.localeCompare(b.name));

  return list.length ? `<div class="card-grid org-grid">${list.map(o => {
    const stats = orgStats(o.id);
    return `<article class="org-card ${o.kind}">
      <div class="source-head">
        <div>
          <h3>${esc(o.name)}</h3>
          <div class="card-sub"><span class="org-kind ${o.kind}">${ORG_KINDS[o.kind].label}</span></div>
        </div>
        <span class="badge ${o.kind === 'agency' ? 'info' : 'ok'}">${stats.total} prospect${stats.total === 1 ? '' : 's'}</span>
      </div>
      <div class="source-body">
        <div class="source-check">${esc(orgAttributeSummary(o))}</div>
        ${orgAttributeChips(o)}
        ${o.notes ? `<p class="notes-preview">${esc(o.notes)}</p>` : ''}
        <div class="source-stats">
          <div><b>${stats.total}</b><span>prospects</span></div>
          <div><b>${stats.active}</b><span>active</span></div>
          <div><b>${stats.applied}</b><span>applied</span></div>
          <div><b>${stats.avgFit === null ? '—' : stats.avgFit}</b><span>avg fit</span></div>
        </div>
      </div>
      <div class="card-actions">
        ${o.website ? `<a class="btn sm" href="${esc(o.website)}" target="_blank" rel="noopener">Website</a>` : ''}
        <button class="btn sm subtle" data-action="org-prospects" data-id="${o.id}">Prospects</button>
        <button class="btn sm ghost" data-action="edit-org" data-id="${o.id}">Edit</button>
        <button class="btn sm ghost danger-text" data-action="delete-org" data-id="${o.id}">Delete</button>
      </div>
    </article>`;
  }).join('')}</div>` : `<div class="card">${emptyState(
    q || kind !== 'all' ? 'No organizations match' : 'No companies or agencies yet',
    q || kind !== 'all'
      ? 'Try a different search or filter.'
      : 'Add the companies you are targeting and any agencies or recruiters in the mix. A prospect can have either, both, or neither set.',
    `<div class="row-actions">${q || kind !== 'all'
      ? '<button class="btn subtle" data-action="clear-org-filters">Clear filters</button>'
      : '<button class="btn primary" data-action="add-org">Add an organization</button>'}</div>`
  )}</div>`;
}

function renderCompanies() {
  const kind = UI.org.kind;
  const counts = {
    all: db.orgs.length,
    company: db.orgs.filter(o => o.kind === 'company').length,
    agency: db.orgs.filter(o => o.kind === 'agency').length,
  };

  return `<div class="toolbar">
    <input class="control search" type="search" id="orgSearch" placeholder="Search organizations, industry, attributes…" value="${esc(UI.org.q)}">
    <div class="status-chips inline">
      <button class="chip ${kind === 'all' ? 'active' : ''}" data-action="org-kind" data-kind="all">All <span class="n">${counts.all}</span></button>
      <button class="chip ${kind === 'company' ? 'active' : ''}" data-action="org-kind" data-kind="company">Companies <span class="n">${counts.company}</span></button>
      <button class="chip ${kind === 'agency' ? 'active' : ''}" data-action="org-kind" data-kind="agency">Agencies <span class="n">${counts.agency}</span></button>
    </div>
  </div>
  <div id="orgResults">${orgResultsHtml()}</div>`;
}

/* ------------------------------------------------------------------ *
 *  Fit preferences + attributes
 * ------------------------------------------------------------------ */
function fitDimensionChoices(dim) {
  if (!dim) return [];
  if (dim.key === 'size') return SIZE_BANDS.map(b => ({ value: b.key, label: b.label }));
  if (dim.key === 'industry') return knownIndustries().map(v => ({ value: v, label: v }));
  if (dim.key === 'level') return [...new Set([...JOB_LEVELS, ...db.prospects.map(p => p.level).filter(Boolean)])].map(v => ({ value: v, label: v }));
  if (dim.key === 'category') return [...new Set([...JOB_CATEGORIES, ...db.prospects.map(p => p.category).filter(Boolean)])].map(v => ({ value: v, label: v }));
  if (dim.key === 'mode') return Object.entries(WORK_MODES).map(([value, meta]) => ({ value, label: meta.label }));
  if (dim.key.startsWith('attr:')) {
    const attr = attributeById(dim.key.slice(5));
    return attr ? attributeChoices(attr).map(v => ({ value: v, label: v })) : [];
  }
  return [];
}

function preferenceChips(dimKey, cfg, mode) {
  const chosen = mode === 'avoid' ? cfg.avoid || [] : cfg.values || [];
  const choices = fitDimensionChoices(fitDimensions().find(d => d.key === dimKey));
  return choices.length
    ? choices.map(choice => {
      const active = chosen.some(v => fitValueMatches(dimKey, v, choice.value));
      return `<button type="button" class="fit-choice ${mode} ${active ? 'active' : ''}"
        data-action="toggle-fit-value" data-dim="${esc(dimKey)}" data-mode="${mode}" data-value="${esc(choice.value)}"
        aria-pressed="${active}">${esc(choice.label)}</button>`;
    }).join('')
    : '<span class="muted small">No values defined yet.</span>';
}

function renderPreferences() {
  const dims = fitDimensions();
  const fit = db.settings.fit?.dimensions || {};
  const activeCount = dims.filter(d => fitDimensionActive(fit[d.key])).length;

  return `<div class="prefs-intro card">
    <div>
      <h2 class="card-title">Weighted, non-negotiable, and flexible</h2>
      <p class="card-sub">Every dimension gets a weight from 0 to 5. Preferred values earn the weight; avoided values subtract it. Strong scores can outweigh weak ones. Mark a dimension non-negotiable to make any miss block the prospect as off brief.</p>
    </div>
    <div class="row-actions">
      <button class="btn sm ghost danger-text" data-action="reset-fit">Reset preferences</button>
    </div>
  </div>

  <div class="prefs-grid">
    ${dims.map(dim => {
      const cfg = fit[dim.key] || { weight: 0, required: false, values: [], avoid: [] };
      const isAttr = dim.key.startsWith('attr:');
      const attr = isAttr ? attributeById(dim.key.slice(5)) : null;
      return `<section class="pref-card ${fitDimensionActive(cfg) ? 'active' : ''}">
        <div class="pref-head">
          <div>
            <h3>${esc(dim.label)} ${isAttr ? '<span class="org-kind company">custom</span>' : ''}</h3>
            <p class="card-sub">${esc(dim.hint)}</p>
          </div>
          <label class="required-toggle" title="Non-negotiable: a miss blocks the prospect">
            <input type="checkbox" data-fit-required data-dim="${esc(dim.key)}" ${cfg.required ? 'checked' : ''}>
            <span>Required</span>
          </label>
        </div>

        <div class="weight-line">
          <label for="weight-${esc(dim.key)}">Weight</label>
          <input id="weight-${esc(dim.key)}" type="range" min="0" max="5" step="1"
            value="${cfg.weight}" data-fit-weight data-dim="${esc(dim.key)}">
          <output class="weight-value" data-weight-for="${esc(dim.key)}">${cfg.weight}</output>
        </div>

        <div class="pref-group">
          <div class="pref-label">Prefer</div>
          <div class="fit-choices">${preferenceChips(dim.key, cfg, 'prefer')}</div>
        </div>

        <div class="pref-group">
          <div class="pref-label avoid">Avoid <span class="muted">(penalized)</span></div>
          <div class="fit-choices">${preferenceChips(dim.key, cfg, 'avoid')}</div>
        </div>

        ${isAttr && attr ? `<div class="pref-actions">
          <button class="btn sm ghost" data-action="edit-attribute" data-id="${attr.id}">Edit attribute</button>
          <button class="btn sm ghost danger-text" data-action="delete-attribute" data-id="${attr.id}">Delete attribute</button>
        </div>` : ''}
      </section>`;
    }).join('')}
  </div>

  <section class="card attr-manager">
    <div class="card-head">
      <div>
        <h2 class="card-title">Organization attributes</h2>
        <p class="card-sub">Define your own details — tech stack, modernity, openness, culture, anything. Each becomes a fit dimension automatically.</p>
      </div>
      <button class="btn sm subtle" data-action="add-attribute">+ Attribute</button>
    </div>
    ${db.settings.attributes.length ? `<div class="list">${db.settings.attributes.map(attr => `
      <div class="mini-row">
        <div class="mini-main">
          <div class="mini-title">${esc(attr.label)} <span class="badge neutral">${attr.multi ? 'Multi-select' : 'Single-select'}</span></div>
          <div class="mini-sub">${attr.options.length ? attr.options.map(esc).join(' · ') : 'No preset options — values come from organizations'}</div>
        </div>
        <div class="mini-actions">
          <button class="btn sm ghost" data-action="edit-attribute" data-id="${attr.id}">Edit</button>
          <button class="btn sm ghost danger-text" data-action="delete-attribute" data-id="${attr.id}">Delete</button>
        </div>
      </div>`).join('')}</div>` : emptyState(
    'No custom attributes yet',
    'Add a detail like tech modernity or openness, then set preferred and avoided values in the fit dimensions above.',
    '<button class="btn primary" data-action="add-attribute">Add your first attribute</button>'
  )}
  </section>

  <p class="result-meta">${activeCount} of ${dims.length} dimensions contribute to the score. Dimensions with weight 0 are ignored unless marked required.</p>`;
}

/* ------------------------------------------------------------------ *
 *  Sources
 * ------------------------------------------------------------------ */
function renderSources() {
  const list = [...db.sources].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    const ad = sourceCheck(a), bd = sourceCheck(b);
    const av = ad.never ? 9999 : (ad.overdueDays || 0);
    const bv = bd.never ? 9999 : (bd.overdueDays || 0);
    if (av !== bv) return bv - av;
    return a.name.localeCompare(b.name);
  });

  if (!list.length) {
    return `<div class="card">${emptyState(
      'No sources yet',
      'Sources are where prospects come from: job boards, company career pages, recruiters, referrals, or communities.',
      '<button class="btn primary" data-action="add-source">Add a source</button>'
    )}</div>`;
  }

  return `<div class="card-grid">
    ${list.map(s => {
      const check = sourceCheck(s);
      const stats = sourceStats(s);
      const badge = !s.active ? '<span class="badge neutral">Paused</span>'
        : check.never ? '<span class="badge warn">Never checked</span>'
        : check.overdueDays > 0 ? `<span class="badge warn">${check.overdueDays}d overdue</span>`
        : '<span class="badge ok">Up to date</span>';
      return `<article class="source-card ${s.active ? '' : 'inactive'}">
        <div class="source-head">
          <div>
            <h3>${esc(s.name)}</h3>
            <div class="card-sub">${esc(s.kind)}</div>
          </div>
          ${badge}
        </div>
        <div class="source-body">
          <div class="source-check">
            ${check.never ? 'Never checked' : `Last checked ${rel(s.lastChecked)}`} · check every ${check.cadence}d
          </div>
          <div class="source-stats">
            <div><b>${stats.total}</b><span>prospects</span></div>
            <div><b>${stats.active}</b><span>active</span></div>
            <div><b>${stats.applied}</b><span>applied</span></div>
            <div><b>${stats.interviews}</b><span>interviews+</span></div>
          </div>
          ${s.notes ? `<p class="notes-preview">${esc(s.notes)}</p>` : ''}
        </div>
        <div class="card-actions">
          ${s.url ? `<a class="btn sm" href="${esc(s.url)}" target="_blank" rel="noopener">Visit</a>` : ''}
          <button class="btn sm subtle" data-action="mark-source-checked" data-id="${s.id}">Mark checked</button>
          <button class="btn sm ghost" data-action="edit-source" data-id="${s.id}">Edit</button>
          <button class="btn sm ghost danger-text" data-action="delete-source" data-id="${s.id}">Delete</button>
        </div>
      </article>`;
    }).join('')}
  </div>`;
}

/* ------------------------------------------------------------------ *
 *  Materials
 * ------------------------------------------------------------------ */
function renderMaterials() {
  const issues = materialIssues();
  const issueIds = new Set(issues.map(i => i.material.id));
  let list = [...db.materials];
  if (UI.material.type !== 'all') list = list.filter(m => m.type === UI.material.type);
  if (UI.material.stale) list = list.filter(m => issueIds.has(m.id));
  list.sort((a, b) => {
    const ai = issueIds.has(a.id) ? 1 : 0, bi = issueIds.has(b.id) ? 1 : 0;
    if (ai !== bi) return bi - ai;
    return String(b.lastUpdated).localeCompare(String(a.lastUpdated));
  });

  const chips = [
    { key: 'all', label: 'All', count: db.materials.length },
    { key: 'resume', label: 'Resumes', count: db.materials.filter(m => m.type === 'resume').length },
    { key: 'cover', label: 'Cover letters', count: db.materials.filter(m => m.type === 'cover').length },
    { key: 'notes', label: 'Notes', count: db.materials.filter(m => m.type === 'notes').length },
  ];

  return `<div class="toolbar">
    <div class="status-chips inline">
      ${chips.map(c => `<button class="chip ${UI.material.type === c.key ? 'active' : ''}" data-action="material-type" data-type="${c.key}">${c.label} <span class="n">${c.count}</span></button>`).join('')}
      <button class="chip ${UI.material.stale ? 'active' : ''}" data-action="toggle-stale">Needs refresh <span class="n">${issues.length}</span></button>
    </div>
  </div>

  ${list.length ? `<div class="card-grid materials-grid">${list.map(m => {
    const issue = issues.find(i => i.material.id === m.id);
    const explicitUsers = db.prospects.filter(p => p.materialIds.includes(m.id));
    const titleUsers = m.target === 'title' ? prospectsUsingMaterial(m) : [];
    const activeExplicit = explicitUsers.filter(isActiveProspect);
    const activeTitle = titleUsers.filter(isActiveProspect);
    return `<article class="material-card ${issue ? 'has-issue' : ''}">
      <div class="material-top">
        ${typeBadge(m.type)}
        <span class="scope-pill ${m.target}">${esc(scopeLabel(m))}</span>
      </div>
      <h3>${esc(m.name)}</h3>
      <div class="material-meta">Updated ${rel(m.lastUpdated)} <span class="muted">· ${fmt(m.lastUpdated, { year: true })}</span></div>
      ${issue ? `<div class="issue-line">${issue.reasons.map(r => esc(r.text)).join(' · ')}</div>` : '<div class="issue-line clean">Up to date</div>'}
      <div class="material-usage">
        ${m.target === 'general'
          ? `<span class="muted">General library · usable for any role</span>`
          : m.target === 'title'
            ? activeTitle.length
              ? `<span class="muted">Title-matched to ${activeTitle.length} active · ${esc(nameList(activeTitle))}</span>`
              : `<span class="muted">No active prospects match this title</span>`
            : activeExplicit.length
              ? `<span class="muted">Linked to ${activeExplicit.length} prospect${activeExplicit.length === 1 ? '' : 's'} · ${esc(nameList(activeExplicit))}</span>`
              : `<span class="muted">Not linked to an active prospect</span>`}
      </div>
      ${m.notes ? `<p class="notes-preview">${esc(m.notes)}</p>` : ''}
      <div class="card-actions">
        ${m.link ? `<a class="btn sm" href="${esc(m.link)}" target="_blank" rel="noopener">Open</a>` : ''}
        <button class="btn sm subtle" data-action="mark-material-updated" data-id="${m.id}">Mark refreshed</button>
        <button class="btn sm ghost" data-action="duplicate-material" data-id="${m.id}">Duplicate</button>
        <button class="btn sm ghost" data-action="edit-material" data-id="${m.id}">Edit</button>
        <button class="btn sm ghost danger-text" data-action="delete-material" data-id="${m.id}">Delete</button>
      </div>
    </article>`;
  }).join('')}</div>` : `<div class="card">${emptyState(
    'No materials match',
    'Add a resume, cover letter, or notes file. Start general, then tailor copies to a title or a single prospect.',
    '<button class="btn primary" data-action="add-material">Add material</button>'
  )}</div>`}`;
}

/* ------------------------------------------------------------------ *
 *  Activity
 * ------------------------------------------------------------------ */
function renderActivity() {
  let list = [...db.activities];
  if (UI.activity.prospect !== 'all') list = list.filter(a => a.prospectId === UI.activity.prospect);
  if (UI.activity.type !== 'all') list = list.filter(a => a.type === UI.activity.type);
  list.sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt)));

  const prospectOptions = [...db.prospects]
    .sort((a, b) => prospectOrgName(a).localeCompare(prospectOrgName(b)))
    .map(p => `<option value="${p.id}" ${UI.activity.prospect === p.id ? 'selected' : ''}>${esc(prospectOrgName(p))} — ${esc(p.title)}</option>`)
    .join('');

  const groups = new Map();
  list.forEach(a => {
    if (!groups.has(a.date)) groups.set(a.date, []);
    groups.get(a.date).push(a);
  });

  return `<div class="toolbar">
    <select class="control" data-activity-filter="prospect" aria-label="Filter activity by prospect">
      <option value="all">All prospects</option>
      ${prospectOptions}
    </select>
    <select class="control" data-activity-filter="type" aria-label="Filter activity by type">
      <option value="all">All activity types</option>
      ${Object.entries(ACTIVITY_TYPES).map(([k, label]) => `<option value="${k}" ${UI.activity.type === k ? 'selected' : ''}>${label}</option>`).join('')}
    </select>
    <span class="muted small">${list.length} entr${list.length === 1 ? 'y' : 'ies'}</span>
  </div>

  ${list.length ? `<div class="activity-feed">
    ${[...groups.entries()].map(([date, entries]) => `
      <section class="day-group">
        <h3 class="day-head">${esc(fmtFull(date))} <span class="muted">· ${rel(date)}</span></h3>
        <div class="card feed-card">
          ${entries.map(a => {
            const p = prospectById(a.prospectId);
            return `<div class="feed-row">
              <div class="feed-main" ${p ? `data-action="open-prospect" data-id="${p.id}"` : ''}>
                <div class="feed-title">${actBadge(a.type)}
                  <span>${p ? `${esc(prospectOrgName(p))} <span class="muted">· ${esc(p.title)}</span>` : 'Removed prospect'}</span>
                </div>
                ${a.note ? `<p class="feed-note">${esc(a.note)}</p>` : ''}
              </div>
              <button class="icon-btn sm" data-action="delete-activity" data-id="${a.id}" title="Delete entry">✕</button>
            </div>`;
          }).join('')}
        </div>
      </section>`).join('')}
  </div>` : `<div class="card">${emptyState(
    'No activity logged',
    'Log applications, follow-ups, interviews, offers, and notes. Each entry updates the prospect’s last-activity date.',
    '<button class="btn primary" data-action="add-activity">Log activity</button>'
  )}</div>`}`;
}
