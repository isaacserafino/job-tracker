# Job Tracker

A local, single-page job-search command center. Track **sources**, **prospects**, and **materials**, and see at a glance what needs attention next.

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

**Prospects** — each role you are considering. Tracks company, title, source, compensation, posting URL, dates, notes, and status:

- Prospect
- Applied
- Interviewing
- Offered
- Declined
- Canceled

Work arrangement is tracked separately from status: **Remote**, **Hybrid**, or **In office**, plus a free-text location.

Sort the list by last activity, date applied, next follow-up, recently added, or company. When adding or editing a prospect, use **New** next to Source to create a source without leaving the form.

**Materials** — resumes, cover letters, and notes. Materials can target:

- **General** — usable for any role
- **A title** — recommended automatically when a prospect's title contains that text
- **A specific prospect** — a one-off version, linked to that prospect

Use **Duplicate** on any material to create a tailored version without losing the original.

**Activity** — every note, application, follow-up, interview, offer, decline, cancellation, and placement is logged with a date. The prospect's last-activity date is derived from this timeline.

**Agency placements** — add an agency name, contact, placement start/end dates, and notes to any prospect. Active placements show a badge throughout the app and appear in the dashboard's placement card. You can end a placement with one click, which records it in the activity timeline.

## What the dashboard tells you

- **Next steps** — prioritized actions: respond to offers, overdue follow-ups, interview check-ins, "apply or pass" decisions, aging applications, and placement check-ins. Snooze an item for 3 days to clear it from the queue.
- **Sources to check** — sources whose cadence has elapsed (or that were never checked), with counts of what they have produced.
- **Materials to refresh** — flags materials that are older than 60 days, a prospect-specific version that a prospect has outgrown by interviewing or being placed, or a resume/letter that is older than the application it was used for.
- **Pipeline** — counts by status with proportional bars.
- **Agency placements** — active and upcoming contracts with elapsed/remaining time.
- **Recent activity** — the latest movement across all prospects.

The header summary gives the day's headline counts at a glance.

## Data and backups

- Data is stored under the `jobtracker.v1` key in `localStorage`.
- **Export** downloads the full dataset as JSON. Use it before clearing data or moving to another browser.
- **Import** replaces the current dataset with an exported file.
- **Clear all data** removes everything (export first).

Staleness thresholds live in the exported JSON under `settings` (`materialStaleDays` defaults to 60). Change and re-import if you want a different threshold.

## Files

```
index.html               markup + shell
styles.css               theme tokens, layout, dashboard
styles-components.css    tables, cards, drawer, modals, forms, responsive rules
js/core.js               constants, storage, derived data, sample dataset
js/views.js              shared UI helpers, dashboard
js/views-lists.js        prospects, sources, materials, activity views
js/views-drawer.js       prospect detail drawer
js/forms.js              add/edit modals
js/app.js                actions, events, theme, import/export, boot
```

All state changes save immediately. Nothing leaves your machine.
