## Goal
Add three connected features to Triage:
1. **Medication & Interaction Tracker** — vault of meds the user takes
2. **Family & Dependent Profiles** — multiple sub-profiles (kids, parents) under one account
3. **Longitudinal Symptom Tracker** — log lingering symptoms over time, escalate based on duration

All three feed the AI triage chat so the Probability Engine becomes context-aware.

---

## Database (one migration)

New tables, all with RLS scoped to `auth.uid()`:

- **`profiles_dependents`** — sub-profiles owned by the account
  - `owner_id`, `name`, `relation` (self/child/parent/partner/other), `date_of_birth`, `sex`, `notes`, `is_default` bool
  - On user signup (or first dashboard visit), auto-create a "self" profile.
- **`medications`**
  - `user_id`, `profile_id` (→ dependents), `name`, `dosage`, `frequency`, `kind` (prescription/otc/supplement), `started_on`, `ended_on` nullable, `notes`, `common_side_effects` text[] (user-tagged or AI-suggested later)
- **`symptom_logs`**
  - `user_id`, `profile_id`, `symptom`, `severity` (1–5), `notes`, `logged_at`
  - Index on `(profile_id, symptom, logged_at)` for trend queries.

No changes to existing tables.

---

## UI — three new routes + nav entries

### `/meds` — Medication vault
- List grouped by kind (Rx / OTC / Supplements), filtered by active profile.
- Add/edit/delete dialog. Mark as ended (keeps history).
- Empty state with primer copy.

### `/family` — Profiles manager
- Card grid of profiles with name, age (computed), relation, "set as active" button.
- Add/edit/delete (cannot delete the only profile).
- Active profile stored in `localStorage` + a small Zustand-free context (`useActiveProfile` hook).
- Show active profile chip in `AppNav` with a quick-switch dropdown.

### `/symptoms` — Longitudinal tracker
- Timeline view: list of recent logs grouped by symptom.
- "Log symptom" form (symptom name, severity slider, notes).
- Per-symptom trend mini-chart (reuse recharts pattern from dashboard) showing severity over the last 30 days.
- Duration badge ("ongoing 14 days") with color escalation: green <7d, amber 7–21d, red >21d.

### `AppNav` updates
- Add links: Meds, Family, Symptoms.
- Active-profile chip with dropdown switcher.

---

## AI integration (the synergy)

Update `src/routes/api/chat.ts` to inject a context block into the system prompt before the AI call:

```
ACTIVE PROFILE: name (age, sex, relation)
CURRENT MEDICATIONS:
  - Lisinopril 10mg daily (Rx, started 2025-01-10) — common side effects: dizziness, dry cough
  - …
RECENT SYMPTOM HISTORY (last 30 days):
  - cough: severity 2 on day 1, severity 3 on day 7, severity 4 on day 14 (ongoing 14 days)
  - …
```

Prompt instructions appended:
- Before suggesting new conditions, check if reported symptoms match listed medication side effects and call that out explicitly.
- When a symptom appears in the history with duration ≥7 days OR shows worsening trend, escalate the triage recommendation one level.
- Tailor probabilities to the active profile's age/sex (e.g. fever red flags differ for infants vs. adults).

Data is fetched server-side inside the chat route using `supabaseAdmin` + the authenticated user id (already available there) and the `active_profile_id` passed in the request body.

Client side (`ChatWindow`): include `activeProfileId` in the chat POST body.

---

## Out of scope
- Pharmacy/Rx import (manual entry only).
- Drug-drug interaction database (we only flag side effects users entered or AI infers from common knowledge).
- Sharing profiles between accounts.
- Notifications/reminders for meds.

---

## Technical notes
- Active profile context: small React context provider mounted in `__root.tsx`, hydrates from `localStorage`, falls back to the user's `is_default=true` row.
- All queries use the browser Supabase client with RLS — no new server functions needed except the chat route enrichment.
- Recharts already installed; reuse the bucket/aggregation utility from `dashboard.tsx` (extract to `src/lib/chart-utils.ts`).
- Age computed from `date_of_birth` on the fly; no stored age.
