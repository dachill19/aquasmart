// Runs the real worker against schema.sql in an in-memory SQLite, so the SQL is
// exercised too. Node strips the types itself: `npm test`, no extra tooling.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import app from "../src/worker/index.ts";
import { pesanEvent } from "../src/worker/telegram.ts";

const MIN = 60_000;
const DAY = 24 * 60 * MIN;

/** The slice of the D1 API the worker uses, backed by node:sqlite. */
function fakeD1(db: DatabaseSync) {
  const stmt = (sql: string, args: unknown[] = []): any => ({
    bind: (...a: unknown[]) => stmt(sql, a),
    run: async () => {
      const r = db.prepare(sql).run(...(args as any[]));
      return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } };
    },
    all: async () => ({ results: db.prepare(sql).all(...(args as any[])) }),
    first: async () => db.prepare(sql).get(...(args as any[])) ?? null,
  });
  return { prepare: (sql: string) => stmt(sql), batch: async (s: any[]) => Promise.all(s.map((x) => x.run())) };
}

function setup() {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(new URL("../schema.sql", import.meta.url), "utf8"));
  // A known key for simulated device 2, so tests do not depend on the real simulator keys.
  db.prepare("UPDATE devices SET key_hash = ? WHERE id = 2").run(createHash("sha256").update("sim2").digest("hex"));
  const pending: Promise<unknown>[] = [];
  const ctx = { waitUntil: (p: Promise<unknown>) => pending.push(p), passThroughOnException() {} };
  const env = { DB: fakeD1(db), DEVICE_KEY: "k" };
  const call = async (path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const init = body === undefined ? {} : { method: "POST", body: JSON.stringify(body), headers };
    const res = await app.request(path, init, env, ctx as any);
    await Promise.all(pending);
    return { status: res.status, json: (await res.json()) as any };
  };
  const telemetry = (key = "k", body: Record<string, unknown> = {}) =>
    call("/api/telemetry", body, { "x-device-key": key });
  return { db, call, telemetry };
}

test("a command older than 10 minutes is not handed to the device", async () => {
  const { db, telemetry } = setup();
  const now = Date.now();
  db.prepare("INSERT INTO commands (ts, type, payload) VALUES (?, 'feed', '{}')").run(now - 11 * MIN);
  db.prepare("INSERT INTO commands (ts, type, payload) VALUES (?, 'unlock', '{}')").run(now - MIN);

  const { json } = await telemetry();
  assert.deepEqual(json.commands.map((c: any) => c.type), ["unlock"]);
});

test("the dashboard sees a stale command as expired, not as waiting", async () => {
  const { db, call } = setup();
  db.prepare("INSERT INTO commands (ts, type, payload) VALUES (?, 'feed', '{}')").run(Date.now() - 11 * MIN);
  db.prepare("INSERT INTO commands (ts, type, payload) VALUES (?, 'unlock', '{}')").run(Date.now());

  const { json } = await call("/api/latest");
  const byType = Object.fromEntries(json.commands.map((c: any) => [c.type, c.expired]));
  assert.deepEqual(byType, { feed: 1, unlock: 0 });
});

test("readings older than 7 days are deleted when the device reports", async () => {
  const { db, telemetry } = setup();
  db.prepare("INSERT INTO readings (ts) VALUES (?)").run(Date.now() - 8 * DAY);
  db.prepare("INSERT INTO readings (ts) VALUES (?)").run(Date.now() - 6 * DAY);

  await telemetry();
  const left = db.prepare("SELECT COUNT(*) AS n FROM readings").get() as { n: number };
  assert.equal(left.n, 2); // the 6-day-old row and the one just posted
});

test("a settings change that inverts a calibration pair is refused", async () => {
  const { call } = setup();
  const res = await call("/api/command", { device: 1, type: "settings", payload: { air_kering: 300, air_basah: 250 } });
  assert.equal(res.status, 400);
});

test("an unknown device key is rejected", async () => {
  const { call } = setup();
  const res = await call("/api/telemetry", {}, { "x-device-key": "nope" });
  assert.equal(res.status, 401);
});

test("a simulated key writes readings to its own device only", async () => {
  const { db, telemetry } = setup();
  await telemetry("sim2", { level_air: 40 });
  await telemetry("k", { level_air: 70 });
  const rows = db.prepare("SELECT device_id, level_air FROM readings ORDER BY device_id").all() as any[];
  assert.deepEqual(rows.map((r) => [r.device_id, r.level_air]), [[1, 70], [2, 40]]);
});

test("a device cannot ack another device's command", async () => {
  const { db, telemetry } = setup();
  const id = Number(
    db.prepare("INSERT INTO commands (ts, type, payload, device_id) VALUES (?, 'feed', '{}', 1)").run(Date.now()).lastInsertRowid
  );
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

test("commands and settings go to the requested device", async () => {
  const { db, call } = setup();
  assert.equal((await call("/api/command", { device: 2, type: "settings", payload: { batas_air: 40 } })).status, 200);
  assert.equal((await call("/api/command", { device: 2, type: "feed" })).status, 200);
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

test("alerts name the aquarium and flag simulated ones", () => {
  assert.match(pesanEvent("critical_water", "x", { name: "Akuarium 02", simulated: 1 })!, /^\[Akuarium 02 \(simulasi\)\] /);
  assert.match(pesanEvent("critical_food", "x", { name: "Akuarium 01", simulated: 0 })!, /^\[Akuarium 01\] PERINGATAN PAKAN/);
  assert.equal(pesanEvent("info", "x", { name: "Akuarium 01", simulated: 0 }), null);
});

test("one device's event id cannot suppress another device's event", async () => {
  const { db, telemetry } = setup();
  const ev = { id: "abc-1", kind: "critical_water", message: "x" };
  await telemetry("sim2", { events: [ev] });
  await telemetry("k", { events: [ev] });
  const rows = db.prepare("SELECT device_id FROM events ORDER BY device_id").all() as any[];
  assert.deepEqual(rows.map((r) => r.device_id), [1, 2]);
});
