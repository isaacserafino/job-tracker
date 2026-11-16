'use strict';

/* ------------------------------------------------------------------ *
 *  Modal plumbing + form field helpers
 * ------------------------------------------------------------------ */
function openModal(title, bodyHtml, onSubmit, opts = {}) {
  const root = $('#modalRoot');
  root.innerHTML = `<div class="modal-overlay" data-action="close-modal"></div>
    <div class="modal ${opts.wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <header class="modal-head">
        <h2>${esc(title)}</h2>
        <button class="icon-btn" data-action="close-modal" aria-label="Close">✕</button>
      </header>
      <form id="modalForm" novalidate>
        <div class="modal-body">${bodyHtml}</div>
        <footer class="modal-foot">
          <button type="button" class="btn ghost" data-action="close-modal">Cancel</button>
          <button type="submit" class="btn primary">${esc(opts.submitLabel || 'Save')}</button>
        </footer>
      </form>
    </div>`;
  const form = $('#modalForm', root);
  form.addEventListener('submit', e => {
    e.preventDefault();
    const result = onSubmit(new FormData(form), form);
    if (result !== false) closeModal();
  });
  if (opts.onMount) opts.onMount(form);
  const first = form.querySelector('input:not([type=hidden]), select, textarea');
  if (first) setTimeout(() => first.focus(), 30);
}
function closeModal() {
  $('#modalRoot').innerHTML = '';
}

const field = (label, html, cls = '') => `<label class="field ${cls}"><span>${label}</span>${html}</label>`;
const input = (name, value = '', attrs = '') => `<input class="control" type="text" name="${name}" value="${esc(value)}" ${attrs}>`;
const dateInput = (name, value = '') => `<input class="control" type="date" name="${name}" value="${esc(value || '')}">`;
const textarea = (name, value = '', rows = 3) => `<textarea class="control" name="${name}" rows="${rows}">${esc(value || '')}</textarea>`;
function select(name, options, value, attrs = '') {
  return `<select class="control" name="${name}" ${attrs}>${options.map(o => {
    const [v, label] = Array.isArray(o) ? o : [o, o];
    return `<option value="${esc(v)}" ${String(v) === String(value ?? '') ? 'selected' : ''}>${esc(label)}</option>`;
  }).join('')}</select>`;
}
const val = (data, name) => String(data.get(name) || '').trim();

/* ------------------------------------------------------------------ *
 *  Organization pickers with inline quick-create
 * ------------------------------------------------------------------ */
function orgQuickFields(kind) {
  return `<div class="quick-org" data-quick-org="${kind}" hidden>
    <div class="quick-source-title">Add a ${ORG_KINDS[kind].label.toLowerCase()}</div>
    <input class="control" type="text" data-org-name="${kind}" placeholder="${kind === 'company' ? 'Company name' : 'Agency / recruiter name'}" aria-label="New ${kind} name">
    <div class="quick-source-row">
      <input class="control" type="number" min="1" data-org-employees="${kind}" placeholder="Employees" aria-label="Employees" title="Approximate employee count">
      <input class="control" type="text" list="industryList" data-org-industry="${kind}" placeholder="Industry" aria-label="Industry">
      <button type="button" class="btn sm primary" data-org-add="${kind}">Add</button>
      <button type="button" class="btn sm ghost" data-org-cancel="${kind}">Cancel</button>
    </div>
    <p class="form-hint">You can add attributes, a website, and notes later from Companies &amp; agencies.</p>
  </div>`;
}

function setupOrgPicker(form, kind, initialId) {
  const selectEl = form.querySelector(`[name="${kind}Id"]`);
  const panel = form.querySelector(`[data-quick-org="${kind}"]`);
  if (!selectEl || !panel) return;
  let currentId = initialId || '';
  const nameInput = panel.querySelector(`[data-org-name="${kind}"]`);
  const employeesInput = panel.querySelector(`[data-org-employees="${kind}"]`);
  const industryInput = panel.querySelector(`[data-org-industry="${kind}"]`);

  const closePanel = () => {
    panel.hidden = true;
    selectEl.value = currentId;
    nameInput.value = '';
    employeesInput.value = '';
    industryInput.value = '';
  };
  const openPanel = () => {
    panel.hidden = false;
    selectEl.value = currentId;
    setTimeout(() => nameInput.focus(), 30);
  };
  const addOrg = () => {
    const name = nameInput.value.trim();
    if (!name) {
      toast(`Give the new ${ORG_KINDS[kind].label.toLowerCase()} a name.`, 'error');
      nameInput.focus();
      return;
    }
    const employees = Number(employeesInput.value);
    const org = {
      id: uid(kind === 'agency' ? 'agy' : 'cmp'),
      kind,
      name,
      employees: Number.isFinite(employees) && employees > 0 ? Math.round(employees) : null,
      industry: canonicalIndustry(industryInput.value),
      website: '',
      notes: '',
      attributes: {},
      createdAt: new Date().toISOString(),
    };
    db.orgs.push(org);
    saveDB();
    const option = document.createElement('option');
    option.value = org.id;
    option.textContent = org.name;
    selectEl.insertBefore(option, selectEl.querySelector('option[value="__new__"]'));
    selectEl.value = org.id;
    currentId = org.id;
    closePanel();
    selectEl.value = org.id;
    currentId = org.id;
    render();
    toast(`${ORG_KINDS[kind].label} “${org.name}” added.`);
  };

  selectEl.addEventListener('change', () => {
    if (selectEl.value === '__new__') openPanel();
    else currentId = selectEl.value;
  });
  panel.querySelector(`[data-org-add="${kind}"]`).addEventListener('click', addOrg);
  panel.querySelector(`[data-org-cancel="${kind}"]`).addEventListener('click', closePanel);
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closePanel();
    } else if (event.key === 'Enter' && event.target.matches('input')) {
      event.preventDefault();
      event.stopPropagation();
      addOrg();
    }
  });
}

function orgOptions(kind, selectedId) {
  const list = db.orgs.filter(o => o.kind === kind).sort((a, b) => a.name.localeCompare(b.name));
  return [['', `— No ${ORG_KINDS[kind].label.toLowerCase()} —`],
    ...list.map(o => [o.id, o.name]),
    ['__new__', `+ New ${ORG_KINDS[kind].label.toLowerCase()}…`]];
}

function orgPickerField(kind, selectedId) {
  const inputName = `${kind}Id`;
  return `<div class="field">
    <span>${ORG_KINDS[kind].label}</span>
    <div class="source-picker">
      ${select(inputName, orgOptions(kind, selectedId), selectedId || '')}
      <button type="button" class="btn sm subtle" data-org-open="${kind}">New</button>
    </div>
    ${orgQuickFields(kind)}
  </div>`;
}

/* ------------------------------------------------------------------ *
 *  Prospect form
 * ------------------------------------------------------------------ */
function setupProspectSourcePicker(form, initialSourceId) {
  const selectEl = form.querySelector('[name="sourceId"]');
  const panel = form.querySelector('[data-quick-source]');
  if (!selectEl || !panel) return;
  let currentSourceId = initialSourceId || '';
  const nameInput = form.querySelector('[data-quick-source-name]');
  const kindInput = form.querySelector('[data-quick-source-kind]');
  const cadenceInput = form.querySelector('[data-quick-source-cadence]');

  const closePanel = () => {
    panel.hidden = true;
    selectEl.value = currentSourceId;
    nameInput.value = '';
    cadenceInput.value = '7';
  };
  const openPanel = () => {
    panel.hidden = false;
    selectEl.value = currentSourceId;
    setTimeout(() => nameInput.focus(), 30);
  };
  const addSource = () => {
    const name = nameInput.value.trim();
    if (!name) {
      toast('Give the new source a name.', 'error');
      nameInput.focus();
      return;
    }
    const source = {
      id: uid('src'),
      name,
      kind: kindInput.value || 'Other',
      url: '',
      cadenceDays: clamp(Number(cadenceInput.value) || 7, 1, 180),
      lastChecked: null,
      notes: '',
      active: true,
      createdAt: new Date().toISOString(),
    };
    db.sources.push(source);
    saveDB();
    const option = document.createElement('option');
    option.value = source.id;
    option.textContent = source.name;
    selectEl.insertBefore(option, selectEl.querySelector('option[value="__new__"]'));
    selectEl.value = source.id;
    currentSourceId = source.id;
    panel.hidden = true;
    nameInput.value = '';
    cadenceInput.value = '7';
    render();
    toast(`Source “${source.name}” added.`);
  };

  selectEl.addEventListener('change', () => {
    if (selectEl.value === '__new__') openPanel();
    else currentSourceId = selectEl.value;
  });
  form.querySelector('[data-quick-source-open]').addEventListener('click', openPanel);
  form.querySelector('[data-quick-source-add]').addEventListener('click', addSource);
  form.querySelector('[data-quick-source-cancel]').addEventListener('click', closePanel);
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closePanel();
    } else if (event.key === 'Enter' && event.target.matches('input')) {
      event.preventDefault();
      event.stopPropagation();
      addSource();
    }
  });
}

function editProspectModal(id) {
  const p = id ? prospectById(id) : null;
  const d = p || {
    companyId: '', agencyId: '', title: '', level: '', category: '', sourceId: '',
    status: 'prospect', workMode: 'unspecified', location: '', salary: '', url: '',
    addedAt: todayISO(), appliedAt: '', nextFollowUp: '', notes: '', materialIds: [],
  };
  const srcOptions = [['', '— No source —'], ...db.sources.map(s => [s.id, s.name]), ['__new__', '+ New source…']];
  const sourceField = `<div class="field">
    <span>Source</span>
    <div class="source-picker">
      ${select('sourceId', srcOptions, d.sourceId || '')}
      <button type="button" class="btn sm subtle" data-quick-source-open>New</button>
    </div>
    <div class="quick-source" data-quick-source hidden>
      <div class="quick-source-title">Add a source</div>
      <input class="control" type="text" data-quick-source-name placeholder="Source name" aria-label="New source name">
      <div class="quick-source-row">
        <select class="control" data-quick-source-kind aria-label="New source type">
          ${SOURCE_KINDS.map(k => `<option value="${esc(k)}">${esc(k)}</option>`).join('')}
        </select>
        <input class="control" type="number" data-quick-source-cadence min="1" max="180" value="7" title="Check every X days" aria-label="Check every days">
        <button type="button" class="btn sm primary" data-quick-source-add>Add</button>
        <button type="button" class="btn sm ghost" data-quick-source-cancel>Cancel</button>
      </div>
      <p class="form-hint">Check every 7 days by default. Add a URL and notes later from the Sources page.</p>
    </div>
  </div>`;
  const materialChecks = db.materials.length
    ? db.materials.map(m => `<label class="check">
        <input type="checkbox" name="materialIds" value="${m.id}" ${d.materialIds.includes(m.id) ? 'checked' : ''}>
        <span class="check-text">${esc(m.name)}<small>${MATERIAL_TYPES[m.type].label} · ${esc(scopeLabel(m))}</small></span>
      </label>`).join('')
    : '<p class="muted small">No materials in your library yet. You can add them later.</p>';
  const levelOptions = [['', '— Not set —'], ...JOB_LEVELS];
  const categoryOptions = [['', '— Not set —'], ...JOB_CATEGORIES];
  if (d.level && !JOB_LEVELS.includes(d.level)) levelOptions.push([d.level, d.level]);
  if (d.category && !JOB_CATEGORIES.includes(d.category)) categoryOptions.push([d.category, d.category]);

  const body = `
    <div class="form-grid">
      ${orgPickerField('company', d.companyId)}
      ${orgPickerField('agency', d.agencyId)}
      ${field('Job title *', input('title', d.title, 'required placeholder="Senior Product Designer"'))}
      ${field('Level', select('level', levelOptions, d.level || ''))}
      ${field('Category', select('category', categoryOptions, d.category || ''))}
      ${sourceField}
      ${field('Status', select('status', STATUS_KEYS.map(k => [k, STATUS[k].label]), d.status))}
      ${field('Work mode', select('workMode', Object.entries(WORK_MODES).map(([k, v]) => [k, v.label]), d.workMode))}
      ${field('Location', input('location', d.location, 'placeholder="City, ST — or Remote"'))}
      ${field('Compensation', input('salary', d.salary, 'placeholder="$140–160k or $75/hr"'))}
      ${field('Posting URL', input('url', d.url, 'type="url" placeholder="https://…"'))}
      ${field('Date added', dateInput('addedAt', d.addedAt))}
      ${field('Date applied', dateInput('appliedAt', d.appliedAt))}
      ${field('Next follow-up', dateInput('nextFollowUp', d.nextFollowUp))}
    </div>
    <p class="form-hint">A prospect needs a company, an agency, or both. The direct company can stay unknown at first.</p>
    ${field('Notes', textarea('notes', d.notes, 3))}
    <fieldset class="form-section">
      <legend>Materials sent or used</legend>
      <div class="check-grid">${materialChecks}</div>
    </fieldset>`;

  openModal(p ? 'Edit prospect' : 'New prospect', body, data => {
    const title = val(data, 'title');
    if (!title) { toast('A job title is required.', 'error'); return false; }
    const companyId = val(data, 'companyId');
    const agencyId = val(data, 'agencyId');
    const company = db.orgs.find(o => o.id === companyId && o.kind === 'company') || null;
    const agency = db.orgs.find(o => o.id === agencyId && o.kind === 'agency') || null;
    if (!company && !agency) {
      toast('Add a company or an agency — at least one is required.', 'error');
      return false;
    }

    const status = data.get('status');
    const prevStatus = p?.status;
    const target = p || {
      id: uid('prs'), createdAt: new Date().toISOString(),
      statusChangedAt: null, lastActivityAt: null, snoozedUntil: null,
    };
    const addedAt = val(data, 'addedAt') || todayISO();
    let appliedAt = val(data, 'appliedAt') || null;
    if (!appliedAt && ['applied', 'interviewing', 'offered'].includes(status)) {
      appliedAt = p?.appliedAt || todayISO();
    }

    Object.assign(target, {
      companyId: company ? company.id : null,
      agencyId: agency ? agency.id : null,
      title,
      level: val(data, 'level'),
      category: val(data, 'category'),
      sourceId: data.get('sourceId') || null,
      status,
      workMode: data.get('workMode') || 'unspecified',
      location: val(data, 'location'),
      salary: val(data, 'salary'),
      url: val(data, 'url'),
      addedAt,
      appliedAt,
      nextFollowUp: val(data, 'nextFollowUp') || null,
      materialIds: data.getAll('materialIds').map(String),
      notes: String(data.get('notes') || ''),
    });

    const isNew = !p;
    if (isNew) {
      db.prospects.push(target);
      logActivity(target.id, 'added', target.addedAt, 'Added to job tracker');
    }
    if (isNew || prevStatus !== status) {
      target.statusChangedAt = todayISO();
      logActivity(target.id, STATUS_ACTIVITY[status] || 'note', todayISO(),
        isNew ? `Status set to ${STATUS[status].label}` : `Status changed to ${STATUS[status].label}`);
    }
    recomputeLastActivity(target);

    commit();
    if (isNew) openProspect(target.id);
    toast(isNew ? 'Prospect added.' : 'Prospect updated.');
    return true;
  }, {
    wide: true,
    submitLabel: p ? 'Save changes' : 'Add prospect',
    onMount: form => {
      setupProspectSourcePicker(form, d.sourceId || '');
      setupOrgPicker(form, 'company', d.companyId || '');
      setupOrgPicker(form, 'agency', d.agencyId || '');
      form.querySelectorAll('[data-org-open]').forEach(btn => {
        btn.addEventListener('click', () => {
          const kind = btn.dataset.orgOpen;
          const panel = form.querySelector(`[data-quick-org="${kind}"]`);
          if (!panel) return;
          panel.hidden = false;
          setTimeout(() => panel.querySelector(`[data-org-name="${kind}"]`)?.focus(), 30);
        });
      });
    },
  });
}

/* ------------------------------------------------------------------ *
 *  Source form
 * ------------------------------------------------------------------ */
function editSourceModal(id) {
  const s = id ? sourceById(id) : null;
  const d = s || {
    name: '', kind: 'Job board', url: '', cadenceDays: 7, lastChecked: '', notes: '', active: true,
  };
  const body = `
    <div class="form-grid">
      ${field('Source name *', input('name', d.name, 'required placeholder="LinkedIn Jobs"'))}
      ${field('Type', select('kind', SOURCE_KINDS.map(k => [k, k]), d.kind))}
      ${field('URL', input('url', d.url, 'type="url" placeholder="https://…"'))}
      ${field('Check every (days)', `<input class="control" type="number" name="cadenceDays" min="1" max="180" value="${esc(d.cadenceDays)}">`)}
      ${field('Last checked', dateInput('lastChecked', d.lastChecked))}
    </div>
    ${field('Notes', textarea('notes', d.notes, 3))}
    <label class="check single"><input type="checkbox" name="active" ${d.active !== false ? 'checked' : ''}><span class="check-text">Active — include in due-source checks</span></label>`;

  openModal(s ? 'Edit source' : 'New source', body, data => {
    const name = val(data, 'name');
    if (!name) { toast('Source name is required.', 'error'); return false; }
    const target = s || { id: uid('src'), createdAt: new Date().toISOString() };
    Object.assign(target, {
      name,
      kind: data.get('kind') || 'Other',
      url: val(data, 'url'),
      cadenceDays: clamp(Number(data.get('cadenceDays')) || 7, 1, 180),
      lastChecked: val(data, 'lastChecked') || null,
      notes: String(data.get('notes') || ''),
      active: data.get('active') === 'on',
    });
    if (!s) db.sources.push(target);
    commit();
    toast(s ? 'Source updated.' : 'Source added.');
    return true;
  }, { submitLabel: s ? 'Save changes' : 'Add source' });
}

/* ------------------------------------------------------------------ *
 *  Material forms
 * ------------------------------------------------------------------ */
function materialTargetFields(d) {
  const prospectOptions = [['', '— Choose a prospect —'], ...db.prospects
    .slice().sort((a, b) => prospectOrgName(a).localeCompare(prospectOrgName(b)))
    .map(p => [p.id, `${prospectOrgName(p)} — ${p.title}`])];
  return `
    <div class="form-grid">
      <label class="field" data-target-field="title">
        <span>Target job title</span>
        ${input('targetTitle', d.targetTitle || '', 'placeholder="Product Designer"')}
      </label>
      <label class="field" data-target-field="prospect">
        <span>Target prospect</span>
        ${select('targetProspectId', prospectOptions, d.targetProspectId || '')}
      </label>
    </div>
    <p class="form-hint" data-target-hint></p>`;
}

function syncMaterialTargetFields(form) {
  const target = form.querySelector('[name="target"]').value;
  $$('[data-target-field]', form).forEach(el => {
    el.style.display = el.dataset.targetField === target ? '' : 'none';
  });
  const hint = form.querySelector('[data-target-hint]');
  if (hint) {
    hint.textContent = target === 'general'
      ? 'General materials are usable for any role.'
      : target === 'title'
        ? 'This version is recommended automatically when a prospect’s title contains these words.'
        : 'A one-off version for a single prospect. It is linked to that prospect automatically.';
  }
}

function editMaterialModal(id) {
  const m = id ? materialById(id) : null;
  const d = m || {
    name: '', type: 'resume', target: 'general', targetTitle: '', targetProspectId: '',
    lastUpdated: todayISO(), link: '', notes: '',
  };
  const body = `
    <div class="form-grid">
      ${field('Material name *', input('name', d.name, 'required placeholder="Senior Product Designer resume"'))}
      ${field('Type', select('type', Object.entries(MATERIAL_TYPES).map(([k, v]) => [k, v.label]), d.type))}
      ${field('Targeting', select('target', [
        ['general', 'General — any role'],
        ['title', 'A job title'],
        ['prospect', 'A specific prospect'],
      ], d.target))}
      ${field('Last updated', dateInput('lastUpdated', d.lastUpdated))}
    </div>
    ${materialTargetFields(d)}
    ${field('File / link', input('link', d.link, 'placeholder="Path or URL — optional"'))}
    ${field('Notes', textarea('notes', d.notes, 3))}`;

  openModal(m ? 'Edit material' : 'New material', body, data => {
    const name = val(data, 'name');
    if (!name) { toast('Material name is required.', 'error'); return false; }
    const target = data.get('target');
    const targetTitle = val(data, 'targetTitle');
    const targetProspectId = val(data, 'targetProspectId') || null;
    if (target === 'title' && !targetTitle) { toast('Add the job title this version is for.', 'error'); return false; }
    if (target === 'prospect' && !targetProspectId) { toast('Choose the prospect this version is for.', 'error'); return false; }

    const item = m || { id: uid('mat'), createdAt: new Date().toISOString() };
    Object.assign(item, {
      name,
      type: data.get('type') || 'notes',
      target,
      targetTitle: target === 'title' ? targetTitle : '',
      targetProspectId: target === 'prospect' ? targetProspectId : null,
      lastUpdated: val(data, 'lastUpdated') || todayISO(),
      link: val(data, 'link'),
      notes: String(data.get('notes') || ''),
    });
    if (!m) db.materials.push(item);
    if (target === 'prospect' && targetProspectId) {
      const p = prospectById(targetProspectId);
      if (p && !p.materialIds.includes(item.id)) p.materialIds.push(item.id);
    }
    commit();
    toast(m ? 'Material updated.' : 'Material added.');
    return true;
  }, {
    submitLabel: m ? 'Save changes' : 'Add material',
    onMount: form => {
      syncMaterialTargetFields(form);
      form.querySelector('[name="target"]').addEventListener('change', () => syncMaterialTargetFields(form));
    },
  });
}

function duplicateMaterialModal(id) {
  const m = materialById(id);
  if (!m) return;
  const d = {
    name: `${m.name} (copy)`,
    target: m.target === 'prospect' ? 'prospect' : 'general',
    targetTitle: m.targetTitle || '',
    targetProspectId: m.targetProspectId || '',
  };
  const body = `
    <p class="form-hint">Duplicating <strong>${esc(m.name)}</strong>. Tailor the copy to a title or a specific prospect.</p>
    ${field('New material name *', input('name', d.name, 'required'))}
    ${field('Targeting', select('target', [
      ['general', 'General — any role'],
      ['title', 'A job title'],
      ['prospect', 'A specific prospect'],
    ], d.target))}
    ${materialTargetFields(d)}`;

  openModal('Duplicate material', body, data => {
    const name = val(data, 'name');
    if (!name) { toast('Material name is required.', 'error'); return false; }
    const target = data.get('target');
    const targetTitle = val(data, 'targetTitle');
    const targetProspectId = val(data, 'targetProspectId') || null;
    if (target === 'title' && !targetTitle) { toast('Add the job title this version is for.', 'error'); return false; }
    if (target === 'prospect' && !targetProspectId) { toast('Choose the prospect this version is for.', 'error'); return false; }

    const copy = {
      id: uid('mat'),
      name,
      type: m.type,
      target,
      targetTitle: target === 'title' ? targetTitle : '',
      targetProspectId: target === 'prospect' ? targetProspectId : null,
      lastUpdated: todayISO(),
      link: m.link,
      notes: m.notes,
      createdAt: new Date().toISOString(),
    };
    db.materials.push(copy);
    if (target === 'prospect' && targetProspectId) {
      const p = prospectById(targetProspectId);
      if (p && !p.materialIds.includes(copy.id)) p.materialIds.push(copy.id);
    }
    commit();
    toast('Material duplicated.');
    return true;
  }, {
    submitLabel: 'Create copy',
    onMount: form => {
      syncMaterialTargetFields(form);
      form.querySelector('[name="target"]').addEventListener('change', () => syncMaterialTargetFields(form));
    },
  });
}

/* ------------------------------------------------------------------ *
 *  Organization, attribute, and activity forms
 * ------------------------------------------------------------------ */
function orgAttributeFields(org) {
  const attrs = db.settings.attributes;
  if (!attrs.length) {
    return `<p class="form-hint">No custom attributes defined yet. Add tech stack, modernity, openness, or anything else from Fit preferences.</p>`;
  }
  return `<fieldset class="form-section">
    <legend>Attributes</legend>
    <div class="form-grid">
      ${attrs.map(attr => {
        const values = orgAttrValues(org, attr.id);
        const key = `attr_${attr.id}`;
        if (attr.multi) {
          const choices = attributeChoices(attr);
          return `<div class="field">
            <span>${esc(attr.label)}</span>
            ${choices.length ? `<div class="check-grid">${choices.map(v => `
              <label class="check"><input type="checkbox" name="${key}" value="${esc(v)}"
                ${values.some(x => fitValueMatches('', x, v)) ? 'checked' : ''}>
                <span class="check-text">${esc(v)}</span></label>`).join('')}</div>`
              : '<span class="muted small">No options yet — add some in Fit preferences.</span>'}
          </div>`;
        }
        const choices = [['', '— Not set —'], ...attributeChoices(attr).map(v => [v, v])];
        return field(esc(attr.label), select(key, choices, values[0] || ''));
      }).join('')}
    </div>
  </fieldset>`;
}

function editOrgModal(id) {
  const org = id ? orgById(id) : null;
  const d = org || {
    kind: 'company', name: '', employees: '', industry: '', website: '', notes: '', attributes: {},
  };
  const kindField = org
    ? `<div class="field"><span>Type</span><div class="static-field">${ORG_KINDS[d.kind].label}</div><input type="hidden" name="kind" value="${d.kind}"></div>`
    : field('Type', select('kind', [
      ['company', 'Company — a direct employer'],
      ['agency', 'Agency — a recruiter or staffing firm'],
    ], d.kind));
  const body = `
    <div class="form-grid">
      ${kindField}
      ${field('Name *', input('name', d.name, 'required placeholder="Acme Corp"'))}
      ${field('Employees', `<input class="control" type="number" name="employees" min="1" value="${d.employees ?? ''}" placeholder="e.g. 120">`)}
      ${field('Industry', input('industry', d.industry, 'list="industryList" placeholder="Technology"'))}
      ${field('Website', input('website', d.website, 'type="url" placeholder="https://…"'))}
    </div>
    <datalist id="industryList">${knownIndustries().map(i => `<option value="${esc(i)}"></option>`).join('')}</datalist>
    ${field('Notes', textarea('notes', d.notes, 3))}
    ${orgAttributeFields(d)}`;

  openModal(org ? `Edit ${ORG_KINDS[d.kind].label.toLowerCase()}` : 'New organization', body, data => {
    const name = val(data, 'name');
    if (!name) { toast('A name is required.', 'error'); return false; }
    const kind = org ? d.kind : (data.get('kind') === 'agency' ? 'agency' : 'company');
    const duplicate = db.orgs.find(o => o.id !== org?.id && o.kind === kind && o.name.toLowerCase() === name.toLowerCase());
    if (duplicate) { toast(`A ${ORG_KINDS[kind].label.toLowerCase()} named “${duplicate.name}” already exists.`, 'error'); return false; }
    const employees = Number(data.get('employees'));

    const attributes = {};
    db.settings.attributes.forEach(attr => {
      const key = `attr_${attr.id}`;
      const values = attr.multi
        ? data.getAll(key).map(String).map(v => v.trim()).filter(Boolean)
        : [val(data, key)].filter(Boolean);
      if (values.length) attributes[attr.id] = values;
    });

    const target = org || { id: uid(kind === 'agency' ? 'agy' : 'cmp'), createdAt: new Date().toISOString() };
    Object.assign(target, {
      kind,
      name,
      employees: Number.isFinite(employees) && employees > 0 ? Math.round(employees) : null,
      industry: canonicalIndustry(val(data, 'industry')),
      website: val(data, 'website'),
      notes: String(data.get('notes') || ''),
      attributes,
    });
    if (!org) db.orgs.push(target);
    commit();
    toast(org ? `${ORG_KINDS[kind].label} updated.` : `${ORG_KINDS[kind].label} added.`);
    return true;
  }, { wide: true, submitLabel: org ? 'Save changes' : 'Add organization' });
}

function editAttributeModal(id) {
  const attr = id ? attributeById(id) : null;
  const d = attr || { label: '', multi: false, options: [] };
  const body = `
    <div class="form-grid">
      ${field('Attribute name *', input('label', d.label, 'required placeholder="Tech modernity"'))}
      ${field('Selection', select('multi', [['single', 'Single value'], ['multi', 'Multiple values']], d.multi ? 'multi' : 'single'))}
    </div>
    ${field('Options (one per line)', textarea('options', d.options.join('\n'), 6))}
    <p class="form-hint">Options are suggestions for organization forms and fit preferences. Add or remove them anytime — this stays flexible.</p>`;

  openModal(attr ? 'Edit attribute' : 'New attribute', body, data => {
    const label = val(data, 'label');
    if (!label) { toast('An attribute name is required.', 'error'); return false; }
    const options = [...new Set(String(data.get('options') || '')
      .split(/[\n,]+/)
      .map(v => v.trim())
      .filter(Boolean))];
    const multi = data.get('multi') === 'multi';
    const target = attr || { id: uid('atr') };
    Object.assign(target, { label, multi, options });
    if (!attr) {
      db.settings.attributes.push(target);
      db.settings.fit.dimensions[fitKeyForAttribute(target.id)] = {
        weight: 0, required: false, values: [], avoid: [],
      };
    } else if (!multi) {
      // Single-select attributes can only keep one value per organization.
      db.orgs.forEach(o => {
        const values = orgAttrValues(o, target.id);
        if (values.length > 1) o.attributes[target.id] = values.slice(0, 1);
      });
    }
    commit();
    toast(attr ? 'Attribute updated.' : 'Attribute added.');
    return true;
  }, { submitLabel: attr ? 'Save changes' : 'Add attribute' });
}

function activityModal() {
  if (!db.prospects.length) {
    toast('Add a prospect before logging activity.', 'error');
    return;
  }
  const options = db.prospects.slice().sort((a, b) => prospectOrgName(a).localeCompare(prospectOrgName(b)))
    .map(p => [p.id, `${prospectOrgName(p)} — ${p.title}`]);
  const body = `
    <div class="form-grid">
      ${field('Prospect *', select('prospectId', options, UI.drawer || options[0][0]))}
      ${field('Type', select('type', Object.entries(ACTIVITY_TYPES).filter(([k]) => k !== 'status' && k !== 'added'), 'note'))}
      ${field('Date', dateInput('date', todayISO()))}
    </div>
    ${field('Note', textarea('note', '', 3))}`;

  openModal('Log activity', body, data => {
    const prospectId = data.get('prospectId');
    if (!prospectId) { toast('Choose a prospect.', 'error'); return false; }
    logActivity(prospectId, data.get('type') || 'note', val(data, 'date') || todayISO(), String(data.get('note') || ''));
    commit();
    toast('Activity logged.');
    return true;
  }, { submitLabel: 'Log activity' });
}
