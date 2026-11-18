# Multi-aquarium Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scope every reading, command, event and setting to an aquarium, run Akuarium 02 and 03 from a laptop simulator through the real device API, and let the dashboard show and switch between all aquariums.

**Architecture:** A `devices` table identifies aquariums; the Worker resolves the device from `x-device-key` (the existing `DEVICE_KEY` secret is device 1) and scopes every query by `device_id`. The dashboard polls `/api/devices` for the fleet strip and passes the selected device to every other endpoint. A dependency-free Node script plays the simulated devices.

**Tech Stack:** Cloudflare Workers + Hono 4, D1 (SQLite), React 19 + Tailwind 4 + Vite 8, Node 24 (`node:test`, `node:sqlite`, built-in `fetch`).

**Spec:** `docs/superpowers/specs/2026-11-18-multi-aquarium-design.md`

## Global Constraints

- The real ESP8266 firmware and its `DEVICE_KEY` stay unchanged; it is device 1, "Akuarium 01".
- Simulated devices: id 2 "Akuarium 02", id 3 "Akuarium 03", `simulated = 1`, labelled "Simulasi" in the UI and "(simulasi)" in Telegram.
- Device keys for simulated devices are stored only as SHA-256 hex in `devices.key_hash`; plain keys only in gitignored `simulator/devices.json`.
- No new npm dependency.
- Telemetry response JSON shape unchanged (firmware compatibility).
- Simulator cadence 5000 ms; offline threshold stays 60 000 ms; command TTL stays 10 min; readings kept 7 days.
- URL parameter `akuarium`; default device 1.
- Code, comments and commits in English; UI copy in Indonesian.
- Commit messages carry no AI attribution (user's CLAUDE.md).

## Review Focus

1. A key for device 2 acking a command id that belongs to device 1 must not ack it. Test in Task 1.
2. `?akuarium=99` or a deleted device: dashboard falls back to device 1 instead of a blank page; API answers 404. Tests in Task 2 (API) and a browser check in Task 5.
3. Switching aquarium with unsaved settings: the draft must not be saved to the newly selected aquarium. Browser check in Task 5 (form remounts on switch).
4. Simulator started with a wrong key or before migration: it logs the 401 per device and keeps retrying, never crashes. Test in Task 4.
5. Two simulated devices raising events at once: their `ext_id`s never collide (random per-run marker per device). Test in Task 4.

---

### Task 1: Device identity and per-device telemetry

**Files:**
- Modify: `schema.sql` (final shape for fresh installs/tests)
- Create: `migrations/2026-11-18-multi-device.sql` (one-off production migration)
- Modify: `src/worker/index.ts` (device resolution, `/api/telemetry` scoping, `readSettings`)
- Test: `test/worker.test.ts`

**Interfaces:**
- Produces: table `devices(id, name, simulated, key_hash)`; column `device_id` on `readings`, `commands`, `events`; `settings(device_id, key, value, PRIMARY KEY(device_id, key))`.
- Produces: `async function resolveDevice(env: Bindings, key: string | undefined): Promise<number | null>` and `async function readSettings(db: D1Database, deviceId: number): Promise<Settings>` in `src/worker/index.ts`; `export async function sha256Hex(text: string): Promise<string>`.
- Test helper in `test/worker.test.ts`: `setup()` runs `UPDATE devices SET key_hash = ? WHERE id = 2` with `createHash("sha256").update("sim2").digest("hex")` (node:crypto), so the test does not depend on the real simulator keys; `telemetry(key = "k", body = {})`.

- [ ] **Step 1: Write the failing tests**

```ts
test("an unknown device key is rejected", async () => {
  const { call } = setup();
  const res = await call("/api/telemetry", {}, { "x-device-key": "nope" });
  assert.equal(res.status, 401);
});

test("a simulated key writes readings to its own device only", async () => {
  const { db, telemetry } = setup();
  await telemetry("sim2", { level_air: 40 });
  await telemetry("k", { level_air: 70 });
  const rows = db.prepare("SELECT device_id, level_air FROM readings ORDER BY device_id").all();
  assert.deepEqual(rows.map((r: any) => [r.device_id, r.level_air]), [[1, 70], [2, 40]]);
});

test("a device cannot ack another device's command", async () => {
  const { db, telemetry } = setup();
  const id = Number(db.prepare("INSERT INTO commands (ts, type, payload, device_id) VALUES (?, 'feed', '{}', 1)").run(Date.now()).lastInsertRowid);
  await telemetry("sim2", { ack: [id] });
  const row = db.prepare("SELECT acked_at FROM commands WHERE id = ?").get(id) as any;
  assert.equal(row.acked_at, null);
});

test("pending commands and settings are handed out per device", async () => {
  const { db, telemetry } = setup();
  db.prepare("INSERT INTO commands (ts, type, payload, device_id) VALUES (?, 'feed', '{}', 1)").run(Date.now());
  db.prepare("INSERT INTO commands (ts, type, payload, device_id) VALUES (?, 'unlock', '{}', 2)").run(Date.now());
  db.prepare("UPDATE settings SET value = '45' WHERE device_id = 2 AND key = 'batas_air'").run();
  const { json } = await telemetry("sim2");
  assert.deepEqual(json.commands.map((c: any) => c.type), ["unlock"]);
  assert.equal(json.settings.batas_air, 45);
});
```

Existing tests keep passing with `telemetry()` defaulting to key `"k"` (device 1).

- [ ] **Step 2: Run tests, expect the four new ones to FAIL**

Run: `npm test` — Expected: 4 failures (no `devices` table / no `device_id`).

- [ ] **Step 3: Update `schema.sql`**

`devices` table with rows (1,'Akuarium 01',0,NULL), (2,'Akuarium 02',1,'<hash>'), (3,'Akuarium 03',1,'<hash>'); `device_id INTEGER NOT NULL DEFAULT 1` on readings/commands/events; indexes `idx_readings_device_ts (device_id, ts DESC)`, `idx_commands_device_pending (device_id, acked_at, id)`, `idx_events_device_ts (device_id, ts DESC)`; settings keyed `(device_id, key)` seeded with today's defaults for each of the three devices. Keep the existing `idx_readings_ts` (cleanup) and `idx_events_ext`. The hashes come from Task 4 Step 1's generated keys; until then schema.sql and the migration carry placeholder hashes, replaced in Task 4.

- [ ] **Step 4: Implement in `src/worker/index.ts`**

`sha256Hex` via `crypto.subtle.digest("SHA-256", …)` hex-encoded. `resolveDevice`: key equal to `env.DEVICE_KEY` (and non-empty) → 1; else `SELECT id FROM devices WHERE key_hash = ?`. `/api/telemetry` uses the resolved id for the reading insert, event insert, ack update (`AND device_id = ?`), pending query (`AND device_id = ?`), `sent_at` update, and `readSettings(db, id)`.

- [ ] **Step 5: Write `migrations/2026-11-18-multi-device.sql`**

Order: `CREATE TABLE devices` + 3 inserts; `ALTER TABLE readings/commands/events ADD COLUMN device_id INTEGER NOT NULL DEFAULT 1`; create the three indexes; `CREATE TABLE settings_new`; copy existing settings as device 1; insert device 1's current values for any default key it lacks; seed devices 2 and 3 with schema defaults; `DROP TABLE settings`; `ALTER TABLE settings_new RENAME TO settings`. No `BEGIN/COMMIT` (D1 runs a file atomically).

- [ ] **Step 6: Run tests, expect all PASS**

Run: `npm test` — Expected: `pass 8, fail 0`.

- [ ] **Step 7: Commit**

`git add schema.sql migrations src/worker/index.ts test/worker.test.ts` — message: `Scope telemetry to the device that sent it`.

### Task 2: Per-device dashboard API

**Files:**
- Modify: `src/worker/index.ts` (`/api/command`, `/api/latest`, `/api/history`, new `/api/devices`)
- Test: `test/worker.test.ts`

**Interfaces:**
- Consumes: `readSettings(db, deviceId)` from Task 1.
- Produces: `GET /api/devices` → `{ devices: DeviceSummary[] }`; exported type `DeviceSummary = { id: number; name: string; simulated: number; ts: number | null; level_air: number | null; stok_pakan: number | null; pompa: number | null; terkunci: number | null }`.
- Produces: `POST /api/command` body `{ device: number, type, payload }`; `GET /api/latest?device=N`; `GET /api/history?device=N&limit=…`. Unknown device → 404 `{ error: "akuarium tidak ada" }`. Missing `device` on command → 400.

- [ ] **Step 1: Write the failing tests**

```ts
test("commands and settings go to the requested device", async () => {
  const { db, call } = setup();
  await call("/api/command", { device: 2, type: "settings", payload: { batas_air: 40 } });
  await call("/api/command", { device: 2, type: "feed" });
  const s = db.prepare("SELECT device_id, value FROM settings WHERE key = 'batas_air' ORDER BY device_id").all() as any[];
  assert.deepEqual(s.map((r) => [r.device_id, r.value]), [[1, "30"], [2, "40"], [3, "30"]]);
  const c = db.prepare("SELECT device_id, type FROM commands ORDER BY id").all() as any[];
  assert.deepEqual(c.map((r) => [r.device_id, r.type]), [[2, "settings"], [2, "feed"]]);
});

test("a command without a known device is refused", async () => {
  const { call } = setup();
  assert.equal((await call("/api/command", { type: "feed" })).status, 400);
  assert.equal((await call("/api/command", { device: 99, type: "feed" })).status, 404);
});

test("calibration pairs are checked against the target device's settings", async () => {
  const { db, call } = setup();
  db.prepare("UPDATE settings SET value = '500' WHERE device_id = 1 AND key = 'air_basah'").run();
  const res = await call("/api/command", { device: 2, type: "settings", payload: { air_kering: 300 } });
  assert.equal(res.status, 400); // device 2 still has air_basah 210
});

test("latest, history and devices are scoped and summarised per device", async () => {
  const { call, telemetry } = setup();
  await telemetry("sim2", { level_air: 40 });
  await telemetry("k", { level_air: 70 });
  assert.equal((await call("/api/latest?device=2")).json.reading.level_air, 40);
  assert.equal((await call("/api/latest")).json.reading.level_air, 70);
  assert.equal((await call("/api/latest?device=99")).status, 404);
  assert.deepEqual((await call("/api/history?device=2")).json.readings.map((r: any) => r.level_air), [40]);
  const { devices } = (await call("/api/devices")).json;
  assert.deepEqual(devices.map((d: any) => [d.id, d.simulated, d.level_air]), [[1, 0, 70], [2, 1, 40], [3, 1, null]]);
});
```

Update the existing tests that call `/api/command` or `/api/latest` to pass `device: 1` / rely on the default.

- [ ] **Step 2: Run, expect the new tests to FAIL** — `npm test`.

- [ ] **Step 3: Implement.** `deviceExists(db, id)` helper; parse `device` from query with default 1 for GET routes, required integer for POST. `/api/devices` in one query: `devices LEFT JOIN readings r ON r.id = (SELECT id FROM readings WHERE device_id = d.id ORDER BY ts DESC LIMIT 1) ORDER BY d.id`.

- [ ] **Step 4: Run, expect all PASS** — `npm test`.

- [ ] **Step 5: Commit** — `Scope the dashboard API to one aquarium and list the fleet`.

### Task 3: Telegram across devices

**Files:**
- Modify: `src/worker/telegram.ts`, `src/worker/index.ts` (pass device name/flag to `pesanEvent`)
- Test: `test/worker.test.ts`

**Interfaces:**
- Produces: `pesanEvent(kind: string, message: string, device: { name: string; simulated: number }): string | null` — text starts with `"[Akuarium 02 (simulasi)] "` for simulated devices, `"[Akuarium 01] "` otherwise.
- Bot commands queue with `device_id = 1`; `/status` iterates `devices` and prints one block per aquarium.

- [ ] **Step 1: Failing test**

```ts
test("alerts name the aquarium and flag simulated ones", () => {
  assert.match(pesanEvent("critical_water", "x", { name: "Akuarium 02", simulated: 1 })!, /^\[Akuarium 02 \(simulasi\)\] /);
  assert.match(pesanEvent("critical_food", "x", { name: "Akuarium 01", simulated: 0 })!, /^\[Akuarium 01\] PERINGATAN PAKAN/);
  assert.equal(pesanEvent("info", "x", { name: "Akuarium 01", simulated: 0 }), null);
});
```

- [ ] **Step 2: Run, expect FAIL.** **Step 3: Implement** (`antreanPerintah` inserts `device_id = 1`; `pompaSedangNyala` reads device 1; `laporanStatus` loops devices). **Step 4: Run, PASS.** **Step 5: Commit** — `Name the aquarium in Telegram alerts and status`.

### Task 4: Device simulator

**Files:**
- Create: `simulator/simulate.mjs`, `simulator/devices.example.json`, `test/simulator.test.ts`
- Create (gitignored): `simulator/devices.json`
- Modify: `.gitignore` (`simulator/devices.json`), `package.json` (`"simulate": "node simulator/simulate.mjs"`, test script runs both test files), `schema.sql` + migration (real hashes)

**Interfaces:**
- Produces (exported from `simulate.mjs`): `createDevice(seed: { level: number; stock: number }): State`; `buildTelemetry(state: State, now: number): object` (same fields as firmware: level_air, raw_water, stok_pakan, jarak_pakan, pompa, terkunci, status_air, status_pakan, rssi, uptime_ms, events, ack); `applyResponse(state: State, resp: { settings, commands }, now: number): void`; `tick(state: State, now: number): void`; `run(config)` (main loop, only when executed directly).
- Config `devices.json`: `{ "server": "https://aquasmart.daffa-hasanal.workers.dev", "devices": [{ "name": "Akuarium 02", "key": "…", "level": 62, "stock": 80 }, { "name": "Akuarium 03", "key": "…", "level": 35, "stock": 25 }] }`.

- [ ] **Step 1: Generate keys and hashes** — `node -e` with `crypto.randomBytes(24).toString("base64url")`; write plain keys to `simulator/devices.json`, put SHA-256 hex into `schema.sql` and the migration.

- [ ] **Step 2: Failing tests (`test/simulator.test.ts`)**

```ts
test("low water starts the pump, which fills toward the target", () => {
  const s = createDevice({ level: 20, stock: 80 });
  applyResponse(s, { settings: { batas_air: 30, target_air: 80, durasi_pompa: 60 }, commands: [] }, 0);
  for (let t = 0; t <= 20_000; t += 5000) tick(s, t);
  const body: any = buildTelemetry(s, 20_000);
  assert.equal(body.pompa, 1);
  assert.ok(body.level_air > 20);
});

test("a feed command lowers stock, reports feed_done and is acked next post", () => {
  const s = createDevice({ level: 60, stock: 80 });
  applyResponse(s, { settings: { durasi_pakan: 3 }, commands: [{ id: 7, type: "feed", payload: {} }] }, 0);
  tick(s, 5000);
  const body: any = buildTelemetry(s, 5000);
  assert.deepEqual(body.ack, [7]);
  assert.ok(body.stok_pakan < 80);
  assert.ok(body.events.some((e: any) => e.kind === "feed_done"));
});

test("two devices never produce the same event id", () => {
  const a = createDevice({ level: 60, stock: 10 }), b = createDevice({ level: 60, stock: 10 });
  applyResponse(a, { settings: { batas_pakan: 30 }, commands: [] }, 0);
  applyResponse(b, { settings: { batas_pakan: 30 }, commands: [] }, 0);
  tick(a, 5000); tick(b, 5000);
  const ids = [...buildTelemetry(a, 5000).events, ...buildTelemetry(b, 5000).events].map((e: any) => e.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("a rejected post is logged and retried, not thrown", async () => {
  const s = createDevice({ level: 60, stock: 80 });
  const fakeFetch = async () => new Response('{"error":"unauthorized"}', { status: 401 });
  await assert.doesNotReject(postOnce({ server: "http://x", key: "bad", name: "T" }, s, fakeFetch));
});
```

(Adds export `postOnce(device, state, fetchImpl): Promise<void>`.)

- [ ] **Step 3: Run, FAIL.** **Step 4: Implement** — physics per spec: water −0.6 %/tick idle, +4 %/tick while pumping; pump auto-on below `batas_air` after 3 low ticks, off at `target_air` or after `durasi_pompa`; lock when still below `batas_air` after a timed-out run; feed opens `durasi_pakan` s and lowers stock 4 %; one `critical_food` per crossing below `batas_pakan` with 8 % hysteresis; RSSI −52…−68; ack list cleared only after a 200. **Step 5: Run, PASS.** **Step 6: Commit** — `Add a simulator that plays extra aquariums through the device API`.

### Task 5: Fleet strip and per-aquarium dashboard

**Files:**
- Modify: `src/react-app/lib/api.ts`, `src/react-app/App.tsx`, `src/react-app/components/StatusHero.tsx`, `src/react-app/components/ControlDeck.tsx`, `src/react-app/components/SettingsStudio.tsx`
- Create: `src/react-app/components/FleetStrip.tsx`

**Interfaces:**
- Consumes: `DeviceSummary`, endpoints from Task 2.
- Produces: `useDevices(intervalMs = 4000): { devices: DeviceSummary[]; error: string | null }`; `useTelemetry(device: number, intervalMs = 4000)` (resets latest/history when `device` changes, ignores responses for a previous device); `sendCommand(device: number, type, payload?)`; `FleetStrip({ devices, selected, now, onSelect })`; `StatusHero` gains `name: string; simulated: boolean`; `ControlDeck` and `SettingsStudio` gain `device: number`.

- [ ] **Step 1: Implement api.ts changes**, then App: selected id from `new URLSearchParams(location.search).get("akuarium")`, falls back to 1 when absent or not in `devices`; `history.replaceState` on select; `<SettingsStudio key={device} …>`.
- [ ] **Step 2: FleetStrip** — horizontal list of buttons (`aria-pressed` for the selected one), each: name, `Beacon` online/offline (60 s), water %, feed %, pump state, `Tag` "Simulasi" when `simulated`. Scrolls horizontally on phones. Use Dylan's tokens/classes; load the impeccable skill for the visual pass.
- [ ] **Step 3: Verify** — `npm run build` passes; with `npm run dev` + simulator pointed at `http://localhost:5173` (local DB migrated from schema.sql): switch aquariums, send feed to 02 and confirm only 02's activity shows it, save a setting on 03 and confirm 01 is unchanged, `?akuarium=99` falls back to 01, phone width has no page scroll, console clean. Screenshot.
- [ ] **Step 4: Commit** — `Show every aquarium and switch the dashboard between them`.

### Task 6: Production rollout

- [ ] **Step 1:** `npx wrangler d1 export aquasmart --remote --output <scratchpad>/backup-2026-11-18.sql`; record row counts of readings/commands/events/settings.
- [ ] **Step 2: Rehearse** — load the export into a fresh `node:sqlite` DB, run the migration file, assert row counts unchanged, all `device_id = 1`, settings has 3×13 rows with device 1 equal to the old values.
- [ ] **Step 3:** `npx wrangler d1 execute aquasmart --remote --file migrations/2026-11-18-multi-device.sql`, then immediately `npm run deploy`.
- [ ] **Step 4: Verify live** — `/api/devices` lists 3; real device (COM4) reports as device 1 within 10 s; `npm run simulate` brings 02 and 03 online on the live site; Telegram `/status` not exercised automatically (report as unchecked).
- [ ] **Step 5:** `npm test` and `npm run build` green; commit plan/spec docs; push `main`.
