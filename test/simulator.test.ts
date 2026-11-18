// The simulator's device behaviour, without a network: each test drives the
// state machine directly, the way the 5-second loop does.
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyResponse, buildTelemetry, createDevice, postOnce, tick } from "../simulator/simulate.mjs";

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
  const a = createDevice({ level: 60, stock: 10 });
  const b = createDevice({ level: 60, stock: 10 });
  applyResponse(a, { settings: { batas_pakan: 30 }, commands: [] }, 0);
  applyResponse(b, { settings: { batas_pakan: 30 }, commands: [] }, 0);
  tick(a, 5000);
  tick(b, 5000);
  const ids = [...(buildTelemetry(a, 5000) as any).events, ...(buildTelemetry(b, 5000) as any).events].map((e: any) => e.id);
  assert.ok(ids.length >= 2);
  assert.equal(new Set(ids).size, ids.length);
});

test("a rejected post is logged and retried, not thrown", async () => {
  const s = createDevice({ level: 60, stock: 10 });
  applyResponse(s, { settings: { batas_pakan: 30 }, commands: [] }, 0);
  const fakeFetch = async () => new Response('{"error":"unauthorized"}', { status: 401 });
  await assert.doesNotReject(postOnce({ server: "http://x", key: "bad", name: "T" }, s, fakeFetch, () => {}));
  // Nothing was delivered, so the queued event is still waiting for the next post.
  assert.ok((buildTelemetry(s, 5000) as any).events.length >= 1);
});
