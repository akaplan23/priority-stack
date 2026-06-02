# Priority Stack — Deferred Improvements

Items flagged during development that are intentionally deferred. Add new entries as they come up. Remove or mark complete when built.

---

## Freeform Input

**Project linking via freeform text**
When a user mentions a project name in freeform input, the task should automatically link to that project via `project_id`. Requires the Route Handler to fetch existing projects from Supabase, pass them to Claude as context, and match the mentioned name to a real project record using semantic similarity — not just exact name matching. "Judy diamond - data enrich" should match "data enrichment project." "govspend discovery" should match a project whose description contains "govspend."
Deferred: Phase 3 — not blocking daily use, can work around with structured form for project-linked tasks.

---

## Structured Input

**AI parsing on structured input**
Currently the structured form is purely manual — no AI involvement. Every input mode should run through Claude. Options: (1) Claude reviews and enhances what you've entered before saving, or (2) structured form becomes a confirmation/edit step after AI parsing rather than a primary input method.
Deferred: Phase 3 completion or Phase 4.

---

## UI / UX

**Full UI audit**
Broad review of layout, views, interactions, and visual design. Stack vs Intake redundancy is one open question. Defer until after real usage data exists.

**Competitive research**
Audit top task management tools (Todoist, Motion, Things, Linear) for UI patterns worth adopting or deliberately avoiding. Feed findings into the UI audit.

**User testing**
Get external users on the app for qualitative feedback. Defer until core loop is stable and the UI audit is complete.

---

## Scoring Algorithm

**Algorithm tuning**
Starting weights are based on logic, not empirical data. Use the app for several weeks and log specific rankings that feel wrong. Adjust weights based on real examples.
Deferred: ongoing through Phase 3 and Phase 4.

---

## Chat Feature

**Persistent AI chat for task and project management**
A conversational interface for discussing priorities, giving instructions, setting preferences, and getting recommendations. Requires: chat UI, conversation history stored in Supabase, user preferences stored and passed as context into each Claude API call. This is a meaningful standalone phase of work — not a feature addition.
Deferred: post-Phase 4. Use the app long enough to know what you'd actually want to say to it before building it.

---

## Input Channels (Future)

**Multi-channel input**
SMS via Twilio, email input, voice via Siri shortcut. All funnel into the same AI parsing layer and database. Per original build plan, defer until Phase 4 is stable.
Deferred: Phase 5.