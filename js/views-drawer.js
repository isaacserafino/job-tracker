'use strict';

/* ------------------------------------------------------------------ *
 *  Prospect detail drawer
 * ------------------------------------------------------------------ */
function openProspect(id) {
  UI.drawer = id;
  renderDrawer();
}
function closeDrawer() {
  UI.drawer = null;
  $('#drawerRoot').innerHTML = '';
}
function refreshDrawer() {
  if (!UI.drawer) return;
  const scroll = $('.drawer')?.scrollTop || 0;
  renderDrawer();
  const d = $('.drawer');
  if (d) d.scrollTop = scroll;
}

function drawerOrgBlock(org, roleLabel, p) {
  if (!org) {
    return `<div class="org-box empty">
      <div class="org-box-head">
        <span class="org-kind company">${roleLabel}</span>
        <button class="btn sm ghost" data-action="edit-prospect" data-id="${p.id}">Set</button>
      </div>
      <p class="muted small">${roleLabel === 'Company'
        ? 'The direct company is not known yet. Add one when you learn who the role sits with.'
        : 'No agency or recruiter is involved.'}</p>
    </div>`;
  }
  return `<div class="org-box">
    <div class="org-box-head">
      <span class="org-kind ${org.kind}">${roleLabel}</span>
      <strong>${esc(org.name)}</strong>
      <button class="btn sm ghost" data-action="edit-org" data-id="${org.id}">Edit</button>
    </div>
    <div class="org-box-meta">${esc(orgAttributeSummary(org))}</div>
    ${orgAttributeChips(org)}
    ${org.website ? `<div class="org-box-link"><a href="${esc(org.website)}" target="_blank" rel="noopener">${esc(org.website.replace(/^https?:\/\//, ''))}</a></div>` : ''}
  </div>`;
}

function renderFitSection(p) {
  const fit = fitScore(p);
  if (!fit.configured) {
    return `<section class="drawer-sec">
      <div class="sec-head">
        <h3>Fit</h3>
        <button class="btn sm ghost" data-action="nav" data-view="preferences">Set preferences</button>
      </div>
      <p class="muted small">No fit preferences are set yet. Add weights and preferred values to score this prospect.</p>
    </section>`;
  }

  return `<section class="drawer-sec">
    <div class="sec-head">
      <h3>Fit</h3>
      <span class="fit-headline">${fitBadgeHtml(fit)} ${esc(fitTierLabel(fit.tier))}</span>
    </div>
    <div class="fit-breakdown">
      ${fit.breakdown.map(b => `
        <div class="fit-line ${b.avoided ? 'avoided' : b.matched ? 'matched' : 'missed'}">
          <div class="fit-line-head">
            <span>${esc(b.label)}${b.required ? ' <span class="req-tag">required</span>' : ''}</span>
            <span class="fit-state">${b.avoided ? 'Avoided' : b.matched ? 'Match' : 'Miss'} · weight ${b.weight}</span>
          </div>
          <div class="fit-line-meta">
            Actual: <b>${esc(b.actualLabel)}</b>
            <span class="muted"> · Prefer: ${esc(b.expectedLabel)}</span>
            ${b.avoid.length ? `<span class="muted"> · Avoid: ${esc(b.avoidLabel)}</span>` : ''}
          </div>
        </div>`).join('')}
    </div>
    <button class="link-btn" data-action="nav" data-view="preferences">Adjust fit preferences →</button>
  </section>`;
}

function renderDrawer() {
  if (!UI.drawer) return;
  const p = prospectById(UI.drawer);
  if (!p) { closeDrawer(); return; }

  const src = sourceById(p.sourceId);
  const company = companyOrg(p);
  const agency = agencyOrg(p);
  const linked = db.materials.filter(m => p.materialIds.includes(m.id));
  const recommended = db.materials.filter(m =>
    !p.materialIds.includes(m.id) &&
    m.target === 'title' && m.targetTitle &&
    p.title.toLowerCase().includes(m.targetTitle.toLowerCase())
  );
  const acts = activityFor(p.id);
  const snoozed = isSnoozed(p);

  $('#drawerRoot').innerHTML = `
  <div class="drawer-overlay" data-action="close-drawer"></div>
  <aside class="drawer" role="dialog" aria-modal="true" aria-label="Prospect details">
    <header class="drawer-head">
      <div class="drawer-head-text">
        <div class="drawer-kicker">${src ? esc(src.name) : 'No source'}</div>
        <h2>${esc(company ? company.name : (agency ? `${agency.name} (agency)` : 'Unknown company'))}</h2>
        <p>${esc(p.title)}${agency ? ` <span class="muted">· via ${esc(agency.name)}</span>` : ''}</p>
      </div>
      <button class="icon-btn" data-action="close-drawer" aria-label="Close details">✕</button>
    </header>

    <div class="drawer-body">
      ${snoozed ? `<div class="notice">Snoozed until ${fmt(p.snoozedUntil)}. It will stay out of next steps until then.
        <button class="link-btn" data-action="unsnooze" data-id="${p.id}">Unsnooze</button></div>` : ''}

      <div class="status-bar">
        ${STATUS_KEYS.map(k => `<button class="chip ${p.status === k ? 'active' : ''}" data-action="set-status" data-id="${p.id}" data-status="${k}">${STATUS[k].label}</button>`).join('')}
      </div>

      <dl class="meta-grid">
        <div><dt>Level</dt><dd>${p.level ? esc(p.level) : '<span class="faint">—</span>'}</dd></div>
        <div><dt>Category</dt><dd>${p.category ? esc(p.category) : '<span class="faint">—</span>'}</dd></div>
        <div><dt>Work mode</dt><dd>${modeChip(p.workMode)} ${p.location ? `<span class="muted">· ${esc(p.location)}</span>` : ''}</dd></div>
        <div><dt>Compensation</dt><dd>${p.salary ? esc(p.salary) : '<span class="faint">—</span>'}</dd></div>
        <div><dt>Added</dt><dd>${fmt(p.addedAt)} <span class="muted">· ${rel(p.addedAt)}</span></dd></div>
        <div><dt>Applied</dt><dd>${p.appliedAt ? `${fmt(p.appliedAt)} <span class="muted">· ${rel(p.appliedAt)}</span>` : '<span class="faint">Not applied</span>'}</dd></div>
        <div><dt>Last activity</dt><dd>${fmt(p.lastActivityAt)} <span class="muted">· ${rel(p.lastActivityAt)}</span></dd></div>
        <div><dt>Next follow-up</dt><dd class="${dueTone(p.nextFollowUp)}">${p.nextFollowUp ? `${fmt(p.nextFollowUp)} <span class="muted">· ${dueLabel(p.nextFollowUp)}</span>` : '<span class="faint">Not set</span>'}</dd></div>
        ${p.url ? `<div class="span-2"><dt>Posting</dt><dd><a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.url.replace(/^https?:\/\//, '').slice(0, 48))}${p.url.length > 55 ? '…' : ''}</a></dd></div>` : ''}
      </dl>

      ${renderFitSection(p)}

      <section class="drawer-sec">
        <div class="sec-head">
          <h3>Organizations</h3>
          <button class="btn sm subtle" data-action="edit-prospect" data-id="${p.id}">Change</button>
        </div>
        ${drawerOrgBlock(company, 'Company', p)}
        ${drawerOrgBlock(agency, 'Agency', p)}
      </section>

      <section class="drawer-sec">
        <div class="sec-head">
          <h3>Materials</h3>
          <button class="btn sm subtle" data-action="edit-prospect" data-id="${p.id}">Manage</button>
        </div>
        ${linked.length ? linked.map(m => `
          <div class="material-line">
            ${typeBadge(m.type)}
            <div class="ml-main">
              <div class="ml-name">${esc(m.name)}</div>
              <div class="muted small">${MATERIAL_TYPES[m.type].label} · updated ${rel(m.lastUpdated)}</div>
            </div>
            ${m.link ? `<a class="icon-btn sm" href="${esc(m.link)}" target="_blank" rel="noopener" title="Open material">↗</a>` : ''}
            <button class="btn sm ghost" data-action="mark-material-updated" data-id="${m.id}">Refresh</button>
            <button class="icon-btn sm" data-action="unlink-material" data-prospect="${p.id}" data-id="${m.id}" title="Unlink material">✕</button>
          </div>`).join('') : '<p class="muted small">No materials linked to this prospect yet.</p>'}
        ${recommended.length ? `<div class="reco">
          <div class="reco-head">Title-matched in your library</div>
          ${recommended.map(m => `<div class="material-line compact">
            <div class="ml-main"><div class="ml-name">${esc(m.name)} <span class="muted small">· ${esc(scopeLabel(m))}</span></div></div>
            <button class="btn sm ghost" data-action="link-material" data-prospect="${p.id}" data-id="${m.id}">Link</button>
          </div>`).join('')}
        </div>` : ''}
      </section>

      <section class="drawer-sec">
        <div class="sec-head"><h3>Notes</h3></div>
        <p class="notes-body">${p.notes ? esc(p.notes) : '<span class="faint">No notes yet.</span>'}</p>
      </section>

      <section class="drawer-sec activity-sec">
        <div class="sec-head"><h3>Activity</h3><span class="muted small">${acts.length} entr${acts.length === 1 ? 'y' : 'ies'}</span></div>
        <form id="activityForm" class="activity-form" data-prospect="${p.id}">
          <select name="type" aria-label="Activity type">
            ${Object.entries(ACTIVITY_TYPES).filter(([k]) => k !== 'status').map(([k, label]) => `<option value="${k}" ${k === 'note' ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
          <input type="date" name="date" value="${todayISO()}" required aria-label="Activity date">
          <input type="text" name="note" placeholder="What happened?" aria-label="Activity note">
          <button class="btn sm primary" type="submit">Log</button>
        </form>
        ${acts.length ? `<ol class="timeline">
          ${acts.map(a => `<li>
            <span class="tl-dot ${a.type}"></span>
            <div class="tl-main">
              <div class="tl-top">
                ${actBadge(a.type)}
                <span class="tl-date">${fmt(a.date)} · ${rel(a.date)}</span>
                <button class="icon-btn sm tl-del" data-action="delete-activity" data-id="${a.id}" title="Delete entry">✕</button>
              </div>
              ${a.note ? `<p>${esc(a.note)}</p>` : ''}
            </div>
          </li>`).join('')}
        </ol>` : '<p class="muted small">Nothing logged yet. Add the first entry above.</p>'}
      </section>
    </div>

    <footer class="drawer-foot">
      <button class="btn primary" data-action="edit-prospect" data-id="${p.id}">Edit prospect</button>
      <button class="btn ghost danger-text" data-action="delete-prospect" data-id="${p.id}">Delete</button>
    </footer>
  </aside>`;
}
