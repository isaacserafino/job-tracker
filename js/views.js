'use strict';

/* ------------------------------------------------------------------ *
 *  UI state + shared render helpers
 * ------------------------------------------------------------------ */
const UI = {
  view: 'dashboard',
  drawer: null,
  q: '',
  prospect: {
    status: 'all', mode: 'all', source: 'all',
    company: 'all', agency: 'all', level: 'all', category: 'all',
    size: 'all', industry: 'all', fit: 'all', attrs: {}, sort: 'activity',
  },
  material: { type: 'all', stale: false },
  activity: { prospect: 'all', type: 'all' },
  org: { kind: 'all', q: '' },
};

function pill(status) {
  const s = STATUS[status] || STATUS.prospect;
  return `<span class="pill ${status}"><span class="dot"></span>${s.label}</span>`;
}
function modeChip(mode) {
  const key = WORK_MODES[mode] ? mode : 'unspecified';
  return `<span class="mode ${key}"><span class="dot"></span>${WORK_MODES[key].label}</span>`;
}
function typeBadge(type) {
  const t = MATERIAL_TYPES[type] || MATERIAL_TYPES.notes;
  return `<span class="mat-type ${type}">${t.short}</span>`;
}
function actBadge(type) {
  return `<span class="type-badge ${type}">${ACTIVITY_TYPES[type] || type}</span>`;
}
function emptyState(title, body, actionHtml = '') {
  return `<div class="empty-state">
    <div class="empty-mark">◇</div>
    <h3>${esc(title)}</h3>
    <p>${body}</p>
    ${actionHtml}
  </div>`;
}
function scopeLabel(m) {
  if (m.target === 'prospect') {
    const p = prospectById(m.targetProspectId);
    return p ? `For ${prospectOrgName(p)}` : 'For one prospect';
  }
  if (m.target === 'title') return m.targetTitle ? `Title · ${m.targetTitle}` : 'For a title';
  return 'General';
}
function nameList(list, limit = 3) {
  if (!list.length) return '';
  const names = list.slice(0, limit).map(prospectOrgName).join(', ');
  return list.length > limit ? `${names} +${list.length - limit}` : names;
}

/* ------------------------------------------------------------------ *
 *  Shell
 * ------------------------------------------------------------------ */
const VIEW_META = {
  dashboard: { title: 'Dashboard', add: 'add-prospect', addLabel: '+ Prospect' },
  prospects: { title: 'Prospects', add: 'add-prospect', addLabel: '+ Prospect' },
  companies: { title: 'Companies & agencies', add: 'add-org', addLabel: '+ Organization' },
  preferences: { title: 'Fit preferences', add: 'add-attribute', addLabel: '+ Attribute' },
  sources: { title: 'Sources', add: 'add-source', addLabel: '+ Source' },
  materials: { title: 'Materials', add: 'add-material', addLabel: '+ Material' },
  activity: { title: 'Activity', add: 'add-activity', addLabel: '+ Log activity' },
};

function dashboardSummary() {
  const active = db.prospects.filter(isActiveProspect).length;
  const followUps = db.prospects.filter(p =>
    isActiveProspect(p) && p.nextFollowUp && daysSince(p.nextFollowUp) >= 0 &&
    ['applied', 'interviewing'].includes(p.status)
  ).length;
  const sources = sourcesDue().length;
  const issues = materialIssues().length;
  const bits = [`${active} active`];
  if (followUps) bits.push(`${followUps} follow-up${followUps === 1 ? '' : 's'} due`);
  if (sources) bits.push(`${sources} source${sources === 1 ? '' : 's'} to check`);
  if (issues) bits.push(`${issues} material${issues === 1 ? '' : 's'} to refresh`);
  return `${fmtFull(todayISO())} · ${bits.join(' · ')}`;
}

function render() {
  const meta = VIEW_META[UI.view];
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === UI.view));
  $('#viewTitle').textContent = meta.title;
  $('#viewSubtitle').textContent = UI.view === 'dashboard' ? dashboardSummary() : viewSubtitle(UI.view);
  $('#topActions').innerHTML = `<button class="btn primary" data-action="${meta.add}">${meta.addLabel}</button>`;
  document.title = `${meta.title} · Job Tracker`;

  $('#navCountDashboard').textContent = nextSteps().length || '';
  $('#navCountProspects').textContent = db.prospects.filter(isActiveProspect).length || '';
  $('#navCountCompanies').textContent = db.orgs.length || '';
  $('#navCountSources').textContent = sourcesDue().length || '';
  $('#navCountMaterials').textContent = materialIssues().length || '';
  $('#navCountDashboard').title = `${nextSteps().length} next steps`;
  $('#navCountProspects').title = `${db.prospects.filter(isActiveProspect).length} active prospects`;
  $('#navCountCompanies').title = `${db.orgs.length} companies and agencies`;
  $('#navCountSources').title = `${sourcesDue().length} sources due for a check`;
  $('#navCountMaterials').title = `${materialIssues().length} materials to refresh`;

  if (UI.view === 'dashboard') $('#view').innerHTML = renderDashboard();
  else if (UI.view === 'prospects') $('#view').innerHTML = renderProspects();
  else if (UI.view === 'companies') $('#view').innerHTML = renderCompanies();
  else if (UI.view === 'preferences') $('#view').innerHTML = renderPreferences();
  else if (UI.view === 'sources') $('#view').innerHTML = renderSources();
  else if (UI.view === 'materials') $('#view').innerHTML = renderMaterials();
  else if (UI.view === 'activity') $('#view').innerHTML = renderActivity();
}

function viewSubtitle(view) {
  if (view === 'prospects') {
    const active = db.prospects.filter(isActiveProspect).length;
    return `${plural(db.prospects.length, 'prospect')} tracked · ${active} active · click a row for details`;
  }
  if (view === 'companies') {
    const companies = db.orgs.filter(o => o.kind === 'company').length;
    const agencies = db.orgs.filter(o => o.kind === 'agency').length;
    return `${companies} compan${companies === 1 ? 'y' : 'ies'} · ${agencies} agenc${agencies === 1 ? 'y' : 'ies'} · shared attributes across every prospect`;
  }
  if (view === 'preferences') {
    const active = fitDimensions().filter(d => fitDimensionActive(db.settings.fit?.dimensions?.[d.key])).length;
    return `${active} active fit dimension${active === 1 ? '' : 's'} · weighted and non-negotiable preferences`;
  }
  if (view === 'sources') {
    return `${plural(db.sources.length, 'source')} · ${sourcesDue().length} due for a check`;
  }
  if (view === 'materials') {
    return `${plural(db.materials.length, 'material')} · ${materialIssues().length} could use a refresh`;
  }
  if (view === 'activity') {
    return `${plural(db.activities.length, 'activity entry', 'activity entries')} across your search`;
  }
  return '';
}

/* ------------------------------------------------------------------ *
 *  Dashboard
 * ------------------------------------------------------------------ */
function renderDashboard() {
  if (!db.prospects.length && !db.sources.length && !db.materials.length) {
    return `${sampleBanner()}
      <div class="card">${emptyState(
        'Start your job search command center',
        'Add the sources you watch, the prospects you find, and the materials you send. The dashboard will tell you what needs attention.',
        `<div class="row-actions"><button class="btn primary" data-action="add-prospect">Add your first prospect</button>
         <button class="btn subtle" data-action="load-sample">Load sample data</button></div>`
      )}</div>`;
  }

  const active = db.prospects.filter(isActiveProspect);
  const appliedWeek = db.activities.filter(a => a.type === 'applied' && (daysSince(a.date) ?? 99) <= 7).length;
  const interviewing = db.prospects.filter(p => p.status === 'interviewing').length;
  const offers = db.prospects.filter(p => p.status === 'offered').length;
  const ranked = db.prospects
    .filter(isActiveProspect)
    .map(p => ({ p, fit: fitScore(p) }))
    .filter(x => x.fit.configured);
  const strongFits = ranked.filter(x => !x.fit.blocked && x.fit.score >= 80).length;
  const avgFit = ranked.length ? Math.round(ranked.reduce((sum, x) => sum + x.fit.score, 0) / ranked.length) : null;

  const stats = [
    { label: 'Active prospects', value: active.length, sub: `${active.filter(p => p.status === 'prospect').length} not yet applied`, view: 'prospects', filter: 'active' },
    { label: 'Applied · 7 days', value: appliedWeek, sub: `${db.prospects.filter(p => p.appliedAt).length} applications total`, view: 'activity' },
    { label: 'Interviewing', value: interviewing, sub: interviewing ? 'Keep momentum' : 'Nothing in progress', view: 'prospects', filter: 'interviewing' },
    { label: 'Offers', value: offers, sub: offers ? 'Respond promptly' : 'No open offers', view: 'prospects', filter: 'offered' },
    { label: 'Average fit', value: avgFit === null ? '—' : avgFit, sub: ranked.length ? `${strongFits} strong fit${strongFits === 1 ? '' : 's'} of ${ranked.length} scored` : 'Set your fit preferences', view: 'preferences' },
  ];

  return `${sampleBanner()}
    <div class="stats">
      ${stats.map(s => `<button class="stat" data-action="stat-jump" data-view="${s.view}" data-filter="${s.filter || ''}">
        <span class="stat-label">${s.label}</span>
        <span class="stat-value">${s.value}</span>
        <span class="stat-sub">${s.sub}</span>
      </button>`).join('')}
    </div>

    <div class="dash-grid">
      <div class="stack">
        ${renderAttentionCard()}
        ${renderPipelineCard()}
      </div>
      <div class="stack">
        ${renderSourcesCard()}
        ${renderMaterialsCard()}
      </div>
    </div>

    <div class="dash-grid lower">
      ${renderBestFitsCard()}
      ${renderRecentCard()}
    </div>`;
}

function sampleBanner() {
  if (!db.meta.sample) return '';
  return `<div class="sample-banner">
    <span><strong>Sample data</strong> — explore the dashboard, then clear it when you are ready to track your own search.</span>
    <div class="row-actions">
      <button class="btn sm" data-action="clear-sample">Clear sample data</button>
    </div>
  </div>`;
}

function prioClass(kind) {
  if (kind === 'offer' || kind === 'followup') return 'high';
  if (kind === 'stale' || kind === 'upcoming') return 'med';
  return 'low';
}

function renderAttentionCard() {
  const steps = nextSteps();
  const shown = steps.slice(0, 7);
  return `<section class="card">
    <div class="card-head">
      <div>
        <h2 class="card-title">Next steps</h2>
        <p class="card-sub">The highest-leverage moves across your search.</p>
      </div>
      <button class="btn sm ghost" data-action="nav" data-view="prospects">View all</button>
    </div>
    ${shown.length ? `<div class="list">${shown.map(it => `
      <div class="attn-row">
        <span class="prio ${prioClass(it.kind)}"></span>
        <div class="attn-main" data-action="open-prospect" data-id="${it.p.id}">
          <div class="attn-title">${esc(it.label)} <span class="attn-company">· ${esc(prospectOrgName(it.p))}</span></div>
          <div class="attn-meta">${esc(it.detail)}</div>
        </div>
        <div class="attn-btns">
          <button class="btn sm ghost" data-action="snooze" data-id="${it.p.id}" data-days="3" title="Snooze for 3 days">Snooze</button>
          <button class="btn sm subtle" data-action="open-prospect" data-id="${it.p.id}">Open</button>
        </div>
      </div>`).join('')}
      ${steps.length > shown.length ? `<p class="card-more">${steps.length - shown.length} more item${steps.length - shown.length === 1 ? '' : 's'} need attention. <button class="link-btn" data-action="nav" data-view="prospects">Review prospects →</button></p>` : ''}
      </div>` : emptyState('Nothing urgent', 'No follow-ups, offers, or stale prospects are waiting on you right now.')}
  </section>`;
}

function renderPipelineCard() {
  const counts = STATUS_KEYS.map(k => ({ key: k, count: db.prospects.filter(p => p.status === k).length }));
  const max = Math.max(1, ...counts.map(c => c.count));
  const total = db.prospects.length;
  return `<section class="card">
    <div class="card-head">
      <div>
        <h2 class="card-title">Pipeline</h2>
        <p class="card-sub">Where every prospect stands.</p>
      </div>
      <span class="muted small">${total} total</span>
    </div>
    <div class="pipe">
      ${counts.map(c => `
        <button class="pipe-row" data-action="filter-status" data-status="${c.key}">
          <span class="pipe-label">${pill(c.key)}</span>
          <span class="pipe-track"><span class="pipe-fill ${c.key}" style="width:${Math.round((c.count / max) * 100)}%"></span></span>
          <span class="pipe-count">${c.count}</span>
        </button>`).join('')}
    </div>
  </section>`;
}

function renderSourcesCard() {
  const due = sourcesDue().slice(0, 4);
  const totalDue = sourcesDue().length;
  return `<section class="card">
    <div class="card-head">
      <div>
        <h2 class="card-title">Sources to check</h2>
        <p class="card-sub">Where new prospects come from.</p>
      </div>
      <button class="btn sm ghost" data-action="nav" data-view="sources">All sources</button>
    </div>
    ${due.length ? `<div class="list">${due.map(({ source, check }) => {
      const stats = sourceStats(source);
      return `<div class="mini-row">
        <div class="mini-main" data-action="nav" data-view="sources">
          <div class="mini-title">${esc(source.name)}
            ${check.never ? '<span class="badge warn">Never checked</span>' : check.overdueDays > 0 ? `<span class="badge warn">${check.overdueDays}d overdue</span>` : '<span class="badge info">Due today</span>'}
          </div>
          <div class="mini-sub">${esc(source.kind)} · every ${check.cadence}d · ${stats.active} active prospect${stats.active === 1 ? '' : 's'}</div>
        </div>
        <div class="mini-actions">
          ${source.url ? `<a class="btn sm ghost" href="${esc(source.url)}" target="_blank" rel="noopener">Visit</a>` : ''}
          <button class="btn sm subtle" data-action="mark-source-checked" data-id="${source.id}">Checked</button>
        </div>
      </div>`;
    }).join('')}
    ${totalDue > due.length ? `<p class="card-more">${totalDue - due.length} more source${totalDue - due.length === 1 ? '' : 's'} due.</p>` : ''}
    </div>` : emptyState('All sources checked', 'Nothing is due for a check. New prospects will surface when a source comes due.')}
  </section>`;
}

function renderMaterialsCard() {
  const issues = materialIssues().slice(0, 4);
  const total = materialIssues().length;
  return `<section class="card">
    <div class="card-head">
      <div>
        <h2 class="card-title">Materials to refresh</h2>
        <p class="card-sub">Outdated resumes, letters, and notes.</p>
      </div>
      <button class="btn sm ghost" data-action="nav" data-view="materials">All materials</button>
    </div>
    ${issues.length ? `<div class="list">${issues.map(({ material, reasons }) => `
      <div class="mini-row">
        <div class="mini-main" data-action="nav" data-view="materials">
          <div class="mini-title">${typeBadge(material.type)} ${esc(material.name)}</div>
          <div class="mini-sub">${esc(reasons[0].text)} · ${esc(scopeLabel(material))}</div>
        </div>
        <div class="mini-actions">
          <button class="btn sm subtle" data-action="mark-material-updated" data-id="${material.id}">Refreshed</button>
        </div>
      </div>`).join('')}
    ${total > issues.length ? `<p class="card-more">${total - issues.length} more material${total - issues.length === 1 ? '' : 's'} could use attention.</p>` : ''}
    </div>` : emptyState('Materials look fresh', 'Nothing is stale and no active prospect has outgrown a linked material.')}
  </section>`;
}

function renderBestFitsCard() {
  const ranked = db.prospects
    .filter(isActiveProspect)
    .map(p => ({ p, fit: fitScore(p) }))
    .filter(x => x.fit.configured)
    .sort((a, b) => (b.fit.score - a.fit.score) || prospectOrgName(a.p).localeCompare(prospectOrgName(b.p)));
  const shown = ranked.filter(x => !x.fit.blocked).slice(0, 4);
  const blocked = ranked.filter(x => x.fit.blocked).length;
  return `<section class="card">
    <div class="card-head">
      <div>
        <h2 class="card-title">Best fits</h2>
        <p class="card-sub">Active prospects ranked against your weighted preferences.</p>
      </div>
      <button class="btn sm ghost" data-action="nav" data-view="preferences">Preferences</button>
    </div>
    ${shown.length ? `<div class="list">${shown.map(({ p, fit }) => `
      <div class="mini-row">
        <div class="mini-main" data-action="open-prospect" data-id="${p.id}">
          <div class="mini-title">${fitBadgeHtml(fit)} ${esc(prospectOrgLabel(p))}</div>
          <div class="mini-sub">${esc(p.title)} · ${esc(p.level || 'Level not set')} · ${esc(p.category || 'Category not set')}</div>
        </div>
        <span class="mini-date">${esc(fitTierLabel(fit.tier))}</span>
      </div>`).join('')}
      ${blocked ? `<p class="card-more">${blocked} active prospect${blocked === 1 ? '' : 's'} off brief. <button class="link-btn" data-action="nav" data-view="prospects">Review prospects →</button></p>` : ''}
      </div>` : emptyState('No fit scores yet', 'Set weighted preferences for size, industry, role level, and your own organization attributes.', `<button class="btn sm subtle" data-action="nav" data-view="preferences">Set fit preferences</button>`)}
  </section>`;
}

function renderRecentCard() {
  const recent = recentActivity(6);
  return `<section class="card">
    <div class="card-head">
      <div>
        <h2 class="card-title">Recent activity</h2>
        <p class="card-sub">The latest movement in your search.</p>
      </div>
      <button class="btn sm ghost" data-action="nav" data-view="activity">View all</button>
    </div>
    ${recent.length ? `<div class="list">${recent.map(a => {
      const p = prospectById(a.prospectId);
      return `<div class="mini-row activity-mini">
        <div class="mini-main" data-action="open-prospect" data-id="${a.prospectId}">
          <div class="mini-title">${actBadge(a.type)} ${esc(p ? `${prospectOrgName(p)} · ${p.title}` : 'Removed prospect')}</div>
          <div class="mini-sub clamp">${esc(a.note || 'No note')}</div>
        </div>
        <span class="mini-date">${rel(a.date)}</span>
      </div>`;
    }).join('')}</div>` : emptyState('No activity yet', 'Log a note, application, or interview to start building a timeline.')}
  </section>`;
}
