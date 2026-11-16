# Job Tracker

A local, single-page job-search command center. Track **sources**, **prospects**, **companies and agencies**, and **materials** — then rank roles against your own weighted fit preferences.

No build step, no account, no external services. All data lives in your browser's `localStorage`.

## Run it

Open `index.html` directly in a browser, or serve the folder locally:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

First run loads a realistic sample dataset so the dashboard is not empty. Use **Clear sample data** on the dashboard when you want to start fresh. Your own data persists across reloads and is included in backups.

## What it tracks

**Sources** — job boards, company career pages, recruiters/agencies, referrals, communities. Each source has a check cadence and a last-checked date. The dashboard lists sources that are due or overdue, and each source shows how many prospects, applications, and interviews it has produced.

**Prospects** — each role you are considering. A prospect links to a **company** (the direct employer) and/or an **agency** (a recruiter or staffing firm). Either one can be set; the direct company can stay unknown at first. When an agency is involved it is shown everywhere the company is, for example `Northwind Labs · via Bright Recruiting`, or the agency name alone if the company is not known yet.

Each prospect also tracks title, rough **level** (Junior through Executive), **category** (Engineering, Design, Product, Research, and so on), source, compensation, posting URL, dates, notes, and status:

- Prospect
- Applied
- Interviewing
- Offered
- Declined
- Canceled

Work arrangement is tracked separately from status: **Remote**, **Hybrid**, or **In office**, plus a free-text location.

Sort the list by last activity, best fit, date applied, next follow-up, recently added, or organization. Filter by company, agency, level, category, work mode, source, fit level, and any organization attribute you define. When adding or editing a prospect, use **New** next to Source or either organization to create one without leaving the form.

**Companies & agencies** — first-class records shared across every prospect. A company or agency has a name, employee count, industry, website, notes, and any custom attributes you define. Employee count drives a size band (Small under 50, Mid-size under 250, Large under 1,000, Enterprise), so "small tech company" is a real filter rather than a guess. Several prospects can point at the same organization. Deleting an organization unlinks it from prospects instead of deleting them.

**Organization attributes** — define your own flexible details, such as tech stack, tech modernity, tech openness, culture, or anything else. Each attribute has preset options and can be single- or multi-select. Values live on the organization, so they apply to every prospect there. Add, edit, or delete attributes from **Fit preferences**; each one automatically becomes a fit dimension.

**Materials** — resumes, cover letters, and notes. Materials can target:

- **General** — usable for any role
- **A title** — recommended automatically when a prospect's title contains that text
- **A specific prospect** — a one-off version, linked to that prospect

Use **Duplicate** on any material to create a tailored version without losing the original.

**Activity** — every note, application, follow-up, interview, offer, decline, and cancellation is logged with a date. The prospect's last-activity date is derived from this timeline.

## Fit preferences and scoring

Every prospect is scored against a weighted brief you control. Built-in dimensions are company size, industry, job level, job category, and work mode; every organization attribute adds another dimension automatically.

For each dimension you can:

- Set a **weight** from 0 to 5.
- Pick **preferred values**. Each matching value earns the dimension's full weight.
- Pick **avoided values**. A hit subtracts the dimension's full weight, so a strong showing elsewhere can still outweigh one undesirable trait.
- Mark the dimension **non-negotiable** (required). A miss or an avoid hit then blocks the prospect as **Off brief**, regardless of score.

The score is `earned ÷ total` across active dimensions, clamped to 0–100. Tiers are Strong (80+), Good (60+), Stretch (40+), Weak, and Off brief. Active preferences and per-dimension breakdowns appear in the prospect drawer; the dashboard shows an **Average fit** stat and a **Best fits** card.

Preferences and attribute definitions are data, not code — change weights, values, avoid lists, and attributes from the UI and they save immediately.

## What the dashboard tells you

- **Next steps** — prioritized actions: respond to offers, overdue follow-ups, interview check-ins, "apply or pass" decisions, and aging applications. Snooze an item for 3 days to clear it from the queue.
- **Sources to check** — sources whose cadence has elapsed (or that were never checked), with counts of what they have produced.
- **Materials to refresh** — flags materials older than 60 days, a prospect-specific version that a prospect has outgrown by interviewing, or a resume/letter older than the application it was used for.
- **Pipeline** — counts by status with proportional bars.
- **Best fits** — the highest-scoring active prospects, with a count of any that are off brief.
- **Recent activity** — the latest movement across all prospects.

The header summary gives the day's headline counts at a glance.

## Data and backups

- Data is stored under the `jobtracker.v1` key in `localStorage`.
- **Export** downloads the full dataset as JSON. Use it before clearing data or moving to another browser.
- **Import** replaces the current dataset with an exported file.
- **Clear all data** removes everything (export first).

The stored schema is version 2. On load, older data with a `company` string and nested `agency` object is migrated into shared company and agency records, and old fit settings are normalized with empty avoid lists.

Staleness thresholds live in the exported JSON under `settings` (`materialStaleDays` defaults to 60). Change and re-import if you want a different threshold.

## Files

```
index.html               markup + shell
styles.css               theme tokens, layout, dashboard
styles-components.css    tables, cards, drawer, modals, forms, responsive rules
js/core.js               constants, storage, migration, org/attribute helpers, fit scoring, sample dataset
js/views.js              shared UI helpers, dashboard
js/views-lists.js        prospects, companies/agencies, fit preferences, sources, materials, activity
js/views-drawer.js       prospect detail drawer with organization blocks and fit breakdown
js/forms.js              add/edit modals for prospects, organizations, attributes, materials, sources
js/app.js                actions, events, theme, import/export, boot
```

All state changes save immediately. Nothing leaves your machine.
