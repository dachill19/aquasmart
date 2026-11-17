---
version: 2
slug: "src-react-app-app-tsx"
primary_target: "src/react-app/App.tsx"
related_targets: []
---

## Scope

The AQUASMART operator dashboard: one screen, one aquarium. Visitor mode: Operate.
Audience: the student group running the prototype, and the lecturer grading it on
11 November 2026. Task: read the tank's state at a glance, act on it, and see whether the
act landed. Constraint: the device polls, so every command waits; no login; dark and light
both ship.

## Direction contract

THESIS: The dashboard shows the tank itself. Water level and feed stock are drawn as the
physical vessels they measure, so the state reads before any number does, and the numbers
sit beside them as the exact record. It replaces the first "Kartu Kendali" direction
(ruled paper form, rotated SAH stamps), which was rejected as heavy and dated.

OWN-WORLD: Deep water at night. The project's navy (#054376) pools at the top of a near-black
blue ground like light through water; surfaces are frosted glass with hairline edges. Blue
is the live-data hue, amber is feed, red is reserved for exceptions. Light mode is the same
instrument in daylight, re-weighted for contrast rather than inverted. Geist for text, Geist
Mono for readouts, tabular figures everywhere a quantity is read.

HONESTY RULES (carried over from PRODUCT.md, expressed in the UI):
- An offline device freezes and desaturates its vessels and says "dibekukan pada pembacaan
  pukul ..."; stale numbers are never drawn as live.
- A command is a request: the Kendali trace shows the three states the server records
  (Antre, Diambil alat, Dijalankan) with their own timestamps, and Kedaluwarsa when it dies.
- Feed stock is drawn against a five-band scale and charted as a step line, because the
  sensor resolves about 20%. Durations are labelled "disetel", never as measured.
- No temperature, no invented metrics.

FIRST VIEWPORT: Frosted top bar (logo mark, wordmark, device presence pill, theme toggle);
a one-sentence verdict on the tank (baik, pakan hampir habis, pompa terkunci, tidak
terhubung) with flag chips; two large vessel cards (animated water tank with betta, pump
inlet, threshold and target flags; feed hopper with ultrasonic beam and servo gate) each
carrying the 100px+ figure and its raw sensor readout; the Kendali band beneath.

Below: vitals (WiFi grade, uptime, pump, next feeding with countdown), history chart with
toggleable series and pump-run bands, activity timeline, and a settings studio whose floating
save bar appears only while edits are unsaved.

## Unresolved

- Whether the lecturer opens it on a projector, a laptop, or a phone is unknown, so no
  viewport is privileged; the layout holds from 390 px up.
- No real telemetry exists yet. Empty and never-connected states are first-class.
