# Mesa — Vision & Personas

## Names (pick one)

| Name | Why it fits | Risk |
|---|---|---|
| **Mesa** (recommended) | A mesa is a flat-topped table of rock — a *table where finished work is laid out*. Short, 4 letters, reads well in a tray icon, no conflict in the dev-tool space. | Generic Spanish word; trademark search needed in USPTO class 9. |
| **Atelier** | A studio where a master and apprentices make *and show* work; the showcase system is the heart of the product. | Overused by design tools; 7 letters; accent-less spelling ambiguity. |
| **Loom** | Threads (agents) woven into cloth (deliverables); "loom" also hints at something emerging. | Conflicts with the video-messaging product Loom. |

The rest of the design uses **Mesa**.

## Product vision

Mesa is a single window where a person and an LLM agent co-work. The agent **reads, writes, runs, and shows**; the human **steers, approves, inspects, and launches**. The left rail is where you navigate work, the center is where you talk, and the right dock is where the work *lives* as artifacts you can open, run, compare, and publish. The signature moment is the **Completion Showcase**: when a turn ends with declared deliverables, a window glides in with a hero card per deliverable and one-click *Verify* (diff · preview · test) — because the agent may be wrong, verification is never more than one click away. Inspiration: Cursor Agents Window (agent-first multi-workspace), DeepSeek Harness (plugin-built right sidebar, `present` deliverables, approval takeover), Replit (one-click run + preview + publish), plus a Gallery that outlives any single session.

## Personas

| Persona | Top 3 jobs-to-be-done | Metric they care about |
|---|---|---|
| **Priya — solo developer** (indie, ships fast, lives in keyboard) | 1. Refactor a module across 12 files and *see* every hunk before trusting it. 2. Run the test suite the agent just wrote and jump to the failing line. 3. Steer mid-run without losing the thread (queue vs. inject). | **Time-to-trust** on a change (target: < 90 s from "done" to "merged"). |
| **Diego — data analyst** (Python, notebooks, SQL, little front-end) | 1. Ask for a chart and get a *re-runnable* canvas, not a PNG. 2. Inspect the dataframe the agent produced before it goes in the report. 3. Re-run last month's analysis with this month's CSV in one click. | **Rework rate** (target: < 1 in 5 deliverables needs manual correction). |
| **Maya — designer / PM who doesn't code** | 1. Turn a spec into a clickable prototype and share a link. 2. Understand *what changed* in plain language, with a before/after. 3. Never see a terminal unless she asks. | **Time-to-first-result** (target: first preview < 2 min). |
| **Sam — platform engineer** running many agents | 1. See a board of 8 agents, their cost, and who is blocked on whom. 2. Lock down permissions per repo with audit trail. 3. Schedule nightly agent runs that open PRs. | **Cost per merged change** and **zero permission incidents**. |

## Product principles

1. **Show, don't tell** — every claim the agent makes can be turned into a rendered artifact or a test result in one click.
2. **Verify is one click away** — diff, preview, and test are reachable from every Run card, every deliverable card, and every tool call.
3. **Every flourish has a job and an off-switch** — see the "Purpose / Off-switch" columns throughout.
4. **One ledger** — the session is an append-only event log; every pane is a projection of it.
5. **Platform, not monolith** — every panel in this document is a plugin registering into a named slot.
