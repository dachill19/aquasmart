# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated by the user, who asked for a modern stack and left the choice open: React + Vite
+ TypeScript + Tailwind v4 for the SPA, Hono on a Cloudflare Worker for the API, and
Cloudflare D1 for storage, deployed as one Worker with static assets. The deploy target
(Cloudflare free tier) was the user's decision and constrains the answer: Workers cannot
hold a persistent TCP connection, so MQTT is not available and the device talks over
HTTPS.

The plain HTML/CSS first attempt in this repo is an anti-reference. The user rejected it
as "kuno dan simpel banget" and it carries no visual authority.

## Users

Two audiences, both confirmed:

- **The student group** (Informatika UNS, semester 7) operating the prototype live during
  a graded demonstration, and using it while building and testing the device.
- **The lecturer** grading the final project on 11 November 2026, who will read the screen
  to judge whether the system meets the brief.

The product's own stated target users, from the group's proposal: students and workers who
leave their room for several days at a time, ornamental-fish keepers, and beginners not yet
used to fish care.

## Product Purpose

AQUASMART monitors and remotely controls a single small aquarium for ornamental fish
(betta). It exists because fish deaths usually come from owner lapses rather than disease:
irregular feeding, overfeeding that raises ammonia from rotting residue, and falling water
level from evaporation. Success is an owner who can leave for days and still know the tank
is fed and topped up, and who is told when it is not.

## Positioning

The system pairs scheduled automatic feeding with automatic water top-up and reports both
as live telemetry, rather than monitoring water conditions alone. Its own backend and
dashboard replace the third-party IoT platform the course modules used, which is an
explicit requirement of the assignment.

## Operating Context

- One NodeMCU ESP8266 on a home or boarding-house WiFi network, 2.4 GHz.
- The device posts telemetry over HTTPS and receives queued commands in the same response.
  Control latency therefore equals the telemetry interval, and that is a fact the UI must
  not pretend away.
- The device can be offline: WiFi drops, the board reboots, the pump locks itself out.
- A graded demonstration on 11 November 2026, followed by a written report that cites
  screenshots of this dashboard as Bab 5.3 evidence.
- The viewing device for the demo is not known and the user considers it unimportant; the
  dashboard must simply read clearly wherever it is opened.

## Capabilities and Constraints

**Telemetry the device reports:** water level %, raw ADC value behind it, feed stock %,
measured distance to the feed surface in cm, pump on/off, pump lock state, WiFi signal,
uptime.

**Controls the dashboard must offer:** feed now, pump on, pump off, clear the pump lock,
and settings for morning and evening feeding times, servo open duration, maximum pump run
time, and the water and feed warning thresholds.

**Hardware limits that the interface must represent honestly:**

- Feed stock resolution is poor. The full 0–100 % scale lives inside 1.5 cm of travel while
  HC-SR04 resolution is roughly 0.3 cm, so one step is about 20 % of stock.
- There is no temperature sensor, although the group's original rumusan masalah asks about
  water temperature. Nine of the board's usable pins are taken.
- The pump stops itself after its maximum run time and locks out if the water is still low;
  only a command or a refill clears that.

**Confirmed decisions:**

- No login. The user chose open access: this is coursework, and demo friction matters more
  than access control. The trade-off was raised and declined. Device telemetry still carries
  a shared key so the database cannot be poisoned by anyone who finds the URL.
- Blynk is removed from the firmware entirely. There is no fallback interface.
- One aquarium. The UI does not need a device picker.

## Brand Commitments

- Name: **AQUASMART**.
- Logo supplied by the user at `brand/logo-aquasmart.png` (1254×1254, RGBA): a stylised
  navy fish over a bright blue wave, wordmark in navy and blue.
- Deep navy `#054376` is the established project colour, carried from the group's slide
  deck. Dark theme first, by the owner's standing preference.
- Interface language is Indonesian; the report and the audience are Indonesian.

## Evidence on Hand

- `brand/logo-aquasmart.png` — the real logo.
- `FIRMWARE_FIXES.md` in the course folder — verified defects in the current firmware.
- The group's Canva deck (17 slides) with the system architecture, wiring and flowchart.
- Ten verified academic references with PDFs, in the course folder.
- The working prototype itself, assembled and powered.

No test data has been collected yet. The dashboard must therefore look correct and
complete with an empty database and with a device that has never connected, because that
is its state today.

## Product Principles

1. **Say what is actually known.** A number that is stale, coarse, or missing is shown as
   such. Never render a confident value the sensor cannot support.
2. **Offline is a normal state, not an error screen.** The device drops off often; the
   dashboard stays useful and says when it last heard anything.
3. **A control is a request, not a result.** Commands queue until the device collects them,
   so the interface shows the queue honestly rather than faking instant action.
4. **Readable before dense.** The screen is judged at a glance by someone who did not build
   it.
5. **One aquarium, no abstraction.** No device switcher, no tenancy, no settings that exist
   only to look configurable.

## Accessibility & Inclusion

No product-specific standard was established. General requirement only: the dashboard must
stay legible at whatever size it is opened, since the demo screen is unknown.
