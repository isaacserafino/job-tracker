'use strict';

/* ------------------------------------------------------------------ *
 *  Commit + feedback
 * ------------------------------------------------------------------ */
function commit() {
  saveDB();
  render();
  if (UI.drawer) {
    if (prospectById(UI.drawer)) refreshDrawer();
    else closeDrawer();
  }
}

function toast(message, tone = 'success') {
  const root = $('#toastRoot');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast ${tone}`;
  el.textContent = message;
  root.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 220);
  }, 2500);
}

/* ------------------------------------------------------------------ *
 *  Mutations
 * ------------------------------------------------------------------ */
function setProspectStatus(id, status) {
  const p = prospectById(id);
  if (!p || p.status === status) return;
  p.status = status;
  p.statusChangedAt = todayISO();
  p.snoozedUntil = null;
  if (status === 'applied' && !p.appliedAt) p.appliedAt = todayISO();
  if (['declined', 'canceled'].includes(status)) {
    p.nextFollowUp = null;
  } else if (!p.nextFollowUp && ['applied', 'interviewing', 'offered'].includes(status)) {
    p.nextFollowUp = addDays(todayISO(), status === 'offered' ? 2 : status === 'interviewing' ? 3 : 7);
  }
  logActivity(p.id, STATUS_ACTIVITY[status] || 'note', todayISO(), `Status changed to ${STATUS[status].label}`);
  commit();
  toast(`${prospectOrgName(p)} → ${STATUS[status].label}`);
}

function snoozeProspect(id, days) {
  const p = prospectById(id);
  if (!p) return;
  p.snoozedUntil = addDays(todayISO(), Number(days) || 3);
  commit();
  toast(`Snoozed until ${fmt(p.snoozedUntil)}.`);
}

function markSourceChecked(id) {
  const s = sourceById(id);
  if (!s) return;
  s.lastChecked = todayISO();
  commit();
  toast(`${s.name} marked as checked.`);
}

function markMaterialUpdated(id) {
  const m = materialById(id);
  if (!m) return;
  m.lastUpdated = todayISO();
  commit();
  toast(`${m.name} marked as refreshed.`);
}

/* ------------------------------------------------------------------ *
 *  Data actions
 * ------------------------------------------------------------------ */
function exportData() {
  const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `job-tracker-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  toast('Data exported.');
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const raw = JSON.parse(String(reader.result));
      if (!raw || !Array.isArray(raw.prospects)) throw new Error('That file is not a Job Tracker export.');
      if (!confirm('Replace your current data with this import? This cannot be undone.')) return;
      db = normalizeDB(raw);
      db.meta.sample = false;
      saveDB();
      closeDrawer();
      closeModal();
      render();
      toast('Data imported.');
    } catch (err) {
      toast(`Import failed: ${err.message}`, 'error');
    }
  };
  reader.readAsText(file);
}

function clearSampleData() {
  if (!confirm('Clear the sample data? This removes all sample prospects, sources, materials, and activity.')) return;
  db = emptyDB();
  saveDB();
  closeDrawer();
  closeModal();
  render();
  toast('Sample data cleared — ready for your search.');
}

function loadSampleData() {
  if (db.prospects.length || db.sources.length || db.materials.length) {
    if (!confirm('Replace your current data with the sample dataset?')) return;
  }
  db = seedData();
  saveDB();
  closeDrawer();
  closeModal();
  render();
  toast('Sample data loaded.');
}

function resetData() {
  if (!confirm('Delete all prospects, sources, materials, and activity? Export first if you want a backup. This cannot be undone.')) return;
  db = emptyDB();
  saveDB();
  closeDrawer();
  closeModal();
  render();
  toast('All data cleared.');
}

/* ------------------------------------------------------------------ *
 *  Theme
 * ------------------------------------------------------------------ */
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  try { localStorage.setItem(THEME_KEY, theme); } catch (err) { /* ignore */ }
  const btn = $('#themeBtn');
  if (btn) btn.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
}
function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem(THEME_KEY); } catch (err) { /* ignore */ }
  const prefers = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(saved || (prefers ? 'dark' : 'light'));
}
function toggleTheme() {
  applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
}

/* ------------------------------------------------------------------ *
 *  Actions
 * ------------------------------------------------------------------ */
function preferAppliedSort(status) {
  if (status === 'applied' && UI.prospect.sort === 'activity') {
    UI.prospect.sort = 'applied';
  }
}

function handleAction(action, el, event) {
  const id = el.dataset.id;
  const ds = el.dataset;

  switch (action) {
    case 'nav':
      UI.view = ds.view;
      closeDrawer();
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      break;
    case 'open-prospect':
      openProspect(id);
      break;
    case 'close-drawer':
      closeDrawer();
      break;
    case 'close-modal':
      closeModal();
      break;

    case 'add-prospect':
      editProspectModal(null);
      break;
    case 'edit-prospect':
      editProspectModal(id);
      break;
    case 'delete-prospect': {
      const p = prospectById(id);
      if (!p) return;
      if (!confirm(`Delete ${prospectOrgName(p)} — ${p.title} and all of its activity?`)) return;
      if (UI.drawer === id) closeDrawer();
      deleteProspectCascade(id);
      commit();
      toast('Prospect deleted.');
      break;
    }
    case 'add-org':
      editOrgModal(null);
      break;
    case 'edit-org':
      editOrgModal(id);
      break;
    case 'delete-org': {
      const org = orgById(id);
      if (!org) return;
      const linked = orgProspects(id);
      if (!confirm(`Delete ${org.name}?${linked.length ? ` ${linked.length} prospect(s) will keep their record but lose this ${org.kind}.` : ''}`)) return;
      db.prospects.forEach(p => {
        if (p.companyId === id) p.companyId = null;
        if (p.agencyId === id) p.agencyId = null;
      });
      db.orgs = db.orgs.filter(o => o.id !== id);
      commit();
      toast(`${ORG_KINDS[org.kind].label} deleted.`);
      break;
    }
    case 'org-prospects': {
      const org = orgById(id);
      if (!org) return;
      UI.view = 'prospects';
      UI.q = '';
      UI.prospect.company = org.kind === 'company' ? id : 'all';
      UI.prospect.agency = org.kind === 'agency' ? id : 'all';
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      break;
    }
    case 'org-kind':
      UI.org.kind = ds.kind;
      render();
      break;
    case 'clear-org-filters':
      UI.org = { kind: 'all', q: '' };
      render();
      break;
    case 'add-attribute':
      editAttributeModal(null);
      break;
    case 'edit-attribute':
      editAttributeModal(id);
      break;
    case 'delete-attribute': {
      const attr = attributeById(id);
      if (!attr) return;
      if (!confirm(`Delete the “${attr.label}” attribute? It will be removed from every organization and fit preference.`)) return;
      db.settings.attributes = db.settings.attributes.filter(a => a.id !== id);
      delete db.settings.fit.dimensions[fitKeyForAttribute(id)];
      db.orgs.forEach(o => { if (o.attributes) delete o.attributes[id]; });
      commit();
      toast('Attribute deleted.');
      break;
    }
    case 'toggle-fit-value': {
      const dim = ds.dim;
      const cfg = db.settings.fit.dimensions[dim];
      if (!cfg) return;
      const list = ds.mode === 'avoid' ? cfg.avoid : cfg.values;
      const other = ds.mode === 'avoid' ? cfg.values : cfg.avoid;
      const at = list.findIndex(v => fitValueMatches(dim, v, ds.value));
      if (at >= 0) list.splice(at, 1);
      else {
        list.push(ds.value);
        const otherAt = other.findIndex(v => fitValueMatches(dim, v, ds.value));
        if (otherAt >= 0) other.splice(otherAt, 1);
      }
      commit();
      break;
    }
    case 'reset-fit':
      if (!confirm('Reset every fit dimension to weight 0 with no preferred or avoided values?')) return;
      db.settings.fit = defaultFitSettings();
      commit();
      toast('Fit preferences reset.');
      break;
    case 'set-status':
      setProspectStatus(id, ds.status);
      break;
    case 'snooze':
      snoozeProspect(id, ds.days);
      break;
    case 'unsnooze': {
      const p = prospectById(id);
      if (!p) return;
      p.snoozedUntil = null;
      commit();
      toast('Prospect is back in the queue.');
      break;
    }

    case 'add-source':
      editSourceModal(null);
      break;
    case 'edit-source':
      editSourceModal(id);
      break;
    case 'delete-source': {
      const s = sourceById(id);
      if (!s) return;
      const count = db.prospects.filter(p => p.sourceId === id).length;
      if (!confirm(`Delete ${s.name}?${count ? ` ${count} prospect(s) will keep their record but lose this source.` : ''}`)) return;
      db.prospects.forEach(p => { if (p.sourceId === id) p.sourceId = null; });
      db.sources = db.sources.filter(x => x.id !== id);
      commit();
      toast('Source deleted.');
      break;
    }
    case 'mark-source-checked':
      markSourceChecked(id);
      break;

    case 'add-material':
      editMaterialModal(null);
      break;
    case 'edit-material':
      editMaterialModal(id);
      break;
    case 'duplicate-material':
      duplicateMaterialModal(id);
      break;
    case 'delete-material': {
      const m = materialById(id);
      if (!m) return;
      if (!confirm(`Delete “${m.name}”? It will be unlinked from any prospects.`)) return;
      db.materials = db.materials.filter(x => x.id !== id);
      db.prospects.forEach(p => { p.materialIds = p.materialIds.filter(mid => mid !== id); });
      commit();
      toast('Material deleted.');
      break;
    }
    case 'mark-material-updated':
      markMaterialUpdated(id);
      break;
    case 'link-material': {
      const p = prospectById(ds.prospect);
      if (!p) return;
      if (!p.materialIds.includes(id)) p.materialIds.push(id);
      commit();
      toast('Material linked.');
      break;
    }
    case 'unlink-material': {
      const p = prospectById(ds.prospect);
      if (!p) return;
      p.materialIds = p.materialIds.filter(mid => mid !== id);
      commit();
      toast('Material unlinked.');
      break;
    }

    case 'add-activity':
      activityModal();
      break;
    case 'delete-activity': {
      const a = db.activities.find(x => x.id === id);
      if (!a) return;
      if (!confirm('Delete this activity entry?')) return;
      db.activities = db.activities.filter(x => x.id !== id);
      const p = prospectById(a.prospectId);
      if (p) recomputeLastActivity(p);
      commit();
      toast('Activity deleted.');
      break;
    }

    case 'filter-status':
      UI.view = 'prospects';
      UI.q = '';
      UI.prospect.status = ds.status;
      preferAppliedSort(ds.status);
      closeDrawer();
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      break;
    case 'stat-jump': {
      UI.view = ds.view || 'prospects';
      if (UI.view === 'prospects') {
        UI.q = '';
        UI.prospect.status = STATUS[ds.filter] ? ds.filter : 'all';
        preferAppliedSort(UI.prospect.status);
      }
      closeDrawer();
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      break;
    }
    case 'prospect-status':
      UI.prospect.status = ds.status;
      UI.q = '';
      preferAppliedSort(ds.status);
      render();
      break;
    case 'clear-prospect-filters':
      UI.q = '';
      UI.prospect = {
        status: 'all', mode: 'all', source: 'all',
        company: 'all', agency: 'all', level: 'all', category: 'all',
        size: 'all', industry: 'all', fit: 'all', attrs: {}, sort: 'activity',
      };
      render();
      break;
    case 'material-type':
      UI.material.type = ds.type;
      render();
      break;
    case 'toggle-stale':
      UI.material.stale = !UI.material.stale;
      render();
      break;

    case 'toggle-theme':
      toggleTheme();
      break;
    case 'export':
      exportData();
      break;
    case 'import':
      $('#importFile').click();
      break;
    case 'clear-sample':
      clearSampleData();
      break;
    case 'load-sample':
      loadSampleData();
      break;
    case 'reset-data':
      resetData();
      break;

    default:
      console.warn('Unknown action', action);
  }
}

/* ------------------------------------------------------------------ *
 *  Events
 * ------------------------------------------------------------------ */
function bindEvents() {
  document.addEventListener('click', event => {
    const actionEl = event.target.closest('[data-action]');
    if (actionEl) {
      event.preventDefault();
      handleAction(actionEl.dataset.action, actionEl, event);
      return;
    }
    const row = event.target.closest('tr[data-row-prospect]');
    if (row && !event.target.closest('button, a, select, input, label')) {
      openProspect(row.dataset.rowProspect);
    }
  });

  document.addEventListener('change', event => {
    const statusSelect = event.target.closest('[data-status-for]');
    if (statusSelect) {
      setProspectStatus(statusSelect.dataset.statusFor, statusSelect.value);
      return;
    }
    const prospectFilter = event.target.closest('[data-prospect-filter]');
    if (prospectFilter) {
      UI.prospect[prospectFilter.dataset.prospectFilter] = prospectFilter.value;
      render();
      return;
    }
    const attrFilter = event.target.closest('[data-attr-filter]');
    if (attrFilter) {
      const attrId = attrFilter.dataset.attrFilter;
      UI.prospect.attrs = UI.prospect.attrs || {};
      if (attrFilter.value === 'all') delete UI.prospect.attrs[attrId];
      else UI.prospect.attrs[attrId] = attrFilter.value;
      render();
      return;
    }
    const weightInput = event.target.closest('[data-fit-weight]');
    if (weightInput) {
      const cfg = db.settings.fit.dimensions[weightInput.dataset.dim];
      if (cfg) cfg.weight = clamp(Math.round(Number(weightInput.value) || 0), 0, 5);
      commit();
      return;
    }
    const requiredInput = event.target.closest('[data-fit-required]');
    if (requiredInput) {
      const cfg = db.settings.fit.dimensions[requiredInput.dataset.dim];
      if (cfg) cfg.required = requiredInput.checked;
      commit();
      return;
    }
    const activityFilter = event.target.closest('[data-activity-filter]');
    if (activityFilter) {
      UI.activity[activityFilter.dataset.activityFilter] = activityFilter.value;
      render();
    }
  });

  document.addEventListener('input', event => {
    if (event.target.id === 'prospectSearch') {
      UI.q = event.target.value;
      const results = $('#prospectResults');
      if (results) results.innerHTML = prospectResultsHtml();
      return;
    }
    if (event.target.id === 'orgSearch') {
      UI.org.q = event.target.value;
      const results = $('#orgResults');
      if (results) results.innerHTML = orgResultsHtml();
      return;
    }
    const weightInput = event.target.closest('[data-fit-weight]');
    if (weightInput) {
      const output = document.querySelector(`[data-weight-for="${CSS.escape(weightInput.dataset.dim)}"]`);
      if (output) output.textContent = weightInput.value;
    }
  });

  document.addEventListener('submit', event => {
    if (event.target.id === 'activityForm') {
      event.preventDefault();
      const form = event.target;
      const data = new FormData(form);
      logActivity(form.dataset.prospect, data.get('type') || 'note', data.get('date') || todayISO(), String(data.get('note') || ''));
      commit();
      toast('Activity logged.');
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if ($('#modalRoot').innerHTML) closeModal();
    else if (UI.drawer) closeDrawer();
  });

  const importFile = $('#importFile');
  if (importFile) {
    importFile.addEventListener('change', event => {
      const file = event.target.files && event.target.files[0];
      if (file) importData(file);
      event.target.value = '';
    });
  }
}

/* ------------------------------------------------------------------ *
 *  Boot
 * ------------------------------------------------------------------ */
function init() {
  initTheme();
  db = loadDB();
  bindEvents();
  render();
}

init();
