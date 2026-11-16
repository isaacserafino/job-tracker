'use strict';

/* ------------------------------------------------------------------ *
 *  Constants
 * ------------------------------------------------------------------ */
const STORE_KEY = 'jobtracker.v1';
const THEME_KEY = 'jobtracker.theme';
const DAY = 86400000;

const STATUS = {
  prospect:     { label: 'Prospect',     tone: 'slate',  order: 0 },
  applied:      { label: 'Applied',      tone: 'blue',   order: 1 },
  interviewing: { label: 'Interviewing', tone: 'violet', order: 2 },
  offered:      { label: 'Offered',      tone: 'green',  order: 3 },
  declined:     { label: 'Declined',     tone: 'red',    order: 4 },
  canceled:     { label: 'Canceled',     tone: 'stone',  order: 5 },
};
const STATUS_KEYS = Object.keys(STATUS);
const ACTIVE_STATUSES = ['prospect', 'applied', 'interviewing', 'offered'];

const WORK_MODES = {
  remote:      { label: 'Remote',    tone: 'green' },
  hybrid:      { label: 'Hybrid',    tone: 'amber' },
  onsite:      { label: 'In office', tone: 'blue'  },
  unspecified: { label: 'Not set',   tone: 'slate' },
};

const SOURCE_KINDS = ['Job board', 'Agency / recruiter', 'Company site', 'Referral / network', 'Community', 'Other'];

const ORG_KINDS = {
  company: { label: 'Company', plural: 'Companies' },
  agency:  { label: 'Agency',  plural: 'Agencies'  },
};

const SIZE_BANDS = [
  { key: 'small',      label: 'Small',      range: 'fewer than 50 employees',   max: 49 },
  { key: 'mid',        label: 'Mid-size',   range: '50–249 employees',          min: 50,  max: 249 },
  { key: 'large',      label: 'Large',      range: '250–999 employees',         min: 250, max: 999 },
  { key: 'enterprise', label: 'Enterprise', range: '1,000+ employees',          min: 1000 },
];
const SIZE_BAND_BY_KEY = Object.fromEntries(SIZE_BANDS.map(b => [b.key, b]));

const JOB_LEVELS = [
  'Junior', 'Mid', 'Senior', 'Staff', 'Lead', 'Principal', 'Architect',
  'Manager', 'Director', 'VP', 'Executive',
];
const JOB_CATEGORIES = [
  'Engineering', 'Design', 'Product', 'Data & analytics', 'Research',
  'Marketing', 'Sales', 'Operations', 'Finance', 'People', 'Other',
];

const COMMON_INDUSTRIES = [
  'Technology', 'Financial services', 'Healthcare', 'Retail', 'Manufacturing',
  'Education', 'Media', 'Consulting', 'Staffing', 'Logistics',
  'Food & beverage', 'Defense', 'Conglomerate', 'Other',
];

const FIT_DIMENSIONS = [
  { key: 'size',     label: 'Company size',  hint: 'Headcount band of the employer — the company, or the agency when no company is known.' },
  { key: 'industry', label: 'Industry',      hint: 'Industry of the employer.' },
  { key: 'level',    label: 'Job level',     hint: 'Rough seniority or scope of the role.' },
  { key: 'category', label: 'Job category',  hint: 'The function or track the role sits in.' },
  { key: 'mode',     label: 'Work mode',     hint: 'Remote, hybrid, or in-office.' },
];

const MATERIAL_TYPES = {
  resume: { label: 'Resume',       short: 'RES'  },
  cover:  { label: 'Cover letter', short: 'CL'   },
  notes:  { label: 'Notes',        short: 'NOTE' },
};

const ACTIVITY_TYPES = {
  added:      'Added',
  applied:    'Applied',
  follow_up:  'Follow-up',
  interview:  'Interview',
  offer:      'Offer',
  declined:   'Declined',
  canceled:   'Canceled',
  placement:  'Placement',
  note:       'Note',
  status:     'Status change',
};

const STATUS_ACTIVITY = {
  prospect: 'note',
  applied: 'applied',
  interviewing: 'interview',
  offered: 'offer',
  declined: 'declined',
  canceled: 'canceled',
};

/* ------------------------------------------------------------------ *
 *  Small utilities
 * ------------------------------------------------------------------ */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const pad = n => String(n).padStart(2, '0');
const uid = prefix => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

function toISO(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function todayISO() {
  return toISO(new Date());
}
function parseISO(s) {
  if (!s) return null;
  const [y, m, d] = String(s).split('-').map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  return isNaN(dt.getTime()) ? null : dt;
}
function addDays(iso, n) {
  const d = parseISO(iso) || new Date();
  d.setDate(d.getDate() + n);
  return toISO(d);
}
function daysAgoISO(n) { return addDays(todayISO(), -n); }
function daysFromNowISO(n) { return addDays(todayISO(), n); }
function daysSince(iso) {
  const d = parseISO(iso);
  if (!d) return null;
  const t = parseISO(todayISO());
  return Math.round((t - d) / DAY);
}
function fmt(iso, opts = {}) {
  const d = parseISO(iso);
  if (!d) return '—';
  return d.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', ...(opts.year ? { year: 'numeric' } : {}),
  });
}
function fmtFull(iso) {
  const d = parseISO(iso);
  if (!d) return '—';
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}
function rel(iso) {
  const n = daysSince(iso);
  if (n === null) return '—';
  if (n === 0) return 'today';
  if (n === 1) return 'yesterday';
  if (n < 0) return `in ${-n}d`;
  if (n < 14) return `${n}d ago`;
  if (n < 60) return `${Math.floor(n / 7)}w ago`;
  if (n < 365) return `${Math.round(n / 30)}mo ago`;
  return `${Math.round(n / 365)}y ago`;
}
function dueLabel(iso) {
  if (!iso) return '—';
  const n = daysSince(iso);
  if (n === 0) return 'Due today';
  if (n > 0) return `${n}d overdue`;
  return `in ${-n}d`;
}
function dueTone(iso) {
  if (!iso) return '';
  const n = daysSince(iso);
  if (n > 0) return 'due-late';
  if (n === 0) return 'due-today';
  return 'due-soon';
}
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }
function plural(n, singular, pluralForm) { return `${n} ${n === 1 ? singular : (pluralForm || singular + 's')}`; }

/* ------------------------------------------------------------------ *
 *  Persistence
 * ------------------------------------------------------------------ */
let db = null;

function fitKeyForAttribute(id) { return `attr:${id}`; }

function normalizeAttributes(raw) {
  const list = Array.isArray(raw) ? raw : [];
  const out = [];
  const seen = new Set();
  list.forEach(item => {
    if (!item || typeof item !== 'object') return;
    let id = String(item.id || '').trim() || uid('atr');
    if (seen.has(id)) id = uid('atr');
    const label = String(item.label || item.name || '').trim();
    if (!label) return;
    const options = [...new Set((Array.isArray(item.options) ? item.options : [])
      .map(v => String(v ?? '').trim())
      .filter(Boolean))];
    out.push({ id, label, multi: !!item.multi, options });
    seen.add(id);
  });
  return out;
}

function normalizeAttributeValues(raw, attributes) {
  const out = {};
  const byId = new Map(attributes.map(a => [a.id, a]));
  const source = raw && typeof raw === 'object' ? raw : {};
  const entries = Array.isArray(source)
    ? source.map(item => [item?.attrId ?? item?.id, item?.values ?? item?.value])
    : Object.entries(source);
  entries.forEach(([attrId, rawValues]) => {
    const attr = byId.get(String(attrId || ''));
    if (!attr) return;
    const list = [...new Set((Array.isArray(rawValues) ? rawValues : [rawValues])
      .map(v => String(v ?? '').trim())
      .filter(Boolean))]
      .map(v => attr.options.find(o => fitValueMatches('', o, v)) || v);
    if (!list.length) return;
    out[attr.id] = attr.multi ? list : list.slice(0, 1);
  });
  return out;
}

function defaultFitSettings() {
  const dimensions = {};
  FIT_DIMENSIONS.forEach(dim => {
    dimensions[dim.key] = { weight: 0, required: false, values: [], avoid: [] };
  });
  return { dimensions };
}

function normalizeFitConfig(raw) {
  const values = Array.isArray(raw?.values) ? raw.values : [];
  const avoid = Array.isArray(raw?.avoid) ? raw.avoid : [];
  return {
    weight: clamp(Math.round(Number(raw?.weight) || 0), 0, 5),
    required: !!raw?.required,
    values: [...new Set(values.filter(v => typeof v === 'string' && v.trim()).map(v => v.trim()))],
    avoid: [...new Set(avoid.filter(v => typeof v === 'string' && v.trim()).map(v => v.trim()))],
  };
}

function normalizeFitSettings(raw, attributes) {
  const out = defaultFitSettings();
  const dims = raw && typeof raw === 'object' && raw.dimensions ? raw.dimensions : {};
  const keys = [
    ...FIT_DIMENSIONS.map(dim => dim.key),
    ...(attributes || []).map(attr => fitKeyForAttribute(attr.id)),
  ];
  keys.forEach(key => {
    out.dimensions[key] = normalizeFitConfig(dims[key]);
  });
  return out;
}

function defaultSettings() {
  return { materialStaleDays: 60, attributes: [], fit: defaultFitSettings() };
}

function emptyDB() {
  return {
    version: 2,
    settings: defaultSettings(),
    orgs: [],
    sources: [],
    prospects: [],
    materials: [],
    activities: [],
    meta: { sample: false },
  };
}

function normalizeDB(raw) {
  const base = emptyDB();
  if (!raw || typeof raw !== 'object') return base;
  const out = {
    version: 2,
    settings: { ...base.settings, ...(raw.settings || {}) },
    orgs: [],
    sources: Array.isArray(raw.sources) ? raw.sources : [],
    prospects: [],
    materials: Array.isArray(raw.materials) ? raw.materials : [],
    activities: Array.isArray(raw.activities) ? raw.activities : [],
    meta: { sample: false, ...(raw.meta || {}) },
  };
  out.settings.attributes = normalizeAttributes(out.settings.attributes);
  out.settings.fit = normalizeFitSettings(out.settings.fit, out.settings.attributes);

  // Companies and agencies are first-class organizations. Older exports stored
  // a company string and a nested agency object; migrate those into org records.
  const orgs = [];
  const byKey = new Map();
  const byId = new Map();
  const addOrg = rawOrg => {
    if (!rawOrg || typeof rawOrg !== 'object') return null;
    const kind = rawOrg.kind === 'agency' ? 'agency' : 'company';
    const name = String(rawOrg.name || '').trim();
    if (!name) return null;
    const key = `${kind}::${name.toLowerCase()}`;
    if (byKey.has(key)) return byKey.get(key);
    const employeesNum = Number(rawOrg.employees);
    let id = rawOrg.id || uid(kind === 'agency' ? 'agy' : 'cmp');
    if (byId.has(id)) id = uid(kind === 'agency' ? 'agy' : 'cmp');
    const org = {
      id,
      kind,
      name,
      employees: Number.isFinite(employeesNum) && employeesNum > 0 ? Math.round(employeesNum) : null,
      industry: String(rawOrg.industry || '').trim(),
      website: String(rawOrg.website || '').trim(),
      notes: String(rawOrg.notes || ''),
      attributes: normalizeAttributeValues(rawOrg.attributes, out.settings.attributes),
      createdAt: rawOrg.createdAt || new Date().toISOString(),
    };
    orgs.push(org);
    byKey.set(key, org);
    byId.set(id, org);
    return org;
  };

  (Array.isArray(raw.orgs) ? raw.orgs : []).forEach(addOrg);
  (Array.isArray(raw.companies) ? raw.companies : []).forEach(o => addOrg({ ...o, kind: 'company' }));
  (Array.isArray(raw.agencies) ? raw.agencies : []).forEach(o => addOrg({ ...o, kind: 'agency' }));

  const findOrg = (id, kind) => {
    if (!id) return null;
    const org = byId.get(id);
    return org && org.kind === kind ? org : null;
  };

  out.prospects = (Array.isArray(raw.prospects) ? raw.prospects : []).map(p => {
    let company = findOrg(p.companyId, 'company');
    if (!company && p.company) {
      company = addOrg({
        name: p.company,
        kind: 'company',
        employees: p.companyEmployees,
        industry: p.companyIndustry,
      });
    }
    let agency = findOrg(p.agencyId, 'agency');
    if (!agency && p.agency && typeof p.agency === 'object' && p.agency.name) {
      agency = addOrg({ name: p.agency.name, kind: 'agency' });
    }
    if (!company && !agency) company = addOrg({ name: p.company || 'Unknown company', kind: 'company' });

    return {
      id: p.id || uid('prs'),
      companyId: company ? company.id : null,
      agencyId: agency ? agency.id : null,
      title: p.title || '',
      level: String(p.level || '').trim(),
      category: String(p.category || '').trim(),
      sourceId: p.sourceId || null,
      status: STATUS[p.status] ? p.status : 'prospect',
      workMode: WORK_MODES[p.workMode] ? p.workMode : 'unspecified',
      location: p.location || '',
      salary: p.salary || '',
      url: p.url || '',
      addedAt: p.addedAt || todayISO(),
      appliedAt: p.appliedAt || null,
      statusChangedAt: p.statusChangedAt || null,
      lastActivityAt: p.lastActivityAt || p.appliedAt || p.addedAt,
      nextFollowUp: p.nextFollowUp || null,
      snoozedUntil: p.snoozedUntil || null,
      materialIds: Array.isArray(p.materialIds) ? p.materialIds : [],
      notes: p.notes || '',
      createdAt: p.createdAt || new Date().toISOString(),
    };
  });
  out.orgs = orgs;
  out.materials = out.materials.map(m => ({
    id: m.id || uid('mat'),
    name: m.name || 'Untitled material',
    type: MATERIAL_TYPES[m.type] ? m.type : 'notes',
    target: ['general', 'title', 'prospect'].includes(m.target) ? m.target : 'general',
    targetTitle: m.targetTitle || '',
    targetProspectId: m.targetProspectId || null,
    lastUpdated: m.lastUpdated || todayISO(),
    link: m.link || '',
    notes: m.notes || '',
    createdAt: m.createdAt || new Date().toISOString(),
  }));
  out.sources = out.sources.map(s => ({
    id: s.id || uid('src'),
    name: s.name || 'Untitled source',
    kind: SOURCE_KINDS.includes(s.kind) ? s.kind : 'Other',
    url: s.url || '',
    cadenceDays: Math.max(1, Number(s.cadenceDays) || 7),
    lastChecked: s.lastChecked || null,
    notes: s.notes || '',
    active: s.active !== false,
    createdAt: s.createdAt || new Date().toISOString(),
  }));
  out.activities = out.activities
    .filter(a => a && a.prospectId && out.prospects.some(p => p.id === a.prospectId))
    .map(a => ({
      id: a.id || uid('act'),
      prospectId: a.prospectId,
      type: ACTIVITY_TYPES[a.type] ? a.type : 'note',
      date: a.date || todayISO(),
      note: a.note || '',
      createdAt: a.createdAt || new Date().toISOString(),
    }));
  return out;
}

function loadDB() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const normalized = normalizeDB(JSON.parse(raw));
      // Persist the migrated shape so organization IDs stay stable across loads.
      try { localStorage.setItem(STORE_KEY, JSON.stringify(normalized)); } catch (err) { /* ignore */ }
      return normalized;
    }
  } catch (err) {
    console.warn('Could not read saved data', err);
  }
  const seeded = seedData();
  try { localStorage.setItem(STORE_KEY, JSON.stringify(seeded)); } catch (err) { console.warn(err); }
  return seeded;
}

function saveDB() {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(db));
  } catch (err) {
    console.warn('Could not save data', err);
    toast('Could not save — browser storage may be full.', 'error');
  }
}

/* ------------------------------------------------------------------ *
 *  Derived data
 * ------------------------------------------------------------------ */
function prospectById(id) { return db.prospects.find(p => p.id === id) || null; }
function sourceById(id) { return db.sources.find(s => s.id === id) || null; }
function materialById(id) { return db.materials.find(m => m.id === id) || null; }
function orgById(id) { return db.orgs.find(o => o.id === id) || null; }

function sourceName(id) {
  const s = sourceById(id);
  return s ? s.name : 'No source';
}
function isActiveProspect(p) { return ACTIVE_STATUSES.includes(p.status); }

function prospectsUsingMaterial(m) {
  return db.prospects.filter(p =>
    p.materialIds.includes(m.id) ||
    (m.target === 'title' && m.targetTitle && p.title.toLowerCase().includes(m.targetTitle.toLowerCase()))
  );
}

function companyOrg(p) { return orgById(p?.companyId); }
function agencyOrg(p) { return orgById(p?.agencyId); }
function employerOrg(p) { return companyOrg(p) || agencyOrg(p); }

function prospectOrgName(p) {
  const org = employerOrg(p);
  return org ? org.name : 'Unknown company';
}
function prospectOrgLabel(p) {
  const company = companyOrg(p);
  const agency = agencyOrg(p);
  if (company && agency) return `${company.name} · via ${agency.name}`;
  if (company) return company.name;
  if (agency) return `${agency.name} (agency)`;
  return 'Unknown company';
}
function orgProspects(orgId) {
  return db.prospects.filter(p => p.companyId === orgId || p.agencyId === orgId);
}

function sizeBand(employees) {
  const n = Number(employees);
  if (!Number.isFinite(n) || n <= 0) return 'unknown';
  if (n < 50) return 'small';
  if (n < 250) return 'mid';
  if (n < 1000) return 'large';
  return 'enterprise';
}
function sizeBandLabel(key) {
  return SIZE_BAND_BY_KEY[key]?.label || 'Size not set';
}
function knownIndustries() {
  const seen = new Map();
  [...COMMON_INDUSTRIES, ...db.orgs.map(o => o.industry)].forEach(value => {
    const text = String(value || '').trim();
    if (text) seen.set(text.toLowerCase(), text);
  });
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}
function canonicalIndustry(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return knownIndustries().find(x => x.toLowerCase() === text.toLowerCase()) || text;
}
function attributeById(id) {
  return (db?.settings?.attributes || []).find(a => a.id === id) || null;
}
function attributeChoices(attr) {
  if (!attr) return [];
  const seen = new Map();
  [...attr.options, ...db.orgs.flatMap(o => orgAttrValues(o, attr.id))].forEach(value => {
    const text = String(value || '').trim();
    if (text && !seen.has(text.toLowerCase())) seen.set(text.toLowerCase(), text);
  });
  return [...seen.values()];
}
function orgAttrValues(org, attrId) {
  const raw = org?.attributes?.[attrId];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  return raw ? [raw] : [];
}
function orgAttributeSummary(org) {
  if (!org) return '';
  const bits = [];
  const band = sizeBand(org.employees);
  if (band !== 'unknown') bits.push(sizeBandLabel(band));
  if (org.employees) bits.push(`${org.employees.toLocaleString()} employees`);
  if (org.industry) bits.push(org.industry);
  return bits.join(' · ') || 'No size or industry set';
}
function orgStats(orgId) {
  const list = orgProspects(orgId);
  const scored = list.map(fitScore).filter(f => f.configured && !f.blocked);
  return {
    total: list.length,
    active: list.filter(isActiveProspect).length,
    applied: list.filter(p => !!p.appliedAt).length,
    interviews: list.filter(p => ['interviewing', 'offered'].includes(p.status)).length,
    avgFit: scored.length ? Math.round(scored.reduce((sum, f) => sum + f.score, 0) / scored.length) : null,
  };
}

/* ------------------------------------------------------------------ *
 *  Fit scoring
 * ------------------------------------------------------------------ */
function fitActualValue(p, key) {
  if (key === 'size') return sizeBand(employerOrg(p)?.employees);
  if (key === 'industry') return employerOrg(p)?.industry || '';
  if (key === 'level') return p.level || '';
  if (key === 'category') return p.category || '';
  if (key === 'mode') return WORK_MODES[p.workMode] ? p.workMode : 'unspecified';
  return '';
}
function fitDimensions() {
  const attrs = db?.settings?.attributes || [];
  return [
    ...FIT_DIMENSIONS,
    ...attrs.map(attr => ({
      key: fitKeyForAttribute(attr.id),
      label: attr.label,
      hint: `Organization attribute${attr.multi ? ' (multi-select)' : ''}. Edit its values in Preferences.`,
      attribute: attr,
    })),
  ];
}
function fitActualValues(p, key) {
  if (key.startsWith('attr:')) {
    const org = employerOrg(p);
    return org ? orgAttrValues(org, key.slice(5)) : [];
  }
  const value = fitActualValue(p, key);
  return value ? [value] : [];
}
function fitValueLabel(key, value) {
  if (key === 'size') return value === 'unknown' ? 'Unknown / not set' : sizeBandLabel(value);
  if (key === 'mode') return WORK_MODES[value]?.label || 'Not set';
  return value || 'Not set';
}
function fitValueMatches(key, actual, expected) {
  return String(actual ?? '').trim().toLowerCase() === String(expected ?? '').trim().toLowerCase();
}
function fitDimensionActive(cfg) {
  if (!cfg) return false;
  const hasChoices = (cfg.values?.length || 0) + (cfg.avoid?.length || 0) > 0;
  return hasChoices && (!!cfg.required || Number(cfg.weight) > 0);
}
function fitConfigured() {
  const dims = db?.settings?.fit?.dimensions || {};
  return Object.values(dims).some(fitDimensionActive);
}
function fitScore(p) {
  const dims = db?.settings?.fit?.dimensions || {};
  const breakdown = [];
  let earned = 0;
  let total = 0;
  let blocked = false;

  fitDimensions().forEach(dim => {
    const cfg = dims[dim.key];
    if (!fitDimensionActive(cfg)) return;
    const values = cfg.values || [];
    const avoid = cfg.avoid || [];
    const required = !!cfg.required;
    const rawWeight = clamp(Math.round(Number(cfg.weight) || 0), 0, 5);
    const weight = required ? Math.max(1, rawWeight) : rawWeight;

    const actual = fitActualValues(p, dim.key);
    const matched = !values.length || actual.some(a => values.some(v => fitValueMatches(dim.key, a, v)));
    const avoided = actual.some(a => avoid.some(v => fitValueMatches(dim.key, a, v)));

    total += weight;
    if (matched) earned += weight;
    // Hitting an avoided value costs the dimension's full weight, so a
    // strong showing elsewhere can still outweigh one undesirable trait.
    if (avoided) earned -= weight;
    if (required && (!matched || avoided)) blocked = true;

    breakdown.push({
      key: dim.key,
      label: dim.label,
      actual,
      actualLabel: actual.length ? actual.map(v => fitValueLabel(dim.key, v)).join(', ') : 'Not set',
      values: [...values],
      avoid: [...avoid],
      expectedLabel: values.length ? values.map(v => fitValueLabel(dim.key, v)).join(', ') : 'Any (nothing specific)',
      avoidLabel: avoid.map(v => fitValueLabel(dim.key, v)).join(', '),
      matched,
      avoided,
      required,
      weight,
    });
  });

  if (!total) {
    return { configured: false, score: null, blocked: false, breakdown: [], tier: 'none' };
  }
  const score = clamp(Math.round((earned / total) * 100), 0, 100);
  const tier = blocked ? 'blocked'
    : score >= 80 ? 'strong'
    : score >= 60 ? 'good'
    : score >= 40 ? 'stretch' : 'weak';
  return { configured: true, score, blocked, breakdown, tier };
}
function fitTierLabel(tier) {
  return {
    strong: 'Strong fit', good: 'Good fit', stretch: 'Stretch',
    weak: 'Weak fit', blocked: 'Off brief', none: 'Not scored',
  }[tier] || 'Not scored';
}
function fitTitle(fit) {
  if (!fit.configured) return 'No fit preferences set yet';
  if (fit.blocked) {
    const misses = fit.breakdown
      .filter(b => b.required && (!b.matched || b.avoided))
      .map(b => b.label);
    return `Off brief — misses non-negotiable ${misses.join(', ')}`;
  }
  const bits = [];
  const missed = fit.breakdown.filter(b => !b.matched).map(b => b.label);
  const avoided = fit.breakdown.filter(b => b.avoided).map(b => b.label);
  if (missed.length) bits.push(`missed ${missed.join(', ')}`);
  if (avoided.length) bits.push(`avoid list hit: ${avoided.join(', ')}`);
  return `Fit ${fit.score}/100${bits.length ? ` · ${bits.join(' · ')}` : ' · every preference matched'}`;
}
function fitBadgeHtml(fit) {
  const title = esc(fitTitle(fit));
  if (!fit.configured) return `<span class="fit-badge none" title="${title}">—</span>`;
  if (fit.blocked) return `<span class="fit-badge blocked" title="${title}">Off brief</span>`;
  return `<span class="fit-badge ${fit.tier}" title="${title}">${fit.score}</span>`;
}

function sourceCheck(s) {
  const cadence = Math.max(1, Number(s.cadenceDays) || 7);
  if (!s.lastChecked) return { due: true, never: true, overdueDays: null, next: null, cadence };
  const next = addDays(s.lastChecked, cadence);
  const n = daysSince(next);
  return { due: n >= 0, never: false, overdueDays: n > 0 ? n : 0, next, cadence };
}

function sourcesDue() {
  return db.sources
    .filter(s => s.active)
    .map(s => ({ source: s, check: sourceCheck(s) }))
    .filter(x => x.check.due)
    .sort((a, b) => {
      if (a.check.never) return -1;
      if (b.check.never) return 1;
      return (b.check.overdueDays || 0) - (a.check.overdueDays || 0);
    });
}

function sourceStats(s) {
  const ps = db.prospects.filter(p => p.sourceId === s.id);
  return {
    total: ps.length,
    active: ps.filter(isActiveProspect).length,
    applied: ps.filter(p => !!p.appliedAt).length,
    interviews: ps.filter(p => ['interviewing', 'offered'].includes(p.status)).length,
    lastAdded: ps.map(p => p.addedAt).filter(Boolean).sort().pop() || null,
  };
}

function materialIssues() {
  const staleDays = db.settings.materialStaleDays || 60;
  const list = db.materials.map(m => {
    const reasons = [];
    const age = daysSince(m.lastUpdated);
    if (age !== null && age > staleDays) {
      reasons.push({ kind: 'age', text: `Not refreshed in ${age} days`, weight: age });
    }

    // A prospect-specific version that has been overtaken by an interview or placement.
    if (m.target === 'prospect' && m.targetProspectId) {
      const p = prospectById(m.targetProspectId);
      if (p && isActiveProspect(p)) {
        const advanced = db.activities.some(a =>
          a.prospectId === p.id && ['interview', 'placement'].includes(a.type) && a.date > m.lastUpdated
        );
        if (advanced) {
          reasons.push({
            kind: 'stale-prospect',
            text: `${prospectOrgName(p)} advanced since this version`,
            weight: 9000,
          });
        }
      }
    }

    // A resume or letter that is older than the application it was used for.
    if ((m.type === 'resume' || m.type === 'cover') && age !== null && age > 21) {
      const olderThanApp = db.prospects
        .filter(p => isActiveProspect(p) && p.appliedAt && p.materialIds.includes(m.id) && m.lastUpdated < p.appliedAt)
        .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt))[0];
      if (olderThanApp) {
        reasons.push({
          kind: 'older-than-app',
          text: `Older than your application to ${prospectOrgName(olderThanApp)}`,
          weight: 500 + age,
        });
      }
    }

    const weight = reasons.reduce((max, r) => Math.max(max, r.weight), 0);
    return { material: m, reasons, weight };
  }).filter(x => x.reasons.length);
  list.sort((a, b) => b.weight - a.weight);
  return list;
}

function isSnoozed(p) {
  return !!(p.snoozedUntil && daysSince(p.snoozedUntil) <= 0);
}

function nextSteps() {
  const items = [];
  const push = (p, score, kind, label, detail) => items.push({ p, score, kind, label, detail });

  db.prospects.forEach(p => {
    if (!isActiveProspect(p) || isSnoozed(p)) return;
    const since = daysSince(p.lastActivityAt);
    const due = p.nextFollowUp ? daysSince(p.nextFollowUp) : null;
    const orgName = prospectOrgName(p);

    if (p.status === 'offered') {
      const age = daysSince(p.statusChangedAt || p.lastActivityAt);
      push(p, 95, 'offer', 'Respond to offer',
        `Offer from ${orgName}${age !== null ? ` · ${age}d ago` : ''}`);
    }

    if (p.status === 'interviewing') {
      if (due !== null && due >= 0) {
        push(p, 86 + due, 'followup',
          due === 0 ? 'Interview next step due today' : `Interview follow-up ${due}d overdue`,
          `${orgName} · last activity ${since}d ago`);
      } else if (due !== null && due < 0 && -due <= 3) {
        push(p, 55, 'upcoming', 'Interview next step coming up',
          `${orgName} · ${dueLabel(p.nextFollowUp)}`);
      } else if (since !== null && since >= 7) {
        push(p, 62 + since, 'stale', 'Check in on interview process',
          `${orgName} · no activity for ${since}d`);
      }
    }

    if (p.status === 'applied') {
      if (due !== null && due >= 0) {
        push(p, 78 + due, 'followup',
          due === 0 ? 'Follow-up due today' : `Follow-up ${due}d overdue`,
          `${orgName} · ${p.appliedAt ? `applied ${daysSince(p.appliedAt)}d ago` : 'application date missing'}`);
      } else if (!p.nextFollowUp && p.appliedAt && daysSince(p.appliedAt) >= 10) {
        push(p, 58, 'stale', 'Application is aging',
          `${orgName} · applied ${daysSince(p.appliedAt)}d ago, no follow-up set`);
      }
    }

    if (p.status === 'prospect') {
      const age = daysSince(p.addedAt) ?? 0;
      if (age >= 3) {
        push(p, 50 + Math.min(age, 20), 'decide', 'Apply or pass',
          `${orgName} · sitting for ${age}d`);
      } else {
        push(p, 30, 'new', 'Review new prospect',
          `${orgName} · added ${age === 0 ? 'today' : age + 'd ago'}`);
      }
    }

    if (!items.some(i => i.p.id === p.id) && p.status !== 'prospect' && since !== null && since >= 14) {
      push(p, 40, 'stale', 'No recent activity',
        `${orgName} · last update ${since}d ago`);
    }
  });

  const best = new Map();
  items.forEach(it => {
    const cur = best.get(it.p.id);
    if (!cur || it.score > cur.score) best.set(it.p.id, it);
  });
  return [...best.values()].sort((a, b) => b.score - a.score);
}

function activityFor(prospectId) {
  return db.activities
    .filter(a => a.prospectId === prospectId)
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt)));
}

function recentActivity(limit = 8) {
  return [...db.activities]
    .sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, limit);
}

function logActivity(prospectId, type, date, note = '') {
  const entry = {
    id: uid('act'),
    prospectId,
    type: ACTIVITY_TYPES[type] ? type : 'note',
    date: date || todayISO(),
    note: note || '',
    createdAt: new Date().toISOString(),
  };
  db.activities.push(entry);
  const p = prospectById(prospectId);
  if (p && (!p.lastActivityAt || entry.date > p.lastActivityAt)) p.lastActivityAt = entry.date;
  return entry;
}

function recomputeLastActivity(p) {
  const dates = db.activities.filter(a => a.prospectId === p.id).map(a => a.date);
  if (p.appliedAt) dates.push(p.appliedAt);
  if (p.statusChangedAt) dates.push(p.statusChangedAt);
  if (p.addedAt) dates.push(p.addedAt);
  dates.sort();
  p.lastActivityAt = dates[dates.length - 1] || p.addedAt;
}

function deleteProspectCascade(id) {
  db.prospects = db.prospects.filter(p => p.id !== id);
  db.activities = db.activities.filter(a => a.prospectId !== id);
  db.materials = db.materials.map(m => m.targetProspectId === id ? { ...m, targetProspectId: null, target: m.target === 'prospect' ? 'general' : m.target } : m);
}

/* ------------------------------------------------------------------ *
 *  Seed data (only used on first run)
 * ------------------------------------------------------------------ */
function seedData() {
  const d = daysAgoISO;
  const f = daysFromNowISO;

  const sources = [
    {
      id: 'src_linkedin', name: 'LinkedIn Jobs', kind: 'Job board', url: 'https://www.linkedin.com/jobs/',
      cadenceDays: 2, lastChecked: d(3),
      notes: 'Saved searches: product design, senior product design, design systems. Set alerts for remote roles.',
      active: true,
    },
    {
      id: 'src_indeed', name: 'Indeed', kind: 'Job board', url: 'https://www.indeed.com/',
      cadenceDays: 3, lastChecked: d(1),
      notes: 'Broadest net. Filter by salary and remote. Good for smaller companies.',
      active: true,
    },
    {
      id: 'src_otta', name: 'Otta', kind: 'Job board', url: 'https://otta.com/',
      cadenceDays: 2, lastChecked: d(5),
      notes: 'Best signal-to-noise for product design. Check the "new this week" digest.',
      active: true,
    },
    {
      id: 'src_builtin', name: 'Built In', kind: 'Job board', url: 'https://builtin.com/',
      cadenceDays: 3, lastChecked: d(10),
      notes: 'Strong for local companies. Search Austin, Seattle, Denver.',
      active: true,
    },
    {
      id: 'src_careers', name: 'Target company career pages', kind: 'Company site', url: '',
      cadenceDays: 7, lastChecked: d(6),
      notes: 'Shortlist of 8 companies. Check each careers page weekly; not all post to boards.',
      active: true,
    },
    {
      id: 'src_referral', name: 'Referrals & network', kind: 'Referral / network', url: '',
      cadenceDays: 14, lastChecked: d(20),
      notes: 'Reconnect with former colleagues. Ask about teams hiring now. Track who referred you.',
      active: true,
    },
    {
      id: 'src_roberthalf', name: 'Robert Half', kind: 'Agency / recruiter', url: 'https://www.roberthalf.com/',
      cadenceDays: 7, lastChecked: d(4),
      notes: 'Recruiter: Dana Ruiz. Contract and contract-to-hire design roles. Rate sheet on file.',
      active: true,
    },
    {
      id: 'src_teksystems', name: 'TEKsystems', kind: 'Agency / recruiter', url: 'https://www.teksystems.com/',
      cadenceDays: 5, lastChecked: d(12),
      notes: 'Recruiter: Priya Shah. Mostly healthcare and enterprise UX.',
      active: true,
    },
    {
      id: 'src_hn', name: "Hacker News — Who's Hiring", kind: 'Community', url: 'https://news.ycombinator.com/',
      cadenceDays: 30, lastChecked: d(15),
      notes: 'Monthly thread. Skim for design roles at early-stage companies.',
      active: true,
    },
    {
      id: 'src_dice', name: 'Dice', kind: 'Job board', url: 'https://www.dice.com/',
      cadenceDays: 7, lastChecked: null,
      notes: 'Signed up but have not checked yet. Decide whether it is worth the time.',
      active: true,
    },
  ];

  const orgs = [
    {
      id: 'org_northwind', kind: 'company', name: 'Northwind Labs', employees: 120, industry: 'Technology',
      website: 'https://example.com/northwind',
      notes: 'Product-led SaaS. Small enough that design has a seat at the table; hybrid team based in Austin.',
      attributes: {
        atr_stack: ['TypeScript', 'React', 'Node.js'],
        atr_modernity: ['Modern'],
        atr_openness: ['Open source friendly'],
      },
    },
    {
      id: 'org_contoso', kind: 'company', name: 'Contoso', employees: 900, industry: 'Technology',
      website: 'https://example.com/contoso',
      notes: 'Rebuilding its design system. Larger engineering org; remote-first in the US.',
      attributes: {
        atr_stack: ['.NET', 'C#'],
        atr_modernity: ['Mixed'],
        atr_openness: ['Closed / proprietary'],
      },
    },
    {
      id: 'org_fabrikam', kind: 'company', name: 'Fabrikam', employees: 35, industry: 'Technology',
      website: 'https://example.com/fabrikam',
      notes: 'Early-stage product company. Small design team with a strong portfolio of work.',
      attributes: {
        atr_stack: ['TypeScript', 'React'],
        atr_modernity: ['Modern'],
        atr_openness: ['Open source friendly'],
      },
    },
    {
      id: 'org_initech', kind: 'company', name: 'Initech', employees: 1500, industry: 'Financial services',
      website: 'https://example.com/initech',
      notes: 'Established financial software company. Structured research practice and an onsite culture.',
      attributes: {
        atr_stack: ['COBOL', 'Mainframe'],
        atr_modernity: ['Legacy'],
        atr_openness: ['Closed / proprietary'],
      },
    },
    {
      id: 'org_umbrella', kind: 'company', name: 'Umbrella Health', employees: 4200, industry: 'Healthcare',
      website: 'https://example.com/umbrella',
      notes: 'Healthcare platform. Contract-to-hire roles often run through TEKsystems.',
      attributes: {
        atr_stack: ['Java', 'Spring'],
        atr_modernity: ['Mixed'],
        atr_openness: ['Closed / proprietary'],
      },
    },
    {
      id: 'org_globex', kind: 'company', name: 'Globex', employees: 250, industry: 'Manufacturing',
      website: 'https://example.com/globex',
      notes: 'Industrial manufacturer modernizing its digital products. Wants more people-management experience.',
      attributes: {
        atr_stack: ['.NET', 'SQL Server'],
        atr_modernity: ['Legacy'],
        atr_openness: ['Closed / proprietary'],
      },
    },
    {
      id: 'org_acme', kind: 'company', name: 'Acme Corp', employees: 60, industry: 'Retail',
      website: 'https://example.com/acme',
      notes: 'Small retail company. Roles are posted directly on its careers page and often close quickly.',
      attributes: {
        atr_stack: ['Ruby on Rails', 'Postgres'],
        atr_modernity: ['Mixed'],
        atr_openness: ['Not sure'],
      },
    },
    {
      id: 'org_soylent', kind: 'company', name: 'Soylent', employees: 180, industry: 'Food & beverage',
      website: 'https://example.com/soylent',
      notes: 'Consumer food brand with an in-house product design team.',
      attributes: {
        atr_stack: ['React', 'Node.js'],
        atr_modernity: ['Modern'],
        atr_openness: ['Open source friendly'],
      },
    },
    {
      id: 'org_hooli', kind: 'company', name: 'Hooli', employees: 6200, industry: 'Technology',
      website: 'https://example.com/hooli',
      notes: 'Large technology company. Contract roles through Robert Half can convert to full-time.',
      attributes: {
        atr_stack: ['Java', 'Go'],
        atr_modernity: ['Modern'],
        atr_openness: ['Closed / proprietary'],
      },
    },
    {
      id: 'org_vandelay', kind: 'company', name: 'Vandelay Industries', employees: 25, industry: 'Logistics',
      website: 'https://example.com/vandelay',
      notes: 'Very small import/export software team. Found through Hacker News.',
      attributes: {
        atr_stack: ['Python', 'Django'],
        atr_modernity: ['Modern'],
        atr_openness: ['Open source friendly'],
      },
    },
    {
      id: 'org_stark', kind: 'company', name: 'Stark Industries', employees: 12000, industry: 'Defense',
      website: 'https://example.com/stark',
      notes: 'Large defense and technology contractor. Design systems role with a remote US team.',
      attributes: {
        atr_stack: ['.NET', 'Java'],
        atr_modernity: ['Mixed'],
        atr_openness: ['Closed / proprietary'],
      },
    },
    {
      id: 'org_wayne', kind: 'company', name: 'Wayne Enterprises', employees: 8500, industry: 'Conglomerate',
      website: 'https://example.com/wayne',
      notes: 'Diversified conglomerate. Design roles sit inside the consumer products group in Chicago.',
      attributes: {
        atr_stack: ['Java', 'Oracle'],
        atr_modernity: ['Legacy'],
        atr_openness: ['Closed / proprietary'],
      },
    },
    {
      id: 'org_roberthalf', kind: 'agency', name: 'Robert Half', employees: 14000, industry: 'Staffing',
      website: 'https://www.roberthalf.com',
      notes: 'Recruiter: Dana Ruiz. Contract and contract-to-hire design roles.',
    },
    {
      id: 'org_teksystems', kind: 'agency', name: 'TEKsystems', employees: 8000, industry: 'Staffing',
      website: 'https://www.teksystems.com',
      notes: 'Recruiter: Priya Shah. Mostly healthcare and enterprise UX contracts.',
    },
  ];

  const prospects = [
    {
      id: 'prs_northwind', companyId: 'org_northwind', agencyId: null,
      title: 'Senior Product Designer', level: 'Senior', category: 'Design', sourceId: 'src_linkedin',
      status: 'interviewing', workMode: 'hybrid', location: 'Austin, TX', salary: '$140–160k',
      url: 'https://example.com/northwind/senior-product-designer', addedAt: d(16), appliedAt: d(12),
      nextFollowUp: d(0), snoozedUntil: null,
      materialIds: ['mat_sr_resume', 'mat_northwind_cl', 'mat_interview_notes'],
      notes: '2nd round with the design director. Portfolio review + a whiteboard exercise.\nAsk about the design team structure and remote policy.',
    },
    {
      id: 'prs_contoso', companyId: 'org_contoso', agencyId: null,
      title: 'Frontend Engineer', level: 'Mid', category: 'Engineering', sourceId: 'src_referral',
      status: 'applied', workMode: 'remote', location: 'Remote (US)', salary: '$130–150k',
      url: 'https://example.com/contoso/frontend', addedAt: d(24), appliedAt: d(21),
      nextFollowUp: d(4), snoozedUntil: null,
      materialIds: ['mat_master_resume'],
      notes: 'Referred by Marcus. Recruiter said the team is rebuilding their design system. No response since applying.',
    },
    {
      id: 'prs_fabrikam', companyId: 'org_fabrikam', agencyId: null,
      title: 'Product Designer', level: 'Mid', category: 'Design', sourceId: 'src_otta',
      status: 'prospect', workMode: 'remote', location: 'Remote (EU/US)', salary: '€70–90k',
      url: 'https://example.com/fabrikam/product-designer', addedAt: d(4), appliedAt: null,
      nextFollowUp: null, snoozedUntil: null,
      materialIds: [],
      notes: 'Small design team, strong portfolio. Need to decide if the EU timezone overlap works.',
    },
    {
      id: 'prs_initech', companyId: 'org_initech', agencyId: null,
      title: 'UX Researcher', level: 'Mid', category: 'Research', sourceId: 'src_indeed',
      status: 'offered', workMode: 'onsite', location: 'New York, NY', salary: '$150k + equity',
      url: 'https://example.com/initech/ux-researcher', addedAt: d(30), appliedAt: d(25),
      nextFollowUp: f(1), snoozedUntil: null,
      materialIds: ['mat_initech_cl'],
      notes: 'Verbal offer received. Need to respond by end of week. Negotiate sign-on and start date.',
    },
    {
      id: 'prs_umbrella', companyId: 'org_umbrella', agencyId: 'org_teksystems',
      title: 'Senior Product Designer', level: 'Senior', category: 'Design', sourceId: 'src_teksystems',
      status: 'interviewing', workMode: 'hybrid', location: 'Boston, MA', salary: '$75/hr contract',
      url: 'https://example.com/umbrella/senior-designer', addedAt: d(18), appliedAt: d(15),
      nextFollowUp: d(2), snoozedUntil: null,
      materialIds: ['mat_sr_resume'],
      notes: 'Contract-to-hire through TEKsystems. Contract ended; now interviewing for the full-time role.',
    },
    {
      id: 'prs_globex', companyId: 'org_globex', agencyId: null,
      title: 'Design Lead', level: 'Lead', category: 'Design', sourceId: 'src_builtin',
      status: 'declined', workMode: 'remote', location: 'Remote', salary: '$160–180k',
      url: 'https://example.com/globex/design-lead', addedAt: d(40), appliedAt: d(35),
      nextFollowUp: null, snoozedUntil: null,
      materialIds: [],
      notes: 'Rejected after the first interview. Feedback: wanted more people-management experience.',
    },
    {
      id: 'prs_acme', companyId: 'org_acme', agencyId: null,
      title: 'Staff Designer', level: 'Staff', category: 'Design', sourceId: 'src_careers',
      status: 'canceled', workMode: 'hybrid', location: 'Denver, CO', salary: '',
      url: 'https://example.com/acme/staff-designer', addedAt: d(33), appliedAt: d(28),
      nextFollowUp: null, snoozedUntil: null,
      materialIds: [],
      notes: 'Posting closed before interviews. Keep an eye on the company for future openings.',
    },
    {
      id: 'prs_soylent', companyId: 'org_soylent', agencyId: null,
      title: 'Product Designer', level: 'Mid', category: 'Design', sourceId: 'src_linkedin',
      status: 'applied', workMode: 'hybrid', location: 'Seattle, WA', salary: '$125–145k',
      url: 'https://example.com/soylent/product-designer', addedAt: d(15), appliedAt: d(12),
      nextFollowUp: d(3), snoozedUntil: null,
      materialIds: ['mat_pd_resume', 'mat_master_cl'],
      notes: 'Applied through the careers portal. Follow up with the design manager on LinkedIn.',
    },
    {
      id: 'prs_hooli', companyId: 'org_hooli', agencyId: 'org_roberthalf',
      title: 'Senior UX Designer', level: 'Senior', category: 'Design', sourceId: 'src_roberthalf',
      status: 'offered', workMode: 'onsite', location: 'San Jose, CA', salary: '$85/hr contract',
      url: 'https://example.com/hooli/senior-ux', addedAt: d(36), appliedAt: d(32),
      nextFollowUp: f(7), snoozedUntil: null,
      materialIds: ['mat_sr_resume', 'mat_rate_sheet'],
      notes: 'Currently on a 3-month contract through Robert Half. Extension likely; check in with Dana about the next statement of work.',
    },
    {
      id: 'prs_vandelay', companyId: 'org_vandelay', agencyId: null,
      title: 'UX Designer', level: 'Mid', category: 'Design', sourceId: 'src_hn',
      status: 'prospect', workMode: 'remote', location: 'Remote', salary: '',
      url: 'https://example.com/vandelay/ux-designer', addedAt: d(1), appliedAt: null,
      nextFollowUp: null, snoozedUntil: null,
      materialIds: [],
      notes: 'Found in the latest HN thread. Small team, import/export SaaS. Worth a look.',
    },
    {
      id: 'prs_stark', companyId: 'org_stark', agencyId: null,
      title: 'Design Systems Lead', level: 'Lead', category: 'Design', sourceId: 'src_dice',
      status: 'prospect', workMode: 'remote', location: 'Remote (US)', salary: '$170–190k',
      url: 'https://example.com/stark/design-systems', addedAt: d(8), appliedAt: null,
      nextFollowUp: null, snoozedUntil: null,
      materialIds: [],
      notes: 'Strong design systems role. Need a tailored resume — the master resume does not emphasize systems work enough.',
    },
    {
      id: 'prs_wayne', companyId: 'org_wayne', agencyId: null,
      title: 'Senior Product Designer', level: 'Senior', category: 'Design', sourceId: 'src_referral',
      status: 'applied', workMode: 'onsite', location: 'Chicago, IL', salary: '$145–165k',
      url: 'https://example.com/wayne/senior-designer', addedAt: d(9), appliedAt: d(6),
      nextFollowUp: f(3), snoozedUntil: null,
      materialIds: ['mat_sr_resume', 'mat_portfolio'],
      notes: 'Applied through an internal referral from Dana K. Recruiter confirmed receipt.',
    },
  ];

  const materials = [
    {
      id: 'mat_master_resume', name: 'Master resume', type: 'resume', target: 'general',
      targetTitle: '', targetProspectId: null, lastUpdated: d(95),
      link: '', notes: 'Everything, unsorted. Source of truth for all tailored versions. Needs a refresh — last role is missing recent metrics.',
    },
    {
      id: 'mat_pd_resume', name: 'Product Designer resume', type: 'resume', target: 'title',
      targetTitle: 'Product Designer', targetProspectId: null, lastUpdated: d(42),
      link: '', notes: 'Mid-level product design roles. Case studies: onboarding, checkout, design system.',
    },
    {
      id: 'mat_sr_resume', name: 'Senior Product Designer resume', type: 'resume', target: 'title',
      targetTitle: 'Senior Product Designer', targetProspectId: null, lastUpdated: d(9),
      link: '', notes: 'Leads with scope and outcomes. Best version right now. Update after the Northwind interview.',
    },
    {
      id: 'mat_master_cl', name: 'Cover letter template', type: 'cover', target: 'general',
      targetTitle: '', targetProspectId: null, lastUpdated: d(120),
      link: '', notes: 'Reusable structure: hook, relevant outcomes, why this company. Swap the middle paragraph per role.',
    },
    {
      id: 'mat_northwind_cl', name: 'Northwind Labs cover letter', type: 'cover', target: 'prospect',
      targetTitle: '', targetProspectId: 'prs_northwind', lastUpdated: d(13),
      link: '', notes: 'Tailored to their design system rebuild. Reference the interview conversation in the follow-up.',
    },
    {
      id: 'mat_initech_cl', name: 'Initech cover letter', type: 'cover', target: 'prospect',
      targetTitle: '', targetProspectId: 'prs_initech', lastUpdated: d(3),
      link: '', notes: 'Research-heavy framing. Keep on file for the offer conversation.',
    },
    {
      id: 'mat_interview_notes', name: 'Interview notes — Northwind', type: 'notes', target: 'prospect',
      targetTitle: '', targetProspectId: 'prs_northwind', lastUpdated: d(10),
      link: '', notes: 'Questions to ask: team structure, design review cadence, how research is staffed. Add notes after round 2.',
    },
    {
      id: 'mat_rate_sheet', name: 'Agency rate sheet & questions', type: 'notes', target: 'general',
      targetTitle: '', targetProspectId: null, lastUpdated: d(70),
      link: '', notes: 'Target rate, benefits to ask about, contract-to-hire conversion questions. Refresh before the next agency call.',
    },
    {
      id: 'mat_portfolio', name: 'Portfolio talking points', type: 'notes', target: 'general',
      targetTitle: '', targetProspectId: null, lastUpdated: d(55),
      link: '', notes: 'Three case studies: onboarding, checkout, design system. Tighten the 2-minute version.',
    },
  ];

  const activities = [
    ['prs_northwind', 'applied', d(12), 'Applied through LinkedIn.'],
    ['prs_northwind', 'follow_up', d(10), 'Recruiter screen scheduled for Thursday.'],
    ['prs_northwind', 'interview', d(3), 'Portfolio review with the design director. Went well; round 2 next.'],
    ['prs_contoso', 'applied', d(21), 'Applied with Marcus’s referral.'],
    ['prs_contoso', 'follow_up', d(17), 'Emailed the recruiter to confirm receipt.'],
    ['prs_contoso', 'note', d(15), 'No response yet. Assume it is a low-priority lead.'],
    ['prs_fabrikam', 'note', d(4), 'Saved from Otta. Need to decide whether to apply.'],
    ['prs_initech', 'applied', d(25), 'Applied through Indeed.'],
    ['prs_initech', 'interview', d(11), 'Onsite loop: two research case studies and a panel.'],
    ['prs_initech', 'offer', d(2), 'Verbal offer received. Respond by Friday.'],
    ['prs_umbrella', 'applied', d(15), 'Submitted through TEKsystems for the contract-to-hire role.'],
    ['prs_umbrella', 'interview', d(6), 'Conversion interview with the design manager.'],
    ['prs_umbrella', 'follow_up', d(2), 'Sent a thank-you note and availability for next week.'],
    ['prs_globex', 'applied', d(35), 'Applied via Built In.'],
    ['prs_globex', 'interview', d(26), 'First-round interview with the hiring manager.'],
    ['prs_globex', 'declined', d(20), 'Rejected. Feedback: wanted more management experience.'],
    ['prs_acme', 'applied', d(28), 'Applied through the company careers page.'],
    ['prs_acme', 'canceled', d(22), 'Recruiter emailed: the role was put on hold and the posting closed.'],
    ['prs_soylent', 'applied', d(12), 'Applied through the careers portal.'],
    ['prs_soylent', 'follow_up', d(9), 'Connected with the design manager on LinkedIn.'],
    ['prs_hooli', 'applied', d(32), 'Submitted by Dana at Robert Half.'],
    ['prs_hooli', 'interview', d(30), 'Client interview; offer came the same week.'],
    ['prs_hooli', 'placement', d(28), 'Started the contract through Robert Half.'],
    ['prs_vandelay', 'note', d(1), 'Found in the HN Who’s Hiring thread.'],
    ['prs_stark', 'note', d(8), 'Saved to prospects. Needs a design-systems resume.'],
    ['prs_wayne', 'applied', d(6), 'Applied through Dana K.’s referral.'],
  ].map(([prospectId, type, date, note], i) => ({
    id: `act_seed_${i}`, prospectId, type, date, note, createdAt: new Date().toISOString(),
  }));

  const out = normalizeDB({
    orgs,
    sources,
    prospects,
    materials,
    activities,
    settings: {
      materialStaleDays: 60,
      attributes: [
        {
          id: 'atr_stack', label: 'Tech stack', multi: true,
          options: ['TypeScript', 'JavaScript', 'React', 'Node.js', 'Python', 'Django', 'Ruby on Rails',
            'Java', 'Go', 'C#', '.NET', 'COBOL', 'Mainframe', 'Postgres', 'SQL Server', 'Oracle'],
        },
        {
          id: 'atr_modernity', label: 'Tech modernity', multi: false,
          options: ['Modern', 'Mixed', 'Legacy'],
        },
        {
          id: 'atr_openness', label: 'Tech openness', multi: false,
          options: ['Open source friendly', 'Closed / proprietary', 'Not sure'],
        },
      ],
      fit: {
        dimensions: {
          size:     { weight: 3, required: false, values: ['small', 'mid'], avoid: [] },
          industry: { weight: 2, required: false, values: ['Technology'], avoid: [] },
          level:    { weight: 3, required: false, values: ['Senior', 'Staff', 'Lead', 'Architect'], avoid: [] },
          category: { weight: 2, required: true,  values: ['Design', 'Product'], avoid: [] },
          mode:     { weight: 2, required: false, values: ['remote', 'hybrid'], avoid: [] },
          'attr:atr_stack':      { weight: 2, required: false, values: ['TypeScript', 'React'], avoid: ['.NET', 'COBOL'] },
          'attr:atr_modernity':  { weight: 3, required: false, values: ['Modern'], avoid: ['Legacy'] },
          'attr:atr_openness':   { weight: 1, required: false, values: ['Open source friendly'], avoid: ['Closed / proprietary'] },
        },
      },
    },
    meta: { sample: true },
  });
  out.prospects.forEach(p => {
    const dates = out.activities.filter(a => a.prospectId === p.id).map(a => a.date);
    if (p.appliedAt) dates.push(p.appliedAt);
    if (p.addedAt) dates.push(p.addedAt);
    dates.sort();
    p.statusChangedAt = dates[dates.length - 1] || p.addedAt;
    p.lastActivityAt = p.statusChangedAt;
  });
  return out;
}
