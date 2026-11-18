---
version: 2
slug: "src-react-app-app-tsx"
primary_target: "src/react-app/App.tsx"
related_targets: []
---

## Scope

The AQUASMART operator dashboard: one screen, one selected aquarium at a time, chosen from a
fleet strip under the top bar (one real prototype plus simulated ones, each labelled).
Visitor mode: Operate.
Audience: the student group running the prototype, and the lecturer grading it on
11 November 2026. Task: read the tank's state at a glance, act on it, and see whether the
act landed. Constraint: the device polls, so every command waits; no login; dark and light
both ship.

## Direction contract

THESIS: The dashboard shows the tank itself. Water level and feed stock are drawn as the
physical vessels they measure, so the state reads before any number does, and the numbers
sit beside them as the exact record. It replaces the first "Kartu Kendali" direction
(ruled paper form, rotated SAH stamps), which was rejected as heavy and dated.

OWN-WORLD: Deep water at night, kept restrained. One neutral near-black ground with the project's
navy (#054376) pooled once at the top-left; flat hairline cards with no blur, sheen or shadow;
colour spent only on data (water blue, feed amber) and exceptions (red). The single loud control
is the primary button, plain ink on ground, never a gradient or glow. Labels are sentence case,
headings carry no icon tile, status is a small tag rather than a pill. Light mode is the same
instrument in daylight, re-weighted for contrast rather than inverted. Geist for text, Geist
Mono for readouts, tabular figures wherever a quantity is read.

HONESTY RULES (carried over from PRODUCT.md, expressed in the UI):
- An offline device freezes and desaturates its vessels and says "dibekukan pada pembacaan
  pukul ..."; stale numbers are never drawn as live.
- A command is a request: the Kendali trace shows the three states the server records
  (Antre, Diambil alat, Dijalankan) with their own timestamps, and Kedaluwarsa when it dies.
- Feed stock is drawn against a five-band scale and charted as a step line, because the
  sensor resolves about 20%. Durations are labelled "disetel", never as measured.
- No temperature, no invented metrics.

LAYOUT: Edge to edge up to 2200 px. Top bar (logo mark, device presence, theme toggle); a verdict
line (baik, pakan hampir habis, pompa terkunci, tidak terhubung) with flag chips; two vessel
cards (animated water tank with betta, pump inlet, threshold and target flags; feed hopper with
ultrasonic beam and servo gate), each with the 100px+ figure, raw readout and a sparkline of the
last hour. From 1600 px the Kendali panel sits beside the vessels; below that it is a band.
Then one vitals strip (WiFi grade, uptime, pump, next feeding with countdown), the history chart
stretched to the height of the activity list, and a settings form with a label column beside
its fields and a floating save bar that appears only while edits are unsaved.

## Unresolved

- Whether the lecturer opens it on a projector, a laptop, or a phone is unknown, so no
  viewport is privileged; the layout holds from 390 px up.
- No real telemetry exists yet. Empty and never-connected states are first-class.
