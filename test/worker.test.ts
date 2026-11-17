// Runs the real worker against schema.sql in an in-memory SQLite, so the SQL is
// exercised too. Node strips the types itself: `npm test`, no extra tooling.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import app from "../src/worker/index.ts";

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
  const pending: Promise<unknown>[] = [];
  const ctx = { waitUntil: (p: Promise<unknown>) => pending.push(p), passThroughOnException() {} };
  const env = { DB: fakeD1(db), DEVICE_KEY: "k" };
  const call = async (path: string, body?: unknown, headers: Record<string, string> = {}) => {
    const init = body === undefined ? {} : { method: "POST", body: JSON.stringify(body), headers };
    const res = await app.request(path, init, env, ctx as any);
    await Promise.all(pending);
    return { status: res.status, json: (await res.json()) as any };
  };
  const telemetry = () => call("/api/telemetry", {}, { "x-device-key": "k" });
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
  const res = await call("/api/command", { type: "settings", payload: { air_kering: 300, air_basah: 250 } });
  assert.equal(res.status, 400);
});
