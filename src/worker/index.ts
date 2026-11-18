/**
 * AQUASMART backend.
 *
 * The device posts telemetry and receives its pending commands in the same
 * response. TLS on an ESP8266 is expensive, so one round trip per cycle instead
 * of two roughly halves the cost. Control latency therefore equals the telemetry
 * interval, which the dashboard states rather than hides.
 */
import { Hono } from "hono";
import { kirimSemua, pesanEvent, tanganiWebhook } from "./telegram.ts";
import { fleetAnalytics, RANGES, type Range } from "./analytics.ts";
export type { Analytics, DeviceAnalytics, SeriesPoint } from "./analytics.ts";

type Bindings = {
  DB: D1Database;
  DEVICE_KEY?: string;
  // Telegram alerts and commands. Absent bindings simply disable the bridge,
  // so the rest of the system runs unchanged without them.
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  TELEGRAM_WEBHOOK_SECRET?: string;
};

export type Reading = {
  id: number;
  ts: number;
  level_air: number | null;
  raw_water: number | null;
  stok_pakan: number | null;
  jarak_pakan: number | null;
  pompa: number;
  terkunci: number;
  status_air: string | null;
  status_pakan: string | null;
  rssi: number | null;
  uptime_ms: number | null;
};

export type EventRow = { id: number; ts: number; kind: string; message: string };
export type CommandRow = {
  id: number;
  ts: number;
  type: string;
  payload: string | null;
  sent_at: number | null;
  acked_at: number | null;
  /** 1 when the device never collected it in time; it will never run. */
  expired: number;
};

/**
 * A command the device has not collected within this window is never handed
 * out. Without it, a feed pressed while the device was offline ran the moment
 * it reconnected, hours later and on top of the scheduled feeding.
 */
const COMMAND_TTL_MS = 10 * 60_000;

/** Raw readings are kept a week; at one per 5 s the table otherwise grows ~17k rows a day. */
const READINGS_KEEP_MS = 7 * 24 * 3600_000;
export type Settings = Record<string, number>;

/** One aquarium with its latest reading, for the dashboard's fleet strip. */
export type DeviceSummary = {
  id: number;
  name: string;
  simulated: number;
  ts: number | null;
  level_air: number | null;
  stok_pakan: number | null;
  pompa: number | null;
  terkunci: number | null;
};

/** Settings the dashboard may change, with the range each one accepts. */
const SETTING_RANGES: ReadonlyArray<readonly [string, number, number]> = [
  ["jam_pagi", 0, 23],
  ["menit_pagi", 0, 59],
  ["jam_sore", 0, 23],
  ["menit_sore", 0, 59],
  ["durasi_pakan", 1, 10],
  ["durasi_pompa", 1, 60],
  ["batas_air", 5, 95],
  ["target_air", 10, 95],
  ["batas_pakan", 5, 95],
  // Sensor calibration lives here rather than in the firmware, so re-measuring
  // the rig does not mean re-flashing it.
  ["air_kering", 0, 500],
  ["air_basah", 20, 1023],
  ["pakan_penuh_mm", 20, 600],
  ["pakan_kosong_mm", 20, 600],
];

/**
 * Calibration pairs that only mean anything in order. An inverted pair would
 * make the device scale readings backwards, so it is refused here rather than
 * left for the firmware to notice.
 */
const CALIBRATION_PAIRS: ReadonlyArray<readonly [string, string, number, string]> = [
  // Not a calibration pair as such, but the same kind of rule: a fill target at
  // or below the start threshold makes the pump stop the moment it crosses the
  // line that started it, which is how it used to short-cycle.
  ["batas_air", "target_air", 10, "Target isi harus setidaknya 10% di atas ambang pompa menyala"],
  ["air_kering", "air_basah", 20, "Pembacaan ADC basah harus setidaknya 20 di atas pembacaan kering"],
  ["pakan_penuh_mm", "pakan_kosong_mm", 10, "Jarak wadah kosong harus setidaknya 10 mm lebih jauh daripada saat penuh"],
];

const COMMAND_TYPES = ["feed", "pump", "unlock", "settings"] as const;
type CommandType = (typeof COMMAND_TYPES)[number];

const app = new Hono<{ Bindings: Bindings }>();

/**
 * Clamp a number off the wire; null when it is not usable at all.
 *
 * The explicit null check earns its place: Number(null) is 0, so without it a
 * sensor reporting "I could not read this" lands in the record as a confident
 * zero percent.
 */
function num(v: unknown, lo: number, hi: number): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(hi, Math.max(lo, n));
}

async function readSettings(db: D1Database, deviceId: number): Promise<Settings> {
  const { results } = await db
    .prepare("SELECT key, value FROM settings WHERE device_id = ?")
    .bind(deviceId)
    .all<{ key: string; value: string }>();
  const out: Settings = {};
  for (const row of results) out[row.key] = Number(row.value);
  return out;
}

async function deviceExists(db: D1Database, id: number): Promise<boolean> {
  if (!Number.isInteger(id)) return false;
  return (await db.prepare("SELECT 1 FROM devices WHERE id = ?").bind(id).first()) !== null;
}

/**
 * The aquarium a dashboard GET asks about. Absent means 1, so a tab opened
 * before multi-device support keeps showing the real device. Null when the id
 * names no aquarium.
 */
async function requestedDevice(db: D1Database, raw: string | undefined): Promise<number | null> {
  const id = raw === undefined ? 1 : Number(raw);
  return (await deviceExists(db, id)) ? id : null;
}

const NO_DEVICE = { error: "akuarium tidak ada" };

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Which aquarium a device key belongs to, or null for an unknown key. The key
 * gates writes so a stray URL cannot poison the record. The real ESP8266 keeps
 * the DEVICE_KEY secret it was flashed with and is always device 1; every other
 * device is looked up by the hash of its key.
 */
async function resolveDevice(env: Bindings, key: string | undefined): Promise<number | null> {
  if (!key) return null;
  if (env.DEVICE_KEY && key === env.DEVICE_KEY) return 1;
  const row = await env.DB.prepare("SELECT id FROM devices WHERE key_hash = ?")
    .bind(await sha256Hex(key))
    .first<{ id: number }>();
  return row?.id ?? null;
}

app.post("/api/telemetry", async (c) => {
  const deviceId = await resolveDevice(c.env, c.req.header("x-device-key"));
  if (deviceId === null) return c.json({ error: "unauthorized" }, 401);

  let body: Record<string, unknown>;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "body bukan JSON" }, 400);
  }

  const db = c.env.DB;
  const now = Date.now();

  await db
    .prepare(
      `INSERT INTO readings
         (device_id, ts, level_air, raw_water, stok_pakan, jarak_pakan, pompa, terkunci,
          status_air, status_pakan, rssi, uptime_ms)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .bind(
      deviceId,
      now,
      num(body.level_air, 0, 100),
      num(body.raw_water, 0, 1024),
      num(body.stok_pakan, 0, 100),
      num(body.jarak_pakan, 0, 400),
      body.pompa ? 1 : 0,
      body.terkunci ? 1 : 0,
      String(body.status_air ?? "").slice(0, 40),
      String(body.status_pakan ?? "").slice(0, 40),
      num(body.rssi, -120, 0),
      num(body.uptime_ms, 0, Number.MAX_SAFE_INTEGER)
    )
    .run();

  // An indexed delete of the few rows that just aged out; done after answering
  // so the device does not wait on it.
  c.executionCtx.waitUntil(
    db.prepare("DELETE FROM readings WHERE ts < ?").bind(now - READINGS_KEEP_MS).run()
  );

  // Events the firmware raised locally, so notifications survive leaving Blynk.
  //
  // Delivery is at-least-once: when a POST reaches here but its response is
  // lost on the way back, the device believes it failed and sends the same
  // queue again. INSERT OR IGNORE against the unique ext_id turns that into
  // exactly-once. Without it one feed warning was stored sixty times.
  if (Array.isArray(body.events) && body.events.length) {
    const events = (body.events as Array<{ id?: string; kind?: string; message?: string }>).slice(0, 5);
    const baru: string[] = [];
    // Every alert names its aquarium, and simulated ones say so.
    const label = (await db
      .prepare("SELECT name, simulated FROM devices WHERE id = ?")
      .bind(deviceId)
      .first<{ name: string; simulated: number }>())!;

    for (const e of events) {
      const kind = String(e.kind ?? "info").slice(0, 32);
      const message = String(e.message ?? "").slice(0, 200);
      const res = await db
        .prepare("INSERT OR IGNORE INTO events (device_id, ts, kind, message, ext_id) VALUES (?,?,?,?,?)")
        .bind(deviceId, now, kind, message, e.id ? String(e.id).slice(0, 48) : null)
        .run();

      // Only a row that was actually written deserves an alert. A resent queue
      // inserts nothing thanks to the unique ext_id, and must stay silent too,
      // otherwise one warning would be pushed to the owner on every retry.
      if (res.meta.changes > 0) {
        const teks = pesanEvent(kind, message, label);
        if (teks) baru.push(teks);
      }
    }

    // The device is holding a TLS connection open waiting for this response,
    // and that time is its most expensive resource, so the alerts are sent
    // after the device has been answered rather than before.
    if (baru.length) c.executionCtx.waitUntil(kirimSemua(c.env, baru));
  }

  // Acknowledge whatever the device says it carried out. Only its own commands:
  // an id that belongs to another aquarium is ignored, not acked.
  if (Array.isArray(body.ack) && body.ack.length) {
    const ids = (body.ack as unknown[]).map(Number).filter(Number.isInteger).slice(0, 20);
    if (ids.length) {
      await db
        .prepare(
          `UPDATE commands SET acked_at = ? WHERE device_id = ? AND id IN (${ids.map(() => "?").join(",")})`
        )
        .bind(now, deviceId, ...ids)
        .run();
    }
  }

  // Hand back what is still outstanding. A command stays pending until it is
  // acked, so a dropped response just means it is offered again next cycle.
  const { results: pending } = await db
    .prepare(
      `SELECT id, type, payload FROM commands
        WHERE device_id = ? AND acked_at IS NULL AND ts >= ? ORDER BY id LIMIT 10`
    )
    .bind(deviceId, now - COMMAND_TTL_MS)
    .all<{ id: number; type: string; payload: string | null }>();

  if (pending.length) {
    const ids = pending.map((p) => p.id);
    await db
      .prepare(`UPDATE commands SET sent_at = ? WHERE id IN (${ids.map(() => "?").join(",")})`)
      .bind(now, ...ids)
      .run();
  }

  return c.json({
    ok: true,
    server_time: now,
    // Wall-clock seconds in WIB, for the device to set its RTC from. The
    // timezone is decided here rather than in the firmware so the dashboard
    // and the device cannot drift apart on it. WIB has no daylight saving,
    // so a fixed offset is the whole of the rule.
    epoch_wib: Math.floor(now / 1000) + 7 * 3600,
    commands: pending.map((p) => ({
      id: p.id,
      type: p.type,
      payload: p.payload ? JSON.parse(p.payload) : {},
    })),
    settings: await readSettings(db, deviceId),
  });
});

app.post("/api/command", async (c) => {
  let body: { device?: unknown; type?: string; payload?: Record<string, unknown> };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "body bukan JSON" }, 400);
  }

  // Required, never defaulted: a command sent to the wrong aquarium is worse
  // than one refused.
  if (body.device === undefined || body.device === null) {
    return c.json({ error: "akuarium tujuan belum dipilih" }, 400);
  }
  const deviceId = Number(body.device);
  if (!(await deviceExists(c.env.DB, deviceId))) return c.json(NO_DEVICE, 404);

  const type = String(body.type ?? "") as CommandType;
  if (!COMMAND_TYPES.includes(type)) {
    return c.json({ error: `perintah tidak dikenal: ${type}` }, 400);
  }

  const raw = body.payload ?? {};
  let payload: Record<string, unknown> = {};

  if (type === "pump") {
    payload = { on: raw.on === true || raw.on === 1 };
  } else if (type === "settings") {
    for (const [key, min, max] of SETTING_RANGES) {
      if (raw[key] === undefined) continue;
      const n = Number(raw[key]);
      if (!Number.isInteger(n) || n < min || n > max) {
        return c.json({ error: `${key} harus bilangan bulat ${min}-${max}` }, 400);
      }
      payload[key] = n;
    }
    if (Object.keys(payload).length === 0) {
      return c.json({ error: "tidak ada setelan yang diubah" }, 400);
    }

    // A partial update still has to hold against what is already stored:
    // changing one half of a calibration pair can invert it on its own.
    const merged = { ...(await readSettings(c.env.DB, deviceId)), ...(payload as Record<string, number>) };
    for (const [lowKey, highKey, gap, message] of CALIBRATION_PAIRS) {
      const low = merged[lowKey];
      const high = merged[highKey];
      if (low === undefined || high === undefined) continue;
      if (high - low < gap) return c.json({ error: message }, 400);
    }
  }

  const db = c.env.DB;
  const now = Date.now();

  // Settings are state, not an action: write them through so the dashboard shows
  // the new value immediately even while the device is offline.
  if (type === "settings") {
    await db.batch(
      Object.entries(payload).map(([k, v]) =>
        db
          .prepare(
            "INSERT INTO settings (device_id, key, value) VALUES (?,?,?) ON CONFLICT(device_id, key) DO UPDATE SET value = excluded.value"
          )
          .bind(deviceId, k, String(v))
      )
    );
  }

  const res = await db
    .prepare("INSERT INTO commands (device_id, ts, type, payload) VALUES (?,?,?,?)")
    .bind(deviceId, now, type, JSON.stringify(payload))
    .run();

  return c.json({ ok: true, id: res.meta.last_row_id, device: deviceId, type, payload });
});

/**
 * Telegram webhook. Commands arriving here land on the same queue the
 * dashboard writes to, so the bot is a second interface rather than a second
 * control path with rules of its own.
 */
app.post("/api/telegram", (c) => tanganiWebhook(c.req.raw, c.env));

app.get("/api/latest", async (c) => {
  const db = c.env.DB;
  const deviceId = await requestedDevice(db, c.req.query("device"));
  if (deviceId === null) return c.json(NO_DEVICE, 404);

  const reading = await db
    .prepare("SELECT * FROM readings WHERE device_id = ? ORDER BY ts DESC LIMIT 1")
    .bind(deviceId)
    .first<Reading>();

  const { results: events } = await db
    .prepare("SELECT id, ts, kind, message FROM events WHERE device_id = ? ORDER BY ts DESC LIMIT 8")
    .bind(deviceId)
    .all<EventRow>();

  const { results: commands } = await db
    .prepare(
      `SELECT id, ts, type, payload, sent_at, acked_at,
              (acked_at IS NULL AND ts < ?) AS expired
         FROM commands WHERE device_id = ? ORDER BY id DESC LIMIT 12`
    )
    .bind(Date.now() - COMMAND_TTL_MS, deviceId)
    .all<CommandRow>();

  return c.json({
    device: deviceId,
    reading,
    events,
    commands,
    settings: await readSettings(db, deviceId),
    server_time: Date.now(),
  });
});

app.get("/api/history", async (c) => {
  const deviceId = await requestedDevice(c.env.DB, c.req.query("device"));
  if (deviceId === null) return c.json(NO_DEVICE, 404);
  const limit = Math.min(500, Math.max(10, Number(c.req.query("limit")) || 120));
  const { results } = await c.env.DB.prepare(
    "SELECT ts, level_air, stok_pakan, pompa FROM readings WHERE device_id = ? ORDER BY ts DESC LIMIT ?"
  )
    .bind(deviceId, limit)
    .all();
  return c.json({ device: deviceId, readings: results.reverse() });
});

/** Every aquarium with its newest reading, for the fleet strip. One query. */
app.get("/api/devices", async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT d.id, d.name, d.simulated,
            r.ts, r.level_air, r.stok_pakan, r.pompa, r.terkunci
       FROM devices d
       LEFT JOIN readings r
         ON r.id = (SELECT id FROM readings WHERE device_id = d.id ORDER BY ts DESC LIMIT 1)
      ORDER BY d.id`
  ).all<DeviceSummary>();
  return c.json({ devices: results, server_time: Date.now() });
});

/** The whole fleet over one window, for the Analitik page. */
app.get("/api/analytics", async (c) => {
  const range = (c.req.query("range") ?? "1h") as Range;
  // hasOwn, not `in`: "toString" is "in" every object and would yield a NaN window.
  if (!Object.hasOwn(RANGES, range)) return c.json({ error: "rentang harus 1h, 24h atau 7d" }, 400);
  return c.json(await fleetAnalytics(c.env.DB, range, Date.now(), COMMAND_TTL_MS));
});

app.onError((err, c) => c.json({ error: err.message }, 500));
app.notFound((c) => c.json({ error: "endpoint tidak ada" }, 404));

export default app;
