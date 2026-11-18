# Multi-aquarium support with simulated nodes

## Intent

The lecturer asked for the system to be scalable. The team owns one physical
prototype. The goal is to show, during the live presentation, that the server,
database and dashboard handle several aquariums through one code path, with the
extra aquariums driven by a simulator that speaks the device protocol exactly as
the ESP8266 does. There is no time for rework, so the change must be correct the
first time and must not break the real device.

## Goals

- Every reading, command, event and setting belongs to one aquarium.
- The real ESP8266 keeps working with its current firmware and current key, as
  Akuarium 01. No re-flash.
- A simulator script on the laptop runs Akuarium 02 and 03 through the public
  `/api/telemetry` endpoint, each with its own key, during the presentation.
- The dashboard shows all aquariums at a glance and switches every panel
  (vessels, controls, chart, activity, settings) to the selected one.
- Simulated aquariums are clearly labelled "Simulasi" everywhere they appear.

## Non-goals

- Login or per-user access (explicitly declined earlier).
- Adding or removing aquariums from the dashboard. New devices are added with
  one SQL insert.
- A simulator that runs in the cloud. It runs only while the laptop runs it.
- Changes to the lab report (Dylan's area).

## Anti-goals

- Any data shown on the dashboard that does not come from the database.
- One aquarium's command, ack or setting reaching another aquarium.
- Losing or corrupting the existing production data during migration.

## Approaches considered

1. **Dummy aquariums in the dashboard only.** Fast, but proves nothing about the
   backend and risks looking like fabricated data. Rejected by the user.
2. **Multi-device backend, simulator in the cloud (cron).** Always online, but
   adds a scheduled worker for a need the user does not have: the lecturer sees
   it only during the presentation.
3. **Multi-device backend, simulator as a laptop script (chosen).** Same API path
   as the real device, simplest to run, honest. Simulated aquariums go offline
   when the script stops, which is accepted.

## Design

### Database (D1)

- New table `devices (id INTEGER PRIMARY KEY, name TEXT NOT NULL, simulated
  INTEGER NOT NULL DEFAULT 0, key_hash TEXT UNIQUE)`.
  - Row 1: `Akuarium 01`, real, `key_hash` NULL. It is authenticated by the
    existing `DEVICE_KEY` Worker secret, so the real key never enters the repo.
  - Rows 2 and 3: `Akuarium 02`, `Akuarium 03`, simulated, `key_hash` = SHA-256
    hex of their keys. Plain keys live only in the gitignored
    `simulator/devices.json`.
- `readings`, `commands`, `events` gain `device_id INTEGER NOT NULL DEFAULT 1`.
  Existing rows therefore belong to Akuarium 01.
- Indexes: `readings (device_id, ts DESC)`, `commands (device_id, acked_at, id)`,
  `events (device_id, ts DESC)`. The global unique index on `events.ext_id`
  stays; event ids carry a random per-boot marker, so devices do not collide.
- `settings` is rebuilt with primary key `(device_id, key)`. Existing values go to
  device 1; devices 2 and 3 get the schema defaults.
- `schema.sql` (fresh installs and tests) describes the final shape directly.
- Production gets a one-off migration file, `migrations/2026-11-18-multi-device.sql`,
  run once with `wrangler d1 execute --remote --file`, after a full
  `wrangler d1 export` backup. The new Worker is deployed right after it.

### Worker

- Device identity comes from `x-device-key`: equal to `DEVICE_KEY` means device 1,
  otherwise its SHA-256 must match a `devices.key_hash`. No match: 401.
- `/api/telemetry`: writes the reading and events with that `device_id`; acks only
  that device's commands (`WHERE id IN (...) AND device_id = ?`); hands back only
  that device's pending commands and settings. Response shape is unchanged, so the
  firmware needs no change.
- `/api/command`: body gains `device` (required, must exist). Settings validation
  (ranges and calibration pairs) runs against that device's stored settings.
- `/api/latest?device=N` and `/api/history?device=N`: scoped to N; `device`
  defaults to 1 so an old dashboard tab keeps working; unknown device is 404.
- New `/api/devices`: every device with id, name, simulated flag and its latest
  reading's ts, level_air, stok_pakan, pompa, terkunci (or null).
- Reading cleanup (7 days) and command expiry (10 minutes) are unchanged and apply
  to every device.

### Telegram bot

- `/pakan`, `/pompa`, `/buka` act on Akuarium 01, the real device, as today.
- `/status` lists every aquarium (name, online/offline, water, feed, pump), with
  simulated ones marked.
- Alerts from simulated devices are prefixed with the aquarium name and
  "(simulasi)", so a demo never reads as a real alarm. Real-device alerts gain the
  aquarium name only.

### Dashboard

- A fleet strip under the top bar: one card per aquarium with name, online dot,
  water %, feed %, pump state, and a "Simulasi" badge where it applies. Clicking a
  card selects it. On phones the strip scrolls horizontally.
- The selected aquarium is kept in the URL (`?akuarium=2`), so a refresh or a
  shared link keeps it; default is 1.
- Every existing panel reads the selected aquarium. Switching clears the previous
  aquarium's data at once (no flash of the old numbers), and the settings form is
  remounted so unsaved edits never carry over to another aquarium.
- `StatusHero` shows the selected aquarium's name and the "Simulasi" badge instead
  of the fixed "Akuarium 01".
- Styling follows Dylan's design tokens and components; no new dependency.

### Simulator (`simulator/simulate.mjs`, `npm run simulate`)

- Plain Node (built-in `fetch`), no dependency. Reads `simulator/devices.json`
  (gitignored; `devices.example.json` is committed) with the server URL and each
  simulated device's name and key.
- Every 5 s per device, it posts the same JSON the firmware posts, applies the
  returned settings, runs returned commands and acks them next cycle, exactly like
  the firmware.
- Behaviour that makes the demo visible within minutes: water drops slowly; below
  `batas_air` the pump turns on automatically and fills toward `target_air`, capped
  at `durasi_pompa`; a feed command opens for `durasi_pakan` and lowers feed stock;
  low feed raises one `critical_food` event per crossing; unlock clears a lock.
  Each device starts from a different state so the cards differ.
- Ctrl+C stops it; the dashboard then shows those aquariums offline after 60 s.

## Verification

- Node tests on the real Worker over `schema.sql` in `node:sqlite`, extended with:
  unknown key rejected; a simulated key writes only its own device; acks cannot
  touch another device's commands; pending commands and settings are per device;
  `/api/latest`, `/api/history` and `/api/devices` are scoped correctly; settings
  validation uses the target device's stored values.
- Migration rehearsed on a local copy of the production export before it runs on
  production; row counts compared before and after.
- Dashboard checked in the browser with the simulator running against the local
  dev server: switching, controls, settings save per aquarium, phone width.
- After production migration and deploy: real device still reports as Akuarium 01,
  simulator drives 02 and 03 on the live site.

## Builder's calls (made in this design, open to correction)

- Device ids 1, 2, 3 and names "Akuarium 01/02/03".
- Simulator cadence 5 s, matching the firmware; offline threshold stays 60 s.
- URL parameter name `akuarium`.
- Telegram control stays on the real device only.
