---
version: 1
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

THESIS: The tank keeps an official record of itself. Every command is a filed entry that
is provisional until the device validates it, so the screen tells the truth about queued
control instead of flattering the button press. It refuses the category default of floating
metric cards on a shadowed grid with one blue accent.

OWN-WORLD: The Indonesian institutional form — KRS, kartu kendali, the stamped record
sheet. Carbon ground (#091726) under official blue (#054376, the project's own navy) with
a lighter blue for live values and stamp red (#E2515E) reserved for exceptions and the
validation mark. Light mode is the same form printed on paper rather than a recolour: warm
white ground, the same two inks, the same rules. Hairline rules at every boundary, no
shadows, no rounded cards, no floating. Numbers are tabular and monospaced; labels are
small, letter-spaced uppercase. Density is high and ruled, aligned to one grid.

STORY: The visitor reads water level and feed stock as two monumental live figures, sees
immediately whether the pump is locked, acts, and then watches the record line go from
MENUNGGU ALAT to a stamped SAH with the server's own timestamp.

FIRST VIEWPORT: A ruled header carrying the logo, the record title, and the last-heard-from
line at the right. Below it a three-column band: water level and feed stock as 100px+
tabular figures over segmented gauge bars with their raw sensor readings beneath, then a
right column of standard buttons (feed now, pump on/off, unlock) over the current schedule.
Under that, full width, the record table: time, entry, duration drawn as a bar whose length
is the real elapsed seconds, and a validation column holding either a rotated red SAH stamp
or a dashed MENUNGGU ALAT.

FORM: Candidate 7 of seven grounded directions, assigned by the roll over my own top pick
(Papan Duga Air). Raised by four declined challengers: duration as physical length
(Labanotation), hairline module discipline (Japanese high-density web), user-marked state
persisted (doujin catalog), one monumental live value beside an exact monospace readout
(variable font specimen). seed:bfd5e7681300bb3b

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review,
the verdict, DESIGN.md, and every shipping raster carrying its provenance.

## Unresolved

- Whether the lecturer opens it on a projector, a laptop, or a phone is unknown, so no
  viewport is privileged; the layout has to hold at all three.
- No real telemetry exists yet. Empty and never-connected states are first-class, not
  afterthoughts.
